package store

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
)

// Txn is a transaction as exchanged with the app (camelCase, epoch-ms times, paise amounts).
type Txn struct {
	ID          string   `json:"id"`
	Amount      int64    `json:"amount"`
	Type        string   `json:"type"`
	Merchant    string   `json:"merchant"`
	Category    string   `json:"category"`
	Method      *string  `json:"method"`
	OccurredAt  int64    `json:"occurredAt"`
	Source      string   `json:"source"`
	SourceRef   *string  `json:"sourceRef"`
	AccountHint *string  `json:"accountHint"`
	UpiRef      *string  `json:"upiRef"`
	OrderID     *string  `json:"orderId"`
	Note        *string  `json:"note"`
	Items       []string `json:"items"`
	Confidence  float64  `json:"confidence"`
	Status      string   `json:"status"`
	Excluded    bool     `json:"excluded"`
	DedupeGroup *string  `json:"dedupeGroup"`
	MergedInto  *string  `json:"mergedInto"`
	CreatedAt   int64    `json:"createdAt"`
	UpdatedAt   int64    `json:"updatedAt"`
	Deleted     bool     `json:"deleted"`
}

const txnColumns = `id, amount, type, merchant, category, method, occurred_at, source, source_ref, account_hint,
	upi_ref, order_id, note, items, confidence, status, excluded, dedupe_group, merged_into, created_at, updated_at, deleted`

func scanTxn(row pgx.Row) (Txn, error) {
	var t Txn
	var items []byte
	var occurred, created, updated pgTime
	err := row.Scan(&t.ID, &t.Amount, &t.Type, &t.Merchant, &t.Category, &t.Method, &occurred, &t.Source, &t.SourceRef,
		&t.AccountHint, &t.UpiRef, &t.OrderID, &t.Note, &items, &t.Confidence, &t.Status, &t.Excluded, &t.DedupeGroup,
		&t.MergedInto, &created, &updated, &t.Deleted)
	if err != nil {
		return t, err
	}
	t.OccurredAt, t.CreatedAt, t.UpdatedAt = occurred.ms(), created.ms(), updated.ms()
	if len(items) > 0 {
		_ = json.Unmarshal(items, &t.Items)
	}
	return t, nil
}

// UpsertTxn writes a transaction. When the row exists, the newer `updatedAt`
// wins, so a stale client can't overwrite a server-side merge. Returns whether
// the incoming version was applied.
func (s *Store) UpsertTxn(ctx context.Context, q Querier, userID string, t Txn) (bool, error) {
	var items any
	if t.Items != nil {
		b, _ := json.Marshal(t.Items)
		items = b
	}
	tag, err := q.Exec(ctx, `
		INSERT INTO transactions (id, user_id, amount, type, merchant, category, method, occurred_at, source, source_ref,
			account_hint, upi_ref, order_id, note, items, confidence, status, excluded, dedupe_group, merged_into,
			created_at, updated_at, deleted)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
		ON CONFLICT (id) DO UPDATE SET
			amount = EXCLUDED.amount, type = EXCLUDED.type, merchant = EXCLUDED.merchant, category = EXCLUDED.category,
			method = EXCLUDED.method, occurred_at = EXCLUDED.occurred_at, account_hint = EXCLUDED.account_hint,
			upi_ref = EXCLUDED.upi_ref, order_id = EXCLUDED.order_id, note = EXCLUDED.note, items = EXCLUDED.items,
			confidence = EXCLUDED.confidence, status = EXCLUDED.status, excluded = EXCLUDED.excluded,
			dedupe_group = EXCLUDED.dedupe_group, merged_into = EXCLUDED.merged_into, updated_at = EXCLUDED.updated_at,
			deleted = EXCLUDED.deleted, server_seq = nextval('transactions_server_seq_seq')
		WHERE transactions.user_id = EXCLUDED.user_id AND transactions.updated_at <= EXCLUDED.updated_at`,
		t.ID, userID, t.Amount, t.Type, t.Merchant, t.Category, t.Method, fromMs(t.OccurredAt), t.Source, t.SourceRef,
		t.AccountHint, t.UpiRef, t.OrderID, t.Note, items, t.Confidence, t.Status, t.Excluded, t.DedupeGroup, t.MergedInto,
		fromMs(t.CreatedAt), fromMs(t.UpdatedAt), t.Deleted)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// InsertIfNew inserts a server-created transaction unless (source, sourceRef) already exists.
func (s *Store) InsertIfNew(ctx context.Context, q Querier, userID string, t Txn) (bool, error) {
	if t.SourceRef != nil {
		var exists bool
		err := q.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM transactions WHERE user_id = $1 AND source = $2 AND source_ref = $3)`,
			userID, t.Source, *t.SourceRef).Scan(&exists)
		if err != nil || exists {
			return false, err
		}
	}
	return s.UpsertTxn(ctx, q, userID, t)
}

// HasSourceRef reports whether a row from this source/ref is already stored.
func (s *Store) HasSourceRef(ctx context.Context, userID, source, ref string) (bool, error) {
	var exists bool
	err := s.DB.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM transactions WHERE user_id = $1 AND source = $2 AND source_ref = $3)`,
		userID, source, ref).Scan(&exists)
	return exists, err
}

