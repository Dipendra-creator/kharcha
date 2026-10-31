import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BudgetRing } from '@/components/budget-ring';
import { AnimatedMoney, Money } from '@/components/money';
import { Screen } from '@/components/screen';
import { AppText } from '@/components/text';
import { TxnRow, TxnSkeleton } from '@/components/txn-row';
import { Card, EmptyState, PressableScale, SectionTitle } from '@/components/ui';
import { useCycleBudget, useDbQuery, useNow } from '@/db/hooks';
import { countReview, listDay } from '@/db/transactions';
import { budgetState } from '@/features/budget/budget';
import { syncNow, useSyncStatus, type SyncSummary } from '@/features/sync/sync';
import { formatDate, formatHour, relativeTime } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { formatINR } from '@/lib/money';
import { useApp } from '@/store/app-store';
import { useTheme, withAlpha } from '@/theme/theme';
import { radii, spacing, TAB_BAR_HEIGHT } from '@/theme/tokens';

export default function TodayScreen() {
  const { c } = useTheme();
  const now = useNow();
  const budget = useCycleBudget();
  const { today } = budget;
  const txns = useDbQuery(() => listDay(today.key), [today.key]);
  const reviewCount = useDbQuery(() => countReview(), []);
  const running = useSyncStatus((s) => s.running);
  const lastSyncAt = useApp((s) => s.sync.lastSyncAt);
  const name = useApp((s) => s.profile.name);
  const { reportHour, reportMinute } = useApp((s) => s.settings);
  const reduced = useReducedMotion();

  const state = budgetState(today.ratio);
  const over = today.remaining < 0;
  const reportReady = now.getHours() * 60 + now.getMinutes() >= reportHour * 60 + reportMinute;
  const daysLeft = budget.days.length - budget.todayIndex;
  const cycleLeft = budget.available - budget.spentToDate;

  // Haptic buzz the moment a spend tips today over budget.
  const prev = useRef(today.remaining);
  useEffect(() => {
    if (prev.current >= 0 && today.remaining < 0) haptic.overspend();
    prev.current = today.remaining;
  }, [today.remaining]);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen
      tabs
      refreshing={running}
      onRefresh={() => syncNow()}
      overlay={<AddButton />}
      contentStyle={{ paddingBottom: TAB_BAR_HEIGHT + 120 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <AppText variant="caption" color="textMuted">
            {formatDate(now, { weekday: true })}
          </AppText>
          <AppText variant="heading">{name ? `${greeting}, ${name}` : greeting}</AppText>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Sync now. ${lastSyncAt ? `Last synced ${relativeTime(lastSyncAt, now.getTime())}` : 'Never synced'}`}
          onPress={() => {
            haptic.tap();
            syncNow();
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            height: 40,
            paddingHorizontal: spacing.md,
            borderRadius: radii.pill,
            backgroundColor: c.raised,
          }}>
          <Ionicons name={running ? 'sync' : 'sync-outline'} size={16} color={c.text} />
          <AppText variant="caption" color="textMuted" numberOfLines={1} style={{ flexShrink: 0 }}>
            {running ? 'Syncing…' : lastSyncAt ? relativeTime(lastSyncAt, now.getTime()) : 'Sync'}
          </AppText>
        </PressableScale>
      </View>

      <SyncResult />

      {/* Hero */}
      <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
        <BudgetRing ratio={today.ratio} size={292} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <AppText variant="micro" color={over ? 'over' : 'textMuted'}>
            {over ? 'Over budget' : 'Left today'}
          </AppText>
          <AnimatedMoney
            paise={Math.abs(today.remaining)}
            fitWidth={212}
            variant="hero"
            decimals={0}
            color={over ? 'over' : 'text'}
            label={over ? 'Over budget by' : 'Left to spend today'}
          />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <AppText variant="caption" color="textMuted">
              of
            </AppText>
            <Money paise={today.budget} variant="caption" color="textMuted" decimals={0} label="Today's budget" />
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
        <Stat label="Spent today" value={<Money paise={today.spent} variant="heading" decimals={0} label="Spent today" />} />
        <Stat
          label="Left this cycle"
          value={
            <Money
              paise={cycleLeft}
              variant="heading"
              compact
              decimals={0}
              color={cycleLeft < 0 ? 'over' : 'text'}
              label="Left this cycle"
            />
          }
        />
        <Stat label="Days left" value={<AppText variant="heading" tabular>{daysLeft}</AppText>} />
      </View>

      {reviewCount > 0 ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${reviewCount} transactions need review`}
          onPress={() => router.push('/review')}
          style={{
            marginTop: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: radii.lg,
            backgroundColor: withAlpha(c.warning, 0.12),
          }}>
          <Ionicons name="alert-circle" size={22} color={c.warning} />
          <AppText variant="label" style={{ flex: 1 }}>
            {reviewCount} {reviewCount === 1 ? 'spend needs' : 'spends need'} a quick check
          </AppText>
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        </PressableScale>
      ) : null}

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={reportReady ? "Open tonight's report" : `Preview tonight's report, due at ${formatHour(reportHour, reportMinute)}`}
        onPress={() => router.push(`/report/${today.key}`)}
        style={{ marginTop: spacing.lg }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: withAlpha(c.accentGraphic, 0.16),
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="moon" size={20} color={c.accentGraphic} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="semibold">
              {reportReady ? "Tonight's report is ready" : 'Nightly report'}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {reportReady ? 'Budget vs spent, and an honest verdict' : `Arrives at ${formatHour(reportHour, reportMinute)} · tap to preview`}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
        </Card>
      </PressableScale>

      <SectionTitle title={`Today · ${txns.length} ${txns.length === 1 ? 'entry' : 'entries'}`} />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
        {running && txns.length === 0 ? (
          <>
            <TxnSkeleton />
            <TxnSkeleton />
            <TxnSkeleton />
          </>
        ) : txns.length === 0 ? (
          <EmptyState
            icon="leaf-outline"
            title="No kharcha yet"
            body={`Your full ${formatINR(today.budget, { decimals: 0 })} is waiting. Spends from SMS and email land here after a sync; add cash with +.`}
          />
        ) : (
          txns.map((t) => (
            <Animated.View
              key={t.id}
              entering={reduced ? undefined : FadeInDown.springify().damping(18)}
              layout={reduced ? undefined : LinearTransition.springify().damping(20)}>
              <TxnRow txn={t} onPress={() => router.push({ pathname: '/add', params: { id: t.id } })} />
            </Animated.View>
          ))
        )}
      </Card>
      <AppText variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.lg }}>
        {state === 'over'
          ? 'Over budget — tomorrow adjusts automatically.'
          : `Base daily budget ${formatINR(budget.base, { decimals: 0 })} before rollover`}
      </AppText>
    </Screen>
  );
}

