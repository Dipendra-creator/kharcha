import { normaliseMerchant } from '@/lib/merchants';

describe('normaliseMerchant', () => {
  it('turns payee handles into names', () => {
    expect(normaliseMerchant('zepto.payu@hdfcbank')).toBe('Zepto');
    expect(normaliseMerchant('neha.kapoor@okaxis')).toBe('Neha Kapoor');
    expect(normaliseMerchant('SHARMA GENERAL STORE 8812')).toBe('Sharma General Store');
  });

  it('drops machine ids instead of showing them as the merchant', () => {
    expect(normaliseMerchant('019fb1a26dd874b2b693fc80373984e2@hdfcbank')).toBe('UPI payment');
    expect(normaliseMerchant('019fb1a26dd874b2b693fc80373984e2')).toBe('Unknown merchant');
    expect(normaliseMerchant('cafe.mocha.a1b2c3d4e5f6@ybl')).toBe('Cafe Mocha');
  });

  it('keeps short words that mix letters and digits', () => {
    expect(normaliseMerchant('Studio 9X')).toBe('Studio 9X');
  });
});
