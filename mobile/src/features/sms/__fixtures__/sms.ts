/**
 * Sample SMS in the formats Indian banks, card issuers, UPI apps and wallets
 * actually send (account numbers, refs and names are made up). Each
 * transaction sample states the expected type, amount (₹) and merchant.
 */

export type TxnSample = { sender: string; body: string; type: 'debit' | 'credit' | 'refund'; amount: number; merchant: string };
export type NonTxnSample = { sender: string; body: string };

export const TRANSACTIONS: TxnSample[] = [
  // ── HDFC Bank ──────────────────────────────────────────────────────────────
  { sender: 'VM-HDFCBK', body: 'Sent Rs.250.00\nFrom HDFC Bank A/C *1234\nTo THIRD WAVE COFFEE\nOn 30/10/26\nRef 430312345678\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808', type: 'debit', amount: 250, merchant: 'Third Wave Coffee' },
  { sender: 'AD-HDFCBK', body: 'Sent Rs.600.00\nFrom HDFC Bank A/C *1234\nTo Blinkit\nOn 30/10/26\nRef 430312345679\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808', type: 'debit', amount: 600, merchant: 'Blinkit' },
  { sender: 'VM-HDFCBK', body: 'Rs.400.00 debited from A/c XX1234 on 30-10-26 to VPA zepto.payu@hdfcbank (UPI Ref No 430312345680). Not you? Call on 18002586161 to report', type: 'debit', amount: 400, merchant: 'Zepto' },
  { sender: 'VM-HDFCBK', body: 'Money Sent! Rs.500 debited from HDFC Bank A/c **1234 on 30-10-26 to swiggy@icici UPI Ref No 430312345681. Not you? Call 18002586161', type: 'debit', amount: 500, merchant: 'Swiggy' },
  { sender: 'VM-HDFCBK', body: 'Spent Rs.1,299 On HDFC Bank Card 5678 At MYNTRA DESIGNS On 2026-10-30:14:22:10.Not You? To Block+Reissue Call 18002323232/SMS BLOCK CC 5678 to 7308080808', type: 'debit', amount: 1299, merchant: 'Myntra' },
  { sender: 'VM-HDFCBK', body: 'Spent Rs.349 On HDFC Bank Card 5678 At UBER INDIA On 2026-10-30:21:05:44.Not You? To Block+Reissue Call 18002323232/SMS BLOCK CC 5678 to 7308080808', type: 'debit', amount: 349, merchant: 'Uber' },
  { sender: 'VM-HDFCBK', body: 'Spent Rs.649 On HDFC Bank Card 5678 At NETFLIX.COM On 2026-10-05:00:00:12.Not You? To Block+Reissue Call 18002323232/SMS BLOCK CC 5678 to 7308080808', type: 'debit', amount: 649, merchant: 'Netflix' },
  { sender: 'VM-HDFCBK', body: 'Update! INR 85,000.00 deposited in HDFC Bank A/c XX1234 on 30-OCT-26 for NEFT Cr-CITI0000001-ACME TECHNOLOGIES PVT LTD-SALARY OCT.Avl bal INR 1,02,345.67. Cheque deposits in A/C are subject to clearing', type: 'credit', amount: 85000, merchant: 'Acme Technologies' },
  { sender: 'VM-HDFCBK', body: 'Received Rs.500.00 in your A/C *1234 from RAHUL SHARMA rahul.s@okicici on 30/10/26. UPI Ref 430312345682. -HDFC Bank', type: 'credit', amount: 500, merchant: 'Rahul Sharma' },
  { sender: 'VM-HDFCBK', body: 'Rs.2000.00 withdrawn from HDFC Bank Card x5678 At ATM S1AW0123 On 2026-10-30:11:02:33. Avl bal: Rs.12,345.00. Not you? Call 18002586161', type: 'debit', amount: 2000, merchant: 'ATM withdrawal' },
  { sender: 'VM-HDFCBK', body: 'Sent Rs.120.00\nFrom HDFC Bank A/C *1234\nTo Rapido\nOn 30/10/26\nRef 430312345683\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808', type: 'debit', amount: 120, merchant: 'Rapido' },
  { sender: 'VM-HDFCBK', body: 'Spent Rs.2,450.50 On HDFC Bank Card 5678 At AMAZON PAY INDIA On 2026-10-29:19:45:00.Not You? To Block+Reissue Call 18002323232/SMS BLOCK CC 5678 to 7308080808', type: 'debit', amount: 2450.5, merchant: 'Amazon' },

  // ── ICICI Bank ─────────────────────────────────────────────────────────────
  { sender: 'VM-ICICIB', body: 'ICICI Bank Acct XX123 debited for Rs 400.00 on 30-Oct-26; ZEPTO credited. UPI:430312345684. Call 18002662 for dispute. SMS BLOCK 123 to 9215676766.', type: 'debit', amount: 400, merchant: 'Zepto' },
  { sender: 'VM-ICICIB', body: 'ICICI Bank Acct XX123 debited for Rs 250.00 on 30-Oct-26; STARBUCKS COFFEE credited. UPI:430312345685. Call 18002662 for dispute. SMS BLOCK 123 to 9215676766.', type: 'debit', amount: 250, merchant: 'Starbucks' },
  { sender: 'VM-ICICIB', body: 'ICICI Bank Acct XX123 debited for Rs 1,250.00 on 29-Oct-26; PRIYA NAIR credited. UPI:430312345686. Call 18002662 for dispute. SMS BLOCK 123 to 9215676766.', type: 'debit', amount: 1250, merchant: 'Priya Nair' },
  { sender: 'VM-ICICIB', body: 'INR 1,299.00 spent using ICICI Bank Card XX5678 on 30-Oct-26 on AMAZON PAY IN. Avl Limit: INR 1,23,456.00. If not you, call 1800 2662/SMS BLOCK 5678 to 9215676766', type: 'debit', amount: 1299, merchant: 'Amazon' },
  { sender: 'VM-ICICIB', body: 'INR 119.00 spent using ICICI Bank Card XX5678 on 01-Oct-26 on SPOTIFY. Avl Limit: INR 1,22,000.00. If not you, call 1800 2662/SMS BLOCK 5678 to 9215676766', type: 'debit', amount: 119, merchant: 'Spotify' },
  { sender: 'VM-ICICIB', body: 'INR 3,480.00 spent using ICICI Bank Card XX5678 on 28-Oct-26 on FLIPKART. Avl Limit: INR 1,18,000.00. If not you, call 1800 2662/SMS BLOCK 5678 to 9215676766', type: 'debit', amount: 3480, merchant: 'Flipkart' },
  { sender: 'VM-ICICIB', body: 'Dear Customer, Acct XX123 is credited with Rs 50.00 on 30-Oct-26 from RAHUL S. UPI:430312345687-ICICI Bank.', type: 'credit', amount: 50, merchant: 'Rahul S' },
  { sender: 'VM-ICICIB', body: 'ICICI Bank Acc XX123 credited:Rs. 300.00 on 30-Oct-26. Info:REFUND-AMAZON. Available Balance is Rs. 12,345.00.', type: 'refund', amount: 300, merchant: 'Amazon' },
  { sender: 'VM-ICICIB', body: 'ICICI Bank Acct XX123 debited for Rs 199.00 on 30-Oct-26; JIOHOTSTAR credited. UPI:430312345688. Call 18002662 for dispute. SMS BLOCK 123 to 9215676766.', type: 'debit', amount: 199, merchant: 'JioHotstar' },
  { sender: 'VM-ICICIT', body: 'INR 589.00 spent using ICICI Bank Card XX5678 on 30-Oct-26 on ZOMATO. Avl Limit: INR 1,20,000.00. If not you, call 1800 2662/SMS BLOCK 5678 to 9215676766', type: 'debit', amount: 589, merchant: 'Zomato' },

  // ── SBI ────────────────────────────────────────────────────────────────────
  { sender: 'VM-SBIUPI', body: 'Dear UPI user A/C X1234 debited by 250.0 on date 30Oct26 trf to STARBUCKS Refno 430312345689. If not u? call 1800111109. -SBI', type: 'debit', amount: 250, merchant: 'Starbucks' },
  { sender: 'VM-SBIUPI', body: 'Dear UPI user A/C X1234 debited by 640.0 on date 30Oct26 trf to Swiggy Limited Refno 430312345690. If not u? call 1800111109. -SBI', type: 'debit', amount: 640, merchant: 'Swiggy' },
  { sender: 'VM-SBIUPI', body: 'Dear UPI user A/C X1234 debited by 80.0 on date 30Oct26 trf to RAMESH KUMAR Refno 430312345691. If not u? call 1800111109. -SBI', type: 'debit', amount: 80, merchant: 'Ramesh Kumar' },
  { sender: 'VM-SBIUPI', body: 'Dear UPI user A/C X1234 debited by 1500.0 on date 29Oct26 trf to BESCOM Refno 430312345692. If not u? call 1800111109. -SBI', type: 'debit', amount: 1500, merchant: 'BESCOM' },
  { sender: 'VM-SBIUPI', body: 'Dear SBI UPI User, ur A/cX1234 credited by Rs500 on 30Oct26 by  (Ref no 430312345693)', type: 'credit', amount: 500, merchant: 'Money received' },
  { sender: 'VM-SBICRD', body: 'Rs.649.00 spent on your SBI Credit Card ending 5678 at NETFLIX on 30/10/26. Trxn. not done by you? Report at https://sbicard.com/Dispute', type: 'debit', amount: 649, merchant: 'Netflix' },
  { sender: 'VM-SBICRD', body: 'Rs.1,999.00 spent on your SBI Credit Card ending 5678 at CLAUDE.AI SUBSCRIPTION on 12/10/26. Trxn. not done by you? Report at https://sbicard.com/Dispute', type: 'debit', amount: 1999, merchant: 'Claude' },
  { sender: 'VM-SBICRD', body: 'Rs.3,250.00 spent on your SBI Credit Card ending 5678 at INDIGO on 25/10/26. Trxn. not done by you? Report at https://sbicard.com/Dispute', type: 'debit', amount: 3250, merchant: 'IndiGo' },
  { sender: 'VM-ATMSBI', body: 'Dear Customer, Rs.2,000 withdrawn at SBI ATM S1NB000123 from A/cX1234 on 30Oct26 Transaction Number 1234. Available Balance Rs.8,000. If not withdrawn by you, forward this SMS to 9223008333/ call 1800111109 to block your card. -SBI', type: 'debit', amount: 2000, merchant: 'ATM withdrawal' },
  { sender: 'VM-SBIINB', body: 'Your A/C XXXXX1234 has a debit by transfer of Rs 1,500.00 on 30/10/26. Avl Bal Rs 10,000.00.-SBI', type: 'debit', amount: 1500, merchant: 'Bank transfer' },

  // ── Axis Bank ──────────────────────────────────────────────────────────────
  { sender: 'VM-AXISBK', body: 'INR 500.00 debited\nA/c no. XX1234\n30-10-26, 13:40:12\nUPI/P2M/430312345694/SWIGGY\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank', type: 'debit', amount: 500, merchant: 'Swiggy' },
  { sender: 'VM-AXISBK', body: 'INR 820.00 debited\nA/c no. XX1234\n30-10-26, 22:14:51\nUPI/P2M/430312345695/BLINKIT\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank', type: 'debit', amount: 820, merchant: 'Blinkit' },
  { sender: 'VM-AXISBK', body: 'INR 300.00 debited\nA/c no. XX1234\n30-10-26, 10:02:44\nUPI/P2A/430312345696/ANKIT VERMA\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank', type: 'debit', amount: 300, merchant: 'Ankit Verma' },
  { sender: 'VM-AXISBK', body: 'Spent\nCard no. XX5678\nINR 1299\n30-10-26 14:22:10\nAMAZON\nAvl Lmt INR 100000\nSMS BLOCK 5678 to 919951860002, if not you - Axis Bank', type: 'debit', amount: 1299, merchant: 'Amazon' },
  { sender: 'VM-AXISBK', body: 'INR 85000.00 credited\nA/c no. XX1234\n30-10-26, 09:00:00 IST\nNEFT/CITIN26123456/ACME TECH - Axis Bank', type: 'credit', amount: 85000, merchant: 'Acme Tech' },
  { sender: 'VM-AXISBK', body: 'INR 260.00 debited\nA/c no. XX1234\n30-10-26, 19:12:03\nUPI/P2M/430312345697/UBER INDIA\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank', type: 'debit', amount: 260, merchant: 'Uber' },

  // ── Kotak ──────────────────────────────────────────────────────────────────
  { sender: 'VM-KOTAKB', body: 'Sent Rs.250.00 from Kotak Bank AC X1234 to thirdwave@ybl on 30-10-26.UPI Ref 430312345698. Not you, https://kotak.com/KBANKT/Fraud', type: 'debit', amount: 250, merchant: 'Third Wave Coffee' },
  { sender: 'VM-KOTAKB', body: 'Sent Rs.450.00 from Kotak Bank AC X1234 to zomato-order@paytm on 30-10-26.UPI Ref 430312345699. Not you, https://kotak.com/KBANKT/Fraud', type: 'debit', amount: 450, merchant: 'Zomato' },
  { sender: 'VM-KOTAKB', body: 'Received Rs.500.00 in your Kotak Bank AC X1234 from neha.k@okaxis on 30-10-26.UPI Ref:430312345700.', type: 'credit', amount: 500, merchant: 'Neha K' },
  { sender: 'VM-KOTAKB', body: 'Rs.1299.00 spent on your Kotak Credit Card x5678 at MYNTRA on 30/10/2026. Avl limit Rs.85000.00', type: 'debit', amount: 1299, merchant: 'Myntra' },
  { sender: 'VM-KOTAKM', body: 'Sent Rs.99.00 from Kotak Bank AC X1234 to chaipoint@ybl on 30-10-26.UPI Ref 430312345701. Not you, https://kotak.com/KBANKT/Fraud', type: 'debit', amount: 99, merchant: 'Chai Point' },
  { sender: 'VM-KOTAKB', body: 'Rs.760.00 spent on your Kotak Credit Card x5678 at BOOKMYSHOW on 29/10/2026. Avl limit Rs.84000.00', type: 'debit', amount: 760, merchant: 'BookMyShow' },

  // ── PNB / BoB / Canara / Union ─────────────────────────────────────────────
  { sender: 'VM-PNBSMS', body: 'Your a/c no. XXXXXXXX1234 is debited for Rs.350.00 on 30-10-2026 13:40:12 and credited to a/c no. XXXXXXXX9876 (UPI Ref no 430312345702).Bal: Rs.5000.00 CR -PNB', type: 'debit', amount: 350, merchant: 'Bank transfer' },
  { sender: 'VM-PNBSMS', body: 'Your a/c no. XXXXXXXX1234 is credited for Rs.2,000.00 on 30-10-2026 09:10:00 by a/c linked to VPA vikas.m@oksbi (UPI Ref no 430312345703).-PNB', type: 'credit', amount: 2000, merchant: 'Vikas M' },
  { sender: 'VM-BOBTXN', body: 'Rs.450.00 Dr. from A/C XXXXXX1234 and Cr. to zomato@hdfcbank. Ref:430312345704. AvlBal:Rs5000.00(2026:10:30 13:40:12). Not you? Call 18005700-BOB', type: 'debit', amount: 450, merchant: 'Zomato' },
  { sender: 'VM-BOBTXN', body: 'Rs.180.00 Dr. from A/C XXXXXX1234 and Cr. to bmtc.metro@sbi. Ref:430312345705. AvlBal:Rs4820.00(2026:10:30 18:02:12). Not you? Call 18005700-BOB', type: 'debit', amount: 180, merchant: 'Bmtc Metro' },
  { sender: 'VM-CANBNK', body: 'An amount of INR 300.00 has been DEBITED to your account XXX1234 on 30/10/2026 towards UPI/430312345706/RAPIDO. Total Avail.bal INR 7,000.00 - Canara Bank', type: 'debit', amount: 300, merchant: 'Rapido' },
  { sender: 'VM-CANBNK', body: 'An amount of INR 1,050.00 has been DEBITED to your account XXX1234 on 30/10/2026 towards UPI/430312345707/APOLLO PHARMACY. Total Avail.bal INR 5,950.00 - Canara Bank', type: 'debit', amount: 1050, merchant: 'Apollo Pharmacy' },
  { sender: 'VM-UNIONB', body: 'A/c *1234 Debited for Rs:120.00 on 30-10-2026 13:40:12 by Mob Bk ref no 430312345708 Avl Bal Rs:5000.00.If not you, Call 1800222243 -Union Bank of India', type: 'debit', amount: 120, merchant: 'Bank transfer' },

  // ── IDFC / Yes / IndusInd / Federal / AU / RBL ─────────────────────────────
  { sender: 'VM-IDFCFB', body: 'Your A/C XXXXXXX1234 has been debited with INR 199.00 on 30/10/2026 13:40 towards UPI/430312345709/spotify@icici. Avl Bal INR 5,000.00 - IDFC FIRST Bank', type: 'debit', amount: 199, merchant: 'Spotify' },
  { sender: 'VM-IDFCFB', body: 'Your A/C XXXXXXX1234 has been debited with INR 2,300.00 on 30/10/2026 20:11 towards UPI/430312345710/ajio@axisbank. Avl Bal INR 2,700.00 - IDFC FIRST Bank', type: 'debit', amount: 2300, merchant: 'Ajio' },
  { sender: 'VM-YESBNK', body: 'INR 240.00 debited from A/c XX1234 on 30-10-2026 for UPI txn to blinkit@hdfcbank. Ref:430312345711. Avl Bal INR 4000.00 -YES BANK', type: 'debit', amount: 240, merchant: 'Blinkit' },
  { sender: 'VM-INDUSB', body: 'Your IndusInd Bank A/C 2xxxxx1234 is debited for INR 900.00 towards UPI/P2M/430312345712/BOOKMYSHOW on 30-10-2026. Avl Bal: INR 10,000.00', type: 'debit', amount: 900, merchant: 'BookMyShow' },
  { sender: 'VM-FEDBNK', body: 'Rs 150.00 debited from your A/c XX1234 to VPA chaipoint@ybl on 30-10-2026 13:40:12. UPI Ref 430312345713. Bal Rs 5000.00 -Federal Bank', type: 'debit', amount: 150, merchant: 'Chai Point' },
  { sender: 'VM-AUBANK', body: 'Debit INR 75.00 A/c XX1234 30-10-2026 13:40:12 UPI/DR/430312345714/METRO/YBL Avl Bal INR 3000.00 AU SFB', type: 'debit', amount: 75, merchant: 'Metro' },
  { sender: 'VM-RBLBNK', body: 'Rs.1,150.00 spent on your RBL Bank Credit Card ending 5678 at DOMINOS PIZZA on 30-10-2026. Avl limit: Rs 60,000. Not you? Call 02262327777', type: 'debit', amount: 1150, merchant: 'Domino’s' },

  // ── Credit cards (Amex / HSBC / OneCard / SC / Citi) ───────────────────────
  { sender: 'VM-AMEXIN', body: "Alert: You've spent INR 2,450.00 on your AMEX card ** 11005 at UBER INDIA on 30 October 2026 at 09:15 PM IST. Call 18004190691 if this was not made by you.", type: 'debit', amount: 2450, merchant: 'Uber' },
  { sender: 'VM-AMEXIN', body: "Alert: You've spent INR 3,899.00 on your AMEX card ** 11005 at MAKEMYTRIP on 28 October 2026 at 11:02 AM IST. Call 18004190691 if this was not made by you.", type: 'debit', amount: 3899, merchant: 'MakeMyTrip' },
  { sender: 'VM-HSBCIN', body: 'INR 1,500.00 spent on credit card no. XXXXXX5678 at SWIGGY on 30OCT26 at 14:22. Avl Bal INR 95,000.00', type: 'debit', amount: 1500, merchant: 'Swiggy' },
  { sender: 'VM-ONECRD', body: 'Rs.799 spent on OneCard Credit Card XX5678 at ZOMATO on 30 Oct. Avl limit: Rs 50,000', type: 'debit', amount: 799, merchant: 'Zomato' },
  { sender: 'VM-ONECRD', body: 'Rs.349 spent on OneCard Credit Card XX5678 at YOUTUBE PREMIUM on 05 Oct. Avl limit: Rs 49,651', type: 'debit', amount: 349, merchant: 'YouTube Premium' },
  { sender: 'VM-SCBANK', body: 'Your StanChart Credit Card ending 5678 has been used for INR 2,199.00 at NYKAA on 30/10/26. Available limit: INR 1,10,000.', type: 'debit', amount: 2199, merchant: 'Nykaa' },
  { sender: 'VM-CITIBK', body: 'Rs 4,500.00 spent on your Citibank card ending 5678 at CROMA ELECTRONICS on 30-OCT-26. Avl limit Rs 1,45,500.00', type: 'debit', amount: 4500, merchant: 'Croma Electronics' },

  // ── Paytm / PhonePe / Amazon Pay / wallets ─────────────────────────────────
  { sender: 'VM-PAYTMB', body: 'Paid Rs.85 to Chai Wala from Paytm Payments Bank a/c XX1234. UPI Ref:430312345715', type: 'debit', amount: 85, merchant: 'Chai Wala' },
  { sender: 'VM-PAYTMB', body: 'Rs.120 paid to Uber India from Paytm Wallet. Txn ID 12345678901. Updated Balance: Rs 300', type: 'debit', amount: 120, merchant: 'Uber' },
  { sender: 'VM-PAYTMB', body: 'Paid Rs.560 to Zepto from Paytm Payments Bank a/c XX1234. UPI Ref:430312345716', type: 'debit', amount: 560, merchant: 'Zepto' },
  { sender: 'VM-AMZNPY', body: 'You have paid Rs.299.00 to Amazon via Amazon Pay balance. Txn id: 0123456789. Balance: Rs.701.00', type: 'debit', amount: 299, merchant: 'Amazon' },
  { sender: 'VM-AMZNPY', body: 'Rs.150.00 cashback credited to your Amazon Pay balance for your order. Balance: Rs.851.00', type: 'refund', amount: 150, merchant: 'Money received' },
  { sender: 'VM-MOBIKW', body: 'Rs.199 paid to Airtel Prepaid using MobiKwik Wallet. Txn ID MK123456. Wallet balance Rs.801', type: 'debit', amount: 199, merchant: 'Airtel' },
  { sender: 'VM-PHONPE', body: 'Paid Rs.340 to Instamart from your HDFC Bank a/c XX1234 via PhonePe. UPI Ref No 430312345717', type: 'debit', amount: 340, merchant: 'Instamart' },
  { sender: 'VM-GPAYIN', body: 'You paid Rs.220.00 to Starbucks via Google Pay from ICICI Bank a/c XX123. UPI Ref 430312345718', type: 'debit', amount: 220, merchant: 'Starbucks' },

  // ── Neo-banks / others ─────────────────────────────────────────────────────
  { sender: 'VM-JUPITR', body: 'Rs 450.00 debited from your Jupiter account XX1234 to swiggy@icici on 30 Oct 2026. UPI Ref 430312345719', type: 'debit', amount: 450, merchant: 'Swiggy' },
  { sender: 'VM-FIMONY', body: 'Rs 1,200.00 sent from your Federal Bank a/c XX1234 via Fi to dmart.ready@ybl on 30-10-2026. UPI Ref 430312345720', type: 'debit', amount: 1200, merchant: 'Dmart Ready' },
  { sender: 'VM-SLICEIT', body: 'Rs 640 spent at ZOMATO using slice UPI on 30 Oct 2026, 10:42 PM. UPI Ref 430312345721', type: 'debit', amount: 640, merchant: 'Zomato' },
  { sender: 'VM-IDBIBK', body: 'Your A/c XX1234 debited by Rs.500.00 on 30/10/2026 towards UPI to pharmeasy@axisbank. Ref 430312345722 -IDBI Bank', type: 'debit', amount: 500, merchant: 'PharmEasy' },
];

