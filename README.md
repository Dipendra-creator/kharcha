# Kharcha

**Where did my money go today?** Kharcha turns a monthly in-hand salary into a daily budget, deducts every spend it finds in bank SMS or manual entries, and sends a 10 PM report with an honest Hinglish verdict.

```
mobile/   Expo (SDK 58) + React Native 0.88 + TypeScript app
docs/     Play Store SMS declaration and fallback
```

## How it fits together

```
 Android SMS ──► native reader (finance senders only) ──► on-device parser ──┐
 Payment notifications (Play fallback) ─────────────────────────────────────┤
 Manual entry ──────────────────────────────────────────────────────────────┤
                                                                             ▼
                                   SQLite on the phone ──► Today · Insights · nightly report
                                   (unsure SMS wait in the Review inbox)
```

- **Offline and private.** There is no server and no account. SMS are filtered natively (personal messages never reach JS) and parsed on the phone; nothing is uploaded. Export and "delete everything" are in Settings → Privacy (DPDP Act 2023).
- **Budget.** Daily budget = (salary − fixed costs) ÷ days in the pay cycle (payday to payday; payday 1 = calendar month). Unspent money and overspends are spread across the remaining days when rollover/overspend adjustment are on. Days before you started tracking don't roll over.
- **Self-updating.** Settings → App updates checks [GitHub Releases](https://github.com/Dipendra-creator/kharcha/releases), downloads the new APK, verifies its SHA-256 and opens Android's installer. The only network call the app makes is that update check.

## Install

Download the latest `kharcha-v<version>.apk` from [GitHub Releases](https://github.com/Dipendra-creator/kharcha/releases/latest) on an Android phone (Android 7+, ARM) and open it; allow "install unknown apps" for your browser or file manager. Later versions install from inside the app.

## Develop

```bash
cd mobile
npm install
npx expo run:android          # dev build (needed for the SMS module)
npx expo run:ios              # iOS: no SMS; manual entry
```

Checks: `npm test` (Jest: budget, parser, roast, insights, alerts, updates, contrast), `npx tsc --noEmit`, `npx expo lint`.

## Release

Every app change ships as a GitHub release (rules in [CLAUDE.md](CLAUDE.md)). Bump `version` and `android.versionCode` in `mobile/app.json`, commit on `main`, write release notes, then:

```bash
cd mobile
scripts/release.sh /path/to/notes.md
```

The script runs the checks, builds the APK for `arm64-v8a` + `armeabi-v7a`, refuses to publish one not signed with the Kharcha key, pushes `main`, and creates release `v<version>` with `kharcha-v<version>.apk` and its `.sha256`. The first paragraph of the notes is what the app's update card shows.

Release builds are signed by `plugins/with-release-signing.js` with the upload key named in `~/.gradle/gradle.properties` (`KHARCHA_UPLOAD_STORE_FILE`, `KHARCHA_UPLOAD_STORE_PASSWORD`, `KHARCHA_UPLOAD_KEY_ALIAS`, `KHARCHA_UPLOAD_KEY_PASSWORD`). The key never goes in the repo. Every update must be signed with the same key, or Android refuses to install it over the old app.

## Status

| Area | State |
| --- | --- |
| Core: onboarding, budget formula, manual entry, Today, nightly report, local storage | Done |
| SMS: native reader, on-device parser, review inbox, payment-notification fallback | Done |
| Insights: charts, spend calendar, streaks, shareable report, transaction search | Done |
| Privacy: export/delete, parser tests, Play compliance | Done; see `docs/play-store-sms-declaration.md` |
| Self-update from GitHub Releases | Done (Android) |

The parser test set (111 SMS in the formats of 30 Indian banks, card issuers, UPI apps and wallets, plus 24 non-transactions) passes 100% on amount, merchant and type. Those samples were written from known formats, so measure again on real inboxes. Manual entries work fully offline. Every palette colour pair is tested for WCAG AA in dark and light mode.

Removed in 0.4.0: the Go server (AI extraction, AI verdicts, Gmail receipts, backup and sign-in) and subscription tracking. Transactions they added earlier stay on the phone.
