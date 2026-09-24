import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { sendPush } from "@/lib/server/push-core";

// "Send test notification" in Account settings: pushes to every device of the caller, ignoring
// their per-type preferences (a test has to work even with everything switched off). Awaited,
// unlike the event triggers, because the point is to report back whether it reached anything.
export const POST = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id=$1", [user.id]);
  if (!rows[0].n) throw new HttpError(400, "No device is set up for notifications yet. Enable them on this device first.");

  const result = await sendPush(
    pool,
    [user.id],
    "draftTurn",
    {
      title: "Notifications are working",
      body: "You'll get alerts like this when something happens in your leagues.",
      url: "/account",
      tag: "push-test",
    },
    { ignorePrefs: true }
  );
  return NextResponse.json(result);
});
