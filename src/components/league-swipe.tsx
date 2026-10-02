"use client";

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { LeagueStoreContext, makePeekStore, useIsSuperAdmin, useLeagueStore } from "@/lib/store";
import { api } from "@/lib/api";
import StateLogic from "@/lib/game/state-logic.js";

// Swipe left/right between LINKED leagues (league-groups.ts) on a phone, staying on the same page.
// While you drag, the neighbouring league's version of this page slides in beside the current one --
// the real page, drawn from that league's data through a peek store (LeagueStoreContext) -- and the
// league name in the top bar slides with it (SwipeTitle). Past about a third of the screen, or a
// quick flick, it settles there and that league becomes the open one; otherwise it springs back.
//
// Admin-only for now (testing on the live site). Never from a screen edge (the phone's own back
// gesture), never from inside something that scrolls sideways, and only once the drag is clearly
// horizontal. Not on Chat: linked leagues share one, so there's nothing to swipe to.

/** True inside a peeked neighbour: display-only (no confetti, nothing tappable). */
export const PeekContext = createContext(false);
export const useIsPeek = () => useContext(PeekContext);

// Shared with the top bar: how far the swipe has gone (-1 = fully to the next league, 1 = fully to
// the previous), and the league it's heading to.
export const useSwipeProgress = create<{ progress: number; targetName: string | null; dragging: boolean }>(() => ({
  progress: 0,
  targetName: null,
  dragging: false,
}));

const EDGE = 28; // px from either side left to the phone's back gesture
// A sideways drag only starts moving the page once it's gone this far: a small accidental drift
// does nothing, a continued one is a swipe -- and it then follows from there, without a jump.
const DEAD_ZONE = 24;
// Space between the current page and the neighbour sliding in, so their cards don't touch.
const GAP = 32;
const SETTLE_MS = 220;

/** The open league's linked group, in the league dropdown's order, and where the open one sits. */
export function useLinkedOrder(): { ids: string[]; index: number } {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mode = useLeagueStore((s) => s.mode);
  const leagues = useLeagueStore((s) => s.leagues);
  const isAdmin = useIsSuperAdmin();
  const { data } = useQuery({
    queryKey: ["league-link", leagueId],
    queryFn: () => api.getLeagueLinks(leagueId!),
    enabled: isAdmin && mode === "live" && !!leagueId,
    staleTime: 60_000,
  });
  if (!leagueId || !data || data.linked.length === 0) return { ids: [], index: -1 };
  const inGroup = new Set([leagueId, ...data.linked.map((l) => l.id)]);
  const ids = leagues.map((l) => l.id).filter((id) => inGroup.has(id));
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
  const isAdmin = useIsSuperAdmin();
  const mode = useLeagueStore((s) => s.mode);
  const switchToLoaded = useLeagueStore((s) => s.switchToLoaded);
  const { ids, index } = useLinkedOrder();
  const enabled = isAdmin && mode === "live" && pathname !== "/chat" && ids.length > 1;
  const prev = useNeighbour(enabled ? ids[index - 1] : undefined);
  const next = useNeighbour(enabled ? ids[index + 1] : undefined);

  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; t: number; axis: "x" | "y" | null; dx: number; dir: "prev" | "next" | null } | null>(null);
  const [peek, setPeek] = useState<{ dir: "prev" | "next"; top: number } | null>(null);
  const neighbour = peek ? (peek.dir === "prev" ? prev : next) : undefined;
  const peekStore = useMemo(() => (neighbour ? makePeekStore(neighbour) : null), [neighbour]);

  function setTrack(x: number, animate: boolean) {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = animate ? `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0.8, 0.3, 1)` : "none";
    el.style.transform = x ? `translateX(${x}px)` : "";
  }

  function onTouchStart(e: React.TouchEvent) {
    drag.current = null;
    if (!enabled) return;
    const t = e.touches[0];
    if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
    if (inSideScroller(e.target, wrapRef.current)) return;
    drag.current = { x: t.clientX, y: t.clientY, t: Date.now(), axis: null, dx: 0, dir: null };
  }

  function onTouchMove(e: React.TouchEvent) {
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
    useSwipeProgress.setState({ progress: d.dx / (window.innerWidth + GAP) });
  }

  function onTouchEnd() {
    const d = drag.current;
    drag.current = null;
    if (!d || d.axis !== "x" || !d.dir) return;
    const width = window.innerWidth + GAP;
    const flick = Math.abs(d.dx) > 40 && Math.abs(d.dx) / Math.max(1, Date.now() - d.t) > 0.5;
    const res = d.dir === "next" ? next : prev;
    const commit = !!res && (Math.abs(d.dx) > width * 0.3 || flick);
    const to = commit ? (d.dir === "next" ? -width : width) : 0;
    setTrack(to, true);
    useSwipeProgress.setState({ progress: to / width, dragging: false });
    window.setTimeout(() => {
      if (commit && res) {
        switchToLoaded(res);
        window.scrollTo(0, 0);
        // The same page if the other league has it; otherwise Overview.
        const type = StateLogic.getLeagueType(res.state);
        const has: Record<string, boolean> = {
          "/research": !!type.hasActiveRoster,
          "/draft": !!type.hasRoster,
          "/mid-season": StateLogic.replenishAvailable(res.state) || StateLogic.tradeAvailable(res.state),
        };
        if (has[pathname] === false) router.push("/");
      }
      setTrack(0, false);
      setPeek(null);
      useSwipeProgress.setState({ progress: 0, targetName: null });
    }, SETTLE_MS);
  }

  return (
    <div
      ref={wrapRef}
      className="relative overflow-x-clip"
      style={enabled ? { touchAction: "pan-y" } : undefined}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div ref={trackRef} className="relative">
        {children}
        {peek && peekStore && (
          <div
            className="pointer-events-none absolute w-full"
            style={{ top: peek.top, left: peek.dir === "next" ? `calc(100% + ${GAP}px)` : `calc(-100% - ${GAP}px)` }}
            aria-hidden
          >
            <PeekContext.Provider value={true}>
              <LeagueStoreContext.Provider value={peekStore}>{children}</LeagueStoreContext.Provider>
            </PeekContext.Provider>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The open league's name in the top bar, sliding along with a swipe: the current name moves off as
 * the next one comes in from that side, in step with the finger. Dots under it show where you are
 * in the linked group (admins, while the swipe is admin-only).
 */
export function SwipeTitle({ name, className }: { name: string; className?: string }) {
  const { progress, targetName, dragging } = useSwipeProgress();
  const { ids, index } = useLinkedOrder();
  const p = Math.max(-1, Math.min(1, progress));
  const transition = dragging ? "none" : `transform ${SETTLE_MS}ms ease-out, opacity ${SETTLE_MS}ms ease-out`;
  return (
    <span className="relative flex min-w-0 flex-col">
      <span className="relative block min-w-0 overflow-hidden">
        <span
          className={className}
          style={{ display: "block", transform: `translateX(${p * 60}%)`, opacity: 1 - Math.abs(p), transition }}
        >
          {name}
        </span>
        {targetName && p !== 0 && (
          <span
            className={className}
            style={{
              position: "absolute",
              inset: 0,
              display: "block",
              transform: `translateX(${(p < 0 ? 1 + p : p - 1) * 60}%)`,
              opacity: Math.abs(p),
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
