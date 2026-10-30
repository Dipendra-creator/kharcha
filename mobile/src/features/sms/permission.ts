import { PermissionsAndroid, Platform } from 'react-native';

export const smsSupported = Platform.OS === 'android';

export async function hasSmsPermission(): Promise<boolean> {
  if (!smsSupported) return false;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
}

export async function requestSmsPermission(): Promise<boolean> {
  if (!smsSupported) return false;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
    title: 'Read bank SMS alerts',
    message:
      'Kharcha reads debit/credit alerts from banks, UPI apps and wallets to deduct spends automatically. OTPs and personal messages are dropped on your phone and never uploaded.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}
