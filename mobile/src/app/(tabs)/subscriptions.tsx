import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Money } from '@/components/money';
import { Screen } from '@/components/screen';
import { AppText } from '@/components/text';
import { MerchantAvatar } from '@/components/txn-row';
import { Card, EmptyState, IconButton, SectionTitle } from '@/components/ui';
import { useDbQuery } from '@/db/hooks';
import { listSubscriptions, setSubscriptionDismissed, type StoredSubscription } from '@/db/meta';
import { refreshSubscriptions } from '@/features/sync/sync';
import { diffDays, formatDate, startOfDay } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme, withAlpha } from '@/theme/theme';
import { radii, spacing } from '@/theme/tokens';

const CYCLE_LABEL = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' } as const;

export default function SubscriptionsScreen() {
  const [showHidden, setShowHidden] = useState(false);
  useFocusEffect(
    useCallback(() => {
      refreshSubscriptions();
    }, []),
  );
  const all = useDbQuery(() => listSubscriptions(), []);
  const active = all.filter((s) => !s.dismissed);
  const hidden = all.filter((s) => s.dismissed);
  const monthly = active.reduce((sum, s) => sum + s.monthlyCost, 0);

  return (
    <Screen tabs>
      <AppText variant="title" accessibilityRole="header">
        Subscriptions
      </AppText>
      <AppText variant="caption" color="textMuted">
        Recurring charges spotted in your spends
      </AppText>

      <Card style={{ marginTop: spacing.xl }}>
        <AppText variant="caption" color="textMuted">
          Every month
        </AppText>
        <Money paise={monthly} variant="display" decimals={0} label="Monthly subscriptions total" />
        <AppText variant="caption" color="textMuted">
          {active.length} {active.length === 1 ? 'subscription' : 'subscriptions'} · {formatINR(monthly * 12, { compact: true, decimals: 0 })} a year
        </AppText>
      </Card>

      <SectionTitle title="Upcoming renewals" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
        {active.length === 0 ? (
          <EmptyState
            icon="repeat-outline"
            title="None detected yet"
            body="When the same merchant charges about the same amount every month, it shows up here with its next renewal date."
          />
        ) : (
          active.map((s, i) => <SubRow key={s.merchant} sub={s} last={i === active.length - 1} />)
        )}
      </Card>

      {hidden.length ? (
        <>
          <SectionTitle
            title={`Hidden · ${hidden.length}`}
            action={{ label: showHidden ? 'Collapse' : 'Show', onPress: () => setShowHidden((v) => !v) }}
          />
          {showHidden ? (
            <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
              {hidden.map((s, i) => (
                <SubRow key={s.merchant} sub={s} last={i === hidden.length - 1} />
              ))}
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function SubRow({ sub, last }: { sub: StoredSubscription; last: boolean }) {
  const { c } = useTheme();
  const days = diffDays(startOfDay(new Date()), startOfDay(new Date(sub.nextDate)));
  const when = days < 0 ? 'Renewal overdue' : days === 0 ? 'Renews today' : days === 1 ? 'Renews tomorrow' : days <= 7 ? `Renews in ${days} days` : `Renews ${formatDate(new Date(sub.nextDate))}`;
  const soon = days >= 0 && days <= 3;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border,
        opacity: sub.dismissed ? 0.6 : 1,
      }}>
      <MerchantAvatar merchant={sub.merchant} category={sub.category} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <AppText variant="body" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
            {sub.merchant}
          </AppText>
          {sub.confidence === 'likely' ? (
            <View style={{ backgroundColor: c.raised, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
              <AppText variant="micro" color="textMuted">
                Likely
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="caption" color={soon ? 'warning' : 'textMuted'}>
          {CYCLE_LABEL[sub.cycle]} · {when}
        </AppText>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Money paise={sub.amount} variant="body" />
        {sub.cycle !== 'monthly' ? (
          <AppText variant="caption" color="textMuted">
            {formatINR(sub.monthlyCost, { decimals: 0 })}/mo
          </AppText>
        ) : null}
      </View>
      {sub.dismissed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Restore ${sub.merchant}`}
          onPress={() => setSubscriptionDismissed(sub.merchant, false)}
          hitSlop={8}
          style={{ paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: withAlpha(c.accentGraphic, 0.14) }}>
          <AppText variant="caption" color="accentGraphic">
            Restore
          </AppText>
        </Pressable>
      ) : (
        <IconButton icon="eye-off-outline" label={`${sub.merchant} is not a subscription, hide it`} tone="plain" size={36} onPress={() => setSubscriptionDismissed(sub.merchant, true)} />
      )}
    </View>
  );
}
