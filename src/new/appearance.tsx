"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { DEFAULT_THEME, GROUND, isTheme, THEME_COOKIE, themeFromCookies, type Theme } from "@/lib/appearance";
import { useHomeTheme } from "./data";

// Appearance in the browser (docs/PLAN-new-design.md step 15 part 4; src/lib/appearance.ts): which theme this page is drawn in.
// The boot script in <head> (src/lib/theme-script.ts) has already put it on <html> before the first paint, from this device's
// cookie: `data-nd-theme` says the choice, the `dark` class whether it's Night (Match phone: whatever the phone says). Here: keep
// following the phone while on Match phone, put the theme back after React's dev remount clears <html>'s attributes, switch it
// when Settings changes it (the cookie at once, the account through PUT /api/me/profile), and catch a second device up when the
// home read says the account chose something else (the server's written the cookie by then).

const PHONE_DARK = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();
let choice: Theme | null = null;

function current(): Theme {
  if (choice) return choice;
  const attr = document.documentElement.getAttribute("data-nd-theme");
  choice = isTheme(attr) ? attr : themeFromCookies(document.cookie);
  return choice;
}

function phoneIsDark(): boolean {
  return window.matchMedia(PHONE_DARK).matches;
}

/** Whether a choice draws Night here and now. */
function nightFor(t: Theme): boolean {
  return t === "night" || (t === "phone" && phoneIsDark());
}

/** Draws the page in the current choice: <html>'s class and attribute, and the browser's bars. */
function paint() {
  const t = current();
  const night = nightFor(t);
  const html = document.documentElement;
  html.setAttribute("data-nd-theme", t);
  html.classList.toggle("dark", night);
  // The bars: Next drew one theme-color meta per media query from the cookie (the layout's generateViewport); a change is one.
  const metas = document.head.querySelectorAll('meta[name="theme-color"]');
  metas.forEach((m, i) => {
    if (i === 0) {
      m.setAttribute("content", night ? GROUND.night : GROUND.studio);
      m.removeAttribute("media");
    } else m.remove();
  });
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The choice as it is right now, outside React (an Undo's handler, which outlives its render). */
export function themeNow(): Theme {
  return current();
}

/** Your choice: Night, Studio or Match phone (Night while the server renders). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, current, () => DEFAULT_THEME);
}

/** Whether the page is drawn in Night right now (Match phone follows the phone), for what styles can't say (the emoji picker). */
export function useNight(): boolean {
  return useSyncExternalStore(subscribe, () => nightFor(current()), () => true);
}

/** This device draws `t` from now on: the cookie at once (so a reload keeps it), the page, the bars. */
export function showTheme(t: Theme) {
  choice = t;
  document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=${400 * 24 * 60 * 60}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
  paint();
}

/** In the new design's shell: keeps the page in the choice (the phone's changes on Match phone; React's dev remount). */
export function useAppearance() {
  useLayoutEffect(() => {
    paint();
  }, []);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_DARK);
    const onChange = () => current() === "phone" && paint();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
}

/** Signed in: the home read says the account's choice; a device that had another catches up (once, on its first visit). */
export function ThemeSync() {
  const theme = useHomeTheme();
  useEffect(() => {
    if (theme && theme !== current()) showTheme(theme);
  }, [theme]);
  return null;
}
