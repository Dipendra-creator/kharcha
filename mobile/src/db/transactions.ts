import { randomUUID } from 'expo-crypto';

import { REFUND_WINDOW, spendByDay } from '@/features/budget/refunds';
import { dayKey, fromDayKey, type DayKey } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import type { Category, NewTxn, Txn } from '@/lib/types';
import { bumpData } from '@/store/app-store';

import { db } from './client';

type Row = {
  id: string;
  amount: number;
  type: string;
  merchant: string;
  category: string;
  method: string | null;
  occurred_at: number;
  source: string;
  source_ref: string | null;
  account_hint: string | null;
  upi_ref: string | null;
  order_id: string | null;
  note: string | null;
  items: string | null;
  confidence: number;
  status: string;
  excluded: number;
  dedupe_group: string | null;
  merged_into: string | null;
  created_at: number;
  updated_at: number;
  synced_at: number | null;
  deleted: number;
};

function fromRow(r: Row): Txn {
  return {
    id: r.id,
    amount: r.amount,
    type: r.type as Txn['type'],
    merchant: r.merchant,
    category: r.category as Txn['category'],
    method: r.method as Txn['method'],
    occurredAt: r.occurred_at,
    source: r.source as Txn['source'],
    sourceRef: r.source_ref,
    accountHint: r.account_hint,
    upiRef: r.upi_ref,
    orderId: r.order_id,
    note: r.note,
    items: r.items ? (JSON.parse(r.items) as string[]) : null,
    confidence: r.confidence,
    status: r.status as Txn['status'],
    excluded: !!r.excluded,
    dedupeGroup: r.dedupe_group,
    mergedInto: r.merged_into,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    syncedAt: r.synced_at,
    deleted: !!r.deleted,
  };
}

function toParams(t: Txn) {
  return {
    $id: t.id,
    $amount: t.amount,
    $type: t.type,
    $merchant: t.merchant,
    $category: t.category,
    $method: t.method,
    $occurred_at: t.occurredAt,
    $source: t.source,
    $source_ref: t.sourceRef,
    $account_hint: t.accountHint,
    $upi_ref: t.upiRef,
    $order_id: t.orderId,
    $note: t.note,
    $items: t.items ? JSON.stringify(t.items) : null,
    $confidence: t.confidence,
    $status: t.status,
    $excluded: t.excluded ? 1 : 0,
    $dedupe_group: t.dedupeGroup,
    $merged_into: t.mergedInto,
    $created_at: t.createdAt,
    $updated_at: t.updatedAt,
    $synced_at: t.syncedAt,
    $deleted: t.deleted ? 1 : 0,
  };
}

const COLUMNS =
  'id, amount, type, merchant, category, method, occurred_at, source, source_ref, account_hint, upi_ref, order_id, note, items, confidence, status, excluded, dedupe_group, merged_into, created_at, updated_at, synced_at, deleted';
const VALUES = COLUMNS.split(', ')
  .map((c) => `$${c}`)
  .join(', ');
const UPSERT = `INSERT INTO transactions (${COLUMNS}) VALUES (${VALUES})
  ON CONFLICT(id) DO UPDATE SET ${COLUMNS.split(', ')
    .filter((c) => c !== 'id' && c !== 'created_at')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ')}`;

export function buildTxn(input: NewTxn, now = Date.now()): Txn {
  return {
    id: input.id ?? randomUUID(),
    method: null,
    sourceRef: null,
    accountHint: null,
    upiRef: null,
    orderId: null,
    note: null,
    items: null,
    confidence: 1,
    status: 'confirmed',
    excluded: false,
    dedupeGroup: null,
    mergedInto: null,
    syncedAt: null,
    deleted: false,
    ...input,
    createdAt: now,
    updatedAt: now,
  };
}

export function insertTxn(input: NewTxn): Txn {
  const t = buildTxn(input);
  db.runSync(UPSERT, toParams(t));
  bumpData();
  return t;
}

/** Inserts many rows in one transaction; rows whose (source, sourceRef) already exist are skipped. */
export function insertMany(inputs: NewTxn[]): Txn[] {
  const inserted: Txn[] = [];
  db.withTransactionSync(() => {
    for (const input of inputs) {
      if (input.sourceRef && findBySourceRef(input.source, input.sourceRef)) continue;
      const t = buildTxn(input);
      db.runSync(UPSERT, toParams(t));
      inserted.push(t);
    }
  });
  if (inserted.length) bumpData();
  return inserted;
}

/**
 * Writes rows exactly as given (server pull / restore). A local copy of the
 * same SMS/email under another id (e.g. re-read after a reinstall) gives way
 * to the incoming row.
 */
export function upsertMany(txns: Txn[]): void {
  if (!txns.length) return;
  db.withTransactionSync(() => {
    for (const t of txns) {
      if (t.sourceRef) {
        db.runSync('DELETE FROM transactions WHERE source = ? AND source_ref = ? AND id != ?', t.source, t.sourceRef, t.id);
      }
      db.runSync(UPSERT, toParams(t));
    }
  });
  bumpData();
}

export function updateTxn(id: string, patch: Partial<Omit<Txn, 'id' | 'createdAt'>>): Txn | null {
  const cur = getTxn(id);
  if (!cur) return null;
  const next: Txn = { ...cur, ...patch, updatedAt: Date.now(), syncedAt: null };
  db.runSync(UPSERT, toParams(next));
  bumpData();
  return next;
}

