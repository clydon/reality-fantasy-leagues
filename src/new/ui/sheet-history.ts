"use client";

import { useEffect, useRef } from "react";
import { floor, FLOOR, putEntry, SHEET } from "@/lib/history-entries";

// Back closes a bottom sheet (the user, 2026-10-29): the phone's back, the browser's back, takes the sheet down instead
// of leaving the page, as classic's More sheet does (mobile-nav.tsx). Every new-design sheet (./sheet.tsx) gets it here.
//
// How: an open sheet puts one entry on the history, at the page's address and with the page's own state (so Next's
// router, which owns the entry under it, finds what it wrote if it ever lands on it), marked with the sheet's id.
// A back lands on the entry under it: the sheets above that entry close, the top one only for one back. A sheet closed
// any other way (its button, a tap outside, a swipe, Escape, its page closing it) takes its entry back out with a
// history.back() of its own, so the next back isn't a dead press. Those pops are the sheets' own business: Next's
// router never sees them (it would restore the page it already shows and could undo a navigation that's under way),
// and a push Next makes while one is in flight waits for it to land. One sheet for another in the same tap (Add a
// run, then its time) swaps the entry.
//
// A navigation from a sheet to another page takes the sheet's entry rather than going above it, so back from there
// comes to the page under the sheet; so does one in the tap that closes the sheet. A push on the same page with the
// sheet still up (a page pushed over it) goes above it, and back comes to the sheet. An entry left behind by a sheet
// that's gone (one closed under a push, a reload) is passed over, the way the history was going. nav.tsx's back
// leaves the page through the open sheets' entries (leaveThroughSheets).
//
// The installed app's floor (components/phone-back.tsx) stays under the page: a sheet opening while "Press back again
// to exit" is up puts the page back above the floor first. scripts/dev-test/check-sheet-back.js checks it in a browser.

type Open = { id: string; close: () => void; leaving: boolean; put: boolean };

/** Open sheets, oldest first. */
const stack: Open[] = [];
// Ids differ from one page load to the next: an entry kept through a reload never passes for a sheet of this one.
const LOAD = Math.random().toString(36).slice(2, 8);
let count = 0;
let wrapped: { push: History["pushState"]; replace: History["replaceState"] } | null = null;
/** The sheets' own pops not yet landed, the entry the last one left, and what Next did meanwhile. */
let pendingPops = 0;
let leftEntry: string | null = null;
let held: (() => void)[] = [];
let holdTimer: ReturnType<typeof setTimeout> | undefined;
/** The address and place in the history on screen as of the last change. A sheet's own pop keeps the address (a page
 *  that rewrote it while the sheet was up, a desk filter, keeps it once the sheet is down); the place says which way
 *  the history went. */
let screenHref = "";
let screenIndex = -1;
/** A navigation nav.tsx has started and Next hasn't put on the history yet (its start time), and the entry of a sheet
 *  that closed in the same tap: a back now would lose the navigation, so the navigation takes that entry instead. */
let navFrom = 0;
let dangling: string | null = null;
let danglingTimer: ReturnType<typeof setTimeout> | undefined;

const navIndex = () => (window as unknown as { navigation?: { currentEntry: { index: number } | null } }).navigation?.currentEntry?.index ?? -1;
function onScreen() {
  screenHref = window.location.href;
  screenIndex = navIndex();
}

/** The sheet whose entry this is, if it's one. */
function sheetOf(state: unknown): string | null {
  if (typeof state !== "object" || state === null) return null;
  const id = (state as Record<string, unknown>)[SHEET];
  return typeof id === "string" ? id : null;
}
const openOn = (state: unknown) => {
  const id = sheetOf(state);
  return id == null ? null : (stack.find((s) => s.id === id) ?? null);
};

function flush() {
  clearTimeout(holdTimer);
  const calls = held;
  held = [];
  pendingPops = 0;
  leftEntry = null;
  for (const call of calls) call();
}

