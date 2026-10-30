import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { Money } from '@/components/money';
import { Screen, ScreenHeader } from '@/components/screen';
import { AppText } from '@/components/text';
import { MerchantAvatar } from '@/components/txn-row';
import { Button, Card, EmptyState } from '@/components/ui';
import { useDbQuery } from '@/db/hooks';
import { saveRule } from '@/db/meta';
import { listReview, updateTxn } from '@/db/transactions';
import { categoryMeta, methodLabel } from '@/lib/categories';
import { formatDate, formatTime } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { spacing } from '@/theme/tokens';

/** Low-confidence parses (< 0.7). One tap confirms; corrections become merchant rules. */
export default function ReviewInbox() {
  const items = useDbQuery(() => listReview(), []);
  const reduced = useReducedMotion();

  return (
    <Screen>
      <ScreenHeader
        title="Review"
        subtitle={items.length ? `${items.length} to check — we weren't sure about these` : 'All caught up'}
        close="back"
      />
      {items.length === 0 ? (
        <EmptyState icon="checkmark-done" title="Inbox zero" body="Anything we can't read confidently from SMS or email will wait here for a quick check." />
      ) : (
        items.map((t) => (
          <Animated.View key={t.id} exiting={reduced ? undefined : FadeOut} layout={reduced ? undefined : LinearTransition} style={{ marginBottom: spacing.md }}>
            <Card>
              <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                <MerchantAvatar merchant={t.merchant} category={t.category} />
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight="semibold" numberOfLines={1}>
                    {t.merchant}
                  </AppText>
                  <AppText variant="caption" color="textMuted">
                    {categoryMeta[t.category].label} · {t.type === 'debit' ? 'Spent' : t.type === 'credit' ? 'Received' : 'Refund'}
                    {t.method ? ` · ${methodLabel[t.method]}` : ''}
                  </AppText>
                </View>
                <Money paise={t.amount} variant="heading" label="Amount" />
              </View>
              <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.md }}>
                {formatDate(new Date(t.occurredAt))}, {formatTime(t.occurredAt)} · from {t.source.toUpperCase()}
                {t.accountHint ? ` · ${t.accountHint}` : ''} · {Math.round(t.confidence * 100)}% sure
              </AppText>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
                <Button
                  title="Looks right"
                  size="sm"
                  icon="checkmark"
                  style={{ flex: 1 }}
                  onPress={() => {
                    updateTxn(t.id, { status: 'confirmed' });
                    saveRule({ pattern: t.merchant, merchant: t.merchant, category: t.category, type: t.type });
                    haptic.success();
                  }}
                />
                <Button
                  title="Edit"
                  size="sm"
                  variant="secondary"
                  onPress={() => router.push({ pathname: '/add', params: { id: t.id } })}
                />
                <Button
                  title="Not a spend"
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    updateTxn(t.id, { status: 'ignored' });
                    saveRule({ pattern: t.merchant, merchant: t.merchant, category: t.category, type: 'ignore' });
                  }}
                />
              </View>
            </Card>
          </Animated.View>
        ))
      )}
    </Screen>
  );
}
