import { matchKnownMerchant, normaliseMerchant } from '@/lib/merchants';
import { parseAmount } from '@/lib/money';
import type { Category, PaymentMethod, TxnType } from '@/lib/types';

import { FINANCE_SENDERS, isFinanceSender, senderHeader } from './senders';

export type SkipReason = 'otp' | 'promo' | 'failed' | 'request' | 'reminder' | 'balance' | 'no-amount' | 'no-direction';

export type ParsedSms = {
  type: TxnType;
  /** Paise. */
  amount: number;
  /** Payee/payer exactly as the SMS names it (VPA, card descriptor, name). */
  payee: string | null;
  merchant: string;
  category: Category;
  method: PaymentMethod | null;
  accountHint: string | null;
  upiRef: string | null;
  /** Cash withdrawal or a transfer to the user's own account. */
  selfTransfer: boolean;
  confidence: number;
};

export type SmsResult = { kind: 'skip'; reason: SkipReason } | { kind: 'parsed'; parsed: ParsedSms };

// ── pre-filter ────────────────────────────────────────────────────────────────

const OTP = /\b(otp|one[- ]?time[- ]?password|verification code|security code|do not share (?:it|this|the code))\b/i;
const FAILED = /\b(failed|declined|unsuccessful|could not be (?:processed|completed)|insufficient (?:funds|balance)|has been rejected)\b/i;
const REQUEST = /\b(has requested|requested (?:money|rs|inr)|collect request|payment request|is requesting)\b/i;
const REMINDER =
  /\b(is due|due (?:on|by|date)|payment due|statement (?:is )?generated|minimum (?:amount )?due|total (?:amount )?due|will be (?:debited|auto-?debited)|scheduled for|e-?mandate (?:registered|created)|standing instruction)\b/i;
const PROMO =
  /\b(offer|cashback up ?to|pre-?approved|eligible for|apply now|loan (?:of|up ?to)|congratulations|limited period|discount|voucher|exclusive|upgrade your|click here|t&c apply|win\b)/i;
const VERB_DEBIT =
  /\b(debited|debit(?:ed)? by|spent|paid|sent|withdrawn|purchase|deducted|transferred to|dr\.?|txn of|has a debit|(?:has been )?used for)\b/i;
const VERB_CREDIT = /\b(credited|received|deposited|cr\.?|added to)\b/i;
const VERB_REFUND = /\b(refund(?:ed)?|reversal|reversed|cashback (?:of|credited))\b/i;

/** Cheap rules that drop non-transactions before anything is parsed. */
export function prefilter(body: string): SkipReason | null {
  if (OTP.test(body)) return 'otp';
  if (FAILED.test(body)) return 'failed';
  if (REQUEST.test(body)) return 'request';
  if (REMINDER.test(body)) return 'reminder';
  const hasVerb = VERB_DEBIT.test(body) || VERB_CREDIT.test(body) || VERB_REFUND.test(body);
  if (PROMO.test(body) && !/\b(debited|credited|spent|withdrawn)\b/i.test(body)) return 'promo';
  if (!hasVerb) return /\b(bal(?:ance)?|avl)\b/i.test(body) ? 'balance' : 'no-direction';
  return null;
}

// ── amount ────────────────────────────────────────────────────────────────────

const CURRENCY_AMOUNT = /(?:rs\.?|inr|₹)\s*:?\s*([\d,]+(?:\.\d{1,2})?)/gi;
const VERB_AMOUNT = /\b(?:debited|credited|debit|credit)(?:\s+(?:by|for|with|of))?\s*(?:rs\.?|inr|₹)?\s*:?\s*([\d,]*\d(?:\.\d{1,2})?)/gi;
const NOT_TXN_AMOUNT = /(bal(?:ance)?|limit|lmt|avl|available|outstanding|due)[^\d]{0,14}$/i;

export function extractAmount(body: string): number | null {
  const found: { index: number; value: number }[] = [];
  for (const re of [CURRENCY_AMOUNT, VERB_AMOUNT]) {
    re.lastIndex = 0;
    for (let m = re.exec(body); m; m = re.exec(body)) {
      const before = body.slice(Math.max(0, m.index - 24), m.index + (m[0].length - m[1].length));
      if (NOT_TXN_AMOUNT.test(before)) continue;
      const value = parseAmount(m[1]);
      if (value && value > 0) found.push({ index: m.index, value });
    }
  }
  found.sort((a, b) => a.index - b.index);
  return found[0]?.value ?? null;
}

