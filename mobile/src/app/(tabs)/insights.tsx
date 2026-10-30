import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { Donut, HourBars, ProgressBar, WeeklyBars } from '@/components/charts';
import { Money } from '@/components/money';
import { Screen } from '@/components/screen';
import { AppText } from '@/components/text';
import { MerchantAvatar } from '@/components/txn-row';
import { Card, EmptyState, SectionTitle } from '@/components/ui';
import { useCycleBudget, useDbQuery, useRecentDays } from '@/db/hooks';
import { listBetween } from '@/db/transactions';
import { categoryBreakdown, hourlySpend, impulseWindow, topMerchants } from '@/features/insights/insights';
import { categoryMeta } from '@/lib/categories';
import { addDays, formatDate, formatHour } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme, withAlpha } from '@/theme/theme';
import { radii, spacing } from '@/theme/tokens';

export default function InsightsScreen() {
  const { c, category } = useTheme();
  const budget = useCycleBudget();
  const week = useRecentDays(7);
  const { start, end } = budget.cycle;
  const txns = useDbQuery(() => listBetween(start.getTime(), end.getTime()), [start.getTime(), end.getTime()]);

  const cats = categoryBreakdown(txns);
  const merchants = topMerchants(txns, 5);
  const hours = hourlySpend(txns);
  const impulse = impulseWindow(txns);
  const saving = budget.projectedSavings >= 0;
  const usedRatio = budget.available ? budget.spentToDate / budget.available : 0;
  const tracked = budget.days.length - budget.activeFrom;
  const elapsedRatio = (budget.todayIndex - budget.activeFrom + 1) / tracked;

  return (
    <Screen tabs>
      <AppText variant="title" accessibilityRole="header">
        Insights
      </AppText>
      <AppText variant="caption" color="textMuted">
        {formatDate(start)} – {formatDate(addDays(end, -1))} · day {budget.todayIndex + 1} of {budget.days.length}
      </AppText>

      <Card style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name={saving ? 'trending-up' : 'trending-down'} size={18} color={saving ? c.safe : c.over} />
          <AppText variant="label" color="textMuted">
            Month-end projection
          </AppText>
        </View>
        <AppText variant="heading">
          At this pace you&apos;ll {saving ? 'save ' : 'overshoot by '}
          <AppText variant="heading" color={saving ? 'safe' : 'over'} tabular>
            {formatINR(Math.abs(budget.projectedSavings), { decimals: 0 })}
          </AppText>
        </AppText>
        <ProgressBar ratio={usedRatio} color={usedRatio > elapsedRatio ? c.warning : c.accentGraphic} track={c.ringTrack} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="caption" color="textMuted">
            {formatINR(budget.spentToDate, { decimals: 0 })} spent of {formatINR(budget.available, { decimals: 0 })}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {Math.round(elapsedRatio * 100)}% of cycle gone
          </AppText>
        </View>
      </Card>

      <SectionTitle title="Last 7 days" />
      <Card>
        <WeeklyBars days={week} />
      </Card>

      <SectionTitle title="Where it went" />
      <Card>
        {cats.length === 0 ? (
          <EmptyState icon="pie-chart-outline" title="Nothing yet" body="Category split appears after your first spends this cycle." />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl }}>
            <Donut data={cats} centerLabel="This cycle" centerValue={formatINR(budget.spentToDate, { compact: true, decimals: 0 })} size={148} stroke={20} />
            <View style={{ flex: 1, gap: spacing.sm }}>
              {cats.slice(0, 5).map((cat) => (
                <View key={cat.category} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: category[cat.category] }} />
                  <AppText variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                    {categoryMeta[cat.category].label}
                  </AppText>
                  <AppText variant="caption" color="textMuted" tabular>
                    {Math.round(cat.share * 100)}%
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        )}
      </Card>

      <SectionTitle title="Top merchants" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
        {merchants.length === 0 ? (
          <EmptyState icon="storefront-outline" title="No merchants yet" body="Your most-paid merchants this cycle will show up here." />
        ) : (
          merchants.map((m, i) => (
            <View
              key={m.merchant}
              accessible
              accessibilityLabel={`${m.merchant}, ${m.count} payments, ${formatINR(m.amount)}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.md,
                borderBottomWidth: i === merchants.length - 1 ? 0 : 1,
                borderBottomColor: c.border,
              }}>
              <MerchantAvatar merchant={m.merchant} category={m.category} size={40} />
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="semibold" numberOfLines={1}>
                  {m.merchant}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {m.count} {m.count === 1 ? 'payment' : 'payments'}
                </AppText>
              </View>
              <Money paise={m.amount} variant="body" decimals={0} />
            </View>
          ))
        )}
      </Card>

      <SectionTitle title="Time of day" />
      <Card style={{ gap: spacing.lg }}>
        <HourBars hours={hours} highlight={impulse ? { start: impulse.startHour, end: impulse.endHour } : null} />
        {impulse ? (
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              padding: spacing.lg,
              borderRadius: radii.md,
              backgroundColor: withAlpha(c.warning, 0.12),
            }}>
            <Ionicons name={impulse.lateNight ? 'moon' : 'flash'} size={20} color={c.warning} />
            <AppText variant="caption" style={{ flex: 1 }}>
              <AppText variant="caption" weight="bold">
                {impulse.lateNight ? 'Late-night impulse window: ' : 'Impulse window: '}
              </AppText>
              {Math.round(impulse.share * 100)}% of this cycle&apos;s spend ({impulse.count} orders) happens between{' '}
              {formatHour(impulse.startHour)} and {formatHour(impulse.endHour)}.
            </AppText>
          </View>
        ) : (
          <AppText variant="caption" color="textMuted">
            No impulse window detected — your spending is spread through the day.
          </AppText>
        )}
      </Card>
    </Screen>
  );
}
