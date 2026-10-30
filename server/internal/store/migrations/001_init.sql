-- Kharcha schema. Only extracted transactions are stored: never raw SMS or email bodies.

CREATE TABLE users (
    id          UUID PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    name        TEXT,
    salary      BIGINT NOT NULL DEFAULT 0,        -- paise
    fixed_costs JSONB  NOT NULL DEFAULT '[]',
    payday      SMALLINT NOT NULL DEFAULT 1,
    settings    JSONB  NOT NULL DEFAULT '{}',
    consent_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transactions (
    id            UUID PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount        BIGINT NOT NULL,                -- paise, positive
    type          TEXT NOT NULL CHECK (type IN ('debit', 'credit', 'refund')),
    merchant      TEXT NOT NULL,
    category      TEXT NOT NULL,
    method        TEXT,
    occurred_at   TIMESTAMPTZ NOT NULL,
    source        TEXT NOT NULL CHECK (source IN ('sms', 'email', 'manual')),
    source_ref    TEXT,                           -- hash of the SMS/email, never its text
    account_hint  TEXT,
    upi_ref       TEXT,
    order_id      TEXT,
    note          TEXT,
    items         JSONB,
    confidence    REAL NOT NULL DEFAULT 1,
    status        TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'review', 'ignored')),
    excluded      BOOLEAN NOT NULL DEFAULT false,
    dedupe_group  UUID,
    merged_into   UUID,
    deleted       BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL,          -- client clock: last edit
    server_seq    BIGSERIAL                      -- pull cursor: bumped on every server write
);
CREATE INDEX transactions_user_time ON transactions (user_id, occurred_at);
CREATE INDEX transactions_user_seq ON transactions (user_id, server_seq);
CREATE UNIQUE INDEX transactions_source_ref ON transactions (user_id, source, source_ref) WHERE source_ref IS NOT NULL;

CREATE TABLE merchant_rules (
    id         UUID PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pattern    TEXT NOT NULL,
    merchant   TEXT NOT NULL,
    category   TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, pattern)
);

CREATE TABLE subscriptions (
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    merchant  TEXT NOT NULL,
    amount    BIGINT NOT NULL,
    cycle     TEXT NOT NULL,
    next_date DATE NOT NULL,
    PRIMARY KEY (user_id, merchant)
);

CREATE TABLE daily_summaries (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date    DATE NOT NULL,
    budget  BIGINT NOT NULL,
    spent   BIGINT NOT NULL,
    verdict TEXT NOT NULL,
    PRIMARY KEY (user_id, date)
);

CREATE TABLE sync_runs (
    id            UUID PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source        TEXT NOT NULL,
    started_at    TIMESTAMPTZ NOT NULL,
    finished_at   TIMESTAMPTZ,
    items_found   INT NOT NULL DEFAULT 0,
    items_parsed  INT NOT NULL DEFAULT 0,
    errors        TEXT
);

CREATE TABLE gmail_accounts (
    user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email             TEXT NOT NULL,
    refresh_token_enc BYTEA NOT NULL,             -- AES-256-GCM
    history_id        BIGINT NOT NULL DEFAULT 0,
    last_sync_at      TIMESTAMPTZ,
    connected_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-user extraction cache keyed by message template (digits masked), so a
-- repeat merchant/bank template skips the LLM. Holds no amounts.
CREATE TABLE extraction_cache (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signature  TEXT NOT NULL,
    type       TEXT NOT NULL,
    merchant   TEXT NOT NULL,
    category   TEXT NOT NULL,
    method     TEXT,
    confidence REAL NOT NULL,
    hits       INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, signature)
);
