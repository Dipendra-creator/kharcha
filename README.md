# Kharcha

**Where did my money go today?** Kharcha turns a monthly in-hand salary into a daily budget, deducts every spend it finds in bank SMS, Gmail receipts or manual entries, and sends a 10 PM report with an honest Hinglish verdict.

```
mobile/   Expo (SDK 58) + React Native 0.88 + TypeScript app
server/   Go API: Postgres, Redis job queue, Gmail worker, LLM extraction
docs/     Play Store SMS declaration and fallback
```

## How it fits together

```
 Android SMS ──► native reader (finance senders only) ──► on-device parser ──┐
 Payment notifications (Play fallback) ─────────────────────────────────────┤
                                                                             ▼
 Manual entry ───────────────────────────────────────────► SQLite (offline-first) ◄── pull ──┐
                                                                             │               │
                                low-confidence SMS (redacted) ──► /v1/extract │ push          │
                                                                             ▼               │
 Gmail (read-only) ──► Gmail worker ──► LLM extraction ──► Postgres ──► SMS↔email dedupe ────┘
```

- **The app is the source of truth.** Everything works offline; the server is optional and adds AI extraction, Gmail, verdicts and backup.
- **Privacy.** SMS are filtered natively (personal messages never reach JS), parsed on the phone, and redacted before anything is sent. The server stores extracted transactions only, never SMS or email text. Gmail refresh tokens are AES-256-GCM encrypted. Export and "delete everything" are in Settings → Privacy (DPDP Act 2023).
- **Budget.** Daily budget = (salary − fixed costs) ÷ days in the pay cycle (payday to payday; payday 1 = calendar month). Unspent money and overspends are spread across the remaining days when rollover/overspend adjustment are on. Days before you started tracking don't roll over.

## Run it

### Mobile

```bash
cd mobile
npm install
cp .env.example .env          # optional: API URL, Google client ids
npx expo run:android          # dev build (needed for the SMS module)
npx expo run:ios              # iOS: no SMS; Gmail + manual
```

Checks: `npm test` (Jest: budget, parser, roast, insights, subscriptions, contrast), `npx tsc --noEmit`, `npx expo lint`.

### Server

```bash
cd server
docker compose up -d                       # Postgres + Redis (or use local ones)
cp .env.example .env                       # set secrets and at least one LLM provider
make run                                   # :8080, migrations run on start
make test                                  # unit tests
make test-db                               # + Postgres integration test (scratch DB)
```

For local development without Google or LLM keys: `KHARCHA_DEV_LOGIN=true make run`, then in the app open Settings → Sources → **Dev sign-in**. Without an LLM, extraction returns 503 and the app keeps low-confidence SMS in the Review inbox.

To try SMS↔email merging without Gmail, send a bank SMS to the emulator (`adb emu sms send HDFCBK "Rs.820.00 debited … to blinkit@hdfcbank"`), sync, then inject the matching receipt and sync again:

```bash
go run ./cmd/kharcha-dev -email you@example.com -merchant Blinkit -category groceries -amount 820 -items "Milk,Bread"
```

### Deploy (Docker)

```bash
git clone https://github.com/Dipendra-creator/kharcha.git && cd kharcha/server
cp deploy/.env.example deploy/.env      # fill POSTGRES_PASSWORD, KHARCHA_JWT_SECRET, KHARCHA_ENCRYPTION_KEY (openssl rand -base64 32)
docker compose -f deploy/compose.yml up -d --build
curl http://localhost:8090/healthz
```

Update with `git pull && docker compose -f deploy/compose.yml up -d --build`. Postgres has no host port; only the API is published (`KHARCHA_PORT`, default 8090).

`KHARCHA_AUTH_MODE=none` turns sign-in off: every request uses one built-in owner account, and the app detects this from `/healthz` and syncs without signing in. Anyone who can reach the port can read and delete that data, so use it only for a private deployment; set `KHARCHA_AUTH_MODE=token` to require sign-in again. The app's API URL defaults to the deployed server (`mobile/src/lib/api.ts`); override with `EXPO_PUBLIC_API_URL`.

