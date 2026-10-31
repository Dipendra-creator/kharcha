import * as BackgroundTask from 'expo-background-task';
import Storage from 'expo-sqlite/kv-store';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { alertNewSpends } from '@/features/notifications/spend-alerts';
import { useApp } from '@/store/app-store';

import { syncNow } from './sync';

export const BACKGROUND_SYNC = 'kharcha-background-sync';
/** Minutes. Android's floor; short enough for spend alerts to feel live. The OS may stretch it. */
const INTERVAL = 15;
const INTERVAL_KEY = 'kharcha.backgroundSyncInterval';

// Must be defined at module scope so the OS can wake the task without the UI.
if (Platform.OS !== 'web') {
  TaskManager.defineTask(BACKGROUND_SYNC, async () => {
    try {
      if (!useApp.getState().onboarded) return BackgroundTask.BackgroundTaskResult.Success;
      await syncNow();
      await alertNewSpends();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Registers or removes the background sync to match the setting. */
export async function applyBackgroundSync(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  let registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC);
  // Earlier versions registered every 4 hours; a registration keeps its interval until replaced.
  if (enabled && registered && Storage.getItemSync(INTERVAL_KEY) !== String(INTERVAL)) {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC);
    registered = false;
  }
  if (enabled && !registered) {
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC, { minimumInterval: INTERVAL });
    Storage.setItemSync(INTERVAL_KEY, String(INTERVAL));
  }
  if (!enabled && registered) await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC);
}
