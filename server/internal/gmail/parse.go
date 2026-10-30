package gmail

import (
	"encoding/base64"
	"html"
	"regexp"
	"strings"

	gm "google.golang.org/api/gmail/v1"
)

var (
	dropBlocks = regexp.MustCompile(`(?is)<(style|script|head)[^>]*>.*?</(style|script|head)>`)
	breaks     = regexp.MustCompile(`(?i)<(br|/p|/div|/tr|/li|/h[1-6])[^>]*>`)
	cells      = regexp.MustCompile(`(?i)</t[dh]>`)
	tags       = regexp.MustCompile(`(?s)<[^>]+>`)
	blankLines = regexp.MustCompile(`\n\s*\n+`)
	spaces     = regexp.MustCompile(`[ \t\x{a0}]+`)
)

// HTMLToText flattens a receipt's HTML into readable lines.
func HTMLToText(s string) string {
	s = dropBlocks.ReplaceAllString(s, " ")
	s = breaks.ReplaceAllString(s, "\n")
	s = cells.ReplaceAllString(s, " \t")
	s = tags.ReplaceAllString(s, " ")
	s = html.UnescapeString(s)
	s = spaces.ReplaceAllString(s, " ")
	lines := strings.Split(s, "\n")
	for i, l := range lines {
		lines[i] = strings.TrimSpace(l)
	}
	return strings.TrimSpace(blankLines.ReplaceAllString(strings.Join(lines, "\n"), "\n"))
}

func decode(data string) string {
	b, err := base64.URLEncoding.DecodeString(data)
	if err != nil {
		b, err = base64.RawURLEncoding.DecodeString(data)
		if err != nil {
			return ""
		}
	}
	return string(b)
}

// Body returns the plain-text body, preferring text/plain over HTML.
func Body(p *gm.MessagePart) string {
	var plain, htmlBody string
	var walk func(*gm.MessagePart)
	walk = func(part *gm.MessagePart) {
		if part == nil {
			return
		}
		if part.Body != nil && part.Body.Data != "" {
			switch {
			case strings.HasPrefix(part.MimeType, "text/plain") && plain == "":
				plain = decode(part.Body.Data)
			case strings.HasPrefix(part.MimeType, "text/html") && htmlBody == "":
				htmlBody = decode(part.Body.Data)
			}
		}
		for _, child := range part.Parts {
			walk(child)
		}
	}
	walk(p)
	if strings.TrimSpace(plain) != "" {
		return strings.TrimSpace(plain)
	}
	return HTMLToText(htmlBody)
}

func Header(p *gm.MessagePart, name string) string {
	if p == nil {
		return ""
	}
	for _, h := range p.Headers {
		if strings.EqualFold(h.Name, name) {
			return h.Value
		}
	}
	return ""
}
