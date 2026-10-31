import { File, Paths } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';
import * as Sharing from 'expo-sharing';

import { wipeDatabase } from '@/db/client';
import { listRules, listSummaries, recentSyncRuns } from '@/db/meta';
import { listAll } from '@/db/transactions';
import { cancelAllNotifications } from '@/features/notifications/nightly';
import { bumpData, useApp } from '@/store/app-store';

/** DPDP data export: everything Kharcha holds about you, as JSON, via the share sheet. */
export async function exportMyData(): Promise<void> {
  const { profile, settings, consentAt } = useApp.getState();
  const payload = {
    exportedAt: new Date().toISOString(),
    consentAt: consentAt ? new Date(consentAt).toISOString() : null,
    profile,
    settings,
    transactions: listAll(),
    merchantRules: listRules(),
    dailySummaries: listSummaries(),
    syncRuns: recentSyncRuns(100),
  };
  const file = new File(Paths.cache, `kharcha-export-${Date.now()}.json`);
  file.create({ overwrite: true });
  file.writeSync(JSON.stringify(payload, null, 2));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Export Kharcha data', UTI: 'public.json' });
}

/**
 * DPDP "delete everything": the local database, settings and scheduled
 * notifications. Returns to onboarding.
 */
export async function deleteEverything(): Promise<void> {
  wipeDatabase();
  await cancelAllNotifications().catch(() => {});
  useApp.getState().reset();
  Storage.clearSync();
  bumpData();
}
