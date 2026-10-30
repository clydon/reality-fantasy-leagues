"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Eye, Lock, MessageCircle, type LucideIcon } from "lucide-react";
import { READ_ONLY_HEADER, READ_ONLY_SAYS } from "@/lib/read-only";
import { useNav } from "./nav";
import { paths } from "./routes";
import { toast } from "./ui/toast";

// Open it read-only (docs/PLAN-desk-parity.md part 6c; the mock's desk-games.js dgOpen, dgRoEnd, dgPvt and DG_WRITE): a
// site admin opens a couch's game from its desk page in the app's show space, as anyone on the couch sees it, at their own
// spoiler mark, under a Read-only caption plate. It's this browser tab's (sessionStorage), so the admin's other tabs play
// on as themselves. While it's on, every request the tab makes to /api carries READ_ONLY_HEADER (src/lib/read-only.ts):
// the show space's reads are the couch's view of that game (src/lib/server/read-only.ts), and the server refuses any write
// it rides on (api-route.ts). Here, on top: what would change something says "Read-only" before it opens (the guard),
// Tonight and Chat show why they're not shown (ReadOnlyPanel), and leaving the show space leaves read-only.

export interface ReadOnlyGame {
  leagueId: string;
  name: string;
  seasonId: string;
  couchId: string;
  couch: string;
  /** Who runs it, by name (the Games tab's foot line: "run by nina"). */
  runBy?: string[];
}

const KEY = "gys-read-only";
const listeners = new Set<() => void>();
let cache: { raw: string | null; game: ReadOnlyGame | null } = { raw: null, game: null };

/** The game open read-only in this tab, else null. */
export function readOnlyNow(): ReadOnlyGame | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    /* no storage: nothing's open */
  }
  if (raw !== cache.raw) {
    let game: ReadOnlyGame | null = null;
    try {
      game = raw ? (JSON.parse(raw) as ReadOnlyGame) : null;
    } catch {
      game = null;
    }
    cache = { raw, game };
  }
  return cache.game;
}

/** Set by startReadOnly until the tab reaches the show space, so the desk page it starts from doesn't end it. */
let starting = false;

/** A season's queries, dropped as read-only starts and ends: its reads differ with the header, and the keys don't say so. */
const dropSeason = (client: QueryClient, seasonId: string) =>
  client.removeQueries({ predicate: (q) => q.queryKey[0] === "new-design" && q.queryKey.includes(seasonId) });

/** From the game's desk page, once its History has the line (desk-games.ts openReadOnly): then go to the show space. */
export function startReadOnly(client: QueryClient, game: ReadOnlyGame) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(game));
  } catch {
    /* no storage: the reads are your own, and nothing is refused */
  }
  starting = true;
  dropSeason(client, game.seasonId);
  listeners.forEach((l) => l());
}

export function endReadOnly(client: QueryClient) {
  const game = readOnlyNow();
  if (!game) return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing kept */
  }
  starting = false;
  dropSeason(client, game.seasonId);
  listeners.forEach((l) => l());
}

/** The game open read-only, when it's this season's (else null: the show space is yours as ever). */
export function useReadOnly(seasonId?: string): ReadOnlyGame | null {
  const game = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readOnlyNow,
    () => null
  );
  return game && (!seasonId || game.seasonId === seasonId) ? game : null;
}

// Every request this tab makes to the app's own /api while it's on the game's show space with read-only on carries the
// game's id: anywhere else (a page outside the signed-in layout, say, which ReadOnlyLayer doesn't watch) it's the admin's own.
// Installed once, as the module loads (before the first read of a reload).
if (typeof window !== "undefined" && !(window as { __gysReadOnly?: boolean }).__gysReadOnly) {
  (window as { __gysReadOnly?: boolean }).__gysReadOnly = true;
  const base = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const game = readOnlyNow();
    const at = window.location.pathname;
    if (!game || !(at === `/show/${game.seasonId}` || at.startsWith(`/show/${game.seasonId}/`))) return base(input, init);
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return base(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(READ_ONLY_HEADER, game.leagueId);
    return base(input, { ...init, headers });
  };
}

/**
 * What would change something, as the show space marks it (the mock's DG_WRITE): Reveal, Rate it, a flag, an answer, It's
 * new, Fill in what happened, Looks right to us, Suggest a fix, Change the scoring, a call, a bingo square, typing. Looking
 * around (the tabs, a person's team, a castaway, the explorer, the rules, an episode, where you are) works.
 */
