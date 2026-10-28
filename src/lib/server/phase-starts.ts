import type { Pool, PoolClient } from "pg";
import StateLogic from "@/lib/game/state-logic.js";
import { rulebookFor } from "@/lib/game/formats/blocks/index.js";
import { phaseRanges } from "@/lib/game/formats/rulebook-compile.js";
import type { RulebookBlocks } from "@/lib/game/formats/rulebook-schema";
import { showWords } from "@/lib/game/show-words";
import type { LeagueState } from "@/lib/game/types";
import { ensureSeasonRulebook, seasonRulebook } from "@db/rulebooks.js";
import { resolveFormat } from "@db/show-formats.js";
import { recordChange } from "./change-log";
import { pool, withLeagueLock } from "./db";
import { latestAired, seasonSchedules, type SeasonSchedule } from "./schedule";

// Games that start when a phase of the season starts (docs/PLAN-start-a-game-gpt.md step A3 part 2, "The phase start,
// decided"): "When Merged starts" on Start a game and Game settings. The game's span starts at the phase ({ phase } in its
// spec, settings.startPhase) and waits for it; where it plays from (`at`, settings.startEpisode) is settled from data, never
// guessed: the phase's first episode by the rulebook the league plays by (its couch's own copy, else the season's), as
// rulebook-compile.js phaseRanges reads it -- a start a person confirmed on the desk (from research's phaseStarted, results or
// "when N are left" cues) or one the rulebook fixes at an episode. The same start the scoring's phase gates use.
//
// It plays from the later of that and the first episode still open for moves (StateLogic.settleStart), and never moves once
// that's aired. Settled at Start a game when the start is known and ahead, when the desk confirms, corrects or clears a phase
// start (desk-rulebooks.ts writePhase: every league on the season), and after every result as a backstop (season-decisions.ts
// syncSeasonLeagues).

export interface SeasonPhase {
  id: string;
  name: string;
  summary: string | null;
  /** Its first episode, when it's known (confirmed on the desk, or fixed by the rulebook); else null. */
  from: number | null;
  /** The season's first phase: it starts with Episode 1, so it's never a game's start. */
  first: boolean;
}

/** A rulebook's phases, in order, with where each starts (rulebook-compile.js phaseRanges). */
export function phasesOf(blocks: RulebookBlocks | null | undefined, phaseStarts: Record<string, number> | null | undefined): SeasonPhase[] {
  const list = blocks?.season?.phases ?? [];
  const ranges = blocks ? phaseRanges(blocks, phaseStarts ?? {}) : {};
  return list.map((p, i) => ({ id: p.id, name: p.name || p.id, summary: p.summary ?? null, from: ranges[p.id]?.from ?? null, first: i === 0 }));
}

/** A season's rules as blocks, with the phase starts confirmed for it. */
export interface SeasonBook {
  blocks: RulebookBlocks;
  compiled: { events?: unknown[]; winnerExitMethod?: string | null } | null;
  phaseStarts: Record<string, number>;
}

