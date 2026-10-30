import { Platform } from 'react-native';

import type { Category, PaymentMethod, Txn } from './types';

/**
 * Kharcha API (Go server). Set EXPO_PUBLIC_API_URL for devices; the defaults
 * reach a server on the dev machine from the Android emulator / iOS simulator.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, opts: { method?: string; token?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new ApiError(res.status, json.error ?? `HTTP ${res.status}`);
    return json as T;
  } finally {
    clearTimeout(timer);
  }
}

export type AuthResponse = { token: string; user: { id: string; email: string; name: string | null } };

/** One redacted SMS/email the on-device rules couldn't parse confidently. */
export type ExtractItem = { id: string; kind: 'sms' | 'email'; sender: string; text: string; receivedAt: number };

/** The PRD's strict extraction schema. */
export type Extracted = {
  id: string;
  type: 'debit' | 'credit' | 'refund' | 'ignore';
  amount: number;
  currency: string;
  merchant: string;
  category: Category;
  timestamp: number | null;
  account_hint: string | null;
  payment_method: PaymentMethod | null;
  upi_ref: string | null;
  order_id: string | null;
  confidence: number;
};

export type RoastRequest = {
  date: string;
  intensity: 'mild' | 'savage';
  budget: number;
  spent: number;
  topCategory: string | null;
  biggest: { merchant: string; amount: number } | null;
  quickOrders: number;
  merchants: string[];
};

/** Transaction as exchanged with the server (rupee amounts as paise integers). */
export type WireTxn = Omit<Txn, 'syncedAt'>;

export type GmailStatus = { connected: boolean; email: string | null; lastSyncAt: number | null; senders: string[] };

export const api = {
  health: () => request<{ ok: boolean; llm: string; gmail?: boolean }>('/healthz', { timeoutMs: 4000 }),
  devLogin: (email: string, name?: string) => request<AuthResponse>('/v1/auth/dev', { body: { email, name } }),
  googleLogin: (idToken: string) => request<AuthResponse>('/v1/auth/google', { body: { idToken } }),

  extract: (token: string, items: ExtractItem[]) =>
    request<{ results: Extracted[] }>('/v1/extract', { token, body: { items }, timeoutMs: 90_000 }),
  roast: (token: string, body: RoastRequest) => request<{ verdict: string }>('/v1/roast', { token, body, timeoutMs: 30_000 }),

  pushTransactions: (token: string, txns: WireTxn[]) =>
    request<{ accepted: string[] }>('/v1/transactions/batch', { token, body: { transactions: txns } }),
  pullTransactions: (token: string, since: number) =>
    request<{ transactions: WireTxn[]; cursor: number }>(`/v1/transactions?since=${since}`, { token }),

  gmailConnect: (token: string, serverAuthCode: string, redirectUri?: string) =>
    request<GmailStatus>('/v1/gmail/connect', { token, body: { code: serverAuthCode, redirectUri } }),
  gmailStatus: (token: string) => request<GmailStatus>('/v1/gmail/status', { token }),
  gmailSync: (token: string) => request<{ queued: boolean }>('/v1/gmail/sync', { token, body: {} }),
  gmailDisconnect: (token: string) => request<{ ok: boolean }>('/v1/gmail', { token, method: 'DELETE' }),

  exportAll: (token: string) => request<Record<string, unknown>>('/v1/me/export', { token }),
  deleteAccount: (token: string) => request<{ ok: boolean }>('/v1/me', { token, method: 'DELETE' }),
};
