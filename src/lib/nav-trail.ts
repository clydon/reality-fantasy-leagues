"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { create } from "zustand";
import { useLeagueStore } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";

// Where "back" goes, and what it says (docs/DESIGN.md, Navigation). A page under another (an
// episode, a player's score, a settings page) backs up to the page you actually came from, named:
// Overview's "Recap" opens Episode 3 with "‹ Overview", not a bare chevron to an Episodes list you
// never saw. Opened cold (a reload, a shared link, a notification), it falls back to the page's
// parent in the app's structure.
//
// The trail is the in-app stack since the last top-level page (a tab, Overview, League Settings):
// arriving on one of those starts it over, arriving on the page before the current one pops it (that
// was a back), anything else pushes. Kept per browser tab in sessionStorage so a reload keeps it.

const STORAGE_KEY = "nav-trail";
const MAX = 12;

export interface BackTarget {
  href: string;
  label: string;
  /** The previous page in this tab's history: going back pops it (and keeps its scroll) rather than
      pushing a new entry, so the phone's own back gesture and this button agree. */
  viaHistory: boolean;
}

const TOP_TITLES: Record<string, string> = {
  "/": "Overview",
  "/episodes": "Episodes",
  "/scoreboard": "Scoreboard",
  "/draft": "Draft",
  "/mid-season": "Mid-Season",
  "/research": "Research",
  "/lineup": "Lineup",
  "/pick": "Pick",
  "/chat": "Chat",
  "/setup": "League Settings",
  "/account": "Account",
  "/dashboard": "My Leagues",
};

/** The structural parent of a page under another, or null for a top-level page. */
export function parentOf(pathname: string): { href: string; label: string } | null {
  if (/^\/episodes\/\d+$/.test(pathname) || pathname === "/cast") return { href: "/episodes", label: "Episodes" };
  if (/^\/scoreboard\/[^/]+$/.test(pathname)) return { href: "/scoreboard", label: "Scoreboard" };
  if (pathname === "/draft/board") return { href: "/draft", label: "Draft" };
  if (pathname === "/setup/rules/edit") return { href: "/setup/rules", label: "Scoring & rules" };
  if (/^\/setup\/[^/]+$/.test(pathname)) return { href: "/setup", label: "League Settings" };
  return null;
}

/** A page's name, as its header shows it; null for a path this app doesn't name (Overview's header
    is the league name, so pass `overview` to get "Overview" for a back label). */
export function pageTitle(
  pathname: string,
  ctx: { playerName: (id: string) => string | undefined; tribes: string; castaways: string; overview?: boolean },
): string | null {
  if (pathname === "/") return ctx.overview ? "Overview" : null;
  if (TOP_TITLES[pathname]) return TOP_TITLES[pathname];
  const ep = /^\/episodes\/(\d+)$/.exec(pathname);
  if (ep) return `Episode ${ep[1]}`;
  if (pathname === "/cast") return "The cast";
  if (pathname === "/draft/board") return "Draft board";
  // /scoreboard/lines is the commissioner's episode lines, not a player.
  if (pathname === "/scoreboard/lines") return "Episode lines";
  const player = /^\/scoreboard\/([^/]+)$/.exec(pathname);
  if (player) return ctx.playerName(decodeURIComponent(player[1])) ?? "Scoreboard";
  const setup: Record<string, string> = {
    "/setup/players": "Players & invites",
    "/setup/league": "League setup",
    "/setup/lineups": "Lineups",
    "/setup/rules": "Scoring & rules",
    "/setup/rules/edit": "Edit rules",
    "/setup/pickups": "Swaps & pickups",
    "/setup/predictions": "Predictions",
    "/setup/cast": `${ctx.tribes} & ${ctx.castaways}`,
    "/setup/linked": "Linked leagues",
    "/setup/backup": "Backup",
  };
  return setup[pathname] ?? null;
}

/** The trail after arriving on `pathname`. Pure, so a page can read where it came from on its first
    render, before the recorder's effect has stored it. */
export function nextTrail(trail: string[], pathname: string): string[] {
  if (!parentOf(pathname)) return [pathname];
  if (trail.at(-1) === pathname) return trail;
  if (trail.at(-2) === pathname) return trail.slice(0, -1);
  return [...trail, pathname].slice(-MAX);
}

function load(): string[] {
  try {
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem(STORAGE_KEY) : null;
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

const useNavTrailStore = create<{ trail: string[]; record: (pathname: string) => void }>((set, get) => ({
  trail: load(),
  record: (pathname) => {
    const trail = nextTrail(get().trail, pathname);
    if (trail === get().trail) return;
    set({ trail });
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trail));
    } catch {
      // Private mode or storage blocked: the trail just lasts until a reload.
    }
  },
}));

/** Records each page arrival. Mounted once, in the app shell. */
export function useRecordNavTrail() {
  const pathname = usePathname();
  const record = useNavTrailStore((s) => s.record);
  // An effect, not render: the store only changes once the page has committed.
  useEffect(() => record(pathname), [pathname, record]);
}

/** Where this page's back goes: the page you came from, else its parent; null on a top-level page. */
export function useBackTarget(fallback?: { href: string; label: string }): BackTarget | null {
  const pathname = usePathname();
  const trail = useNavTrailStore((s) => s.trail);
  const players = useLeagueStore((s) => s.state.players);
  const terms = useShowTerms();
  const parent = fallback ?? parentOf(pathname);
  if (!parent) return null;
  const prev = nextTrail(trail, pathname).at(-2);
  if (prev) {
    const label = pageTitle(prev, {
      playerName: (id) => players.find((p) => p.id === id)?.name,
      tribes: terms.Tribes,
      castaways: terms.castaways,
      overview: true,
    });
    if (label) return { href: prev, label, viaHistory: true };
  }
  return { ...parent, viaHistory: false };
}
