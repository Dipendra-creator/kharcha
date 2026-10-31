import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { AppText } from '@/components/text';
import { Card } from '@/components/ui';
import { useDayRange } from '@/db/hooks';
import { addDays, dayKey, diffDays, formatDate, fromDayKey, startOfDay } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useApp } from '@/store/app-store';
import { useTheme, withAlpha } from '@/theme/theme';
import { spacing } from '@/theme/tokens';

import { budgetStreak } from './insights';

/** How far back a streak is looked for. */
const MAX_DAYS = 120;

/** Days in a row under budget, counted from when tracking began. */
export function StreakCard({ now }: { now: Date }) {
  const { c } = useTheme();
  const trackingStart = useApp((s) => s.trackingStart);
  const today = startOfDay(now);
  const earliest = addDays(today, -(MAX_DAYS - 1));
  const from = trackingStart && trackingStart > earliest.getTime() ? startOfDay(new Date(trackingStart)) : earliest;
  const days = useDayRange(from, diffDays(from, today) + 1);
  const todayKey = dayKey(today);
  const { current, since, best } = budgetStreak(days, todayKey);
  const todayBudget = days[days.length - 1];
  const onTrack = todayBudget ? todayBudget.spent <= todayBudget.budget : true;
  const left = todayBudget ? todayBudget.budget - todayBudget.spent : 0;

  const title = current > 0 ? `${current}-day streak` : 'No streak yet';
  const line =
    current > 0
      ? onTrack
        ? `Under budget every day since ${formatDate(fromDayKey(since!))}. Spend at most ${formatINR(left, { decimals: 0 })} more today to make it ${current + 1}.`
        : 'Today is over budget, so this streak ends tonight.'
      : onTrack
        ? 'Finish today under budget to start one.'
        : "Today's over budget. Tomorrow is a fresh start.";
  const record = best > current ? ` Best so far: ${best} ${best === 1 ? 'day' : 'days'}.` : '';
  const lit = current > 0;

  return (
    <Card style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: lit ? withAlpha(c.warning, 0.16) : c.raised,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Ionicons name={lit ? 'flame' : 'flame-outline'} size={22} color={lit ? c.warning : c.textMuted} />
      </View>
      <View style={{ flex: 1 }} accessible accessibilityLabel={`${title}. ${line}${record}`}>
        <AppText variant="body" weight="semibold">
          {title}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {line}
          {record}
        </AppText>
      </View>
    </Card>
  );
}
