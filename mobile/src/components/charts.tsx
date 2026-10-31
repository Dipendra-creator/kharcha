import { Canvas, DashPathEffect, Group, Line, Path, Rect, RoundedRect, Skia, vec } from '@shopify/react-native-skia';
import { useRef, useState } from 'react';
import { View, type GestureResponderEvent, type LayoutChangeEvent, type ViewProps } from 'react-native';

import { budgetState } from '@/features/budget/budget';
import { categoryMeta } from '@/lib/categories';
import { formatDate, shortWeekday, type DayKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { formatINR, spokenINR } from '@/lib/money';
import type { Category } from '@/lib/types';
import { useTheme, withAlpha } from '@/theme/theme';
import { spacing } from '@/theme/tokens';

import { stateColor } from './budget-ring';
import { AppText } from './text';

function useWidth(initial = 0) {
  const [width, setWidth] = useState(initial);
  return [width, (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))] as const;
}

type BarDay = { key: DayKey; date: Date; spent: number; budget: number; ratio: number };

const LABEL_W = 56;

/**
 * Daily spend bars against a dashed average-budget line. Bars take the
 * budget-state colour. With `onSelect`, tapping or dragging across the bars
 * picks a day; tapping the picked bar again clears it.
 */
export function DailyBars({
  days,
  selected,
  onSelect,
  height = 160,
}: {
  days: BarDay[];
  selected?: DayKey | null;
  onSelect?: (key: DayKey | null) => void;
  height?: number;
}) {
  const { c } = useTheme();
  const [width, onLayout] = useWidth();
  // A month of bars is too narrow for a label each: label weekly, counting back from today.
  const dense = days.length > 10;
  const avgBudget = days.reduce((s, d) => s + d.budget, 0) / Math.max(1, days.length);
  const [largest = 0, second = 0] = days.map((d) => d.spent).sort((a, b) => b - a);
  // One outlier (rent, a big transfer) would flatten every other bar: cap the scale and mark the bars it cuts.
  const max = Math.max(avgBudget * 1.15, Math.min(largest, Math.max(avgBudget * 2.5, second * 1.25)), 1);
  const gap = dense ? 3 : 10;
  const barW = width ? (width - gap * (days.length - 1)) / days.length : 0;
  const y = (v: number) => height - (Math.min(v, max) / max) * height;
  const last = days.length - 1;
  const picked = selected ? days.findIndex((d) => d.key === selected) : -1;
  const labelFor = (d: BarDay, i: number) => (i === last ? 'Today' : dense ? formatDate(d.date) : shortWeekday(d.date));

  // Scrubbing: the index under the finger, and whether this touch began on the already-picked bar.
  const scrub = useRef({ index: -1, clear: false });
  const indexAt = (x: number) => Math.min(last, Math.max(0, Math.floor((x + gap / 2) / (barW + gap))));
  const pick = (i: number) => {
    if (i === scrub.current.index) return;
    scrub.current.index = i;
    haptic.select();
    onSelect?.(days[i].key);
  };
  const touch: Partial<ViewProps> = onSelect
    ? {
        onStartShouldSetResponder: () => true,
        onResponderGrant: (e: GestureResponderEvent) => {
          const i = indexAt(e.nativeEvent.locationX);
          scrub.current = { index: picked, clear: i === picked };
          if (i !== picked) pick(i);
        },
        onResponderMove: (e: GestureResponderEvent) => {
          const i = indexAt(e.nativeEvent.locationX);
          if (i === scrub.current.index) return;
          scrub.current.clear = false;
          pick(i);
        },
        onResponderRelease: () => {
          if (scrub.current.clear) onSelect(null);
        },
      }
    : {};

  const describe = (d: BarDay, i: number) => `${labelFor(d, i)}, ${spokenINR(d.spent)} of ${spokenINR(d.budget)}`;
  const step = (by: number) => {
    const i = picked < 0 ? last : Math.min(last, Math.max(0, picked + by));
    onSelect?.(days[i].key);
  };

  return (
    <View
      accessible
      accessibilityRole={onSelect ? 'adjustable' : undefined}
      accessibilityLabel={`Daily spend, last ${days.length} days`}
      accessibilityValue={{ text: picked >= 0 ? describe(days[picked], picked) : days.map(describe).join('; ') }}
      accessibilityActions={onSelect ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}>
      <View onLayout={onLayout} style={{ height }} {...touch}>
        {width ? (
          <Canvas style={{ width, height }}>
            {picked >= 0 ? (
              <RoundedRect
                x={picked * (barW + gap) - gap / 2}
                y={0}
                width={barW + gap}
                height={height}
                r={Math.min(10, (barW + gap) / 2)}
                color={withAlpha(c.text, 0.07)}
              />
            ) : null}
            {days.map((d, i) => {
              const h = Math.max(4, height - y(d.spent));
              const x = i * (barW + gap);
              return (
                <Group key={d.key} opacity={picked < 0 || picked === i ? 1 : 0.35}>
                  <RoundedRect
                    x={x}
                    y={height - h}
                    width={barW}
                    height={h}
                    r={Math.min(8, barW / 2)}
                    color={d.spent ? stateColor(budgetState(d.ratio), c) : c.ringTrack}
                  />
                  {d.spent > max ? <Rect x={x} y={12} width={barW} height={3} color={c.surface} /> : null}
                </Group>
              );
            })}
            <Line p1={vec(0, y(avgBudget))} p2={vec(width, y(avgBudget))} color={c.textMuted} strokeWidth={1.5}>
              <DashPathEffect intervals={[5, 5]} />
            </Line>
          </Canvas>
        ) : null}
      </View>
      {dense ? (
        <View style={{ height: 17, marginTop: spacing.sm }}>
          {width
            ? days.map((d, i) =>
                (last - i) % 7 === 0 ? (
                  <AppText
                    key={d.key}
                    variant="caption"
                    color={i === picked || (picked < 0 && i === last) ? 'text' : 'textMuted'}
                    align="center"
                    numberOfLines={1}
                    style={{
                      position: 'absolute',
                      width: LABEL_W,
                      left: Math.min(width - LABEL_W, Math.max(0, i * (barW + gap) + barW / 2 - LABEL_W / 2)),
                    }}>
                    {labelFor(d, i)}
                  </AppText>
                ) : null,
              )
            : null}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap, marginTop: spacing.sm }}>
          {days.map((d, i) => (
            <AppText
              key={d.key}
              variant="caption"
              weight={i === picked ? 'bold' : undefined}
              color={i === picked || (picked < 0 && i === last) ? 'text' : 'textMuted'}
              align="center"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ flex: 1 }}>
              {labelFor(d, i)}
            </AppText>
          ))}
        </View>
      )}
      <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.sm }}>
        Dashed line: average daily budget, {formatINR(avgBudget, { decimals: 0 })}
      </AppText>
    </View>
  );
}