// More of the most common templates with other merchants (each is a format seen in the wild).
const HDFC_UPI = (m: string, amt: string, ref: string) =>
  `Sent Rs.${amt}\nFrom HDFC Bank A/C *1234\nTo ${m}\nOn 30/10/26\nRef ${ref}\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808`;
const ICICI_UPI = (m: string, amt: string, ref: string) =>
  `ICICI Bank Acct XX123 debited for Rs ${amt} on 30-Oct-26; ${m} credited. UPI:${ref}. Call 18002662 for dispute. SMS BLOCK 123 to 9215676766.`;
const SBI_UPI = (m: string, amt: string, ref: string) =>
  `Dear UPI user A/C X1234 debited by ${amt} on date 30Oct26 trf to ${m} Refno ${ref}. If not u? call 1800111109. -SBI`;
const AXIS_UPI = (m: string, amt: string, ref: string) =>
  `INR ${amt} debited\nA/c no. XX1234\n30-10-26, 13:40:12\nUPI/P2M/${ref}/${m}\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank`;
const HDFC_CARD = (m: string, amt: string) =>
  `Spent Rs.${amt} On HDFC Bank Card 5678 At ${m} On 2026-10-30:14:22:10.Not You? To Block+Reissue Call 18002323232/SMS BLOCK CC 5678 to 7308080808`;
