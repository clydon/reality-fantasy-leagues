import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { sentFromOf } from "@/lib/server/desk-reports";

// Port of SurvivorDraft's server/routes/reports.js POST / -- not admin-gated, any signed-in
// user can submit one. Where it was sent from (the desk's report page, docs/PLAN-desk-parity.md step 2): the device, from the
// user agent, and `installed` when the app says it's running installed.
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const { type, message, route, leagueId, leagueName, installed } = (await req.json().catch(() => ({}))) as {
    installed?: unknown;
    type?: string;
    message?: string;
    route?: string;
    leagueId?: string | null;
    leagueName?: string | null;
  };
  const text = (message || "").trim();
  if (!text) throw new HttpError(400, "message required");
  if (type !== "issue" && type !== "feature") throw new HttpError(400, "invalid type");

  const username = (user as { username?: string | null }).username || user.name;
  await pool.query(
    `INSERT INTO issue_reports (user_id, username, league_id, league_name, type, message, route, sent_from)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [user.id, username, leagueId || null, leagueName || null, type, text, route || null, sentFromOf(req.headers.get("user-agent"), installed)]
  );
  return NextResponse.json({ ok: true });
});
