// Package redact strips personal identifiers from text before it reaches an
// LLM: OTPs, phone numbers, emails, and account/card numbers (last 4 kept).
// It mirrors mobile/src/features/sms/redact.ts; the server applies it to email
// bodies, and again to SMS text as defence in depth.
package redact

import (
	"regexp"
	"strings"
)

var (
	otp      = regexp.MustCompile(`(?i)\b(otp|one[- ]time password|verification code|passcode)\b([^0-9]{0,24})\d{4,8}`)
	account  = regexp.MustCompile(`(?i)\b((?:a/?c|acct|account|card)(?:\s*(?:no\.?|number|ending(?:\s*with)?))?\s*[:.]?\s*)[x*\d\s-]{4,}(\d{4})\b`)
	vpaPhone = regexp.MustCompile(`(?i)\b(?:\+?91[- ]?)?[6-9]\d{9}(@[a-z]+)`)
	phone    = regexp.MustCompile(`(?:\+91[- ]?|\b0)?\b[6-9]\d{9}\b`)
	email    = regexp.MustCompile(`(?i)\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b`)
	pan      = regexp.MustCompile(`\b[A-Z]{5}\d{4}[A-Z]\b`)
	space    = regexp.MustCompile(`[ \t]+`)
)

func Text(s string) string {
	s = otp.ReplaceAllString(s, "$1$2[otp]")
	s = account.ReplaceAllString(s, "${1}XX$2")
	s = vpaPhone.ReplaceAllString(s, "[phone]$1")
	// 12-digit transaction refs don't match \b[6-9]\d{9}\b, so they survive.
	s = phone.ReplaceAllString(s, "[phone]")
	s = email.ReplaceAllString(s, "[email]")
	s = pan.ReplaceAllString(s, "[pan]")
	return strings.TrimSpace(space.ReplaceAllString(s, " "))
}

var (
	amounts = regexp.MustCompile(`(?i)(rs\.?|inr|₹)\s*:?\s*[\d,]+(?:\.\d+)?`)
	digits  = regexp.MustCompile(`\d+`)
)

// Signature masks amounts and every run of digits, so messages from the same
// template ("Rs 250" vs "Rs 612.50", "1 Oct" vs "30 Oct") share a key.
func Signature(s string) string {
	s = amounts.ReplaceAllString(strings.ToLower(Text(s)), "<amt>")
	return digits.ReplaceAllString(s, "#")
}
