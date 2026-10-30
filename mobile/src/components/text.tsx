import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/theme';
import { fonts, type, type FontWeightKey, type Palette, type TypeVariant } from '@/theme/tokens';

export type AppTextProps = TextProps & {
  variant?: TypeVariant;
  /** A palette key or a raw colour. */
  color?: keyof Palette | (string & {});
  weight?: FontWeightKey;
  tabular?: boolean;
  align?: TextStyle['textAlign'];
};

export function AppText({ variant = 'body', color = 'text', weight, tabular, align, style, ...rest }: AppTextProps) {
  const { c } = useTheme();
  const t = type[variant];
  const resolved = color in c ? c[color as keyof Palette] : color;
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={variant === 'hero' || variant === 'display' ? 1.2 : 1.6}
      style={[
        {
          color: resolved,
          fontFamily: fonts[weight ?? t.family],
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          letterSpacing: t.letterSpacing,
          textAlign: align,
          fontVariant: tabular ? ['tabular-nums'] : undefined,
          textTransform: variant === 'micro' ? 'uppercase' : undefined,
        },
        style,
      ]}
    />
  );
}
