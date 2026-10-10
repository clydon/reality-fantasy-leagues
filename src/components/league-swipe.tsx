"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { LeagueStoreContext, makePeekStore, useLeagueStore } from "@/lib/store";
import { api } from "@/lib/api";
import StateLogic from "@/lib/game/state-logic.js";

// Swipe left/right between LINKED leagues (league-groups.ts) on a phone, staying on the same page.
// While you drag, the neighbouring league's version of this page slides in beside the current one --
// the real page, drawn from that league's data through a peek store (LeagueStoreContext) -- and the
// league name in the top bar slides with it (SwipeTitle). Past about a third of the screen, or a
// quick flick, it settles there and that league becomes the open one; otherwise it springs back.
//
// Never from a screen edge (the phone's own back gesture), never from inside something that scrolls
// sideways, and only once the drag is clearly horizontal. Only on pages about one league (LEAGUE_PAGES) -- not Chat, which linked leagues share.

/** True inside a peeked neighbour: display-only (no confetti, nothing tappable). */
export const PeekContext = createContext(false);
export const useIsPeek = () => useContext(PeekContext);

// Shared with the top bar: how far the swipe has gone (-1 = fully to the next league, 1 = fully to
// the previous), and the league it's heading to.
// `dragging` = the title follows the finger with no animation; it's also how it rests. Only letting go
// of a swipe turns animation on, to settle.
export const useSwipeProgress = create<{ progress: number; targetName: string | null; dragging: boolean }>(() => ({
  progress: 0,
  targetName: null,
  dragging: true,
}));

const EDGE = 28; // px from either side left to the phone's back gesture
// A sideways drag only starts moving the page once it's gone this far: a small accidental drift
// does nothing, a continued one is a swipe -- and it then follows from there, without a jump.
const DEAD_ZONE = 18;
// Space between the current page and the neighbour sliding in, so their cards don't touch.
const GAP = 32;
const SETTLE_MS = 220;
// Pages that show one league: the only ones a swipe means anything on. Not Chat (linked leagues share
// it), and not Account, Admin or Reports, which look the same whichever league is open.
const LEAGUE_PAGES = new Set(["/", "/episodes", "/scoreboard", "/lineup", "/pick", "/research", "/draft", "/mid-season", "/setup", "/cast"]);

/** The open league's linked group, in the order its commissioner set (the league dropdown's too), and
 *  where the open one sits. Only the leagues you're in -- linked leagues needn't share every member. */
export function useLinkedOrder(): { ids: string[]; index: number } {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mode = useLeagueStore((s) => s.mode);
  const leagues = useLeagueStore((s) => s.leagues);
  const queryClient = useQueryClient();
  const { data: group } = useQuery({
    queryKey: ["league-group", leagueId],
    queryFn: async () => {
      const r = await api.getLeagueLinks(leagueId!);
      return r.order.map((l) => l.id);
    },
    enabled: mode === "live" && !!leagueId,
    staleTime: 60_000,
  });
  // Linked leagues share one group, so it's already known for the others: seeded for each, the dots
  // are there the moment a swipe lands instead of blinking out until that league's own fetch returns.
  useEffect(() => {
    for (const id of group ?? []) {
      if (id !== leagueId && !queryClient.getQueryData(["league-group", id])) queryClient.setQueryData(["league-group", id], group);
    }
  }, [group, leagueId, queryClient]);
  if (!leagueId || !group || group.length < 2) return { ids: [], index: -1 };
  const ids = group.filter((id) => leagues.some((l) => l.id === id));
  return { ids, index: ids.indexOf(leagueId) };
}

// A neighbour's state, fetched ahead so the peek is there the moment a drag starts.
function useNeighbour(id: string | undefined) {
  return useQuery({
    queryKey: ["league-peek", id],
    queryFn: () => api.leagueState(id!),
    enabled: !!id,
    staleTime: 30_000,
  }).data;
}

// Something under the finger that scrolls sideways itself (or opts out) keeps its own swipe.
function inSideScroller(target: EventTarget | null, stop: HTMLElement | null): boolean {
  for (let el = target as HTMLElement | null; el && el !== stop; el = el.parentElement) {
    if (el.dataset?.noSwipe !== undefined) return true;
    const ox = getComputedStyle(el).overflowX;
    if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 2) return true;
  }
  return false;
}

