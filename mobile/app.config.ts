import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json with settings that come from the environment:
 * - EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME (com.googleusercontent.apps.…) enables
 *   the Google Sign-In config plugin; without it the app builds and Gmail
 *   sign-in stays disabled.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  return {
    ...(config as ExpoConfig),
    plugins: [
      ...(config.plugins ?? []),
      ...(iosUrlScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme }] as [string, unknown]] : []),
    ],
  };
};
