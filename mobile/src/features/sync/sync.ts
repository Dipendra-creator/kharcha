import { create } from 'zustand';

import { saveSubscriptions } from '@/db/meta';
import { listBetween } from '@/db/transactions';
import { markFixedCosts } from '@/features/budget/fixed-cost-actions';
import { detectSubscriptions } from '@/features/subscriptions/detect';
import { bumpData, useApp } from '@/store/app-store';

const DAY = 86_400_000;

export type SyncSummary = {
  smsRead: number;
  smsAdded: number;
  emailAdded: number;
  pushed: number;
  pulled: number;
  review: number;
  errors: string[];
};

type SyncStatus = { running: boolean; last: SyncSummary | null };

export const useSyncStatus = create<SyncStatus>(() => ({ running: false, last: null }));

/** A sync step: adds to the summary and records its own errors instead of throwing. */
export type SyncStep = (summary: SyncSummary) => Promise<void>;

const steps: SyncStep[] = [];

/** Sources (SMS, server/email) register themselves here so this module stays platform-neutral. */
export function registerSyncStep(step: SyncStep): void {
  if (!steps.includes(step)) steps.push(step);
}

/** Re-runs subscription detection over the last ~13 months. */
export function refreshSubscriptions(now = Date.now()): void {
  saveSubscriptions(detectSubscriptions(listBetween(now - 400 * DAY, now + DAY), now));
  bumpData();
}

let inFlight: Promise<SyncSummary> | null = null;

/** "Sync now" / pull-to-refresh / background task entry point. Concurrent calls share one run. */
export function syncNow(): Promise<SyncSummary> {
  if (inFlight) return inFlight;
  useSyncStatus.setState({ running: true });
  inFlight = (async () => {
    const summary: SyncSummary = { smsRead: 0, smsAdded: 0, emailAdded: 0, pushed: 0, pulled: 0, review: 0, errors: [] };
    for (const step of steps) {
      try {
        await step(summary);
      } catch (e) {
        summary.errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    markFixedCosts();
    refreshSubscriptions();
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
