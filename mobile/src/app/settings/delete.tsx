import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ScreenHeader } from '@/components/screen';
import { AppText } from '@/components/text';
import { Button } from '@/components/ui';
import { deleteEverything } from '@/features/privacy/data';
import { haptic } from '@/lib/haptics';
import { useTheme, withAlpha } from '@/theme/theme';
import { radii, spacing } from '@/theme/tokens';

export default function DeleteSheet() {
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      await deleteEverything();
      haptic.warning();
      // The onboarding guard takes over once the store resets.
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: c.surface }} contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.xxl }}>
      <ScreenHeader title="Delete everything?" close="close" />
      <View style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radii.md, backgroundColor: withAlpha(c.over, 0.12) }}>
        <Ionicons name="warning" size={22} color={c.over} />
        <AppText variant="caption" style={{ flex: 1 }}>
          This removes every transaction, rule, report and setting on this phone. It can&apos;t be undone.
        </AppText>
      </View>
      <Button title="Delete everything" variant="danger" icon="trash" loading={busy} onPress={run} style={{ marginTop: spacing.xl }} />
    </ScrollView>
  );
}
