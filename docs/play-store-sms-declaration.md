# Google Play: SMS permission declaration (READ_SMS)

Google Play restricts `READ_SMS` to apps whose core function needs it, and requires a Permissions Declaration Form in Play Console. Kharcha's case and its fallback are below.

## Declaration (paste into Play Console → App content → Sensitive permissions)

| Field | Answer |
| --- | --- |
| Core functionality | Personal finance: automatic expense tracking. Kharcha turns the user's salary into a daily budget and deducts each spend as it happens. |
| Permitted use case | "SMS-based money management" — apps that track and manage budgets from bank, card and UPI transaction SMS. |
| Why SMS is needed | Indian banks send every debit and credit as an SMS alert. These alerts are the only complete, real-time record of a user's UPI and card spends available to an app without bank APIs. |
| Data minimisation | The native reader (`modules/kharcha-sms`) returns only messages from a fixed list of bank/UPI/wallet sender IDs, or messages that contain both an amount and a transaction keyword. OTPs, promotions and personal messages are dropped on the device and never reach the app's JavaScript or the network. |
| What leaves the device | Only the extracted transaction (amount, merchant, category, time). For the few alerts the on-device parser can't read confidently, a redacted copy (phone numbers, account numbers except the last 4 digits, OTPs and emails removed) is sent to the Kharcha server for AI extraction and is not stored. |
| User control | SMS reading is off until the user turns it on during onboarding or in Settings → Sources, after a plain-language explanation. It can be turned off at any time; Settings → Privacy offers data export and "delete everything". |
| Default handler | Kharcha does not ask to be the default SMS app, and does not send or receive SMS (`SEND_SMS` and `RECEIVE_SMS` are blocked in `app.json`). |

Prepare for review: a 30-second screen recording of onboarding → "Allow SMS" → Sync → a bank alert appearing on Today, and the privacy policy URL describing the above.

## If the declaration is rejected

Ship the same app with `android.permission.READ_SMS` removed from `app.json` → `android.permissions`. Kharcha keeps working through two fallbacks that are already built:

1. **Payment notifications** — Settings → Sources → "Payment notifications instead". The user grants notification access in system settings; `KharchaNotificationListener` keeps only notifications from SMS, bank and UPI apps that look like transactions (amount + keyword, no OTPs). They go through the same on-device parser.
2. **Gmail receipts and manual entry** — unchanged.

Notification listener access is also a sensitive capability; describe it in the store listing and privacy policy the same way.
