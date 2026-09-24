import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";

interface SubscriptionBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

// Register THIS device for pushes. Body is the browser's PushSubscription.toJSON().
//
// Upsert on endpoint, and re-point it at the current user: the same browser can be signed into a
// different account later, and its pushes should follow whoever is signed in now -- not keep
// delivering the previous person's notifications to the new one.
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as SubscriptionBody;
  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;
  if (!endpoint || !p256dh || !auth || !/^https:\/\//.test(endpoint)) {
    throw new HttpError(400, "Invalid push subscription");
  }
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (endpoint)
     DO UPDATE SET user_id=EXCLUDED.user_id, p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth, user_agent=EXCLUDED.user_agent`,
    [user.id, endpoint, p256dh, auth, (req.headers.get("user-agent") || "").slice(0, 300)]
  );
  return NextResponse.json({ ok: true });
});

// Unregister THIS device ("turn off on this device", or signing out). Only the caller's own row:
// knowing an endpoint URL must not let one account switch off another's notifications.
export const DELETE = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (!endpoint) throw new HttpError(400, "endpoint required");
  await pool.query("DELETE FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2", [endpoint, user.id]);
  return NextResponse.json({ ok: true });
});
