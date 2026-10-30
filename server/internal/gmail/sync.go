// Package gmail connects a user's Gmail (read-only) and turns order receipts
// into transactions. Only the extracted transaction is stored, never the email.
package gmail

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	gm "google.golang.org/api/gmail/v1"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/option"

	"kharcha/server/internal/auth"
	"kharcha/server/internal/ids"
	"kharcha/server/internal/ingest"
	"kharcha/server/internal/llm"
	"kharcha/server/internal/store"
)

const maxMessagesPerSync = 300

type Syncer struct {
	Store    *store.Store
	Sealer   *auth.Sealer
	LLM      *llm.Service
	Ingest   *ingest.Ingest
	ClientID string
	Secret   string
	Lookback time.Duration
	Log      *slog.Logger
}

type Status struct {
	Connected  bool     `json:"connected"`
	Email      *string  `json:"email"`
	LastSyncAt *int64   `json:"lastSyncAt"`
	Senders    []string `json:"senders"`
}

func (s *Syncer) oauth(redirect string) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     s.ClientID,
		ClientSecret: s.Secret,
		Endpoint:     google.Endpoint,
		Scopes:       []string{gm.GmailReadonlyScope},
		RedirectURL:  redirect,
	}
}

func (s *Syncer) Configured() bool { return s.ClientID != "" && s.Secret != "" }

// Connect exchanges the app's server auth code for a refresh token (stored
// encrypted) and records the mailbox's current history id.
func (s *Syncer) Connect(ctx context.Context, userID, code, redirect string) (Status, error) {
	if !s.Configured() {
		return Status{}, errors.New("Gmail is not configured on this server (GOOGLE_WEB_CLIENT_ID/SECRET)")
	}
	tok, err := s.oauth(redirect).Exchange(ctx, code)
	if err != nil {
		return Status{}, fmt.Errorf("Google rejected the authorisation code: %w", err)
	}
	if tok.RefreshToken == "" {
		return Status{}, errors.New("Google didn't grant offline access; disconnect Kharcha in your Google account and connect again")
	}
	if granted, ok := tok.Extra("scope").(string); ok && !strings.Contains(granted, gm.GmailReadonlyScope) {
		return Status{}, errors.New("Gmail read-only access wasn't granted")
	}
	svc, err := gm.NewService(ctx, option.WithTokenSource(s.oauth(redirect).TokenSource(ctx, tok)))
	if err != nil {
		return Status{}, err
	}
	profile, err := svc.Users.GetProfile("me").Context(ctx).Do()
	if err != nil {
		return Status{}, err
	}
	sealed, err := s.Sealer.Seal([]byte(tok.RefreshToken))
	if err != nil {
		return Status{}, err
	}
	// history_id 0 makes the first sync a full lookback query.
	if err := s.Store.SaveGmail(ctx, store.GmailAccount{UserID: userID, Email: profile.EmailAddress, RefreshTokenEnc: sealed}); err != nil {
		return Status{}, err
	}
	return s.Status(ctx, userID)
}

func (s *Syncer) Status(ctx context.Context, userID string) (Status, error) {
	acct, err := s.Store.GetGmail(ctx, userID)
	if errors.Is(err, store.ErrNotFound) {
		return Status{Senders: Senders}, nil
	}
	if err != nil {
		return Status{}, err
	}
	st := Status{Connected: true, Email: &acct.Email, Senders: Senders}
	if acct.LastSyncAt != nil {
		v := acct.LastSyncAt.UnixMilli()
		st.LastSyncAt = &v
	}
	return st, nil
}

