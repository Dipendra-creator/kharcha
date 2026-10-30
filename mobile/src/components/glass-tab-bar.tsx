import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/lib/categories';
import { haptic } from '@/lib/haptics';
import { useTheme } from '@/theme/theme';
import { spacing, TAB_BAR_HEIGHT } from '@/theme/tokens';

import { AppText } from './text';

const ICONS: Record<string, [IconName, IconName]> = {
  index: ['home', 'home-outline'],
  insights: ['stats-chart', 'stats-chart-outline'],
  subscriptions: ['repeat', 'repeat-outline'],
  settings: ['settings', 'settings-outline'],
};

/** Floating glass tab bar. Real blur on iOS; a translucent surface on Android. */
export function GlassTabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, spacing.md), paddingHorizontal: spacing.xl }}>
      <View
        style={{
          height: TAB_BAR_HEIGHT,
          borderRadius: TAB_BAR_HEIGHT / 2,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.border,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 12,
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : c.glass,
        }}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={60}
            tint={scheme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View accessibilityRole="tablist" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm }}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const { options } = descriptors[route.key];
            const label = typeof options.title === 'string' ? options.title : route.name;
            const [on, off] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                onPress={() => {
                  if (focused) return;
                  haptic.select();
                  navigateToTab(route.key);
                }}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: TAB_BAR_HEIGHT }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    height: 40,
                    paddingHorizontal: focused ? spacing.md : 0,
                    borderRadius: 20,
                    backgroundColor: focused ? c.accent : 'transparent',
                  }}>
                  <Ionicons name={focused ? on : off} size={20} color={focused ? c.onAccent : c.textMuted} />
                  {focused ? (
                    <AppText variant="caption" weight="bold" color={c.onAccent} numberOfLines={1}>
                      {label}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
