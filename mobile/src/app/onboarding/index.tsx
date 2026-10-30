import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BudgetRing } from '@/components/budget-ring';
import { AppText } from '@/components/text';
import { MerchantAvatar } from '@/components/txn-row';
import { Button, Card } from '@/components/ui';
import type { Category } from '@/lib/types';
import { useTheme } from '@/theme/theme';
import { radii, spacing } from '@/theme/tokens';

const SLIDES = [
  {
    title: 'Salary → a daily number',
    body: 'Kharcha turns your monthly in-hand salary, minus rent, EMIs and SIPs, into one budget for today.',
  },
  {
    title: 'Every spend, auto-deducted',
    body: 'Bank SMS alerts and order emails are read and deducted as you spend. Cash? Add it in two taps.',
  },
  {
    title: '10 PM. Seedha verdict.',
    body: 'Every night: budget vs spent, your biggest splurge, and an honest (slightly rude) verdict.',
  },
];

const SAMPLE: { merchant: string; category: Category; amount: string; time: string }[] = [
  { merchant: 'Blinkit', category: 'groceries', amount: '−₹600', time: '9:12 PM' },
  { merchant: 'Swiggy', category: 'food', amount: '−₹500', time: '1:40 PM' },
  { merchant: 'Third Wave Coffee', category: 'food', amount: '−₹250', time: '10:05 AM' },
];

export default function Intro() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const last = page === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
        <AppText variant="heading" weight="extrabold">
          kharcha<AppText variant="heading" weight="extrabold" color="accentGraphic">.</AppText>
        </AppText>
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {SLIDES.map((s, i) => (
          <View key={s.title} style={{ width, paddingHorizontal: spacing.xl, justifyContent: 'center' }}>
            <View style={{ height: 320, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {i === 0 ? <RingVisual /> : i === 1 ? <TimelineVisual /> : <VerdictVisual />}
            </View>
            <AppText variant="display" style={{ marginTop: spacing.xxl }} accessibilityRole="header">
              {s.title}
            </AppText>
            <AppText variant="bodyRegular" color="textMuted" style={{ marginTop: spacing.md }}>
              {s.body}
            </AppText>
          </View>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.lg, gap: spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }} accessible accessibilityLabel={`Page ${page + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <View key={s.title} style={{ width: i === page ? 22 : 8, height: 8, borderRadius: radii.pill, backgroundColor: i === page ? c.accentGraphic : c.border }} />
          ))}
        </View>
        <Button
          title={last ? 'Set up my budget' : 'Next'}
          onPress={() => {
            if (last) router.push('/onboarding/salary');
            else scroller.current?.scrollTo({ x: (page + 1) * width, animated: true });
            if (!last) setPage(page + 1);
          }}
        />
      </View>
    </View>
  );
}

function RingVisual() {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <BudgetRing ratio={0.38} size={250} />
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <AppText variant="micro" color="textMuted">
          Left today
        </AppText>
        <AppText variant="display" tabular>
          ₹1,240
        </AppText>
        <AppText variant="caption" color="textMuted">
          of ₹2,000
        </AppText>
      </View>
    </View>
  );
}

function TimelineVisual() {
  return (
    <Card style={{ width: '100%', gap: spacing.md }}>
      {SAMPLE.map((t) => (
        <View key={t.merchant} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <MerchantAvatar merchant={t.merchant} category={t.category} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" weight="semibold">
              {t.merchant}
            </AppText>
            <AppText variant="caption" color="textMuted">
              via SMS · {t.time}
            </AppText>
          </View>
          <AppText variant="body" weight="bold" tabular>
            {t.amount}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

function VerdictVisual() {
  const { c } = useTheme();
  return (
    <Card style={{ width: '100%', gap: spacing.md, borderColor: c.warning }}>
      <AppText variant="micro" color="warning">
        Aaj ka verdict · 96%
      </AppText>
      <AppText variant="title">“Borderline tha bro, ek aur Zepto order aur kahani khatam.”</AppText>
      <AppText variant="caption" color="textMuted">
        ₹1,920 of ₹2,000 · Top: Food · 3 orders
      </AppText>
    </Card>
  );
}
