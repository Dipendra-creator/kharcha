import { router } from 'expo-router';
import { View } from 'react-native';

import { useDbQuery, type RangeDay } from '@/db/hooks';
import { listDay } from '@/db/transactions';
import { budgetState } from '@/features/budget/budget';
import { categoryBreakdown } from '@/features/insights/insights';
import { categoryMeta } from '@/lib/categories';
import { dayKey, formatDate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';

import { stateColor } from './budget-ring';
import { ProgressBar } from './charts';
import { Money } from './money';
import { AppText } from './text';
import { TxnRow } from './txn-row';
import { Button, Card, IconButton } from './ui';

/** One day from a chart or the calendar: spent vs budget, where it went, and every entry. */
export function DayDetail({ day, onClose }: { day: RangeDay; onClose: () => void }) {
  const { c, category } = useTheme();
  const txns = useDbQuery(() => listDay(day.key), [day.key]);
  const cats = categoryBreakdown(txns);
  const isToday = day.key === dayKey(new Date());
  const left = day.budget - day.spent;
  const accent = stateColor(budgetState(day.ratio), c);

  const verdict =
    left < 0
      ? `${formatINR(-left, { decimals: 0 })} over budget`
      : isToday
        ? `${formatINR(left, { decimals: 0 })} left today`
        : day.spent
          ? `${formatINR(left, { decimals: 0 })} saved`
          : 'No-spend day — the whole budget saved';

  return (
    <Card style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" color="textMuted">
            {isToday ? 'Today' : 'Day details'}
          </AppText>
          <AppText variant="heading" accessibilityRole="header">
            {formatDate(day.date, { weekday: true })}
          </AppText>
        </View>
        <IconButton icon="close" label="Close day details" size={36} onPress={onClose} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <AppText variant="caption" color="textMuted">
              Spent
            </AppText>
            <Money paise={day.spent} variant="title" decimals={0} label="Spent" />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <AppText variant="caption" color="textMuted">
              Budget
            </AppText>
            <Money paise={day.budget} variant="body" color="textMuted" decimals={0} label="Budget" />
          </View>
        </View>
        <ProgressBar ratio={day.ratio} color={accent} track={c.ringTrack} />
        <AppText variant="label" color={left < 0 ? 'over' : 'safe'}>
          {verdict}
        </AppText>
      </View>

      {cats.length ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: c.ringTrack }}>
            {cats.map((cat) => (
              <View key={cat.category} style={{ flex: cat.share, backgroundColor: category[cat.category] }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs }}>
            {cats.slice(0, 4).map((cat) => (
              <View key={cat.category} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: category[cat.category] }} />
                <AppText variant="caption" color="textMuted">
                  {categoryMeta[cat.category].label} {formatINR(cat.amount, { decimals: 0 })}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View>
        <AppText variant="micro" color="textMuted">
          {txns.length} {txns.length === 1 ? 'entry' : 'entries'}
        </AppText>
        {txns.length === 0 ? (
          <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.sm }}>
            Nothing logged on this day.
          </AppText>
        ) : (
          txns.map((t) => <TxnRow key={t.id} txn={t} onPress={() => router.push({ pathname: '/add', params: { id: t.id } })} />)
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          title="Day report"
          size="sm"
          variant="secondary"
          icon="moon-outline"
          style={{ flex: 1 }}
          onPress={() => router.push(`/report/${day.key}`)}
        />
        <Button
          title="Add spend"
          size="sm"
          variant="secondary"
          icon="add"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/add', params: { date: day.key } })}
        />
      </View>
    </Card>
  );
}
