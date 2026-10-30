// Package api is Kharcha's HTTP API, consumed by the mobile app (mobile/src/lib/api.ts).
package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"kharcha/server/internal/auth"
	"kharcha/server/internal/gmail"
	"kharcha/server/internal/ids"
	"kharcha/server/internal/ingest"
	"kharcha/server/internal/llm"
	"kharcha/server/internal/queue"
	"kharcha/server/internal/store"
)

type Server struct {
	Store           *store.Store
	Tokens          auth.Tokens
	LLM             *llm.Service
	Gmail           *gmail.Syncer
	Ingest          *ingest.Ingest
	Queue           queue.Queue
	Log             *slog.Logger
	DevLogin        bool
	GoogleClientIDs []string
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.health)
	mux.HandleFunc("POST /v1/auth/dev", s.devLogin)
	mux.HandleFunc("POST /v1/auth/google", s.googleLogin)

	mux.Handle("POST /v1/extract", s.authed(s.extract))
	mux.Handle("POST /v1/roast", s.authed(s.roast))
	mux.Handle("POST /v1/transactions/batch", s.authed(s.pushTransactions))
	mux.Handle("GET /v1/transactions", s.authed(s.pullTransactions))
	mux.Handle("POST /v1/gmail/connect", s.authed(s.gmailConnect))
	mux.Handle("GET /v1/gmail/status", s.authed(s.gmailStatus))
	mux.Handle("POST /v1/gmail/sync", s.authed(s.gmailSync))
	mux.Handle("DELETE /v1/gmail", s.authed(s.gmailDisconnect))
	mux.Handle("GET /v1/me/export", s.authed(s.export))
	mux.Handle("DELETE /v1/me", s.authed(s.deleteMe))
	return s.logRequests(http.MaxBytesHandler(mux, 5<<20))
}

// ── plumbing ─────────────────────────────────────────────────────────────────

type ctxKey struct{}

func userID(r *http.Request) string { return r.Context().Value(ctxKey{}).(string) }

func (s *Server) authed(h http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok {
			writeErr(w, http.StatusUnauthorized, "sign in required")
			return
		}
		id, err := s.Tokens.Verify(token)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "session expired, sign in again")
			return
		}
		if _, err := s.Store.GetUser(r.Context(), id); err != nil {
			writeErr(w, http.StatusUnauthorized, "account not found")
			return
		}
		h(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, id)))
	})
}

func (s *Server) logRequests(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: 200}
		h.ServeHTTP(rec, r)
		// Paths only: request bodies may carry transaction data and are never logged.
		s.Log.Info("http", "method", r.Method, "path", r.URL.Path, "status", rec.status, "ms", time.Since(start).Milliseconds())
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

func (s *Server) internal(w http.ResponseWriter, err error) {
	s.Log.Error("request failed", "err", err)
	writeErr(w, http.StatusInternalServerError, "something went wrong")
}

// ── handlers ─────────────────────────────────────────────────────────────────

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "llm": s.LLM.Chain.Names(), "gmail": s.Gmail.Configured()})
}

type authResponse struct {
	Token string     `json:"token"`
	User  store.User `json:"user"`
}

func (s *Server) issue(w http.ResponseWriter, r *http.Request, email string, name *string) {
	u, err := s.Store.UpsertUser(r.Context(), ids.New(), email, name)
	if err != nil {
		s.internal(w, err)
		return
	}
	token, err := s.Tokens.Issue(u.ID)
	if err != nil {
		s.internal(w, err)
		return
	}
	writeJSON(w, http.StatusOK, authResponse{Token: token, User: u})
}

// devLogin signs in by email alone. Only for local development.
func (s *Server) devLogin(w http.ResponseWriter, r *http.Request) {
	if !s.DevLogin {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	var body struct {
		Email string  `json:"email"`
		Name  *string `json:"name"`
	}
	if !decode(w, r, &body) {
		return
	}
	if !strings.Contains(body.Email, "@") {
		writeErr(w, http.StatusBadRequest, "email required")
		return
	}
	s.issue(w, r, body.Email, body.Name)
}

func (s *Server) googleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDToken string `json:"idToken"`
	}
	if !decode(w, r, &body) {
		return
	}
	id, err := auth.VerifyGoogleIDToken(r.Context(), body.IDToken, s.GoogleClientIDs)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}
	var name *string
	if id.Name != "" {
		name = &id.Name
	}
	s.issue(w, r, id.Email, name)
}

