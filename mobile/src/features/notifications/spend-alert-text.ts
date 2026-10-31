import { formatINR } from '@/lib/money';

/** At or above this share of today's budget, "left today" becomes a warning. */
const WARN_AT = 0.85;

/**
 * The notification for spends a background sync just found, e.g.
 * "₹420 at Swiggy" / "₹1,580 left today". Null when there is nothing new.
 */
export function spendAlertText(
  spends: { merchant: string; amount: number }[],
  today: { remaining: number; ratio: number },
): { title: string; body: string } | null {
  if (!spends.length) return null;
  const total = spends.reduce((s, t) => s + t.amount, 0);
  const title =
    spends.length === 1
      ? `${formatINR(total, { decimals: 0 })} at ${spends[0].merchant}`
      : `${spends.length} new spends · ${formatINR(total, { decimals: 0 })}`;
  const left = formatINR(Math.abs(today.remaining), { decimals: 0 });
  const body =
    today.remaining < 0
      ? `${left} over today's budget.`
      : today.ratio >= WARN_AT
        ? `Careful: only ${left} left today.`
        : `${left} left today.`;
  return { title, body };
}