// ChangedSince returns rows written after `cursor` (server_seq), oldest first, and the new cursor.
func (s *Store) ChangedSince(ctx context.Context, userID string, cursor int64, limit int) ([]Txn, int64, error) {
	rows, err := s.DB.Query(ctx, `SELECT `+txnColumns+`, server_seq FROM transactions
		WHERE user_id = $1 AND server_seq > $2 ORDER BY server_seq LIMIT $3`, userID, cursor, limit)
	if err != nil {
		return nil, cursor, err
	}
	defer rows.Close()
	out := []Txn{}
	next := cursor
	for rows.Next() {
		var t Txn
		var items []byte
		var occurred, created, updated pgTime
		var seq int64
		if err := rows.Scan(&t.ID, &t.Amount, &t.Type, &t.Merchant, &t.Category, &t.Method, &occurred, &t.Source, &t.SourceRef,
			&t.AccountHint, &t.UpiRef, &t.OrderID, &t.Note, &items, &t.Confidence, &t.Status, &t.Excluded, &t.DedupeGroup,
			&t.MergedInto, &created, &updated, &t.Deleted, &seq); err != nil {
			return nil, cursor, err
		}
		t.OccurredAt, t.CreatedAt, t.UpdatedAt = occurred.ms(), created.ms(), updated.ms()
		if len(items) > 0 {
			_ = json.Unmarshal(items, &t.Items)
		}
		out = append(out, t)
		next = seq
	}
	return out, next, rows.Err()
}

// Candidates returns live, unmerged rows of `source` within ±window of `at` (for dedupe).
func (s *Store) Candidates(ctx context.Context, q Querier, userID, source string, at int64, windowMs int64) ([]Txn, error) {
	rows, err := q.Query(ctx, `SELECT `+txnColumns+` FROM transactions
		WHERE user_id = $1 AND source = $2 AND deleted = false AND merged_into IS NULL
		AND occurred_at BETWEEN $3 AND $4`, userID, source, fromMs(at-windowMs), fromMs(at+windowMs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Txn
	for rows.Next() {
		t, err := scanTxn(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) GetTxn(ctx context.Context, q Querier, userID, id string) (Txn, error) {
	t, err := scanTxn(q.QueryRow(ctx, `SELECT `+txnColumns+` FROM transactions WHERE user_id = $1 AND id = $2`, userID, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return t, ErrNotFound
	}
	return t, err
}

func (s *Store) AllTxns(ctx context.Context, userID string) ([]Txn, error) {
	rows, err := s.DB.Query(ctx, `SELECT `+txnColumns+` FROM transactions WHERE user_id = $1 ORDER BY occurred_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Txn{}
	for rows.Next() {
		t, err := scanTxn(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}
