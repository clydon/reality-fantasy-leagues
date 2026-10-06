import { NextResponse } from "next/server";
import { resolveFormat } from "@db/show-formats.js";
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
    `SELECT d.kind, d.castaway_name, d.method, d.event_type, s.format
       FROM season_decisions d
       JOIN show_seasons ss ON ss.id = d.season_id
       JOIN shows s ON s.id = ss.show_id
      WHERE d.id=$1 AND d.season_id=$2`,
    [decisionId, id]
  );
  if (!rows.length) throw new HttpError(404, "Decision not found");
  const d = rows[0];
  // Corrections are checked against the show's own rules.
  const format = await resolveFormat(pool, d.format);

  let applied: { castawayName: string; method?: string; eventType?: string } | null = null;
  if (body.action === "accept") {
    let castawayName = d.castaway_name as string;
    if (body.castawayName?.trim()) {
      const { rows: cast } = await pool.query("SELECT name FROM season_cast WHERE season_id=$1", [id]);
      const match = cast.find((c) => c.name.toLowerCase() === body.castawayName!.trim().toLowerCase());
      if (!match) throw new HttpError(400, `"${body.castawayName}" isn't in this season's cast`);
      castawayName = match.name;
    }
    // `method` is the exit method for an elimination, the role value for a role, and the new group's
    // name for a group change -- where "" is a real answer (no group now), so only an absent field
    // falls back to what was proposed.
    const method =
      d.kind === "group"
        ? body.method !== undefined ? String(body.method).trim() : d.method
        : d.kind === "elimination" || d.kind === "role" ? body.method?.trim() || d.method : undefined;
    if (d.kind === "group" && method && method.length > 60) throw new HttpError(400, "That group name is too long");
    if (d.kind === "elimination" && method && !format.exitMethods.includes(method)) {
      throw new HttpError(400, `"${method}" isn't an exit method`);
    }
    if (d.kind === "role" && method && !(format.roles?.values ?? []).includes(method)) {
      throw new HttpError(400, `"${method}" isn't a role`);
    }
    const eventType = d.kind === "event" ? body.eventType?.trim() || d.event_type : undefined;
    // Implied events follow from exits and roles, so they can't be accepted as events of their own.
    if (eventType && !format.events.some((e) => e.id === eventType && !e.implied)) {
      throw new HttpError(400, `"${eventType}" isn't a scoring event`);
    }
    const edited =
      castawayName !== d.castaway_name ||
      ((d.kind === "elimination" || d.kind === "role" || d.kind === "group") && method !== d.method) ||
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
