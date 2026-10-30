package gmail

import (
	"fmt"
	"net/mail"
	"strings"
	"time"
)

// Senders is the only mail Kharcha reads. Mirrors mobile/src/features/email/senders.ts,
// which shows this list on the privacy screen.
var Senders = []string{
	"swiggy.in", "zomato.com", "blinkit.com", "zeptonow.com", "zepto.co.in",
	"amazon.in", "flipkart.com", "myntra.com",
	"uber.com", "olacabs.com", "rapido.bike",
	"netflix.com", "spotify.com", "hotstar.com", "jiohotstar.com",
	"hdfcbank.net", "icicibank.com", "sbi.co.in", "axisbank.com", "kotak.com", "sbicard.com", "idfcfirstbank.com",
}

// Subject words of transactional mail; promos rarely use them and are filtered
// out by category anyway.
const subjects = "order OR receipt OR invoice OR payment OR paid OR trip OR ride OR booking OR subscription OR renewal OR membership OR transaction OR debited OR spent OR refund"

// Query is the Gmail search for receipts since `after`.
func Query(after time.Time) string {
	from := make([]string, len(Senders))
	copy(from, Senders)
	return fmt.Sprintf("from:(%s) subject:(%s) -category:promotions -category:social after:%d",
		strings.Join(from, " OR "), subjects, after.Unix())
}

// AllowedSender reports whether a From header is on the sender list.
func AllowedSender(from string) (string, bool) {
	addr, err := mail.ParseAddress(from)
	if err != nil {
		return "", false
	}
	at := strings.LastIndex(addr.Address, "@")
	if at < 0 {
		return "", false
	}
	domain := strings.ToLower(addr.Address[at+1:])
	for _, s := range Senders {
		if domain == s || strings.HasSuffix(domain, "."+s) {
			return s, true
		}
	}
	return "", false
}
