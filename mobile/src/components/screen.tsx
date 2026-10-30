import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, withAlpha } from '@/theme/theme';
import { spacing, TAB_BAR_HEIGHT } from '@/theme/tokens';

import { AppText } from './text';
import { IconButton } from './ui';

type ScreenProps = {
  children: ReactNode;
  /** Leaves room for the floating tab bar. */
  tabs?: boolean;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  /** Rendered outside the scroll view (e.g. a floating button). */
  overlay?: ReactNode;
};

export function Screen({ children, tabs, scroll = true, refreshing, onRefresh, contentStyle, overlay }: ScreenProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const padding: ViewStyle = {
    paddingTop: insets.top + spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: (tabs ? TAB_BAR_HEIGHT + spacing.xxl : spacing.xxxl) + insets.bottom,
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padding, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={c.accentGraphic}
                colors={[c.onAccent]}
                progressBackgroundColor={c.accent}
              />
            ) : undefined
          }>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      )}
      <StatusBarScrim />
      {overlay}
    </View>
  );
}

/** Keeps scrolled content from running under the status bar. Render last, over the scroll view. */
export function StatusBarScrim() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: withAlpha(c.bg, 0.96) }}
    />
  );
}

/** Title row for pushed screens and sheets (native headers are hidden app-wide). */
export function ScreenHeader({
  title,
  subtitle,
  close,
  right,
}: {
  title: string;
  subtitle?: string;
  close?: 'back' | 'close';
  right?: ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl }}>
      {close ? (
        <IconButton
          icon={close === 'back' ? 'chevron-back' : 'close'}
          label={close === 'back' ? 'Back' : 'Close'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}
