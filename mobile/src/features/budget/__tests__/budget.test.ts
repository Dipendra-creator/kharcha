import { cycleFor, dayKey } from '@/lib/dates';

import { budgetState, computeCycleBudget, dailyBase, type BudgetInput } from '../budget';

const input = (patch: Partial<BudgetInput> = {}): BudgetInput => ({
  salary: 90_000_00,
  fixedCosts: 28_000_00,
  payday: 1,
  rollover: false,
  redistributeOverspend: false,
  ...patch,
});

describe('cycleFor', () => {
  it('is the calendar month when payday is the 1st', () => {
    const c = cycleFor(new Date(2026, 9, 30), 1);
    expect(dayKey(c.start)).toBe('2026-10-01');
    expect(dayKey(c.end)).toBe('2026-11-01');
    expect(c.days).toBe(31);
  });

  it('runs payday to payday and clamps to short months', () => {
    const c = cycleFor(new Date(2026, 1, 10), 31);
    expect(dayKey(c.start)).toBe('2026-01-31');
    expect(dayKey(c.end)).toBe('2026-02-28');
    expect(c.days).toBe(28);
  });

  it('starts on payday itself', () => {
    expect(dayKey(cycleFor(new Date(2026, 9, 25), 25).start)).toBe('2026-10-25');
    expect(dayKey(cycleFor(new Date(2026, 9, 24), 25).start)).toBe('2026-09-25');
  });
});

describe('daily budget formula', () => {
  it('is (salary − fixed costs) ÷ days in the month', () => {
    // (90,000 − 28,000) ÷ 31 = 2,000
    expect(dailyBase(input(), new Date(2026, 9, 5))).toBe(2_000_00);
  });

  it('never goes negative when fixed costs exceed salary', () => {
    expect(dailyBase(input({ fixedCosts: 1_00_000_00 }), new Date(2026, 9, 5))).toBe(0);
  });
});

describe('computeCycleBudget', () => {
  const now = new Date(2026, 9, 3, 15, 0); // 3 Oct: two closed days

  it('without rollover/overspend every day gets the base', () => {
    const r = computeCycleBudget(input(), { '2026-10-01': 500_00, '2026-10-02': 3_000_00 }, now);
    expect(r.today.budget).toBe(2_000_00);
    expect(r.todayIndex).toBe(2);
  });

  it('spreads unspent money over the remaining days when rollover is on', () => {
    // Day 1 leaves 1,500 unspent → +1,500/30 = +50 for each later day.
    const r = computeCycleBudget(input({ rollover: true }), { '2026-10-01': 500_00 }, new Date(2026, 9, 2));
    expect(r.today.budget).toBeCloseTo(2_050_00, 5);
  });

  it('reduces later days proportionally after an overspend', () => {
    // Day 1 overspends by 3,000 → −3,000/30 = −100 for each later day.
    const r = computeCycleBudget(
      input({ redistributeOverspend: true }),
      { '2026-10-01': 5_000_00 },
      new Date(2026, 9, 2),
    );
    expect(r.today.budget).toBeCloseTo(1_900_00, 5);
    expect(r.days[30].budget).toBeCloseTo(1_900_00, 5);
  });

  it('ignores overspend when the setting is off', () => {
    const r = computeCycleBudget(input({ rollover: true }), { '2026-10-01': 5_000_00 }, new Date(2026, 9, 2));
    expect(r.today.budget).toBe(2_000_00);
  });

  it('keeps the cycle total intact when both settings are on', () => {
    const spent = { '2026-10-01': 500_00, '2026-10-02': 3_700_00 };
    const r = computeCycleBudget(input({ rollover: true, redistributeOverspend: true }), spent, now);
    const allocated = r.days.slice(r.todayIndex).reduce((s, d) => s + d.budget, 0);
    expect(allocated + 500_00 + 3_700_00).toBeCloseTo(r.disposable, 3);
  });

  it("today's remaining goes negative when over budget", () => {
    const r = computeCycleBudget(input(), { '2026-10-03': 2_600_00 }, now);
    expect(r.today.remaining).toBe(-600_00);
    expect(budgetState(r.today.ratio)).toBe('over');
  });

  it('does not roll over days before tracking started (mid-month signup)', () => {
    const r = computeCycleBudget(
      input({ rollover: true, trackingStart: new Date(2026, 9, 30, 11).getTime() }),
      {},
      new Date(2026, 9, 30, 12),
    );
    expect(r.today.budget).toBe(2_000_00);
    expect(r.activeFrom).toBe(29);
    expect(r.available).toBe(4_000_00);
  });

  it('rolls over from the tracking start onwards', () => {
    const r = computeCycleBudget(
      input({ rollover: true, trackingStart: new Date(2026, 9, 29, 9).getTime() }),
      { '2026-10-29': 1_000_00 },
      new Date(2026, 9, 30, 12),
    );
    // 1,000 unspent on the 29th spread over the last 2 days.
    expect(r.today.budget).toBe(2_500_00);
  });

  it('projects month-end savings at the current pace', () => {
    // 3 days at 1,000/day → 31,000 projected spend vs 62,000 disposable.
    const spent = { '2026-10-01': 1_000_00, '2026-10-02': 1_000_00, '2026-10-03': 1_000_00 };
    const r = computeCycleBudget(input(), spent, now);
    expect(r.projectedSavings).toBeCloseTo(31_000_00, 3);
  });
});

describe('budgetState', () => {
  it('maps the spend ratio to calm → warning → over', () => {
    expect(budgetState(0.5)).toBe('calm');
    expect(budgetState(0.85)).toBe('warning');
    expect(budgetState(1)).toBe('warning');
    expect(budgetState(1.01)).toBe('over');
  });
});
