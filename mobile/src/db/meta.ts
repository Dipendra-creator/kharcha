import { randomUUID } from 'expo-crypto';

import type { DetectedSubscription } from '@/features/subscriptions/detect';
import type { Category, TxnType } from '@/lib/types';
import { bumpData } from '@/store/app-store';

import { db } from './client';

// ── merchant rules ────────────────────────────────────────────────────────────

/** `type: 'ignore'` marks a payee the user said is not a spend. */
export type MerchantRule = {
  id: string;
  pattern: string;
  merchant: string;
  category: Category;
  type: TxnType | 'ignore' | null;
};

/** Saves a user correction so the next sync maps `pattern` (a normalised payee) the same way. */
export function saveRule(rule: Omit<MerchantRule, 'id'>): void {
  db.runSync(
    `INSERT INTO merchant_rules (id, pattern, merchant, category, type, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(pattern) DO UPDATE SET merchant = excluded.merchant, category = excluded.category, type = excluded.type`,
    randomUUID(),
    rule.pattern.toLowerCase().trim(),
    rule.merchant,
    rule.category,
    rule.type,
    Date.now(),
  );
}

export function listRules(): MerchantRule[] {
  return db.getAllSync<MerchantRule>('SELECT id, pattern, merchant, category, type FROM merchant_rules');
}

export function deleteRule(id: string): void {
  db.runSync('DELETE FROM merchant_rules WHERE id = ?', id);
  bumpData();
}

// ── subscriptions ─────────────────────────────────────────────────────────────

export type StoredSubscription = DetectedSubscription & { dismissed: boolean };

type SubRow = {
  merchant: string;
  category: string;
  amount: number;
  cycle: string;
  last_date: number;
  next_date: number;
  count: number;
  monthly_cost: number;
  confidence: string;
  dismissed: number;
};

/** Replaces detected subscriptions while keeping the user's "not a subscription" choices. */
export function saveSubscriptions(found: DetectedSubscription[]): void {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM subscriptions WHERE dismissed = 0');
    for (const s of found) {
      db.runSync(
        `INSERT INTO subscriptions (merchant, category, amount, cycle, last_date, next_date, count, monthly_cost, confidence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(merchant) DO UPDATE SET amount = excluded.amount, cycle = excluded.cycle, last_date = excluded.last_date,
           next_date = excluded.next_date, count = excluded.count, monthly_cost = excluded.monthly_cost, confidence = excluded.confidence`,
        s.merchant,
        s.category,
        s.amount,
        s.cycle,
        s.lastDate,
        s.nextDate,
        s.count,
        s.monthlyCost,
        s.confidence,
      );
    }
  });
}

export function listSubscriptions(): StoredSubscription[] {
  return db.getAllSync<SubRow>('SELECT * FROM subscriptions ORDER BY next_date ASC').map((r) => ({
    merchant: r.merchant,
    category: r.category as Category,
    amount: r.amount,
    cycle: r.cycle as DetectedSubscription['cycle'],
    lastDate: r.last_date,
    nextDate: r.next_date,
    count: r.count,
    monthlyCost: r.monthly_cost,
    confidence: r.confidence as DetectedSubscription['confidence'],
    dismissed: !!r.dismissed,
  }));
}

export function setSubscriptionDismissed(merchant: string, dismissed: boolean): void {
  db.runSync('UPDATE subscriptions SET dismissed = ? WHERE merchant = ?', dismissed ? 1 : 0, merchant);
  bumpData();
}

// ── daily summaries ───────────────────────────────────────────────────────────

export type DailySummary = {
  date: string;
  budget: number;
  spent: number;
  verdict: string;
  verdictSource: 'rules' | 'llm';
};

export function getSummary(date: string): DailySummary | null {
  const r = db.getFirstSync<{ date: string; budget: number; spent: number; verdict: string; verdict_source: string }>(
    'SELECT * FROM daily_summaries WHERE date = ?',
    date,
  );
  return r
    ? { date: r.date, budget: r.budget, spent: r.spent, verdict: r.verdict, verdictSource: r.verdict_source as 'rules' | 'llm' }
    : null;
}

export function saveSummary(s: DailySummary): void {
  db.runSync(
    `INSERT INTO daily_summaries (date, budget, spent, verdict, verdict_source, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET budget = excluded.budget, spent = excluded.spent, verdict = excluded.verdict,
       verdict_source = excluded.verdict_source`,
    s.date,
    Math.round(s.budget),
    Math.round(s.spent),
    s.verdict,
    s.verdictSource,
    Date.now(),
  );
}

export function listSummaries(): DailySummary[] {
  return db
    .getAllSync<{ date: string; budget: number; spent: number; verdict: string; verdict_source: string }>(
      'SELECT * FROM daily_summaries ORDER BY date DESC',
    )
    .map((r) => ({ date: r.date, budget: r.budget, spent: r.spent, verdict: r.verdict, verdictSource: r.verdict_source as 'rules' | 'llm' }));
}

// ── sync runs ─────────────────────────────────────────────────────────────────

export type SyncRun = {
  id: string;
  source: 'sms' | 'email' | 'server';
  startedAt: number;
  finishedAt: number | null;
  itemsFound: number;
  itemsParsed: number;
  errors: string | null;
};

export function startSyncRun(source: SyncRun['source']): string {
  const id = randomUUID();
  db.runSync('INSERT INTO sync_runs (id, source, started_at) VALUES (?, ?, ?)', id, source, Date.now());
  return id;
}

export function finishSyncRun(id: string, r: { itemsFound: number; itemsParsed: number; errors?: string[] }): void {
  db.runSync(
    'UPDATE sync_runs SET finished_at = ?, items_found = ?, items_parsed = ?, errors = ? WHERE id = ?',
    Date.now(),
    r.itemsFound,
    r.itemsParsed,
    r.errors?.length ? r.errors.join('\n') : null,
    id,
  );
}

export function recentSyncRuns(limit = 10): SyncRun[] {
  return db
    .getAllSync<{
      id: string;
      source: string;
      started_at: number;
      finished_at: number | null;
      items_found: number;
      items_parsed: number;
      errors: string | null;
    }>('SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT ?', limit)
    .map((r) => ({
      id: r.id,
      source: r.source as SyncRun['source'],
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      itemsFound: r.items_found,
      itemsParsed: r.items_parsed,
      errors: r.errors,
    }));
}
