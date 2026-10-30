// Package ingest writes transactions and merges SMS/email duplicates as they arrive.
package ingest

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"kharcha/server/internal/dedupe"
	"kharcha/server/internal/ids"
	"kharcha/server/internal/store"
)

type Ingest struct{ Store *store.Store }

// AddEmail inserts an email-receipt transaction (once per source ref) and, if a
// bank SMS for the same spend exists, merges the two. Returns whether it was new.
func (i *Ingest) AddEmail(ctx context.Context, userID string, t store.Txn) (bool, error) {
	var inserted bool
	err := pgx.BeginFunc(ctx, i.Store.DB, func(tx pgx.Tx) error {
		var err error
		if inserted, err = i.Store.InsertIfNew(ctx, tx, userID, t); err != nil || !inserted {
			return err
		}
		return i.mergeWith(ctx, tx, userID, t, "sms")
	})
	return inserted, err
}

// PushFromApp upserts a transaction sent by the app; new SMS rows are checked
// against email receipts already on the server. Returns whether it was applied.
func (i *Ingest) PushFromApp(ctx context.Context, userID string, t store.Txn) (bool, error) {
	var applied bool
	err := pgx.BeginFunc(ctx, i.Store.DB, func(tx pgx.Tx) error {
		var err error
		if applied, err = i.Store.UpsertTxn(ctx, tx, userID, t); err != nil || !applied {
			return err
		}
		if t.Source != "sms" || t.MergedInto != nil || t.DedupeGroup != nil || t.Deleted {
			return nil
		}
		return i.mergeWith(ctx, tx, userID, t, "email")
	})
	return applied, err
}

func (i *Ingest) mergeWith(ctx context.Context, tx pgx.Tx, userID string, t store.Txn, otherSource string) error {
	cands, err := i.Store.Candidates(ctx, tx, userID, otherSource, t.OccurredAt, dedupe.Window)
	if err != nil {
		return err
	}
	isSMS := t.Source == "sms"
	idx := dedupe.Best(t, cands, isSMS)
	if idx < 0 {
		return nil
	}
	smsTxn, emailTxn := cands[idx], t
	if isSMS {
		smsTxn, emailTxn = t, cands[idx]
	}
	m, e := dedupe.Merge(smsTxn, emailTxn, ids.New(), time.Now().UnixMilli())
	if _, err := i.Store.UpsertTxn(ctx, tx, userID, m); err != nil {
		return err
	}
	_, err = i.Store.UpsertTxn(ctx, tx, userID, e)
	return err
}
