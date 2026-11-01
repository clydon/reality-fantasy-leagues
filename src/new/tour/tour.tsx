"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { openStartGame } from "../couch/start-game";
import { useCatalog, useCurrentCouch, useTourSeen, type Couch, type CouchHub, type Home } from "../data";
import { useMe } from "../session";
import { usePhone } from "../settings/notify";
import { TourReveal, type TourRevealPlay } from "../show/reveal";
import { markAsked, turnOn } from "../show/remind";
import { useShown } from "../ui/loaded";
import { Btn } from "../ui/parts";
import { toast } from "../ui/toast";
import { openWatching } from "../watching/sheets";
import { useReducedMotion } from "../welcome/hooks";
import type { AddDemo } from "../watching/sheets";
import { demoOf, MADE_UP_REVEAL, MADE_UP_SHOW, practiceShowOf, replayOf, type PracticeShow, type ReplayOf } from "./plan";
import { practiceShow, setPracticeShows } from "./practice-shows";
import { tourSteps, type TourReminders, type TourStep } from "./steps";
import { clearTourAsk, tourAsked } from "./store";
import { Welcome } from "./welcome";

// The first-time tour (docs/PLAN-first-time-tour.md version 2, the user's own outline, 2026-11-01): a welcome card (what the app is,
// its three ideas), then the real Home a step at a time, each lighting the thing it's about with a lower third at the phone's foot (a
// Skip tour pill and the caption plate: the count on a quiet tag, the title, the line, Next). Three steps can be tried for real with
// nothing saved (steps.ts `act`, its button under the plate or a tap on what's lit): Add a show and Start a game open their real
// sheets as practice (watching/sheets.tsx, couch/start-game.tsx), the reveal plays your last one again or a made-up one
// (show/reveal.tsx TourReveal). While one's up the tour steps aside; when it closes the step ticks (its count turns green) and the
// next comes on. Next is the bone ink button, never yellow: the tour teaches that yellow is your move.
//
// Moving between steps looks the way a person moves (the user, 2026-10-31): the light goes off, the whole Home shows while the
// page scrolls (eased in and out, slower for further; a shelf scrolls sideways to its card), and the spotlight comes on once
// the target has arrived; a target on the same screen gets a glide instead. Back to the top at the end.
//
// It plays once an account (Home's read says `tourSeen`; finished or skipped, it's kept: data.ts useTourSeen), never while an
// admin acts as someone or views as a player, never over a sheet or a pushed page; again from Settings (store.ts) or
// /home?tour=1. While it's up (and not stepped aside), Home underneath is inert and doesn't scroll by hand.

const FIRST_BEAT = 500;
const LIGHT_OFF = 260;
const LIGHT_ON = 120;
const GLIDE = 420;
const TICK = 650;
const PAD = 6;

type Rect = { x: number; y: number; w: number; h: number };
type Ending = "skip" | "done" | "on";
type Run = { steps: TourStep[]; reminders: TourReminders; practice: PracticeShow | null; replay: ReplayOf | null; demo: AddDemo[] };

