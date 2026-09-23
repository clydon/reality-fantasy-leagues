import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";

// Port of SurvivorDraft's server/routes/reports.js POST / -- not admin-gated, any signed-in
// user can submit one.
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const { type, message, route, leagueId, leagueName } = (await req.json().catch(() => ({}))) as {
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
    `INSERT INTO issue_reports (user_id, username, league_id, league_name, type, message, route)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [user.id, username, leagueId || null, leagueName || null, type, text, route || null]
  );
  return NextResponse.json({ ok: true });
});
