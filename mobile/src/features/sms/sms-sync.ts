import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

import KharchaSms from '@modules/kharcha-sms';

import { finishSyncRun, listRules, startSyncRun, type MerchantRule } from '@/db/meta';
import { insertMany } from '@/db/transactions';
import type { SyncStep } from '@/features/sync/sync';
import type { NewTxn } from '@/lib/types';
import { useApp } from '@/store/app-store';

import { findSelfTransfers, parseSms, type ParsedSms } from './parser';
import { hasSmsPermission, smsSupported } from './permission';
import { FINANCE_SENDERS } from './senders';

const DAY = 86_400_000;
/** How far back the very first sync reads. */
const FIRST_SYNC_LOOKBACK = 45 * DAY;
export const CONFIDENT = 0.7;

type Draft = { ref: string; date: number; parsed: ParsedSms };

function applyRule(p: ParsedSms, rules: Map<string, MerchantRule>): ParsedSms | null {
  const rule = rules.get(p.merchant.toLowerCase()) ?? (p.payee ? rules.get(p.payee.toLowerCase()) : undefined);
  if (!rule) return p;
  if (rule.type === 'ignore') return null;
  // A rule is the user's own correction, so it is trusted.
  return { ...p, merchant: rule.merchant, category: rule.category, type: rule.type ?? p.type, confidence: Math.max(p.confidence, 0.95) };
}

/**
 * Reads new finance SMS, parses them on-device and saves transactions. The ones
 * the rules aren't sure of wait in the Review inbox.
 */
export const smsSyncStep: SyncStep = async (summary) => {
  const { settings, sync, setSync } = useApp.getState();
  if (!smsSupported || !KharchaSms) return;
  const viaSms = settings.smsEnabled && (await hasSmsPermission());
  const viaNotifications = !viaSms && settings.notificationFallback && KharchaSms.hasNotificationAccess();
  if (!viaSms && !viaNotifications) {
    if (settings.smsEnabled) summary.errors.push('SMS permission is off');
    return;
  }

  const runId = startSyncRun('sms');
  const cursor = viaSms ? sync.smsCursor : sync.notifCursor;
  const since = cursor ?? Date.now() - FIRST_SYNC_LOOKBACK;
  const messages = viaSms
    ? await KharchaSms.readInbox(since, 1000, Object.keys(FINANCE_SENDERS))
    : await KharchaSms.readNotifications(since, 1000);
  summary.smsRead += messages.length;
  const rules = new Map(listRules().map((r) => [r.pattern, r]));

  const drafts: Draft[] = [];
  for (const msg of messages) {
    const result = parseSms(msg.body, msg.address);
    if (result.kind === 'skip') continue;
    const parsed = applyRule(result.parsed, rules);
    if (!parsed) continue;
    const ref = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${msg.address}|${msg.date}|${msg.body}`);
    drafts.push({ ref, date: msg.date, parsed });
  }

  const selfTransfers = findSelfTransfers(
    drafts.map((d) => ({ type: d.parsed.type, amount: d.parsed.amount, accountHint: d.parsed.accountHint, occurredAt: d.date })),
  );

  const txns: NewTxn[] = drafts.map((d, i) => ({
    amount: d.parsed.amount,
    type: d.parsed.type,
    merchant: d.parsed.merchant,
    category: d.parsed.category,
    method: d.parsed.method,
    occurredAt: d.date,
    source: 'sms',
    sourceRef: d.ref,
    accountHint: d.parsed.accountHint,
    upiRef: d.parsed.upiRef,
    confidence: d.parsed.confidence,
    status: d.parsed.confidence >= CONFIDENT ? 'confirmed' : 'review',
    excluded: d.parsed.selfTransfer || selfTransfers.has(i),
  }));
  const inserted = insertMany(txns);

  summary.smsAdded += inserted.length;
  summary.review += inserted.filter((t) => t.status === 'review').length;
  if (messages.length) {
    const newest = Math.max(...messages.map((m) => m.date));
    setSync(viaSms ? { smsCursor: newest } : { notifCursor: newest });
  }
  finishSyncRun(runId, { itemsFound: messages.length, itemsParsed: inserted.length });
};
