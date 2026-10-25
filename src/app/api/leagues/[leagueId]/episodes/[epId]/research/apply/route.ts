import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { withLeagueLock, HttpError } from "@/lib/server/db";
import { applyHeldTribesIfDue } from "@/lib/server/season-cast";
import { notifyEpisodeResults } from "@/lib/server/push-events";
import { researchableEpisode } from "@/lib/server/episode-research-panel";
import { resultsChange } from "@/lib/server/change-log";
import {
  appliedAnything,
  applyResearchDecisions,
  stagedForEpisode,
  type ResearchApplyItem,
  type ResearchApplySummary,
} from "@/lib/server/episode-research-apply";

// Apply staged episode decisions to THIS league only (docs/PLAN-episode-research-compiled-cache.md,
// piece 4) -- commissioner-only. Body `{ items: [{ id, castawayName?, method?, eventType?, juryVotes? }] }`:
// the staged rows the commissioner kept, each possibly corrected. The row's kind and episode come from
// season_decisions, never the client; a correction is held to the league's format by the apply helper.
//
// season_decisions itself is not touched: this league's commissioner accepting a row decides nothing
// for any other league, and the admin's season-wide accept stays its own, independent path (see
// episode-research-apply.ts for why the two can't double-score). Everything lands in one league-locked
// write, or nothing does.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  const body = (await req.json().catch(() => ({}))) as { items?: unknown };
  if (!Array.isArray(body.items) || !body.items.length) throw new HttpError(400, "Pick at least one result to apply.");
  const picked = body.items as { id?: unknown; castawayName?: unknown; method?: unknown; eventType?: unknown; juryVotes?: unknown }[];

  let summary: ResearchApplySummary | null = null;
  let epNumber = 0;
  const state = await withLeagueLock(leagueId, async (s, client) => {
    const ep = researchableEpisode(s, epId);
    epNumber = ep.number;
    const { rows } = await client.query(
      `SELECT ss.id FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id
        WHERE sh.slug = $1 AND ss.season_number::text = $2`,
      [s.settings.showId, String(s.settings.wikiSeason)]
    );
    if (!rows.length) throw new HttpError(400, "Nothing has been researched for this league's season yet.");
    const staged = new Map((await stagedForEpisode(client, rows[0].id, ep.number)).map((d) => [d.id, d]));

    const items: ResearchApplyItem[] = picked.map((p) => {
      const d = staged.get(String(p.id));
      if (!d) throw new HttpError(400, "One of those results is no longer staged for this episode — reopen the panel.");
      const str = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v.trim() : fallback);
      return {
        kind: d.kind,
        castawayName: str(p.castawayName, d.castawayName),
        // A tribe move's group can legitimately be corrected to "" (no tribe).
        method: d.kind === "group" && typeof p.method === "string" ? p.method.trim() : str(p.method, d.method),
        eventType: str(p.eventType, d.eventType),
        juryVotes: Number.isInteger(p.juryVotes) && (p.juryVotes as number) >= 0 ? (p.juryVotes as number) : d.juryVotes,
        units: d.units ?? null,
        postMerge: d.postMerge,
      };
    });
    summary = applyResearchDecisions(s, ep.number, items);
    // Results landing can be the moment a live league reaches the episode the tribes were held for.
    if (appliedAnything(summary)) await applyHeldTribesIfDue(client, s);
  }, resultsChange(user.id, { epId }, (n) => `Applied Episode ${n}'s results`));

  const result = summary as unknown as ResearchApplySummary;
  const ep = state.episodes.find((e) => e.number === epNumber);
  if (ep && result.eliminations.length) notifyEpisodeResults(leagueId, state, ep.id, user.id);
  return NextResponse.json({ state, applied: result });
});
