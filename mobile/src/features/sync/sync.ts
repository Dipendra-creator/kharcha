import { create } from 'zustand';

import { markFixedCosts } from '@/features/budget/fixed-cost-actions';
import { bumpData, useApp } from '@/store/app-store';

export type SyncSummary = {
  smsRead: number;
  smsAdded: number;
  review: number;
  errors: string[];
};

type SyncStatus = { running: boolean; last: SyncSummary | null };

export const useSyncStatus = create<SyncStatus>(() => ({ running: false, last: null }));

/** A sync step: adds to the summary and records its own errors instead of throwing. */
export type SyncStep = (summary: SyncSummary) => Promise<void>;

const steps: SyncStep[] = [];

/** Sources (SMS, payment notifications) register themselves here so this module stays platform-neutral. */
export function registerSyncStep(step: SyncStep): void {
  if (!steps.includes(step)) steps.push(step);
}

let inFlight: Promise<SyncSummary> | null = null;

/** "Sync now" / pull-to-refresh / background task entry point. Concurrent calls share one run. */
export function syncNow(): Promise<SyncSummary> {
  if (inFlight) return inFlight;
  useSyncStatus.setState({ running: true });
  inFlight = (async () => {
    const summary: SyncSummary = { smsRead: 0, smsAdded: 0, review: 0, errors: [] };
    for (const step of steps) {
      try {
        await step(summary);
      } catch (e) {
        summary.errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    markFixedCosts();
    bumpData();
    useApp.getState().setSync({ lastSyncAt: Date.now() });
    return summary;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight.then((summary) => {
    useSyncStatus.setState({ running: false, last: summary });
    return summary;
  });
}
