import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

import KharchaSms from '@modules/kharcha-sms';

import { authToken } from '@/features/account/session';
import { finishSyncRun, listRules, startSyncRun, type MerchantRule } from '@/db/meta';
import { insertMany } from '@/db/transactions';
import type { SyncStep } from '@/features/sync/sync';
import { api, ApiError, type Extracted } from '@/lib/api';
import { matchKnownMerchant, normaliseMerchant } from '@/lib/merchants';
import type { NewTxn } from '@/lib/types';
import { useApp } from '@/store/app-store';

import { findSelfTransfers, parseSms, type ParsedSms } from './parser';
import { hasSmsPermission, smsSupported } from './permission';
import { redact } from './redact';
import { FINANCE_SENDERS, senderHeader } from './senders';

const DAY = 86_400_000;
/** How far back the very first sync reads. */
const FIRST_SYNC_LOOKBACK = 45 * DAY;
export const CONFIDENT = 0.7;

type Draft = { ref: string; date: number; sender: string; body: string; parsed: ParsedSms };

function applyRule(p: ParsedSms, rules: Map<string, MerchantRule>): ParsedSms | null {
  const rule = rules.get(p.merchant.toLowerCase()) ?? (p.payee ? rules.get(p.payee.toLowerCase()) : undefined);
  if (!rule) return p;
  if (rule.type === 'ignore') return null;
  // A rule is the user's own correction, so it is trusted.
  return { ...p, merchant: rule.merchant, category: rule.category, type: rule.type ?? p.type, confidence: Math.max(p.confidence, 0.95) };
}

function fromExtracted(p: ParsedSms, e: Extracted): ParsedSms {
  const merchant = normaliseMerchant(e.merchant || p.merchant);
  return {
    ...p,
    type: e.type === 'ignore' ? p.type : e.type,
    amount: Math.round(e.amount * 100) || p.amount,
    merchant,
    category: matchKnownMerchant(merchant)?.category ?? e.category ?? p.category,
    method: e.payment_method ?? p.method,
    accountHint: e.account_hint ?? p.accountHint,
    upiRef: e.upi_ref ?? p.upiRef,
    confidence: e.confidence,
  };
}

/**
 * Reads new finance SMS, parses them on-device, asks the server LLM about the
 * ones the rules aren't sure of (redacted first), and saves transactions.
 */
export const smsSyncStep: SyncStep = async (summary) => {
  const { settings, sync, setSync } = useApp.getState();
  const token = authToken();
  if (!smsSupported || !KharchaSms) return;
  const viaSms = settings.smsEnabled && (await hasSmsPermission());
  const viaNotifications = !viaSms && settings.notificationFallback && KharchaSms.hasNotificationAccess();
  if (!viaSms && !viaNotifications) {
    if (settings.smsEnabled) summary.errors.push('SMS permission is off');
    return;
  }

  const runId = startSyncRun('sms');
  const errors: string[] = [];
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
    drafts.push({ ref, date: msg.date, sender: msg.address, body: msg.body, parsed });
  }

  // Second opinion from the LLM for low-confidence parses. Text is redacted before it leaves the phone.
  const unsure = drafts.filter((d) => d.parsed.confidence < CONFIDENT);
  if (unsure.length && token) {
    try {
      const { results } = await api.extract(
        token,
        unsure.map((d) => ({ id: d.ref, kind: 'sms', sender: senderHeader(d.sender), text: redact(d.body), receivedAt: d.date })),
      );
      const byId = new Map(results.map((r) => [r.id, r]));
      for (const d of unsure) {
        const r = byId.get(d.ref);
        if (!r) continue;
        if (r.type === 'ignore') d.parsed = { ...d.parsed, confidence: -1 };
        else d.parsed = applyRule(fromExtracted(d.parsed, r), rules) ?? { ...d.parsed, confidence: -1 };
      }
    } catch (e) {
      // 503 = the server has no LLM configured; those SMS simply wait in Review.
      if (!(e instanceof ApiError && e.status === 503)) {
        errors.push(`AI extraction unavailable: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  const kept = drafts.filter((d) => d.parsed.confidence >= 0);
  const selfTransfers = findSelfTransfers(
    kept.map((d) => ({ type: d.parsed.type, amount: d.parsed.amount, accountHint: d.parsed.accountHint, occurredAt: d.date })),
  );

  const txns: NewTxn[] = kept.map((d, i) => ({
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
  finishSyncRun(runId, { itemsFound: messages.length, itemsParsed: inserted.length, errors });
  summary.errors.push(...errors);
};
