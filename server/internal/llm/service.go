package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"kharcha/server/internal/redact"
	"kharcha/server/internal/store"
)

// ExtractItem is one SMS/email the app (or the Gmail worker) couldn't parse confidently.
type ExtractItem struct {
	ID         string `json:"id"`
	Kind       string `json:"kind"`
	Sender     string `json:"sender"`
	Text       string `json:"text"`
	ReceivedAt int64  `json:"receivedAt"`
}

// Extracted is the PRD's extraction schema (amount in rupees).
type Extracted struct {
	ID            string   `json:"id"`
	Type          string   `json:"type"`
	Amount        float64  `json:"amount"`
	Currency      string   `json:"currency"`
	Merchant      string   `json:"merchant"`
	Category      string   `json:"category"`
	Timestamp     *string  `json:"timestamp"`
	AccountHint   *string  `json:"account_hint"`
	PaymentMethod *string  `json:"payment_method"`
	UpiRef        *string  `json:"upi_ref"`
	OrderID       *string  `json:"order_id"`
	Items         []string `json:"items"`
	Confidence    float64  `json:"confidence"`
}

// Cache remembers merchant/category/type per message template (see store.CachedExtraction).
type Cache interface {
	CachedExtraction(ctx context.Context, userID, signature string) (*store.CachedExtraction, error)
	CacheExtraction(ctx context.Context, userID, signature string, c store.CachedExtraction) error
}

type Service struct {
	Chain   *Chain
	Cache   Cache
	Timeout time.Duration
}

const batchSize = 12

// maxEmailChars bounds one email body. Receipts put the order, items and total
// at the top; past this it is footer boilerplate (unsubscribe, legal, ads).
const maxEmailChars = 12_000

// Extract redacts each item, answers repeat templates from the cache, and sends
// the rest to the LLM in batches. Items the LLM can't answer are left out.
func (s *Service) Extract(ctx context.Context, userID string, items []ExtractItem) ([]Extracted, error) {
	out := make([]Extracted, 0, len(items))
	var pending []ExtractItem
	signatures := map[string]string{}
	for _, it := range items {
		it.Text = redact.Text(it.Text)
		if it.Kind == "email" && len(it.Text) > maxEmailChars {
			it.Text = it.Text[:maxEmailChars]
		}
		sig := fmt.Sprintf("%s|%s|%s", it.Kind, strings.ToLower(it.Sender), redact.Signature(it.Text))
		signatures[it.ID] = sig
		if s.Cache != nil && it.Kind == "sms" {
			if c, err := s.Cache.CachedExtraction(ctx, userID, sig); err == nil && c != nil {
				if amount := firstAmount(it.Text); amount > 0 || c.Type == "ignore" {
					out = append(out, Extracted{ID: it.ID, Type: c.Type, Amount: amount, Currency: "INR", Merchant: c.Merchant,
						Category: c.Category, PaymentMethod: c.Method, Items: []string{}, Confidence: c.Confidence})
					continue
				}
			}
		}
		pending = append(pending, it)
	}

	var errs []error
	for start := 0; start < len(pending); start += batchSize {
		batch := pending[start:min(start+batchSize, len(pending))]
		results, err := s.extractBatch(ctx, batch)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		for _, r := range results {
			out = append(out, r)
			if s.Cache != nil && r.Confidence >= 0.8 {
				_ = s.Cache.CacheExtraction(ctx, userID, signatures[r.ID], store.CachedExtraction{
					Type: r.Type, Merchant: r.Merchant, Category: r.Category, Method: r.PaymentMethod, Confidence: r.Confidence,
				})
			}
		}
	}
	if len(out) == 0 && len(errs) > 0 {
		return nil, fmt.Errorf("extraction failed: %w", errors.Join(errs...))
	}
	return out, nil
}