const ICICI_CARD = (m: string, amt: string) =>
  `INR ${amt} spent using ICICI Bank Card XX5678 on 30-Oct-26 on ${m}. Avl Limit: INR 1,00,000.00. If not you, call 1800 2662/SMS BLOCK 5678 to 9215676766`;

const extra: [string, string, (m: string, a: string, r: string) => string, string, number, string][] = [
  ['VM-HDFCBK', 'SWIGGY INSTAMART', HDFC_UPI, '312.00', 312, 'Swiggy'],
  ['VM-HDFCBK', 'Zomato Ltd', HDFC_UPI, '455.00', 455, 'Zomato'],
  ['VM-HDFCBK', 'BLUE TOKAI COFFEE', HDFC_UPI, '380.00', 380, 'Blue Tokai'],
  ['VM-HDFCBK', 'KIRANA GENERAL STORE', HDFC_UPI, '230.00', 230, 'Kirana General Store'],
  ['VM-HDFCBK', 'OLA', HDFC_UPI, '210.00', 210, 'Ola'],
  ['VM-HDFCBK', 'AIRTEL', HDFC_UPI, '719.00', 719, 'Airtel'],
  ['VM-HDFCBK', 'TATA 1MG', HDFC_UPI, '640.00', 640, 'Tata 1mg'],
  ['VM-ICICIB', 'BLINKIT', ICICI_UPI, '1,040.00', 1040, 'Blinkit'],
  ['VM-ICICIB', 'SWIGGY', ICICI_UPI, '388.00', 388, 'Swiggy'],
  ['VM-ICICIB', 'BIGBASKET', ICICI_UPI, '1,612.00', 1612, 'BigBasket'],
  ['VM-ICICIB', 'IRCTC', ICICI_UPI, '845.00', 845, 'IRCTC'],
  ['VM-ICICIB', 'MCDONALDS', ICICI_UPI, '329.00', 329, "McDonald's"],
  ['VM-ICICIB', 'PVR INOX', ICICI_UPI, '620.00', 620, 'PVR INOX'],
  ['VM-SBIUPI', 'ZEPTO', SBI_UPI, '410.0', 410, 'Zepto'],
  ['VM-SBIUPI', 'BLINKIT', SBI_UPI, '275.0', 275, 'Blinkit'],
  ['VM-SBIUPI', 'UBER', SBI_UPI, '312.0', 312, 'Uber'],
  ['VM-SBIUPI', 'JIO', SBI_UPI, '349.0', 349, 'Jio'],
  ['VM-SBIUPI', 'SUNITA DEVI', SBI_UPI, '60.0', 60, 'Sunita Devi'],
  ['VM-SBIUPI', 'HP PETROL PUMP', SBI_UPI, '1000.0', 1000, 'HP Petrol Pump'],
  ['VM-AXISBK', 'ZOMATO', AXIS_UPI, '515.00', 515, 'Zomato'],
  ['VM-AXISBK', 'ZEPTO', AXIS_UPI, '298.00', 298, 'Zepto'],
  ['VM-AXISBK', 'RAPIDO', AXIS_UPI, '89.00', 89, 'Rapido'],
  ['VM-AXISBK', 'NETFLIX', AXIS_UPI, '199.00', 199, 'Netflix'],
  ['VM-AXISBK', 'STARBUCKS', AXIS_UPI, '410.00', 410, 'Starbucks'],
  ['VM-AXISBK', 'APOLLO PHARMACY', AXIS_UPI, '780.00', 780, 'Apollo Pharmacy'],
];
const extraCards: [string, string, (m: string, a: string) => string, string, number, string][] = [
  ['VM-HDFCBK', 'FLIPKART', HDFC_CARD, '5,499', 5499, 'Flipkart'],
  ['VM-HDFCBK', 'SWIGGY', HDFC_CARD, '612', 612, 'Swiggy'],
  ['VM-HDFCBK', 'APPLE.COM/BILL', HDFC_CARD, '99', 99, 'Apple'],
  ['VM-HDFCBK', 'DECATHLON SPORTS', HDFC_CARD, '2,799', 2799, 'Decathlon Sports'],
  ['VM-ICICIB', 'MAKEMYTRIP', ICICI_CARD, '12,450.00', 12450, 'MakeMyTrip'],
  ['VM-ICICIB', 'GOOGLE ONE', ICICI_CARD, '130.00', 130, 'Google One'],
  ['VM-ICICIB', 'NYKAA', ICICI_CARD, '1,345.00', 1345, 'Nykaa'],
  ['VM-ICICIB', 'OPENAI CHATGPT', ICICI_CARD, '1,999.00', 1999, 'ChatGPT'],
];

