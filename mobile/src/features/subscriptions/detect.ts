import { merchantInfo } from '@/lib/merchants';
import type { Category, Txn } from '@/lib/types';

export type SubscriptionCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type DetectedSubscription = {
  merchant: string;
  category: Category;
  /** Latest charge, paise. */
  amount: number;
  cycle: SubscriptionCycle;
  lastDate: number;
  nextDate: number;
  count: number;
  /** Charge normalised to a month, paise. */
  monthlyCost: number;
  /** 'recurring' = seen on a regular cycle; 'likely' = a known subscription seen once. */
  confidence: 'recurring' | 'likely';
};

type SubTxn = Pick<Txn, 'amount' | 'type' | 'merchant' | 'category' | 'occurredAt' | 'deleted' | 'mergedInto' | 'status'>;

const DAY = 86_400_000;

const CYCLES: { cycle: SubscriptionCycle; min: number; max: number; perMonth: number }[] = [
  { cycle: 'weekly', min: 6, max: 8, perMonth: 30.44 / 7 },
  { cycle: 'monthly', min: 26, max: 35, perMonth: 1 },
  { cycle: 'quarterly', min: 84, max: 96, perMonth: 1 / 3 },
  { cycle: 'yearly', min: 355, max: 375, perMonth: 1 / 12 },
];

function sameAmount(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(20_00, Math.max(a, b) * 0.08);
}

function addCycle(ts: number, cycle: SubscriptionCycle): number {
  const d = new Date(ts);
  if (cycle === 'weekly') return ts + 7 * DAY;
  const months = cycle === 'monthly' ? 1 : cycle === 'quarterly' ? 3 : 12;
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1, d.getHours(), d.getMinutes());
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return target.getTime();
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Finds merchants charging about the same amount on a regular cycle. A charge
 * that hasn't recurred for 1.5 cycles is treated as cancelled.
 */
export function detectSubscriptions(txns: SubTxn[], now: number): DetectedSubscription[] {
  const debits = txns.filter((t) => t.type === 'debit' && !t.deleted && !t.mergedInto && t.status !== 'ignored');
  const groups = new Map<string, SubTxn[]>();
  for (const t of debits) {
    const key = t.merchant.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  const found: DetectedSubscription[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.occurredAt - b.occurredAt);
    // Cluster by amount so a ₹199 plan and a ₹649 one-off at the same merchant don't mix.
    const clusters: SubTxn[][] = [];
    for (const t of group) {
      const c = clusters.find((cl) => sameAmount(cl[cl.length - 1].amount, t.amount));
      if (c) c.push(t);
      else clusters.push([t]);
    }

    for (const cluster of clusters) {
      const last = cluster[cluster.length - 1];
      const info = merchantInfo(last.merchant);
      if (cluster.length >= 2) {
        const gaps = cluster.slice(1).map((t, i) => (t.occurredAt - cluster[i].occurredAt) / DAY);
        const gap = median(gaps);
        const spec = CYCLES.find((c) => gap >= c.min && gap <= c.max);
        if (!spec) continue;
        const regular = gaps.filter((g) => g >= spec.min && g <= spec.max).length;
        if (regular / gaps.length < 0.5) continue;
        if (now - last.occurredAt > spec.max * 1.5 * DAY) continue;
        found.push({
          merchant: last.merchant,
          category: info?.subscription ? 'subscriptions' : last.category,
          amount: last.amount,
          cycle: spec.cycle,
          lastDate: last.occurredAt,
          nextDate: addCycle(last.occurredAt, spec.cycle),
          count: cluster.length,
          monthlyCost: Math.round(last.amount * spec.perMonth),
          confidence: 'recurring',
        });
      } else if (info?.subscription && now - last.occurredAt <= 35 * DAY) {
        found.push({
          merchant: last.merchant,
          category: 'subscriptions',
          amount: last.amount,
          cycle: 'monthly',
          lastDate: last.occurredAt,
          nextDate: addCycle(last.occurredAt, 'monthly'),
          count: 1,
          monthlyCost: last.amount,
          confidence: 'likely',
        });
      }
    }
  }
  return found.sort((a, b) => a.nextDate - b.nextDate);
}
