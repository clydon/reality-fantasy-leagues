"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { useTourSeen, type CouchHub, type Home } from "../data";
import { useMe } from "../session";
import { usePhone } from "../settings/notify";
import { markAsked, turnOn } from "../show/remind";
import { useShown } from "../ui/loaded";
import { Btn } from "../ui/parts";
import { toast } from "../ui/toast";
import { useReducedMotion } from "../welcome/hooks";
import { NextArrow, Scene } from "./scenes";
import { tourSteps, type TourReminders, type TourStep } from "./steps";
import { clearTourAsk, tourAsked } from "./store";

// The first-time tour (docs/PLAN-first-time-tour.md; the mock the user approved, Look A, "in place"): over the real Home, a
// step at a time. Each lights the thing it's about and puts a lower third at the foot of the phone: a Skip tour pill, the
// step's example in a box over the shoulder (scenes.tsx), and the caption plate (the count on a quiet tag, the title, the
// line, Next). Tap anywhere for the next one. Next is the bone ink button, never yellow: the tour teaches that yellow is
// your move.
//
// Moving between steps looks the way a person moves (the user, 2026-10-31): the light goes off, the whole Home shows while the
// page scrolls (eased in and out, slower for further; a shelf scrolls sideways to its card), and the spotlight comes on once
// the target has arrived; a target on the same screen gets a glide instead. A beat on Home as it is before the first move,
// and back to the top at the end. The step's words change as the move starts; its example waits for the light.
//
// It plays once an account (Home's read says `tourSeen`; finished or skipped, it's kept: data.ts useTourSeen), never while an
// admin acts as someone or views as a player, never over a sheet or a pushed page; again from Settings (store.ts) or
// /home?tour=1. While it's up, Home underneath is inert and doesn't scroll by hand.

const FIRST_BEAT = 900;
const LIGHT_OFF = 260;
const LIGHT_ON = 120;
const GLIDE = 420;
const PAD = 6;
const SCENE_W = 324;
const SCENE_H = 200;

type Rect = { x: number; y: number; w: number; h: number };
type Ending = "skip" | "done" | "on" | "later";

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

/** The first of a step's targets on Home that has a box (one that's `display: contents` has none: its first child, then). */
function findTarget(step: TourStep): HTMLElement | null {
  const hub = document.querySelector("[data-hub]");
  if (!hub) return null;
  for (const sel of step.targets) {
    let el = hub.querySelector<HTMLElement>(sel);
    if (el && !el.getClientRects().length && el.firstElementChild) el = el.firstElementChild as HTMLElement;
    if (el && el.getBoundingClientRect().width > 0) return el;
  }
  return null;
}

/** Where the page scrolls to for `el`: the top when it's in the clear above the lower third there, else it centred in that space
 *  (its top a little under the phone's when it's too tall for it). */
