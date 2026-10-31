"use client";

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type Ref } from "react";
import { flushSync } from "react-dom";

// Pages you swipe between (a Weekly Lineup player's weeks, lineup-sheet.tsx; the games on Your moves, dock.tsx): the page follows
// the finger, a flick counts as much as a long drag, the ends stretch and spring back, and a page lands with a little overshoot. A
// tap on whatever picks the pages (a bar, a tab: `go`) or the arrow keys slide the same way, and a page further off takes the
// neighbour's place first. The window is as tall as the page it shows. `peek`: once on a device, the next page peeks in and
// slides back, so a swipe is the obvious next move. Reduced motion: pages swap with a short fade. `onMove` says where the pager
// stands (fractional mid-drag) and how to get there, so a highlight can follow it. Only the page in the middle is live; the ones
// beside it are inert.

export type PagerHandle = { go: (i: number) => void };
/** Where the pager stands (a page's index; fractional mid-drag), and the transition to get there (0 ms: at once). */
export type PagerMove = (at: number, ms: number, easing: string) => void;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const ARRIVE = "cubic-bezier(0.18, 0.9, 0.22, 1.06)";
export const SPRING = "cubic-bezier(0.34, 1.4, 0.64, 1)";
const PEEK = "cubic-bezier(0.3, 0, 0.2, 1)";

