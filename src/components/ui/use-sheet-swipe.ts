"use client";

import { useRef, type RefObject, type TouchEvent } from "react";

// Swipe down to close a bottom sheet (docs/PLAN-league-tabs.md, "Bottom sheets close with a swipe
// down"). From the grab handle, or anywhere once everything under the finger is scrolled to its top:
// the sheet follows the finger and the scrim fades with it. Past CLOSE_DISTANCE, or a quick flick,
// it closes; otherwise it springs back. A drag that turns upward hands back to normal scrolling.
// Shared by BottomSheet and the More sheet in mobile-nav, which render their own panels.

const CLOSE_DISTANCE = 90;
const FLICK_SPEED = 0.5; // px per ms
const FLICK_MIN = 24; // a flick still has to travel this far
const SLIDE_MS = 200;

export function useSheetSwipe({
  sheetRef,
  scrimRef,
  onClose,
}: {
  sheetRef: RefObject<HTMLElement | null>;
  scrimRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const startY = useRef<number | null>(null);
  const last = useRef({ y: 0, t: 0, speed: 0 });

  function reset() {
    const sheet = sheetRef.current;
    const scrim = scrimRef?.current;
    if (sheet) {
      sheet.style.transition = "";
      sheet.style.transform = "";
    }
    if (scrim) {
      scrim.style.transition = "";
      scrim.style.opacity = "";
    }
  }

  function onTouchStart(e: TouchEvent) {
    const sheet = sheetRef.current;
    startY.current = null;
    if (!sheet) return;
    const target = e.target as HTMLElement;
    // The handle always drags; anywhere else, only if nothing between the finger and the sheet is
    // scrolled down (a pull inside a scrolled list is just a scroll).
    if (!target.closest("[data-sheet-handle]")) {
      for (let el: HTMLElement | null = target; el; el = el.parentElement) {
        if (el.scrollTop > 0) return;
        if (el === sheet) break;
      }
    }
    startY.current = e.touches[0].clientY;
    last.current = { y: startY.current, t: e.timeStamp, speed: 0 };
    sheet.style.transition = "none";
    if (scrimRef?.current) scrimRef.current.style.transition = "none";
  }

  function onTouchMove(e: TouchEvent) {
    const sheet = sheetRef.current;
    if (startY.current == null || !sheet) return;
    const y = e.touches[0].clientY;
    const delta = y - startY.current;
    if (delta <= 0) {
      startY.current = null;
      reset();
      return;
    }
    const dt = e.timeStamp - last.current.t;
    if (dt > 0) last.current.speed = (y - last.current.y) / dt;
    last.current.y = y;
    last.current.t = e.timeStamp;
    sheet.style.transform = `translateY(${delta}px)`;
    if (scrimRef?.current) {
      scrimRef.current.style.opacity = String(Math.max(0, 1 - delta / (sheet.offsetHeight || 1)));
    }
  }

  function onTouchEnd(e: TouchEvent) {
    const sheet = sheetRef.current;
    if (startY.current == null || !sheet) return;
    const delta = e.changedTouches[0].clientY - startY.current;
    startY.current = null;
    const closes = delta > CLOSE_DISTANCE || (delta > FLICK_MIN && last.current.speed > FLICK_SPEED);
    if (!closes) {
      reset();
      return;
    }
    // Finish the slide from where the finger let go, then close; the inline styles are dropped after
    // it (a sheet that stays mounted is parked off-screen by its own classes by then).
    sheet.style.transition = `transform ${SLIDE_MS}ms ease-out`;
    sheet.style.transform = "translateY(100%)";
    if (scrimRef?.current) {
      scrimRef.current.style.transition = `opacity ${SLIDE_MS}ms`;
      scrimRef.current.style.opacity = "0";
    }
    onClose();
    window.setTimeout(reset, SLIDE_MS + 50);
  }

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: reset };
}
