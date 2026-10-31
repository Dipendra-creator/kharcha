import KharchaSms from '@modules/kharcha-sms';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Screen, ScreenHeader } from '@/components/screen';
import { AppText } from '@/components/text';
import { Button, Card, Row, SectionTitle } from '@/components/ui';
import { useDbQuery, useNow } from '@/db/hooks';
import { recentSyncRuns } from '@/db/meta';
import { requestSmsPermission, smsSupported } from '@/features/sms/permission';
import { syncNow, useSyncStatus } from '@/features/sync/sync';
import { relativeTime } from '@/lib/dates';
import { useApp } from '@/store/app-store';
import { spacing } from '@/theme/tokens';

export default function SourcesScreen() {
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const lastSyncAt = useApp((s) => s.sync.lastSyncAt);
  const running = useSyncStatus((s) => s.running);
  const runs = useDbQuery(() => recentSyncRuns(8), []);
  const now = useNow(5_000);
  // Re-checked every few seconds so returning from system settings updates the toggle.
  const notifAccess = useMemo(() => !!KharchaSms?.hasNotificationAccess(), [now]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen>
      <ScreenHeader title="Sources" subtitle={lastSyncAt ? `Last synced ${relativeTime(lastSyncAt)}` : 'Not synced yet'} close="back" />

      <SectionTitle title="SMS" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        {smsSupported ? (
          <Row
            icon="chatbubble-ellipses-outline"
            title="Read bank & UPI SMS"
            subtitle="Parsed on your phone; OTPs and personal messages are skipped"
            toggle={{
              value: settings.smsEnabled,
              onChange: async (on) => setSettings({ smsEnabled: on ? await requestSmsPermission() : false }),
            }}
          />
        ) : null}
        {smsSupported && KharchaSms ? (
          <Row
            icon="notifications-outline"
            title="Payment notifications instead"
            subtitle={
              notifAccess
                ? 'Reads payment alerts from SMS, bank and UPI app notifications'
                : 'For phones where SMS access isn’t allowed. Opens system settings to grant access.'
            }
            toggle={{
              value: settings.notificationFallback && notifAccess,
              onChange: (on) => {
                if (on && !notifAccess) KharchaSms?.openNotificationAccessSettings();
                setSettings({ notificationFallback: on });
              },
            }}
            last
          />
        ) : null}
        {!smsSupported ? (
          <Row icon="chatbubble-ellipses-outline" title="Not available on iPhone" subtitle="iOS doesn't allow apps to read SMS. Add spends manually." last />
        ) : null}
      </Card>

      <SectionTitle title="Sync" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        <Row
          icon="time-outline"
          title="Background sync"
          subtitle="About every 15 minutes when the phone allows it"
          toggle={{ value: settings.backgroundSync, onChange: (backgroundSync) => setSettings({ backgroundSync }) }}
          last
        />
      </Card>
      <Button title="Sync now" icon="sync" loading={running} onPress={() => syncNow()} style={{ marginTop: spacing.lg }} />

      <SectionTitle title="Recent syncs" />
      <Card style={{ gap: spacing.md }}>
        {runs.length === 0 ? (
          <AppText variant="caption" color="textMuted">
            No syncs yet.
          </AppText>
        ) : (
          runs.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
              <AppText variant="caption">
                {r.source.toUpperCase()} · {relativeTime(r.startedAt)}
              </AppText>
              <AppText variant="caption" color={r.errors ? 'over' : 'textMuted'} style={{ flexShrink: 1 }} numberOfLines={2}>
                {r.errors ? r.errors : `${r.itemsParsed}/${r.itemsFound} parsed`}
              </AppText>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}
