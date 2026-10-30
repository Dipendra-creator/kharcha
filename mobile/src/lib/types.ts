import type { Category } from '@/theme/tokens';

export type { Category };

export type TxnType = 'debit' | 'credit' | 'refund';
export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'wallet' | 'cash';
export type TxnSource = 'sms' | 'email' | 'manual';
export type TxnStatus = 'confirmed' | 'review' | 'ignored';

export type Txn = {
  id: string;
  /** Integer paise, always positive; direction comes from `type`. */
  amount: number;
  type: TxnType;
  merchant: string;
  category: Category;
  method: PaymentMethod | null;
  occurredAt: number;
  source: TxnSource;
  /** Hash of the SMS/email the row came from — never the raw text. */
  sourceRef: string | null;
  accountHint: string | null;
  upiRef: string | null;
  orderId: string | null;
  note: string | null;
  /** Line items from an email receipt, if any. */
  items: string[] | null;
  confidence: number;
  status: TxnStatus;
  /** Self-transfer, fixed cost already budgeted, or user-excluded: not daily spend. */
  excluded: boolean;
  dedupeGroup: string | null;
  /** Set when this row was merged into another (SMS ↔ email duplicate). */
  mergedInto: string | null;
  createdAt: number;
  updatedAt: number;
  syncedAt: number | null;
  deleted: boolean;
};

export type NewTxn = Pick<Txn, 'amount' | 'type' | 'merchant' | 'category' | 'occurredAt' | 'source'> &
  Partial<Omit<Txn, 'createdAt' | 'updatedAt'>>;

/** Whether a transaction counts toward the day's spend. */
export function countsAsSpend(t: Pick<Txn, 'type' | 'status' | 'excluded' | 'deleted' | 'mergedInto'>): boolean {
  return t.type === 'debit' && t.status !== 'ignored' && !t.excluded && !t.deleted && !t.mergedInto;
}
