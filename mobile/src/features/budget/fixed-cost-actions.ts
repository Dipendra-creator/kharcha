import { listBetween, updateTxn } from '@/db/transactions';
import type { Txn } from '@/lib/types';
import { useApp, type FixedCost } from '@/store/app-store';

import { FIXED_COST_NOTE, matchFixedCosts, payeeKey } from './fixed-costs';

const DAY = 86_400_000;
/** Covers last month's payment too, so confirming a payee also fixes the previous one. */
const LOOKBACK = 45 * DAY;

/** Marks recent payments to a confirmed fixed-cost payee as already budgeted. Runs after every sync. */
export function markFixedCosts(now = Date.now()): void {
  const { profile, fixedCostDismissed } = useApp.getState();
  if (!profile.fixedCosts.some((c) => c.payee)) return;
  const { known } = matchFixedCosts(listBetween(now - LOOKBACK, now + DAY), profile.fixedCosts, fixedCostDismissed);
  for (const { txn, cost } of known) updateTxn(txn.id, { excluded: true, note: FIXED_COST_NOTE + cost.label });
}

/** "Yes, this is my rent": stop counting it and remember who the cost is paid to. */
export function confirmFixedCost(txn: Txn, cost: FixedCost): void {
  const { profile, setProfile } = useApp.getState();
  updateTxn(txn.id, { excluded: true, note: FIXED_COST_NOTE + cost.label });
  setProfile({ fixedCosts: profile.fixedCosts.map((c) => (c.id === cost.id ? { ...c, payee: payeeKey(txn.merchant) } : c)) });
  markFixedCosts();
}
