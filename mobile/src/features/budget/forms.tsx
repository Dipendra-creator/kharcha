import Ionicons from '@expo/vector-icons/Ionicons';
import { randomUUID } from 'expo-crypto';
import { Pressable, TextInput, View } from 'react-native';

import { Keypad } from '@/components/keypad';
import { AppText } from '@/components/text';
import { Chip } from '@/components/ui';
import { groupIndian, parseAmount } from '@/lib/money';
import type { FixedCost, FixedCostKind } from '@/store/app-store';
import { useTheme } from '@/theme/theme';
import { fonts, radii, spacing } from '@/theme/tokens';

/** Big rupee amount driven by the on-screen keypad (whole rupees). */
export function AmountEntry({ value, onChange, caption }: { value: string; onChange: (v: string) => void; caption?: string }) {
  return (
    <View>
      <View
        accessible
        accessibilityLabel={`Amount ${value || 'zero'} rupees`}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: spacing.xxl }}>
        <AppText variant="display" color="textMuted" style={{ marginRight: 4 }}>
          ₹
        </AppText>
        <AppText variant="hero" tabular color={value ? 'text' : 'textMuted'} numberOfLines={1} adjustsFontSizeToFit>
          {groupIndian(value || '0')}
        </AppText>
      </View>
      {caption ? (
        <AppText variant="caption" color="textMuted" align="center" style={{ marginBottom: spacing.xl }}>
          {caption}
        </AppText>
      ) : null}
      <Keypad value={value} onChange={onChange} allowDecimal={false} />
    </View>
  );
}

const PRESETS: { kind: FixedCostKind; label: string }[] = [
  { kind: 'rent', label: 'Rent' },
  { kind: 'emi', label: 'EMI' },
  { kind: 'sip', label: 'SIP' },
  { kind: 'insurance', label: 'Insurance' },
  { kind: 'other', label: 'Other' },
];

export function FixedCostsEditor({ value, onChange }: { value: FixedCost[]; onChange: (v: FixedCost[]) => void }) {
  const { c } = useTheme();
  const update = (id: string, patch: Partial<FixedCost>) => onChange(value.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  return (
    <View style={{ gap: spacing.md }}>
      {value.map((f) => (
        <View
          key={f.id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c.raised, borderRadius: radii.md, paddingLeft: spacing.lg }}>
          <TextInput
            value={f.label}
            onChangeText={(label) => update(f.id, { label })}
            accessibilityLabel="Fixed cost name"
            placeholder="Name"
            placeholderTextColor={c.textMuted}
            style={{ flex: 1, minHeight: 54, color: c.text, fontFamily: fonts.semibold, fontSize: 16 }}
          />
          <AppText variant="body" color="textMuted">
            ₹
          </AppText>
          <TextInput
            value={f.amount ? String(Math.round(f.amount / 100)) : ''}
            onChangeText={(t) => update(f.id, { amount: parseAmount(t.replace(/\D/g, '') || '0') ?? 0 })}
            keyboardType="number-pad"
            accessibilityLabel={`${f.label || 'Fixed cost'} amount in rupees`}
            placeholder="0"
            placeholderTextColor={c.textMuted}
            style={{ width: 96, minHeight: 54, color: c.text, fontFamily: fonts.bold, fontSize: 16, fontVariant: ['tabular-nums'] }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${f.label || 'fixed cost'}`}
            hitSlop={8}
            onPress={() => onChange(value.filter((x) => x.id !== f.id))}
            style={{ width: 44, height: 54, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close-circle" size={20} color={c.textMuted} />
          </Pressable>
        </View>
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {PRESETS.map((p) => (
          <Chip
            key={p.kind}
            label={p.label}
            icon="add"
            onPress={() => onChange([...value, { id: randomUUID(), kind: p.kind, label: p.label, amount: 0 }])}
          />
        ))}
      </View>
    </View>
  );
}

export function PaydayPicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
        const active = d === value;
        return (
          <View key={d} style={{ width: `${100 / 7}%`, padding: 3 }}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`Day ${d}`}
              onPress={() => onChange(d)}
              style={{
                aspectRatio: 1,
                minHeight: 40,
                borderRadius: radii.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? c.accent : c.raised,
              }}>
              <AppText variant="label" tabular color={active ? c.onAccent : 'text'}>
                {d}
              </AppText>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
