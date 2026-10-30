import { BlurMask, Canvas, Group, Path, Skia, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { budgetState, type BudgetState } from '@/features/budget/budget';
import { useTheme } from '@/theme/theme';
import { motion } from '@/theme/tokens';

export function stateColor(state: BudgetState, c: { accentGraphic: string; warning: string; over: string }) {
  return state === 'over' ? c.over : state === 'warning' ? c.warning : c.accentGraphic;
}

/**
 * The hero ring: the arc is what's left of today's budget and drains clockwise
 * as spends come in. Colour moves calm → warning → over.
 */
export function BudgetRing({ ratio, size = 280, stroke = 18 }: { ratio: number; size?: number; stroke?: number }) {
  const { c, scheme } = useTheme();
  const reduced = useReducedMotion();
  const state = budgetState(ratio);
  const left = Number.isFinite(ratio) ? Math.min(1, Math.max(0, 1 - ratio)) : 0;
  const color = stateColor(state, c);

  const progress = useSharedValue(reduced ? left : 1);
  useEffect(() => {
    progress.set(reduced ? withTiming(left, { duration: 0 }) : withSpring(left, motion.springSoft));
  }, [left, progress, reduced]);

  // The canvas extends past `size` so the glow isn't clipped at its edges.
  const pad = 32;
  const r = (size - stroke) / 2 - 8;
  const center = size / 2 + pad;
  const path = Skia.Path.Circle(center, center, r);

  return (
    <Canvas
      style={{ width: size + pad * 2, height: size + pad * 2, margin: -pad }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Group transform={[{ rotate: -Math.PI / 2 }]} origin={vec(center, center)}>
        <Path path={path} style="stroke" strokeWidth={stroke} color={state === 'over' ? `${c.over}33` : c.ringTrack} />
        {scheme === 'dark' && state !== 'over' ? (
          <Path path={path} style="stroke" strokeWidth={stroke} strokeCap="round" color={color} start={0} end={progress} opacity={0.55}>
            <BlurMask blur={14} style="normal" />
          </Path>
        ) : null}
        <Path path={path} style="stroke" strokeWidth={stroke} strokeCap="round" color={color} start={0} end={progress} />
      </Group>
    </Canvas>
  );
}
