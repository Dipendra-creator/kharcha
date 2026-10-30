import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'kharcha.session';

/** The API session token lives in the OS keystore, never in the SQLite kv-store. */
export function authToken(): string | null {
  if (Platform.OS === 'web') return null;
  try {
    return SecureStore.getItem(KEY);
  } catch {
    return null;
  }
}

export async function saveAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY).catch(() => {});
}
