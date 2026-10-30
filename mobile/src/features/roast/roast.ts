import type { RoastIntensity } from '@/store/app-store';
import { formatINR } from '@/lib/money';

export type RoastBand = 'zero' | 'buffett' | 'good' | 'borderline' | 'over' | 'bonfire';

/** PRD bands: < 50% · 50–85% · 85–100% · 100–130% · > 130%. */
export function roastBand(spent: number, ratio: number): RoastBand {
  if (spent <= 0) return 'zero';
  if (ratio < 0.5) return 'buffett';
  if (ratio < 0.85) return 'good';
  if (ratio <= 1) return 'borderline';
  if (ratio <= 1.3) return 'over';
  return 'bonfire';
}

// Playful Hinglish, only ever about the spending — never the person.
const LINES: Record<Exclude<RoastIntensity, 'off'>, Record<RoastBand, string[]>> = {
  savage: {
    zero: [
      'Zero kharcha! Wallet ne aaj chhutti li.',
      'Aaj UPI PIN bhi bhool gaye kya? Respect.',
      'Ek rupaya nahi gaya. Sant mode activated.',
    ],
    buffett: [
      'Kya baat hai, aaj toh Warren Buffett mode on.',
      'Itna kam kharcha? Mummy ko screenshot bhejo.',
      'Aaj wallet ne chain ki saans li.',
    ],
    good: [
      'Badhiya, budget mein rahe.',
      'Kharcha bhi kiya, budget bhi bachaya. Sahi khel gaye.',
      'Control mein ho. Aise hi chalo.',
    ],
    borderline: [
      'Borderline tha bro, ek aur Zepto order aur kahani khatam.',
      'Budget ka last over tha, bas bach gaye.',
      'Itna close? Kal thoda dhyaan se.',
    ],
    over: [
      "Bro, you're working to fund your own bad decisions.",
      "Budget ne bola 'bas', tumne suna 'aur'.",
      'Aaj ka budget gaya, kal wala bhi dara hua hai.',
    ],
    bonfire: [
      'Ye budget nahi tha, bonfire tha.',
      'Budget ka aaj antim sanskar ho gaya.',
      'Salary ne bina notice period ke resign kar diya.',
    ],
  },
  mild: {
    zero: ['No-spend day. Wallet khush hai.', 'Aaj kuch kharcha nahi hua. Badhiya!'],
    buffett: ['Aadha budget bhi nahi lagaya. Bahut badhiya.', 'Aaj ka din kaafi saste mein nikla.'],
    good: ['Badhiya, budget mein rahe.', 'Achha balance raha aaj.'],
    borderline: ['Thoda tight tha, par budget mein ho.', 'Budget ke bilkul paas pahunch gaye the.'],
    over: ['Aaj thoda zyada ho gaya. Kal balance kar lenge.', 'Budget se thoda upar gaye. Koi baat nahi.'],
    bonfire: [
      'Aaj kaafi zyada kharcha hua. Kal ek no-spend day try karein?',
      'Budget kaafi peeche chhoot gaya. Kal reset karte hain.',
    ],
  },
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stable per day, so reopening the report shows the same line. */
export function ruleVerdict(opts: {
  spent: number;
  budget: number;
  ratio: number;
  intensity: RoastIntensity;
  seed: string;
}): string {
  const { spent, budget, ratio, intensity, seed } = opts;
  if (intensity === 'off') {
    if (spent <= 0) return 'No spends recorded today.';
    if (spent > budget) return `You went ${formatINR(spent - budget, { decimals: 0 })} over today's budget.`;
    return `You used ${Math.round(ratio * 100)}% of today's budget.`;
  }
  const band = roastBand(spent, ratio);
  const lines = LINES[intensity][band];
  return lines[hash(`${seed}:${band}`) % lines.length];
}
