/** Money is stored and computed as integer paise; these helpers convert at the edges. */

export const toPaise = (rupees: number): number => Math.round(rupees * 100);
export const toRupees = (paise: number): number => paise / 100;

/** Groups an integer string the Indian way: 12345678 → 1,23,45,678. */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) groups.unshift(rest);
  return `${groups.join(',')},${last3}`;
}

export type FormatOptions = {
  /** 'auto' shows paise only when non-zero. Default 'auto'. */
  decimals?: 'auto' | 0 | 2;
  /** Prefix '+' for positive values. */
  signed?: boolean;
  symbol?: boolean;
  /** ₹1.2K / ₹3.4L / ₹1.1Cr. */
  compact?: boolean;
};

const MINUS = '−';

export function formatINR(paise: number, opts: FormatOptions = {}): string {
  const { decimals = 'auto', signed = false, symbol = true, compact = false } = opts;
  const negative = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const sign = negative ? MINUS : signed && abs > 0 ? '+' : '';
  const sym = symbol ? '₹' : '';

  if (compact && abs >= 100_000) {
    const rupees = abs / 100;
    const [div, suffix] =
      rupees >= 1_00_00_000 ? [1_00_00_000, 'Cr'] : rupees >= 1_00_000 ? [1_00_000, 'L'] : [1_000, 'K'];
    const value = rupees / div;
    const text = value >= 100 ? Math.round(value).toString() : trimZeros(value.toFixed(value >= 10 ? 1 : 2));
    return `${sign}${sym}${text}${suffix}`;
  }

  const rupeePart = Math.floor(abs / 100);
  const paisePart = abs % 100;
  const showPaise = decimals === 2 || (decimals === 'auto' && paisePart !== 0);
  const roundedRupees = !showPaise && decimals !== 'auto' ? Math.round(abs / 100) : rupeePart;
  const body = groupIndian(roundedRupees.toString());
  return `${sign}${sym}${body}${showPaise ? `.${paisePart.toString().padStart(2, '0')}` : ''}`;
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** Screen-reader friendly amount, e.g. "1,240 rupees 50 paise". */
export function spokenINR(paise: number): string {
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const p = abs % 100;
  const prefix = paise < 0 ? 'minus ' : '';
  const r = `${groupIndian(rupees.toString())} ${rupees === 1 ? 'rupee' : 'rupees'}`;
  return `${prefix}${r}${p ? ` ${p} paise` : ''}`;
}

/** Parses user/SMS text like "1,23,456.78" or "Rs.250" into paise; null if not a number. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/(?:rs\.?|inr|₹)/gi, '').replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return toPaise(Number(cleaned));
}
