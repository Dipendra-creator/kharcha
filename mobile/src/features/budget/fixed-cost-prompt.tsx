import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/text';
import { Button, Card } from '@/components/ui';
import { useDbQuery } from '@/db/hooks';
import { listBetween } from '@/db/transactions';
import type { IconName } from '@/lib/categories';
import { addDays, dayKey, formatDate, startOfDay } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useApp, type FixedCostKind } from '@/store/app-store';
import { useTheme, withAlpha } from '@/theme/theme';
import { spacing } from '@/theme/tokens';

import { confirmFixedCost } from './fixed-cost-actions';
import { matchFixedCosts } from './fixed-costs';

const DAY = 86_400_000;

const ICON: Record<FixedCostKind, IconName> = {
  rent: 'home-outline',
  emi: 'card-outline',
  sip: 'trending-up-outline',
  insurance: 'shield-checkmark-outline',
  other: 'wallet-outline',
};

/** Asks about the newest payment that looks like a fixed cost, so it isn't counted twice. */
export function FixedCostPrompt({ now }: { now: Date }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const costs = useApp((s) => s.profile.fixedCosts);
  const dismissed = useApp((s) => s.fixedCostDismissed);
  const dismiss = useApp((s) => s.dismissFixedCost);
  const recent = useDbQuery(() => {
    const end = startOfDay(addDays(now, 1)).getTime();
    return listBetween(end - 35 * DAY, end);
  }, [dayKey(now)]);

  const match = costs.length ? matchFixedCosts(recent, costs, dismissed).ask[0] : undefined;
  if (!match) return null;
  const { txn, cost } = match;

  return (
    <Animated.View key={txn.id} entering={reduced ? undefined : FadeInDown} exiting={reduced ? undefined : FadeOut} style={{ marginTop: spacing.lg }}>
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: withAlpha(c.accentGraphic, 0.16),
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name={ICON[cost.kind]} size={20} color={c.accentGraphic} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="semibold">
              Is this your {cost.label}?
            </AppText>
            <AppText variant="caption" color="textMuted" numberOfLines={2}>
              {formatINR(txn.amount, { decimals: 0 })} to {txn.merchant} on {formatDate(new Date(txn.occurredAt))}
            </AppText>
          </View>
        </View>
        <AppText variant="caption" color="textMuted">
          Your {formatINR(cost.amount, { decimals: 0 })} {cost.label.toLowerCase()} is already taken out of your daily budget, so counting this
          payment too would charge it twice.
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Yes, don't count it" size="sm" style={{ flex: 1 }} onPress={() => confirmFixedCost(txn, cost)} />
          <Button title="No" size="sm" variant="secondary" onPress={() => dismiss(txn.id)} />
        </View>
      </Card>
    </Animated.View>
  );
}
