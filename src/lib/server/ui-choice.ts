import type { NextResponse } from "next/server";
import { UI_COOKIE } from "@/new/routes";
import { pool } from "./db";

// Which design an account opens on (docs/PLAN-new-design.md step 0c; user_settings.ui, 0108). The new design for everyone
// since 0155 (the user, 2026-10-31): an account with no setting is on it, and classic is only for whoever chose it again
// (Settings › Your account › Back to the classic design). The account's
// setting is the truth; the `gys_ui` cookie is this device's copy of it, so a signed-in "/" can send the new
// design's people to /home without a query or a render (next.config.ts redirects). Every answer that reads the setting writes the
// cookie to match (PUT /api/me/settings, GET /api/me), so a second device catches up on its first visit.

export type UiChoice = "classic" | "new";
export { UI_COOKIE };

export function isUiChoice(v: unknown): v is UiChoice {
  return v === "classic" || v === "new";
}

export async function uiOf(userId: string): Promise<UiChoice> {
  const { rows } = await pool.query("SELECT ui FROM user_settings WHERE user_id = $1", [userId]);
  return rows[0]?.ui === "classic" ? "classic" : "new";
}

/** Keeps this device's cookie in step with the account's choice. Classic, the choice that's made, clears it (no cookie: "/"
 *  asks the account through AuthGate, which sends the new design's people on to /home). */
export function withUiCookie<T extends NextResponse>(res: T, ui: UiChoice): T {
  if (ui === "new") {
    res.cookies.set(UI_COOKIE, "new", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 400 * 24 * 60 * 60,
    });
  } else {
    res.cookies.delete(UI_COOKIE);
  }
  return res;
}
