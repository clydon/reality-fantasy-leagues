import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole, isUuid } from "@/lib/server/auth-helpers";
import { pool, withLeagueLock, HttpError } from "@/lib/server/db";

type RouteParams = { leagueId: string; id: string };

// Confirm a wiki-connector proposal: apply it to league state and mark the row resolved, both in one
// transaction. Commissioner-only -- this is the confirm step the whole proposal model exists for
// (see docs/PLAN-league-types-and-wiki-connector.md: "every extraction is a pending proposal, never
// auto-applied").
//
// The proposal row is locked FOR UPDATE alongside the league row, so two commissioners clicking
// Apply at the same moment can't both apply it -- the second sees it already resolved and is told so.
export const POST = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId, id } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  if (!isUuid(id)) throw new HttpError(404, "Proposal not found");

  // Shape differs by kind, so it's returned as-is for the review UI to describe. Each apply helper
  // reports what it did and what it skipped -- see their comments in state-logic.js for why every one
  // of them is additive.
  let summary: unknown = null;
  let kind = "";
  const state = await withLeagueLock(leagueId, async (s, client) => {
    const { rows } = await client.query(
      "SELECT kind, status, payload FROM wiki_proposals WHERE id=$1 AND league_id=$2 FOR UPDATE",
      [id, leagueId]
    );
    if (!rows.length) throw new HttpError(404, "Proposal not found");
    if (rows[0].status !== "pending") throw new HttpError(400, "That proposal has already been resolved");
    kind = rows[0].kind;
    // Explicit dispatch rather than a lookup, so an unrecognised kind is refused loudly instead of
    // silently applying nothing. All three paths are additive and idempotent.
    if (kind === "cast") {
      summary = StateLogic.applyCastImport(s, rows[0].payload);
    } else if (kind === "eliminations") {
      summary = StateLogic.applyEliminationsImport(s, rows[0].payload);
    } else if (kind === "scoringEvents") {
      summary = StateLogic.applyScoringEventsImport(s, rows[0].payload);
    } else {
      throw new HttpError(400, `No apply path for proposal kind "${kind}"`);
    }
    await client.query(
      "UPDATE wiki_proposals SET status='applied', resolved_at=now(), resolved_by=$2 WHERE id=$1",
      [id, user.id]
    );
  });

  return NextResponse.json({ state, kind, applied: summary });
});

// Reject a proposal. Kept as a resolved row rather than deleted, so a rejected suggestion doesn't
// simply reappear as if it were new on the next scheduled run.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId, id } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  if (!isUuid(id)) throw new HttpError(404, "Proposal not found");

  const { rowCount } = await pool.query(
    `UPDATE wiki_proposals SET status='rejected', resolved_at=now(), resolved_by=$3
      WHERE id=$1 AND league_id=$2 AND status='pending'`,
    [id, leagueId, user.id]
  );
  if (!rowCount) throw new HttpError(404, "No pending proposal with that id");
  return NextResponse.json({ ok: true });
});
