import { File, Paths } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';
import * as Sharing from 'expo-sharing';

import { wipeDatabase } from '@/db/client';
import { listRules, listSubscriptions, listSummaries, recentSyncRuns } from '@/db/meta';
import { listAll } from '@/db/transactions';
import { cancelAllNotifications } from '@/features/notifications/nightly';
import { api } from '@/lib/api';
import { bumpData, useApp } from '@/store/app-store';

import { authToken, canUseServer, clearAuthToken } from './session';

/** DPDP data export: everything Kharcha holds about you, as JSON, via the share sheet. */
export async function exportMyData(): Promise<void> {
  const { profile, settings, consentAt } = useApp.getState();
  let server: unknown = null;
  if (canUseServer()) {
    try {
      server = await api.exportAll(authToken());
    } catch {
      server = { error: 'Server unreachable; local data only.' };
    }
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    consentAt: consentAt ? new Date(consentAt).toISOString() : null,
    profile,
    settings,
    transactions: listAll(),
    merchantRules: listRules(),
    subscriptions: listSubscriptions(),
    dailySummaries: listSummaries(),
    syncRuns: recentSyncRuns(100),
    server,
  };
  const file = new File(Paths.cache, `kharcha-export-${Date.now()}.json`);
  file.create({ overwrite: true });
  file.writeSync(JSON.stringify(payload, null, 2));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export Kharcha data', UTI: 'public.json' });
}

/**
 * DPDP "delete everything": server account + data (if signed in), the local
 * database, settings and scheduled notifications. Returns to onboarding.
 * Throws if the server can't be reached, unless `localOnly` is set, so server
 * data is never silently left behind.
 */
export async function deleteEverything(opts: { localOnly?: boolean } = {}): Promise<void> {
  if (canUseServer() && !opts.localOnly) await api.deleteAccount(authToken());
  wipeDatabase();
  await cancelAllNotifications().catch(() => {});
  await clearAuthToken();
  useApp.getState().reset();
  Storage.clearSync();
  bumpData();
}
