// The new design's Appearance (docs/PLAN-new-design.md step 15 part 4; the mock's settings.js): Night, Studio (the light theme)
// or Match phone, per account (user_settings.theme, migration 0138). The account's choice is the truth; the `gys_theme` cookie is
// each device's copy of it, which the boot script in <head> reads to draw the page in it before the first paint
// (src/lib/theme-script.ts). Pure, for the server and the browser alike. Classic keeps its own per-browser choice (theme.ts).

export type Theme = "night" | "studio" | "phone";
export const THEMES: Theme[] = ["night", "studio", "phone"];
/** Night: what the new design has always been, and what anyone signed out sees. */
export const DEFAULT_THEME: Theme = "night";
export const THEME_COOKIE = "gys_theme";

export function isTheme(v: unknown): v is Theme {
  return v === "night" || v === "studio" || v === "phone";
}

/** The browser's bars match the ground (globals.css --background on .dark and :root). */
export const GROUND = { night: "#16141d", studio: "#ecebf1" } as const;

/** This device's copy, from a Cookie header or document.cookie; Night without one. */
export function themeFromCookies(cookie: string | null | undefined): Theme {
  const m = new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]*)`).exec(cookie ?? "");
  const v = m ? decodeURIComponent(m[1]) : null;
  return isTheme(v) ? v : DEFAULT_THEME;
}
