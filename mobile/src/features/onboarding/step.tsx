import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/text';
import { Button, IconButton } from '@/components/ui';
import { useTheme } from '@/theme/theme';
import { radii, spacing } from '@/theme/tokens';

/** Shared frame for the onboarding form steps: progress, title, body, sticky CTA. */
export function OnboardingStep({
  step,
  total = 4,
  title,
  subtitle,
  children,
  cta,
  onNext,
  nextDisabled,
  onBack,
}: {
  step: number;
  total?: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  cta: string;
  onNext: () => void;
  nextDisabled?: boolean;
  onBack?: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 }}>
          {onBack ? <IconButton icon="chevron-back" label="Back" onPress={onBack} /> : null}
          <View
            style={{ flex: 1, flexDirection: 'row', gap: 6 }}
            accessible
            accessibilityLabel={`Step ${step} of ${total}`}>
            {Array.from({ length: total }, (_, i) => (
              <View key={i} style={{ flex: 1, height: 4, borderRadius: radii.pill, backgroundColor: i < step ? c.accentGraphic : c.raised }} />
            ))}
          </View>
        </View>
        <AppText variant="title" style={{ marginTop: spacing.xxl }} accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="bodyRegular" color="textMuted" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
          {subtitle}
        </AppText>
        {children}
      </ScrollView>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.lg, paddingTop: spacing.sm }}>
        <Button title={cta} onPress={onNext} disabled={nextDisabled} />
      </View>
    </KeyboardAvoidingView>
  );
}
