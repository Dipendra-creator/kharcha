import { netRefunds, spendByDay } from '@/features/budget/refunds';
import type { Txn } from '@/lib/types';

let seq = 0;
function txn(patch: Partial<Txn> & Pick<Txn, 'amount' | 'merchant' | 'occurredAt'>): Txn {
  seq += 1;
  return {
    id: `t${seq}`,
    type: 'debit',
    category: 'other',
    method: 'upi',
    source: 'sms',
    sourceRef: null,
    accountHint: null,
    upiRef: null,
    orderId: null,
    note: null,
    items: null,
    confidence: 1,
    status: 'confirmed',
    excluded: false,
    dedupeGroup: null,
    mergedInto: null,
    createdAt: 0,
    updatedAt: 0,
    syncedAt: null,
    deleted: false,
    ...patch,
  };
}

const at = (d: number, h = 12, m = 0) => new Date(2026, 9, d, h, m).getTime();

describe('refunds', () => {
  it('cancels a payment reversed the same day', () => {
    const days = spendByDay([
      txn({ amount: 1_500_00, merchant: 'Airtel', occurredAt: at(29, 19, 37) }),
      txn({ amount: 1_500_00, merchant: 'Airtel', type: 'credit', occurredAt: at(29, 21, 39) }),
      txn({ amount: 353_40, merchant: 'Domino’s', occurredAt: at(29, 19, 41) }),
    ]);
    expect(days['2026-10-29']).toBe(353_40);
  });

  it('lowers the day of the purchase when a partial refund arrives later', () => {
    const days = spendByDay([
      txn({ amount: 2_000_00, merchant: 'Flipkart', occurredAt: at(10) }),
      txn({ amount: 500_00, merchant: 'flipkart', type: 'refund', occurredAt: at(20) }),
    ]);
    expect(days).toEqual({ '2026-10-10': 1_500_00 });
  });

  it('keeps credits that return nothing as income', () => {
    const { spends, unmatched } = netRefunds([
      txn({ amount: 400_00, merchant: 'Swiggy', occurredAt: at(5) }),
      txn({ amount: 90_000_00, merchant: 'Payroll', type: 'credit', occurredAt: at(5) }),
      // Same merchant but a different amount: not a reversal.
      txn({ amount: 100_00, merchant: 'Swiggy', type: 'credit', occurredAt: at(6) }),
      // Exact amount but too late to be a reversal.
      txn({ amount: 400_00, merchant: 'Swiggy', type: 'credit', occurredAt: at(20) }),
    ]);
    expect(spends.map((s) => s.amount)).toEqual([400_00]);
    expect(unmatched).toEqual([]);
  });

  it('applies a refund with no purchase to its own day, never below zero', () => {
    const days = spendByDay([
      txn({ amount: 300_00, merchant: 'Zepto', occurredAt: at(12) }),
      txn({ amount: 250_00, merchant: 'Myntra', type: 'refund', occurredAt: at(12, 18) }),
      txn({ amount: 999_00, merchant: 'Ajio', type: 'refund', occurredAt: at(13) }),
    ]);
    expect(days).toEqual({ '2026-10-12': 50_00, '2026-10-13': 0 });
  });

  it('ignores refunds the user excluded or deleted', () => {
    const days = spendByDay([
      txn({ amount: 700_00, merchant: 'Uber', occurredAt: at(3) }),
      txn({ amount: 700_00, merchant: 'Uber', type: 'refund', occurredAt: at(4), excluded: true }),
      txn({ amount: 700_00, merchant: 'Uber', type: 'refund', occurredAt: at(4), deleted: true }),
    ]);
    expect(days['2026-10-03']).toBe(700_00);
  });
});
