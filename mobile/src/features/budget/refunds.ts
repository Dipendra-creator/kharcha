import { dayKey, type DayKey } from '@/lib/dates';
import { countsAsSpend, type Txn } from '@/lib/types';

type MoneyTxn = Pick<Txn, 'amount' | 'type' | 'status' | 'excluded' | 'deleted' | 'mergedInto' | 'merchant' | 'occurredAt'>;

const DAY = 86_400_000;
/** How long after a purchase its refund can arrive (returns, cancellations). */
export const REFUND_WINDOW = 60 * DAY;
/** A failed or reversed payment comes back within days, for the exact amount. */
const REVERSAL_WINDOW = 7 * DAY;
/** Paise of slack when matching a reversal to its payment. */
const REVERSAL_SLACK = 1_00;

const isLive = (t: MoneyTxn) => t.status !== 'ignored' && !t.excluded && !t.deleted && !t.mergedInto;
const merchantKey = (m: string) => m.trim().toLowerCase();

/**
 * Takes money that came back off the spends it returns.
 *
 * - A `refund` comes off the latest earlier payment to the same merchant that
 *   still covers it (partial refunds leave the rest of the payment counted).
 * - A `credit` only counts as money back when it returns the exact amount of a
 *   payment to the same merchant within a week: a failed recharge reversed, or
 *   a friend paying you back. Other credits (salary, gifts) stay income.
 *
 * Returns the spends at their net amounts, fully refunded ones dropped, and the
 * refunds that matched no payment (bought before tracking, or merchant renamed).
 */
export function netRefunds<T extends MoneyTxn>(txns: T[]): { spends: T[]; unmatched: T[] } {
  const debits = txns.filter(countsAsSpend).sort((a, b) => a.occurredAt - b.occurredAt);
  const left = new Map<T, number>(debits.map((d) => [d, d.amount]));
  const byMerchant = new Map<string, T[]>();
  for (const d of debits) byMerchant.set(merchantKey(d.merchant), [...(byMerchant.get(merchantKey(d.merchant)) ?? []), d]);

  const back = txns
    .filter((t) => isLive(t) && (t.type === 'refund' || t.type === 'credit'))
    .sort((a, b) => a.occurredAt - b.occurredAt);
  const unmatched: T[] = [];
  for (const r of back) {
    const reversal = r.type === 'credit';
    const window = reversal ? REVERSAL_WINDOW : REFUND_WINDOW;
    const candidates = byMerchant.get(merchantKey(r.merchant)) ?? [];
    let match: T | undefined;
    for (let i = candidates.length - 1; i >= 0 && !match; i--) {
      const d = candidates[i];
      const gap = r.occurredAt - d.occurredAt;
      if (gap < 0 || gap > window) continue;
      const remaining = left.get(d)!;
      const fits = reversal ? remaining === d.amount && Math.abs(remaining - r.amount) <= REVERSAL_SLACK : remaining >= r.amount;
      if (fits) match = d;
    }
    if (match) left.set(match, Math.max(0, left.get(match)! - r.amount));
    else if (r.type === 'refund') unmatched.push(r);
  }

  const spends = debits
    .filter((d) => left.get(d)! > 0)
    .map((d) => (left.get(d) === d.amount ? d : { ...d, amount: left.get(d)! }));
  return { spends, unmatched };
}

/**
 * Net spend per local day. Refunds lower the day of the payment they return;
 * a refund with no payment to match lowers the day it arrived, never below zero.
 */
export function spendByDay(txns: MoneyTxn[]): Record<DayKey, number> {
  const { spends, unmatched } = netRefunds(txns);
  const out: Record<DayKey, number> = {};
  for (const t of spends) {
    const k = dayKey(t.occurredAt);
    out[k] = (out[k] ?? 0) + t.amount;
  }
  for (const r of unmatched) {
    const k = dayKey(r.occurredAt);
    out[k] = Math.max(0, (out[k] ?? 0) - r.amount);
  }
  return out;
}
