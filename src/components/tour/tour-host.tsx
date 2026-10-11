"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIsAuthenticated, useLeagueStore } from "@/lib/store";
import { useReportModalStore } from "@/lib/report-modal-store";
import { useTourStore, useTourStep, type TourKind } from "@/lib/tour/tour-store";
import { tourSteps, type TourCtx } from "@/lib/tour/steps";
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
  const kind = useTourStore((s) => s.kind);
  const created = useTourStore((s) => s.created);
  const copied = useTourStore((s) => s.copied);
  const step = useTourStep();
  const goTo = useTourStore((s) => s.goTo);
  const stop = useTourStore((s) => s.stop);
  const pathname = usePathname();
  const state = useLeagueStore((s) => s.state);
  const full = useLeagueStore((s) => s.fullState);
  const seen = useLeagueStore((s) => s.membership?.resultsSeenThrough ?? 0);
  const ctx: TourCtx = { state, full, pathname, seen, tour: { created, copied } };
  const steps = tourSteps(kind);

  // A step ends on what it did to the league (or where it took you); several can end at once.
  const doneNow = step ? step.done(ctx) : false;
  useEffect(() => {
    if (stepIndex === null || !doneNow) return;
    let i = stepIndex + 1;
    while (i < steps.length - 1 && steps[i].done(ctx)) i++;
    goTo(i);
    // ctx is rebuilt every render; doneNow is what changes.
  }, [doneNow, stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!step || stepIndex === null) return null;
  const onRoute = !step.route || step.route(pathname);
  const line = (onRoute ? step.line : (step.nav?.line ?? step.line))(ctx);
  const detailOf = onRoute || !step.nav ? step.detail : step.nav.detail;
  const detail = detailOf ? detailOf(ctx) : null;
  const targets = onRoute ? step.targets : (step.nav?.targets ?? []);
  const look = onRoute ? (step.look ?? []) : [];
  const ending = !!step.end && onRoute;

  return (
    <>
      <Spotlight targets={targets} look={look} />
      <HostPlate
        key={`${kind}:${step.id}:${onRoute}`}
        kind={kind}
        progress={step.progress}
        line={line}
        detail={detail}
        ending={ending}
        cta={onRoute ? (step.cta ?? null) : null}
        onNext={() => goTo(stepIndex + 1)}
        // The create-a-league flow has no tab bar: the plate sits at the foot of the screen.
        fullscreen={pathname === "/new-league"}
        onSkip={stop}
      />
    </>
  );
}

// ---------- the plate ----------

