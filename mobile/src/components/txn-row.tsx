import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { categoryMeta, methodLabel } from '@/lib/categories';
import { formatTime } from '@/lib/dates';
import { formatINR, spokenINR } from '@/lib/money';
import type { Category, Txn } from '@/lib/types';
import { useTheme, withAlpha } from '@/theme/theme';
import { radii, spacing } from '@/theme/tokens';

import { AppText } from './text';
import { PressableScale } from './ui';

/** Monogram on a category-tinted tile; falls back to the category icon. */
export function MerchantAvatar({ merchant, category, size = 44 }: { merchant?: string; category: Category; size?: number }) {
  const { category: cat } = useTheme();
  const fg = cat[category];
  const label = categoryMeta[category].label;
  const initials = merchant && merchant.toLowerCase() !== label.toLowerCase() ? monogram(merchant) : null;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: withAlpha(fg, 0.16),
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {initials ? (
        <AppText variant="heading" weight="extrabold" color={fg} style={{ fontSize: size * 0.4, lineHeight: size * 0.5 }}>
          {initials}
        </AppText>
      ) : (
        <Ionicons name={categoryMeta[category].icon} size={size * 0.46} color={fg} />
      )}
    </View>
  );
}

function monogram(name: string): string {
  const words = name.replace(/[^A-Za-z0-9ऀ-ॿ ]/g, '').split(/\s+/).filter(Boolean);
  if (!words.length) return '•';
  return words.length === 1 ? words[0][0].toUpperCase() : (words[0][0] + words[1][0]).toUpperCase();
}

export function TxnRow({ txn, onPress, showDate }: { txn: Txn; onPress?: () => void; showDate?: boolean }) {
  const { c } = useTheme();
  const incoming = txn.type !== 'debit';
  const sub = [
    categoryMeta[txn.category].label,
    showDate ? new Date(txn.occurredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null,
    formatTime(txn.occurredAt),
    txn.method ? methodLabel[txn.method] : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const amount = formatINR(incoming ? txn.amount : -txn.amount, { signed: incoming });
  const a11y = `${txn.merchant}, ${incoming ? 'received' : 'spent'} ${spokenINR(txn.amount)}, ${sub}${
    txn.status === 'review' ? ', needs review' : ''
  }${txn.excluded ? ', not counted in budget' : ''}`;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Opens the transaction to edit"
      onPress={onPress}
      scaleTo={0.985}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <MerchantAvatar merchant={txn.merchant} category={txn.category} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AppText variant="body" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {txn.merchant}
          </AppText>
          {txn.status === 'review' ? (
            <View style={{ backgroundColor: withAlpha(c.warning, 0.16), borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
              <AppText variant="micro" color="warning">
                Review
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {txn.excluded ? `${sub} · not counted` : sub}
        </AppText>
      </View>
      <AppText
        variant="body"
        weight="bold"
        tabular
        color={incoming ? 'safe' : txn.excluded ? 'textMuted' : 'text'}
        style={txn.excluded ? { textDecorationLine: 'line-through' } : undefined}>
        {amount}
      </AppText>
    </PressableScale>
  );
}

export function Skeleton({ width, height, radius = 8 }: { width: number | `${number}%`; height: number; radius?: number }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const o = useSharedValue(0.5);
  useEffect(() => {
    if (!reduced) o.set(withRepeat(withTiming(1, { duration: 750 }), -1, true));
  }, [o, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: o.get() }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: c.raised }, style]} />;
}

export function TxnSkeleton() {
  return (
    <View
      accessibilityLabel="Loading transactions"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <Skeleton width={44} height={44} radius={14} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="35%" height={11} />
      </View>
      <Skeleton width={64} height={16} />
    </View>
  );
}
