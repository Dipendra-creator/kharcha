import { closestFixedCost, FIXED_COST_NOTE, matchFixedCosts } from '@/features/budget/fixed-costs';
import type { Txn } from '@/lib/types';
import type { FixedCost } from '@/store/app-store';

let seq = 0;
function txn(patch: Partial<Txn> & Pick<Txn, 'amount' | 'merchant' | 'occurredAt'>): Txn {
  seq += 1;
  return {
    id: `t${seq}`,
    type: 'debit',
    category: 'transfers',
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

const at = (month: number, d: number) => new Date(2026, month, d, 12).getTime();
const rent: FixedCost = { id: 'rent', label: 'Rent', amount: 28_000_00, kind: 'rent' };
const sip: FixedCost = { id: 'sip', label: 'SIP', amount: 5_000_00, kind: 'sip' };

describe('fixed costs', () => {
  it('finds the closest cost within 15%', () => {
    expect(closestFixedCost(30_000_00, [rent, sip])?.id).toBe('rent');
    expect(closestFixedCost(5_200_00, [rent, sip])?.id).toBe('sip');
    expect(closestFixedCost(40_000_00, [rent, sip])).toBeNull();
  });

  it('asks about a payment that looks like rent, once per cost', () => {
    const newer = txn({ amount: 30_000_00, merchant: 'Pratibha Dhiman', occurredAt: at(9, 22) });
    const older = txn({ amount: 28_000_00, merchant: 'Pratibha Dhiman', occurredAt: at(9, 2) });
    const coffee = txn({ amount: 250_00, merchant: 'Starbucks', occurredAt: at(9, 22) });
    const { known, ask } = matchFixedCosts([older, coffee, newer], [rent], []);
    expect(known).toEqual([]);
    expect(ask.map((a) => a.txn.id)).toEqual([newer.id]);
  });

  it("doesn't ask again after a no, or when the cost is already marked that month", () => {
    const paid = txn({ amount: 28_000_00, merchant: 'Landlord', occurredAt: at(9, 1), excluded: true, note: `${FIXED_COST_NOTE}Rent` });
    const deposit = txn({ amount: 29_000_00, merchant: 'Someone', occurredAt: at(9, 5) });
    const dismissed = txn({ amount: 27_000_00, merchant: 'Friend', occurredAt: at(10, 3) });
    expect(matchFixedCosts([paid, deposit, dismissed], [rent], [dismissed.id]).ask).toEqual([]);
  });

  it('marks payments to the confirmed payee without asking, one per month', () => {
    const landlord = { ...rent, payee: 'pratibha dhiman' };
    const sept = txn({ amount: 28_000_00, merchant: 'Pratibha Dhiman', occurredAt: at(8, 22) });
    const oct = txn({ amount: 28_500_00, merchant: 'PRATIBHA DHIMAN', occurredAt: at(9, 22) });
    const secondInOct = txn({ amount: 28_000_00, merchant: 'Pratibha Dhiman', occurredAt: at(9, 25) });
    const otherPerson = txn({ amount: 28_000_00, merchant: 'Ankit', occurredAt: at(9, 10) });
    const { known, ask } = matchFixedCosts([sept, oct, secondInOct, otherPerson], [landlord], []);
    const ids = known.map((k) => k.txn.id);
    expect(ids).toHaveLength(2);
    expect(ids).toContain(sept.id);
    expect(ids).not.toContain(otherPerson.id);
    expect(ask).toEqual([]);
  });
});
