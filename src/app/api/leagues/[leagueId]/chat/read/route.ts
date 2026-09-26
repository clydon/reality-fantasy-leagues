import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool } from "@/lib/server/db";

// Records that the caller has read chat up to `at` (the newest message they've seen). Only ever moves
// forward, and never past now, so a stale or skewed client clock can't un-read or pre-read anything.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string }> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "member");
  const { at } = (await req.json().catch(() => ({}))) as { at?: string };
  const parsed = at ? new Date(at) : new Date();
  const when = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  await pool.query(
    `INSERT INTO chat_reads (league_id, user_id, last_read_at) VALUES ($1, $2, LEAST($3::timestamptz, now()))
     ON CONFLICT (league_id, user_id)
     DO UPDATE SET last_read_at = GREATEST(chat_reads.last_read_at, EXCLUDED.last_read_at)`,
    [leagueId, user.id, when.toISOString()]
  );
  return NextResponse.json({ ok: true });
});
