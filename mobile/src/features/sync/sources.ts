import { smsSyncStep } from '@/features/sms/sms-sync';

import './background';
import { serverSyncStep } from './server-sync';
import { registerSyncStep } from './sync';

/** Wires the platform sync sources into `syncNow`. Called once at startup. SMS runs first so the server can match email receipts against it. */
export function registerSources(): void {
  registerSyncStep(smsSyncStep);
  registerSyncStep(serverSyncStep);
}