/** Category donut with small gaps between segments. */
export function Donut({
  data,
  size = 168,
  stroke = 22,
  centerLabel,
  centerValue,
}: {
  data: { category: Category; amount: number }[];
  size?: number;
  stroke?: number;
  centerLabel: string;
  centerValue: string;
}) {
  const { c, category } = useTheme();
  const total = data.reduce((s, d) => s + d.amount, 0);
  const r = (size - stroke) / 2;
  const rect = Skia.XYWHRect(stroke / 2, stroke / 2, size - stroke, size - stroke);
  const gapDeg = data.length > 1 ? 3 : 0;
  let angle = -90;
  const arcs = data.map((d) => {
    const sweep = total ? (d.amount / total) * 360 : 0;
    const path = Skia.PathBuilder.Make().addArc(rect, angle + gapDeg / 2, Math.max(0.1, sweep - gapDeg)).build();
    angle += sweep;
    return { path, color: category[d.category], key: d.category };
  });

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityLabel={`${centerLabel} ${centerValue}. ${data
        .map((d) => `${categoryMeta[d.category].label} ${Math.round((d.amount / (total || 1)) * 100)}%`)
        .join(', ')}`}>
      <Canvas style={{ position: 'absolute', width: size, height: size }}>
        {total === 0 ? (
          <Group>
            <Path
              path={Skia.Path.Circle(size / 2, size / 2, r)}
              style="stroke"
              strokeWidth={stroke}
              color={c.ringTrack}
            />
          </Group>
        ) : (
          arcs.map((a) => <Path key={a.key} path={a.path} style="stroke" strokeWidth={stroke} color={a.color} />)
        )}
      </Canvas>
      <AppText variant="caption" color="textMuted">
        {centerLabel}
      </AppText>
      <AppText variant="heading" tabular>
        {centerValue}
      </AppText>
    </View>
  );
}

/** 24 hourly bars; hours inside `highlight` use the warning colour. */
export function HourBars({ hours, highlight, height = 72 }: { hours: number[]; highlight?: { start: number; end: number } | null; height?: number }) {
  const { c } = useTheme();
  const [width, onLayout] = useWidth();
  const max = Math.max(...hours, 1);
  const gap = 3;
  const barW = width ? (width - gap * 23) / 24 : 0;
  const inWindow = (h: number) =>
    !!highlight && (highlight.start < highlight.end ? h >= highlight.start && h < highlight.end : h >= highlight.start || h < highlight.end);

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View onLayout={onLayout} style={{ height }}>
        {width ? (
          <Canvas style={{ width, height }}>
            {hours.map((v, h) => {
              const bh = Math.max(3, (v / max) * height);
              return (
                <RoundedRect
                  key={h}
                  x={h * (barW + gap)}
                  y={height - bh}
                  width={barW}
                  height={bh}
                  r={Math.min(3, barW / 2)}
                  color={v ? (inWindow(h) ? c.warning : c.accentGraphic) : c.ringTrack}
                />
              );
            })}
          </Canvas>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        {['12 AM', '6 AM', '12 PM', '6 PM', '11 PM'].map((l) => (
          <AppText key={l} variant="caption" color="textMuted">
            {l}
          </AppText>
        ))}
      </View>
    </View>
  );
}

/** Thin horizontal progress bar (budget vs spent). */
export function ProgressBar({ ratio, color, track }: { ratio: number; color: string; track: string }) {
  const pct = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 1;
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}
