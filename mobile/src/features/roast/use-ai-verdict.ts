import { useEffect, useState } from 'react';

import { authToken } from '@/features/account/session';
import type { NightlyReport } from '@/features/report/report';
import { api } from '@/lib/api';
import { categoryMeta } from '@/lib/categories';
import { useApp } from '@/store/app-store';

/**
 * Asks the server LLM for a fresh Hinglish verdict for variety. Returns null
 * (keep the on-device line) when signed out, offline, or roasts are off.
 */
export function useAiVerdict(report: NightlyReport, enabled: boolean): string | null {
  const signedIn = useApp((s) => !!s.account);
  const token = signedIn ? authToken() : null;
  const aiVerdicts = useApp((s) => s.settings.aiVerdicts);
  const intensity = useApp((s) => s.settings.roast);
  const [verdict, setVerdict] = useState<{ key: string; text: string } | null>(null);

  const rupees = Math.round(report.spent / 100);
  const key = `${report.dayKey}:${rupees}:${intensity}`;
  const { dayKey, budget, spent, topCategory, biggest, quickOrders } = report;

  useEffect(() => {
    if (!enabled || !token || !aiVerdicts || intensity === 'off' || spent <= 0) return;
    let cancelled = false;
    api
      .roast(token, {
        date: dayKey,
        intensity,
        budget: Math.round(budget),
        spent: Math.round(spent),
        topCategory: topCategory ? categoryMeta[topCategory.category].label : null,
        biggest: biggest ? { merchant: biggest.merchant, amount: biggest.amount } : null,
        quickOrders,
        merchants: [],
      })
      .then((r) => {
        if (!cancelled && r.verdict) setVerdict({ key, text: r.verdict.trim() });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // `key` captures the inputs that should trigger a new verdict.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, token, aiVerdicts]);

  return verdict?.key === key ? verdict.text : null;
}
