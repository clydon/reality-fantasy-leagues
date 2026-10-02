import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { buildLeaguePrompt, type EpisodeSource } from "@/lib/game/episode-team-summary";
import type { LeagueState } from "@/lib/game/types";

const MAX_WHY = 400;

async function loadEpisode(leagueId: string, epId: string) {
  const { rows } = await pool.query("SELECT state FROM leagues WHERE id=$1", [leagueId]);
  if (!rows.length) throw new HttpError(404, "League not found");
  const state: LeagueState = rows[0].state;
  // epId is Core.uid()'s short id, not a UUID -- a malformed one just fails to .find().
  const ep = state.episodes.find((e) => e.id === epId);
  if (!ep) throw new HttpError(404, "Episode not found");
  return { state, ep };
}

// The Scoreboard's "why it mattered" lines for one episode: every team's saved line, for everyone;
// and, for the commissioner (who writes them), the one prompt to copy into an AI chat for all of
// them at once. No model call here -- the AI step, recap reading included, is the commissioner's own
// chat. Read-only, so no league lock.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  const { state, ep } = await loadEpisode(leagueId, epId);

  const { rows: noteRows } = await pool.query(
    "SELECT player_id, why_text FROM episode_team_notes WHERE league_id=$1 AND episode_number=$2",
    [leagueId, ep.number]
  );
  const notes: Record<string, string> = Object.fromEntries(noteRows.map((r) => [r.player_id, r.why_text]));
  if (membership.role !== "commissioner") return NextResponse.json({ notes, prompt: null, hasSource: false });

  // Where the AI should read this episode's recap: the show's own trusted research sites, the same ones
  // the research step reads.
  const settings = state.settings || {};
  let source: EpisodeSource | null = null;
  if (settings.showId) {
    const seasonNumber = settings.wikiSeason ? Number(settings.wikiSeason) : null;
    const { rows: showRows } = await pool.query(
      `SELECT s.name, s.research_domains, ss.name AS season_name
         FROM shows s LEFT JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number = $2
        WHERE s.slug = $1`,
      [settings.showId, seasonNumber]
    );
    if (showRows.length) {
      const r = showRows[0];
      source = { showName: r.name, seasonNumber, seasonName: r.season_name ?? null, domains: r.research_domains ?? [] };
    }
  }
  return NextResponse.json({ notes, prompt: buildLeaguePrompt(state, epId, source), hasSource: !!source?.domains.length });
});

// Saves any teams' lines -- commissioner only, like the rest of running the league. Body:
// { lines: { [playerId]: text } }; an empty text clears that team's line, a team left out is untouched.
export const PUT = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  if (membership.role !== "commissioner") throw new HttpError(403, "Commissioner only");
  const { lines } = (await req.json().catch(() => ({}))) as { lines?: unknown };
  if (!lines || typeof lines !== "object" || Array.isArray(lines)) throw new HttpError(400, "Missing lines");
  const { state, ep } = await loadEpisode(leagueId, epId);

  const entries = Object.entries(lines as Record<string, unknown>);
  for (const [playerId, text] of entries) {
    if (!state.players.some((p) => p.id === playerId)) throw new HttpError(400, "Unknown team");
    if (typeof text !== "string") throw new HttpError(400, "Each line must be text");
    if (text.trim().length > MAX_WHY) throw new HttpError(400, `Keep each line under ${MAX_WHY} characters`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [playerId, text] of entries as [string, string][]) {
      const why = text.trim();
      if (!why) {
        await client.query("DELETE FROM episode_team_notes WHERE league_id=$1 AND episode_number=$2 AND player_id=$3", [leagueId, ep.number, playerId]);
      } else {
        await client.query(
          `INSERT INTO episode_team_notes (league_id, episode_number, player_id, why_text) VALUES ($1,$2,$3,$4)
           ON CONFLICT (league_id, episode_number, player_id) DO UPDATE SET why_text = EXCLUDED.why_text, updated_at = now()`,
          [leagueId, ep.number, playerId, why]
        );
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
  return NextResponse.json({ ok: true });
});
