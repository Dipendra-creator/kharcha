import type { DetectedSubscription } from './detect';

const DAY = 86_400_000;
/** The morning before the charge, while there is still time to cancel. */
export const REMIND_HOUR = 10;
/** Later renewals are scheduled by a later sync; Android caps pending alarms per app. */
const HORIZON = 40 * DAY;

type Remindable = Pick<DetectedSubscription, 'merchant' | 'nextDate'> & { dismissed: boolean };

/** When to remind about each subscription: 10 AM the day before it renews, if that is still ahead. */
export function renewalReminders<T extends Remindable>(subs: T[], now: number): { sub: T; at: Date }[] {
  return subs
    .filter((s) => !s.dismissed && s.nextDate > now && s.nextDate - now <= HORIZON)
    .map((s) => {
      const renews = new Date(s.nextDate);
      return { sub: s, at: new Date(renews.getFullYear(), renews.getMonth(), renews.getDate() - 1, REMIND_HOUR) };
    })
    .filter((r) => r.at.getTime() > now);
}
