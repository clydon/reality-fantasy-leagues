import type { NextResponse } from "next/server";
import { DEFAULT_THEME, isTheme, THEME_COOKIE, themeFromCookies, type Theme } from "@/lib/appearance";
import { pool } from "./db";

// Appearance (docs/PLAN-new-design.md step 15 part 4; src/lib/appearance.ts): the account's theme (user_settings.theme, 0138) is
// the truth, the `gys_theme` cookie this device's copy, read by the boot script before the first paint (theme-script.ts), so it
// isn't httpOnly. Every answer that reads the account's choice writes the cookie to match when this device's differs: saving it
// (PUT /api/me/profile), GET /api/me (which the new design's sign-in asks before it goes in) and the home read, so a second
// device catches up on its first visit.

export async function themeOf(userId: string): Promise<Theme> {
  const { rows } = await pool.query("SELECT theme FROM user_settings WHERE user_id = $1", [userId]);
  return isTheme(rows[0]?.theme) ? rows[0].theme : DEFAULT_THEME;
}

/** This device's copy, from the request's cookies. */
export function deviceTheme(req: Request): Theme {
  return themeFromCookies(req.headers.get("cookie"));
}

/** Keeps this device's cookie in step with the account's choice (only written when it differs). */
export function withThemeCookie<T extends NextResponse>(res: T, theme: Theme, req?: Request): T {
  if (req && deviceTheme(req) === theme && req.headers.get("cookie")?.includes(`${THEME_COOKIE}=`)) return res;
  res.cookies.set(THEME_COOKIE, theme, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 400 * 24 * 60 * 60,
  });
  return res;
}
