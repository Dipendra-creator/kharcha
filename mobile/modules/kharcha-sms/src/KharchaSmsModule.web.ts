import { NativeModule, registerWebModule } from 'expo';

import type { RawSms } from './KharchaSms.types';

class KharchaSmsModule extends NativeModule<Record<string, never>> {
  isAvailable(): boolean {
    return false;
  }
  async readInbox(): Promise<RawSms[]> {
    return [];
  }
  hasNotificationAccess(): boolean {
    return false;
  }
  openNotificationAccessSettings(): boolean {
    return false;
  }
  async readNotifications(): Promise<RawSms[]> {
    return [];
  }
  clearNotifications(): boolean {
    return true;
  }
}

export default registerWebModule(KharchaSmsModule, 'KharchaSms');