// Disconnect revokes Google access and forgets the mailbox.
func (s *Syncer) Disconnect(ctx context.Context, userID string) error {
	acct, err := s.Store.GetGmail(ctx, userID)
	if errors.Is(err, store.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if rt, err := s.Sealer.Open(acct.RefreshTokenEnc); err == nil {
		form := url.Values{"token": {string(rt)}}
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "https://oauth2.googleapis.com/revoke", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		if resp, err := http.DefaultClient.Do(req); err == nil {
			resp.Body.Close()
		}
	}
	return s.Store.DeleteGmail(ctx, userID)
}

// Sync reads new receipts (incrementally via historyId when possible), extracts
// transactions with the LLM, and merges them with matching bank SMS.
func (s *Syncer) Sync(ctx context.Context, userID string) error {
	acct, err := s.Store.GetGmail(ctx, userID)
	if err != nil {
		return err
	}
	rt, err := s.Sealer.Open(acct.RefreshTokenEnc)
	if err != nil {
		return fmt.Errorf("decrypt refresh token: %w", err)
	}
	svc, err := gm.NewService(ctx, option.WithTokenSource(s.oauth("").TokenSource(ctx, &oauth2.Token{RefreshToken: string(rt)})))
	if err != nil {
		return err
	}

	runID := ids.New()
	_ = s.Store.StartSyncRun(ctx, runID, userID, "email")
	found, parsed, errs := 0, 0, []string{}
	defer func() {
		_ = s.Store.FinishSyncRun(context.WithoutCancel(ctx), runID, found, parsed, strings.Join(errs, "; "))
	}()

	profile, err := svc.Users.GetProfile("me").Context(ctx).Do()
	if err != nil {
		errs = append(errs, err.Error())
		return err
	}

	messageIDs, err := s.newMessageIDs(ctx, svc, acct)
	if err != nil {
		errs = append(errs, err.Error())
		return err
	}

	var items []llm.ExtractItem
	received := map[string]int64{}
	for _, id := range messageIDs {
		ref := ids.Hash("gmail", id)
		if seen, err := s.Store.HasSourceRef(ctx, acct.UserID, "email", ref); err != nil || seen {
			continue
		}
		msg, err := svc.Users.Messages.Get("me", id).Format("full").Context(ctx).Do()
		if err != nil {
			errs = append(errs, err.Error())
			continue
		}
		sender, ok := AllowedSender(Header(msg.Payload, "From"))
		if !ok {
			continue // history can surface any new mail; only listed senders are read
		}
		found++
		body := Body(msg.Payload)
		text := fmt.Sprintf("Subject: %s\n\n%s", Header(msg.Payload, "Subject"), body)
		items = append(items, llm.ExtractItem{ID: ref, Kind: "email", Sender: sender, Text: text, ReceivedAt: msg.InternalDate})
		received[ref] = msg.InternalDate
	}

	if len(items) > 0 {
		results, err := s.LLM.Extract(ctx, userID, items)
		if err != nil {
			errs = append(errs, err.Error())
		}
		for _, r := range results {
			if r.Type == "ignore" {
				continue
			}
			t := toTxn(r, received[r.ID])
			inserted, err := s.Ingest.AddEmail(ctx, userID, t)
			if err != nil {
				errs = append(errs, err.Error())
				continue
			}
			if inserted {
				parsed++
			}
		}
	}
	return s.Store.GmailSynced(ctx, userID, profile.HistoryId)
}

func (s *Syncer) newMessageIDs(ctx context.Context, svc *gm.Service, acct store.GmailAccount) ([]string, error) {
	if acct.HistoryID > 0 {
		var out []string
		call := svc.Users.History.List("me").StartHistoryId(acct.HistoryID).HistoryTypes("messageAdded").Context(ctx)
		err := call.Pages(ctx, func(page *gm.ListHistoryResponse) error {
			for _, h := range page.History {
				for _, added := range h.MessagesAdded {
					if added.Message != nil && len(out) < maxMessagesPerSync {
						out = append(out, added.Message.Id)
					}
				}
			}
			return nil
		})
		var gerr *googleapi.Error
		if errors.As(err, &gerr) && gerr.Code == http.StatusNotFound {
			// History expired (Gmail keeps about a week): fall back to a search.
			s.Log.Info("gmail history expired, running a search", "user", acct.UserID)
		} else {
			return out, err
		}
	}
	after := time.Now().Add(-s.Lookback)
	if acct.LastSyncAt != nil && acct.LastSyncAt.After(after) {
		after = acct.LastSyncAt.Add(-24 * time.Hour)
	}
	var out []string
	err := svc.Users.Messages.List("me").Q(Query(after)).MaxResults(100).Context(ctx).Pages(ctx, func(page *gm.ListMessagesResponse) error {
		for _, m := range page.Messages {
			out = append(out, m.Id)
		}
		if len(out) >= maxMessagesPerSync {
			return errStop
		}
		return nil
	})
	if errors.Is(err, errStop) {
		err = nil
	}
	return out, err
}

var errStop = errors.New("enough")

func toTxn(r llm.Extracted, receivedAt int64) store.Txn {
	now := time.Now().UnixMilli()
	occurred := receivedAt
	if r.Timestamp != nil {
		if t, err := time.Parse(time.RFC3339, *r.Timestamp); err == nil && t.Before(time.Now().Add(time.Hour)) {
			occurred = t.UnixMilli()
		}
	}
	status := "confirmed"
	if r.Confidence < 0.7 {
		status = "review"
	}
	ref := r.ID
	return store.Txn{
		ID: ids.New(), Amount: int64(r.Amount*100 + 0.5), Type: r.Type, Merchant: r.Merchant, Category: r.Category,
		Method: r.PaymentMethod, OccurredAt: occurred, Source: "email", SourceRef: &ref, AccountHint: r.AccountHint,
		UpiRef: r.UpiRef, OrderID: r.OrderID, Items: r.Items, Confidence: r.Confidence, Status: status,
		CreatedAt: now, UpdatedAt: now,
	}
}
