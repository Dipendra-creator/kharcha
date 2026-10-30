import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { Category } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const categoryMeta: Record<Category, { label: string; icon: IconName }> = {
  food: { label: 'Food', icon: 'fast-food' },
  groceries: { label: 'Groceries', icon: 'basket' },
  shopping: { label: 'Shopping', icon: 'bag-handle' },
  travel: { label: 'Travel', icon: 'car' },
  subscriptions: { label: 'Subscriptions', icon: 'repeat' },
  bills: { label: 'Bills', icon: 'receipt' },
  health: { label: 'Health', icon: 'medkit' },
  entertainment: { label: 'Fun', icon: 'film' },
  transfers: { label: 'Transfers', icon: 'swap-horizontal' },
  other: { label: 'Other', icon: 'ellipsis-horizontal' },
};

export const methodLabel = {
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Netbanking',
  wallet: 'Wallet',
  cash: 'Cash',
} as const;