function HostPlate({
  kind,
  progress,
  line,
  detail,
  ending,
  cta,
  onNext,
  fullscreen,
  onSkip,
}: {
  kind: TourKind;
  progress: string;
  line: string;
  detail: string | null;
  ending: boolean;
  cta: string | null;
  onNext: () => void;
  fullscreen: boolean;
  onSkip: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // The detail is read when a step arrives, then gets out of the way: the first tap outside the plate
  // means they've started the step, and the room it took goes back to the screen. On click, not
  // pointerdown -- shrinking mid-tap moves what was tapped. "What does this mean?" brings it back.
  // Each step remounts the plate (keyed), so every step opens with its detail showing.
  const [explained, setExplained] = useState(true);
  useEffect(() => {
    if (!detail) return;
    // The path, not the target: by the time this runs React has already re-rendered, and "What does
    // this mean?" (the target) is gone from the plate, so it would read as a tap outside.
    const away = (e: MouseEvent) => {
      if (ref.current && !e.composedPath().includes(ref.current)) setExplained(false);
    };
    document.addEventListener("click", away);
    return () => document.removeEventListener("click", away);
  }, [detail]);
  const startTour = useTourStore((s) => s.start);
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

  // The player's end card leads on to the commissioner's tour, which starts by creating a league.
  function commissionerTour() {
    startTour("commissioner");
    router.push("/new-league");
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="region"
      aria-label="Tour"
      data-tour-host
      className={cn(
        "fixed inset-x-3 z-[91] mx-auto max-w-[480px] outline-none data-[dock=top]:bottom-auto data-[dock=top]:top-[calc(env(safe-area-inset-top,0px)+12px)] nav:inset-x-auto nav:bottom-6 nav:right-6 nav:w-[420px]",
        fullscreen ? "bottom-[calc(env(safe-area-inset-bottom,0px)+12px)]" : "bottom-[calc(var(--tabbar-base)+8px)]",
      )}
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
        <div aria-live="polite">
          <p className="tour-wipe type-caption text-balance text-[22px] leading-[1.05]">{line}</p>
          {detail && (
            <div
              className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
              style={{ gridTemplateRows: explained ? "1fr" : "0fr" }}
            >
              <p className="overflow-hidden text-pretty text-[15px] leading-snug text-plate-muted" aria-hidden={!explained}>
                <span className="block pt-1.5">{detail}</span>
              </p>
            </div>
          )}
          {cta && (
            <button
              type="button"
              onClick={onNext}
              className="mt-3 min-h-12 w-full rounded-[3px] bg-chyron px-4 text-[15px] font-bold text-chyron-foreground transition-[filter] hover:brightness-[1.06] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
            >
              {cta}
            </button>
          )}
          {detail && !explained && (
            <button
              type="button"
              aria-expanded={false}
              onClick={() => setExplained(true)}
              className="-mb-2.5 flex min-h-10 items-center text-[15px] font-semibold text-plate-muted underline underline-offset-4 outline-none hover:text-plate-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chyron-line"
            >
              What does this mean?
            </button>
          )}
        </div>
        {ending && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-[15px] leading-snug text-plate-muted">
              {kind === "commissioner"
                ? "Every week: results come in, you check them and apply them. Everything else runs itself."
                : "Every week is the same: set your lineup, reveal, see where you stand."}
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
            {(kind === "player" || isAuthenticated) && (
              <div className="flex flex-wrap gap-x-5">
                {kind === "player" && (
                  <button
                    type="button"
                    onClick={commissionerTour}
                    className="min-h-11 py-2 text-[15px] font-semibold text-plate-foreground underline underline-offset-4 hover:text-plate-muted"
                  >
                    Commissioner tour
                  </button>
                )}
                {isAuthenticated && (
                  <button
                    type="button"
                    onClick={openReport}
                    className="min-h-11 py-2 text-[15px] font-semibold text-plate-foreground underline underline-offset-4 hover:text-plate-muted"
                  >
                    Anything unclear?
                  </button>
                )}
              </div>
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
// Lit and tappable, but without a ring of their own: a picker's sticky confirm bar spans the screen
// and sits over the tiles' lower edge, so a ring there just crosses the tiles' ring.
const RINGLESS = new Set(["picker-confirm"]);

// Lit targets are found by `data-tour` each frame, so they follow scrolling, sheets sliding up and
// pages swapping. A target counts only where it's actually on top (not under a sheet or off screen);
// with nothing lit, there's no scrim and nothing is blocked -- a missing target never traps anyone.
function Spotlight({ targets, look }: { targets: string[]; look: string[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const holesRef = useRef<SVGPathElement>(null);
  const ringRef = useRef<SVGPathElement>(null);
  const lookRingRef = useRef<SVGPathElement>(null);
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
      // Ringed first, then ringless, then look-only: the paths below slice by these counts.
      const bare = tap.filter((t) => RINGLESS.has(t.name)).map((t) => t.box);
      const ringed = tap.filter((t) => !RINGLESS.has(t.name)).map((t) => clipUnder(t.box, bare));
      const want = [...ringed, ...bare, ...seen.map((t) => t.box)];
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
      const dock = document.querySelector('[role="dialog"], [role="alertdialog"]') ? "top" : "bottom";
      if (plate && plate.dataset.dock !== dock) plate.dataset.dock = dock;
      holesRef.current?.setAttribute("d", shown.map(rounded).join(" "));
      ringRef.current?.setAttribute("d", shown.slice(0, ringed.length).map(rounded).join(" "));
      // Lit to look at, not tap: a dashed ring, so it still stands out (the tab bar's cards).
      lookRingRef.current?.setAttribute("d", shown.slice(tap.length).map(rounded).join(" "));
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
      <path ref={lookRingRef} fill="none" strokeWidth={2} strokeDasharray="5 4" className="stroke-plate" />
    </svg>
  );
}

/** Each element carrying one of these `data-tour` names that's on screen and not covered. */
function visible(names: string[]): { name: string; el: Element; box: Box }[] {
  const out: { name: string; el: Element; box: Box }[] = [];
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
      // On top where it shows? The first thing (not the host plate) under its middle -- or, when a
      // sticky bar covers the middle of a tall target like the draft's tile grid, under any of a 3x3
      // spread of points across it.
      const onTop = (fx: number, fy: number) => {
        const hit = document
          .elementsFromPoint(x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy)
          .find((h) => !h.closest("[data-tour-host]") && !(h instanceof SVGElement && h.closest("svg[aria-hidden]")));
        return !!hit && (el.contains(hit) || hit.contains(el));
      };
      const spread = [0.5, 0.15, 0.85];
      if (!spread.some((fy) => spread.some((fx) => onTop(fx, fy)))) continue;
      out.push({ name, el, box: { x: x0 - PAD, y: y0 - PAD, w: x1 - x0 + PAD * 2, h: y1 - y0 + PAD * 2 } });
    }
  }
  return out;
}

/** A box cut off where a ringless bar starts across its lower part, so its ring stops above the bar. */
function clipUnder(b: Box, bars: Box[]): Box {
  let h = b.h;
  for (const bar of bars) {
    const across = bar.x < b.x + b.w && bar.x + bar.w > b.x;
    if (across && bar.y > b.y + 24 && bar.y < b.y + h) h = bar.y - b.y;
  }
  return h === b.h ? b : { ...b, h };
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

