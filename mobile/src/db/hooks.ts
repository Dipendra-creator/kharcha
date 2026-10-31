import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { computeCycleBudget, type BudgetInput, type CycleBudget, type DayBudget } from '@/features/budget/budget';
import { addDays, cycleFor, dayKey, fromDayKey, startOfDay } from '@/lib/dates';
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

type StoreState = ReturnType<typeof useApp.getState>;

/** The budget engine's input from app state; outside React, pass `useApp.getState()`. */
export function budgetInputOf({ profile, settings, trackingStart }: Pick<StoreState, 'profile' | 'settings' | 'trackingStart'>): BudgetInput {
  return {
    trackingStart,
    salary: profile.salary,
    fixedCosts: profile.fixedCosts.reduce((sum, f) => sum + f.amount, 0),
    payday: profile.payday,
    rollover: settings.rollover,
    redistributeOverspend: settings.redistributeOverspend,
  };
}

export function useBudgetInput(): BudgetInput {
  const profile = useApp((s) => s.profile);
  const settings = useApp((s) => s.settings);
  const trackingStart = useApp((s) => s.trackingStart);
  return budgetInputOf({ profile, settings, trackingStart });
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

export type RangeDay = DayBudget & {
  date: Date;
  /** Unadjusted daily budget of the day's cycle. */
  base: number;
  /** After today: no budget or spend yet. */
  future: boolean;
};

/**
 * Budget vs spend for `count` days starting at `from`; each day uses its own
 * cycle's budget, so a range may span paydays.
 */
export function useDayRange(from: Date, count: number): RangeDay[] {
  const now = useNow();
  const input = useBudgetInput();
  const todayKey = dayKey(now);
  const fromKey = dayKey(from);
  const spentAll = useDbQuery(() => {
    const start = cycleFor(fromDayKey(fromKey), input.payday).start;
    return spentByDay(start.getTime(), addDays(fromDayKey(fromKey), count).getTime());
  }, [fromKey, count, input.payday, todayKey]);

  return Array.from({ length: count }, (_, i) => {
    const date = addDays(fromDayKey(fromKey), i);
    const key = dayKey(date);
    if (key > todayKey) return { date, key, base: 0, budget: 0, spent: 0, remaining: 0, ratio: 0, future: true };
    const cb = computeCycleBudget(input, spentAll, date);
    return { date, base: cb.base, ...cb.today, future: false };
  });
}

/** Budget vs spend for the last `n` days ending today. */
export function useRecentDays(n: number): RangeDay[] {
  const now = useNow();
  return useDayRange(addDays(startOfDay(now), -(n - 1)), n);
}
