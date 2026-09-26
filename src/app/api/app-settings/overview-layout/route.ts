import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { DEFAULT_OVERVIEW_ORDER, type OverviewSectionId } from "@/lib/overview-layout";

const VALID_IDS = new Set<string>(DEFAULT_OVERVIEW_ORDER);

// App-wide Overview layout (db/migrations/0027_app_settings.sql, key='overview_layout') -- a super
// admin's reorder/hide choices (overview-customize-panel.tsx), applied to EVERY user's Overview, in
// every league and in demo mode alike. GET is public (no requireAuth): every viewer, including an
// anonymous demo visitor, needs to read this to render Overview the same way the admin configured
// it, the same reasoning /api/demo-seasons is public. Only the PATCH is admin-gated.
export const GET = apiRoute(async () => {
  const { rows } = await pool.query(`SELECT value FROM app_settings WHERE key='overview_layout'`);
  return NextResponse.json({ layout: rows[0]?.value ?? null });
});

export const PATCH = apiRoute(async (req) => {
  await requireSuperAdmin(req);
  const body = (await req.json().catch(() => ({}))) as { order?: unknown; hidden?: unknown };
  if (!Array.isArray(body.order) || body.order.some((id) => typeof id !== "string" || !VALID_IDS.has(id))) {
    throw new HttpError(400, "order must be an array of valid section ids");
  }
  if (typeof body.hidden !== "object" || body.hidden === null || Array.isArray(body.hidden)) {
    throw new HttpError(400, "hidden must be an object");
  }
  // Every valid id has to appear exactly once -- a partial or duplicated order would silently drop
  // or duplicate a section for every user in the app, not just the admin editing it.
  const order = body.order as OverviewSectionId[];
  if (order.length !== VALID_IDS.size || new Set(order).size !== VALID_IDS.size) {
    throw new HttpError(400, "order must contain every section id exactly once");
  }
  const value = { order, hidden: body.hidden };
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ('overview_layout', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
    [JSON.stringify(value)]
  );
  return NextResponse.json({ layout: value });
});
