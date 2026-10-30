import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen, ScreenHeader } from '@/components/screen';
import { AppText } from '@/components/text';
import { Button, Card, Row, SectionTitle } from '@/components/ui';
import { exportMyData } from '@/features/account/data';
import { EMAIL_SENDERS } from '@/features/email/senders';
import { FINANCE_SENDERS } from '@/features/sms/senders';
import { formatDate } from '@/lib/dates';
import { useApp } from '@/store/app-store';
import { useTheme } from '@/theme/theme';
import { radii, spacing } from '@/theme/tokens';

export default function PrivacyScreen() {
  const { c } = useTheme();
  const consentAt = useApp((s) => s.consentAt);
  const [exporting, setExporting] = useState(false);
  const [showSenders, setShowSenders] = useState(false);
  const banks = [...new Set(Object.values(FINANCE_SENDERS))];

  return (
    <Screen>
      <ScreenHeader title="Privacy & data" subtitle="Built for India's DPDP Act 2023" close="back" />

      <Card style={{ gap: spacing.md }}>
        <Bullet title="On your phone" body="SMS are filtered and parsed on-device. OTPs, promos and personal messages are dropped and never leave the phone." />
        <Bullet title="Before anything is uploaded" body="Phone numbers, account numbers (except the last 4 digits) and OTPs are stripped from the text sent for AI extraction." />
        <Bullet title="On the server" body="Only extracted transactions are stored — never raw SMS or emails. Gmail access is read-only and limited to the senders below." />
      </Card>

      <SectionTitle title="What Kharcha reads" action={{ label: showSenders ? 'Hide' : 'Show all', onPress: () => setShowSenders((v) => !v) }} />
      <Card style={{ gap: spacing.md }}>
        <AppText variant="label">SMS from {banks.length} banks, cards, UPI apps & wallets</AppText>
        {showSenders ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(FINANCE_SENDERS).map(([id, name]) => (
              <View key={id} style={{ backgroundColor: c.raised, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                <AppText variant="caption" color="textMuted">
                  {id} · {name}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        <AppText variant="label" style={{ marginTop: spacing.sm }}>
          Emails from {EMAIL_SENDERS.length} senders (read-only)
        </AppText>
        {showSenders ? (
          EMAIL_SENDERS.map((s) => (
            <AppText key={s.name} variant="caption" color="textMuted">
              {s.name} — {s.domains.join(', ')}
            </AppText>
          ))
        ) : (
          <AppText variant="caption" color="textMuted">
            {EMAIL_SENDERS.map((s) => s.name).join(', ')}
          </AppText>
        )}
      </Card>

      <SectionTitle title="Your data" />
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        <Row icon="document-text-outline" title="Consent given" value={consentAt ? formatDate(new Date(consentAt), { year: true }) : 'Not recorded'} />
        <Row icon="git-network-outline" title="Connected sources" subtitle="Turn SMS or Gmail off any time" onPress={() => router.push('/settings/sources')} last />
      </Card>

      <Button
        title="Export my data (JSON)"
        icon="download-outline"
        variant="secondary"
        loading={exporting}
        style={{ marginTop: spacing.xl }}
        onPress={async () => {
          setExporting(true);
          try {
            await exportMyData();
          } finally {
            setExporting(false);
          }
        }}
      />
      <Button title="Delete everything" icon="trash-outline" variant="danger" style={{ marginTop: spacing.sm }} onPress={() => router.push('/settings/delete')} />
    </Screen>
  );
}

function Bullet({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="label">{title}</AppText>
      <AppText variant="caption" color="textMuted">
        {body}
      </AppText>
    </View>
  );
}
