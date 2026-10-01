import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { showsResultsImmediately } from "@/lib/server/results-seen";

// Account-level preferences that aren't notification types (db/migrations/0034's user_settings).
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  return NextResponse.json({ showResultsImmediately: await showsResultsImmediately(user.id) });
});

// Body: { showResultsImmediately: boolean }.
export const PUT = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const { showResultsImmediately } = (await req.json().catch(() => ({}))) as { showResultsImmediately?: unknown };
  if (typeof showResultsImmediately !== "boolean") throw new HttpError(400, "showResultsImmediately must be true or false");
  await pool.query(
    `INSERT INTO user_settings (user_id, show_results_immediately) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET show_results_immediately = $2, updated_at = now()`,
    [user.id, showResultsImmediately]
  );
  return NextResponse.json({ showResultsImmediately });
});