func (s *Server) extract(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Items []llm.ExtractItem `json:"items"`
	}
	if !decode(w, r, &body) {
		return
	}
	if len(body.Items) > 200 {
		writeErr(w, http.StatusBadRequest, "at most 200 items per request")
		return
	}
	results, err := s.LLM.Extract(r.Context(), userID(r), body.Items)
	if errors.Is(err, llm.ErrNoProvider) {
		writeErr(w, http.StatusServiceUnavailable, "no LLM provider configured")
		return
	}
	if err != nil {
		writeErr(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": results})
}

func (s *Server) roast(w http.ResponseWriter, r *http.Request) {
	var body llm.RoastRequest
	if !decode(w, r, &body) {
		return
	}
	verdict, err := s.LLM.Roast(r.Context(), body)
	if err != nil {
		writeErr(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"verdict": verdict})
}

var validType = map[string]bool{"debit": true, "credit": true, "refund": true}
var validSource = map[string]bool{"sms": true, "email": true, "manual": true}
var validStatus = map[string]bool{"confirmed": true, "review": true, "ignored": true}

func (s *Server) pushTransactions(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Transactions []store.Txn `json:"transactions"`
	}
	if !decode(w, r, &body) {
		return
	}
	if len(body.Transactions) > 1000 {
		writeErr(w, http.StatusBadRequest, "at most 1000 transactions per request")
		return
	}
	accepted := []string{}
	for _, t := range body.Transactions {
		if t.ID == "" || t.Amount < 0 || !validType[t.Type] || !validSource[t.Source] || !validStatus[t.Status] {
			continue
		}
		if _, err := s.Ingest.PushFromApp(r.Context(), userID(r), t); err != nil {
			// The server already holds this SMS/email under another id (e.g. the app
			// was reinstalled); the app picks up the server's row on its next pull.
			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
				s.Log.Error("push txn", "err", err)
				continue
			}
		}
		// Rejected-as-stale rows are still "accepted": the server copy is newer and will be pulled.
		accepted = append(accepted, t.ID)
	}
	writeJSON(w, http.StatusOK, map[string]any{"accepted": accepted})
}

func (s *Server) pullTransactions(w http.ResponseWriter, r *http.Request) {
	since, _ := strconv.ParseInt(r.URL.Query().Get("since"), 10, 64)
	txns, cursor, err := s.Store.ChangedSince(r.Context(), userID(r), since, 500)
	if err != nil {
		s.internal(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"transactions": txns, "cursor": cursor})
}

func (s *Server) gmailConnect(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code        string `json:"code"`
		RedirectURI string `json:"redirectUri"`
	}
	if !decode(w, r, &body) {
		return
	}
	st, err := s.Gmail.Connect(r.Context(), userID(r), body.Code, body.RedirectURI)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	_, _ = s.Queue.Enqueue(r.Context(), queue.Job{Kind: "gmail", UserID: userID(r)})
	writeJSON(w, http.StatusOK, st)
}

func (s *Server) gmailStatus(w http.ResponseWriter, r *http.Request) {
	st, err := s.Gmail.Status(r.Context(), userID(r))
	if err != nil {
		s.internal(w, err)
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (s *Server) gmailSync(w http.ResponseWriter, r *http.Request) {
	queued, err := s.Queue.Enqueue(r.Context(), queue.Job{Kind: "gmail", UserID: userID(r)})
	if err != nil {
		s.internal(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"queued": queued})
}

func (s *Server) gmailDisconnect(w http.ResponseWriter, r *http.Request) {
	if err := s.Gmail.Disconnect(r.Context(), userID(r)); err != nil {
		s.internal(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) export(w http.ResponseWriter, r *http.Request) {
	data, err := s.Store.Export(r.Context(), userID(r))
	if err != nil {
		s.internal(w, err)
		return
	}
	writeJSON(w, http.StatusOK, data)
}

// deleteMe is the DPDP "delete everything": revoke Gmail, then drop the user and all their rows.
func (s *Server) deleteMe(w http.ResponseWriter, r *http.Request) {
	if err := s.Gmail.Disconnect(r.Context(), userID(r)); err != nil {
		s.internal(w, err)
		return
	}
	if err := s.Store.DeleteUser(r.Context(), userID(r)); err != nil {
		s.internal(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
