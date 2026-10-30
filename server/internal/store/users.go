package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Querier is satisfied by both the pool and a transaction.
type Querier interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// pgTime scans a timestamptz.
type pgTime struct{ time.Time }

func (p *pgTime) Scan(src any) error {
	if t, ok := src.(time.Time); ok {
		p.Time = t
	}
	return nil
}

func (p pgTime) ms() int64 { return p.UnixMilli() }

type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      *string   `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

// UpsertUser finds a user by email or creates one with `newID`.
func (s *Store) UpsertUser(ctx context.Context, newID, email string, name *string) (User, error) {
	var u User
	err := s.DB.QueryRow(ctx, `
		INSERT INTO users (id, email, name) VALUES ($1, lower($2), $3)
		ON CONFLICT (email) DO UPDATE SET name = COALESCE(EXCLUDED.name, users.name)
		RETURNING id, email, name, created_at`, newID, email, name).Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt)
	return u, err
}

// UpsertUserWithID creates a user with a fixed id (no-op if it exists).
func (s *Store) UpsertUserWithID(ctx context.Context, id, email string, name *string) (User, error) {
	var u User
	err := s.DB.QueryRow(ctx, `
		INSERT INTO users (id, email, name) VALUES ($1, lower($2), $3)
		ON CONFLICT (email) DO UPDATE SET name = COALESCE(EXCLUDED.name, users.name)
		RETURNING id, email, name, created_at`, id, email, name).Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt)
	return u, err
}

func (s *Store) GetUser(ctx context.Context, id string) (User, error) {
	var u User
	err := s.DB.QueryRow(ctx, `SELECT id, email, name, created_at FROM users WHERE id = $1`, id).
		Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return u, ErrNotFound
	}
	return u, err
}

// DeleteUser removes the user and, by cascade, every row that belongs to them.
func (s *Store) DeleteUser(ctx context.Context, id string) error {
	_, err := s.DB.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}

// ── sync runs ────────────────────────────────────────────────────────────────

func (s *Store) StartSyncRun(ctx context.Context, id, userID, source string) error {
	_, err := s.DB.Exec(ctx, `INSERT INTO sync_runs (id, user_id, source, started_at) VALUES ($1, $2, $3, now())`, id, userID, source)
	return err
}

func (s *Store) FinishSyncRun(ctx context.Context, id string, found, parsed int, errs string) error {
	var e any
	if errs != "" {
		e = errs
	}
	_, err := s.DB.Exec(ctx, `UPDATE sync_runs SET finished_at = now(), items_found = $2, items_parsed = $3, errors = $4 WHERE id = $1`,
		id, found, parsed, e)
	return err
}

type SyncRun struct {
	Source      string     `json:"source"`
	StartedAt   time.Time  `json:"startedAt"`
	FinishedAt  *time.Time `json:"finishedAt"`
	ItemsFound  int        `json:"itemsFound"`
	ItemsParsed int        `json:"itemsParsed"`
	Errors      *string    `json:"errors"`
}

func (s *Store) SyncRuns(ctx context.Context, userID string, limit int) ([]SyncRun, error) {
	rows, err := s.DB.Query(ctx, `SELECT source, started_at, finished_at, items_found, items_parsed, errors
		FROM sync_runs WHERE user_id = $1 ORDER BY started_at DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SyncRun{}
	for rows.Next() {
		var r SyncRun
		if err := rows.Scan(&r.Source, &r.StartedAt, &r.FinishedAt, &r.ItemsFound, &r.ItemsParsed, &r.Errors); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// ── gmail ────────────────────────────────────────────────────────────────────

type GmailAccount struct {
	UserID          string
	Email           string
	RefreshTokenEnc []byte
	HistoryID       uint64
	LastSyncAt      *time.Time
}

func (s *Store) SaveGmail(ctx context.Context, a GmailAccount) error {
	_, err := s.DB.Exec(ctx, `
		INSERT INTO gmail_accounts (user_id, email, refresh_token_enc, history_id) VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, refresh_token_enc = EXCLUDED.refresh_token_enc,
			history_id = EXCLUDED.history_id, connected_at = now()`,
		a.UserID, a.Email, a.RefreshTokenEnc, int64(a.HistoryID))
	return err
}

func (s *Store) GetGmail(ctx context.Context, userID string) (GmailAccount, error) {
	var a GmailAccount
	var h int64
	err := s.DB.QueryRow(ctx, `SELECT user_id, email, refresh_token_enc, history_id, last_sync_at FROM gmail_accounts WHERE user_id = $1`, userID).
		Scan(&a.UserID, &a.Email, &a.RefreshTokenEnc, &h, &a.LastSyncAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	a.HistoryID = uint64(h)
	return a, err
}

func (s *Store) GmailSynced(ctx context.Context, userID string, historyID uint64) error {
	_, err := s.DB.Exec(ctx, `UPDATE gmail_accounts SET history_id = GREATEST(history_id, $2), last_sync_at = now() WHERE user_id = $1`,
		userID, int64(historyID))
	return err
}

func (s *Store) DeleteGmail(ctx context.Context, userID string) error {
	_, err := s.DB.Exec(ctx, `DELETE FROM gmail_accounts WHERE user_id = $1`, userID)
	return err
}

func (s *Store) GmailUserIDs(ctx context.Context) ([]string, error) {
	rows, err := s.DB.Query(ctx, `SELECT user_id FROM gmail_accounts`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// ── extraction cache ─────────────────────────────────────────────────────────

type CachedExtraction struct {
	Type, Merchant, Category string
	Method                   *string
	Confidence               float64
}

func (s *Store) CachedExtraction(ctx context.Context, userID, signature string) (*CachedExtraction, error) {
	var c CachedExtraction
	err := s.DB.QueryRow(ctx, `UPDATE extraction_cache SET hits = hits + 1 WHERE user_id = $1 AND signature = $2
		RETURNING type, merchant, category, method, confidence`, userID, signature).
		Scan(&c.Type, &c.Merchant, &c.Category, &c.Method, &c.Confidence)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &c, err
}

func (s *Store) CacheExtraction(ctx context.Context, userID, signature string, c CachedExtraction) error {
	_, err := s.DB.Exec(ctx, `
		INSERT INTO extraction_cache (user_id, signature, type, merchant, category, method, confidence) VALUES ($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT (user_id, signature) DO UPDATE SET type = EXCLUDED.type, merchant = EXCLUDED.merchant,
			category = EXCLUDED.category, method = EXCLUDED.method, confidence = EXCLUDED.confidence, updated_at = now()`,
		userID, signature, c.Type, c.Merchant, c.Category, c.Method, c.Confidence)
	return err
}

// Export gathers everything stored for a user (DPDP data export).
func (s *Store) Export(ctx context.Context, userID string) (map[string]any, error) {
	user, err := s.GetUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	txns, err := s.AllTxns(ctx, userID)
	if err != nil {
		return nil, err
	}
	runs, err := s.SyncRuns(ctx, userID, 1000)
	if err != nil {
		return nil, err
	}
	out := map[string]any{"user": user, "transactions": txns, "syncRuns": runs}
	if g, err := s.GetGmail(ctx, userID); err == nil {
		out["gmail"] = map[string]any{"email": g.Email, "lastSyncAt": g.LastSyncAt}
	}
	return out, nil
}
