import type { BudgetState, DayBudget } from '@/features/budget/budget';
import { budgetState } from '@/features/budget/budget';
import { categoryBreakdown, type CategoryShare } from '@/features/insights/insights';
import { ruleVerdict } from '@/features/roast/roast';
import { categoryMeta } from '@/lib/categories';
import { isQuickOrder } from '@/lib/merchants';
import { formatINR } from '@/lib/money';
import { countsAsSpend, type Txn } from '@/lib/types';
import type { RoastIntensity } from '@/store/app-store';

export type NightlyReport = {
  dayKey: string;
  budget: number;
  spent: number;
  ratio: number;
  state: BudgetState;
  verdict: string;
  topCategory: CategoryShare | null;
  biggest: Pick<Txn, 'merchant' | 'amount' | 'category'> | null;
  quickOrders: number;
  spendCount: number;
  suggestion: string;
  tomorrowBudget: number;
};

export function buildReport(opts: {
  day: DayBudget;
  txns: Txn[];
  intensity: RoastIntensity;
  tomorrowBudget: number;
  rollover: boolean;
  /** A verdict saved earlier for this day (e.g. from the LLM) wins over the rule line. */
  savedVerdict?: string | null;
}): NightlyReport {
  const { day, txns, intensity, tomorrowBudget, rollover, savedVerdict } = opts;
  const spends = txns.filter(countsAsSpend);
  const biggest = spends.reduce<Txn | null>((m, t) => (!m || t.amount > m.amount ? t : m), null);
  const quickOrders = spends.filter((t) => isQuickOrder(t.merchant, t.category)).length;
  const breakdown = categoryBreakdown(spends);
  const topCategory = breakdown[0] ?? null;

  return {
    dayKey: day.key,
    budget: day.budget,
    spent: day.spent,
    ratio: day.ratio,
    state: budgetState(day.ratio),
    verdict:
      savedVerdict ??
      ruleVerdict({ spent: day.spent, budget: day.budget, ratio: day.ratio, intensity, seed: day.key }),
    topCategory,
    biggest: biggest ? { merchant: biggest.merchant, amount: biggest.amount, category: biggest.category } : null,
    quickOrders,
    spendCount: spends.length,
    suggestion: suggestTomorrow({ day, quickOrders, topCategory, tomorrowBudget, rollover }),
    tomorrowBudget,
  };
}

export function suggestTomorrow(opts: {
  day: DayBudget;
  quickOrders: number;
  topCategory: CategoryShare | null;
  tomorrowBudget: number;
  rollover: boolean;
}): string {
  const { day, quickOrders, topCategory, tomorrowBudget, rollover } = opts;
  const tomorrow = formatINR(tomorrowBudget, { decimals: 0 });
  if (quickOrders >= 2) {
    return `${quickOrders} delivery/quick-commerce orders today. Kal ek hi order — list bana ke.`;
  }
  if (topCategory && topCategory.share >= 0.5 && day.spent > day.budget * 0.5) {
    const label = categoryMeta[topCategory.category].label.toLowerCase();
    return `Aadha kharcha ${label} pe gaya (${formatINR(topCategory.amount, { decimals: 0 })}). Kal ise half karke dekho.`;
  }
  if (day.remaining < 0) {
    return `Kal ka budget ${tomorrow} hai. Pehle zaroori kharche, baaki baad mein.`;
  }
  if (rollover && day.remaining > 0 && day.spent > 0) {
    return `${formatINR(day.remaining, { decimals: 0 })} bacha — rollover se kal ${tomorrow} milega.`;
  }
  return `Kal ka budget ${tomorrow}. Har kharche se pehle 10 second ruk ke socho.`;
}
