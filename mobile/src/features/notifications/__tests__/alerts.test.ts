import { spendAlertText } from '@/features/notifications/spend-alert-text';

describe('spend alerts', () => {
  it('names a single spend and what is left', () => {
    expect(spendAlertText([{ merchant: 'Swiggy', amount: 420_00 }], { remaining: 1_580_00, ratio: 0.21 })).toEqual({
      title: '₹420 at Swiggy',
      body: '₹1,580 left today.',
    });
  });

  it('sums several spends and warns near or over the limit', () => {
    const two = [
      { merchant: 'Zepto', amount: 300_00 },
      { merchant: 'Uber', amount: 1_400_00 },
    ];
    expect(spendAlertText(two, { remaining: 300_00, ratio: 0.85 })).toEqual({
      title: '2 new spends · ₹1,700',
      body: 'Careful: only ₹300 left today.',
    });
    expect(spendAlertText(two, { remaining: -120_00, ratio: 1.06 })?.body).toBe("₹120 over today's budget.");
  });

  it('says nothing without new spends', () => {
    expect(spendAlertText([], { remaining: 0, ratio: 1 })).toBeNull();
  });
});