/** Soft delete so the deletion can sync to the server. */
export function deleteTxn(id: string): void {
  updateTxn(id, { deleted: true });
}

export function getTxn(id: string): Txn | null {
  const r = db.getFirstSync<Row>('SELECT * FROM transactions WHERE id = ?', id);
  return r ? fromRow(r) : null;
}

export function findBySourceRef(source: string, ref: string): Txn | null {
  const r = db.getFirstSync<Row>('SELECT * FROM transactions WHERE source = ? AND source_ref = ?', source, ref);
  return r ? fromRow(r) : null;
}

/** Live (not deleted, not merged) rows in [from, to), newest first. */
export function listBetween(from: number, to: number): Txn[] {
  return db
    .getAllSync<Row>(
      `SELECT * FROM transactions
       WHERE occurred_at >= ? AND occurred_at < ? AND deleted = 0 AND merged_into IS NULL AND status != 'ignored'
       ORDER BY occurred_at DESC`,
      from,
      to,
    )
    .map(fromRow);
}

export function listDay(key: DayKey): Txn[] {
  const start = fromDayKey(key);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  return listBetween(start.getTime(), end.getTime());
}

export type TxnFilter = {
  /** Merchant or note text; a number also matches amounts in that rupee (450 → ₹450.00–₹450.99). */
  query?: string;
  category?: Category | null;
  kind?: 'all' | 'spent' | 'received';
  from?: number;
  to?: number;
  limit?: number;
};

/** Live rows matching a filter, newest first. */
export function searchTxns(f: TxnFilter): Txn[] {
  const where = [`deleted = 0`, `merged_into IS NULL`, `status != 'ignored'`];
  const params: (string | number)[] = [];
  if (f.from != null) {
    where.push('occurred_at >= ?');
    params.push(f.from);
  }
  if (f.to != null) {
    where.push('occurred_at < ?');
    params.push(f.to);
  }
  if (f.category) {
    where.push('category = ?');
    params.push(f.category);
  }
  if (f.kind === 'spent') where.push(`type = 'debit'`);
  if (f.kind === 'received') where.push(`type != 'debit'`);
  const q = f.query?.trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    const text = `(merchant LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\')`;
    const rupees = parseAmount(q);
    if (rupees != null) {
      where.push(`(${text} OR (amount >= ? AND amount < ?))`);
      params.push(like, like, rupees, rupees + 1_00);
    } else {
      where.push(text);
      params.push(like, like);
    }
  }
  params.push(f.limit ?? 500);
  return db
    .getAllSync<Row>(`SELECT * FROM transactions WHERE ${where.join(' AND ')} ORDER BY occurred_at DESC LIMIT ?`, ...params)
    .map(fromRow);
}

/** Live rows added to this phone after `since` (by insert time, not when the payment happened). */
export function listCreatedSince(since: number): Txn[] {
  return db
    .getAllSync<Row>(
      `SELECT * FROM transactions
       WHERE created_at > ? AND deleted = 0 AND merged_into IS NULL AND status != 'ignored'
       ORDER BY occurred_at DESC`,
      since,
    )
    .map(fromRow);
}

/** When the oldest live transaction happened, or null with none. */
export function earliestTxnAt(): number | null {
  return (
    db.getFirstSync<{ at: number | null }>(
      `SELECT MIN(occurred_at) AS at FROM transactions WHERE deleted = 0 AND merged_into IS NULL AND status != 'ignored'`,
    )?.at ?? null
  );
}

export function listReview(): Txn[] {
  return db
    .getAllSync<Row>(
      `SELECT * FROM transactions WHERE status = 'review' AND deleted = 0 AND merged_into IS NULL ORDER BY occurred_at DESC`,
    )
    .map(fromRow);
}

export function countReview(): number {
  return (
    db.getFirstSync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM transactions WHERE status = 'review' AND deleted = 0 AND merged_into IS NULL`,
    )?.n ?? 0
  );
}

export function listAll(): Txn[] {
  return db.getAllSync<Row>('SELECT * FROM transactions ORDER BY occurred_at DESC').map(fromRow);
}

export function listUnsynced(): Txn[] {
  return db.getAllSync<Row>('SELECT * FROM transactions WHERE synced_at IS NULL').map(fromRow);
}

export function markSynced(ids: string[], at = Date.now()): void {
  db.withTransactionSync(() => {
    for (const id of ids) db.runSync('UPDATE transactions SET synced_at = ? WHERE id = ?', at, id);
  });
}

/**
 * Daily spend keyed by local day, for the budget engine, net of refunds. Rows
 * a refund window either side are read too: a payment just before `from` can
 * be refunded inside it, and a refund after `to` lowers a day inside it.
 */
export function spentByDay(from: number, to: number): Record<DayKey, number> {
  const all = spendByDay(listBetween(from - REFUND_WINDOW, to + REFUND_WINDOW));
  const [first, last] = [dayKey(from), dayKey(to - 1)];
  const out: Record<DayKey, number> = {};
  for (const [k, v] of Object.entries(all)) if (k >= first && k <= last) out[k] = v;
  return out;
}