// ── direction ─────────────────────────────────────────────────────────────────

function firstIndex(re: RegExp, s: string): number {
  const m = re.exec(s);
  return m ? m.index : Infinity;
}

/** The first direction verb wins: "debited … and credited to a/c 9876" is a debit. */
export function detectType(body: string): { type: TxnType; clear: boolean } | null {
  const d = firstIndex(VERB_DEBIT, body);
  const c = firstIndex(VERB_CREDIT, body);
  const refund = VERB_REFUND.test(body);
  if (d === Infinity && c === Infinity) return refund ? { type: 'refund', clear: true } : null;
  if (c < d) return { type: refund ? 'refund' : 'credit', clear: d === Infinity || refund };
  return { type: 'debit', clear: c === Infinity };
}

// ── payee ─────────────────────────────────────────────────────────────────────

const VPA = /([a-z0-9][a-z0-9.\-_]{1,48}@[a-z][a-z0-9]{1,20})\b/i;
const NOT_A_PAYEE =
  /^(?:a\/?c|acct|account|ac|your|you|the|card|bank|hdfc|icici|sbi|axis|kotak|paytm|upi|vpa|mob|net ?banking|xx|\*|on|date|self)\b/i;
const STOP = String.raw`(?=\s+(?:on|dated|ref(?:no)?|upi|via|using|avl|from|for|txn|with|in)\b|[.;\n(]|\s*$)`;