/** The season's rules as blocks: its rulebook (with its confirmed phase starts), else its show's format read back as blocks. */
export async function seasonBlocks(seasonId: string): Promise<SeasonBook> {
  const row = await seasonRulebook(pool, seasonId);
  if (row?.blocks) return { blocks: row.blocks as RulebookBlocks, compiled: row.compiled ?? null, phaseStarts: row.phaseStarts ?? {} };
  const { rows } = await pool.query("SELECT s.format FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [seasonId]);
  const format = await resolveFormat(pool, rows[0]?.format ?? null);
  return { blocks: rulebookFor(format.id, format.data).blocks as RulebookBlocks, compiled: format.data, phaseStarts: {} };
}

/**
 * The phases a game plays by: its own rulebook's (a couch's copy, Make it ours), with the season's confirmed starts under the
 * copy's own (the desk confirms them on the season's, and a copy keeps the ones it was made with), else the season's.
 */
export function phasesFrom(season: SeasonBook, own: { blocks: unknown; phaseStarts?: Record<string, number> | null } | null): SeasonPhase[] {
  if (own?.blocks) return phasesOf(own.blocks as RulebookBlocks, { ...season.phaseStarts, ...(own.phaseStarts ?? {}) });
  return phasesOf(season.blocks, season.phaseStarts);
}

/** The phases of the rulebook a league plays by (phasesFrom); `season`: its season's book, when it's been read already. */
export async function leaguePhases(db: Pool | PoolClient, leagueId: string, seasonId: string, season?: SeasonBook): Promise<SeasonPhase[]> {
  const { rows } = await db.query("SELECT r.blocks, r.phase_starts FROM rulebooks r JOIN leagues l ON l.rulebook_id = r.id WHERE l.id = $1 AND r.status <> 'archived'", [leagueId]);
  return phasesFrom(season ?? (await seasonBlocks(seasonId)), rows[0] ? { blocks: rows[0].blocks, phaseStarts: rows[0].phase_starts } : null);
}

/** The first episode still open for moves: the one after the latest that's aired (by the schedule) or has results. */
export function openEpisode(state: LeagueState, schedule: SeasonSchedule | undefined, now = new Date()): number {
  return Math.max(StateLogic.SpoilerLogic.latestWithResults(state), latestAired(schedule, now)) + 1;
}

/**
 * Settles where a game that starts at a phase plays from, on a league being written (inside its lock): StateLogic.settleStart
 * with the phase's start from `phases`. What changed ({ from, to }: the episode it plays from, null while it waits), or null.
 */
export function settleIn(state: LeagueState, phases: SeasonPhase[], schedule: SeasonSchedule | undefined, now = new Date()): { from: number | null; to: number | null } | null {
  const phase = StateLogic.startPhase(state);
  // A game that asks by phase (step A7) records the phases' starts and its windows (StateLogic.settlePhases), after its own start.
  const questions = () => StateLogic.settlePhases(state, { phases: phases.map((p) => ({ id: p.id, from: p.from })), open: openEpisode(state, schedule, now) });
  if (!phase) {
    questions();
    return null;
  }
  const before = StateLogic.startEpisode(state);
  const p = phases.find((x) => x.id === phase && !x.first);
  const problems = StateLogic.settleStart(state, { from: p?.from ?? null, open: openEpisode(state, schedule, now) });
  if (problems.length) {
    console.error(`[phase-starts] couldn't settle where a game starts: ${problems.map((x) => x.problem).join("; ")}`);
    return null;
  }
  questions();
  const after = StateLogic.startEpisode(state);
  return after === before ? null : { from: after, to: StateLogic.endEpisode(state) };
}

/** Recent changes' line for a settled start: "Starts with Merged, at Episode 9" (whether that's aired or still to come), or
 *  "Waits for Merged to start again". */
export function settledLine(state: LeagueState, phases: SeasonPhase[], episodeWord: string): string {
  const id = StateLogic.startPhase(state);
  const name = phases.find((p) => p.id === id)?.name ?? "its phase";
  const at = StateLogic.startEpisode(state);
  return at === null ? `Waits for ${name} to start again` : `Starts with ${name}, at ${episodeWord} ${at}`;
}

/**
 * A season's rulebook brought up to date before its games settle after results (db/rulebooks.js ensureSeasonRulebook, as the
 * desk's pages do): a phase start its accepted results already confirm (knownPhaseStarts: a clean switch to post-merge
 * results) is written there, so the season sync settles from it the same time. Failing is logged; the row as it stands still
 * settles.
 */
export async function freshStarts(seasonId: string): Promise<void> {
  try {
    await ensureSeasonRulebook(pool, seasonId);
  } catch (e) {
    console.error(`[phase-starts] season ${seasonId}'s rulebook:`, e);
  }
}

/** A season's schedule, for openEpisode. */
export async function scheduleOf(seasonId: string, now = new Date()): Promise<SeasonSchedule | undefined> {
  return (await seasonSchedules([seasonId], now)).get(seasonId);
}

/**
 * Settles one game that starts at a phase, on a league being written (inside its lock, on its client), with a line in its
 * Recent changes when it moved. True when it did.
 */
export async function settleLeague(client: PoolClient, leagueId: string, state: LeagueState, seasonId: string, schedule: SeasonSchedule | undefined, episodeTerm: string | null, now = new Date(), season?: SeasonBook): Promise<boolean> {
  if (!StateLogic.startPhase(state) && !StateLogic.AnswerLogic.byPhase(state)) return false;
  const phases = await leaguePhases(client, leagueId, seasonId, season);
  if (!settleIn(state, phases, schedule, now)) return false;
  await recordChange(client, leagueId, state, { userId: null, kind: "game.settled", tier: 1, text: settledLine(state, phases, showWords({ episode: episodeTerm }).episode) });
  return true;
}

/**
 * Settles every game on a season that starts at a phase (each in its own lock, with a line in its Recent changes when it
 * moved): after the desk confirms, corrects or clears a phase start. Only games whose start could still move: waiting, or
 * settled to an episode that hasn't aired (one that has never moves, so it isn't locked and written for nothing). One league
 * failing is logged and never stops the rest. How many moved.
 */
export async function settleSeasonStarts(seasonId: string, now = new Date()): Promise<number> {
  // Games that start at a phase, and games of questions that ask by phase (step A7: their phase starts and windows).
  const { rows: leagues } = await pool.query(
    `SELECT l.id, s.episode_term, l.state->'settings'->'startEpisode' AS start_episode,
            (l.state->'settings'->'questions' @> '[{"asked":"phase"}]'::jsonb OR l.state->'settings'->'questions' @> '[{"settle":{"by":"phase"}}]'::jsonb) AS by_phase
       FROM leagues l
       JOIN shows s ON s.slug = l.state->'settings'->>'showId'
       JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
      WHERE ss.id = $1 AND l.deleted_at IS NULL AND COALESCE(l.state->'settings'->>'archivedAt', '') = ''
        AND (COALESCE(l.state->'settings'->>'startPhase', '') <> ''
             OR l.state->'settings'->'questions' @> '[{"asked":"phase"}]'::jsonb OR l.state->'settings'->'questions' @> '[{"settle":{"by":"phase"}}]'::jsonb)`,
    [seasonId]
  );
  if (!leagues.length) return 0;
  const schedule = await scheduleOf(seasonId, now);
  const aired = latestAired(schedule, now);
  const season = await seasonBlocks(seasonId);
  let moved = 0;
  for (const l of leagues) {
    const startAired = Number.isInteger(l.start_episode) && l.start_episode <= aired;
    if (!l.by_phase && startAired) continue;
    if (l.by_phase) {
      // Locked and written only when something would change: its start, or its phases (tried on a copy first).
      const { rows } = await pool.query("SELECT state FROM leagues WHERE id = $1", [l.id]);
      const copy = rows[0]?.state as LeagueState | undefined;
      if (!copy) continue;
      const startMoves = !!StateLogic.startPhase(copy) && !startAired;
      const phases = (await leaguePhases(pool, l.id, seasonId, season)).map((p) => ({ id: p.id, from: p.from }));
      if (!startMoves && (StateLogic.gameOver(copy) || !StateLogic.settlePhases(copy, { phases, open: openEpisode(copy, schedule, now) }))) continue;
    }
    try {
      await withLeagueLock(l.id, async (s, client) => {
        if (await settleLeague(client, l.id, s, seasonId, schedule, l.episode_term, now, season)) moved++;
      });
    } catch (e) {
      console.error(`[phase-starts] league ${l.id}:`, e);
    }
  }
  return moved;
}
