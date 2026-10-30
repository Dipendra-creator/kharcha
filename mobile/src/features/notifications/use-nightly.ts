import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useCycleBudget } from '@/db/hooks';
import { formatINR } from '@/lib/money';
import { useApp } from '@/store/app-store';

import { scheduleNightlyReports } from './nightly';

/** Keeps the scheduled 10 PM notifications in step with today's numbers and the report time. */
export function useNightlyScheduler(): void {
  const hour = useApp((s) => s.settings.reportHour);
  const minute = useApp((s) => s.settings.reportMinute);
  const onboarded = useApp((s) => s.onboarded);
  const { today } = useCycleBudget();
  const spent = Math.round(today.spent / 100);
  const budget = Math.round(today.budget / 100);

  useEffect(() => {
    if (!onboarded || Platform.OS === 'web') return;
    const body =
      spent > 0
        ? `${formatINR(spent * 100)} of ${formatINR(budget * 100)} spent today. Verdict inside.`
        : 'No spends logged yet today. Verdict inside.';
    // Debounced: a sync can add many rows in a burst.
    const t = setTimeout(() => {
      scheduleNightlyReports({ hour, minute, todayBody: body }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [hour, minute, spent, budget, onboarded]);
}

/** Opens the report when the user taps a nightly notification. */
export function useNotificationRouting(): void {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string') {
      router.push(url as never);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
  }, [response]);
}
