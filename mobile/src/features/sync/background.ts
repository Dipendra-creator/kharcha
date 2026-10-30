import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { useApp } from '@/store/app-store';

import { syncNow } from './sync';

export const BACKGROUND_SYNC = 'kharcha-background-sync';

// Must be defined at module scope so the OS can wake the task without the UI.
if (Platform.OS !== 'web') {
  TaskManager.defineTask(BACKGROUND_SYNC, async () => {
    try {
      if (!useApp.getState().onboarded) return BackgroundTask.BackgroundTaskResult.Success;
      await syncNow();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Registers or removes the ~4-hourly background sync to match the setting. */
export async function applyBackgroundSync(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC);
  if (enabled && !registered) await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC, { minimumInterval: 240 });
  if (!enabled && registered) await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC);
}
