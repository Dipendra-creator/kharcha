import { router } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/text';
import { PaydayPicker } from '@/features/budget/forms';
import { OnboardingStep } from '@/features/onboarding/step';
import { ordinal } from '@/lib/dates';
import { useApp } from '@/store/app-store';
import { spacing } from '@/theme/tokens';

export default function PaydayStep() {
  const payday = useApp((s) => s.profile.payday);
  const setProfile = useApp((s) => s.setProfile);
  const [day, setDay] = useState(payday);

  return (
    <OnboardingStep
      step={3}
      title="When does salary land?"
      subtitle="Your budget month runs payday to payday, so day 1 is the day you get paid."
      cta="Continue"
      onBack={() => router.back()}
      onNext={() => {
        setProfile({ payday: day });
        router.push('/onboarding/permissions');
      }}>
      <PaydayPicker value={day} onChange={setDay} />
      <AppText variant="caption" color="textMuted" style={{ marginTop: spacing.lg }}>
        Payday: the {ordinal(day)} of every month{day > 28 ? ' (or the last day in shorter months)' : ''}.
      </AppText>
    </OnboardingStep>
  );
}
