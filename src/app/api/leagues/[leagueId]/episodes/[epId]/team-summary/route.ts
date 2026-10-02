import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { getEpisodeSummaryText } from "@db/embeddings.js";
import { buildSummaryPrompt, episodeTeamBullets } from "@/lib/game/episode-team-summary";
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

// The Scoreboard's episode summary: every team's saved "why it mattered" line for this episode, plus
// the caller's own bullets and the prompt to copy into an AI chat for theirs. No model call here --
// the episode's research summary is already stored (db/embeddings.js), and the AI step is the
// player's own chat. Read-only, so no league lock.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  const { state, ep } = await loadEpisode(leagueId, epId);

  const { rows: noteRows } = await pool.query(
    "SELECT player_id, why_text FROM episode_team_notes WHERE league_id=$1 AND episode_number=$2",
    [leagueId, ep.number]
  );
  const notes: Record<string, string> = Object.fromEntries(noteRows.map((r) => [r.player_id, r.why_text]));

  let mine = null;
  if (membership.playerId) {
    const settings = state.settings || {};
    let summaryText: string | null = null;
    if (settings.showId && settings.wikiSeason) {
      const { rows: showRows } = await pool.query("SELECT id FROM shows WHERE slug=$1", [settings.showId]);
      if (showRows.length) {
        summaryText = await getEpisodeSummaryText(pool, {
          showId: showRows[0].id,
          season: Number(settings.wikiSeason),
          episodeNumber: ep.number,
        });
      }
    }
    const bullets = episodeTeamBullets(state, epId, membership.playerId);
    mine = {
      bullets,
      prompt: buildSummaryPrompt(bullets, summaryText, ep.number),
      hasEpisodeSummary: !!summaryText,
      why: notes[membership.playerId] ?? null,
    };
  }

  return NextResponse.json({ notes, mine });
});

// Saves the caller's own line. The player id comes from the session's membership, never the body,
// so nobody can write another team's line. An empty `why` clears it.
export const PUT = apiRoute(async (req, { params }: { params: Promise<{ leagueId: string; epId: string }> }) => {
  const { leagueId, epId } = await params;
  const { membership } = await requireLeagueRole(req, leagueId, "member");
  if (!membership.playerId) throw new HttpError(403, "You don't have a team in this league");
  const { why } = (await req.json().catch(() => ({}))) as { why?: unknown };
  if (typeof why !== "string") throw new HttpError(400, "Missing why");
  const text = why.trim();
  if (text.length > MAX_WHY) throw new HttpError(400, `Keep it under ${MAX_WHY} characters`);
  const { ep } = await loadEpisode(leagueId, epId);

  if (!text) {
    await pool.query("DELETE FROM episode_team_notes WHERE league_id=$1 AND episode_number=$2 AND player_id=$3", [
      leagueId,
      ep.number,
      membership.playerId,
    ]);
  } else {
    await pool.query(
      `INSERT INTO episode_team_notes (league_id, episode_number, player_id, why_text) VALUES ($1,$2,$3,$4)
       ON CONFLICT (league_id, episode_number, player_id) DO UPDATE SET why_text = EXCLUDED.why_text, updated_at = now()`,
      [leagueId, ep.number, membership.playerId, text]
    );
  }
  return NextResponse.json({ ok: true, why: text || null });
});
