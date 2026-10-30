import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';
import { radii, spacing } from '@/theme/tokens';

import { AppText } from './text';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;

/** Applies a key to an amount string, keeping at most 2 decimals and `maxDigits` rupee digits. */
export function applyKey(value: string, key: (typeof KEYS)[number], maxDigits = 8): string {
  if (key === 'del') return value.slice(0, -1);
  if (key === '.') return value.includes('.') ? value : `${value || '0'}.`;
  const [int, dec] = value.split('.');
  if (dec !== undefined) return dec.length >= 2 ? value : value + key;
  if (int === '0') return key;
  return int.length >= maxDigits ? value : value + key;
}

export function Keypad({ value, onChange, allowDecimal = true }: { value: string; onChange: (v: string) => void; allowDecimal?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.sm }}>
      {KEYS.map((k) => {
        const hidden = k === '.' && !allowDecimal;
        return (
          <View key={k} style={{ width: '33.333%', paddingHorizontal: spacing.xs }}>
            <Pressable
              disabled={hidden}
              accessibilityRole="keyboardkey"
              accessibilityLabel={k === 'del' ? 'Delete' : k === '.' ? 'Decimal point' : k}
              onPress={() => {
                haptic.select();
                onChange(applyKey(value, k));
              }}
              style={({ pressed }) => ({
                height: 58,
                borderRadius: radii.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? c.raised : 'transparent',
                opacity: hidden ? 0 : 1,
              })}>
              {k === 'del' ? (
                <Ionicons name="backspace-outline" size={26} color={c.text} />
              ) : (
                <AppText variant="title" weight="semibold" tabular>
                  {k}
                </AppText>
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
