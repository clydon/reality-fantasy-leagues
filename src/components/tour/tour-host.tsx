"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIsAuthenticated, useLeagueStore } from "@/lib/store";
import { useReportModalStore } from "@/lib/report-modal-store";
import { useTourStore, useTourStep } from "@/lib/tour/tour-store";
import { PLAYER_TOUR, type TourCtx } from "@/lib/tour/steps";
import { cn } from "cn";

// The guided tour's host (docs/PLAN-guided-tour.md, "The host plate"): the only new UI the tour adds.
// A lower third docked above the tab bar -- a chyron HOST tag over a quiet strip with the progress
// ("Episode 1 of 2") and Skip, then the white caption plate carrying the one line -- plus a spotlight:
// whatever the step wants tapped is lit, everything else sits under the scrim and doesn't take taps.
//
// The plate is the screen's announcer, so its line is an aria-live region and focus moves to it on
// each step. It sizes the space it takes (--tour-h), which lifts sticky confirm bars above it.
export function TourHost() {
  const stepIndex = useTourStore((s) => s.step);
  const step = useTourStep();
  const goTo = useTourStore((s) => s.goTo);
  const stop = useTourStore((s) => s.stop);
  const pathname = usePathname();
  const state = useLeagueStore((s) => s.state);
  const full = useLeagueStore((s) => s.fullState);
  const seen = useLeagueStore((s) => s.membership?.resultsSeenThrough ?? 0);
  const ctx: TourCtx = { state, full, pathname, seen };

  // A step ends on what it did to the league (or where it took you); several can end at once.
  const doneNow = step ? step.done(ctx) : false;
  useEffect(() => {
    if (stepIndex === null || !doneNow) return;
    let i = stepIndex + 1;
    while (i < PLAYER_TOUR.length - 1 && PLAYER_TOUR[i].done(ctx)) i++;
    goTo(i);
    // ctx is rebuilt every render; doneNow is what changes.
  }, [doneNow, stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!step || stepIndex === null) return null;
  const onRoute = !step.route || step.route(pathname);
  const line = (onRoute ? step.line : (step.nav?.line ?? step.line))(ctx);
  const targets = onRoute ? step.targets : (step.nav?.targets ?? []);
  const look = onRoute ? (step.look ?? []) : [];
  const ending = !!step.end && onRoute;

  return (
    <>
      <Spotlight targets={targets} look={look} />
      <HostPlate key={`${step.id}:${onRoute}`} progress={step.progress} line={line} ending={ending} onSkip={stop} />
    </>
  );
}

// ---------- the plate ----------

function HostPlate({ progress, line, ending, onSkip }: { progress: string; line: string; ending: boolean; onSkip: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const openReport = useReportModalStore((s) => s.openModal);
  const enterMockMode = useLeagueStore((s) => s.useMock);
  const setEntered = useLeagueStore((s) => s.setEntered);

  // Remounted per step (keyed), so this is "focus moves to the plate on each step".
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  // The room it takes above the tab bar, for --tabbar-h and the page's bottom padding.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const size = () => root.style.setProperty("--tour-h", `${Math.ceil(el.offsetHeight) + 12}px`);
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--tour-h");
    };
  }, []);

  function startLeague() {
    onSkip();
    if (isAuthenticated) {
      // Back to the real account first, then the create-a-league flow.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/new-league";
      return;
    }
    enterMockMode();
    setEntered(false);
    router.push("/account");
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="region"
      aria-label="Tour"
      data-tour-host
      className="fixed inset-x-3 bottom-[calc(var(--tabbar-base)+8px)] z-[91] mx-auto max-w-[480px] outline-none data-[dock=top]:bottom-auto data-[dock=top]:top-[calc(env(safe-area-inset-top,0px)+12px)] nav:inset-x-auto nav:bottom-6 nav:right-6 nav:w-[420px]"
    >
      <div className="flex h-9 items-stretch">
        {/* Chyron while there's a tap to make; on the end card "Start a league" is the one yellow. */}
        <span
          className={cn(
            "type-caption flex items-center pl-3 pr-5 text-[15px] tracking-[0.04em] [clip-path:polygon(0_0,100%_0,84%_100%,0_100%)]",
            ending ? "bg-plate text-plate-foreground" : "bg-chyron text-chyron-foreground",
          )}
        >
          Host
        </span>
        <span className="-ml-2.5 flex min-w-0 flex-1 items-center justify-between gap-3 bg-quiet-tag pl-4 pr-1 text-quiet-tag-foreground">
          <span className="type-caption truncate text-[15px] tracking-[0.06em]">{progress}</span>
          {!ending && (
            <button
              type="button"
              onClick={onSkip}
              className="-my-1 flex min-h-11 items-center px-3 text-[15px] font-semibold underline-offset-4 outline-none hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-chyron-line"
            >
              Skip tour
            </button>
          )}
        </span>
      </div>
      <div className="rounded-b-[3px] bg-plate px-3.5 pb-3 pt-2.5 text-plate-foreground shadow-plate">
        <p aria-live="polite" className="tour-wipe type-caption text-balance text-[22px] leading-[1.05]">
          {line}
        </p>
        {ending && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-[15px] leading-snug text-plate-muted">
              Every week is the same: set your lineup, reveal, see where you stand.
            </p>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={startLeague}
                className="min-h-12 flex-[1.4] rounded-[3px] bg-chyron px-4 text-[15px] font-bold text-chyron-foreground transition-[filter] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
              >
                Start a league
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="min-h-12 flex-1 rounded-[3px] border border-plate-foreground/25 px-4 text-[15px] font-bold text-plate-foreground hover:bg-plate-foreground/5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
              >
                Look around
              </button>
            </div>
            {isAuthenticated && (
              <button
                type="button"
                onClick={openReport}
                className="self-start py-2 text-[15px] font-semibold text-plate-foreground underline underline-offset-4 hover:text-plate-muted"
              >
                Anything unclear? Tell us
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- the spotlight ----------

type Box = { x: number; y: number; w: number; h: number };
const PAD = 6;
const RADIUS = 6;

// Lit targets are found by `data-tour` each frame, so they follow scrolling, sheets sliding up and
// pages swapping. A target counts only where it's actually on top (not under a sheet or off screen);
// with nothing lit, there's no scrim and nothing is blocked -- a missing target never traps anyone.
function Spotlight({ targets, look }: { targets: string[]; look: string[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const holesRef = useRef<SVGPathElement>(null);
  const ringRef = useRef<SVGPathElement>(null);
  const tappable = useRef<Element[]>([]);
  const active = useRef(false);
  const key = [...targets, "|", ...look].join(" ");

  useEffect(() => {
    if (targets.length + look.length === 0) {
      active.current = false;
      if (svgRef.current) svgRef.current.style.opacity = "0";
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let shown: Box[] = [];
    let frame = 0;

    const tick = () => {
      const tap = visible(targets);
      const seen = visible(look);
      tappable.current = tap.map((t) => t.el);
      const want = [...tap, ...seen].map((t) => t.box);
      active.current = want.length > 0;
      // Glide from the last spotlight to the next, unless motion is reduced or the count changed.
      shown =
        !reduced && shown.length === want.length
          ? want.map((b, i) => lerp(shown[i], b, 0.3))
          : want;
      if (svgRef.current) svgRef.current.style.opacity = shown.length ? "1" : "0";
      // A sheet rising from the bottom (the Reveal question) would sit under the plate: while one is
      // open the plate moves to the top, so the sheet's own words stay readable.
      const plate = document.querySelector<HTMLElement>("[data-tour-host]");
      const dock = document.querySelector('[role="dialog"]') ? "top" : "bottom";
      if (plate && plate.dataset.dock !== dock) plate.dataset.dock = dock;
      holesRef.current?.setAttribute("d", shown.map(rounded).join(" "));
      ringRef.current?.setAttribute("d", shown.slice(0, tap.length).map(rounded).join(" "));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      active.current = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Taps outside the lit targets (and the plate) do nothing while the spotlight is up. Capture phase
  // on window, so it runs before React's own handlers and before a link navigates. Scrolling is
  // untouched: the scrim itself takes no pointer events.
  useEffect(() => {
    const guard = (e: MouseEvent) => {
      if (!active.current) return;
      const t = e.target as Element | null;
      if (!t || t.closest("[data-tour-host]")) return;
      if (tappable.current.some((el) => el.contains(t))) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("click", guard, true);
    return () => window.removeEventListener("click", guard, true);
  }, []);

  return (
    <svg
      ref={svgRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[90] h-full w-full opacity-0 transition-opacity duration-200"
    >
      {/* A mask, not an even-odd path: lit targets can overlap (a picker's tiles run under its sticky
          confirm bar), and even-odd would scrim the overlap again. */}
      <defs>
        <mask id="tour-spotlight">
          <rect width="100%" height="100%" fill="white" />
          <path ref={holesRef} fill="black" />
        </mask>
      </defs>
      <rect width="100%" height="100%" mask="url(#tour-spotlight)" className="fill-(--scrim)" />
      <path ref={ringRef} fill="none" strokeWidth={2} className="stroke-plate" />
    </svg>
  );
}

/** Each element carrying one of these `data-tour` names that's on screen and not covered. */
function visible(names: string[]): { el: Element; box: Box }[] {
  const out: { el: Element; box: Box }[] = [];
  const W = window.innerWidth;
  const H = window.innerHeight;
  for (const name of names) {
    for (const el of document.querySelectorAll(`[data-tour~="${name}"]`)) {
      const r = el.getBoundingClientRect();
      const x0 = Math.max(0, r.left);
      const y0 = Math.max(0, r.top);
      const x1 = Math.min(W, r.right);
      const y1 = Math.min(H, r.bottom);
      if (x1 - x0 < 4 || y1 - y0 < 4) continue;
      // On top where it shows? The first thing under its middle that isn't the host plate.
      const hit = document
        .elementsFromPoint((x0 + x1) / 2, (y0 + y1) / 2)
        .find((h) => !h.closest("[data-tour-host]") && !(h instanceof SVGElement && h.closest("svg[aria-hidden]")));
      if (!hit || !(el.contains(hit) || hit.contains(el))) continue;
      out.push({ el, box: { x: x0 - PAD, y: y0 - PAD, w: x1 - x0 + PAD * 2, h: y1 - y0 + PAD * 2 } });
    }
  }
  return out;
}

const lerp = (a: Box, b: Box, t: number): Box => {
  const near = Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.w - b.w) + Math.abs(a.h - b.h) < 0.5;
  return near ? b : { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t };
};

// A rounded rectangle.
function rounded({ x, y, w, h }: Box): string {
  const r = Math.min(RADIUS, w / 2, h / 2);
  return `M${x + r} ${y}A${r} ${r} 0 0 0 ${x} ${y + r}V${y + h - r}A${r} ${r} 0 0 0 ${x + r} ${y + h}H${x + w - r}A${r} ${r} 0 0 0 ${x + w} ${y + h - r}V${y + r}A${r} ${r} 0 0 0 ${x + w - r} ${y}Z`;
}

