/**
 * DLT sender headers (the part after the "XX-" prefix, e.g. "VM-HDFCBK") of
 * banks, cards, UPI apps and wallets. Only SMS from these — or SMS that look
 * like transaction alerts — are considered; everything else stays unread.
 */
export const FINANCE_SENDERS: Record<string, string> = {
  HDFCBK: 'HDFC Bank',
  HDFCBN: 'HDFC Bank',
  ICICIB: 'ICICI Bank',
  ICICIT: 'ICICI Bank',
  SBIUPI: 'SBI (UPI)',
  SBIINB: 'SBI',
  SBIPSG: 'SBI',
  ATMSBI: 'SBI',
  CBSSBI: 'SBI',
  SBICRD: 'SBI Card',
  AXISBK: 'Axis Bank',
  AXISMR: 'Axis Bank',
  KOTAKB: 'Kotak Mahindra Bank',
  KOTAKM: 'Kotak Mahindra Bank',
  PNBSMS: 'Punjab National Bank',
  BOBTXN: 'Bank of Baroda',
  BOBSMS: 'Bank of Baroda',
  CANBNK: 'Canara Bank',
  UNIONB: 'Union Bank of India',
  IDFCFB: 'IDFC FIRST Bank',
  YESBNK: 'Yes Bank',
  INDUSB: 'IndusInd Bank',
  FEDBNK: 'Federal Bank',
  AUBANK: 'AU Small Finance Bank',
  RBLBNK: 'RBL Bank',
  IDBIBK: 'IDBI Bank',
  CITIBK: 'Citibank',
  SCBANK: 'Standard Chartered',
  HSBCIN: 'HSBC',
  AMEXIN: 'American Express',
  ONECRD: 'OneCard',
  PAYTMB: 'Paytm Payments Bank',
  JIOPBK: 'Jio Payments Bank',
  AIRBNK: 'Airtel Payments Bank',
  PHONPE: 'PhonePe',
  GPAYIN: 'Google Pay',
  AMZNPY: 'Amazon Pay',
  MOBIKW: 'MobiKwik',
  FREECH: 'Freecharge',
  SLICEIT: 'slice',
  JUPITR: 'Jupiter',
  FIMONY: 'Fi',
};

/** Strips the operator/region prefix: "VM-HDFCBK-S" → "HDFCBK". */
export function senderHeader(address: string): string {
  const parts = address.toUpperCase().split('-');
  if (parts.length >= 2 && parts[0].length === 2) return parts[1];
  return parts[0].replace(/[^A-Z0-9]/g, '');
}

export function isFinanceSender(address: string): boolean {
  return senderHeader(address) in FINANCE_SENDERS;
}
