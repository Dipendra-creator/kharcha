import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { Keypad } from '@/components/keypad';
import { ScreenHeader } from '@/components/screen';
import { AppText } from '@/components/text';
import { Button, Chip, Row, Segmented } from '@/components/ui';
import { saveRule } from '@/db/meta';
import { deleteTxn, getTxn, insertTxn, updateTxn } from '@/db/transactions';
import { categoryMeta, methodLabel } from '@/lib/categories';
import { addDays, dayKey, formatDate, formatTime, fromDayKey, type DayKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { formatINR, groupIndian, parseAmount } from '@/lib/money';
import type { Category, PaymentMethod, TxnType } from '@/lib/types';
import { useTheme } from '@/theme/theme';
import { CATEGORIES, fonts, radii, spacing } from '@/theme/tokens';

const METHODS: PaymentMethod[] = ['cash', 'upi', 'card', 'wallet', 'netbanking'];

/**
 * Manual entry sheet; with `?id=` it edits (or confirms) an existing transaction.
 * `?date=YYYY-MM-DD` (from a past day in Insights) logs the new spend on that day.
 */
export default function AddSheet() {
  const { c } = useTheme();
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>();
  const [existing] = useState(() => (id ? getTxn(id) : null));
  const [todayKey] = useState(() => dayKey(new Date()));
  const yesterdayKey = dayKey(addDays(fromDayKey(todayKey), -1));
  const [pastDay] = useState(() => (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < yesterdayKey ? date : null));

  const [amount, setAmount] = useState(() => (existing ? (existing.amount / 100).toString() : ''));
  const [type, setType] = useState<TxnType>(existing?.type ?? 'debit');
  const [category, setCategory] = useState<Category>(existing?.category ?? 'food');
  const [merchant, setMerchant] = useState(existing?.merchant ?? '');
  const [method, setMethod] = useState<PaymentMethod>(existing?.method ?? 'cash');
  const [when, setWhen] = useState<DayKey>(() => (date === yesterdayKey ? yesterdayKey : (pastDay ?? todayKey)));
  const [excluded, setExcluded] = useState(existing?.excluded ?? false);

  const paise = parseAmount(amount || '0') ?? 0;
  const [int, dec] = amount.split('.');
  const shown = `${groupIndian(int || '0')}${dec !== undefined ? `.${dec}` : ''}`;
  const isReview = existing?.status === 'review';

  const save = () => {
    if (paise <= 0) return;
    const name = merchant.trim() || categoryMeta[category].label;
    if (existing) {
      const corrected = existing.merchant !== name || existing.category !== category || existing.type !== type;
      updateTxn(existing.id, {
        amount: paise,
        type,
        category,
        merchant: name,
        method,
        excluded,
        status: existing.status === 'ignored' ? 'ignored' : 'confirmed',
      });
      // Corrections to parsed rows teach the next sync.
      if (existing.source !== 'manual' && (corrected || isReview)) {
        saveRule({ pattern: existing.merchant, merchant: name, category, type });
      }
    } else {
      // Past days keep the current time of day, as "Yesterday" always has.
      const now = new Date();
      const day = fromDayKey(when);
      const occurredAt =
        when === dayKey(now) ? now : new Date(day.getFullYear(), day.getMonth(), day.getDate(), now.getHours(), now.getMinutes());
      insertTxn({
        amount: paise,
        type,
        category,
        merchant: name,
        method,
        source: 'manual',
        occurredAt: occurredAt.getTime(),
        excluded,
      });
    }
    haptic.success();
    router.back();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.surface }}
      contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.huge }}
      keyboardShouldPersistTaps="handled">
      <ScreenHeader
        title={existing ? (isReview ? 'Check this spend' : 'Edit entry') : 'Add expense'}
        subtitle={
          existing
            ? `${existing.dedupeGroup ? 'From SMS + email receipt' : existing.source === 'manual' ? 'Added manually' : `From ${existing.source.toUpperCase()}`} · ${formatDate(new Date(existing.occurredAt))}, ${formatTime(existing.occurredAt)}`
            : undefined
        }
        close="close"
      />

      <Segmented
        options={[
          { value: 'debit', label: 'Spent' },
          { value: 'credit', label: 'Received' },
          { value: 'refund', label: 'Refund' },
        ]}
        value={type}
        onChange={setType}
      />

      <View
        accessible
        accessibilityLabel={`Amount ${formatINR(paise)}`}
        style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginVertical: spacing.xxl }}>
        <AppText variant="display" color="textMuted" style={{ marginRight: 4 }}>
          ₹
        </AppText>
        <AppText variant="hero" tabular color={amount ? 'text' : 'textMuted'} numberOfLines={1} adjustsFontSizeToFit>
          {shown}
        </AppText>
      </View>

      <Keypad value={amount} onChange={setAmount} />

      {existing?.items?.length || existing?.orderId || existing?.accountHint ? (
        <View style={{ marginTop: spacing.xxl, padding: spacing.lg, borderRadius: radii.md, backgroundColor: c.raised, gap: spacing.xs }}>
          {existing.items?.length ? (
            <>
              <AppText variant="micro" color="textMuted">
                Items
              </AppText>
              {existing.items.map((item) => (
                <AppText key={item} variant="caption">
                  • {item}
                </AppText>
              ))}
            </>
          ) : null}
          {existing.orderId ? (
            <AppText variant="caption" color="textMuted">
              Order {existing.orderId}
            </AppText>
          ) : null}
          {existing.accountHint ? (
            <AppText variant="caption" color="textMuted">
              {existing.accountHint}
              {existing.upiRef ? ` · UPI ref ${existing.upiRef}` : ''}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <AppText variant="micro" color="textMuted" style={{ marginTop: spacing.xxl, marginBottom: spacing.md }}>
        Category
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            label={categoryMeta[cat].label}
            icon={categoryMeta[cat].icon}
            selected={category === cat}
            onPress={() => setCategory(cat)}
          />
        ))}
      </View>

      <AppText variant="micro" color="textMuted" style={{ marginTop: spacing.xxl, marginBottom: spacing.md }}>
        Where
      </AppText>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: c.raised,
          borderRadius: radii.md,
          paddingHorizontal: spacing.lg,
        }}>
        <Ionicons name="storefront-outline" size={18} color={c.textMuted} />
        <TextInput
          value={merchant}
          onChangeText={setMerchant}
          placeholder={`e.g. Chai tapri (defaults to ${categoryMeta[category].label})`}
          placeholderTextColor={c.textMuted}
          accessibilityLabel="Merchant or note"
          returnKeyType="done"
          style={{ flex: 1, minHeight: 52, color: c.text, fontFamily: fonts.medium, fontSize: 16 }}
        />
      </View>

      <AppText variant="micro" color="textMuted" style={{ marginTop: spacing.xxl, marginBottom: spacing.md }}>
        Paid with
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {METHODS.map((m) => (
          <Chip key={m} label={methodLabel[m]} selected={method === m} onPress={() => setMethod(m)} />
        ))}
      </View>

      {!existing ? (
        <>
          <AppText variant="micro" color="textMuted" style={{ marginTop: spacing.xxl, marginBottom: spacing.md }}>
            When
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Chip label="Today" selected={when === todayKey} onPress={() => setWhen(todayKey)} />
            <Chip label="Yesterday" selected={when === yesterdayKey} onPress={() => setWhen(yesterdayKey)} />
            {pastDay ? (
              <Chip
                label={formatDate(fromDayKey(pastDay), { weekday: true })}
                icon="calendar-outline"
                selected={when === pastDay}
                onPress={() => setWhen(pastDay)}
              />
            ) : null}
          </View>
        </>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <Row
          title="Don't count in daily budget"
          subtitle="For rent, EMI or transfers to your own accounts"
          toggle={{ value: excluded, onChange: setExcluded }}
          last
        />
      </View>

      <Button
        title={isReview ? 'Confirm' : existing ? 'Save changes' : 'Add expense'}
        onPress={save}
        disabled={paise <= 0}
        style={{ marginTop: spacing.xl }}
      />
      {existing ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          {existing.source !== 'manual' ? (
            <Button
              title="Not a spend"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                updateTxn(existing.id, { status: 'ignored' });
                saveRule({ pattern: existing.merchant, merchant: existing.merchant, category: existing.category, type: 'ignore' });
                router.back();
              }}
            />
          ) : null}
          <Button
            title="Delete"
            variant="danger"
            icon="trash-outline"
            style={{ flex: 1 }}
            onPress={() => {
              deleteTxn(existing.id);
              haptic.warning();
              router.back();
            }}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}
