import { countsAsSpend, type Txn } from '@/lib/types';
import type { FixedCost } from '@/store/app-store';

type CostTxn = Pick<
  Txn,
  'id' | 'amount' | 'type' | 'status' | 'excluded' | 'deleted' | 'mergedInto' | 'merchant' | 'occurredAt' | 'note'
>;

/** Written on a payment marked as a fixed cost: "Fixed cost: Rent". Marked rows are never matched again. */
export const FIXED_COST_NOTE = 'Fixed cost: ';
/** Rent with maintenance, an EMI with a late fee: close enough. */
const TOLERANCE = 0.15;
/** Below this a "fixed cost" match is more likely a coincidence. */
const MIN_AMOUNT = 500_00;
/** A fixed cost is paid about once a month, so one match per ~3 weeks. */
const SAME_PERIOD = 20 * 86_400_000;

export const payeeKey = (merchant: string) => merchant.trim().toLowerCase();
export const isFixedCostNote = (note: string | null) => !!note?.startsWith(FIXED_COST_NOTE);

const near = (amount: number, cost: FixedCost) =>
  cost.amount >= MIN_AMOUNT && Math.abs(amount - cost.amount) / cost.amount <= TOLERANCE;

/** The fixed cost an amount is closest to, if it is within 15% of one. */
export function closestFixedCost(amount: number, costs: FixedCost[]): FixedCost | null {
  let best: FixedCost | null = null;
  for (const c of costs) {
    if (!near(amount, c)) continue;
    if (!best || Math.abs(amount - c.amount) < Math.abs(amount - best.amount)) best = c;
  }
  return best;
}

export type FixedCostMatch<T> = { txn: T; cost: FixedCost };

/**
 * Counted spends that look like a fixed cost. Fixed costs are already taken out
 * of the salary before the daily budget is set, so counting the payment too
 * would charge it twice.
 *
 * - `known`: paid to the payee the user confirmed for that cost: mark without asking.
 * - `ask`: the right amount but an unconfirmed payee, newest first and one per
 *   cost; skips what the user already said no to and costs already marked
 *   around that time.
 */
export function matchFixedCosts<T extends CostTxn>(
  txns: T[],
  costs: FixedCost[],
  dismissed: readonly string[],
): { known: FixedCostMatch<T>[]; ask: FixedCostMatch<T>[] } {
  const marked = txns
    .filter((t) => !t.deleted && isFixedCostNote(t.note))
    .map((t) => ({ label: t.note!.slice(FIXED_COST_NOTE.length), at: t.occurredAt }));
  const paidNear = (cost: FixedCost, at: number) => marked.some((m) => m.label === cost.label && Math.abs(m.at - at) < SAME_PERIOD);

  const known: FixedCostMatch<T>[] = [];
  const ask: FixedCostMatch<T>[] = [];
  const open = txns.filter((t) => countsAsSpend(t) && !isFixedCostNote(t.note)).sort((a, b) => b.occurredAt - a.occurredAt);
  for (const t of open) {
    const payee = payeeKey(t.merchant);
    const confirmed = costs.find((c) => c.payee === payee && near(t.amount, c));
    if (confirmed && !paidNear(confirmed, t.occurredAt)) {
      known.push({ txn: t, cost: confirmed });
      marked.push({ label: confirmed.label, at: t.occurredAt });
      continue;
    }
    const cost = confirmed ?? closestFixedCost(t.amount, costs);
    // Paid to someone else than the confirmed payee: probably not this cost.
    if (!cost || (cost.payee && cost.payee !== payee)) continue;
    if (dismissed.includes(t.id) || paidNear(cost, t.occurredAt) || ask.some((a) => a.cost.id === cost.id)) continue;
    ask.push({ txn: t, cost });
  }
  return { known, ask };
}
