import type { Category } from '@/theme/tokens';

type MerchantInfo = {
  name: string;
  category: Category;
  /** Food delivery or quick-commerce — counted in the nightly "orders" stat. */
  quick?: boolean;
  subscription?: boolean;
  aliases: string[];
};

/** Well-known Indian merchants with the spellings banks and UPI handles use for them. */
export const KNOWN_MERCHANTS: MerchantInfo[] = [
  { name: 'Swiggy', category: 'food', quick: true, aliases: ['swiggy', 'bundl technologies', 'swiggy instamart'] },
  { name: 'Instamart', category: 'groceries', quick: true, aliases: ['instamart'] },
  { name: 'Zomato', category: 'food', quick: true, aliases: ['zomato', 'zomato ltd', 'eternal ltd'] },
  { name: 'Blinkit', category: 'groceries', quick: true, aliases: ['blinkit', 'grofers', 'blink commerce'] },
  { name: 'Zepto', category: 'groceries', quick: true, aliases: ['zepto', 'kiranakart', 'zeptonow'] },
  { name: 'BigBasket', category: 'groceries', quick: true, aliases: ['bigbasket', 'bb now', 'innovative retail'] },
  { name: 'Flipkart Minutes', category: 'groceries', quick: true, aliases: ['flipkart minutes'] },
  { name: 'Amazon', category: 'shopping', aliases: ['amazon', 'amzn', 'amazon pay', 'amazon seller'] },
  { name: 'Flipkart', category: 'shopping', aliases: ['flipkart', 'fkrt'] },
  { name: 'Myntra', category: 'shopping', aliases: ['myntra'] },
  { name: 'Ajio', category: 'shopping', aliases: ['ajio', 'reliance retail'] },
  { name: 'Nykaa', category: 'shopping', aliases: ['nykaa', 'fsn e-commerce'] },
  { name: 'Uber', category: 'travel', aliases: ['uber', 'uber india'] },
  { name: 'Ola', category: 'travel', aliases: ['ola', 'ani technologies', 'olacabs'] },
  { name: 'Rapido', category: 'travel', aliases: ['rapido', 'roppen'] },
  { name: 'IRCTC', category: 'travel', aliases: ['irctc'] },
  { name: 'MakeMyTrip', category: 'travel', aliases: ['makemytrip', 'mmt'] },
  { name: 'IndiGo', category: 'travel', aliases: ['indigo', 'interglobe'] },
  { name: 'Metro', category: 'travel', aliases: ['dmrc', 'metro rail', 'bmrcl'] },
  { name: 'Netflix', category: 'subscriptions', subscription: true, aliases: ['netflix'] },
  { name: 'Spotify', category: 'subscriptions', subscription: true, aliases: ['spotify'] },
  { name: 'JioHotstar', category: 'subscriptions', subscription: true, aliases: ['jiohotstar', 'hotstar', 'disney+ hotstar', 'novi digital'] },
  { name: 'YouTube Premium', category: 'subscriptions', subscription: true, aliases: ['youtube', 'google youtube'] },
  { name: 'Amazon Prime', category: 'subscriptions', subscription: true, aliases: ['prime video', 'amazon prime'] },
  { name: 'Apple', category: 'subscriptions', subscription: true, aliases: ['apple.com/bill', 'apple services', 'itunes'] },
  { name: 'Google One', category: 'subscriptions', subscription: true, aliases: ['google one', 'google storage'] },
  { name: 'Claude', category: 'subscriptions', subscription: true, aliases: ['anthropic', 'claude.ai'] },
  { name: 'ChatGPT', category: 'subscriptions', subscription: true, aliases: ['openai', 'chatgpt'] },
  { name: 'Airtel', category: 'bills', aliases: ['airtel', 'bharti airtel'] },
  { name: 'Jio', category: 'bills', aliases: ['jio', 'reliance jio'] },
  { name: 'Vi', category: 'bills', aliases: ['vodafone idea', 'vi postpaid'] },
  { name: 'BESCOM', category: 'bills', aliases: ['bescom'] },
  { name: 'Tata Power', category: 'bills', aliases: ['tata power'] },
  { name: 'Starbucks', category: 'food', aliases: ['starbucks', 'tata starbucks'] },
  { name: 'Third Wave Coffee', category: 'food', aliases: ['third wave coffee', 'thirdwave', 'twc'] },
  { name: 'Chai Point', category: 'food', aliases: ['chai point', 'chaipoint'] },
  { name: 'Blue Tokai', category: 'food', aliases: ['blue tokai'] },
  { name: "McDonald's", category: 'food', aliases: ['mcdonalds', "mcdonald's", 'hardcastle'] },
  { name: 'Domino’s', category: 'food', aliases: ['dominos', "domino's", 'jubilant foodworks'] },
  { name: 'PharmEasy', category: 'health', aliases: ['pharmeasy'] },
  { name: 'Apollo Pharmacy', category: 'health', aliases: ['apollo pharmacy', 'apollo 247'] },
  { name: 'Tata 1mg', category: 'health', aliases: ['1mg', 'tata 1mg'] },
  { name: 'BookMyShow', category: 'entertainment', aliases: ['bookmyshow', 'bigtree'] },
  { name: 'PVR INOX', category: 'entertainment', aliases: ['pvr', 'inox'] },
  { name: 'District', category: 'entertainment', aliases: ['district'] },
];

const aliasIndex = KNOWN_MERCHANTS.flatMap((m) =>
  m.aliases.map((a) => ({ alias: a, info: m, re: new RegExp(`(^|[^a-z0-9])${escapeRegExp(a)}($|[^a-z0-9])`) })),
).sort((a, b) => b.alias.length - a.alias.length);

/** Finds a known merchant mentioned anywhere in `text` (longest alias wins). */
export function matchKnownMerchant(text: string): MerchantInfo | null {
  const t = text.toLowerCase();
  return aliasIndex.find((a) => a.re.test(t))?.info ?? null;
}

export function merchantInfo(name: string): MerchantInfo | null {
  const n = name.toLowerCase();
  return KNOWN_MERCHANTS.find((m) => m.name.toLowerCase() === n) ?? matchKnownMerchant(name);
}

export function isQuickOrder(merchant: string, category: Category): boolean {
  const info = merchantInfo(merchant);
  return info ? !!info.quick : category === 'food' || category === 'groceries';
}

/** Turns a raw payee like "SWIGGY*ORDER 8812" or "zepto.payu@hdfcbank" into a display name. */
export function normaliseMerchant(raw: string): string {
  const known = matchKnownMerchant(raw.replace(/[._@*-]/g, ' '));
  if (known) return known.name;
  // VPA local parts use dots/dashes as word breaks: neha.k@okaxis → "neha k".
  const local = raw.includes('@') ? raw.split('@')[0].replace(/[._-]+/g, ' ') : raw;
  const cleaned = local
    .replace(/[*_#]+/g, ' ')
    .replace(/\b(pvt|private|ltd|limited|llp|inc|india|payu|razorpay|paytm|phonepe|cashfree|billdesk)\b\.?/gi, ' ')
    .replace(/\b\d{3,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return raw.trim() || 'Unknown';
  return cleaned
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
