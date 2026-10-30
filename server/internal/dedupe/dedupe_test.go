package dedupe

import (
	"testing"

	"kharcha/server/internal/store"
)

func ptr(s string) *string { return &s }

const t0 = int64(1_793_000_000_000)

func sms(amount int64, merchant string, at int64) store.Txn {
	return store.Txn{ID: "sms", Type: "debit", Amount: amount, Merchant: merchant, Category: "other", OccurredAt: at, Source: "sms", Confidence: 0.8, Status: "confirmed"}
}

func email(amount int64, merchant string, at int64) store.Txn {
	return store.Txn{ID: "email", Type: "debit", Amount: amount, Merchant: merchant, Category: "food", OccurredAt: at, Source: "email", Confidence: 0.95, Items: []string{"Paneer Biryani", "Coke"}, OrderID: ptr("SW123")}
}

func TestIsDuplicate(t *testing.T) {
	cases := []struct {
		name string
		s, e store.Txn
		want bool
	}{
		{"same spend via bank SMS and Swiggy email", sms(500_00, "Swiggy", t0), email(500_00, "Swiggy", t0+4*60_000), true},
		{"generic SMS merchant matches by amount and time", sms(500_00, "Bank transfer", t0), email(500_00, "Zomato", t0+60_000), true},
		{"payment-gateway descriptor contains the merchant", sms(649_00, "Netflix Com", t0), email(649_00, "Netflix", t0), true},
		{"outside the 15-minute window", sms(500_00, "Swiggy", t0), email(500_00, "Swiggy", t0+16*60_000), false},
		{"different amount", sms(500_00, "Swiggy", t0), email(520_00, "Swiggy", t0), false},
		{"different merchant", sms(500_00, "Zepto", t0), email(500_00, "Swiggy", t0), false},
		{"rupee rounding is tolerated", sms(499_50, "Uber", t0), email(500_00, "Uber", t0+60_000), true},
	}
	for _, c := range cases {
		if got := IsDuplicate(c.s, c.e); got != c.want {
			t.Errorf("%s: got %v want %v", c.name, got, c.want)
		}
	}
}

func TestUPIRefIsDecisive(t *testing.T) {
	s, e := sms(500_00, "Swiggy", t0), email(500_00, "Swiggy", t0)
	s.UpiRef, e.UpiRef = ptr("430312345678"), ptr("430312345999")
	if IsDuplicate(s, e) {
		t.Fatal("different UPI refs must not merge")
	}
	e.UpiRef = ptr("430312345678")
	e.Merchant = "Bundl Technologies"
	if !IsDuplicate(s, e) {
		t.Fatal("matching UPI refs must merge even with different merchant names")
	}
}

func TestMergeEnrichesSMS(t *testing.T) {
	m, e := Merge(sms(500_00, "Bank transfer", t0), email(500_00, "Swiggy", t0), "g1", t0+1)
	if m.Merchant != "Swiggy" || m.Category != "food" || len(m.Items) != 2 || *m.OrderID != "SW123" {
		t.Fatalf("not enriched: %+v", m)
	}
	if e.MergedInto == nil || *e.MergedInto != "sms" || *m.DedupeGroup != "g1" {
		t.Fatalf("email not merged into sms: %+v", e)
	}
	if m.Amount != 500_00 || m.OccurredAt != t0 {
		t.Fatal("bank amount/time must win")
	}
}

func TestBestPicksClosest(t *testing.T) {
	target := email(500_00, "Swiggy", t0)
	cands := []store.Txn{sms(500_00, "Swiggy", t0+10*60_000), sms(500_00, "Swiggy", t0+2*60_000)}
	if got := Best(target, cands, false); got != 1 {
		t.Fatalf("got %d want 1", got)
	}
}
