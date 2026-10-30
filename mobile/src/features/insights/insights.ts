import { countsAsSpend, type Category, type Txn } from '@/lib/types';

type SpendTxn = Pick<
  Txn,
  'amount' | 'type' | 'status' | 'excluded' | 'deleted' | 'mergedInto' | 'merchant' | 'category' | 'occurredAt'
>;

export type CategoryShare = { category: Category; amount: number; share: number };
export type MerchantTotal = { merchant: string; category: Category; amount: number; count: number };
export type ImpulseWindow = { startHour: number; endHour: number; share: number; count: number; lateNight: boolean };

const spends = <T extends SpendTxn>(txns: T[]) => txns.filter(countsAsSpend);

export function totalSpent(txns: SpendTxn[]): number {
  return spends(txns).reduce((s, t) => s + t.amount, 0);
}

export function categoryBreakdown(txns: SpendTxn[]): CategoryShare[] {
  const sums = new Map<Category, number>();
  for (const t of spends(txns)) sums.set(t.category, (sums.get(t.category) ?? 0) + t.amount);
  const total = [...sums.values()].reduce((a, b) => a + b, 0);
  return [...sums.entries()]
    .map(([category, amount]) => ({ category, amount, share: total ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export function topMerchants(txns: SpendTxn[], limit = 5): MerchantTotal[] {
  const byMerchant = new Map<string, MerchantTotal>();
  for (const t of spends(txns)) {
    const cur = byMerchant.get(t.merchant) ?? { merchant: t.merchant, category: t.category, amount: 0, count: 0 };
    cur.amount += t.amount;
    cur.count += 1;
    byMerchant.set(t.merchant, cur);
  }
  return [...byMerchant.values()].sort((a, b) => b.amount - a.amount).slice(0, limit);
}

/** Spend per hour of day (0–23). */
export function hourlySpend(txns: SpendTxn[]): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const t of spends(txns)) hours[new Date(t.occurredAt).getHours()] += t.amount;
  return hours;
}

const isLateHour = (h: number) => h >= 22 || h < 4;

/**
 * The 3-hour window (wrapping past midnight) holding the most spend. Reported
 * as an impulse window when it holds ≥ 30% of spend across ≥ 3 transactions.
 */
export function impulseWindow(txns: SpendTxn[]): ImpulseWindow | null {
  const list = spends(txns);
  const total = list.reduce((s, t) => s + t.amount, 0);
  if (!total || list.length < 3) return null;
  const amount = new Array<number>(24).fill(0);
  const count = new Array<number>(24).fill(0);
  for (const t of list) {
    const h = new Date(t.occurredAt).getHours();
    amount[h] += t.amount;
    count[h] += 1;
  }
  let best = { start: 0, amount: 0, count: 0 };
  for (let start = 0; start < 24; start++) {
    let a = 0;
    let c = 0;
    for (let k = 0; k < 3; k++) {
      a += amount[(start + k) % 24];
      c += count[(start + k) % 24];
    }
    if (a > best.amount) best = { start, amount: a, count: c };
  }
  const share = best.amount / total;
  if (share < 0.3 || best.count < 3) return null;
  const hours = [best.start, (best.start + 1) % 24, (best.start + 2) % 24];
  return {
    startHour: best.start,
    endHour: (best.start + 3) % 24,
    share,
    count: best.count,
    lateNight: hours.filter(isLateHour).length >= 2,
  };
}
