import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { budgetInputOf } from '@/db/hooks';
import { listCreatedSince, spentByDay } from '@/db/transactions';
import { computeCycleBudget } from '@/features/budget/budget';
import { useSyncStatus } from '@/features/sync/sync';
import { cycleFor, dayKey } from '@/lib/dates';
import { countsAsSpend } from '@/lib/types';
import { useApp } from '@/store/app-store';

import { notificationsGranted } from './nightly';
import { spendAlertText } from './spend-alert-text';

const CHANNEL = 'spend-alerts';

/** Everything added so far has been seen: the app is open, or an alert just covered it. */
function markSeen(): void {
  useApp.getState().setSync({ alertCursor: Date.now() });
}

/**
 * After a background sync: one notification for today's spends added since
 * the user last looked, with what's left of today's budget. Silent while the
 * app is open, since the new spends are on screen.
 */
export async function alertNewSpends(): Promise<void> {
  const { onboarded, settings, sync } = useApp.getState();
  if (sync.alertCursor == null) {
    // First run after installing or updating: start from now instead of alerting about history.
    markSeen();
    return;
  }
  const fresh = listCreatedSince(sync.alertCursor);
  markSeen();
  if (!onboarded || !settings.spendAlerts || AppState.currentState === 'active' || Platform.OS === 'web') return;

  const now = new Date();
  const spends = fresh.filter((t) => countsAsSpend(t) && dayKey(t.occurredAt) === dayKey(now));
  if (!spends.length || !(await notificationsGranted())) return;

  const input = budgetInputOf(useApp.getState());
  const cycle = cycleFor(now, input.payday);
  const { today } = computeCycleBudget(input, spentByDay(cycle.start.getTime(), cycle.end.getTime()), now);
  const text = spendAlertText(spends, today);
  if (!text) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Spend alerts',
      description: "New spends and what's left today",
      importance: AndroidImportance.DEFAULT,
    });
  }
  await Notifications.scheduleNotificationAsync({
    content: { ...text, data: { url: '/' } },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  });
}

/** Marks spends as seen whenever the user is looking at the app, so alerts never repeat them. */
export function useSeenSpends(): void {
  useEffect(() => {
    const seenIfOpen = () => {
      if (AppState.currentState === 'active') markSeen();
    };
    seenIfOpen();
    const appState = AppState.addEventListener('change', (s) => s === 'active' && markSeen());
    const sync = useSyncStatus.subscribe((s, prev) => {
      if (prev.running && !s.running) seenIfOpen();
    });
    return () => {
      appState.remove();
      sync();
    };
  }, []);
}
