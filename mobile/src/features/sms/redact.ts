/**
 * Strips personal identifiers before any SMS/email text leaves the device:
 * OTPs, phone numbers, emails, and account/card numbers (keeping the last 4
 * digits). Transaction reference numbers stay, since they are what lets the
 * server match an SMS to an email receipt.
 */
export function redact(text: string): string {
  return (
    text
      // OTP codes near an OTP keyword
      .replace(/\b(otp|one[- ]time password|verification code|passcode)\b([^0-9]{0,24})\d{4,8}/gi, '$1$2[otp]')
      // Account / card numbers: keep last 4
      .replace(
        /\b((?:a\/?c|acct|account|card)(?:\s*(?:no\.?|number|ending(?:\s*with)?))?\s*[:.]?\s*)[x*\d\s-]{4,}(\d{4})\b/gi,
        '$1XX$2',
      )
      .replace(/\b\d{9,18}(\d{4})\b(?=[^\n]{0,12}\b(?:a\/?c|account)\b)/gi, 'XX$1')
      // UPI handles built from phone numbers: 9876543210@ybl
      .replace(/\b(?:\+?91[- ]?)?[6-9]\d{9}(@[a-z]+)/gi, '[phone]$1')
      // Indian mobile numbers, with or without +91/0. 12-digit reference numbers never match.
      .replace(/(?<!\d)(?:\+91[- ]?|0)?[6-9]\d{9}(?!\d)/g, '[phone]')
      // Email addresses
      .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, '[email]')
  );
}
