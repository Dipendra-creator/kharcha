import { useEffect, useRef, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { formatINR, spokenINR, type FormatOptions } from '@/lib/money';
import { type, type TypeVariant } from '@/theme/tokens';

import { AppText, type AppTextProps } from './text';

type MoneyProps = {
  paise: number;
  variant?: TypeVariant;
  color?: AppTextProps['color'];
  symbolColor?: AppTextProps['color'];
  style?: StyleProp<ViewStyle>;
  /** Prefix used for spoken label, e.g. "Spent". */
  label?: string;
  /** Shrinks the type so the amount fits this width (points). */
  fitWidth?: number;
} & FormatOptions;

/** Amount with a smaller ₹ glyph and tabular digits; reads as "1,240 rupees" to screen readers. */
export function Money({ paise, variant = 'body', color = 'text', symbolColor, style, label, fitWidth, ...fmt }: MoneyProps) {
  const text = formatINR(paise, { ...fmt, symbol: false });
  const sign = text.startsWith('−') || text.startsWith('+') ? text[0] : '';
  const digits = sign ? text.slice(1) : text;
  const t = type[variant];
  // Tabular Inter digits are ~0.62em wide; commas and the half-size ₹ ~0.3em.
  const ems = [...digits].reduce((w, ch) => w + (/\d/.test(ch) ? 0.62 : 0.3), 0.35 + (sign ? 0.6 : 0));
  const scale = fitWidth ? Math.min(1, fitWidth / (ems * t.fontSize)) : 1;
  const fontSize = t.fontSize * scale;
  const lineHeight = t.lineHeight * scale;
  const big = fontSize >= 28;
  const sized = scale < 1 ? { fontSize, lineHeight, letterSpacing: t.letterSpacing * scale } : undefined;
  return (
    <View
      style={[{ flexDirection: 'row', alignItems: big ? 'flex-start' : 'baseline' }, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label ? `${label}: ` : ''}${spokenINR(paise)}`}>
      {/* Only when there is a sign: an empty Text still measures a full font box on Android, which made big amounts top-heavy. */}
      {sign ? (
        <AppText variant={variant} color={color} tabular style={sized}>
          {sign}
        </AppText>
      ) : null}
      <AppText
        variant={variant}
        color={symbolColor ?? color}
        style={
          big
            ? {
                fontSize: fontSize * 0.5,
                lineHeight: lineHeight * 0.6,
                marginTop: fontSize * 0.12,
                marginRight: 2,
                opacity: symbolColor ? 1 : 0.6,
              }
            : sized
        }>
        ₹
      </AppText>
      <AppText variant={variant} color={color} tabular style={sized}>
        {digits}
      </AppText>
    </View>
  );
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** Money that counts toward a new value (count-down on deduction). Jumps when reduced motion is on. */
export function AnimatedMoney({ paise, duration = 650, ...rest }: MoneyProps & { duration?: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(paise);
  const from = useRef(paise);

  useEffect(() => {
    if (reduced) {
      from.current = paise;
      return;
    }
    const start = from.current;
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - t0) / duration);
      const v = Math.round(start + (paise - start) * ease(t));
      from.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [paise, duration, reduced]);

  return <Money paise={reduced ? paise : shown} {...rest} />;
}
