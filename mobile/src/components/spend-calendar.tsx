import { Pressable, View } from 'react-native';

import type { RangeDay } from '@/db/hooks';
import { budgetState } from '@/features/budget/budget';
import { rangeSummary } from '@/features/insights/insights';
import { formatDate, formatMonth, type DayKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { formatINR, spokenINR } from '@/lib/money';
import { useTheme, withAlpha } from '@/theme/theme';
import { radii, spacing } from '@/theme/tokens';

import { stateColor } from './budget-ring';
import { AppText } from './text';
import { IconButton } from './ui';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * A month of days, Sunday first. Each day shows what was spent and is tinted
 * by how it went against that day's budget; tap one to pick it.
 */
export function SpendCalendar({
  month,
  days,
  todayKey,
  selected,
  onSelect,
  onMonthChange,
  canPrev,
  canNext,
}: {
  /** First day of the month shown. */
  month: Date;
  /** Every day of `month`, in order. */
  days: RangeDay[];
  todayKey: DayKey;
  selected: DayKey | null;
  onSelect: (key: DayKey | null) => void;
  onMonthChange: (by: -1 | 1) => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  const { c } = useTheme();
  const cells: (RangeDay | null)[] = [...Array<null>(month.getDay()).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  const { spent, saved, underBudget, elapsed } = rangeSummary(days);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-back" label="Previous month" size={36} disabled={!canPrev} onPress={() => onMonthChange(-1)} />
        <AppText variant="heading" accessibilityRole="header" accessibilityLiveRegion="polite">
          {formatMonth(month)}
        </AppText>
        <IconButton icon="chevron-forward" label="Next month" size={36} disabled={!canNext} onPress={() => onMonthChange(1)} />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Summary label="Spent" value={formatINR(spent, { decimals: 0, compact: true })} />
        <Summary
          label={saved < 0 ? 'Over plan' : 'Saved'}
          value={formatINR(Math.abs(saved), { decimals: 0, compact: true })}
          color={saved < 0 ? 'over' : 'safe'}
        />
        <Summary label="On budget" value={`${underBudget}/${elapsed} days`} />
      </View>

      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', gap: spacing.xs }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {WEEKDAYS.map((w, i) => (
            <AppText key={i} variant="caption" color="textMuted" align="center" style={{ flex: 1 }}>
              {w}
            </AppText>
          ))}
        </View>
        {weeks.map((week, w) => (
          <View key={w} style={{ flexDirection: 'row', gap: spacing.xs }}>
            {week.map((day, i) =>
              day ? (
                <DayCell
                  key={day.key}
                  day={day}
                  today={day.key === todayKey}
                  selected={day.key === selected}
                  onPress={() => {
                    haptic.select();
                    onSelect(day.key === selected ? null : day.key);
                  }}
                />
              ) : (
                <View key={`blank-${i}`} style={{ flex: 1 }} />
              ),
            )}
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.xs }}>
        <Legend color={c.accentGraphic} label="Under budget" />
        <Legend color={c.warning} label="Close" />
        <Legend color={c.over} label="Over" />
      </View>
    </View>
  );
}

function DayCell({ day, today, selected, onPress }: { day: RangeDay; today: boolean; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const tone = stateColor(budgetState(day.ratio), c);
  const spent = !day.future && day.spent > 0;
  // Always a solid or tinted colour, never transparent (see TabPill in glass-tab-bar).
  const bg = selected ? c.accent : spent ? withAlpha(tone, 0.16) : c.surface;
  const label = day.future
    ? `${formatDate(day.date, { weekday: true })}, upcoming`
    : `${formatDate(day.date, { weekday: true })}${today ? ', today' : ''}: spent ${spokenINR(day.spent)} of ${spokenINR(day.budget)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: day.future }}
      disabled={day.future}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        aspectRatio: 0.82,
        borderRadius: radii.sm,
        backgroundColor: bg,
        borderWidth: today && !selected ? 1.5 : 0,
        borderColor: c.text,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        opacity: day.future ? 0.35 : pressed ? 0.7 : 1,
      })}>
      <AppText variant="label" color={selected ? c.onAccent : 'text'} tabular>
        {day.date.getDate()}
      </AppText>
      <AppText
        variant="caption"
        color={selected ? c.onAccent : tone}
        tabular
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ fontSize: 10, lineHeight: 12, paddingHorizontal: 2 }}>
        {spent ? formatINR(day.spent, { decimals: 0, compact: true }) : ' '}
      </AppText>
    </Pressable>
  );
}

function Summary({ label, value, color = 'text' }: { label: string; value: string; color?: 'text' | 'safe' | 'over' }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, gap: 2, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.md, backgroundColor: c.raised }}>
      <AppText variant="caption" color="textMuted" numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="body" weight="bold" color={color} tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: withAlpha(color, 0.5) }} />
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
    </View>
  );
}
