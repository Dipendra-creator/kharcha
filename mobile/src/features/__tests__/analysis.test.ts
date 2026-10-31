import { categoryBreakdown, hourlySpend, impulseWindow, rangeSummary, topMerchants } from '@/features/insights/insights';
import { buildReport } from '@/features/report/report';
import { roastBand, ruleVerdict } from '@/features/roast/roast';
import { detectSubscriptions } from '@/features/subscriptions/detect';
import type { Txn } from '@/lib/types';

let seq = 0;
function txn(patch: Partial<Txn> & Pick<Txn, 'amount' | 'merchant'>): Txn {
  seq += 1;
  return {
    id: `t${seq}`,
    type: 'debit',
    category: 'food',
    method: 'upi',
    occurredAt: new Date(2026, 9, 30, 13, 0).getTime(),
    source: 'manual',
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

describe('roast engine', () => {
  it('uses the PRD bands', () => {
    expect(roastBand(0, 0)).toBe('zero');
    expect(roastBand(1, 0.49)).toBe('buffett');
    expect(roastBand(1, 0.6)).toBe('good');
    expect(roastBand(1, 0.95)).toBe('borderline');
    expect(roastBand(1, 1.2)).toBe('over');
    expect(roastBand(1, 1.31)).toBe('bonfire');
  });

  it('is stable for the same day and plain when roasts are off', () => {
    const args = { spent: 2_600_00, budget: 2_000_00, ratio: 1.3, intensity: 'savage' as const, seed: '2026-10-30' };
    expect(ruleVerdict(args)).toBe(ruleVerdict(args));
    expect(ruleVerdict({ ...args, intensity: 'off' })).toBe("You went ₹600 over today's budget.");
  });
});

describe('insights', () => {
  const txns = [
    txn({ amount: 500_00, merchant: 'Swiggy', occurredAt: at(28, 23, 10) }),
    txn({ amount: 400_00, merchant: 'Zepto', category: 'groceries', occurredAt: at(29, 23, 40) }),
    txn({ amount: 600_00, merchant: 'Blinkit', category: 'groceries', occurredAt: at(30, 0, 20) }),
    txn({ amount: 250_00, merchant: 'Starbucks', occurredAt: at(30, 10) }),
    txn({ amount: 9_000_00, merchant: 'Rent', category: 'bills', excluded: true }),
    txn({ amount: 300_00, merchant: 'Refund', type: 'refund' }),
  ];

  it('excludes refunds and excluded rows from spend', () => {
    const cats = categoryBreakdown(txns);
    expect(cats.map((c) => c.category)).toEqual(['groceries', 'food']);
    expect(cats[0].amount).toBe(1_000_00);
  });

  it('ranks top merchants', () => {
    expect(topMerchants(txns, 2).map((m) => m.merchant)).toEqual(['Blinkit', 'Swiggy']);
  });

  it('detects a late-night impulse window', () => {
    expect(hourlySpend(txns)[23]).toBe(900_00);
    const w = impulseWindow(txns);
    expect(w).not.toBeNull();
    expect(w!.lateNight).toBe(true);
    expect(w!.count).toBe(3);
  });

  it('sums a calendar month against the base budget, skipping upcoming days', () => {
    const s = rangeSummary([
      // Rollover lifted day 2's budget to 2,500; savings must not count that 500 twice.
      { future: false, base: 2_000_00, budget: 2_000_00, spent: 1_500_00 },
      { future: false, base: 2_000_00, budget: 2_500_00, spent: 2_400_00 },
      { future: false, base: 2_000_00, budget: 1_900_00, spent: 2_600_00 },
      { future: true, base: 0, budget: 0, spent: 0 },
    ]);
    expect(s).toEqual({ spent: 6_500_00, saved: -500_00, underBudget: 2, elapsed: 3 });
  });
});

describe('subscription detection', () => {
  const now = at(30);

  it('finds a monthly charge with the same amount and predicts renewal', () => {
    const subs = detectSubscriptions(
      [
        txn({ amount: 649_00, merchant: 'Netflix', occurredAt: new Date(2026, 7, 5).getTime() }),
        txn({ amount: 649_00, merchant: 'Netflix', occurredAt: new Date(2026, 8, 5).getTime() }),
        txn({ amount: 649_00, merchant: 'Netflix', occurredAt: new Date(2026, 9, 5).getTime() }),
        txn({ amount: 250_00, merchant: 'Starbucks', occurredAt: new Date(2026, 9, 6).getTime() }),
        txn({ amount: 180_00, merchant: 'Starbucks', occurredAt: new Date(2026, 9, 8).getTime() }),
      ],
      now,
    );
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({ merchant: 'Netflix', cycle: 'monthly', count: 3, monthlyCost: 649_00 });
    expect(new Date(subs[0].nextDate).getMonth()).toBe(10);
    expect(new Date(subs[0].nextDate).getDate()).toBe(5);
  });

  it('drops a subscription that stopped recurring', () => {
    const subs = detectSubscriptions(
      [
        txn({ amount: 119_00, merchant: 'Spotify', occurredAt: new Date(2026, 3, 1).getTime() }),
        txn({ amount: 119_00, merchant: 'Spotify', occurredAt: new Date(2026, 4, 1).getTime() }),
      ],
      now,
    );
    expect(subs).toHaveLength(0);
  });

  it('flags a known subscription merchant seen once as likely', () => {
    const subs = detectSubscriptions([txn({ amount: 1_999_00, merchant: 'Claude', occurredAt: at(12) })], now);
    expect(subs[0]).toMatchObject({ confidence: 'likely', category: 'subscriptions' });
  });
});

describe('nightly report', () => {
  it('summarises the day', () => {
    const txns = [
      txn({ amount: 500_00, merchant: 'Swiggy' }),
      txn({ amount: 400_00, merchant: 'Zepto', category: 'groceries' }),
      txn({ amount: 1_200_00, merchant: 'Myntra', category: 'shopping' }),
    ];
    const r = buildReport({
      day: { key: '2026-10-30', budget: 2_000_00, spent: 2_100_00, remaining: -100_00, ratio: 1.05 },
      txns,
      intensity: 'savage',
      tomorrowBudget: 1_950_00,
      rollover: true,
    });
    expect(r.state).toBe('over');
    expect(r.biggest?.merchant).toBe('Myntra');
    expect(r.quickOrders).toBe(2);
    expect(r.topCategory?.category).toBe('shopping');
    expect(r.suggestion).toContain('2 delivery');
  });
});