export function LeagueSwipe({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const mode = useLeagueStore((s) => s.mode);
  const switchToLoaded = useLeagueStore((s) => s.switchToLoaded);
  const seenThrough = useLeagueStore((s) => s.membership?.resultsSeenThrough ?? null);
  const queryClient = useQueryClient();
  const { ids, index } = useLinkedOrder();
  const enabled = mode === "live" && LEAGUE_PAGES.has(pathname) && ids.length > 1;
  const prev = useNeighbour(enabled ? ids[index - 1] : undefined);
  const next = useNeighbour(enabled ? ids[index + 1] : undefined);

  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; t: number; axis: "x" | "y" | null; dx: number; dir: "prev" | "next" | null } | null>(null);
  // Which neighbour is showing, and from how far down the page (so it lines up with what's on screen).
  const [peek, setPeek] = useState<{ dir: "prev" | "next"; top: number } | null>(null);
  const prevStore = useMemo(() => (prev ? makePeekStore(prev) : null), [prev]);
  const nextStore = useMemo(() => (next ? makePeekStore(next) : null), [next]);
  // Both neighbours' pages are drawn AHEAD, hidden, a moment after a page opens -- not when a drag
  // starts. Drawing a heavy page (Episodes, Scoreboard) mid-gesture froze the phone long enough for it
  // to drop the swipe; ready in advance, a swipe only has to show it.
  // A reveal here is a reveal in every linked league (the server marks them all), so the neighbours
  // fetched ahead learn it at once -- otherwise a peek, or the league a swipe lands on, still offered
  // "Results are in!" for what you'd just revealed.
  useEffect(() => {
    if (seenThrough === null) return;
    queryClient.setQueriesData<Awaited<ReturnType<typeof api.leagueState>>>({ queryKey: ["league-peek"] }, (old) => {
      const was = old?.membership.resultsSeenThrough;
      if (!old || was === null || was === undefined || was >= seenThrough) return old;
      return { ...old, membership: { ...old.membership, resultsSeenThrough: seenThrough } };
    });
  }, [seenThrough, queryClient]);

  const [warm, setWarm] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset per page, then warmed after a beat
    setWarm(false);
    if (!enabled) return;
    const t = window.setTimeout(() => setWarm(true), 400);
    return () => window.clearTimeout(t);
  }, [enabled, pathname]);

  // How far the page moves to land on a neighbour: the page area's own width (narrower than the
  // screen -- main has side padding) plus the gap. The screen width overshot by that padding, and the
  // page then jumped back as it landed.
  function slideWidth() {
    return (trackRef.current?.offsetWidth ?? window.innerWidth) + GAP;
  }

  function setTrack(x: number, animate: boolean) {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = animate ? `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0.8, 0.3, 1)` : "none";
    el.style.transform = x ? `translateX(${x}px)` : "";
  }

  function onTouchStart(e: TouchEvent) {
    drag.current = null;
    if (!enabled) return;
    const t = e.touches[0];
    if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
    // Anywhere in the page area (main): the content's own box can be shorter than the screen (a
    // collapsed Episodes list), and a swipe starting below it or in the side padding is still a swipe.
    const main = (e.target as HTMLElement | null)?.closest?.("main") ?? null;
    if (!main || inSideScroller(e.target, main)) return;
    drag.current = { x: t.clientX, y: t.clientY, t: Date.now(), axis: null, dx: 0, dir: null };
  }

  function onTouchMove(e: TouchEvent) {
    const d = drag.current;
    if (!d) return;
    const t = e.touches[0];
    const dx = t.clientX - d.x;
    const dy = t.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      d.axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? "x" : "y";
      if (d.axis === "x") {
        d.dir = dx < 0 ? "next" : "prev";
        const res = d.dir === "next" ? next : prev;
        if (!res) {
          d.axis = "y"; // nothing that way (or not loaded yet): leave it to the page
          return;
        }
        const wrapTop = (wrapRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
        setWarm(true);
        setPeek({ dir: d.dir, top: Math.max(0, window.scrollY - wrapTop) });
        useSwipeProgress.setState({ targetName: res.league.name, dragging: true });
      }
    }
    if (d.axis !== "x") return;
    // Past the dead zone only, measured from its edge; towards the neighbour you started for, with a
    // little give the other way.
    const past = Math.sign(dx) * Math.max(0, Math.abs(dx) - DEAD_ZONE);
    d.dx = d.dir === "next" ? Math.min(past, 12) : Math.max(past, -12);
    setTrack(d.dx, false);
    useSwipeProgress.setState({ progress: d.dx / slideWidth() });
  }

  function onTouchEnd() {
    const d = drag.current;
    drag.current = null;
    if (!d || d.axis !== "x" || !d.dir) return;
    const width = slideWidth();
    const flick = Math.abs(d.dx) > 40 && Math.abs(d.dx) / Math.max(1, Date.now() - d.t) > 0.5;
    const res = d.dir === "next" ? next : prev;
    const commit = !!res && (Math.abs(d.dx) > width * 0.3 || flick);
    const to = commit ? (d.dir === "next" ? -width : width) : 0;
    setTrack(to, true);
    useSwipeProgress.setState({ progress: to / width, dragging: false });
    window.setTimeout(() => {
      if (commit && res) {
        switchToLoaded(res);
        // Landed on what was fetched ahead (instant); now quietly swap in a fresh copy, so anything
        // that changed since -- a reveal, someone's lineup, new results -- catches up.
        api.leagueState(res.league.id).then((fresh) => {
          if (useLeagueStore.getState().leagueId === fresh.league.id) switchToLoaded(fresh);
          queryClient.setQueryData(["league-peek", fresh.league.id], fresh);
        }).catch(() => {});
        window.scrollTo(0, 0);
        // The same page if the other league has it; otherwise Overview.
        const type = StateLogic.getLeagueType(res.state);
        const has: Record<string, boolean> = {
          "/research": !!type.hasActiveRoster,
          "/lineup": !!type.hasActiveRoster,
          "/pick": !!type.hasWeeklyPicks,
          "/draft": !!type.hasRoster,
          "/mid-season": StateLogic.replenishAvailable(res.state) || StateLogic.tradeAvailable(res.state),
        };
        if (has[pathname] === false) router.push("/");
      }
      setTrack(0, false);
      setPeek(null);
      // Snap the title back to rest with its animation OFF (the new name is already in place). It
      // stays off at rest and only comes on when a swipe is let go -- turning it back on a frame
      // later still animated this reset (the browser hadn't applied it yet), replaying the roll.
      useSwipeProgress.setState({ progress: 0, targetName: null, dragging: true });
    }, SETTLE_MS);
  }

  // Listened for on the whole document (filtered to the page area in onTouchStart), always calling
  // this render's handlers.
  const handlers = useRef<{ onTouchStart: (e: TouchEvent) => void; onTouchMove: (e: TouchEvent) => void; onTouchEnd: () => void } | null>(null);
  useEffect(() => {
    handlers.current = { onTouchStart, onTouchMove, onTouchEnd };
  });
  useEffect(() => {
    if (!enabled) return;
    const start = (e: TouchEvent) => handlers.current?.onTouchStart(e);
    const move = (e: TouchEvent) => handlers.current?.onTouchMove(e);
    const end = () => handlers.current?.onTouchEnd();
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", end);
    return () => {
      document.removeEventListener("touchstart", start);
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end);
      document.removeEventListener("touchcancel", end);
    };
  }, [enabled]);

  return (
    <div
      ref={wrapRef}
      className="relative overflow-x-clip"
      style={enabled ? { touchAction: "pan-y" } : undefined}
    >
      <div ref={trackRef} className="relative">
        {children}
        {warm &&
          ([
            ["prev", prevStore],
            ["next", nextStore],
          ] as const).map(([dir, store]) =>
            store ? (
              // One screen of it, clipped -- enough to peek at, and a hidden neighbour never makes the
              // page taller than its own content.
              <div
                key={dir}
                className="pointer-events-none absolute w-full overflow-hidden"
                style={{
                  top: peek?.dir === dir ? peek.top : 0,
                  height: "100dvh",
                  left: dir === "next" ? `calc(100% + ${GAP}px)` : `calc(-100% - ${GAP}px)`,
                  visibility: peek?.dir === dir ? "visible" : "hidden",
                }}
                aria-hidden
              >
                <PeekContext.Provider value={true}>
                  <LeagueStoreContext.Provider value={store}>{children}</LeagueStoreContext.Provider>
                </PeekContext.Provider>
              </div>
            ) : null
          )}
      </div>
    </div>
  );
}

