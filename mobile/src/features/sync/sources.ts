import { smsSyncStep } from '@/features/sms/sms-sync';

import './background';
import { registerSyncStep } from './sync';

/** Wires the platform sync sources into `syncNow`. Called once at startup. */
export function registerSources(): void {
  registerSyncStep(smsSyncStep);
}
