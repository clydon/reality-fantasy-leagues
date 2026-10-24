import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, requireSession, isImpersonating } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { isUiChoice, withUiCookie, type UiChoice } from "@/lib/server/ui-choice";

// Account-level preferences that aren't notification types (user_settings: 0034, 0038).
//   showResultsImmediately -- spoiler protection's opt-out (results-seen.ts).
//   whatsNewSeen           -- the "What's New" release this account last dismissed (whats-new.ts).
//   accountCreatedAt       -- read-only: an account made after a release doesn't need its "What's New".
//   ui                     -- the design this account opens on, classic or new (0108, ui-choice.ts).
async function read(userId: string) {
  const { rows } = await pool.query(
    `SELECT s.show_results_immediately, s.whats_new_seen, s.ui, u."createdAt" AS created_at
       FROM "user" u LEFT JOIN user_settings s ON s.user_id = u.id
      WHERE u.id = $1`,
    [userId]
  );
  return {
    showResultsImmediately: !!rows[0]?.show_results_immediately,
    whatsNewSeen: (rows[0]?.whats_new_seen as string | null) ?? null,
    accountCreatedAt: rows[0]?.created_at ? new Date(rows[0].created_at).toISOString() : null,
    ui: (rows[0]?.ui === "new" ? "new" : "classic") as UiChoice,
  };
}

export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const settings = await read(user.id);
  return withUiCookie(NextResponse.json(settings), settings.ui);
});

// Body: any of { showResultsImmediately: boolean, whatsNewSeen: string, ui: "classic" | "new" } -- only what's sent changes.
// An admin viewing as someone can open What's New, but closing it doesn't mark it seen for them
// (0048 repaired the accounts where it already had).
export const PUT = apiRoute(async (req) => {
  const session = await requireSession(req);
  const user = session.user;
  const body = (await req.json().catch(() => ({}))) as { showResultsImmediately?: unknown; whatsNewSeen?: unknown; ui?: unknown };
  if (isImpersonating(session)) delete body.whatsNewSeen;
  if ("showResultsImmediately" in body && typeof body.showResultsImmediately !== "boolean") {
    throw new HttpError(400, "showResultsImmediately must be true or false");
  }
  if ("whatsNewSeen" in body && (typeof body.whatsNewSeen !== "string" || body.whatsNewSeen.length > 64)) {
    throw new HttpError(400, "whatsNewSeen must be a release id");
  }
  if ("ui" in body && !isUiChoice(body.ui)) throw new HttpError(400, "ui must be classic or new");
  await pool.query(
    `INSERT INTO user_settings (user_id, show_results_immediately, whats_new_seen, ui) VALUES ($1, COALESCE($2, false), $3, COALESCE($4, 'classic'))
     ON CONFLICT (user_id) DO UPDATE SET
       show_results_immediately = COALESCE($2, user_settings.show_results_immediately),
       whats_new_seen = COALESCE($3, user_settings.whats_new_seen),
       ui = COALESCE($4, user_settings.ui),
       updated_at = now()`,
    [
      user.id,
      "showResultsImmediately" in body ? body.showResultsImmediately : null,
      "whatsNewSeen" in body ? body.whatsNewSeen : null,
      "ui" in body ? body.ui : null,
    ]
  );
  const settings = await read(user.id);
  return withUiCookie(NextResponse.json(settings), settings.ui);
});