function scrollPlan(el: HTMLElement, freeY: number) {
  const r = el.getBoundingClientRect();
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

/** The spotlight around `el`, in the tour's own box (the phone's column). */
function holeOf(el: HTMLElement, box: DOMRect): Rect {
  const r = el.getBoundingClientRect();
  const x = Math.max(4, r.left - box.left - PAD);
  const x2 = Math.min(box.width - 4, r.right - box.left + PAD);
  return { x, y: r.top - box.top - PAD, w: Math.max(0, x2 - x), h: r.height + 2 * PAD };
}

/** A sheet or a pushed page that's open (they're dialogs; a closed one is hidden or gone). */
function anyOpenDialog() {
  return [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].some(
    (d) => !d.hasAttribute("data-tour") && d.getAttribute("aria-hidden") !== "true" && d.getClientRects().length > 0 && getComputedStyle(d).visibility !== "hidden"
  );
}

/** Mounted with the hub (screens/home.tsx): plays the tour when it's due, or asked for. */
export function Tour({ home, hub, solo }: { home: Home | undefined; hub: CouchHub | undefined; solo: boolean }) {
  const me = useMe();
  const params = useSearchParams();
  const [phone] = usePhone();
  const seen = useTourSeen();
  const [forced, setForced] = useState(tourAsked);
  const [run, setRun] = useState<{ steps: TourStep[]; reminders: TourReminders } | null>(null);
  const [tries, setTries] = useState(0);
  const [hubWaited, setHubWaited] = useState(false);
  const linked = params.get("tour") === "1";
  const page = params.get("page");
  useEffect(() => {
    clearTourAsk();
    // The couch's own read (Couch points' row) gets a moment; past it, the tour goes on without.
    const t = setTimeout(() => setHubWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);
  const want = forced || linked || (home?.user.tourSeen === false && !me.impersonating && !me.viewingAs);
  // Home on screen (ui/loaded.tsx shows it all at once, its reads in), and nothing opened over it.
  const shown = useShown();
  const ready = shown && !!home && phone !== "loading" && (solo || hub !== undefined || hubWaited) && !page;
  useEffect(() => {
    if (!want || !ready || run) return;
    // Home's in, then the tour comes on; never over a sheet opened meanwhile (it looks again shortly).
    const t = setTimeout(
      () => {
        if (anyOpenDialog()) return setTries((n) => n + 1);
        const reminders: TourReminders = phone === "off" || phone === "install" ? phone : null;
        setRun({ steps: tourSteps({ solo, reminders }), reminders });
        if (linked) {
          const url = new URL(window.location.href);
          url.searchParams.delete("tour");
          window.history.replaceState(window.history.state, "", url);
        }
      },
      tries ? 1000 : 700
    );
    return () => clearTimeout(t);
  }, [want, ready, run, tries, phone, solo, linked]);
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
  if (!run) return null;
  return createPortal(<Running steps={run.steps} reminders={run.reminders} onDone={done} />, document.body);
}

function Running({ steps, reminders, onDone }: { steps: TourStep[]; reminders: TourReminders; onDone: (reached: number, how: Ending) => void }) {
  const me = useMe();
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [lit, setLit] = useState(false);
  const [hasHole, setHasHole] = useState(false);
  const [playing, setPlaying] = useState(-1);
  const [shown, setShown] = useState(false);
  const [scale, setScale] = useState(1);
  const root = useRef<HTMLDivElement>(null);
  const lower = useRef<HTMLDivElement>(null);
  const example = useRef<HTMLDivElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const holeRect = useRef<SVGRectElement>(null);
  const ringRect = useRef<SVGRectElement>(null);
  const hole = useRef<Rect | null>(null);
  const token = useRef(0);
  const moving = useRef(false);
  const leaving = useRef(false);
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
  const asks = last && step.id === "remind";

  const draw = useCallback((r: Rect | null) => {
    for (const el of [holeRect.current, ringRect.current]) {
      el?.setAttribute("x", String(r?.x ?? 0));
      el?.setAttribute("y", String(r?.y ?? 0));
      el?.setAttribute("width", String(r?.w ?? 0));
      el?.setAttribute("height", String(r?.h ?? 0));
    }
  }, []);

  /** To step k: off with the light, the page there, on with it; or a glide when it's on this screen already. */
  const move = useCallback(
    async (k: number, first: boolean) => {
      const t = ++token.current;
      const alive = () => t === token.current && !leaving.current;
      const pause = (ms: number) => wait(reduce ? 0 : ms);
      moving.current = true;
      setPlaying(-1);
      const box = root.current?.getBoundingClientRect();
      if (!box) return;
      const el = findTarget(steps[k]);
      if (!el) {
        // Nothing of it on this Home: the page stays put and the screen dims around the lower third.
        setLit(false);
        await pause(first ? FIRST_BEAT : LIGHT_OFF);
        if (!alive()) return;
        hole.current = null;
        setHasHole(false);
        draw(null);
        setLit(true);
        moving.current = false;
        setPlaying(k);
        return;
      }
      const freeY = (lower.current?.getBoundingClientRect().top ?? window.innerHeight) - 10;
      const y = scrollPlan(el, freeY);
      const shelf = shelfOf(el);
      const left = shelf ? shelfPlan(el, shelf) : null;
      const dy = Math.abs(y - window.scrollY);
      const dx = shelf && left != null ? Math.abs(left - shelf.scrollLeft) : 0;
      if (!first && hole.current && dy < 3 && dx < 3) {
        const from = hole.current;
        const to = holeOf(el, box);
        await tween(reduce ? 0 : GLIDE, (p) => alive() && draw(lerp(from, to, p)));
        if (!alive()) return;
        hole.current = to;
        moving.current = false;
        setPlaying(k);
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
      const to = holeOf(el, root.current.getBoundingClientRect());
      hole.current = to;
      setHasHole(true);
      draw(to);
      await pause(LIGHT_ON);
      if (!alive()) return;
      setLit(true);
      moving.current = false;
      setPlaying(k);
    },
    [steps, reduce, draw]
  );

  const next = () => {
    if (leaving.current || at.current >= n - 1) return;
    const k = at.current + 1;
    at.current = k;
    setI(k);
    void move(k, false);
  };

  const finish = (how: Ending) => {
    if (leaving.current) return;
    leaving.current = true;
    token.current++;
    setLit(false);
    setShown(false);
    setPlaying(-1);
    // Back to the top of Home the way it came, while the tour goes; then Home's foot as it was.
    const y0 = window.scrollY;
    void tween(reduce ? 0 : scrollMs(y0), (p) => window.scrollTo(0, y0 * (1 - p)), easeInOut).then(giveRoomBack);
    setTimeout(() => onDone(at.current + 1, how), reduce ? 0 : 340);
  };

  // The example fills its box: 324 wide, scaled to the phone.
  useLayoutEffect(() => {
    const w = example.current?.clientWidth ?? SCENE_W + 34;
    setScale(Math.min(1.06, (w - 20) / SCENE_W));
  }, []);

  // On it comes, and to the first step.
  useEffect(() => {
    const moves = token;
    const raf = requestAnimationFrame(() => {
      setShown(true);
      void move(0, true);
    });
    return () => {
      cancelAnimationFrame(raf);
      moves.current++;
    };
  }, [move]);

  // Home underneath: out of reach (inert) and still (no scrolling it by hand) while the tour's up, with room at its foot so
  // its last rows (Couch points, a solo player's Start a couch) can scroll up clear of the lower third.
  useEffect(() => {
    const col = document.querySelector<HTMLElement>(".nd");
    col?.setAttribute("inert", "");
    const hub = document.querySelector<HTMLElement>("[data-hub]");
    if (hub) {
      room.current = { el: hub, was: hub.style.paddingBottom };
      hub.style.paddingBottom = `${(lower.current?.offsetHeight ?? 330) + 140}px`;
    }
    const el = root.current;
    const still = (e: Event) => e.preventDefault();
    el?.addEventListener("wheel", still, { passive: false });
    el?.addEventListener("touchmove", still, { passive: false });
    return () => {
      col?.removeAttribute("inert");
      // Leaving gives it back once it's scrolled to the top (finish); otherwise now.
      if (!leaving.current) giveRoomBack();
      el?.removeEventListener("wheel", still);
      el?.removeEventListener("touchmove", still);
    };
  }, []);

  // If Home's layout changes under a lit step (a read coming back), the spotlight follows its target.
  useEffect(() => {
    const redo = () => {
      if (moving.current || leaving.current || !hole.current || !root.current) return;
      const el = findTarget(steps[at.current]);
      if (!el) return;
      hole.current = holeOf(el, root.current.getBoundingClientRect());
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

  // Keys: Escape skips, the right arrow goes on; the keys that would scroll Home don't.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish("skip");
      } else if (e.key === "ArrowRight" && !asks) {
        e.preventDefault();
        next();
      } else if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(e.key)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Focus on what's next: Next, or the step's own buttons on the last.
  useEffect(() => {
    const t = setTimeout(() => (asks ? actions.current?.querySelector("button") : nextBtn.current)?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(t);
  }, [i, asks]);

  const onTap = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    if (!last) next();
  };

  return (
    <div
      ref={root}
      data-tour={step.id}
      data-tour-lit={lit && hasHole ? "on" : lit ? "dim" : "off"}
      role="dialog"
      aria-modal="true"
      aria-labelledby="nd-tour-title"
      aria-describedby="nd-tour-line"
      onClick={onTap}
      className="nd-fixed-x fixed inset-y-0 z-[85] cursor-pointer touch-none select-none"
    >
      <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        <defs>
          <mask id="nd-tour-mask">
            <rect width="100%" height="100%" fill="#fff" />
            <rect ref={holeRect} rx={6} fill="#000" />
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
          rx={6}
          fill="none"
          strokeWidth={2}
          style={{ stroke: "var(--foreground)" }}
          className={`transition-opacity duration-300 motion-reduce:transition-none ${shown && lit && hasHole ? "opacity-90" : "opacity-0"}`}
        />
      </svg>

      <div ref={lower} className="absolute inset-x-4 bottom-[calc(14px+env(safe-area-inset-bottom,0px))] grid cursor-default gap-2">
        <button
          type="button"
          data-tour-skip
          onClick={() => finish("skip")}
          className={`-mb-1.5 -mr-1.5 grid h-10 place-items-center justify-self-end px-1.5 transition-opacity duration-300 ${shown ? "opacity-100 delay-300" : "opacity-0"}`}
        >
          <span className="grid h-[30px] place-items-center rounded-full bg-background px-3.5 text-[13px] font-bold shadow-plate outline-1 -outline-offset-1 outline-edge">Skip tour</span>
        </button>

        <div
          ref={example}
          data-tour-example
          className={`relative grid h-[212px] place-items-center overflow-hidden rounded-[4px] bg-background shadow-plate outline-1 -outline-offset-1 outline-border transition-[opacity,transform] duration-500 ease-[cubic-bezier(.16,1,.3,1)] ${
            shown ? "translate-y-0 opacity-100" : "translate-y-[18px] opacity-0"
          }`}
        >
          <div key={step.id} className="nd-tour-fade flex-none" style={{ width: SCENE_W, height: SCENE_H, transform: `scale(${scale})` }}>
            <Scene id={step.id} go={playing === i} reminders={reminders} />
          </div>
        </div>

        <button
          ref={nextBtn}
          type="button"
          data-tour-next
          disabled={asks}
          onClick={() => (last ? finish("done") : next())}
          className="flex min-h-[68px] w-full items-stretch overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground shadow-plate disabled:cursor-default"
        >
          <span
            data-tour-count
            className={`tag-cut type-num grid place-items-center bg-quiet-tag pl-[11px] pr-5 text-[17px] text-quiet-tag-foreground [--tag-slant:12px] transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)] ${
              shown ? "translate-x-0 delay-150" : "-translate-x-full"
            }`}
          >
            {i + 1}/{n}
          </span>
          <span key={i} className={`flex min-w-0 flex-1 flex-col justify-center gap-1 py-2 pl-1 pr-2 ${shown ? "nd-tour-rise" : "opacity-0"}`}>
            <b id="nd-tour-title" className="type-caption text-[21px] [text-wrap:balance]">
              {step.title}
            </b>
            <span id="nd-tour-line" className="text-[14px] leading-snug text-plate-muted [text-wrap:pretty]">
              {step.line}
            </span>
          </span>
          {!asks && (
            <span className="flex items-center gap-0.5 border-l border-plate-muted/25 pl-3 pr-3 text-[15px] font-bold">
              {last ? "Done" : "Next"}
              <NextArrow />
            </span>
          )}
        </button>

        {asks && (
          <div ref={actions} className={`grid gap-2 ${reminders === "install" ? "" : "grid-cols-2"}`}>
            {reminders === "install" ? (
              <Btn
                tone="ink"
                wide
                data-tour-got
                onClick={() => {
                  markAsked(me.id, "install");
                  finish("done");
                }}
              >
                Got it
              </Btn>
            ) : (
              <>
                <Btn
                  tone="ink"
                  data-tour-on
                  onClick={() => {
                    markAsked(me.id, "off");
                    // In the tap itself: the phone's permission prompt needs one.
                    void turnOn(() => {});
                    finish("on");
                  }}
                >
                  Turn on
                </Btn>
                <Btn
                  data-tour-later
                  onClick={() => {
                    markAsked(me.id, "off");
                    finish("later");
                  }}
                >
                  Not now
                </Btn>
              </>
            )}
          </div>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {`Step ${i + 1} of ${n}. ${step.title}. ${step.line}`}
      </p>
    </div>
  );
}
