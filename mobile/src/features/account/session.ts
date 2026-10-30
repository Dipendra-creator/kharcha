import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { api } from '@/lib/api';
import { useApp } from '@/store/app-store';

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

/** Whether server features (AI, sync, backup) are usable: signed in, or the server needs no sign-in. */
export function canUseServer(): boolean {
  return useApp.getState().sync.serverOpen || !!authToken();
}

/** Asks the server whether it requires sign-in. Offline leaves the last known answer. */
export async function refreshServerMode(): Promise<void> {
  try {
    const health = await api.health();
    useApp.getState().setSync({ serverOpen: health.auth === 'none' });
  } catch {
    // keep previous value
  }
}
