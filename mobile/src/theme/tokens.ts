/**
 * Kharcha design tokens. Dark-first; every colour pair used for text is
 * checked for WCAG AA contrast in src/theme/__tests__/contrast.test.ts.
 */

export type Scheme = 'dark' | 'light';

export type Palette = {
  bg: string;
  surface: string;
  raised: string;
  border: string;
  text: string;
  textMuted: string;
  /** Signature accent — used only for the calm budget state and primary actions. */
  accent: string;
  /** Text/icon colour placed on top of `accent`. */
  onAccent: string;
  /** Accent as a graphic on `bg`/`surface` (ring arc, active tab) — ≥ 3:1 contrast. */
  accentGraphic: string;
  safe: string;
  warning: string;
  over: string;
  ringTrack: string;
  glass: string;
  scrim: string;
  shadow: string;
};

export const palettes: Record<Scheme, Palette> = {
  dark: {
    bg: '#070B14',
    surface: '#0F1524',
    raised: '#172036',
    border: '#243049',
    text: '#F3F5FA',
    textMuted: '#8B95AB',
    accent: '#C8F560',
    onAccent: '#0B1020',
    accentGraphic: '#C8F560',
    safe: '#2DD4BF',
    warning: '#FFB547',
    over: '#FF5C6C',
    ringTrack: '#1A2338',
    glass: 'rgba(15,21,36,0.94)',
    scrim: 'rgba(3,6,12,0.64)',
    shadow: '#000000',
  },
  light: {
    bg: '#F5F6FA',
    surface: '#FFFFFF',
    raised: '#EEF1F7',
    border: '#DCE1EB',
    text: '#0B1020',
    textMuted: '#586176',
    accent: '#C8F560',
    onAccent: '#0B1020',
    accentGraphic: '#5A8C00',
    safe: '#0F766E',
    warning: '#A15C00',
    over: '#C8283A',
    ringTrack: '#E4E8F0',
    glass: 'rgba(255,255,255,0.95)',
    scrim: 'rgba(11,16,32,0.42)',
    shadow: '#1B2440',
  },
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export type FontWeightKey = keyof typeof fonts;

export const type = {
  hero: { fontSize: 64, lineHeight: 70, family: 'extrabold', letterSpacing: -2.5 },
  display: { fontSize: 40, lineHeight: 46, family: 'extrabold', letterSpacing: -1.4 },
  title: { fontSize: 28, lineHeight: 34, family: 'bold', letterSpacing: -0.8 },
  heading: { fontSize: 20, lineHeight: 26, family: 'bold', letterSpacing: -0.4 },
  body: { fontSize: 16, lineHeight: 22, family: 'medium', letterSpacing: -0.1 },
  bodyRegular: { fontSize: 16, lineHeight: 23, family: 'regular', letterSpacing: 0 },
  label: { fontSize: 14, lineHeight: 19, family: 'semibold', letterSpacing: -0.1 },
  caption: { fontSize: 13, lineHeight: 17, family: 'medium', letterSpacing: 0 },
  micro: { fontSize: 11, lineHeight: 14, family: 'bold', letterSpacing: 0.8 },
} as const satisfies Record<
  string,
  { fontSize: number; lineHeight: number; family: FontWeightKey; letterSpacing: number }
>;

export type TypeVariant = keyof typeof type;

export const CATEGORIES = [
  'food',
  'groceries',
  'shopping',
  'travel',
  'subscriptions',
  'bills',
  'health',
  'entertainment',
  'transfers',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Category hues; `fg` is used for icons/text on a 16%-alpha tint of itself. */
export const categoryColors: Record<Scheme, Record<Category, string>> = {
  dark: {
    food: '#FF9466',
    groceries: '#5EE38D',
    shopping: '#F77FC0',
    travel: '#6CB0FF',
    subscriptions: '#B39BFF',
    bills: '#FFC94D',
    health: '#FF8A8A',
    entertainment: '#EE8BFA',
    transfers: '#A3B1C6',
    other: '#AAB2BF',
  },
  light: {
    food: '#B93E0B',
    groceries: '#157A3A',
    shopping: '#B0175A',
    travel: '#1D4FC4',
    subscriptions: '#6527C9',
    bills: '#8A5600',
    health: '#B4232A',
    entertainment: '#93199E',
    transfers: '#475569',
    other: '#4B5563',
  },
};

export const motion = {
  spring: { damping: 18, stiffness: 180, mass: 0.9 },
  springSoft: { damping: 22, stiffness: 120, mass: 1 },
  fast: 180,
  base: 280,
  slow: 650,
} as const;

/** Height reserved at the bottom of tab screens for the floating glass tab bar. */
export const TAB_BAR_HEIGHT = 64;
