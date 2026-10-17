"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLeagueStore } from "@/lib/store";
import { isStandalone } from "@/lib/push-client";

// The page last open in the installed app, so reopening it after the phone quietly closed it in the
// background (iOS and Android both do, often within minutes) puts you back where you were -- an
// episode, the chat, a player's score -- instead of on Overview. Per device (localStorage).
//
// Only a fresh launch of the installed app (not a browser tab, where typing the address means "the
// front page"), only one that opened on the start URL (a notification's link or a shared link wins),
// and only within RESTORE_WINDOW of last using the app: back after a few minutes means "carry on",
// back days later means "what's new" -- which is Overview's job. A reload never restores: it keeps
// its own URL, and this tab's launch marker (sessionStorage) says it has already booted.
//
// `at` is when you last LEFT the app (stamped when it's hidden), not when you arrived on the page:
// an hour in the chat then switching away is a minute-old visit, not an hour-old one.

const KEY = "rfl.lastPage";
const LAUNCHED_KEY = "rfl.launched";
const RESTORE_WINDOW = 6 * 60 * 60 * 1000;

// Never returned to: flows you finish and leave (creating a league, choosing where to start), and
// the reveal, which plays results you've already seen by the time you could come back to it.
const NOT_RESTORED = ["/new-league", "/late-join", "/reveal", "/forgot-password", "/reset-password"];

export interface LastPage {
  userId: string;
  leagueId: string | null;
  path: string;
  at: number;
}

function read(): LastPage | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    return saved && typeof saved.path === "string" && typeof saved.at === "number" ? saved : null;
  } catch {
    return null;
  }
}

export function rememberPage(userId: string, leagueId: string | null, path: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ userId, leagueId, path, at: Date.now() } satisfies LastPage));
  } catch {
    /* not remembered: the next launch opens on Overview */
  }
}

/** Re-stamps the remembered page as just left. Called when the app is hidden. */
export function touchPage() {
  const saved = read();
  if (saved) rememberPage(saved.userId, saved.leagueId, saved.path);
}

/**
 * The page to reopen, read once on boot. Null on a reload, outside the installed app, when the app
 * was opened at a particular link, or when the last visit is too old. Marks this tab as launched
 * either way, so it's only ever answered once per launch.
 */
export function pageToRestore(): LastPage | null {
  try {
    if (sessionStorage.getItem(LAUNCHED_KEY)) return null;
    sessionStorage.setItem(LAUNCHED_KEY, "1");
  } catch {
    return null;
  }
  if (!isStandalone() || window.location.pathname !== "/" || window.location.search) return null;
  const saved = read();
  if (!saved || Date.now() - saved.at > RESTORE_WINDOW) return null;
  if (NOT_RESTORED.some((r) => saved.path === r || saved.path.startsWith(`${r}/`))) return null;
  return saved;
}

/** Remembers each page of a real league as you arrive on it, and stamps it when the app is hidden.
    Mounted once, in AuthGate. Not the demo or the tour: there's nothing of yours to return to. */
export function useRememberPage() {
  const pathname = usePathname();
  const live = useLeagueStore((s) => s.entered && s.mode === "live");
  const userId = useLeagueStore((s) => s.userId);
  const leagueId = useLeagueStore((s) => s.leagueId);

  useEffect(() => {
    if (!live || !userId) return;
    // A notification's ?league= has done its job once the league is open; reopening with it would
    // pick the league over the one you'd switched to since.
    const search = new URLSearchParams(window.location.search);
    search.delete("league");
    const query = search.toString();
    rememberPage(userId, leagueId, query ? `${pathname}?${query}` : pathname);
  }, [live, userId, leagueId, pathname]);

  useEffect(() => {
    if (!live) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") touchPage();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [live]);
}
