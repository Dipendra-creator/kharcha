import { CATEGORIES, categoryColors, palettes, type Scheme } from '../tokens';

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1, 7), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Composites `fg` at `alpha` over `bg`, as the category tiles do. */
function blend(bg: string, fg: string, alpha: number): string {
  const b = parseInt(bg.slice(1), 16);
  const f = parseInt(fg.slice(1), 16);
  const mix = (shift: number) =>
    Math.round(((f >> shift) & 255) * alpha + ((b >> shift) & 255) * (1 - alpha));
  return `#${[16, 8, 0].map((s) => mix(s).toString(16).padStart(2, '0')).join('')}`;
}

describe.each<Scheme>(['dark', 'light'])('%s palette meets WCAG AA', (scheme) => {
  const c = palettes[scheme];
  const surfaces = { bg: c.bg, surface: c.surface, raised: c.raised };

  it.each(Object.entries(surfaces))('body text on %s ≥ 4.5:1', (_, s) => {
    expect(contrast(c.text, s)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.textMuted, s)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(surfaces))('state colours on %s ≥ 4.5:1 (used for small amounts)', (_, s) => {
    for (const color of [c.safe, c.warning, c.over]) expect(contrast(color, s)).toBeGreaterThanOrEqual(4.5);
  });

  it('accent button label ≥ 4.5:1 and accent graphics ≥ 3:1', () => {
    expect(contrast(c.onAccent, c.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.accentGraphic, c.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(c.accentGraphic, c.surface)).toBeGreaterThanOrEqual(3);
  });

  it.each([...CATEGORIES])('%s icon on its tint ≥ 3:1', (cat) => {
    const fg = categoryColors[scheme][cat];
    expect(contrast(fg, blend(c.surface, fg, 0.16))).toBeGreaterThanOrEqual(3);
  });
});
