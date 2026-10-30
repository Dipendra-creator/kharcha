import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Switch,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import type { IconName } from '@/lib/categories';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';
import { motion, radii, spacing } from '@/theme/tokens';

import { AppText } from './text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that springs down slightly on press. */
export function PressableScale({
  style,
  onPressIn,
  onPressOut,
  scaleTo = 0.97,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, motion.spring));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, motion.spring));
        onPressOut?.(e);
      }}
      style={[style, animated]}
    />
  );
}

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  style,
  accessibilityHint,
}: ButtonProps) {
  const { c } = useTheme();
  const bg = { primary: c.accent, secondary: c.raised, ghost: 'transparent', danger: c.raised }[variant];
  const fg = { primary: c.onAccent, secondary: c.text, ghost: c.text, danger: c.over }[variant];
  const height = size === 'md' ? 54 : 40;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={[
        {
          height,
          minWidth: 44,
          borderRadius: radii.pill,
          backgroundColor: bg,
          paddingHorizontal: size === 'md' ? spacing.xxl : spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'md' ? 20 : 16} color={fg} /> : null}
          <AppText variant={size === 'md' ? 'body' : 'label'} weight="bold" color={fg}>
            {title}
          </AppText>
        </>
      )}
    </PressableScale>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  tone = 'raised',
  size = 44,
  color,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  tone?: 'raised' | 'plain' | 'accent';
  size?: number;
  color?: string;
}) {
  const { c } = useTheme();
  const bg = tone === 'raised' ? c.raised : tone === 'accent' ? c.accent : 'transparent';
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={icon} size={size * 0.46} color={color ?? (tone === 'accent' ? c.onAccent : c.text)} />
    </PressableScale>
  );
}

export function Card({
  children,
  style,
  padded = true,
  tone = 'surface',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  tone?: 'surface' | 'raised';
}) {
  const { c, scheme } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: tone === 'surface' ? c.surface : c.raised,
          borderRadius: radii.lg,
          borderWidth: scheme === 'dark' ? 1 : 0,
          borderColor: c.border,
          padding: padded ? spacing.xl : 0,
          shadowColor: c.shadow,
          shadowOpacity: scheme === 'dark' ? 0 : 0.06,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: scheme === 'dark' ? 0 : 2,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
}) {
  const { c } = useTheme();
  const fg = selected ? c.onAccent : (color ?? c.text);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      onPress={() => {
        haptic.select();
        onPress?.();
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 40,
        paddingHorizontal: spacing.lg,
        borderRadius: radii.pill,
        backgroundColor: selected ? c.accent : c.raised,
      }}>
      {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
      <AppText variant="label" color={fg}>
        {label}
      </AppText>
    </PressableScale>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: 'row', backgroundColor: c.raised, borderRadius: radii.pill, padding: 4 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={o.label}
            onPress={() => {
              haptic.select();
              onChange(o.value);
            }}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? c.accent : 'transparent',
            }}>
            <AppText variant="label" color={active ? c.onAccent : c.textMuted}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Row({
  title,
  subtitle,
  value,
  icon,
  onPress,
  toggle,
  destructive,
  last,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: IconName;
  onPress?: () => void;
  toggle?: { value: boolean; onChange: (v: boolean) => void };
  destructive?: boolean;
  last?: boolean;
}) {
  const { c } = useTheme();
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: 56,
        paddingVertical: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border,
      }}>
      {icon ? (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: c.raised,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name={icon} size={18} color={destructive ? c.over : c.text} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body" color={destructive ? 'over' : 'text'}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="label" color="textMuted" tabular>
          {value}
        </AppText>
      ) : null}
      {toggle ? (
        <Switch
          accessibilityLabel={title}
          value={toggle.value}
          onValueChange={(v) => {
            haptic.select();
            toggle.onChange(v);
          }}
          trackColor={{ true: c.accentGraphic, false: c.border }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={c.raised}
        />
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>
      {body}
    </Pressable>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.xxl,
        marginBottom: spacing.md,
      }}>
      <AppText variant="micro" color="textMuted" accessibilityRole="header">
        {title}
      </AppText>
      {action ? (
        <Pressable accessibilityRole="button" hitSlop={12} onPress={action.onPress}>
          <AppText variant="label" color="accentGraphic">
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          backgroundColor: c.raised,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.sm,
        }}>
        <Ionicons name={icon} size={26} color={c.textMuted} />
      </View>
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      <AppText variant="caption" color="textMuted" align="center" style={{ maxWidth: 280 }}>
        {body}
      </AppText>
    </View>
  );
}
