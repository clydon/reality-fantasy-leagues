import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { syncSeasonLeagues } from "@/lib/server/season-decisions";

type RouteParams = { id: string; decisionId: string };

interface DecideBody {
  action?: "accept" | "reject";
  /** Corrections, accept only: omit a field to accept it as proposed. */
  castawayName?: string;
  method?: string;
  eventType?: string;
}

// Decide one season decision, then bring every league on the season in line with it -- applied
// where it's newly accepted, undone where an accepted one is now rejected or corrected (see
// syncLeagueDecisions). Re-deciding is always allowed: the row keeps its history in decided_at /
// decided_by / applied, and the leagues follow the latest decision.
export const POST = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id, decisionId } = await params;
  const user = await requireSuperAdmin(req);
  if (!isUuid(id) || !isUuid(decisionId)) throw new HttpError(404, "Decision not found");
  const body: DecideBody = await req.json().catch(() => ({}));
  if (body.action !== "accept" && body.action !== "reject") throw new HttpError(400, 'action must be "accept" or "reject"');

  const { rows } = await pool.query(
    "SELECT kind, castaway_name, method, event_type FROM season_decisions WHERE id=$1 AND season_id=$2",
    [decisionId, id]
  );
  if (!rows.length) throw new HttpError(404, "Decision not found");
  const d = rows[0];

  let applied: { castawayName: string; method?: string; eventType?: string } | null = null;
  if (body.action === "accept") {
    let castawayName = d.castaway_name as string;
    if (body.castawayName?.trim()) {
      const { rows: cast } = await pool.query("SELECT name FROM season_cast WHERE season_id=$1", [id]);
      const match = cast.find((c) => c.name.toLowerCase() === body.castawayName!.trim().toLowerCase());
      if (!match) throw new HttpError(400, `"${body.castawayName}" isn't in this season's cast`);
      castawayName = match.name;
    }
    const method = d.kind === "elimination" ? body.method?.trim() || d.method : undefined;
    if (method && !StateLogic.EXIT_METHODS.includes(method)) throw new HttpError(400, `"${method}" isn't an exit method`);
    const eventType = d.kind === "event" ? body.eventType?.trim() || d.event_type : undefined;
    if (eventType && !StateLogic.ACTIVE_ROSTER_EVENTS.some((e) => e.id === eventType)) {
      throw new HttpError(400, `"${eventType}" isn't a scoring event`);
    }
    const edited =
      castawayName !== d.castaway_name ||
      (d.kind === "elimination" && method !== d.method) ||
      (d.kind === "event" && eventType !== d.event_type);
    applied = edited ? { castawayName, method, eventType } : null;
  }

  await pool.query(
    `UPDATE season_decisions SET status=$2, decided_at=now(), decided_by=$3, applied=$4::jsonb WHERE id=$1`,
    [decisionId, body.action === "accept" ? "accepted" : "rejected", user.id, JSON.stringify(applied)]
  );
  const leagues = await syncSeasonLeagues(id, user.id);
  return NextResponse.json({ ok: true, leagues });
});
