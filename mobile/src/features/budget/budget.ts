import { cycleDayKeys, cycleFor, dayKey, type Cycle, type DayKey } from '@/lib/dates';

export type BudgetInput = {
  /** Monthly in-hand salary, paise. */
  salary: number;
  /** Sum of rent, EMI, SIP, insurance… paise. */
  fixedCosts: number;
  payday: number;
  /** Unspent money from a closed day is spread across the remaining days. */
  rollover: boolean;
  /** Overspend on a closed day is taken out of the remaining days, proportionally. */
  redistributeOverspend: boolean;
  /**
   * When tracking began (onboarding). Days before it carry nothing forward —
   * otherwise a mid-month signup would roll weeks of "unspent" money into today.
   */
  trackingStart?: number | null;
};

export type DayBudget = {
  key: DayKey;
  /** Budget for the day after rollover/overspend adjustments, paise (≥ 0). */
  budget: number;
  spent: number;
  /** budget − spent; negative when over. */
  remaining: number;
  /** spent ÷ budget (Infinity when budget is 0 and something was spent). */
  ratio: number;
};

export type BudgetState = 'calm' | 'warning' | 'over';

export type CycleBudget = {
  cycle: Cycle;
  /** Money available for daily spending this cycle, paise. */
  disposable: number;
  /** Unadjusted daily budget: disposable ÷ days in cycle. */
  base: number;
  days: DayBudget[];
  todayIndex: number;
  /** First day of the cycle that counts (tracking start, or 0). */
  activeFrom: number;
  today: DayBudget;
  /** Budget for the tracked part of the cycle: base × tracked days. */
  available: number;
  spentToDate: number;
  /** Projected (disposable − spend) at cycle end at the current pace; negative = overshoot. */
  projectedSavings: number;
};

export function disposableIncome(salary: number, fixedCosts: number): number {
  return Math.max(0, salary - fixedCosts);
}

export function dailyBase(input: Pick<BudgetInput, 'salary' | 'fixedCosts' | 'payday'>, on: Date): number {
  const cycle = cycleFor(on, input.payday);
  return disposableIncome(input.salary, input.fixedCosts) / cycle.days;
}

export function ratio(spent: number, budget: number): number {
  if (budget <= 0) return spent > 0 ? Infinity : 0;
  return spent / budget;
}

export function budgetState(r: number): BudgetState {
  if (r > 1) return 'over';
  if (r >= 0.85) return 'warning';
  return 'calm';
}

/**
 * Walks the cycle day by day. Each closed day (before today) passes its
 * surplus or deficit forward, split evenly over the days left in the cycle,
 * depending on the rollover/overspend settings.
 */
export function computeCycleBudget(
  input: BudgetInput,
  spentByDay: Record<DayKey, number>,
  now: Date,
): CycleBudget {
  const cycle = cycleFor(now, input.payday);
  const keys = cycleDayKeys(cycle);
  const disposable = disposableIncome(input.salary, input.fixedCosts);
  const base = disposable / cycle.days;
  const todayKey = dayKey(now);
  const todayIndex = keys.indexOf(todayKey);
  const startKey = input.trackingStart ? dayKey(input.trackingStart) : null;
  const activeFrom = startKey && startKey > keys[0] ? Math.min(todayIndex, Math.max(0, keys.indexOf(startKey))) : 0;

  let carry = 0;
  const days: DayBudget[] = keys.map((key, i) => {
    const budget = Math.max(0, base + carry);
    const spent = i <= todayIndex ? (spentByDay[key] ?? 0) : 0;
    if (i < todayIndex && i >= activeFrom) {
      const daysLeft = keys.length - 1 - i;
      const diff = budget - spent;
      if (daysLeft > 0 && ((diff > 0 && input.rollover) || (diff < 0 && input.redistributeOverspend))) {
        carry += diff / daysLeft;
      }
    }
    return { key, budget, spent, remaining: budget - spent, ratio: ratio(spent, budget) };
  });

  const spentToDate = days.slice(activeFrom, todayIndex + 1).reduce((sum, d) => sum + d.spent, 0);
  const elapsed = todayIndex - activeFrom + 1;
  const pace = spentToDate / elapsed;
  const projectedSpend = spentToDate + pace * (keys.length - todayIndex - 1);
  const available = base * (keys.length - activeFrom);

  return {
    cycle,
    disposable,
    base,
    days,
    todayIndex,
    activeFrom,
    today: days[todayIndex],
    available,
    spentToDate,
    projectedSavings: available - projectedSpend,
  };
}
