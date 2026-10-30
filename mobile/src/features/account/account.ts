import type { ConfigureParams, SignInResponse } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { api, type AuthResponse } from '@/lib/api';
import { useApp } from '@/store/app-store';

import { clearAuthToken, saveAuthToken } from './session';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/** Google sign-in needs OAuth client ids (see README → Google Cloud setup). */
export const googleConfigured = !!WEB_CLIENT_ID && Platform.OS !== 'web';

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

// Loaded lazily: the native module is absent until the app is rebuilt with it.
function google(): GoogleModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must not throw at import time
    return require('@react-native-google-signin/google-signin') as GoogleModule;
  } catch {
    return null;
  }
}

async function finish(auth: AuthResponse): Promise<void> {
  await saveAuthToken(auth.token);
  useApp.getState().setAccount({ email: auth.user.email, name: auth.user.name });
}

/**
 * Signs in with Google. With `gmail`, it also asks for read-only Gmail access
 * and hands the server a one-time code so it can read receipts offline.
 */
export async function signInWithGoogle(opts: { gmail: boolean }): Promise<{ gmailConnected: boolean }> {
  const g = google();
  if (!g || !googleConfigured) throw new Error('Google sign-in is not set up in this build.');
  const params: ConfigureParams = {
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    offlineAccess: opts.gmail,
    forceCodeForRefreshToken: opts.gmail,
    scopes: opts.gmail ? [GMAIL_SCOPE] : [],
  };
  g.GoogleSignin.configure(params);
  await g.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res: SignInResponse = await g.GoogleSignin.signIn();
  if (!g.isSuccessResponse(res)) throw new Error('Sign-in was cancelled.');
  const { idToken, serverAuthCode } = res.data;
  if (!idToken) throw new Error('Google returned no ID token. Check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');

  const auth = await api.googleLogin(idToken);
  await finish(auth);
  if (!opts.gmail) return { gmailConnected: false };
  if (!serverAuthCode) throw new Error('Gmail access was not granted.');
  const status = await api.gmailConnect(auth.token, serverAuthCode);
  useApp.getState().setSync({ gmail: { connected: status.connected, email: status.email } });
  return { gmailConnected: status.connected };
}

/** Email-only sign-in, accepted only by a server running with KHARCHA_DEV_LOGIN=true. */
export async function devSignIn(email: string): Promise<void> {
  const name = useApp.getState().profile.name || undefined;
  await finish(await api.devLogin(email.trim(), name));
}

export async function disconnectGmail(token: string | null): Promise<void> {
  await api.gmailDisconnect(token);
  useApp.getState().setSync({ gmail: { connected: false, email: null } });
}

export async function signOut(): Promise<void> {
  await google()?.GoogleSignin.signOut().catch(() => {});
  await clearAuthToken();
  useApp.getState().setAccount(null);
  useApp.getState().setSync({ gmail: { connected: false, email: null }, serverCursor: 0 });
}
