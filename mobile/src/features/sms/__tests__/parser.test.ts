import { findSelfTransfers, parseSms } from '../parser';
import { NON_TRANSACTIONS, TRANSACTIONS } from '../__fixtures__/sms';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

describe('SMS parser accuracy (PRD: ≥ 95% on 100+ samples)', () => {
  const results = TRANSACTIONS.map((s) => {
    const r = parseSms(s.body, s.sender);
    const p = r.kind === 'parsed' ? r.parsed : null;
    const ok = !!p && p.type === s.type && p.amount === Math.round(s.amount * 100) && norm(p.merchant) === norm(s.merchant);
    return { s, r, ok };
  });

  it('has at least 100 transaction samples', () => {
    expect(TRANSACTIONS.length).toBeGreaterThanOrEqual(100);
  });

  it('extracts amount, merchant and type from ≥ 95% of samples', () => {
    const failures = results
      .filter((x) => !x.ok)
      .map((x) => ({
        expected: `${x.s.type} ${x.s.amount} ${x.s.merchant}`,
        got: x.r.kind === 'parsed' ? `${x.r.parsed.type} ${x.r.parsed.amount / 100} ${x.r.parsed.merchant}` : `skip:${x.r.reason}`,
        body: x.s.body.slice(0, 90),
      }));
    const accuracy = 1 - failures.length / results.length;
    if (accuracy < 1) console.log(`Parser accuracy ${(accuracy * 100).toFixed(1)}%`, failures);
    expect(accuracy).toBeGreaterThanOrEqual(0.95);
  });

  it('gets the amount and direction right on every sample', () => {
    const wrong = results.filter(
      (x) => x.r.kind !== 'parsed' || x.r.parsed.amount !== Math.round(x.s.amount * 100) || x.r.parsed.type !== x.s.type,
    );
    expect(wrong.map((x) => x.s.body.slice(0, 80))).toEqual([]);
  });

  it('is confident (≥ 0.7) on most well-formed alerts', () => {
    const confident = results.filter((x) => x.r.kind === 'parsed' && x.r.parsed.confidence >= 0.7).length;
    expect(confident / results.length).toBeGreaterThan(0.85);
  });
});

describe('pre-filter', () => {
  it.each(NON_TRANSACTIONS.map((s) => [s.body.slice(0, 60), s]))('skips: %s', (_, s) => {
    expect(parseSms(s.body, s.sender).kind).toBe('skip');
  });
});

describe('details', () => {
  it('reads account hints, method and UPI ref', () => {
    const r = parseSms(TRANSACTIONS[2].body, TRANSACTIONS[2].sender);
    expect(r.kind === 'parsed' && r.parsed).toMatchObject({
      method: 'upi',
      upiRef: '430312345680',
      accountHint: 'HDFC Bank a/c ••1234',
      category: 'groceries',
    });
  });

  it('reads UPI refs from UPI/P2M/<ref>/ paths', () => {
    const axis = TRANSACTIONS.find((s) => s.body.includes('UPI/P2M/430312345694'))!;
    const r = parseSms(axis.body, axis.sender);
    expect(r.kind === 'parsed' && r.parsed.upiRef).toBe('430312345694');
  });

  it('treats ATM withdrawals as self transfers (cash is logged manually)', () => {
    const atm = TRANSACTIONS.find((s) => s.body.includes('withdrawn at SBI ATM'))!;
    const r = parseSms(atm.body, atm.sender);
    expect(r.kind === 'parsed' && r.parsed.selfTransfer).toBe(true);
  });

  it('marks person-to-person payments as transfers', () => {
    const p2p = TRANSACTIONS.find((s) => s.merchant === 'Ankit Verma')!;
    const r = parseSms(p2p.body, p2p.sender);
    expect(r.kind === 'parsed' && r.parsed.category).toBe('transfers');
  });

  it('pairs a debit and credit of the same amount on different accounts as a self transfer', () => {
    const t = Date.now();
    const pairs = findSelfTransfers([
      { type: 'debit', amount: 10_000_00, accountHint: 'HDFC Bank a/c ••1234', occurredAt: t },
      { type: 'credit', amount: 10_000_00, accountHint: 'SBI a/c ••9876', occurredAt: t + 60_000 },
      { type: 'debit', amount: 250_00, accountHint: 'HDFC Bank a/c ••1234', occurredAt: t },
    ]);
    expect([...pairs].sort()).toEqual([0, 1]);
  });
});