extra.forEach(([sender, m, tpl, amt, amount, merchant], i) =>
  TRANSACTIONS.push({ sender, body: tpl(m, amt, `4303123458${(10 + i).toString()}`), type: 'debit', amount, merchant }),
);
extraCards.forEach(([sender, m, tpl, amt, amount, merchant]) =>
  TRANSACTIONS.push({ sender, body: tpl(m, amt), type: 'debit', amount, merchant }),
);

export const NON_TRANSACTIONS: NonTxnSample[] = [
  { sender: 'VM-HDFCBK', body: '123456 is the OTP for transaction of INR 1,299.00 at MYNTRA on HDFC Bank card ending 5678. OTP valid for 5 mins. Do not share it with anyone.' },
  { sender: 'VM-ICICIB', body: 'Dear Customer, 482913 is your one time password for online purchase of Rs 3,480.00 at FLIPKART on your ICICI Bank Card XX5678. Do not share this OTP.' },
  { sender: 'VM-SBIINB', body: 'OTP for login to SBI YONO is 902341. Do not share it with anyone. -SBI' },
  { sender: 'VM-AXISBK', body: 'Your verification code is 771234. Valid for 10 minutes. -Axis Bank' },
  { sender: 'VM-HDFCBK', body: 'Congratulations! You are pre-approved for a Personal Loan of Rs 5,00,000 at attractive rates. Apply now: hdfc.bank/pl T&C apply' },
  { sender: 'VM-ICICIB', body: 'Get 10% cashback up to Rs 1,500 on Amazon with your ICICI Bank Credit Card this festive season. Limited period offer. T&C apply' },
  { sender: 'VM-AXISBK', body: 'Exclusive offer! Upgrade your Axis Bank Credit Card and get 5000 reward points. Click here to apply.' },
  { sender: 'VM-PHONPE', body: 'Win assured cashback up to Rs 500 on your next recharge with PhonePe! Offer valid till 31 Oct.' },
  { sender: 'VM-HDFCBK', body: 'UPI txn of Rs.600.00 to blinkit@hdfcbank has failed. Amount if debited will be refunded within 48 hrs. -HDFC Bank' },
  { sender: 'VM-ICICIB', body: 'Your transaction of INR 2,000.00 at AMAZON on ICICI Bank Card XX5678 was declined due to insufficient funds.' },
  { sender: 'VM-SBIUPI', body: 'Dear UPI user, your transaction of Rs 450 to SWIGGY was unsuccessful. Ref no 430312345799 -SBI' },
  { sender: 'VM-PAYTMB', body: 'Ravi has requested money from you of Rs 500 on Paytm. Tap to pay: paytm.me/abc123' },
  { sender: 'VM-GPAYIN', body: 'Ankit Verma is requesting Rs.250.00 via Google Pay. Approve or decline in the app.' },
  { sender: 'VM-HDFCBK', body: 'Your HDFC Bank Credit Card XX5678 statement is generated. Total Amount Due: Rs 23,456.00. Minimum Amount Due: Rs 1,200.00. Due date: 15-Nov-26.' },
  { sender: 'VM-ICICIB', body: 'Reminder: Your ICICI Bank Credit Card bill of Rs 12,000 is due on 05-Nov-26. Pay now to avoid late charges.' },
  { sender: 'VM-SBIINB', body: 'Your loan EMI of Rs 18,500 will be debited from A/c XX1234 on 05-11-2026. Please maintain sufficient balance. -SBI' },
  { sender: 'VM-HDFCBK', body: 'Your e-mandate for Netflix of Rs 649.00 has been registered successfully on A/c XX1234. -HDFC Bank' },
  { sender: 'VM-KOTAKB', body: 'Available balance in your Kotak Bank AC X1234 is Rs 45,231.50 as on 30-10-26 09:00.' },
  { sender: 'VM-AXISBK', body: 'Avl Bal in A/c XX1234 as on 30-10-26 is INR 12,345.00. -Axis Bank' },
  { sender: 'VK-ZOMATO', body: 'Your order from Behrouz Biryani is out for delivery! Track: zoma.to/t/abc' },
  { sender: 'VM-AIRTEL', body: 'Your data pack of 2GB/day expires tomorrow. Recharge now with Rs 349 for 28 days. Click airtel.in/r' },
  { sender: 'VM-SWIGGY', body: 'Hungry? Flat 60% OFF up to Rs 120 on your next order. Use code TRYNEW. T&C apply.' },
  { sender: 'VM-HDFCBK', body: 'Dear Customer, your standing instruction for Rs 5,000 SIP to Axis MF is scheduled for 05-11-2026.' },
  { sender: 'VM-ICICIB', body: 'Do not share your card details, OTP or PIN with anyone. ICICI Bank never asks for them. Stay safe!' },
];
