import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { NOTIFICATION_TYPES } from "@/lib/server/push-core";
import { NEW_ONLY } from "@/lib/moments";

// The type catalog is served from here rather than imported by the client: push-core.js pulls in
// web-push (Node crypto), which must never end up in a browser bundle.
//
// Classic's Account settings (its per-type switches). The new design's Settings switches the same types a moment at a time
// (src/lib/moments.js), so both agree; the types only the new design can open (a poll, a planned night...) aren't listed here.
async function readPrefs(userId: string) {
  const { rows } = await pool.query("SELECT disabled FROM notification_prefs WHERE user_id=$1", [userId]);
  const disabled: Record<string, boolean> = rows[0]?.disabled ?? {};
  const { rows: devices } = await pool.query("SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id=$1", [userId]);
  return {
    types: NOTIFICATION_TYPES.filter((t) => !NEW_ONLY.has(t.id)).map((t) => ({ ...t, enabled: !disabled[t.id] })),
    deviceCount: devices[0].n as number,
  };
}

export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json(await readPrefs(user.id));
});

// Body: { enabled: { chat: false, newBet: true, ... } } -- a partial map, only the types being
// changed. Stored inverted (see 0010's comment): only the switched-OFF ones are kept.
export const PUT = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const { enabled } = (await req.json().catch(() => ({}))) as { enabled?: Record<string, boolean> };
  if (!enabled || typeof enabled !== "object") throw new HttpError(400, "enabled map required");
  const known = new Set(NOTIFICATION_TYPES.map((t) => t.id as string));
  const turnOff: Record<string, boolean> = {};
  const turnOn: string[] = [];
  for (const [id, on] of Object.entries(enabled)) {
    if (!known.has(id)) throw new HttpError(400, `Unknown notification type "${id}"`);
    if (on) turnOn.push(id);
    else turnOff[id] = true;
  }
  // Merge: add the newly-disabled keys, remove the newly-enabled ones, leave the rest untouched.
  await pool.query(
    `INSERT INTO notification_prefs (user_id, disabled) VALUES ($1, $2::jsonb)
     ON CONFLICT (user_id) DO UPDATE
       SET disabled = (notification_prefs.disabled || $2::jsonb) - $3::text[], updated_at = now()`,
    [user.id, JSON.stringify(turnOff), turnOn]
  );
  return NextResponse.json(await readPrefs(user.id));
});
