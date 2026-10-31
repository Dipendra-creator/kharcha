import { openDatabaseSync } from 'expo-sqlite';

/** Single local database. Everything stays on the phone. */
export const db = openDatabaseSync('kharcha.db');

const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    merchant TEXT NOT NULL,
    category TEXT NOT NULL,
    method TEXT,
    occurred_at INTEGER NOT NULL,
    source TEXT NOT NULL,
    source_ref TEXT,
    account_hint TEXT,
    upi_ref TEXT,
    order_id TEXT,
    note TEXT,
    items TEXT,
    confidence REAL NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'confirmed',
    excluded INTEGER NOT NULL DEFAULT 0,
    dedupe_group TEXT,
    merged_into TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    synced_at INTEGER,
    deleted INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_txn_time ON transactions (occurred_at);
  CREATE INDEX IF NOT EXISTS idx_txn_status ON transactions (status);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_source_ref ON transactions (source, source_ref) WHERE source_ref IS NOT NULL;

  CREATE TABLE IF NOT EXISTS merchant_rules (
    id TEXT PRIMARY KEY NOT NULL,
    pattern TEXT NOT NULL UNIQUE,
    merchant TEXT NOT NULL,
    category TEXT NOT NULL,
    type TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    merchant TEXT PRIMARY KEY NOT NULL,
    category TEXT NOT NULL,
    amount INTEGER NOT NULL,
    cycle TEXT NOT NULL,
    last_date INTEGER NOT NULL,
    next_date INTEGER NOT NULL,
    count INTEGER NOT NULL,
    monthly_cost INTEGER NOT NULL,
    confidence TEXT NOT NULL,
    dismissed INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS daily_summaries (
    date TEXT PRIMARY KEY NOT NULL,
    budget INTEGER NOT NULL,
    spent INTEGER NOT NULL,
    verdict TEXT NOT NULL,
    verdict_source TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sync_runs (
    id TEXT PRIMARY KEY NOT NULL,
    source TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    items_found INTEGER NOT NULL DEFAULT 0,
    items_parsed INTEGER NOT NULL DEFAULT 0,
    errors TEXT
  );
  `,
  // Subscription detection was removed in 0.4.0.
  `DROP TABLE IF EXISTS subscriptions;`,
];

export function migrate(): void {
  db.execSync('PRAGMA journal_mode = WAL');
  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.withTransactionSync(() => {
      db.execSync(MIGRATIONS[v]);
      db.execSync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

/** DPDP "delete everything": wipes every local table. */
export function wipeDatabase(): void {
  db.withTransactionSync(() => {
    db.execSync(`
      DELETE FROM transactions;
      DELETE FROM merchant_rules;
      DELETE FROM daily_summaries;
      DELETE FROM sync_runs;
    `);
  });
}
