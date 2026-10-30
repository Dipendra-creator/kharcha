package llm

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	"kharcha/server/internal/store"
)

// fake records what it was sent and answers with a canned extraction.
type fake struct {
	calls int
	user  string
}

func (f *fake) Name() string { return "fake" }

func (f *fake) JSON(_ context.Context, _ Task, _, user string, _ map[string]any) (json.RawMessage, error) {
	f.calls++
	f.user = user
	var in struct {
		Items []struct{ ID string } `json:"items"`
	}
	_ = json.Unmarshal([]byte(user), &in)
	res := []Extracted{}
	for _, it := range in.Items {
		res = append(res, Extracted{ID: it.ID, Type: "debit", Amount: 250, Currency: "INR", Merchant: "Starbucks", Category: "food", Items: []string{}, Confidence: 0.92})
	}
	res = append(res, Extracted{ID: "not-asked", Type: "debit", Amount: 1, Confidence: 0.9})
	return json.Marshal(map[string]any{"results": res})
}

type memCache map[string]store.CachedExtraction

func (m memCache) CachedExtraction(_ context.Context, u, s string) (*store.CachedExtraction, error) {
	if c, ok := m[u+s]; ok {
		return &c, nil
	}
	return nil, nil
}

func (m memCache) CacheExtraction(_ context.Context, u, s string, c store.CachedExtraction) error {
	m[u+s] = c
	return nil
}

func TestExtractRedactsBatchesAndCaches(t *testing.T) {
	f := &fake{}
	svc := &Service{Chain: &Chain{Providers: []Provider{f}, Log: slog.New(slog.NewTextHandler(io.Discard, nil))}, Cache: memCache{}, Timeout: time.Second}
	item := ExtractItem{ID: "a", Kind: "sms", Sender: "HDFCBK", Text: "Rs 250 paid from A/c 123456781234 to tws@ybl, call 9876543210", ReceivedAt: time.Now().UnixMilli()}

	got, err := svc.Extract(context.Background(), "u1", []ExtractItem{item})
	if err != nil || len(got) != 1 || got[0].Merchant != "Starbucks" {
		t.Fatalf("got %+v, %v", got, err)
	}
	if strings.Contains(f.user, "123456781234") || strings.Contains(f.user, "9876543210") {
		t.Fatalf("unredacted text sent to LLM: %s", f.user)
	}

	// Same template, different amount: answered from the cache, amount re-read from the text.
	item.ID, item.Text = "b", "Rs 612.50 paid from A/c 123456781234 to tws@ybl, call 9876543210"
	got, err = svc.Extract(context.Background(), "u1", []ExtractItem{item})
	if err != nil || f.calls != 1 || got[0].Amount != 612.5 {
		t.Fatalf("expected cache hit with amount 612.5, calls=%d got=%+v err=%v", f.calls, got, err)
	}
}

func TestFirstAmountSkipsBalance(t *testing.T) {
	if v := firstAmount("Avl Bal Rs 5,000.00. Rs.1,250.50 debited"); v != 1250.5 {
		t.Fatalf("got %v", v)
	}
}