const ease = (t: number) => 1 - Math.pow(1 - t, 4);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** A scroll of d px: slow enough to follow, longer the further it goes. */
const scrollMs = (d: number) => (d < 3 ? 0 : Math.min(2000, 900 + d * 0.9));
const lerp = (a: Rect, b: Rect, k: number): Rect => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k });
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function tween(ms: number, frame: (k: number) => void, curve = ease) {
  return new Promise<void>((done) => {
    if (ms <= 0) {
      frame(1);
      return done();
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      frame(curve(t));
      if (t < 1) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
}

/** A target on Home with a box (one that's `display: contents` has none: its first child, then). */
function boxed(hub: Element, sel: string): HTMLElement | null {
  let el = hub.querySelector<HTMLElement>(sel);
  if (el && !el.getClientRects().length && el.firstElementChild) el = el.firstElementChild as HTMLElement;
  return el && el.getBoundingClientRect().width > 0 ? el : null;
}

/** What a step lights on Home: the first of its targets there, or with `union` every one of them. */
function findTargets(step: TourStep): HTMLElement[] {
  const hub = document.querySelector("[data-hub]");
  if (!hub) return [];
  const found = step.targets.map((sel) => boxed(hub, sel)).filter((el): el is HTMLElement => !!el);
  return step.union ? found : found.slice(0, 1);
}

/** Their box together, as the page has it now. */
function unionOf(els: HTMLElement[]) {
  const rs = els.map((el) => el.getBoundingClientRect());
  const left = Math.min(...rs.map((r) => r.left));
  const top = Math.min(...rs.map((r) => r.top));
  const right = Math.max(...rs.map((r) => r.right));
  const bottom = Math.max(...rs.map((r) => r.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/** Where the page scrolls to for a box: the top when it's in the clear above the lower third there, else it centred in that space
 *  (its top a little under the phone's when it's too tall for it). */
function scrollPlan(r: { top: number; height: number }, freeY: number) {
  const top = r.top + window.scrollY;
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  if (top + r.height + PAD <= freeY - 8) return 0;
  const y = r.height + 2 * PAD + 32 > freeY ? top - 16 : top - (freeY - r.height) / 2;
  return Math.round(Math.min(max, Math.max(0, y)));
}

/** A row that scrolls sideways around `el` (Your shows' shelf), if there's one with somewhere to go. */
function shelfOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && !p.hasAttribute("data-hub"); p = p.parentElement) {
    const x = getComputedStyle(p).overflowX;
    if ((x === "auto" || x === "scroll") && p.scrollWidth > p.clientWidth + 1) return p;
  }
  return null;
}

/** Where the shelf scrolls to so `el` is in view (where it is, when it's in view already). */
function shelfPlan(el: HTMLElement, shelf: HTMLElement) {
  const r = el.getBoundingClientRect();
  const s = shelf.getBoundingClientRect();
  if (r.left >= s.left + 8 && r.right <= s.right - 8) return shelf.scrollLeft;
  return Math.round(Math.max(0, Math.min(shelf.scrollLeft + (r.left - s.left) - 16, shelf.scrollWidth - shelf.clientWidth)));
}

/** The spotlight around a box, in the tour's own box (the phone's column). */
function holeOf(r: { left: number; top: number; right: number; height: number }, box: DOMRect): Rect {
  const x = Math.max(4, r.left - box.left - PAD);
  const x2 = Math.min(box.width - 4, r.right - box.left + PAD);
  return { x, y: r.top - box.top - PAD, w: Math.max(0, x2 - x), h: r.height + 2 * PAD };
}

/** A sheet or a pushed page that's open (they're dialogs; a closed one is hidden or gone): never the tour's own. */
function anyOpenDialog() {
  return [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].some(
    (d) =>
      !d.hasAttribute("data-tour") &&
      !d.hasAttribute("data-tour-welcome") &&
      d.getAttribute("aria-hidden") !== "true" &&
      d.getClientRects().length > 0 &&
      getComputedStyle(d).visibility !== "hidden"
  );
}

/** The guide's reel held on today (it rolls through the week by itself: hub/guide.tsx useRoll), or let go. */
function holdGuide(on: boolean, reduce: boolean) {
  const reel = document.querySelector<HTMLElement>("[data-guide-reel]");
  if (!reel) return;
  reel.dispatchEvent(new CustomEvent("nd-guide-hold", { detail: on ? 10 * 60_000 : 0 }));
  if (on) reel.scrollTo({ left: 0, behavior: reduce ? "auto" : "smooth" });
}

/** The arrow on Next. */
function NextArrow() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** Mounted with the hub (screens/home.tsx): plays the tour when it's due, or asked for. */
export function Tour({ home, hub, solo }: { home: Home | undefined; hub: CouchHub | undefined; solo: boolean }) {
  const me = useMe();
  const params = useSearchParams();
  const [phone] = usePhone();
  const seen = useTourSeen();
  const couch = useCurrentCouch(home);
  const [forced, setForced] = useState(tourAsked);
  const [run, setRun] = useState<Run | null>(null);
  const [tries, setTries] = useState(0);
  const [waited, setWaited] = useState(false);
  const linked = params.get("tour") === "1";
  const page = params.get("page");
  useEffect(() => {
    clearTourAsk();
    // The couch's own read and the catalog get a moment; past it, the tour goes on without them.
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);
  const want = forced || linked || (home?.user.tourSeen === false && !me.impersonating && !me.viewingAs);
  // The practice's show comes from the catalog, read only when the tour's due.
  const catalog = useCatalog(want).data?.seasons;
  // Home on screen (ui/loaded.tsx shows it all at once, its reads in), and nothing opened over it.
  const shown = useShown();
  const ready = shown && !!home && phone !== "loading" && (solo || hub !== undefined || waited) && (catalog !== undefined || waited) && !page;
  useEffect(() => {
    if (!want || !ready || run || !home) return;
    // Home's in, then the tour comes on; never over a sheet opened meanwhile (it looks again shortly).
    const t = setTimeout(
      () => {
        if (anyOpenDialog()) return setTries((n) => n + 1);
        const reminders: TourReminders = phone === "off" || phone === "install" ? phone : null;
        const practice = catalog ? practiceShowOf(catalog, home) : null;
        const replay = replayOf(home);
        setRun({ steps: tourSteps({ solo, reminders, show: practice?.name ?? null, replay: !!replay }), reminders, practice, replay, demo: demoOf(home) });
        if (linked) {
          const url = new URL(window.location.href);
          url.searchParams.delete("tour");
          window.history.replaceState(window.history.state, "", url);
        }
      },
      tries ? 1000 : 700
    );
    return () => clearTimeout(t);
  }, [want, ready, run, tries, phone, solo, linked, home, catalog]);
  const done = useCallback(
    (reached: number, how: Ending) => {
      setRun(null);
      setForced(false);
      void seen(reached);
      // Turn on says its own (remind.tsx turnOn: on, or why not).
      if (how !== "on") toast("Take the tour again anytime in Settings.");
    },
    [seen]
  );
  const left = useCallback((reached: number) => void seen(reached), [seen]);
  if (!run || !home) return null;
  return createPortal(<Running run={run} home={home} couch={couch} onDone={done} onLeft={left} />, document.body);
}

function Running({ run, home, couch, onDone, onLeft }: { run: Run; home: Home; couch: Couch | null; onDone: (reached: number, how: Ending) => void; onLeft: (reached: number) => void }) {
  const { steps, reminders, practice, replay, demo } = run;
  const me = useMe();
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [card, setCard] = useState(false);
  const [lit, setLit] = useState(false);
  const [hasHole, setHasHole] = useState(false);
  const [shown, setShown] = useState(false);
  const [away, setAway] = useState(false);
  const [ticked, setTicked] = useState(false);
  const [revealing, setRevealing] = useState<TourRevealPlay | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const lower = useRef<HTMLDivElement>(null);
  const holeRect = useRef<SVGRectElement>(null);
  const ringRect = useRef<SVGRectElement>(null);
  const pulseRect = useRef<SVGRectElement>(null);
  const hole = useRef<Rect | null>(null);
  const token = useRef(0);
  const moving = useRef(false);
  const leaving = useRef(false);
  const stepped = useRef(false);
  const at = useRef(0);
  /** Home's foot while the tour's up (room to scroll its last rows clear of the lower third), and what it was. */
  const room = useRef<{ el: HTMLElement; was: string } | null>(null);
  const giveRoomBack = () => {
    if (room.current) room.current.el.style.paddingBottom = room.current.was;
    room.current = null;
  };
  const step = steps[i];
  const n = steps.length;
  const last = i === n - 1;

  const draw = useCallback((r: Rect | null) => {
    for (const el of [holeRect.current, ringRect.current, pulseRect.current]) {
      el?.setAttribute("x", String(r?.x ?? 0));
      el?.setAttribute("y", String(r?.y ?? 0));
      el?.setAttribute("width", String(r?.w ?? 0));
      el?.setAttribute("height", String(r?.h ?? 0));
    }
    // The pulse breathes the same ~10 px out of the ring whatever its size.
    if (r && pulseRect.current) {
      pulseRect.current.style.setProperty("--sx", String((r.w + 20) / Math.max(1, r.w)));
      pulseRect.current.style.setProperty("--sy", String((r.h + 20) / Math.max(1, r.h)));
    }
  }, []);

  /** To step k: off with the light, the page there, on with it; or a glide when it's on this screen already. */
  const move = useCallback(
    async (k: number, first: boolean) => {
      const t = ++token.current;
      const alive = () => t === token.current && !leaving.current;
      const pause = (ms: number) => wait(reduce ? 0 : ms);
      moving.current = true;
      const box = root.current?.getBoundingClientRect();
      if (!box) return;
      // The guide holds still on today while it's the step (it rolls through the week on its own), and goes on rolling after.
      holdGuide(steps[k].id === "guide", reduce);
      const els = findTargets(steps[k]);
      if (!els.length) {
        // Nothing of it on this Home: the page stays put and the screen dims around the lower third.
        setLit(false);
        await pause(first ? FIRST_BEAT : LIGHT_OFF);
        if (!alive()) return;
        hole.current = null;
        setHasHole(false);
        draw(null);
        setLit(true);
        moving.current = false;
        return;
      }
      const freeY = (lower.current?.getBoundingClientRect().top ?? window.innerHeight) - 10;
      const y = scrollPlan(unionOf(els), freeY);
      const shelf = els.length === 1 ? shelfOf(els[0]) : null;
      const left = shelf ? shelfPlan(els[0], shelf) : null;
      const dy = Math.abs(y - window.scrollY);
      const dx = shelf && left != null ? Math.abs(left - shelf.scrollLeft) : 0;
      if (!first && hole.current && dy < 3 && dx < 3) {
        const from = hole.current;
        const to = holeOf(unionOf(els), box);
        setHasHole(true);
        setLit(true);
        await tween(reduce ? 0 : GLIDE, (p) => alive() && draw(lerp(from, to, p)));
        if (!alive()) return;
        hole.current = to;
        moving.current = false;
        return;
      }
      setLit(false);
      await pause(first ? FIRST_BEAT : LIGHT_OFF);
      if (!alive()) return;
      if (shelf && left != null && dx >= 3) shelf.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
      const y0 = window.scrollY;
      await tween(reduce ? 0 : scrollMs(dy), (p) => alive() && window.scrollTo(0, y0 + (y - y0) * p), easeInOut);
      if (shelf && dx >= 3) await pause(450);
      if (!alive() || !root.current) return;
      const to = holeOf(unionOf(els), root.current.getBoundingClientRect());
      hole.current = to;
      setHasHole(true);
      draw(to);
      await pause(LIGHT_ON);
      if (!alive()) return;
      setLit(true);
      moving.current = false;
    },
    [steps, reduce, draw]
  );

  const next = useCallback(() => {
    if (leaving.current || at.current >= n - 1) return;
    // Past the guide, the demo's shows go from Home again.
    if (steps[at.current].id === "guide") setPracticeShows([]);
    const k = at.current + 1;
    at.current = k;
    setI(k);
    void move(k, false);
  }, [n, move, steps]);

  const finish = (how: Ending) => {
    if (leaving.current) return;
    leaving.current = true;
    token.current++;
    setPracticeShows([]);
    holdGuide(false, reduce);
    setLit(false);
    setShown(false);
    setCard(false);
    // Back to the top of Home as the tour goes, briskly, its (now clear) layer still taking taps so nothing's tapped on a moving
    // page; then Home's foot as it was, and Home back.
    const y0 = window.scrollY;
    void Promise.all([tween(reduce ? 0 : Math.min(900, scrollMs(y0)), (p) => window.scrollTo(0, y0 * (1 - p)), easeInOut), wait(reduce ? 0 : 340)]).then(() => {
      giveRoomBack();
      onDone(at.current + 1, how);
    });
  };

  /** Off the welcome card and onto Home. */
  const around = () => {
    if (at.current !== 0 || leaving.current) return;
    setCard(false);
    at.current = 1;
    setI(1);
    setShown(true);
    void move(1, true);
  };

  // What Add a show's demo added (its listings): on Home for a moment, in Your shows and the guide, for the step that says where
  // shows you add go (practice-shows.ts).
  const demoed = useRef<number[]>([]);
  const showDemo = useCallback(async () => {
    const ids = demoed.current;
    demoed.current = [];
    if (!ids.length) return;
    const shows = await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await fetch(`/api/listings/${id}`);
          return r.ok ? practiceShow(id, await r.json()) : null;
        } catch {
          return null;
        }
      })
    );
    if (!leaving.current) setPracticeShows(shows.filter((s) => s !== null));
  }, []);
  // Back from a practice run: the step ticks, then the next one.
  const back = useCallback(() => {
    if (!stepped.current) return;
    stepped.current = false;
    void showDemo();
    setRevealing(null);
    setAway(false);
    if (leaving.current) return;
    document.querySelector(".nd")?.setAttribute("inert", "");
    // The tick is a state, not a movement: it shows under reduced motion too.
    setTicked(true);
    setTimeout(() => {
      setTicked(false);
      next();
    }, TICK);
  }, [next, showDemo]);
  // A practice run: the tour steps aside (Home in reach again) and the real thing opens; its close brings the tour back.
  const act = () => {
    const a = steps[at.current].act;
    if (!a || leaving.current || moving.current || stepped.current) return;
    stepped.current = true;
    setAway(true);
    document.querySelector(".nd")?.removeAttribute("inert");
    if (a.kind === "add")
      openWatching({
        kind: "add",
        practice: { name: practice?.name ?? null, seasonId: practice?.seasonId ?? null, demo, onDemo: (ids) => (demoed.current = ids), onClose: back },
      });
    else if (a.kind === "start")
      openStartGame({ couchId: couch?.id ?? null, practice: { seasonId: practice?.seasonId ?? null, label: practice?.label ?? null, artUrl: practice?.artUrl ?? null, onClose: back } });
    else setRevealing(replay ? { seasonId: replay.seasonId, couchId: null, n: replay.n, name: replay.name, season: replay.season } : { made: MADE_UP_REVEAL, ...MADE_UP_SHOW });
  };

  // On it comes: the welcome card first.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setCard(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Home underneath: out of reach (inert) and still (no scrolling it by hand) while the tour's up, with room at its foot so
  // its last rows (Start a game, a solo player's Start a couch) can scroll up clear of the lower third.
  useEffect(() => {
    const col = document.querySelector<HTMLElement>(".nd");
    col?.setAttribute("inert", "");
    const hub = document.querySelector<HTMLElement>("[data-hub]");
    if (hub) {
      room.current = { el: hub, was: hub.style.paddingBottom };
      hub.style.paddingBottom = "340px";
    }
    const el = root.current;
    const still = (e: Event) => e.preventDefault();
    el?.addEventListener("wheel", still, { passive: false });
    el?.addEventListener("touchmove", still, { passive: false });
    return () => {
      col?.removeAttribute("inert");
      setPracticeShows([]);
      holdGuide(false, true);
      // Leaving gives it back once it's scrolled to the top (finish); otherwise now.
      if (!leaving.current) giveRoomBack();
      el?.removeEventListener("wheel", still);
      el?.removeEventListener("touchmove", still);
    };
  }, []);

  // Leaving Home mid-tour (the phone's back, a notification opened) counts as a skip: it was seen this far. A tick later, so a
  // remount straight after (React's own, in development) doesn't count.
  useEffect(
    () => () => {
      if (leaving.current) return;
      const reached = at.current + 1;
      setTimeout(() => {
        if (!document.querySelector('[role="dialog"][data-tour]')) onLeft(reached);
      }, 0);
    },
    [onLeft]
  );

  // If Home's layout changes under a lit step (a read coming back), the spotlight follows its target.
  useEffect(() => {
    const redo = () => {
      if (moving.current || leaving.current || stepped.current || !hole.current || !root.current) return;
      const els = findTargets(steps[at.current]);
      if (!els.length) return;
      hole.current = holeOf(unionOf(els), root.current.getBoundingClientRect());
      draw(hole.current);
    };
    const ro = new ResizeObserver(redo);
    const hub = document.querySelector("[data-hub]");
    if (hub) ro.observe(hub);
    window.addEventListener("resize", redo);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", redo);
    };
  }, [steps, draw]);

  // Keys: Escape skips; the right arrow, or Enter and Space on the tour itself, go on; the keys that would scroll Home don't.
  // Not while a practice run's up: it has its own.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (stepped.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        finish("skip");
      } else if (e.key === "ArrowRight" || ((e.key === "Enter" || e.key === " ") && e.target === root.current)) {
        e.preventDefault();
        if (at.current === 0) around();
        else if (!last) next();
      } else if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(e.key)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Focus on the tour itself, once: Tab reaches its buttons, and no button wears a ring it wasn't tabbed to.
  useEffect(() => {
    root.current?.focus({ preventScroll: true });
  }, []);

  /** A tap: on what's lit, its practice run when the step has one; anywhere else, on to the next. */
  const onTap = (e: MouseEvent) => {
    if (at.current === 0 || stepped.current || (e.target as HTMLElement).closest("button, a")) return;
    const h = hole.current;
    const box = root.current?.getBoundingClientRect();
    if (step.act && h && box && hasHole) {
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return act();
    }
    if (!last) next();
  };

  const asks = last && reminders === "off";
  return (
    <div
      ref={root}
      data-tour={step.id}
      data-tour-lit={lit && hasHole ? "on" : lit ? "dim" : "off"}
      data-tour-away={away || undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby={i === 0 ? "nd-tour-welcome" : "nd-tour-title"}
      aria-describedby={i === 0 ? undefined : "nd-tour-line"}
      tabIndex={-1}
      onClick={onTap}
      className={`nd-fixed-x fixed inset-y-0 z-[85] cursor-pointer touch-none select-none outline-none ${away ? "invisible" : ""}`}
    >
      <Welcome home={home} couch={couch} count={`1/${n}`} shown={card} onGo={around} onSkip={() => finish("skip")} />

      <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        <defs>
          <mask id="nd-tour-mask">
            <rect width="100%" height="100%" fill="#fff" />
            <rect ref={holeRect} rx={4} fill="#000" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          mask="url(#nd-tour-mask)"
          style={{ fill: "var(--scrim)" }}
          className={`transition-opacity duration-300 motion-reduce:transition-none ${shown && lit ? "opacity-100" : "opacity-0"}`}
        />
        <rect
          ref={ringRect}
          rx={4}
          fill="none"
          strokeWidth={2}
          style={{ stroke: "var(--foreground)" }}
          className={`transition-opacity duration-300 motion-reduce:transition-none ${shown && lit && hasHole ? "opacity-90" : "opacity-0"}`}
        />
        <rect
          ref={pulseRect}
          rx={4}
          fill="none"
          strokeWidth={2}
          style={{ stroke: "var(--foreground)", transformBox: "fill-box", transformOrigin: "center" } as CSSProperties}
          className={`motion-reduce:hidden ${shown && lit && hasHole && step.act && !ticked ? "nd-tour-pulse" : "opacity-0"}`}
        />
      </svg>

      <div ref={lower} data-tour-lower className="absolute inset-x-4 bottom-[calc(14px+env(safe-area-inset-bottom,0px))] grid cursor-default gap-2">
        <button
          type="button"
          data-tour-skip
          onClick={() => finish("skip")}
          className={`-mb-2 -mr-1.5 grid h-11 place-items-center justify-self-end px-1.5 transition-opacity duration-300 ${shown ? "opacity-100 delay-300" : "opacity-0"}`}
        >
          <span className="grid h-[30px] place-items-center rounded-full bg-background px-3.5 text-[13px] font-bold shadow-plate outline-1 -outline-offset-1 outline-edge">Skip tour</span>
        </button>

        <button
          type="button"
          data-tour-next
          disabled={last}
          onClick={() => !last && next()}
          className={`flex min-h-[68px] w-full items-stretch overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground shadow-plate transition-[opacity,transform] duration-500 ease-[cubic-bezier(.16,1,.3,1)] disabled:cursor-default ${
            shown ? "translate-y-0 opacity-100" : "translate-y-[18px] opacity-0"
          }`}
        >
          <span
            data-tour-count={ticked ? "done" : `${i + 1}/${n}`}
            className={`tag-cut type-num grid place-items-center pl-[11px] pr-5 text-[17px] [--tag-slant:12px] transition-colors duration-200 ${ticked ? "bg-good text-good-foreground" : "bg-quiet-tag text-quiet-tag-foreground"}`}
          >
            {ticked ? (
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-label="Done">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              `${i + 1}/${n}`
            )}
          </span>
          <span key={i} className={`flex min-w-0 flex-1 flex-col justify-center gap-1 py-2 pl-1 pr-2 ${shown ? "nd-tour-rise" : "opacity-0"}`}>
            <b id="nd-tour-title" className="type-caption text-[21px] [text-wrap:balance]">
              {step.title}
            </b>
            <span id="nd-tour-line" className="text-[14px] leading-snug text-plate-muted [text-wrap:pretty]">
              {step.line}
            </span>
          </span>
          {!last && (
            <span className="flex items-center gap-0.5 border-l border-plate-muted/25 pl-3 pr-3 text-[15px] font-bold">
              Next
              <NextArrow />
            </span>
          )}
        </button>

        {step.act && !last && (
          <Btn wide data-tour-act={step.act.kind} onClick={act} className={`transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`}>
            {step.act.label}
          </Btn>
        )}

        {last && (
          <div className={`grid gap-2 ${asks ? "grid-cols-2" : ""}`}>
            {asks && (
              <Btn
                data-tour-on
                onClick={() => {
                  markAsked(me.id, "off");
                  // In the tap itself: the phone's permission prompt needs one.
                  void turnOn(() => {});
                  finish("on");
                }}
              >
                Turn on reminders
              </Btn>
            )}
            <Btn
              tone="ink"
              wide={!asks}
              data-tour-explore
              onClick={() => {
                if (reminders) markAsked(me.id, reminders);
                finish("done");
              }}
            >
              Explore
            </Btn>
          </div>
        )}
      </div>

      {revealing && (
        <TourReveal
          key={"made" in revealing ? "made" : "replay"}
          play={revealing}
          onFail={() => setRevealing({ made: MADE_UP_REVEAL, ...MADE_UP_SHOW })}
          onClose={back}
        />
      )}

      <p className="sr-only" aria-live="polite">
        {i === 0 ? "" : `Step ${i + 1} of ${n}. ${step.title}. ${step.line}`}
      </p>
    </div>
  );
}
