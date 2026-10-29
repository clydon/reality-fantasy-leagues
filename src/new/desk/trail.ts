"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { create } from "zustand";

// Where Back goes on the desk, and what it says (docs/PLAN-desk-parity.md, The desk's pages and how they link; the mock's
// DK.trail): every desk page puts itself on a trail as it opens, named by what it shows (riley, Couch Council, Survivor
// 51); going to a page already on it cuts back to there; the tabs start it over. Back names the page before this one,
// and a page opened straight from a link falls back to its parent in the desk. Kept per browser tab (sessionStorage), so
// a reload keeps it. Find's Recently opened is the same pages, kept per browser (localStorage). Both are read once the
// page is on screen, so the server's render and the first one here agree.

export interface Crumb {
  /** The path, which a page is matched by. */
  path: string;
  /** The path with its query (a list's search and filter), where Back goes. */
  href: string;
  label: string;
}

export interface Opened {
  href: string;
  label: string;
  /** What it is ("Person", "Couch"...), Recently opened's line. */
  kind: string;
}

const TRAIL = "gys.desk.trail";
const RECENT = "gys.desk.recent";
const MAX_TRAIL = 12;
const MAX_RECENT = 8;

function read<T>(store: Storage | undefined, key: string): T[] {
  try {
    const v = JSON.parse(store?.getItem(key) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write(store: Storage | undefined, key: string, v: unknown) {
  try {
    store?.setItem(key, JSON.stringify(v));
  } catch {
    /* a private window: the trail lasts as long as the page */
  }
}
const session = () => (typeof window === "undefined" ? undefined : window.sessionStorage);
const local = () => (typeof window === "undefined" ? undefined : window.localStorage);

const useTrailStore = create<{ loaded: boolean; trail: Crumb[]; recent: Opened[] }>(() => ({ loaded: false, trail: [], recent: [] }));

/** Read once a page is on screen. A trail is kept only for a page on it (a reload, or back to it): any other page this tab
 *  opens on came from a link, so it starts a trail of its own. */
function load() {
  if (useTrailStore.getState().loaded) return;
  const trail = read<Crumb>(session(), TRAIL);
  useTrailStore.setState({ loaded: true, trail: trail.some((c) => c.path === window.location.pathname) ? trail : [], recent: read<Opened>(local(), RECENT) });
}

/** Puts this page on the trail (a tab starts it over) and, for one thing's page, on Recently opened. */
function visit(crumb: Crumb, opts: { start?: boolean; kind?: string }) {
  const { trail, recent } = useTrailStore.getState();
  let next: Crumb[];
  if (opts.start) next = [crumb];
  else {
    const i = trail.findIndex((c) => c.path === crumb.path);
    next = i >= 0 ? [...trail.slice(0, i), crumb] : [...trail, crumb].slice(-MAX_TRAIL);
  }
  const patch: { trail: Crumb[]; recent?: Opened[] } = { trail: next };
  if (opts.kind) patch.recent = [{ href: crumb.href, label: crumb.label, kind: opts.kind }, ...recent.filter((r) => r.href.split("?")[0] !== crumb.path)].slice(0, MAX_RECENT);
  useTrailStore.setState(patch);
  write(session(), TRAIL, patch.trail);
  if (patch.recent) write(local(), RECENT, patch.recent);
}

/**
 * This page on the trail, named `label` (null while it loads: it joins once it has its name), and the page Back goes to:
 * the one before it on the trail, or null when there's none (opened from a link: Back falls back to its parent).
 * `start`: one of the desk's tabs. `kind`: one thing's page, also kept in Recently opened.
 */
export function useDeskTrail(label: string | null, opts: { start?: boolean; kind?: string } = {}): Crumb | null {
  const path = usePathname();
  const search = useSearchParams().toString();
  const href = search ? `${path}?${search}` : path;
  const { loaded, trail } = useTrailStore();
  const { start, kind } = opts;
  useEffect(load, []);
  useEffect(() => {
    if (loaded && label) visit({ path, href, label }, { start, kind });
  }, [loaded, path, href, label, start, kind]);
  if (start || !loaded) return null;
  const i = trail.findIndex((c) => c.path === path);
  // Until this page joins, the last on the trail is the one it was opened from.
  return (i >= 0 ? trail[i - 1] : trail[trail.length - 1]) ?? null;
}

/** Find's Recently opened, newest first (empty until the page is on screen). */
export function useRecentlyOpened(): Opened[] {
  const { loaded, recent } = useTrailStore();
  useEffect(load, []);
  return loaded ? recent : [];
}

// Leaving the desk ends the trail: coming back through a link starts a new one, so Back never names a page from an
// earlier visit. React's dev double mount (unmount, then mount again at once) cancels the leave before it lands.
let leaving: ReturnType<typeof setTimeout> | undefined;

/** Mounted once, by the desk's screen: while it's mounted, the trail stands; when it goes, so does the trail. */
export function useDeskStay() {
  useEffect(() => {
    clearTimeout(leaving);
    return () => {
      leaving = setTimeout(() => {
        useTrailStore.setState({ trail: [] });
        write(session(), TRAIL, []);
      }, 0);
    };
  }, []);
}

/** A page whose thing is gone (an account deleted): off the trail and Recently opened, so nothing goes back to it. */
export function forgetDeskPage(path: string) {
  const { trail, recent } = useTrailStore.getState();
  const next = { trail: trail.filter((c) => c.path !== path), recent: recent.filter((r) => r.href.split("?")[0] !== path) };
  useTrailStore.setState(next);
  write(session(), TRAIL, next.trail);
  write(local(), RECENT, next.recent);
}
