import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { DEFAULT_OVERVIEW_ORDER, OVERVIEW_LEAGUE_TYPE_IDS, type OverviewLeagueTypeId, type OverviewSectionId } from "@/lib/overview-layout";

const VALID_SECTION_IDS = new Set<string>(DEFAULT_OVERVIEW_ORDER);
const key = (leagueTypeId: string) => `overview_layout:${leagueTypeId}`;

// App-wide Overview layout, one per league type (db/migrations/0027_app_settings.sql, keys
// 'overview_layout:classic-draft' / ':active-roster' / ':pickem') -- a super admin's reorder/hide
// choices (overview-customize-panel.tsx), applied to EVERY user's Overview of that league type, in
// every league and in demo mode alike. GET is public (no requireAuth): every viewer, including an
// anonymous demo visitor, needs to read this to render Overview the same way the admin configured
// it, the same reasoning /api/demo-seasons is public. Only the PATCH is admin-gated.
//
// GET returns all 3 types' layouts at once (an object keyed by type) rather than taking a
// leagueTypeId query param -- the client already has this cached from one fetch, so switching
// league type (including the demo bar's own dropdown) never needs a second round-trip.
export const GET = apiRoute(async () => {
  const { rows } = await pool.query(`SELECT key, value FROM app_settings WHERE key LIKE 'overview_layout:%'`);
  const layouts: Record<string, unknown> = {};
  for (const row of rows) layouts[row.key.slice("overview_layout:".length)] = row.value;
  return NextResponse.json({ layouts });
});

export const PATCH = apiRoute(async (req) => {
  await requireSuperAdmin(req);
  const body = (await req.json().catch(() => ({}))) as { leagueTypeId?: unknown; order?: unknown; hidden?: unknown };
  if (typeof body.leagueTypeId !== "string" || !(OVERVIEW_LEAGUE_TYPE_IDS as readonly string[]).includes(body.leagueTypeId)) {
    throw new HttpError(400, "leagueTypeId must be one of " + OVERVIEW_LEAGUE_TYPE_IDS.join(", "));
  }
  const leagueTypeId = body.leagueTypeId as OverviewLeagueTypeId;
  if (!Array.isArray(body.order) || body.order.some((id) => typeof id !== "string" || !VALID_SECTION_IDS.has(id))) {
    throw new HttpError(400, "order must be an array of valid section ids");
  }
  if (typeof body.hidden !== "object" || body.hidden === null || Array.isArray(body.hidden)) {
    throw new HttpError(400, "hidden must be an object");
  }
  // Every valid id has to appear exactly once -- a partial or duplicated order would silently drop
  // or duplicate a section for every user of this league type, not just the admin editing it.
  const order = body.order as OverviewSectionId[];
  if (order.length !== VALID_SECTION_IDS.size || new Set(order).size !== VALID_SECTION_IDS.size) {
    throw new HttpError(400, "order must contain every section id exactly once");
  }
  const value = { order, hidden: body.hidden };
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
    [key(leagueTypeId), JSON.stringify(value)]
  );
  return NextResponse.json({ leagueTypeId, layout: value });
});
