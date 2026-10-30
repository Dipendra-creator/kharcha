/** Senders the Gmail sync reads (mirrors server/internal/gmail/query.go). Shown on the privacy screen. */
export const EMAIL_SENDERS: { name: string; domains: string[] }[] = [
  { name: 'Swiggy', domains: ['swiggy.in'] },
  { name: 'Zomato', domains: ['zomato.com'] },
  { name: 'Blinkit', domains: ['blinkit.com'] },
  { name: 'Zepto', domains: ['zeptonow.com', 'zepto.co.in'] },
  { name: 'Instamart', domains: ['swiggy.in'] },
  { name: 'Amazon', domains: ['amazon.in'] },
  { name: 'Flipkart', domains: ['flipkart.com'] },
  { name: 'Myntra', domains: ['myntra.com'] },
  { name: 'Uber', domains: ['uber.com'] },
  { name: 'Ola', domains: ['olacabs.com'] },
  { name: 'Rapido', domains: ['rapido.bike'] },
  { name: 'Netflix', domains: ['netflix.com'] },
  { name: 'Spotify', domains: ['spotify.com'] },
  { name: 'JioHotstar', domains: ['hotstar.com', 'jiohotstar.com'] },
  { name: 'Bank alerts & e-statements', domains: ['hdfcbank.net', 'icicibank.com', 'sbi.co.in', 'axisbank.com', 'kotak.com', 'sbicard.com', 'idfcfirstbank.com'] },
];
