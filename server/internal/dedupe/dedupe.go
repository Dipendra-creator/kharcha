// Package dedupe matches a bank SMS and a merchant email receipt that describe
// the same spend, and merges them into one transaction.
package dedupe

import (
	"strings"
	"unicode"

	"kharcha/server/internal/store"
)

// Window is how far apart the SMS and the email may be (PRD: ±15 min).
const Window = 15 * 60 * 1000

// amountTolerance absorbs rounding between a bank alert and a receipt (₹1).
const amountTolerance = 100

var generic = map[string]bool{"banktransfer": true, "moneyreceived": true, "unknown": true, "upi": true, "other": true}

func norm(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func abs(x int64) int64 {
	if x < 0 {
		return -x
	}
	return x
}

func same(a, b *string) (bool, bool) {
	if a == nil || b == nil || *a == "" || *b == "" {
		return false, false
	}
	return true, *a == *b
}

// MerchantsCompatible reports whether two merchant names plausibly name the
// same business ("SWIGGY*ORDER", "Swiggy" or "Bundl Technologies (Swiggy)").
func MerchantsCompatible(a, b string) bool {
	na, nb := norm(a), norm(b)
	if na == "" || nb == "" {
		return false
	}
	if generic[na] || generic[nb] {
		return true
	}
	if strings.Contains(na, nb) || strings.Contains(nb, na) {
		return true
	}
	// Shared leading word of 4+ letters ("zomato ltd" vs "zomato order").
	fa, fb := strings.Fields(strings.ToLower(a)), strings.Fields(strings.ToLower(b))
	return len(fa) > 0 && len(fb) > 0 && len(fa[0]) >= 4 && norm(fa[0]) == norm(fb[0])
}

// IsDuplicate reports whether `sms` and `email` are the same spend: same
// direction, amount within ₹1, within ±15 min, and a matching UPI ref / order id
// (decisive when both have one) or compatible merchants.
func IsDuplicate(sms, email store.Txn) bool {
	if sms.Type != email.Type || sms.Deleted || email.Deleted {
		return false
	}
	if abs(sms.Amount-email.Amount) > amountTolerance || abs(sms.OccurredAt-email.OccurredAt) > Window {
		return false
	}
	if both, eq := same(sms.UpiRef, email.UpiRef); both {
		return eq
	}
	if both, eq := same(sms.OrderID, email.OrderID); both {
		return eq
	}
	return MerchantsCompatible(sms.Merchant, email.Merchant)
}

// Best picks the closest-in-time duplicate among candidates, or -1.
func Best(target store.Txn, candidates []store.Txn, isSMS bool) int {
	best, bestGap := -1, int64(Window+1)
	for i, c := range candidates {
		ok := IsDuplicate(c, target)
		if isSMS {
			ok = IsDuplicate(target, c)
		}
		if gap := abs(c.OccurredAt - target.OccurredAt); ok && gap < bestGap {
			best, bestGap = i, gap
		}
	}
	return best
}

// Merge keeps the SMS (the bank's record of amount and time) and enriches it
// with what only the receipt knows: the real merchant name, items, order id.
// The email row is marked as merged into the SMS row.
func Merge(sms, email store.Txn, group string, now int64) (store.Txn, store.Txn) {
	if generic[norm(sms.Merchant)] || len(email.Merchant) > 0 && !strings.EqualFold(sms.Merchant, email.Merchant) && MerchantsCompatible(sms.Merchant, email.Merchant) {
		sms.Merchant = email.Merchant
	}
	if sms.Category == "other" || sms.Category == "transfers" {
		sms.Category = email.Category
	}
	if len(email.Items) > 0 {
		sms.Items = email.Items
	}
	if sms.OrderID == nil {
		sms.OrderID = email.OrderID
	}
	if email.Confidence > sms.Confidence {
		sms.Confidence = email.Confidence
	}
	if sms.Status == "review" && sms.Confidence >= 0.7 {
		sms.Status = "confirmed"
	}
	sms.DedupeGroup, email.DedupeGroup = &group, &group
	id := sms.ID
	email.MergedInto = &id
	sms.UpdatedAt, email.UpdatedAt = now, now
	return sms, email
}
