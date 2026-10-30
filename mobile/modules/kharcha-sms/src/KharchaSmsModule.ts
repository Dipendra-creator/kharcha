import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { RawSms } from './KharchaSms.types';

declare class KharchaSmsModule extends NativeModule<Record<string, never>> {
  isAvailable(): boolean;
  /** Finance SMS received after `sinceMs`, oldest first, at most `limit`. */
  readInbox(sinceMs: number, limit: number, senders: string[]): Promise<RawSms[]>;
  /** Notification-listener fallback (no READ_SMS): has the user granted access? */
  hasNotificationAccess(): boolean;
  openNotificationAccessSettings(): boolean;
  /** Payment notifications captured after `sinceMs`, oldest first. */
  readNotifications(sinceMs: number, limit: number): Promise<RawSms[]>;
  clearNotifications(): boolean;
}

/** Null when the native module isn't in the binary (e.g. Expo Go). */
export default requireOptionalNativeModule<KharchaSmsModule>('KharchaSms');
