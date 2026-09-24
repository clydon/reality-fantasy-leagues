import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole, isUuid } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

type RouteParams = { leagueId: string; id: string };

// Body lets the commissioner correct what the LLM extracted before committing it -- omit a field to
// accept it exactly as extracted (the common case).
interface AcceptBody {
  castawayName?: string;
  method?: string;
  eventType?: string;
}

// Accept one wiki-connector decision: apply it to league state and mark the item resolved, both in
// one transaction. This is the per-item analogue of wiki-proposals/[id]'s POST (apply), now scoped
// to a single elimination/event/exile instead of a whole payload -- see
// db/migrations/0009_wiki_extractions_and_items.sql for why the review moved to this granularity.
//
// The item row is locked FOR UPDATE alongside the league row, so two commissioners accepting the
// same item at once can't both apply it.
export const POST = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId, id } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  if (!isUuid(id)) throw new HttpError(404, "Item not found");

  const body: AcceptBody = await req.json().catch(() => ({}));

  let applied: unknown = null;
  const state = await withLeagueLock(leagueId, async (s, client) => {
    const { rows } = await client.query(
      `SELECT episode_number, post_merge, kind, castaway_name, method, event_type, status
         FROM wiki_proposal_items WHERE id=$1 AND league_id=$2 FOR UPDATE`,
      [id, leagueId]
    );
    if (!rows.length) throw new HttpError(404, "Item not found");
    const item = rows[0];
    if (item.status !== "pending") throw new HttpError(400, "That item has already been decided");

    // An edit overrides exactly the field(s) it names; everything else comes from the item as
    // extracted. `applied` records the ACTUAL committed values only when they differ from
    // extraction -- see 0009's comment on why that distinction matters for the audit trail.
    const castawayName = body.castawayName?.trim() || item.castaway_name;
    const method = item.kind === "elimination" ? body.method?.trim() || item.method : undefined;
    const eventType = item.kind === "event" ? body.eventType?.trim() || item.event_type : undefined;
    const edited =
      castawayName !== item.castaway_name ||
      (item.kind === "elimination" && method !== item.method) ||
      (item.kind === "event" && eventType !== item.event_type);

    const { castaway, ambiguous } = StateLogic.Core.findCastawayByName(s, castawayName);
    if (!castaway) {
      throw new HttpError(
        400,
        ambiguous ? `"${castawayName}" matches more than one castaway: ${ambiguous.join(", ")}` : `No castaway named "${castawayName}" in this league`
      );
    }

    const ep = StateLogic.ensureEpisodeNumber(s, item.episode_number, item.post_merge);
    if (item.kind === "elimination") {
      if (!method) throw new HttpError(400, "An elimination needs a method");
      StateLogic.addElimination(s, ep.id, castaway.id, method);
    } else if (item.kind === "event") {
      if (!eventType) throw new HttpError(400, "A scoring event needs a type");
      const added = StateLogic.ActiveRosterLogic.addEvent(s, ep.id, eventType, castaway.id);
      if (!added) throw new HttpError(400, `"${eventType}" isn't a recognized scoring event type`);
    } else if (item.kind === "exiled") {
      StateLogic.addExiled(s, ep.id, castaway.id);
    } else {
      throw new HttpError(400, `No apply path for item kind "${item.kind}"`);
    }

    applied = edited ? { castawayName: castaway.name, method, eventType } : null;
    await client.query(
      `UPDATE wiki_proposal_items SET status='accepted', decided_at=now(), decided_by=$2, applied=$3::jsonb WHERE id=$1`,
      [id, user.id, JSON.stringify(applied)]
    );
  });

  return NextResponse.json({ state, applied });
});
