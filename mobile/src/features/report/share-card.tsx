import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentRef, Ref } from 'react';
import { Text, View } from 'react-native';

import { categoryMeta } from '@/lib/categories';
import { formatDate, fromDayKey } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { categoryColors, fonts, palettes } from '@/theme/tokens';

import type { NightlyReport } from './report';

/** Story-sized (9:16) card, always in the dark palette so shares look the same everywhere. */
export const SHARE_WIDTH = 360;
export const SHARE_HEIGHT = 640;

const p = palettes.dark;

export function ShareCard({ report, ref }: { report: NightlyReport; ref?: Ref<ComponentRef<typeof View>> }) {
  const accent = report.state === 'over' ? p.over : report.state === 'warning' ? p.warning : p.accent;
  const pct = Number.isFinite(report.ratio) ? Math.round(report.ratio * 100) : 100;
  const top = report.topCategory;
  return (
    <View ref={ref} collapsable={false} style={{ width: SHARE_WIDTH, height: SHARE_HEIGHT, backgroundColor: p.bg }}>
      <LinearGradient colors={[`${accent}55`, `${p.bg}00`]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 360 }} />
      <View style={{ flex: 1, padding: 28, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: p.text, fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.6 }}>
            kharcha<Text style={{ color: p.accent }}>.</Text>
          </Text>
          <Text style={{ color: p.textMuted, fontFamily: fonts.semibold, fontSize: 12 }}>
            {formatDate(fromDayKey(report.dayKey), { weekday: true })}
          </Text>
        </View>

        <View style={{ gap: 18 }}>
          <Text style={{ color: p.textMuted, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2 }}>AAJ KA VERDICT</Text>
          <Text style={{ color: p.text, fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -1.2 }}>
            “{report.verdict}”
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <Text style={{ color: accent, fontFamily: fonts.extrabold, fontSize: 52, letterSpacing: -2, fontVariant: ['tabular-nums'] }}>
              {pct}%
            </Text>
            <Text style={{ color: p.textMuted, fontFamily: fonts.medium, fontSize: 14, marginBottom: 12 }}>of today&apos;s budget</Text>
          </View>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: p.ringTrack, overflow: 'hidden' }}>
            <View style={{ width: `${Math.min(100, pct)}%`, height: 10, borderRadius: 5, backgroundColor: accent }} />
          </View>
          <Text style={{ color: p.text, fontFamily: fonts.semibold, fontSize: 15, fontVariant: ['tabular-nums'] }}>
            {formatINR(report.spent, { decimals: 0 })} spent of {formatINR(report.budget, { decimals: 0 })}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {top ? (
            <Tile
              icon={categoryMeta[top.category].icon}
              color={categoryColors.dark[top.category]}
              label="Top"
              value={categoryMeta[top.category].label}
            />
          ) : null}
          {report.biggest ? (
            <Tile icon="flame" color={p.warning} label="Biggest" value={formatINR(report.biggest.amount, { decimals: 0 })} />
          ) : null}
          <Tile icon="bicycle" color={p.safe} label="Orders" value={String(report.quickOrders)} />
        </View>

        <Text style={{ color: p.textMuted, fontFamily: fonts.medium, fontSize: 12, textAlign: 'center' }}>
          Where did my money go today?
        </Text>
      </View>
    </View>
  );
}

function Tile({ icon, color, label, value }: { icon: keyof typeof Ionicons.glyphMap; color: string; label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: p.surface, borderRadius: 18, padding: 14, gap: 6, borderWidth: 1, borderColor: p.border }}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={{ color: p.textMuted, fontFamily: fonts.medium, fontSize: 11 }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: p.text, fontFamily: fonts.bold, fontSize: 15, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}
