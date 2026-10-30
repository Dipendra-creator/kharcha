import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/text';
import { Button, Card } from '@/components/ui';
import { requestNotificationPermission } from '@/features/notifications/nightly';
import { OnboardingStep } from '@/features/onboarding/step';
import { requestSmsPermission, smsSupported } from '@/features/sms/permission';
import { syncNow } from '@/features/sync/sync';
import type { IconName } from '@/lib/categories';
import { formatHour } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { useApp } from '@/store/app-store';
import { useTheme, withAlpha } from '@/theme/theme';
import { radii, spacing } from '@/theme/tokens';

export default function PermissionsStep() {
  const { c } = useTheme();
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const giveConsent = useApp((s) => s.giveConsent);
  const completeOnboarding = useApp((s) => s.completeOnboarding);
  const [consent, setConsent] = useState(false);
  const [sms, setSms] = useState<'idle' | 'granted' | 'denied'>(settings.smsEnabled ? 'granted' : 'idle');
  const [notif, setNotif] = useState<'idle' | 'granted' | 'denied'>('idle');

  return (
    <OnboardingStep
      step={4}
      title="Permissions, in plain words"
      subtitle="Turn on what you're comfortable with. You can change all of this later in Settings."
      cta="Start tracking"
      nextDisabled={!consent}
      onBack={() => router.back()}
      onNext={() => {
        giveConsent();
        completeOnboarding();
        haptic.success();
        // First pull of recent bank SMS so Today isn't empty.
        syncNow().catch(() => {});
      }}>
      <View style={{ gap: spacing.md }}>
        {smsSupported ? (
          <PermissionCard
            icon="chatbubble-ellipses"
            title="Bank & UPI SMS"
            body="We read only debit/credit alerts from banks, UPI apps and wallets. OTPs, promos and personal chats are dropped on your phone."
            status={sms}
            action="Allow SMS"
            onPress={async () => {
              const ok = await requestSmsPermission();
              setSms(ok ? 'granted' : 'denied');
              setSettings({ smsEnabled: ok });
            }}
          />
        ) : (
          <PermissionCard
            icon="chatbubble-ellipses"
            title="SMS isn't available on iPhone"
            body="iOS doesn't let apps read SMS. Connect Gmail for receipts, and add anything else in two taps."
            status="idle"
          />
        )}
        <PermissionCard
          icon="mail"
          title="Order emails (Gmail)"
          body="Read-only access to receipts from Swiggy, Zomato, Amazon, Uber and similar. Connect it in Settings → Sources after setup."
          status="idle"
        />
        <PermissionCard
          icon="notifications"
          title="Nightly report"
          body={`One notification at ${formatHour(settings.reportHour, settings.reportMinute)} with your verdict. Nothing else.`}
          status={notif}
          action="Allow notifications"
          onPress={async () => {
            const ok = await requestNotificationPermission();
            setNotif(ok ? 'granted' : 'denied');
          }}
        />
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        accessibilityLabel="I consent to Kharcha processing my transaction data as described"
        onPress={() => {
          haptic.select();
          setConsent((v) => !v);
        }}
        style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl, alignItems: 'flex-start' }}>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: consent ? c.accent : c.textMuted,
            backgroundColor: consent ? c.accent : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {consent ? <Ionicons name="checkmark" size={18} color={c.onAccent} /> : null}
        </View>
        <AppText variant="caption" color="textMuted" style={{ flex: 1 }}>
          I consent to Kharcha processing my transaction data to calculate my budget (DPDP Act 2023). Only extracted
          transactions — never raw SMS or emails — are stored. I can export or delete everything any time from Settings.
        </AppText>
      </Pressable>
    </OnboardingStep>
  );
}

function PermissionCard({
  icon,
  title,
  body,
  status,
  action,
  onPress,
}: {
  icon: IconName;
  title: string;
  body: string;
  status: 'idle' | 'granted' | 'denied';
  action?: string;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 40, height: 40, borderRadius: radii.sm, backgroundColor: withAlpha(c.accentGraphic, 0.14), alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={20} color={c.accentGraphic} />
        </View>
        <AppText variant="body" weight="semibold" style={{ flex: 1 }}>
          {title}
        </AppText>
        {status === 'granted' ? <Ionicons name="checkmark-circle" size={22} color={c.safe} accessibilityLabel="Allowed" /> : null}
      </View>
      <AppText variant="caption" color="textMuted">
        {body}
      </AppText>
      {action && onPress && status !== 'granted' ? (
        <Button title={status === 'denied' ? `${action} (try again)` : action} size="sm" variant="secondary" onPress={onPress} style={{ alignSelf: 'flex-start' }} />
      ) : null}
    </Card>
  );
}
