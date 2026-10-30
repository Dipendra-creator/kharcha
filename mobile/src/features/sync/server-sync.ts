import { getTxn, listUnsynced, markSynced, upsertMany } from '@/db/transactions';
import { authToken } from '@/features/account/session';
import { api, ApiError, type WireTxn } from '@/lib/api';
import type { Txn } from '@/lib/types';
import { useApp } from '@/store/app-store';

import type { SyncStep } from './sync';

const PAGE = 500;

/** Pulls server changes (email receipts, SMS↔email merges) since the stored cursor. */
export async function pullChanges(token: string): Promise<number> {
  let pulled = 0;
  for (;;) {
    const { serverCursor } = useApp.getState().sync;
    const { transactions, cursor } = await api.pullTransactions(token, serverCursor);
    const now = Date.now();
    // A local edit that hasn't reached the server yet beats the server copy.
    const incoming: Txn[] = transactions
      .filter((t) => {
        const local = getTxn(t.id);
        return !local || local.syncedAt !== null || local.updatedAt <= t.updatedAt;
      })
      .map((t: WireTxn) => ({ ...t, syncedAt: now }));
    upsertMany(incoming);
    pulled += incoming.length;
    useApp.getState().setSync({ serverCursor: cursor });
    if (transactions.length < PAGE) return pulled;
  }
}

/**
 * Pushes local changes, asks the server to sync Gmail, and pulls what changed.
 * The Gmail job runs on the server, so its results are pulled again shortly after.
 */
export const serverSyncStep: SyncStep = async (summary) => {
  const token = authToken();
  if (!useApp.getState().account || !token) return;
  try {
    const unsynced = listUnsynced();
    for (let i = 0; i < unsynced.length; i += PAGE) {
      const batch = unsynced.slice(i, i + PAGE).map(({ syncedAt: _s, ...t }) => t);
      const { accepted } = await api.pushTransactions(token, batch);
      markSynced(accepted);
      summary.pushed += accepted.length;
    }

    if (useApp.getState().sync.gmail.connected) {
      await api.gmailSync(token).catch(() => {});
      setTimeout(() => {
        pullChanges(token).catch(() => {});
      }, 12_000);
    }
    summary.pulled += await pullChanges(token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      summary.errors.push('Signed out of the Kharcha server — sign in again under Sources');
      return;
    }
    summary.errors.push(`Server sync: ${e instanceof Error ? e.message : String(e)}`);
  }
};
