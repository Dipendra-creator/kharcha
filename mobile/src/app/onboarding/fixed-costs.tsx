import { router } from 'expo-router';
import { useState } from 'react';

import { Money } from '@/components/money';
import { AppText } from '@/components/text';
import { Card } from '@/components/ui';
import { disposableIncome } from '@/features/budget/budget';
import { FixedCostsEditor } from '@/features/budget/forms';
import { OnboardingStep } from '@/features/onboarding/step';
import { cycleFor } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useApp } from '@/store/app-store';
import { spacing } from '@/theme/tokens';

export default function FixedCostsStep() {
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const [costs, setCosts] = useState(profile.fixedCosts);
  const total = costs.reduce((s, f) => s + f.amount, 0);
  const days = cycleFor(new Date(), profile.payday).days;
  const daily = disposableIncome(profile.salary, total) / days;

  return (
    <OnboardingStep
      step={2}
      title="Fixed costs first"
      subtitle="Rent, EMIs, SIPs, insurance — money that's spoken for before the month starts."
      cta={costs.length ? 'Continue' : 'No fixed costs — continue'}
      onBack={() => router.back()}
      onNext={() => {
        setProfile({ fixedCosts: costs.filter((f) => f.amount > 0) });
        router.push('/onboarding/payday');
      }}>
      <FixedCostsEditor value={costs} onChange={setCosts} />
      <Card style={{ marginTop: spacing.xxl, gap: spacing.xs }}>
        <AppText variant="caption" color="textMuted">
          Your daily budget will be about
        </AppText>
        <Money paise={daily} variant="display" decimals={0} label="Daily budget" />
        <AppText variant="caption" color="textMuted">
          ({formatINR(profile.salary, { decimals: 0 })} salary − {formatINR(total, { decimals: 0 })} fixed) ÷ {days} days
        </AppText>
      </Card>
    </OnboardingStep>
  );
}
