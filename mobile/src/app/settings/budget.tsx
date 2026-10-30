import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Money } from '@/components/money';
import { Screen, ScreenHeader } from '@/components/screen';
import { AppText } from '@/components/text';
import { Button, Card, SectionTitle } from '@/components/ui';
import { disposableIncome } from '@/features/budget/budget';
import { FixedCostsEditor, PaydayPicker } from '@/features/budget/forms';
import { cycleFor } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme';
import { fonts, radii, spacing } from '@/theme/tokens';

export default function BudgetSettings() {
  const { c } = useTheme();
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const [salary, setSalary] = useState(String(Math.round(profile.salary / 100)));
  const [costs, setCosts] = useState(profile.fixedCosts);
  const [payday, setPayday] = useState(profile.payday);

  const salaryPaise = (Number(salary.replace(/\D/g, '')) || 0) * 100;
  const fixed = costs.reduce((s, f) => s + f.amount, 0);
  const daily = disposableIncome(salaryPaise, fixed) / cycleFor(new Date(), payday).days;

  return (
    <Screen>
      <ScreenHeader title="Budget" subtitle="Changes apply from today" close="back" />

      <Card style={{ gap: spacing.xs }}>
        <AppText variant="caption" color="textMuted">
          New base daily budget
        </AppText>
        <Money paise={daily} variant="display" decimals={0} label="New base daily budget" />
      </Card>

      <SectionTitle title="Monthly in-hand salary" />
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.raised, borderRadius: radii.md, paddingHorizontal: spacing.lg }}>
        <AppText variant="heading" color="textMuted">
          ₹
        </AppText>
        <TextInput
          value={salary}
          onChangeText={(t) => setSalary(t.replace(/\D/g, ''))}
          keyboardType="number-pad"
          accessibilityLabel="Monthly in-hand salary in rupees"
          style={{ flex: 1, minHeight: 58, marginLeft: spacing.sm, color: c.text, fontFamily: fonts.bold, fontSize: 22, fontVariant: ['tabular-nums'] }}
        />
      </View>

      <SectionTitle title="Fixed costs" />
      <FixedCostsEditor value={costs} onChange={setCosts} />

      <SectionTitle title="Payday" />
      <PaydayPicker value={payday} onChange={setPayday} />

      <Button
        title="Save"
        style={{ marginTop: spacing.xxl }}
        disabled={salaryPaise <= 0}
        onPress={() => {
          setProfile({ salary: salaryPaise, fixedCosts: costs.filter((f) => f.amount > 0), payday });
          haptic.success();
          router.back();
        }}
      />
    </Screen>
  );
}
