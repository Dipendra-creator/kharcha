import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useApp } from '@/store/app-store';

import { categoryColors, palettes, type Category, type Palette, type Scheme } from './tokens';

type Theme = {
  scheme: Scheme;
  c: Palette;
  category: Record<Category, string>;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const pref = useApp((s) => s.settings.theme);
  const scheme: Scheme = pref === 'system' ? (system === 'light' ? 'light' : 'dark') : pref;
  const value: Theme = { scheme, c: palettes[scheme], category: categoryColors[scheme] };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}

/** Appends an alpha channel to a #RRGGBB colour. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
