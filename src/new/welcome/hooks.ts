"use client";

import { useSyncExternalStore } from "react";
import { clearFirstRun, parseFirstRun, type FirstRunPicks } from "../way-in";

// The way in's reads of the device (step 9 part 2): whether the page has hydrated (anything that differs between the
// server and this phone, a date or what's stored, waits for it), reduced motion, and first run's stored picks.

const never = () => () => {};

/** False in the server render and the hydration pass, true after. */
export function useHydrated(): boolean {
  return useSyncExternalStore(never, () => true, () => false);
}

const MOTION = "(prefers-reduced-motion: reduce)";
const onMotion = (l: () => void) => {
  const m = window.matchMedia(MOTION);
  m.addEventListener("change", l);
  return () => m.removeEventListener("change", l);
};

/** prefers-reduced-motion, kept current. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(onMotion, () => window.matchMedia(MOTION).matches, () => false);
}

// First run's picks (way-in.ts), as a store: writes go through writeFirstRun / clearFirstRun, which tell it.
const KEY = "gys.firstRun";
const listeners = new Set<() => void>();
let cache: { raw: string | null; picks: FirstRunPicks } | null = null;
const SERVER: FirstRunPicks = { picked: [], where: {}, at: 0 };

function snapshot(): FirstRunPicks {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* none */
  }
  if (!cache || cache.raw !== raw) cache = { raw, picks: parseFirstRun(raw) };
  return cache.picks;
}

/** Tell the store first run's picks changed (way-in.ts calls it after every write). */
export function firstRunChanged() {
  listeners.forEach((l) => l());
}

const onFirstRun = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useFirstRun(): FirstRunPicks {
  return useSyncExternalStore(onFirstRun, snapshot, () => SERVER);
}

/** First run's picks are saved: let them go. */
export function forgetFirstRun() {
  clearFirstRun();
  firstRunChanged();
}
