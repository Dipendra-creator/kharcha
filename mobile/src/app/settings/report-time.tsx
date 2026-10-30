import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ScreenHeader } from '@/components/screen';
import { AppText } from '@/components/text';
import { Button, Chip } from '@/components/ui';
import { formatHour } from '@/lib/dates';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme';
import { spacing } from '@/theme/tokens';

const HOURS = [19, 20, 21, 22, 23];
const MINUTES = [0, 15, 30, 45];

export default function ReportTimeSheet() {
  const { c } = useTheme();
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const [hour, setHour] = useState(settings.reportHour);
  const [minute, setMinute] = useState(settings.reportMinute);

  return (
    <ScrollView style={{ backgroundColor: c.surface }} contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.xxl }}>
      <ScreenHeader title="Report time" subtitle={`Nightly report at ${formatHour(hour, minute)}`} close="close" />
      <AppText variant="micro" color="textMuted" style={{ marginBottom: spacing.md }}>
        Hour
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {HOURS.map((h) => (
          <Chip key={h} label={formatHour(h).replace(':00', '')} selected={hour === h} onPress={() => setHour(h)} />
        ))}
      </View>
      <AppText variant="micro" color="textMuted" style={{ marginTop: spacing.xxl, marginBottom: spacing.md }}>
        Minute
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {MINUTES.map((m) => (
          <Chip key={m} label={`:${m.toString().padStart(2, '0')}`} selected={minute === m} onPress={() => setMinute(m)} />
        ))}
      </View>
      <Button
        title="Save"
        style={{ marginTop: spacing.xxl }}
        onPress={() => {
          setSettings({ reportHour: hour, reportMinute: minute });
          router.back();
        }}
      />
    </ScrollView>
  );
}
