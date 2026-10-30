import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ScreenHeader } from '@/components/screen';
import { AppText } from '@/components/text';
import { Button } from '@/components/ui';
import { deleteEverything } from '@/features/account/data';
import { haptic } from '@/lib/haptics';
import { useApp } from '@/store/app-store';
import { useTheme, withAlpha } from '@/theme/theme';
import { radii, spacing } from '@/theme/tokens';

export default function DeleteSheet() {
  const { c } = useTheme();
  const account = useApp((s) => s.account);
  const [busy, setBusy] = useState(false);
  const [serverFailed, setServerFailed] = useState(false);

  const run = async (localOnly: boolean) => {
    setBusy(true);
    try {
      await deleteEverything({ localOnly });
      haptic.warning();
      // The onboarding guard takes over once the store resets.
    } catch {
      setServerFailed(true);
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
          This removes every transaction, rule, report and setting on this phone
          {account ? ', plus your Kharcha account and all server data, and revokes Gmail access' : ''}. It can&apos;t be undone.
        </AppText>
      </View>
      {serverFailed ? (
        <AppText variant="caption" color="over" style={{ marginTop: spacing.lg }}>
          Couldn&apos;t reach the server, so nothing was deleted. Try again when you&apos;re online, or delete only what&apos;s on this phone.
        </AppText>
      ) : null}
      <Button title="Delete everything" variant="danger" icon="trash" loading={busy} onPress={() => run(false)} style={{ marginTop: spacing.xl }} />
      {serverFailed ? (
        <Button title="Delete on this phone only" variant="secondary" onPress={() => run(true)} style={{ marginTop: spacing.sm }} />
      ) : null}
    </ScrollView>
  );
}