/** Brief "+3 new · 1 to review" line after a sync finishes. */
function SyncResult() {
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useSyncStatus.subscribe((s, prev) => {
      if (!s.last || s.last === prev.last) return;
      setSummary(s.last);
      clearTimeout(timer);
      timer = setTimeout(() => setSummary(null), 6000);
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);
  if (!summary) return null;
  const added = summary.smsAdded + summary.pulled;
  const text = summary.errors.length
    ? summary.errors[0]
    : added
      ? `+${added} new${summary.review ? ` · ${summary.review} to review` : ''}`
      : 'All caught up';
  return (
    <Animated.View entering={FadeInDown} accessibilityLiveRegion="polite" style={{ marginTop: spacing.sm }}>
      <AppText variant="caption" color={summary.errors.length ? 'warning' : 'textMuted'} numberOfLines={2}>
        {text}
      </AppText>
    </Animated.View>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card style={{ flex: 1, paddingVertical: spacing.lg, paddingHorizontal: spacing.md, gap: 4 }}>
      <AppText variant="caption" color="textMuted" numberOfLines={1}>
        {label}
      </AppText>
      {value}
    </Card>
  );
}

function AddButton() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: spacing.xl,
        bottom: TAB_BAR_HEIGHT + Math.max(insets.bottom, spacing.md) + spacing.lg,
      }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a spend"
        onPress={() => {
          haptic.tap();
          router.push('/add');
        }}
        style={({ pressed }) => ({
          width: 62,
          height: 62,
          borderRadius: 31,
          backgroundColor: c.accent,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pressed ? 0.94 : 1 }],
          shadowColor: c.accent,
          shadowOpacity: 0.45,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        })}>
        <Ionicons name="add" size={30} color={c.onAccent} />
      </Pressable>
    </View>
  );
}
