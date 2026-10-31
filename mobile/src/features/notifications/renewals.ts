import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useDbQuery } from '@/db/hooks';
import { listSubscriptions } from '@/db/meta';
import { renewalReminders } from '@/features/subscriptions/reminders';
import { dayKey } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useApp } from '@/store/app-store';

import { notificationsGranted } from './nightly';

const CHANNEL = 'renewals';
const PREFIX = 'renewal-';
const CYCLE = { weekly: 'weekly', monthly: 'monthly', quarterly: 'every 3 months', yearly: 'yearly' } as const;

/** Replaces the scheduled renewal reminders with one per upcoming renewal (none when `enabled` is off). */
export async function scheduleRenewalReminders(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web' || !(await notificationsGranted())) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  if (!enabled) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Renewal reminders',
      description: 'The day before a subscription charges you',
      importance: AndroidImportance.DEFAULT,
    });
  }
  for (const { sub, at } of renewalReminders(listSubscriptions(), Date.now())) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}${sub.merchant}-${dayKey(sub.nextDate)}`,
      content: {
        title: `${sub.merchant} renews tomorrow`,
        body: `${formatINR(sub.amount, { decimals: 0 })}, ${CYCLE[sub.cycle]}. Not using it? Cancel today.`,
        data: { url: '/subscriptions' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  }
}

/** Keeps renewal reminders in step with the detected subscriptions and the setting. */
export function useRenewalReminders(): void {
  const enabled = useApp((s) => s.settings.renewalReminders);
  const onboarded = useApp((s) => s.onboarded);
  const subs = useDbQuery(() => listSubscriptions(), []);
  // Reschedule only when something a reminder shows actually changes, not on every data bump.
  const signature = subs
    .filter((s) => !s.dismissed)
    .map((s) => `${s.merchant}:${s.nextDate}:${s.amount}`)
    .join('|');

  useEffect(() => {
    if (!onboarded || Platform.OS === 'web') return;
    const t = setTimeout(() => {
      scheduleRenewalReminders(enabled).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [signature, enabled, onboarded]);
}
