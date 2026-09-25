import { NextResponse } from "next/server";
import StateLogic from "@/lib/game/state-logic.js";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole, isUuid } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";

type RouteParams = { leagueId: string; id: string };

// Body lets the commissioner correct what research proposed before committing it -- omit a field to
// accept it exactly as researched (the common case). Same shape as wiki-items/[id]/accept's body.
interface AcceptBody {
  castawayName?: string;
  eventType?: string;
}

// Accept one episode-research decision: apply it to league state and mark the item resolved, both in
// one transaction. The research connector's analogue of wiki-items/[id]/accept -- see
// db/migrations/0015_episode_research_items.sql for why it's a separate table from
// wiki_proposal_items, not a widened one.
//
// Unlike a wiki item, there's no elimination kind here (research doesn't propose eliminations in
// v1 -- see db/episode-research.js's fan-out comment), so there's no episode-results push to fire:
// the wiki route's notification only ever fires for eliminations, and every research item is either
// a scoring event or an exile.
export const POST = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId, id } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  if (!isUuid(id)) throw new HttpError(404, "Item not found");

  const body: AcceptBody = await req.json().catch(() => ({}));

  let applied: unknown = null;
  const state = await withLeagueLock(leagueId, async (s, client) => {
    const { rows } = await client.query(
      `SELECT episode_number, kind, castaway_name, event_type, status
         FROM episode_research_items WHERE id=$1 AND league_id=$2 FOR UPDATE`,
      [id, leagueId]
    );
    if (!rows.length) throw new HttpError(404, "Item not found");
    const item = rows[0];
    if (item.status !== "pending") throw new HttpError(400, "That item has already been decided");

    // An edit overrides exactly the field(s) it names; everything else comes from the item as
    // researched. `applied` records the ACTUAL committed values only when they differ -- same
    // audit-trail reasoning as the wiki route's own `applied` column.
    const castawayName = body.castawayName?.trim() || item.castaway_name;
    const eventType = item.kind === "event" ? body.eventType?.trim() || item.event_type : undefined;
    const edited = castawayName !== item.castaway_name || (item.kind === "event" && eventType !== item.event_type);

    const { castaway, ambiguous } = StateLogic.Core.findCastawayByName(s, castawayName);
    if (!castaway) {
      throw new HttpError(
        400,
        ambiguous ? `"${castawayName}" matches more than one castaway: ${ambiguous.join(", ")}` : `No castaway named "${castawayName}" in this league`
      );
    }

    // false rather than a real answer: episode_research_items carries no post-merge flag (the
    // checklist doesn't ask about merge status), so this only matters in the edge case where
    // accepting a research item is what CREATES the episode -- ensureEpisodeNumber is a no-op if it
    // already exists, which is the common case (a wiki elimination or reveal-next's own repair path
    // usually gets there first). Same "the episode card's own Post-merge checkbox is the correction"
    // precedent as reveal-next/route.ts's repair path.
    const ep = StateLogic.ensureEpisodeNumber(s, item.episode_number, false);
    if (item.kind === "event") {
      if (!eventType) throw new HttpError(400, "A scoring event needs a type");
      const added = StateLogic.ActiveRosterLogic.addEvent(s, ep.id, eventType, castaway.id);
      if (!added) throw new HttpError(400, `"${eventType}" isn't a recognized scoring event type`);
    } else if (item.kind === "exiled") {
      StateLogic.addExiled(s, ep.id, castaway.id);
    } else {
      throw new HttpError(400, `No apply path for item kind "${item.kind}"`);
    }

    applied = edited ? { castawayName: castaway.name, eventType } : null;
    await client.query(
      `UPDATE episode_research_items SET status='accepted', decided_at=now(), decided_by=$2, applied=$3::jsonb WHERE id=$1`,
      [id, user.id, JSON.stringify(applied)]
    );
  });

  return NextResponse.json({ state, applied });
});
