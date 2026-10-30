import { Canvas, DashPathEffect, Group, Line, Path, RoundedRect, Skia, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { budgetState } from '@/features/budget/budget';
import { categoryMeta } from '@/lib/categories';
import { shortWeekday } from '@/lib/dates';
import { formatINR, spokenINR } from '@/lib/money';
import type { Category } from '@/lib/types';
import { useTheme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';

import { stateColor } from './budget-ring';
import { AppText } from './text';

function useWidth(initial = 0) {
  const [width, setWidth] = useState(initial);
  return [width, (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))] as const;
}

/** Daily spend bars against a dashed average-budget line. Bars take the budget-state colour. */
export function WeeklyBars({ days, height = 160 }: { days: { date: Date; spent: number; budget: number; ratio: number }[]; height?: number }) {
  const { c } = useTheme();
  const [width, onLayout] = useWidth();
  const avgBudget = days.reduce((s, d) => s + d.budget, 0) / Math.max(1, days.length);
  const max = Math.max(avgBudget * 1.15, ...days.map((d) => d.spent), 1);
  const gap = 10;
  const barW = width ? (width - gap * (days.length - 1)) / days.length : 0;
  const y = (v: number) => height - (v / max) * height;
  const summary = days
    .map((d) => `${shortWeekday(d.date)} ${spokenINR(d.spent)} of ${spokenINR(d.budget)}`)
    .join('; ');

  return (
    <View accessible accessibilityLabel={`Daily spend, last ${days.length} days. ${summary}`}>
      <View onLayout={onLayout} style={{ height }}>
        {width ? (
          <Canvas style={{ width, height }}>
            {days.map((d, i) => {
              const h = Math.max(4, height - y(d.spent));
              return (
                <RoundedRect
                  key={d.date.toISOString()}
                  x={i * (barW + gap)}
                  y={height - h}
                  width={barW}
                  height={h}
                  r={Math.min(8, barW / 2)}
                  color={d.spent ? stateColor(budgetState(d.ratio), c) : c.ringTrack}
                />
              );
            })}
            <Line p1={vec(0, y(avgBudget))} p2={vec(width, y(avgBudget))} color={c.textMuted} strokeWidth={1.5}>
              <DashPathEffect intervals={[5, 5]} />
            </Line>
          </Canvas>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap, marginTop: spacing.sm }}>
        {days.map((d, i) => (
          <AppText
            key={d.date.toISOString()}
            variant="caption"
            color={i === days.length - 1 ? 'text' : 'textMuted'}
            align="center"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ flex: 1 }}>
            {i === days.length - 1 ? 'Today' : shortWeekday(d.date)}
          </AppText>
        ))}
      </View>
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