/** A pop of the sheets' own: back, or forward past a gone sheet's entry. */
function step(forward = false) {
  pendingPops++;
  leftEntry = sheetOf(window.history.state);
  clearTimeout(holdTimer);
  // A pop that never lands mustn't hold Next's pushes for ever; one that's only slow (a busy phone) still lands first.
  let waited = 0;
  const wait = () => {
    holdTimer = setTimeout(() => {
      if (leftEntry != null && sheetOf(window.history.state) === leftEntry && (waited += 500) < 5000) wait();
      else flush();
    }, 500);
  };
  wait();
  if (forward) window.history.forward();
  else window.history.back();
}

function onPop(e: PopStateEvent) {
  const ours = pendingPops > 0;
  dangling = null;
  if (ours) pendingPops--;
  const left = screenHref;
  const forward = screenIndex >= 0 && navIndex() > screenIndex;
  onScreen();
  const landed = sheetOf(e.state);
  const at = landed == null ? -1 : stack.findIndex((s) => s.id === landed);
  if (landed != null && at < 0) {
    // A gone sheet's entry: on past it, the same way. Next sees this one, which may be the way back from another page.
    // Forward with nothing further: it's just the page's entry now.
    if (forward && !(window as unknown as { navigation?: { canGoForward: boolean } }).navigation?.canGoForward) putEntry(false, withoutSheet(e.state));
    else step(forward);
    if (pendingPops === 0) flush();
    return;
  }
  const above = forward ? [] : stack.splice(at + 1);
  // The same page under a sheet: the sheets' own business. Another page (Chrome's back passed over a sheet's entry put
  // up with no tap) is Next's.
  const samePage = new URL(left || window.location.href).pathname === window.location.pathname;
  if ((above.length || ours) && samePage) {
    e.stopImmediatePropagation();
    if (left && left !== window.location.href) {
      putEntry(false, window.history.state, left);
      onScreen();
    }
  }
  for (const s of above.reverse()) s.close();
  if (pendingPops === 0) flush();
}

function install() {
  if (wrapped && window.history.pushState === wrapped.push && window.history.replaceState === wrapped.replace) return;
  // Next's own wrappers (app-router.js), or the browser's: every navigation Next makes comes through these. Wrapped
  // again if Next ever puts its own back (its router's effect re-running).
  const push = window.history.pushState;
  const replace = window.history.replaceState;
  let taking = false;
  const ourPush = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
    if (pendingPops > 0) {
      held.push(() => window.history.pushState(data, unused, url));
      return;
    }
    const top = openOn(window.history.state);
    const away = url != null && new URL(url, window.location.href).pathname !== window.location.pathname;
    if (away) navFrom = 0;
    if (dangling != null && sheetOf(window.history.state) === dangling) {
      // The navigation from the tap that closed a sheet: it takes the sheet's entry.
      dangling = null;
      clearTimeout(danglingTimer);
      taking = true;
      try {
        replace.call(this, data, unused, url);
      } finally {
        taking = false;
      }
      onScreen();
      return;
    }
    if (!top || (!top.leaving && !away)) {
      push.call(this, data, unused, url);
      onScreen();
      return;
    }
    // From a sheet to another page, or in the tap that closed it: the new page takes the sheet's entry.
    taking = true;
    try {
      replace.call(this, data, unused, url);
    } finally {
      taking = false;
    }
    onScreen();
    const gone = stack.splice(stack.indexOf(top)).reverse();
    // Next pushes from an insertion effect, where React takes no updates.
    queueMicrotask(() => gone.forEach((s) => s.close()));
  } as History["pushState"];
  const ourReplace = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
    if (pendingPops > 0) {
      held.push(() => window.history.replaceState(data, unused, url));
      return;
    }
    const top = openOn(window.history.state);
    const left = dangling != null && sheetOf(window.history.state) === dangling;
    const away = url != null && new URL(url, window.location.href).pathname !== window.location.pathname;
    if (away) navFrom = 0;
    if (away && !taking && (top || left)) {
      // A navigation by replace (a show's tabs) from a sheet's entry: the new page takes it, as a push does.
      dangling = null;
      clearTimeout(danglingTimer);
      replace.call(this, data, unused, url);
      onScreen();
      if (top) {
        const gone = stack.splice(stack.indexOf(top)).reverse();
        queueMicrotask(() => gone.forEach((s) => s.close()));
      }
      return;
    }
    const mark = top?.id ?? (left ? dangling : null);
    // Next rewrites the entry on screen with its own state (a refresh, a server action): the sheet keeps its mark.
    if (mark != null && !taking && sheetOf(data) == null) data = { ...((data as object | null) ?? {}), [SHEET]: mark };
    replace.call(this, data, unused, url);
    onScreen();
  } as History["replaceState"];
  window.history.pushState = ourPush;
  window.history.replaceState = ourReplace;
  if (!wrapped) {
    window.addEventListener("popstate", onPop, true);
    // A sheet's entry kept through a reload: just the page's now.
    if (sheetOf(window.history.state) != null) putEntry(false, withoutSheet(window.history.state));
  }
  wrapped = { push: ourPush, replace: ourReplace };
}

