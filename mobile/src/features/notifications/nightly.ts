import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { dayKey } from '@/lib/dates';

export const NIGHTLY_CHANNEL = 'nightly-report';
const PREFIX = 'nightly-';

let handlerSet = false;

export function configureNotifications(): void {
  if (handlerSet || Platform.OS === 'web') return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(NIGHTLY_CHANNEL, {
    name: 'Nightly report',
    description: 'Your 10 PM budget verdict',
    importance: AndroidImportance.HIGH,
  });
}

export async function notificationsGranted(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  // Android 13+ needs the channel to exist before the permission prompt shows.
  await ensureChannel();
  if (await notificationsGranted()) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Schedules the nightly report for today (if the time hasn't passed) and the
 * next six days, so it fires even if the app isn't opened. Today's
 * notification carries the live numbers; later days get a generic line and
 * are refreshed the next time the app runs.
 */
export async function scheduleNightlyReports(opts: { hour: number; minute: number; todayBody: string | null }) {
  if (!(await notificationsGranted())) return;
  await ensureChannel();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, opts.hour, opts.minute);
    if (at.getTime() <= now.getTime()) continue;
    const key = dayKey(at);
    await Notifications.scheduleNotificationAsync({
      identifier: `${PREFIX}${key}`,
      content: {
        title: 'Aaj ka hisaab is ready',
        body: i === 0 && opts.todayBody ? opts.todayBody : 'Tap to see where your money went today.',
        data: { url: `/report/${key}` },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: NIGHTLY_CHANNEL },
    });
  }
}

export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