const PAYEE_PATTERNS: RegExp[] = [
  // UPI/P2M/430312345685/SWIGGY · UPI/DR/123/METRO · UPI/430312345692/spotify@icici
  /\bUPI\/(?:P2[MA]\/|DR\/|CR\/)?\d{6,}\/([^/\n]+?)(?:\/|\s+on\b|\.\s|\.$|\s*$|\n)/i,
  // NEFT Cr-CITI0000001-ACME TECHNOLOGIES-SALARY · NEFT/CITIN26123456/ACME TECH
  /\b(?:NEFT|IMPS|RTGS)[\s/-](?:Cr|Dr)?-?[A-Z]{4}0[A-Z0-9]{6}-([^-\n.]+)/i,
  /\b(?:NEFT|IMPS|RTGS)\/[A-Z0-9]+\/([^/\n.-]+)/i,
  // ICICI: "Info:REFUND-AMAZON." · "Info: BIL/ONL/000123/AIRTEL"
  /\binfo\s*:\s*(?:refund-|[A-Z]{3}\/[A-Z]{3}\/\d+\/)?([A-Za-z][A-Za-z0-9 &'-]{1,40}?)(?=\.|\s{2}|\n|$)/i,
  // Axis multi-line card alert: the merchant sits on the line after the timestamp.
  /\n\d{2}-\d{2}-\d{2,4},? \d{2}:\d{2}(?::\d{2})?(?: IST)?\n([A-Za-z][^\n]{1,40})\n/,
  // "Paid Rs.85 to Chai Wala from Paytm" · "paid Rs.299.00 to Amazon via Amazon Pay"
  /\bpaid\s+(?:(?:rs\.?|inr|₹)\s*[\d,.]+\s+)?to\s+(.+?)(?=\s+(?:from|via|using|on)\b|[.;\n]|$)/i,
  // ICICI UPI: "debited for Rs 400.00 on 30-Oct-26; ZEPTO credited."
  /;\s*([A-Za-z0-9 &.'-]{2,40}?)\s+credited\b/i,
  // Card: "spent … on 30-Oct-26 on AMAZON PAY IN. Avl Limit"
  /\bon\s+\d{1,2}[-/ ]?[A-Za-z]{3}[-/ ]?\d{2,4}\s+(?:on|at)\s+([A-Za-z][^.\n]+?)(?=\.\s|\.$|\s+avl\b|\n|$)/i,
  // Card: "At MYNTRA DESIGNS On 2026-10-30" · "at UBER INDIA on 30 October"
  new RegExp(String.raw`\b(?:at|@)\s+([A-Za-z0-9][A-Za-z0-9&'.*\- ]{1,40}?)${STOP}`, 'i'),
  // SBI: "trf to STARBUCKS Refno"
  /\btrf to\s+(.+?)(?=\s+(?:ref(?:no)?|on|upi)\b|[.;\n]|$)/i,
  // HDFC (2024+): "To THIRD WAVE COFFEE\nOn 30/10/26"
  /^to\s+(.+)$/im,
  // "towards BESCOM on" (not UPI paths, handled above)
  new RegExp(String.raw`\btowards\s+(?!UPI\/)([A-Za-z0-9][A-Za-z0-9 &'.-]{1,40}?)${STOP}`, 'i'),
  // "to VPA x@y" / "to x@y" / "from x@y"
  /\b(?:to|from|vpa|by|cr\.? to)\s+(?:vpa\s+)?([a-z0-9][a-z0-9.\-_]{1,48}@[a-z][a-z0-9]{1,20})\b/i,
  // Credits: "from RAHUL SHARMA rahul@okicici on" / "by NAME"
  /\bfrom\s+(?!a\/?c|acct|account|your|ac\b)([A-Za-z][A-Za-z .']{1,40}?)(?=\s+[a-z0-9.\-_]+@|\s+(?:on|upi|ref|via)\b|\s*\(|[.;\n]|$)/i,
  // Generic: "sent Rs 250 to NAME"
  new RegExp(String.raw`\bto\s+(?!a\/?c|acct|account|your|vpa\b|report|block|dispute)([A-Za-z][A-Za-z0-9 &'.-]{1,40}?)${STOP}`, 'i'),
];

export function extractPayee(body: string): string | null {
  for (const re of PAYEE_PATTERNS) {
    const m = re.exec(body);
    const raw = m?.[1]?.trim().replace(/\s+/g, ' ').replace(/[.,:;-]+$/, '');
    if (!raw || raw.length < 2 || NOT_A_PAYEE.test(raw) || /^\d+$/.test(raw.replace(/[\s-]/g, ''))) continue;
    // Prefer a payee name over the bare VPA that often follows it.
    return raw;
  }
  const vpa = VPA.exec(body)?.[1];
  return vpa ?? null;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const ACCOUNT = /\b(?:a\/?c|acct|account|ac)\.?\s*(?:no\.?)?\s*[:.]?\s*[x*]*\s*(\d{3,4})\b/i;
const CARD = /\bcard\s*(?:no\.?)?\s*(?:ending\s*(?:with\s*)?|xx|x|\*\*?\s*)?[x*]*\s*(\d{4,5})\b/i;
const UPI_REF = /(?:upi\s*ref(?:\s*no)?|ref(?:erence)?\s*(?:no|#)?|refno|rrn|upi(?:\/(?:p2[ma]|dr|cr))?\/?)[\s:#.\-]*(\d{12})\b/i;

export function extractAccountHint(body: string, sender: string): string | null {
  const bank = FINANCE_SENDERS[senderHeader(sender)] ?? null;
  const card = CARD.exec(body)?.[1];
  const acct = ACCOUNT.exec(body)?.[1];
  const digits = card ?? acct;
  if (!digits) return bank;
  return `${bank ? `${bank} ` : ''}${card ? 'card' : 'a/c'} ••${digits.slice(-4)}`;
}

function detectMethod(body: string, sender: string, hasVpa: boolean): PaymentMethod | null {
  if (/\batm\b/i.test(body)) return 'cash';
  if (hasVpa || /\bupi\b/i.test(body)) return 'upi';
  if (/\b(credit|debit)?\s*card\b/i.test(body)) return 'card';
  if (/\b(wallet|amazon pay balance|paytm balance)\b/i.test(body) || ['MOBIKW', 'FREECH', 'AMZNPY'].includes(senderHeader(sender))) return 'wallet';
  if (/\b(neft|imps|rtgs|net ?banking|mob(?:ile)? ?b(?:an)?k|transfer)\b/i.test(body)) return 'netbanking';
  return null;
}

const BUSINESS_WORDS =
  /\b(pvt|ltd|limited|llp|store|stores|mart|cafe|coffee|chai|foods?|restaurant|kitchen|bakery|enterprises?|traders?|services|technologies|tech|solutions|retail|pharmacy|medical|medicos|chemist|hospital|clinic|petrol|fuel|filling|station|hotel|bar|motors|electronics|fashion|supermarket|kirana|general|india|in)\b/i;

const KEYWORD_CATEGORIES: [RegExp, Category][] = [
  [/\b(cafe|coffee|chai|tea|restaurant|kitchen|bakery|biryani|dhaba|pizza|burger|food|eat|juice|sweets)\b/i, 'food'],
  [/\b(mart|kirana|supermarket|grocer|vegetable|fruits|dairy|milk|provision)\b/i, 'groceries'],
  [/\b(pharmacy|medical|medicos|chemist|hospital|clinic|diagnostic|lab|health|apollo)\b/i, 'health'],
  [/\b(petrol|fuel|filling|hpcl|bpcl|iocl|indian oil|fastag|parking|metro|railway|cab|taxi|auto)\b/i, 'travel'],
  [/\b(electricity|broadband|recharge|postpaid|prepaid|gas|water|bill|dth|fibernet|insurance)\b/i, 'bills'],
  [/\b(movie|cinema|pvr|inox|game|gaming|club|pub)\b/i, 'entertainment'],
  [/\b(fashion|apparel|electronics|store|stores|retail|shop)\b/i, 'shopping'],
];

function looksLikePerson(payee: string, body: string): boolean {
  if (/\bP2A\b/.test(body)) return true;
  if (/@/.test(payee)) return /^[a-z]+(?:\.[a-z]+)?\d{0,4}@ok(?:axis|icici|sbi|hdfcbank)$/i.test(payee) || /^\[?phone/.test(payee);
  const words = payee.split(/\s+/);
  return words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-Za-z.']+$/.test(w)) && !BUSINESS_WORDS.test(payee);
}

function categorise(merchant: string, payee: string | null, body: string, type: TxnType): Category {
  const known = matchKnownMerchant(merchant) ?? (payee ? matchKnownMerchant(payee.replace(/[._@*-]/g, ' ')) : null);
  if (known) return known.category;
  if (/\batm\b/i.test(body)) return 'transfers';
  const text = `${merchant} ${payee ?? ''}`;
  for (const [re, cat] of KEYWORD_CATEGORIES) if (re.test(text)) return cat;
  if (type !== 'debit' || (payee && looksLikePerson(payee, body))) return 'transfers';
  return 'other';
}

// ── main ──────────────────────────────────────────────────────────────────────

/** Parses one SMS with on-device rules. Confidence < 0.7 sends it to the review inbox. */
export function parseSms(body: string, sender: string): SmsResult {
  const skip = prefilter(body);
  if (skip) return { kind: 'skip', reason: skip };
  const amount = extractAmount(body);
  if (!amount) return { kind: 'skip', reason: 'no-amount' };
  const direction = detectType(body);
  if (!direction) return { kind: 'skip', reason: 'no-direction' };

  const atm = /\batm\b/i.test(body) && direction.type === 'debit';
  const payee = atm ? null : extractPayee(body);
  const selfTransfer = atm || /\b(self|own (?:a\/?c|account)|to self)\b/i.test(body);
  const merchant = atm ? 'ATM withdrawal' : payee ? normaliseMerchant(payee) : direction.type === 'debit' ? 'Bank transfer' : 'Money received';
  const hasVpa = VPA.test(body);
  const known = !!matchKnownMerchant(merchant);

  let confidence = 0.35 + 0.25; // amount found
  if (direction.clear) confidence += 0.15;
  if (payee || atm) confidence += 0.15;
  else confidence -= 0.15;
  if (known) confidence += 0.05;
  if (isFinanceSender(sender)) confidence += 0.1;
  const accountHint = extractAccountHint(body, sender);
  if (accountHint && /••/.test(accountHint)) confidence += 0.05;

  return {
    kind: 'parsed',
    parsed: {
      type: direction.type,
      amount,
      payee,
      merchant,
      category: categorise(merchant, payee, body, direction.type),
      method: detectMethod(body, sender, hasVpa),
      accountHint,
      upiRef: UPI_REF.exec(body)?.[1] ?? null,
      selfTransfer,
      confidence: Math.max(0, Math.min(0.98, Number(confidence.toFixed(2)))),
    },
  };
}

/**
 * Marks transfers between the user's own accounts: a debit and a credit of the
 * same amount on different accounts within 10 minutes. Returns the indices.
 */
export function findSelfTransfers(
  items: { type: TxnType; amount: number; accountHint: string | null; occurredAt: number }[],
): Set<number> {
  const out = new Set<number>();
  items.forEach((a, i) => {
    if (a.type !== 'debit') return;
    items.forEach((b, j) => {
      if (b.type !== 'credit' || out.has(j) || b.amount !== a.amount) return;
      if (Math.abs(b.occurredAt - a.occurredAt) > 10 * 60_000) return;
      if (a.accountHint && b.accountHint && a.accountHint === b.accountHint) return;
      out.add(i);
      out.add(j);
    });
  });
  return out;
}