func (s *Service) extractBatch(ctx context.Context, batch []ExtractItem) ([]Extracted, error) {
	type wireItem struct {
		ID         string `json:"id"`
		Kind       string `json:"kind"`
		Sender     string `json:"sender"`
		ReceivedAt string `json:"received_at"`
		Text       string `json:"text"`
	}
	wire := make([]wireItem, len(batch))
	ids := map[string]bool{}
	for i, it := range batch {
		ids[it.ID] = true
		wire[i] = wireItem{ID: it.ID, Kind: it.Kind, Sender: it.Sender, Text: it.Text,
			ReceivedAt: time.UnixMilli(it.ReceivedAt).In(ist).Format(time.RFC3339)}
	}
	payload, _ := json.MarshalIndent(map[string]any{"items": wire}, "", " ")
	ctx, cancel := context.WithTimeout(ctx, s.Timeout)
	defer cancel()
	raw, err := s.Chain.JSON(ctx, TaskExtract, extractionSystem, string(payload), extractionSchema)
	if err != nil {
		return nil, err
	}
	var parsed struct {
		Results []Extracted `json:"results"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("decode extraction: %w", err)
	}
	valid := parsed.Results[:0]
	for _, r := range parsed.Results {
		if !ids[r.ID] || r.Confidence < 0 || r.Confidence > 1 || (r.Type != "ignore" && r.Amount <= 0) {
			continue
		}
		if r.Items == nil {
			r.Items = []string{}
		}
		valid = append(valid, r)
	}
	return valid, nil
}

var ist = time.FixedZone("IST", 5*3600+1800)

var (
	amountRe  = regexp.MustCompile(`(?i)(?:rs\.?|inr|₹)\s*:?\s*([\d,]+(?:\.\d{1,2})?)`)
	balanceRe = regexp.MustCompile(`(?i)(bal(?:ance)?|limit|lmt|avl|available|outstanding|due)[^\d]{0,14}$`)
)

// firstAmount returns the first rupee amount that isn't a balance or limit.
func firstAmount(text string) float64 {
	for _, m := range amountRe.FindAllStringSubmatchIndex(text, -1) {
		if balanceRe.MatchString(text[max(0, m[0]-24):m[2]]) {
			continue
		}
		v, err := strconv.ParseFloat(strings.ReplaceAll(text[m[2]:m[3]], ",", ""), 64)
		if err == nil && v > 0 {
			return v
		}
	}
	return 0
}

// RoastRequest summarises the day for the verdict. Amounts are paise.
type RoastRequest struct {
	Date        string `json:"date"`
	Intensity   string `json:"intensity"`
	Budget      int64  `json:"budget"`
	Spent       int64  `json:"spent"`
	TopCategory string `json:"topCategory"`
	Biggest     *struct {
		Merchant string `json:"merchant"`
		Amount   int64  `json:"amount"`
	} `json:"biggest"`
	QuickOrders int      `json:"quickOrders"`
	Merchants   []string `json:"merchants"`
}

func (s *Service) Roast(ctx context.Context, r RoastRequest) (string, error) {
	if r.Intensity != "mild" && r.Intensity != "savage" {
		r.Intensity = "savage"
	}
	ratio := 0.0
	if r.Budget > 0 {
		ratio = float64(r.Spent) / float64(r.Budget)
	}
	var b strings.Builder
	fmt.Fprintf(&b, "Intensity: %s\nToday's budget: ₹%d\nSpent: ₹%d (%.0f%% of budget)\n", r.Intensity, r.Budget/100, r.Spent/100, ratio*100)
	if r.TopCategory != "" {
		fmt.Fprintf(&b, "Top category: %s\n", r.TopCategory)
	}
	if r.Biggest != nil {
		fmt.Fprintf(&b, "Biggest spend: ₹%d at %s\n", r.Biggest.Amount/100, r.Biggest.Merchant)
	}
	fmt.Fprintf(&b, "Food delivery / quick-commerce orders: %d\n", r.QuickOrders)
	if len(r.Merchants) > 0 {
		fmt.Fprintf(&b, "Merchants: %s\n", strings.Join(r.Merchants[:min(len(r.Merchants), 8)], ", "))
	}
	ctx, cancel := context.WithTimeout(ctx, s.Timeout)
	defer cancel()
	raw, err := s.Chain.JSON(ctx, TaskRoast, roastSystem, b.String(), roastSchema)
	if err != nil {
		return "", err
	}
	var out struct {
		Verdict string `json:"verdict"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", err
	}
	v := strings.Trim(strings.TrimSpace(out.Verdict), `"“”`)
	if v == "" || len([]rune(v)) > 160 {
		return "", fmt.Errorf("unusable verdict")
	}
	return v, nil
}
