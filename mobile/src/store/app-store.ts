import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type FixedCostKind = 'rent' | 'emi' | 'sip' | 'insurance' | 'other';
export type FixedCost = { id: string; label: string; amount: number; kind: FixedCostKind };
export type RoastIntensity = 'off' | 'mild' | 'savage';
export type ThemePref = 'system' | 'dark' | 'light';

/** All money values are integer paise. */
export type Profile = {
  name: string;
  salary: number;
  fixedCosts: FixedCost[];
  /** Day of month salary lands (1–31). The budget cycle runs payday → payday. */
  payday: number;
};

export type Settings = {
  rollover: boolean;
  redistributeOverspend: boolean;
  roast: RoastIntensity;
  reportHour: number;
  reportMinute: number;
  theme: ThemePref;
  smsEnabled: boolean;
  /** Read payment notifications instead (Play Store fallback when READ_SMS isn't allowed). */
  notificationFallback: boolean;
  backgroundSync: boolean;
  /** Ask the server LLM for a fresh verdict line (falls back to on-device lines). */
  aiVerdicts: boolean;
};

export type SyncState = {
  lastSyncAt: number | null;
  /** Newest SMS timestamp already processed; the next sync reads after this. */
  smsCursor: number | null;
  /** Newest payment notification already processed (notification fallback). */
  notifCursor: number | null;
  /** Server change sequence already pulled. */
  serverCursor: number;
  gmail: { connected: boolean; email: string | null };
};

/** Signed-in server account. The session token itself is in SecureStore (features/account/session). */
export type Account = { email: string; name: string | null } | null;

type State = {
  onboarded: boolean;
  /** When onboarding finished; the budget engine ignores days before this. */
  trackingStart: number | null;
  consentAt: number | null;
  profile: Profile;
  settings: Settings;
  sync: SyncState;
  account: Account;
  setProfile: (patch: Partial<Profile>) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setSync: (patch: Partial<SyncState>) => void;
  setAccount: (account: Account) => void;
  completeOnboarding: () => void;
  giveConsent: () => void;
  reset: () => void;
};

export const DEFAULT_PROFILE: Profile = { name: '', salary: 0, fixedCosts: [], payday: 1 };

export const DEFAULT_SETTINGS: Settings = {
  rollover: true,
  redistributeOverspend: true,
  roast: 'savage',
  reportHour: 22,
  reportMinute: 0,
  theme: 'dark',
  smsEnabled: false,
  notificationFallback: false,
  backgroundSync: true,
  aiVerdicts: true,
};

const DEFAULT_SYNC: SyncState = { lastSyncAt: null, smsCursor: null, notifCursor: null, serverCursor: 0, gmail: { connected: false, email: null } };

// The kv-store has a synchronous API, so the store hydrates before the first render.
const kvStorage = createJSONStorage(() => ({
  getItem: (key: string) => Storage.getItemSync(key),
  setItem: (key: string, value: string) => Storage.setItemSync(key, value),
  removeItem: (key: string) => {
    Storage.removeItemSync(key);
  },
}));

export const useApp = create<State>()(
  persist(
    (set) => ({
      onboarded: false,
      trackingStart: null,
      consentAt: null,
      profile: DEFAULT_PROFILE,
      settings: DEFAULT_SETTINGS,
      sync: DEFAULT_SYNC,
      account: null,
      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setSync: (patch) => set((s) => ({ sync: { ...s.sync, ...patch } })),
      setAccount: (account) => set({ account }),
      completeOnboarding: () => set((s) => ({ onboarded: true, trackingStart: s.trackingStart ?? Date.now() })),
      giveConsent: () => set({ consentAt: Date.now() }),
      reset: () =>
        set({
          onboarded: false,
          trackingStart: null,
          consentAt: null,
          profile: DEFAULT_PROFILE,
          settings: DEFAULT_SETTINGS,
          sync: DEFAULT_SYNC,
          account: null,
        }),
    }),
    {
      name: 'kharcha.app',
      version: 2,
      storage: kvStorage,
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<State>;
        // v1 had no trackingStart: start tracking from the upgrade, not the cycle start.
        if (version < 2 && p.onboarded && !p.trackingStart) p.trackingStart = Date.now();
        return p as State;
      },
      partialize: ({ onboarded, trackingStart, consentAt, profile, settings, sync, account }) => ({
        onboarded,
        trackingStart,
        consentAt,
        profile,
        settings,
        sync,
        account,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          ...p,
          profile: { ...current.profile, ...p.profile },
          settings: { ...current.settings, ...p.settings },
          sync: { ...current.sync, ...p.sync },
        };
      },
    },
  ),
);

/** Bumped after every local write so screens re-run their (synchronous) queries. */
export const useDataVersion = create<{ version: number }>(() => ({ version: 0 }));
export const bumpData = () => useDataVersion.setState((s) => ({ version: s.version + 1 }));