### LLM providers

`KHARCHA_LLM_PROVIDERS` lists providers in the order they're tried; one without credentials is skipped.

| Provider | Needs | Notes |
| --- | --- | --- |
| `anthropic` | `ANTHROPIC_API_KEY` | Claude via the official Go SDK, structured outputs, cached system prompt, `fallbacks: "default"` (a declined request is re-run on Anthropic's recommended fallback model). Model: `claude-opus-5-5` at low effort, override with `KHARCHA_ANTHROPIC_MODEL`. |
| `openai` | `OPENAI_API_KEY` | ChatGPT via the official Go SDK with a strict JSON schema. Model `KHARCHA_OPENAI_MODEL` (default `gpt-5`). |
| `claude-cli` | `claude` on PATH, logged in | Runs `claude -p` with the schema. Dev only: each call starts a CLI session and is slow and expensive. |
| `codex-cli` | `codex` on PATH, logged in | Runs `codex exec --output-schema`. Dev only. |

Repeat SMS templates are answered from a per-user cache, so the LLM is only called for new formats.

### Google Cloud setup (sign-in + Gmail)

1. Create a Google Cloud project, enable the **Gmail API**, and configure the OAuth consent screen with the scope `https://www.googleapis.com/auth/gmail.readonly` (a restricted scope: production use needs Google's verification and a security assessment).
2. Create OAuth clients: **Web** (its id/secret go to the server as `GOOGLE_WEB_CLIENT_ID`/`SECRET`, its id to the app as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`), **Android** (package `in.kharcha.app` + your signing SHA-1), and **iOS** (bundle `in.kharcha.app`; set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`).
3. Put all client ids in the server's `GOOGLE_CLIENT_IDS`, rebuild the app, and use Settings → Sources → **Connect Gmail**.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/auth/google` · `/v1/auth/dev` | Sign in (Google ID token / dev email) → session token |
| POST | `/v1/extract` | Redacted SMS/email → transactions (PRD schema) |
| POST | `/v1/roast` | Day summary → one Hinglish verdict |
| POST | `/v1/transactions/batch` · GET `/v1/transactions?since=` | Push local changes · pull server changes |
| POST | `/v1/gmail/connect` · `/v1/gmail/sync` · GET `/v1/gmail/status` · DELETE `/v1/gmail` | Gmail lifecycle |
| GET · DELETE | `/v1/me/export` · `/v1/me` | DPDP export · delete everything |

## Status against the PRD

| Phase | State |
| --- | --- |
| 1 Core: onboarding, budget formula, manual entry, Today, nightly report, local storage | Done; checked on an Android emulator |
| 2 SMS: native reader, rule pre-filter, LLM extraction, review inbox | Done; native reader built on the emulator |
| 3 Email: Gmail OAuth, receipt parsing, SMS↔email dedupe + enrichment | Done; dedupe tested against Postgres. Live Gmail needs your Google Cloud credentials |
| 4 Insights: charts, projection, subscriptions, shareable report | Done |
| 5 Hardening: privacy, export/delete, parser tests, Play compliance | Done; see `docs/play-store-sms-declaration.md` |

Acceptance criteria: the parser test set (111 SMS in the formats of 30 Indian banks, card issuers, UPI apps and wallets, plus 24 non-transactions) passes 100% on amount, merchant and type. Those samples were written from known formats, so measure again on real inboxes. SMS↔email duplicates merge into one transaction. Manual entries work fully offline. Every palette colour pair is tested for WCAG AA in dark and light mode.

Not built yet: Outlook (optional in the PRD), phone-OTP sign-in (Google sign-in is implemented), server push notifications (the 10 PM report is scheduled on the device).
