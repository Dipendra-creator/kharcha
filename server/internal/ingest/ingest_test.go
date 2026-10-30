package ingest

import (
	"context"
	"os"
	"testing"
	"time"

	"kharcha/server/internal/ids"
	"kharcha/server/internal/store"
)

// Runs against a real database: KHARCHA_TEST_DATABASE_URL=postgres://localhost:5432/kharcha_test?sslmode=disable
func TestSMSAndEmailMerge(t *testing.T) {
	url := os.Getenv("KHARCHA_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("KHARCHA_TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	db, err := store.Open(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	u, err := db.UpsertUser(ctx, ids.New(), ids.New()+"@test.dev", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer db.DeleteUser(ctx, u.ID)
	ing := &Ingest{Store: db}
	now := time.Now().UnixMilli()

	smsRef := "sms-ref"
	sms := store.Txn{ID: ids.New(), Amount: 500_00, Type: "debit", Merchant: "Bank transfer", Category: "other", OccurredAt: now,
		Source: "sms", SourceRef: &smsRef, Confidence: 0.8, Status: "confirmed", CreatedAt: now, UpdatedAt: now}
	if ok, err := ing.PushFromApp(ctx, u.ID, sms); err != nil || !ok {
		t.Fatalf("push sms: %v %v", ok, err)
	}

	emailRef, order := "email-ref", "SW-881"
	email := store.Txn{ID: ids.New(), Amount: 500_00, Type: "debit", Merchant: "Swiggy", Category: "food", OccurredAt: now + 3*60_000,
		Source: "email", SourceRef: &emailRef, OrderID: &order, Items: []string{"Paneer Roll"}, Confidence: 0.95, Status: "confirmed",
		CreatedAt: now, UpdatedAt: now}
	if ok, err := ing.AddEmail(ctx, u.ID, email); err != nil || !ok {
		t.Fatalf("add email: %v %v", ok, err)
	}
	// Same receipt again (re-sync) is ignored.
	if ok, _ := ing.AddEmail(ctx, u.ID, email); ok {
		t.Fatal("duplicate email inserted twice")
	}

	gotSMS, _ := db.GetTxn(ctx, db.DB, u.ID, sms.ID)
	gotEmail, _ := db.GetTxn(ctx, db.DB, u.ID, email.ID)
	if gotSMS.Merchant != "Swiggy" || gotSMS.Category != "food" || len(gotSMS.Items) != 1 || gotSMS.MergedInto != nil {
		t.Fatalf("sms not enriched: %+v", gotSMS)
	}
	if gotEmail.MergedInto == nil || *gotEmail.MergedInto != sms.ID {
		t.Fatalf("email not merged: %+v", gotEmail)
	}

	// The app pulls both changes.
	changed, cursor, err := db.ChangedSince(ctx, u.ID, 0, 100)
	if err != nil || len(changed) != 2 || cursor == 0 {
		t.Fatalf("pull: %d rows cursor %d err %v", len(changed), cursor, err)
	}

	// A stale client copy can't undo the merge.
	if ok, _ := ing.PushFromApp(ctx, u.ID, sms); ok {
		t.Fatal("stale client write applied over the server merge")
	}
}
