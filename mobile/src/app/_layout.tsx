import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { migrate } from '@/db/client';
import { configureNotifications } from '@/features/notifications/nightly';
import { useNightlyScheduler, useNotificationRouting } from '@/features/notifications/use-nightly';
import { applyBackgroundSync } from '@/features/sync/background';
import { registerSources } from '@/features/sync/sources';
import { useApp } from '@/store/app-store';
import { ThemeProvider, useTheme } from '@/theme/theme';
import { radii } from '@/theme/tokens';

migrate();
configureNotifications();
registerSources();
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function AppNavigator() {
  const { c, scheme } = useTheme();
  const onboarded = useApp((s) => s.onboarded);
  const backgroundSync = useApp((s) => s.settings.backgroundSync);
  useNightlyScheduler();
  useNotificationRouting();
  useEffect(() => {
    applyBackgroundSync(onboarded && backgroundSync).catch(() => {});
  }, [onboarded, backgroundSync]);

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: c.bg, card: c.surface, text: c.text, border: c.border, primary: c.accentGraphic },
  };
  const sheet = {
    presentation: 'formSheet' as const,
    sheetAllowedDetents: [0.94],
    sheetGrabberVisible: true,
    sheetCornerRadius: radii.xl,
    contentStyle: { backgroundColor: c.surface },
  };

  return (
    <NavigationTheme value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add" options={sheet} />
          <Stack.Screen name="review" />
          <Stack.Screen name="report/[date]" options={{ presentation: 'fullScreenModal', animation: 'fade_from_bottom' }} />
          <Stack.Screen name="settings/budget" />
          <Stack.Screen name="settings/sources" />
          <Stack.Screen name="settings/privacy" />
          <Stack.Screen name="settings/report-time" options={{ ...sheet, sheetAllowedDetents: [0.6] }} />
          <Stack.Screen name="settings/delete" options={{ ...sheet, sheetAllowedDetents: [0.55] }} />
        </Stack.Protected>
      </Stack>
    </NavigationTheme>
  );
}
