import Constants from 'expo-constants';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Money } from '@/components/money';
import { Screen } from '@/components/screen';
import { AppText } from '@/components/text';
import { Card, Row, Segmented, SectionTitle } from '@/components/ui';
import { useCycleBudget, useDbQuery } from '@/db/hooks';
import { countReview } from '@/db/transactions';
import { formatHour, ordinal } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useApp, type RoastIntensity, type ThemePref } from '@/store/app-store';
import { spacing } from '@/theme/tokens';

export default function SettingsScreen() {
  const profile = useApp((s) => s.profile);
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const serverOn = useApp((s) => s.sync.serverOpen || !!s.account);
  const gmail = useApp((s) => s.sync.gmail);
  const budget = useCycleBudget();
  const reviewCount = useDbQuery(() => countReview(), []);
  const fixed = profile.fixedCosts.reduce((s, f) => s + f.amount, 0);

  const sources = [settings.smsEnabled ? 'SMS' : null, gmail.connected ? 'Gmail' : null].filter(Boolean).join(' + ') || 'Manual only';

  return (
    <Screen tabs>
      <AppText variant="title" accessibilityRole="header">
        Settings
      </AppText>

      <Card style={{ marginTop: spacing.xl, gap: spacing.xs }}>
        <AppText variant="caption" color="textMuted">
          Base daily budget
        </AppText>
        <Money paise={budget.base} variant="display" decimals={0} label="Base daily budget" />
        <AppText variant="caption" color="textMuted">
          {formatINR(profile.salary, { decimals: 0 })} salary − {formatINR(fixed, { decimals: 0 })} fixed ÷ {budget.days.length} days
        </AppText>
      </Card>

      <SectionTitle title="Budget" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        <Row icon="wallet-outline" title="Salary, fixed costs & payday" subtitle={`Payday: ${ordinal(profile.payday)} · ${profile.fixedCosts.length} fixed ${profile.fixedCosts.length === 1 ? 'cost' : 'costs'}`} onPress={() => router.push('/settings/budget')} />
        <Row
          icon="arrow-redo-outline"
          title="Roll over unspent money"
          subtitle="Spread what you didn't spend across the rest of the month"
          toggle={{ value: settings.rollover, onChange: (rollover) => setSettings({ rollover }) }}
        />
        <Row
          icon="trending-down-outline"
          title="Adjust after overspending"
          subtitle="Overspend shrinks the remaining days' budgets"
          toggle={{ value: settings.redistributeOverspend, onChange: (redistributeOverspend) => setSettings({ redistributeOverspend }) }}
          last
        />
      </Card>

      <SectionTitle title="Nightly report" />
      <Card style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label">Roast intensity</AppText>
          <Segmented<RoastIntensity>
            options={[
              { value: 'off', label: 'Off' },
              { value: 'mild', label: 'Mild' },
              { value: 'savage', label: 'Savage' },
            ]}
            value={settings.roast}
            onChange={(roast) => setSettings({ roast })}
          />
        </View>
        <View>
          <Row icon="time-outline" title="Report time" value={formatHour(settings.reportHour, settings.reportMinute)} onPress={() => router.push('/settings/report-time')} />
          <Row
            icon="sparkles-outline"
            title="AI verdicts"
            subtitle={serverOn ? 'Fresh Hinglish lines from the server LLM' : 'Connect to the server under Sources'}
            toggle={{ value: settings.aiVerdicts, onChange: (aiVerdicts) => setSettings({ aiVerdicts }) }}
            last
          />
        </View>
      </Card>

      <SectionTitle title="Data" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        <Row icon="git-network-outline" title="Connected sources" value={sources} onPress={() => router.push('/settings/sources')} />
        <Row icon="file-tray-full-outline" title="Review inbox" value={reviewCount ? String(reviewCount) : 'Empty'} onPress={() => router.push('/review')} />
        <Row icon="shield-checkmark-outline" title="Privacy & your data" subtitle="What we read, export, delete everything" onPress={() => router.push('/settings/privacy')} last />
      </Card>

      <SectionTitle title="Appearance" />
      <Segmented<ThemePref>
        options={[
          { value: 'system', label: 'System' },
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
        ]}
        value={settings.theme}
        onChange={(theme) => setSettings({ theme })}
      />

      <AppText variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.xxxl }}>
        Kharcha {Constants.expoConfig?.version ?? ''} · Where did my money go today?
      </AppText>
    </Screen>
  );
}