export function SwipePager({
  ref,
  count,
  index,
  onIndex,
  page,
  onMove,
  label,
  peek,
  className = "",
  paneClass = "",
  attrs,
}: {
  ref?: Ref<PagerHandle>;
  count: number;
  index: number;
  /** A swipe, a key or `go` landed on another page. */
  onIndex: (i: number) => void;
  page: (i: number) => ReactNode;
  onMove?: PagerMove;
  label: string;
  /** localStorage key for the once-a-device peek. */
  peek?: string;
  className?: string;
  paneClass?: string;
  /** data- attributes for the window (what checks look for). */
  attrs?: Record<string, string | boolean>;
}) {
  const [jump, setJump] = useState<number | null>(null);
  const vp = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const moveRef = useRef(onMove);
  // What the gesture and the animations share between renders.
  const live = useRef({ at: index, count, anim: false, peeking: false, target: null as number | null, reset: false, fade: false, dir: 0, moved: false, timer: 0 });
  const drag = useRef<{ id: number; x: number; y: number; dx: number; lock: boolean; vx: number; lx: number; lt: number } | null>(null);
  const move = (at: number, ms = 0, easing = "linear") => moveRef.current?.(at, ms, easing);

  // The window is as tall as the page it shows; the pages beside it may be taller.
  const syncHeight = () => {
    const pane = vp.current?.querySelector<HTMLElement>(':scope > div > [data-pane="1"]');
    if (!live.current.anim && !drag.current?.lock && vp.current && pane) vp.current.style.height = `${pane.offsetHeight}px`;
  };
  const remember = () => {
    if (!peek) return;
    try {
      localStorage.setItem(peek, "1");
    } catch {}
  };
  const settle = (target: number) => {
    live.current.reset = true;
    setJump(null);
    onIndex(target);
  };
  const slideTo = (target: number, dir: number, fromDx = 0, speed = 0) => {
    const t = track.current;
    const v = vp.current;
    if (!t || !v || target < 0 || target >= live.current.count) return;
    live.current.anim = true;
    window.clearTimeout(live.current.timer);
    try {
      navigator.vibrate?.(8);
    } catch {}
    if (reduced()) {
      live.current.fade = true;
      settle(target);
      return;
    }
    const W = v.clientWidth;
    const left = W - Math.abs(fromDx);
    // As fast as the flick that sent it, a touch slower from a standstill; it lands with a little overshoot.
    const ms = Math.round(Math.max(220, Math.min(440, speed > 0.3 ? (left / speed) * 0.9 : 180 + (left / W) * 260)));
    const to = v.querySelector<HTMLElement>(`:scope > div > [data-pane="${dir > 0 ? 2 : 0}"]`);
    t.style.transition = `transform ${ms}ms ${ARRIVE}`;
    t.style.transform = `translateX(${dir > 0 ? "-200%" : "0%"})`;
    move(target, ms, ARRIVE);
    live.current.target = target;
    if (to) {
      v.style.transition = `height ${ms}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
      v.style.height = `${to.offsetHeight}px`;
    }
    live.current.timer = window.setTimeout(() => {
      live.current.target = null;
      settle(target);
    }, ms);
  };
  const snapBack = () => {
    const t = track.current;
    if (!t) return;
    live.current.anim = true;
    t.style.transition = `transform 360ms ${SPRING}`;
    t.style.transform = "translateX(-100%)";
    move(live.current.at, 360, SPRING);
    window.clearTimeout(live.current.timer);
    live.current.timer = window.setTimeout(() => {
      live.current.anim = false;
      if (track.current) track.current.style.transition = "none";
    }, 370);
  };
  /** A tap or a drag mid-move gives way at once: a slide lands on its page (a bar tapped twice quickly steps twice), a peek or a
   *  spring back is simply back in place. */
  const finish = () => {
    const l = live.current;
    if (!l.anim) return;
    window.clearTimeout(l.timer);
    l.peeking = false;
    const target = l.target;
    l.target = null;
    if (target !== null) {
      // The page lands now, and the track is put back under it (the layout effect) before this returns.
      flushSync(() => settle(target));
      return;
    }
    l.anim = false;
    if (track.current) {
      track.current.style.transition = "none";
      track.current.style.transform = "translateX(-100%)";
    }
    move(l.at);
  };
  const go = (target: number) => {
    finish();
    const at = live.current.at;
    if (live.current.anim || target === at || target < 0 || target >= live.current.count) return;
    const dir = target > at ? 1 : -1;
    if (Math.abs(target - at) === 1) return slideTo(target, dir);
    live.current.dir = dir;
    setJump(target);
  };
  useImperativeHandle(ref, () => ({ go }));

  useLayoutEffect(() => {
    moveRef.current = onMove;
    live.current.at = index;
    live.current.count = count;
    const l = live.current;
    if (l.reset) {
      // The page landed in the middle pane: put the track back under it without a jump.
      l.reset = false;
      l.anim = false;
      if (track.current) {
        track.current.style.transition = "none";
        track.current.style.transform = "translateX(-100%)";
      }
      move(index);
      const v = vp.current;
      if (v) {
        v.style.transition = "none";
        if (l.fade) {
          l.fade = false;
          v.style.opacity = "0";
          void v.offsetWidth;
          v.style.transition = "opacity 180ms ease";
          v.style.opacity = "1";
        }
      }
    }
    syncHeight();
    if (l.dir && jump !== null) {
      const dir = l.dir;
      l.dir = 0;
      slideTo(jump, dir);
    }
  });

  useEffect(() => {
    const pane = vp.current?.querySelector(':scope > div > [data-pane="1"]');
    if (!pane || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => syncHeight());
    ro.observe(pane);
    const l = live.current;
    return () => {
      ro.disconnect();
      window.clearTimeout(l.timer);
    };
    // Once: the middle pane's element stays; only its contents change.
  }, []);

  // Once on a device: the next page peeks in and slides back.
  useEffect(() => {
    if (!peek) return;
    let seen = true;
    try {
      seen = localStorage.getItem(peek) === "1";
    } catch {}
    if (seen || reduced() || index >= count - 1) return;
    const l = live.current;
    const timer = window.setTimeout(() => {
      const t = track.current;
      const v = vp.current;
      if (!t || !v || l.anim || drag.current) return;
      remember();
      l.anim = true;
      l.peeking = true;
      const at = l.at;
      const n = 44;
      t.style.transition = `transform 380ms ${PEEK}`;
      t.style.transform = `translateX(calc(-100% - ${n}px))`;
      move(at + n / v.clientWidth, 380, PEEK);
      l.timer = window.setTimeout(() => {
        t.style.transition = `transform 520ms ${SPRING}`;
        t.style.transform = "translateX(-100%)";
        move(at, 520, SPRING);
        l.timer = window.setTimeout(() => {
          l.anim = false;
          l.peeking = false;
          t.style.transition = "none";
        }, 530);
      }, 420);
    }, 650);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the pager first shows
  }, []);

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    finish();
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, lock: false, vx: 0, lx: e.clientX, lt: e.timeStamp };
    live.current.moved = false;
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    const v = vp.current;
    const t = track.current;
    if (!d || e.pointerId !== d.id || !v || !t) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.lock) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        d.lock = true;
        try {
          v.setPointerCapture(e.pointerId);
        } catch {}
        t.style.transition = "none";
        // No text selected along the way (only while dragging: a page's fields stay editable on iOS).
        v.style.userSelect = "none";
      } else if (Math.abs(dy) > 10) {
        drag.current = null;
        return;
      } else return;
    }
    d.vx = d.vx * 0.3 + ((e.clientX - d.lx) / Math.max(1, e.timeStamp - d.lt)) * 0.7;
    d.lx = e.clientX;
    d.lt = e.timeStamp;
    live.current.moved = true;
    const W = v.clientWidth;
    const at = live.current.at;
    let x = Math.max(-W, Math.min(W, dx));
    // Past the first or last page it stretches a little and springs back.
    if ((x > 0 && at <= 0) || (x < 0 && at >= live.current.count - 1)) x = Math.sign(x) * W * 0.16 * (1 - Math.exp(-Math.abs(x) / (W * 0.5)));
    d.dx = x;
    t.style.transform = `translateX(calc(-100% + ${x}px))`;
    move(at - x / W);
  };
  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    const v = vp.current;
    if (!d || !d.lock || !v) return;
    v.style.userSelect = "";
    remember();
    const W = v.clientWidth;
    const vx = e.timeStamp - d.lt < 90 ? d.vx : 0;
    // A quick flick counts as much as a long drag.
    const dir = d.dx < -W * 0.25 || (vx < -0.4 && d.dx < -16) ? 1 : d.dx > W * 0.25 || (vx > 0.4 && d.dx > 16) ? -1 : 0;
    const target = live.current.at + dir;
    if (dir && target >= 0 && target < live.current.count) slideTo(target, dir, d.dx, Math.abs(vx));
    else snapBack();
  };
  const onPointerCancel = () => {
    const d = drag.current;
    drag.current = null;
    if (vp.current) vp.current.style.userSelect = "";
    if (d?.lock) snapBack();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    // Only the window's own keys: a field inside a page keeps its arrows.
    if (e.target !== e.currentTarget) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      go(live.current.at + (e.key === "ArrowRight" ? 1 : -1));
    }
  };
  // A drag isn't a tap on whatever it started over.
  const onClickCapture = (e: MouseEvent) => {
    if (!live.current.moved) return;
    live.current.moved = false;
    e.stopPropagation();
    e.preventDefault();
  };

  const left = jump !== null && jump < index ? jump : index - 1;
  const right = jump !== null && jump > index ? jump : index + 1;
  const pane = (i: number, slot: number) => (
    <div key={slot} data-pane={slot} aria-hidden={slot !== 1} inert={slot !== 1} className={`w-full flex-none ${paneClass}`}>
      {i >= 0 && i < count && page(i)}
    </div>
  );
  return (
    <div
      ref={vp}
      {...attrs}
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      onClickCapture={onClickCapture}
      className={`relative touch-pan-y overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${className}`}
    >
      <div ref={track} className="flex items-start will-change-transform" style={{ transform: "translateX(-100%)" }}>
        {pane(left, 0)}
        {pane(index, 1)}
        {pane(right, 2)}
      </div>
    </div>
  );
}
