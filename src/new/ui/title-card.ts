"use client";

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

// One title card, two places (B1; the check's fix: docs/design-round/b1-title-card-pfd-eval.md, -critique.md): the setup screen's
// card in Start a game (gallery-bold/parts.tsx TitleCard) and the started game's own page (show/game-title.tsx) are the same object:
// the same kicker, the same size for the same name at the same width, the same art.

/** The name's sizes, stepped by the lines it takes at its width: one line at 48 px, else two at 40, else 34. Never an ellipsis. */
export const TITLE_STEPS = [48, 40, 34];
const LEADING = 0.86;

/** The name's size for its width, measured (never by its letter count), again once the face has loaded and when the width changes. */
export function useTitleStep(ref: RefObject<HTMLElement | null>, name: string): number {
  const [step, setStep] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let s = 0;
      for (; s < TITLE_STEPS.length - 1; s++) {
        el.style.fontSize = `${TITLE_STEPS[s]}px`;
        if (Math.round(el.offsetHeight / (TITLE_STEPS[s] * LEADING)) <= s + 1) break;
      }
      // Left at the size it fits: React's own style matches it once the step is set, and keeps it when the step doesn't change.
      el.style.fontSize = `${TITLE_STEPS[s]}px`;
      setStep(s);
    };
    fit();
    let live = true;
    document.fonts?.ready.then(() => live && fit());
    const ro = new ResizeObserver(() => fit());
    if (el.parentElement) ro.observe(el.parentElement);
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [ref, name]);
  return TITLE_STEPS[step];
}

/** The kicker over the name: "Survivor · Season 51" (a sport's league season says its own). */
export const kickerOf = (show: string, season: number | null | undefined) => `${show}${season ? ` · Season ${season}` : ""}`;

/** The art behind the card, on both screens: in colour (the user's call for the game page, 2026-11-08) or greyscale (the setup card
 *  as the bold pass drew it). One switch for both, the user's to make (the story's open question); `?card-art=gray` shows the other
 *  in development (kept for the tab). Read after the first paint, so the server's render and the phone's agree. */
export function useCardArtGray(): boolean {
  const [gray, setGray] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    try {
      const q = new URLSearchParams(window.location.search).get("card-art");
      if (q) sessionStorage.setItem("gys_card_art", q);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a development switch read once from the address and the tab
      setGray(sessionStorage.getItem("gys_card_art") === "gray");
    } catch {
      // No storage: colour.
    }
  }, []);
  return gray;
}
