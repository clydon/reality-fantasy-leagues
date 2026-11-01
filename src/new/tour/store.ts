import { useSyncExternalStore } from "react";

// Take the tour (docs/PLAN-first-time-tour.md): from the menu behind your picture on Home (hub/profile.tsx) or Settings, asks Home
// to play the tour again. Not the address, so going back to Home leaves no ?tour in the history (`/home?tour=1` also plays it, for
// a link); this tab's sessionStorage as well as this page, because Back to Home can be the browser's own back to a page loaded
// before (a full load, which starts the page's flags over). Home's tour hears it at once (`useTourAsked`: the menu is on Home
// itself) and clears it as the tour starts.

const KEY = "gys.tour.ask";
let asked = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function askTour() {
  asked = true;
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* this tab keeps nothing: the flag in this page still asks */
  }
  emit();
}

export function tourAsked() {
  if (asked) return true;
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function clearTourAsk() {
  asked = false;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing kept */
  }
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** Whether the tour's been asked for, as it changes. */
export function useTourAsked(): boolean {
  return useSyncExternalStore(subscribe, tourAsked, () => false);
}

// The tour waiting on another page (a step that goes there for real: your moves, tour.tsx), to carry on from that step when Home's
// back: its run (tour.tsx's own), the step and its count ("4/10") for the Back to the tour pill (back.tsx). This page only: a reload
// starts the tour over.
export type TourVisit = { at: number; count: string; run: unknown };
let visit: TourVisit | null = null;

export function setTourVisit(v: TourVisit | null) {
  visit = v;
  emit();
}

/** The waiting tour, taken: Home carries on with it. */
export function takeTourVisit() {
  const v = visit;
  visit = null;
  emit();
  return v;
}

export function useTourVisit(): TourVisit | null {
  return useSyncExternalStore(
    subscribe,
    () => visit,
    () => null
  );
}