const WRITES = [
  "[data-reveal-plate]",
  "[data-ep-hidden]",
  "[data-as-of]",
  "[data-episode-rate]",
  "[data-rate-row]",
  "[data-star]",
  "[data-take-save]",
  "[data-something-wrong]",
  "[data-story-flag]",
  "[data-dispute-send]",
  "[data-house-ruling]",
  "[data-couch-answer]",
  "[data-answer-send]",
  "[data-show-change-new]",
  "[data-show-change-not]",
  "[data-recaps-ask]",
  "[data-recaps-paste]",
  "[data-results-again]",
  "[data-paste-save]",
  "[data-rulebook-check]",
  "[data-suggest-fix]",
  "[data-suggest-send]",
  "[data-call-option]",
  "[data-call-save]",
  "[data-call-say]",
  "[data-square]",
  "[data-flag-square]",
  "[data-did-it]",
  "[data-say]",
  "[data-bingo-tell]",
  'a[href$="/scoring"]',
  "textarea",
].join(",");

/**
 * Mounted once in the signed-in layout: the Read-only caption plate over the show space (Back to the desk), the guard, and
 * leaving read-only when the tab leaves the game's show space (the mock's route wrapper), or comes back to read-only on a
 * page that isn't it (a reload on the desk).
 */
export function ReadOnlyLayer() {
  const game = useReadOnly();
  const pathname = usePathname();
  const client = useQueryClient();
  const nav = useNav();
  const inShow = !!game && (pathname === `/show/${game.seasonId}` || pathname.startsWith(`/show/${game.seasonId}/`));
  useEffect(() => {
    if (!game) return;
    if (inShow) starting = false;
    else if (!starting) endReadOnly(client);
  }, [game, inShow, client]);
  useEffect(() => {
    if (!inShow) return;
    // The show bar sticks under the plate (show-bar.tsx reads --nd-top).
    document.documentElement.style.setProperty("--nd-top", "44px");
    const guard = (e: MouseEvent) => {
      const t = (e.target as Element | null)?.closest?.(WRITES);
      if (!t || t.closest("[data-read-only-bar]")) return;
      e.preventDefault();
      e.stopPropagation();
      toast.quiet(READ_ONLY_SAYS);
    };
    document.addEventListener("click", guard, true);
    return () => {
      document.documentElement.style.removeProperty("--nd-top");
      document.removeEventListener("click", guard, true);
    };
  }, [inShow]);
  if (!game || !inShow) return null;
  return (
    <div data-read-only-bar={game.leagueId} role="status" className="sticky top-0 z-[60] flex h-11 items-center gap-2 bg-plate pl-3 pr-1 text-plate-foreground shadow-plate">
      <Eye className="size-[18px] flex-none" strokeWidth={2.2} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13px]">
        <b className="type-caption align-[-1px] text-[15px]">Read-only</b> · {game.name} on {game.couch}
      </span>
      <button type="button" data-read-only-back onClick={() => leaveToDesk(nav, game)} className="h-11 flex-none px-1">
        <span className="block rounded-[3px] bg-plate-foreground px-2.5 py-2 text-[13px] font-bold text-plate">Back to the desk</span>
      </button>
    </div>
  );
}

/** Back to the game's desk page. Read-only ends as the tab leaves the show space (ReadOnlyLayer), so the page sliding away
 *  stays as it was rather than turning into your own for a moment. */
export function leaveToDesk(nav: ReturnType<typeof useNav>, game: ReadOnlyGame) {
  nav.push(paths.deskItem("game", game.leagueId));
}

/** Tonight and Chat while read-only (the mock's dgPvt): why they're not shown, and the game's seats on the desk. */
export function ReadOnlyPanel({ game, kind }: { game: ReadOnlyGame; kind: "tonight" | "chat" }) {
  const nav = useNav();
  const [Icon, title, line]: [LucideIcon, string, string] =
    kind === "tonight"
      ? [
          Lock,
          "Tonight is each player's own",
          "What each of them has to do this week, and their own team, are theirs. To see one player's, act as them from their seat: it's in their History.",
        ]
      : [MessageCircle, `${game.couch}'s chat is theirs`, "It isn't shown read-only. Acting as one of them shows it as they see it, and that's in their History."];
  return (
    <section className="px-4 pt-6">
      <div data-read-only-panel={kind} className="rounded-[4px] bg-card px-4 pb-2 pt-[18px] outline-1 -outline-offset-1 outline-input">
        <span className="mb-3.5 grid size-10 place-items-center rounded-[3px] bg-secondary text-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        <b className="type-caption block text-[24px]">{title}</b>
        <p className="mt-2 text-[15px] leading-normal text-muted-foreground">{line}</p>
        <button
          type="button"
          data-read-only-seats
          onClick={() => leaveToDesk(nav, game)}
          className="mt-1 min-h-11 text-[15px] font-bold text-foreground underline decoration-input underline-offset-[3px]"
        >
          Its seats, on the desk
        </button>
      </div>
    </section>
  );
}