/**
 * The open league's name in the top bar, rolling with a swipe like a slot machine: towards the next
 * league the name rolls up and the next one comes up from below (the previous: downward), each moved
 * by exactly its own height so the two never overlap mid-change. Centred, with dots under it showing
 * where you are in the linked group.
 */
export function SwipeTitle({ name, className }: { name: string; className?: string }) {
  const { progress, targetName, dragging } = useSwipeProgress();
  const { ids, index } = useLinkedOrder();
  const p = Math.max(-1, Math.min(1, progress));
  const t = Math.abs(p);
  // Next league (p < 0): roll up. Previous (p > 0): roll down.
  const dir = p < 0 ? -1 : 1;
  const transition = dragging ? "none" : `transform ${SETTLE_MS}ms ease-out`;
  return (
    // A fixed-width box (the space it's given), not one sized to the name: sized to the name, it
    // resized as a longer or shorter one landed, and the centred text jumped sideways at the end.
    <span className="flex min-w-0 flex-1 flex-col items-center">
      <span className="relative block w-full min-w-0 overflow-hidden">
        <span className={className} style={{ display: "block", textAlign: "center", transform: `translateY(${dir * t * 100}%)`, transition }}>
          {name}
        </span>
        {targetName && t > 0 && (
          <span
            className={className}
            style={{
              position: "absolute",
              inset: 0,
              display: "block",
              textAlign: "center",
              transform: `translateY(${-dir * (1 - t) * 100}%)`,
              transition,
            }}
          >
            {targetName}
          </span>
        )}
      </span>
      {ids.length > 1 && (
        <span className="mt-0.5 flex gap-1" aria-hidden>
          {ids.map((id, i) => (
            <span key={id} className={i === index ? "h-1 w-3 rounded-full bg-primary" : "h-1 w-1 rounded-full bg-border"} />
          ))}
        </span>
      )}
    </span>
  );
}
