// Command kharcha-dev injects a sample email receipt for a user, through the
// same ingest path the Gmail worker uses, so SMS↔email dedupe can be tried
// without Google credentials.
//
//	go run ./cmd/kharcha-dev -email you@example.com -merchant Blinkit -amount 820 -items "Milk,Bread"
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"kharcha/server/internal/ids"
	"kharcha/server/internal/ingest"
	"kharcha/server/internal/store"
)

func main() {
	email := flag.String("email", "", "user email")
	merchant := flag.String("merchant", "Swiggy", "merchant on the receipt")
	category := flag.String("category", "food", "category")
	amount := flag.Float64("amount", 0, "amount in rupees")
	items := flag.String("items", "", "comma-separated items")
	order := flag.String("order", "", "order id")
	minutesAgo := flag.Int("minutes-ago", 2, "when the order happened")
	flag.Parse()
	if *email == "" || *amount <= 0 {
		flag.Usage()
		os.Exit(2)
	}
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		url = "postgres://kharcha:kharcha@localhost:5432/kharcha?sslmode=disable"
	}
	ctx := context.Background()
	db, err := store.Open(ctx, url)
	if err != nil {
		fail(err)
	}
	defer db.Close()

	var userID string
	if err := db.DB.QueryRow(ctx, `SELECT id FROM users WHERE email = lower($1)`, *email).Scan(&userID); err != nil {
		fail(fmt.Errorf("no user %s: %w", *email, err))
	}
	now := time.Now().UnixMilli()
	ref := ids.Hash("dev-receipt", ids.New())
	t := store.Txn{
		ID: ids.New(), Amount: int64(*amount*100 + 0.5), Type: "debit", Merchant: *merchant, Category: *category,
		OccurredAt: now - int64(*minutesAgo)*60_000, Source: "email", SourceRef: &ref, Confidence: 0.95,
		Status: "confirmed", Items: []string{}, CreatedAt: now, UpdatedAt: now,
	}
	if *items != "" {
		t.Items = strings.Split(*items, ",")
	}
	if *order != "" {
		t.OrderID = order
	}
	if _, err := (&ingest.Ingest{Store: db}).AddEmail(ctx, userID, t); err != nil {
		fail(err)
	}
	merged, _ := db.GetTxn(ctx, db.DB, userID, t.ID)
	if merged.MergedInto != nil {
		fmt.Printf("receipt %s merged into SMS transaction %s\n", t.ID, *merged.MergedInto)
	} else {
		fmt.Printf("receipt %s stored as a new transaction (no matching SMS within ±15 min)\n", t.ID)
	}
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
