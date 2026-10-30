import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { computeCycleBudget, type CycleBudget } from '@/features/budget/budget';
import { addDays, cycleFor, dayKey, startOfDay } from '@/lib/dates';
import { useApp, useDataVersion } from '@/store/app-store';

import { spentByDay } from './transactions';

const subscribeData = (onChange: () => void) => useDataVersion.subscribe(onChange);

/**
 * Runs a synchronous SQLite query and re-runs it whenever local data changes
 * (the data version bumps) or `deps` change. Results are cached per
 * (version, deps), so re-renders don't hit the database.
 */
export function useDbQuery<T>(query: () => T, deps: readonly (string | number | boolean | null)[]): T {
  const key = JSON.stringify(deps);
  const cache = useRef<{ version: number; key: string; value: T } | null>(null);
  const getSnapshot = useCallback(() => {
    const version = useDataVersion.getState().version;
    const hit = cache.current;
    if (hit && hit.version === version && hit.key === key) return hit.value;
    const value = query();
    cache.current = { version, key, value };
    return value;
  }, [key, query]);
  return useSyncExternalStore(subscribeData, getSnapshot);
}

/** Current time, refreshed every minute and when the app returns to the foreground. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, intervalMs);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [intervalMs]);
  return now;
}

export function useBudgetInput() {
  const profile = useApp((s) => s.profile);
  const settings = useApp((s) => s.settings);
  const trackingStart = useApp((s) => s.trackingStart);
  return {
    trackingStart,
    salary: profile.salary,
    fixedCosts: profile.fixedCosts.reduce((sum, f) => sum + f.amount, 0),
    payday: profile.payday,
    rollover: settings.rollover,
    redistributeOverspend: settings.redistributeOverspend,
  };
}

/** The budget for the salary cycle containing `at` (default: now). */
export function useCycleBudget(at?: Date): CycleBudget {
  const now = useNow();
  const date = at ?? now;
  const input = useBudgetInput();
  const key = dayKey(date);
  const spent = useDbQuery(() => {
    const cycle = cycleFor(date, input.payday);
    return spentByDay(cycle.start.getTime(), cycle.end.getTime());
  }, [key, input.payday]);
  return computeCycleBudget(input, spent, date);
}

/** Budget vs spend for the last `n` days ending today; days in earlier cycles use that cycle's budget. */
export function useRecentDays(n: number) {
  const now = useNow();
  const input = useBudgetInput();
  const key = dayKey(now);
  const spentAll = useDbQuery(() => {
    const from = cycleFor(addDays(now, -(n - 1)), input.payday).start;
    return spentByDay(from.getTime(), startOfDay(addDays(now, 1)).getTime());
  }, [key, n, input.payday]);

  return Array.from({ length: n }, (_, i) => {
    const date = addDays(now, i - (n - 1));
    const cb = computeCycleBudget(input, spentAll, date);
    return { date, ...cb.today };
  });
}
