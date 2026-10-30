import { formatINR, groupIndian, parseAmount, spokenINR } from '../money';

describe('formatINR', () => {
  it('uses Indian digit grouping', () => {
    expect(groupIndian('100000')).toBe('1,00,000');
    expect(groupIndian('12345678')).toBe('1,23,45,678');
    expect(formatINR(1_00_000_00)).toBe('₹1,00,000');
    expect(formatINR(999_00)).toBe('₹999');
  });

  it('shows paise only when present in auto mode', () => {
    expect(formatINR(249_50)).toBe('₹249.50');
    expect(formatINR(249_00, { decimals: 2 })).toBe('₹249.00');
    expect(formatINR(249_60, { decimals: 0 })).toBe('₹250');
  });

  it('signs and compacts', () => {
    expect(formatINR(-600_00)).toBe('−₹600');
    expect(formatINR(500_00, { signed: true })).toBe('+₹500');
    expect(formatINR(1_25_000_00, { compact: true })).toBe('₹1.25L');
    expect(formatINR(12_500_00, { compact: true })).toBe('₹12.5K');
    expect(formatINR(2_10_00_000_00, { compact: true })).toBe('₹2.1Cr');
  });
});

describe('spokenINR', () => {
  it('reads rupees and paise', () => {
    expect(spokenINR(1_240_50)).toBe('1,240 rupees 50 paise');
    expect(spokenINR(-100)).toBe('minus 1 rupee');
  });
});

describe('parseAmount', () => {
  it('parses bank-style amounts', () => {
    expect(parseAmount('Rs.1,23,456.78')).toBe(1_23_456_78);
    expect(parseAmount('INR 250')).toBe(250_00);
    expect(parseAmount('₹ 99.5')).toBe(99_50);
    expect(parseAmount('abc')).toBeNull();
  });
});
