import Ionicons from '@expo/vector-icons/Ionicons';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { stateColor } from '@/components/budget-ring';
import { ProgressBar } from '@/components/charts';
import { Money } from '@/components/money';
import { StatusBarScrim } from '@/components/screen';
import { AppText } from '@/components/text';
import { MerchantAvatar } from '@/components/txn-row';
import { Button, IconButton } from '@/components/ui';
import { useBudgetInput, useDbQuery, useNow } from '@/db/hooks';
import { getSummary, saveSummary } from '@/db/meta';
import { listDay, spentByDay } from '@/db/transactions';
import { computeCycleBudget } from '@/features/budget/budget';
import { buildReport } from '@/features/report/report';
import { SHARE_HEIGHT, SHARE_WIDTH, ShareCard } from '@/features/report/share-card';
import { useAiVerdict } from '@/features/roast/use-ai-verdict';
import { categoryMeta } from '@/lib/categories';
import { addDays, cycleFor, dayKey, formatDate, fromDayKey } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useApp } from '@/store/app-store';
import { useTheme, withAlpha } from '@/theme/theme';
import { radii, spacing } from '@/theme/tokens';

export default function ReportScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { date } = useLocalSearchParams<{ date: string }>();
  const key = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date! : dayKey(new Date());
  const now = useNow();
  const input = useBudgetInput();
  const { roast, reportHour, reportMinute, rollover } = useApp((s) => s.settings);
  const shareRef = useRef<ComponentRef<typeof View>>(null);
  const [sharing, setSharing] = useState(false);

  const data = useDbQuery(() => {
    const day = fromDayKey(key);
    const from = cycleFor(day, input.payday).start;
    const to = cycleFor(addDays(day, 1), input.payday).end;
    return { spent: spentByDay(from.getTime(), to.getTime()), txns: listDay(key), saved: getSummary(key) };
  }, [key, input.payday]);

  const day = fromDayKey(key);
  const cb = computeCycleBudget(input, data.spent, day);
  const tomorrow = computeCycleBudget(input, data.spent, addDays(day, 1));
  const savedValid = data.saved && Math.round(data.saved.spent) === Math.round(cb.today.spent) ? data.saved : null;

  const ruleReport = buildReport({
    day: cb.today,
    txns: data.txns,
    intensity: roast,
    tomorrowBudget: tomorrow.today.budget,
    rollover,
    savedVerdict: savedValid?.verdict,
  });
  const ai = useAiVerdict(ruleReport, !savedValid || savedValid.verdictSource === 'rules');
  const report = ai ? { ...ruleReport, verdict: ai } : ruleReport;

  // Lock in the day's verdict once the report time has passed (or for past days).
  const isPast = key < dayKey(now);
  const due = isPast || now.getHours() * 60 + now.getMinutes() >= reportHour * 60 + reportMinute;
  const verdictSource = ai ? 'llm' : (savedValid?.verdictSource ?? 'rules');
  useEffect(() => {
    if (!due) return;
    if (data.saved?.verdict === report.verdict && data.saved.verdictSource === verdictSource) return;
    saveSummary({ date: key, budget: report.budget, spent: report.spent, verdict: report.verdict, verdictSource });
  }, [due, key, report.verdict, report.budget, report.spent, verdictSource, data.saved]);

  const accent = stateColor(report.state, c);
  const diff = report.budget - report.spent;

  const share = async () => {
    if (!shareRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(shareRef, { format: 'png', quality: 1, width: 1080, height: 1920, result: 'tmpfile' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your verdict', UTI: 'public.png' });
      }
    } finally {
      setSharing(false);
    }
  };

  const enter = (i: number) => (reduced ? undefined : FadeInDown.delay(80 * i).springify().damping(18));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LinearGradient
        colors={[withAlpha(accent, 0.28), withAlpha(c.bg, 0)]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 420 }}
      />
      {/* Off-screen story card used only for the shared image. */}
      <View style={{ position: 'absolute', left: -10_000, top: 0 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ width: SHARE_WIDTH, height: SHARE_HEIGHT }}>
          <ShareCard ref={shareRef} report={report} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xxxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton icon="close" label="Close report" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <AppText variant="label" color="textMuted">
            {formatDate(day, { weekday: true })}
          </AppText>
          <IconButton icon="share-outline" label="Share report as image" onPress={share} />
        </View>

        <Animated.View entering={enter(0)} style={{ marginTop: spacing.xxxl }}>
          <AppText variant="micro" color="textMuted">
            Aaj ka verdict
          </AppText>
          <AppText variant="display" style={{ marginTop: spacing.md }} accessibilityRole="header">
            “{report.verdict}”
          </AppText>
        </Animated.View>

        <Animated.View entering={enter(1)} style={{ marginTop: spacing.xxxl, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View>
              <AppText variant="caption" color="textMuted">
                Spent
              </AppText>
              <Money paise={report.spent} variant="display" decimals={0} label="Spent today" />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="caption" color="textMuted">
                Budget
              </AppText>
              <Money paise={report.budget} variant="heading" decimals={0} color="textMuted" label="Budget" />
            </View>
          </View>
          <ProgressBar ratio={report.ratio} color={accent} track={c.ringTrack} />
          <AppText variant="label" color={diff < 0 ? 'over' : 'safe'}>
            {diff < 0 ? `${formatINR(-diff, { decimals: 0 })} over budget` : `${formatINR(diff, { decimals: 0 })} under budget`}
          </AppText>
        </Animated.View>

        <Animated.View entering={enter(2)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xxl }}>
          <Tile
            label="Top category"
            value={report.topCategory ? categoryMeta[report.topCategory.category].label : '—'}
            detail={report.topCategory ? formatINR(report.topCategory.amount, { decimals: 0 }) : 'No spends'}
            icon={report.topCategory ? <MerchantAvatar category={report.topCategory.category} size={36} /> : null}
          />
          <Tile
            label="Biggest spend"
            value={report.biggest ? formatINR(report.biggest.amount, { decimals: 0 }) : '—'}
            detail={report.biggest?.merchant ?? 'Nothing big today'}
            icon={report.biggest ? <MerchantAvatar merchant={report.biggest.merchant} category={report.biggest.category} size={36} /> : null}
          />
          <Tile
            label="Delivery orders"
            value={`${report.quickOrders} ${report.quickOrders === 1 ? 'order' : 'orders'}`}
            detail="Food & quick-commerce"
            icon={<IconTile name="bicycle" color={c.safe} />}
          />
          <Tile
            label="Spends logged"
            value={String(report.spendCount)}
            detail={report.spendCount ? 'SMS, email & manual' : 'Add cash with +'}
            icon={<IconTile name="receipt" color={c.textMuted} />}
          />
        </Animated.View>

        <Animated.View
          entering={enter(3)}
          style={{
            marginTop: spacing.xxl,
            padding: spacing.xl,
            borderRadius: radii.lg,
            backgroundColor: withAlpha(c.accentGraphic, 0.12),
            flexDirection: 'row',
            gap: spacing.md,
          }}>
          <Ionicons name="bulb" size={22} color={c.accentGraphic} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="label">Kal ke liye</AppText>
            <AppText variant="bodyRegular">{report.suggestion}</AppText>
          </View>
        </Animated.View>

        <Button title="Share to story" icon="logo-instagram" onPress={share} loading={sharing} style={{ marginTop: spacing.xxl }} />
      </ScrollView>
      <StatusBarScrim />
    </View>
  );
}

function IconTile({ name, color }: { name: keyof typeof Ionicons.glyphMap; color: string }) {
  const { c } = useTheme();
  return (
    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={18} color={color} />
    </View>
  );
}

function Tile({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  const { c, scheme } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}. ${detail}`}
      style={{
        width: '48.5%',
        flexGrow: 1,
        padding: spacing.lg,
        gap: spacing.sm,
        borderRadius: radii.lg,
        backgroundColor: c.surface,
        borderWidth: scheme === 'dark' ? 1 : 0,
        borderColor: c.border,
      }}>
      {icon}
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <AppText variant="heading" tabular numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="caption" color="textMuted" numberOfLines={1}>
        {detail}
      </AppText>
    </View>
  );
}
