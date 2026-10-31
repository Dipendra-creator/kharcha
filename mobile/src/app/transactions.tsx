import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen, ScreenHeader } from '@/components/screen';
import { AppText } from '@/components/text';
import { TxnRow } from '@/components/txn-row';
import { Card, Chip, EmptyState, Segmented } from '@/components/ui';
import { useDbQuery, useNow } from '@/db/hooks';
import { searchTxns } from '@/db/transactions';
import { spendByDay } from '@/features/budget/refunds';
import { categoryMeta } from '@/lib/categories';
import { addDays, cycleFor, dayKey, formatDate, fromDayKey, startOfDay, type DayKey } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import type { Category, Txn } from '@/lib/types';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme';
import { CATEGORIES, fonts, radii, spacing } from '@/theme/tokens';

const LIMIT = 500;

type Period = 'cycle' | 'last' | '90d' | 'all';
type Kind = 'all' | 'spent' | 'received';

const isCategory = (v: unknown): v is Category => CATEGORIES.includes(v as Category);
const isPeriod = (v: unknown): v is Period => v === 'cycle' || v === 'last' || v === '90d' || v === 'all';

function periodRange(period: Period, now: Date, payday: number): { from?: number; to?: number } {
  const cycle = cycleFor(now, payday);
  if (period === 'cycle') return { from: cycle.start.getTime(), to: cycle.end.getTime() };
  if (period === 'last') {
    const last = cycleFor(addDays(cycle.start, -1), payday);
    return { from: last.start.getTime(), to: last.end.getTime() };
  }
  if (period === '90d') return { from: addDays(startOfDay(now), -89).getTime(), to: startOfDay(addDays(now, 1)).getTime() };
  return {};
}

type DayGroup = { key: DayKey; txns: Txn[]; spent: number };

function groupByDay(txns: Txn[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const t of txns) {
    const key = dayKey(t.occurredAt);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.txns.push(t);
    else groups.push({ key, txns: [t], spent: 0 });
  }
  for (const g of groups) g.spent = spendByDay(g.txns)[g.key] ?? 0;
  return groups;
}

/**
 * Every transaction, searchable. `?q=`, `?category=` and `?period=` preset the
 * filters (Insights opens it on a merchant or category).
 */
export default function TransactionsScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string; category?: string; period?: string }>();
  const payday = useApp((s) => s.profile.payday);
  const now = useNow();
  const [query, setQuery] = useState(params.q ?? '');
  const [category, setCategory] = useState<Category | null>(isCategory(params.category) ? params.category : null);
  const [kind, setKind] = useState<Kind>('all');
  const [period, setPeriod] = useState<Period>(isPeriod(params.period) ? params.period : 'cycle');

  const { from, to } = periodRange(period, now, payday);
  const txns = useDbQuery(
    () => searchTxns({ query, category, kind, from, to, limit: LIMIT }),
    [query, category, kind, from ?? null, to ?? null],
  );
  const days = groupByDay(txns);
  const spent = days.reduce((s, d) => s + d.spent, 0);
  const todayKey = dayKey(now);
  const yesterdayKey = dayKey(addDays(now, -1));
  // "Month" reads right when the cycle is the calendar month.
  const unit = payday === 1 ? 'month' : 'cycle';

  const dayTitle = (key: DayKey) => {
    if (key === todayKey) return 'Today';
    if (key === yesterdayKey) return 'Yesterday';
    const d = fromDayKey(key);
    return formatDate(d, { weekday: true, year: d.getFullYear() !== now.getFullYear() });
  };

  const filters = (
    <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -spacing.xl }}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
        {(
          [
            ['cycle', `This ${unit}`],
            ['last', `Last ${unit}`],
            ['90d', '90 days'],
            ['all', 'All time'],
          ] as const
        ).map(([value, label]) => (
          <Chip key={value} label={label} selected={period === value} onPress={() => setPeriod(value)} />
        ))}
      </ScrollView>
      <Segmented<Kind>
        options={[
          { value: 'all', label: 'All' },
          { value: 'spent', label: 'Spent' },
          { value: 'received', label: 'Received' },
        ]}
        value={kind}
        onChange={setKind}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -spacing.xl }}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
        <Chip label="All categories" selected={!category} onPress={() => setCategory(null)} />
        {CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            label={categoryMeta[cat].label}
            icon={categoryMeta[cat].icon}
            selected={category === cat}
            onPress={() => setCategory(category === cat ? null : cat)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Screen scroll={false} contentStyle={{ paddingBottom: 0 }}>
      <ScreenHeader
        title="Transactions"
        subtitle={`${txns.length}${txns.length === LIMIT ? '+' : ''} ${txns.length === 1 ? 'entry' : 'entries'} · ${formatINR(spent, { decimals: 0 })} spent`}
        close="back"
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: c.raised,
          borderRadius: radii.md,
          paddingHorizontal: spacing.lg,
          marginBottom: spacing.md,
        }}>
        <Ionicons name="search" size={18} color={c.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search merchant, note or amount"
          placeholderTextColor={c.textMuted}
          accessibilityLabel="Search transactions"
          returnKeyType="search"
          autoCorrect={false}
          style={{ flex: 1, minHeight: 48, color: c.text, fontFamily: fonts.medium, fontSize: 16 }}
        />
        {query ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={days}
        keyExtractor={(d) => d.key}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        style={{ marginHorizontal: -spacing.xl }}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}
        ListHeaderComponent={filters}
        ListEmptyComponent={
          <EmptyState icon="search-outline" title="Nothing found" body="Try another word, category or period." />
        }
        ListFooterComponent={
          txns.length === LIMIT ? (
            <AppText variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.lg }}>
              Showing the newest {LIMIT}. Narrow the search to see older ones.
            </AppText>
          ) : undefined
        }
        renderItem={({ item }) => (
          <View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginTop: spacing.xl,
                marginBottom: spacing.sm,
              }}>
              <AppText variant="micro" color="textMuted" accessibilityRole="header">
                {dayTitle(item.key)}
              </AppText>
              {item.spent ? (
                <AppText variant="caption" color="textMuted" tabular>
                  {formatINR(item.spent, { decimals: 0 })} spent
                </AppText>
              ) : null}
            </View>
            <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
              {item.txns.map((t) => (
                <TxnRow key={t.id} txn={t} onPress={() => router.push({ pathname: '/add', params: { id: t.id } })} />
              ))}
            </Card>
          </View>
        )}
      />
    </Screen>
  );
}
