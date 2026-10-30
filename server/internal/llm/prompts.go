package llm

// Categories and methods mirror the app's types (mobile/src/lib/types.ts).
var categories = []any{"food", "groceries", "shopping", "travel", "subscriptions", "bills", "health", "entertainment", "transfers", "other"}
var methods = []any{"upi", "card", "netbanking", "wallet", "cash", nil}

func nullable(t string) []any { return []any{t, "null"} }

// extractionSchema is the PRD's strict extraction schema, one result per input item.
var extractionSchema = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"results": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"id":             map[string]any{"type": "string"},
					"type":           map[string]any{"type": "string", "enum": []any{"debit", "credit", "refund", "ignore"}},
					"amount":         map[string]any{"type": "number", "description": "Rupees, e.g. 249.5. 0 when type is ignore."},
					"currency":       map[string]any{"type": "string"},
					"merchant":       map[string]any{"type": "string", "description": "Normalised display name, e.g. Blinkit, Swiggy, Rahul Sharma."},
					"category":       map[string]any{"type": "string", "enum": categories},
					"timestamp":      map[string]any{"type": nullable("string"), "description": "ISO-8601 with +05:30 if the text states a time, else null."},
					"account_hint":   map[string]any{"type": nullable("string"), "description": "Last 4 digits or bank name, else null."},
					"payment_method": map[string]any{"type": nullable("string"), "enum": methods},
					"upi_ref":        map[string]any{"type": nullable("string")},
					"order_id":       map[string]any{"type": nullable("string")},
					"items":          map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Ordered items from a receipt, else empty."},
					"confidence":     map[string]any{"type": "number", "description": "0 to 1."},
				},
				"required":             []any{"id", "type", "amount", "currency", "merchant", "category", "timestamp", "account_hint", "payment_method", "upi_ref", "order_id", "items", "confidence"},
				"additionalProperties": false,
			},
		},
	},
	"required":             []any{"results"},
	"additionalProperties": false,
}

const extractionSystem = `You extract money movements from Indian bank SMS alerts and merchant email receipts for a personal budgeting app.

Each input item has an id, kind (sms or email), sender and redacted text. Return exactly one result per item, with the same id.

How to classify:
- debit: money left the user's account (UPI payment, card spend, ATM withdrawal, auto-debit that has happened).
- credit: money arrived (salary, a friend paying back).
- refund: money returned for an earlier purchase, reversal, or cashback credited.
- ignore: anything that is not a completed transaction: OTPs, offers, promos, payment requests, failed or declined transactions, reminders of upcoming dues or EMIs, statements, balance-only messages, delivery updates.

Fields:
- amount is the transaction amount in rupees, never the available balance, credit limit or amount due.
- merchant is a short, human name: "Blinkit" not "blinkit.payu@hdfcbank", "Swiggy" for "Bundl Technologies", a person's name in Title Case for P2P transfers. Use "Bank transfer" when no payee is named.
- category: food (restaurants, cafés, food delivery), groceries (quick commerce, supermarkets), shopping, travel (cabs, metro, fuel, flights, trains), subscriptions (streaming, software, memberships), bills (electricity, phone, broadband, rent payments), health, entertainment, transfers (to people or own accounts), other.
- For email receipts, list ordered items briefly in items and use the order id if shown.
- confidence: how sure you are about type, amount and merchant together. Below 0.7 means a human should check.
- Text is redacted ([phone], [email], XX1234); never guess the hidden values.`

var roastSchema = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"verdict": map[string]any{"type": "string", "description": "One line, at most 18 words."},
	},
	"required":             []any{"verdict"},
	"additionalProperties": false,
}

const roastSystem = `You write the one-line nightly verdict for Kharcha, an Indian budgeting app, in Hinglish (Hindi in Latin script mixed with English).

The line reacts to how today's spending compared with today's budget. It is playful and honest, like a witty friend. It may tease the spending itself — the Zepto orders, the late-night Swiggy, the impulse Myntra cart — but never insults the person, their body, job, family, religion, caste, gender or anything other than the spending. No profanity, no emoji, no hashtags.

Tone by intensity: mild = gentle and encouraging; savage = sharp, punchy roast of the spending.
Tone by spend ratio: under 50% celebrate; 50–85% approve; 85–100% "close call"; 100–130% roast the overspend; over 130% dramatic disaster.

Examples of the voice:
- "Kya baat hai, aaj toh Warren Buffett mode on."
- "Borderline tha bro, ek aur Zepto order aur kahani khatam."
- "Ye budget nahi tha, bonfire tha."

Return a fresh line, not one of the examples, at most 18 words.`