function withoutSheet(state: unknown) {
  const rest = { ...(state as Record<string, unknown>) };
  delete rest[SHEET];
  return rest;
}

/** A sheet's entry, once a sheet's own pop in flight has landed (a couch sheet opens 30 ms after the last one closed). */
function put(s: Open) {
  if (pendingPops > 0) {
    held.push(() => put(s));
    return;
  }
  // Closed meanwhile.
  if (!stack.includes(s)) return;
  install();
  floor.lift();
  const state = withoutSheet(window.history.state ?? {});
  delete state[FLOOR];
  putEntry(true, { ...state, [SHEET]: s.id });
  s.put = true;
  onScreen();
}

function leave(s: Open) {
  const at = stack.indexOf(s);
  // Closed by a back, or its entry went to a navigation.
  if (at < 0) return;
  stack.splice(at, 1);
  if (!s.put || sheetOf(window.history.state) !== s.id) return;
  if (!navStarting()) return step();
  // Closed in the tap that goes somewhere: the navigation takes the entry. If none comes (it went nowhere), the entry
  // comes out once it's clearly not coming.
  dangling = s.id;
  clearTimeout(danglingTimer);
  const check = () => {
    danglingTimer = setTimeout(() => {
      if (dangling !== s.id) return;
      if (navStarting()) return check();
      dangling = null;
      if (sheetOf(window.history.state) === s.id) step();
    }, 1000);
  };
  check();
}

/** nav.tsx: a navigation is starting (a NavLink's tap, nav.push). */
export function navigating() {
  // Installed now if no sheet has been up yet, so the navigation is seen landing.
  install();
  navFrom = Date.now();
}

/** A navigation nav.tsx started and hasn't landed, as far as a sheet closing now goes: one that hasn't landed in 15 s
 *  (it went nowhere, or failed) no longer counts. */
const navStarting = () => navFrom > 0 && Date.now() - navFrom < 15000;

/** How many entries the open sheets have above the page: a back that leaves the page goes past them (nav.tsx). They
 *  close with the page. */
export function leaveThroughSheets(): number {
  const n = stack.filter((s) => s.put).length;
  stack.length = 0;
  return n;
}

/** A sheet's entry while it's open; a back closes it through `close`. */
export function useSheetHistory(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  const entry = useRef<Open | null>(null);
  useEffect(() => {
    if (!open) return;
    let s = entry.current;
    if (s?.leaving) {
      // Strict Mode's second run: the entry stays.
      s.leaving = false;
    } else {
      s = { id: `${LOAD}.${++count}`, close: () => closeRef.current(), leaving: false, put: false };
      entry.current = s;
      const top = stack.at(-1);
      if (top?.leaving && top.put && pendingPops === 0 && sheetOf(window.history.state) === top.id) {
        // One sheet for another in the same tap: the new one takes its entry.
        stack.pop();
        putEntry(false, { ...window.history.state, [SHEET]: s.id });
        s.put = true;
        stack.push(s);
      } else {
        stack.push(s);
        put(s);
      }
    }
    const mine = s;
    return () => {
      mine.leaving = true;
      queueMicrotask(() => {
        if (!mine.leaving) return;
        if (entry.current === mine) entry.current = null;
        leave(mine);
      });
    };
  }, [open]);
}
