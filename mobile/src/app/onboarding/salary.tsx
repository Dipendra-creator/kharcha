import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native';

import { AmountEntry } from '@/features/budget/forms';
import { OnboardingStep } from '@/features/onboarding/step';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme';
import { fonts, radii, spacing } from '@/theme/tokens';

export default function SalaryStep() {
  const { c } = useTheme();
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const [name, setName] = useState(profile.name);
  const [amount, setAmount] = useState(profile.salary ? String(Math.round(profile.salary / 100)) : '');

  return (
    <OnboardingStep
      step={1}
      title="What lands in your account?"
      subtitle="Monthly in-hand salary, after tax and PF. It never leaves your phone."
      cta="Continue"
      nextDisabled={!Number(amount)}
      onBack={() => router.back()}
      onNext={() => {
        setProfile({ name: name.trim(), salary: Number(amount) * 100 });
        router.push('/onboarding/fixed-costs');
      }}>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your first name (optional)"
        placeholderTextColor={c.textMuted}
        accessibilityLabel="Your first name, optional"
        autoCapitalize="words"
        returnKeyType="done"
        style={{
          minHeight: 52,
          borderRadius: radii.md,
          backgroundColor: c.raised,
          paddingHorizontal: spacing.lg,
          color: c.text,
          fontFamily: fonts.medium,
          fontSize: 16,
        }}
      />
      <AmountEntry value={amount} onChange={setAmount} caption="per month" />
    </OnboardingStep>
  );
}
