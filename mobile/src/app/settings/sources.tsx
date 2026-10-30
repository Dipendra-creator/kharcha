import KharchaSms from '@modules/kharcha-sms';
import { useEffect, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Screen, ScreenHeader } from '@/components/screen';
import { AppText } from '@/components/text';
import { Button, Card, Row, SectionTitle } from '@/components/ui';
import { useDbQuery, useNow } from '@/db/hooks';
import { recentSyncRuns } from '@/db/meta';
import { devSignIn, disconnectGmail, googleConfigured, signInWithGoogle, signOut } from '@/features/account/account';
import { authToken } from '@/features/account/session';
import { requestSmsPermission, smsSupported } from '@/features/sms/permission';
import { syncNow, useSyncStatus } from '@/features/sync/sync';
import { api, API_URL } from '@/lib/api';
import { relativeTime } from '@/lib/dates';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme';
import { fonts, radii, spacing } from '@/theme/tokens';

type Health = { ok: boolean; llm: string; gmail?: boolean } | 'offline' | null;

export default function SourcesScreen() {
  const { c } = useTheme();
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const lastSyncAt = useApp((s) => s.sync.lastSyncAt);
  const gmail = useApp((s) => s.sync.gmail);
  const account = useApp((s) => s.account);
  const serverOpen = useApp((s) => s.sync.serverOpen);
  const running = useSyncStatus((s) => s.running);
  const runs = useDbQuery(() => recentSyncRuns(8), []);
  const [health, setHealth] = useState<Health>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devEmail, setDevEmail] = useState('');
  const now = useNow(5_000);
  // Re-checked every few seconds so returning from system settings updates the toggle.
  const notifAccess = useMemo(() => !!KharchaSms?.hasNotificationAccess(), [now]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api
      .health()
      .then((h) => {
        setHealth(h);
        useApp.getState().setSync({ serverOpen: h.auth === 'none' });
      })
      .catch(() => setHealth('offline'));
  }, []);

  const act = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const serverLine =
    health === null ? 'Checking…' : health === 'offline' ? `Can't reach ${API_URL}` : `Online · AI: ${health.llm}`;

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
          <Row icon="chatbubble-ellipses-outline" title="Not available on iPhone" subtitle="iOS doesn't allow apps to read SMS. Use Gmail and manual entry." last />
        ) : null}
      </Card>

      <SectionTitle title="Kharcha account" />
      <Card style={{ gap: spacing.md }}>
        <AppText variant="caption" color="textMuted">
          Optional. Signing in lets the AI read SMS the rules aren&apos;t sure about (redacted first), writes fresh nightly
          verdicts, connects Gmail, and backs up your transactions.
        </AppText>
        <AppText variant="caption" color={health === 'offline' ? 'over' : 'textMuted'}>
          Server: {serverLine}
        </AppText>
        {serverOpen && !account ? (
          <Row icon="cloud-done-outline" title="Connected" subtitle="This server doesn't need sign-in" last />
        ) : account ? (
          <>
            <Row icon="person-circle-outline" title={account.name || "Signed in"} subtitle={account.email} last />
            <Button title="Sign out" variant="secondary" size="sm" loading={busy === 'signout'} onPress={() => act('signout', signOut)} />
          </>
        ) : (
          <>
            {googleConfigured ? (
              <Button title="Sign in with Google" icon="logo-google" loading={busy === 'google'} onPress={() => act('google', () => signInWithGoogle({ gmail: false }))} />
            ) : (
              <AppText variant="caption" color="textMuted">
                Google sign-in isn&apos;t configured in this build (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).
              </AppText>
            )}
            {__DEV__ ? (
              <View style={{ gap: spacing.sm }}>
                <TextInput
                  value={devEmail}
                  onChangeText={setDevEmail}
                  placeholder="you@example.com (dev server only)"
                  placeholderTextColor={c.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  accessibilityLabel="Email for development sign-in"
                  style={{ minHeight: 48, borderRadius: radii.md, backgroundColor: c.raised, paddingHorizontal: spacing.lg, color: c.text, fontFamily: fonts.medium }}
                />
                <Button title="Dev sign-in" size="sm" variant="secondary" disabled={!devEmail.includes('@')} loading={busy === 'dev'} onPress={() => act('dev', () => devSignIn(devEmail))} />
              </View>
            ) : null}
          </>
        )}
      </Card>

      <SectionTitle title="Gmail receipts" />
      <Card style={{ gap: spacing.md }}>
        {gmail.connected ? (
          <>
            <Row icon="mail-outline" title="Gmail connected" subtitle={`${gmail.email ?? ''} · read-only, receipts only`} last />
            <Button
              title="Disconnect Gmail"
              variant="danger"
              size="sm"
              loading={busy === 'gmail-off'}
              onPress={() => act('gmail-off', () => disconnectGmail(authToken()))}
            />
          </>
        ) : (
          <>
            <AppText variant="caption" color="textMuted">
              Read-only access to order receipts from Swiggy, Zomato, Blinkit, Zepto, Amazon, Uber and others. The server
              keeps only the extracted transaction, never the email.
            </AppText>
            <Button
              title="Connect Gmail"
              icon="mail"
              disabled={!googleConfigured}
              loading={busy === 'gmail'}
              onPress={() => act('gmail', () => signInWithGoogle({ gmail: true }).then(() => syncNow()))}
            />
          </>
        )}
      </Card>

      {error ? (
        <AppText variant="caption" color="over" style={{ marginTop: spacing.md }}>
          {error}
        </AppText>
      ) : null}

      <SectionTitle title="Sync" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        <Row
          icon="time-outline"
          title="Background sync"
          subtitle="Every few hours when the phone allows it"
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
