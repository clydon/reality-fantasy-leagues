import StateLogic from "@/lib/game/state-logic.js";
import { episodesSeen, revealIn, seasonEpisodesSeen, type EpisodeSeen, type Happened, type OutFace, type RevealGame, type RevealPart, type RevealTable } from "@/lib/game/episode-view";
import type { LeagueState } from "@/lib/game/types";
import { publicMediaSrc } from "@/lib/game/selectors";
import type { SessionUser } from "./auth-helpers";
import { couchFillsResults } from "./community-results";
import { pool, HttpError } from "./db";
import { EVERYTHING } from "./guard";
import { markRevealed } from "./reveal";
import { couchCorrections, type Correction } from "./rulings";
import { DEFAULT_RUNTIME_MIN, seasonSchedules } from "./schedule";
import { gamesHere, type GameHere } from "./season-games";
import { seasonFactsFor } from "./season-stats";

// A season's episodes and its one reveal, for the new design's show space (docs/PLAN-new-design.md step 2):
//   GET  /api/seasons/[id]/episodes   every episode as far as you've seen (who went home, what happened, the top
//        scorers, your line in each game), the ones whose results are in but hidden until you reveal, the one
//        that's aired and waiting for results, and what's still to air.
//   POST /api/seasons/[id]/reveal     reveal episode n for every game you play on the couch's season, at once
//        (reveal.ts per league, so classic's rules hold: linked leagues together, the chat line, a late joiner a
//        week at a time; progress moves show_follows with each mark), then its beats.
//
// Results arrive in stages (StateLogic.resultsStage): early (who went home: Survival Pool and Outlast settle,
// Weekly Lineup so far) and final (every point). Revealing an early episode leaves show_follows.early_seen at it,
// so when its final scores land the show space says so once (the morning update), with nothing new to spoil.
//
// Spoiler-safe through guard.ts: everything is read from your own copy of each league at your mark (game-view.ts,
// episode-view.ts). A hidden episode says only that its results are in, and at which stage.

export type EpisodeStatus = "seen" | "hidden" | "waiting";

export interface EpisodeRow extends Partial<Omit<EpisodeSeen, "number" | "stage">> {
  number: number;
  airAt: string | null;
  status: EpisodeStatus;
  stage: "early" | "final" | null;
}

export interface SeasonEpisodes {
  seenThrough: number | null;
  /** Newest first: hidden ones, the one waiting, then every one you've seen. */
  episodes: EpisodeRow[];
  /** The next episode to reveal (the first whose results are in past your mark), and how far its results are. */
  reveal: { episode: number; stage: "early" | "final" } | null;
  /** An episode that's finished airing with nothing in yet. */
  waiting: { episode: number; airAt: string | null } | null;
  /** The morning update: the episode you revealed early whose final scores are in now. */
  final: { episode: number } | null;
  stillIn: number | null;
  toAir: { from: number; to: number | null } | null;
  /** A player's quiet "Full scores need one paste" (step 6b): the newest episode you've seen with only its early results, when the couch lets anyone fill them in. */
  fill: { episode: number } | null;
  /** Corrections the shared check made to the couch's games, for episodes you've seen (step 6b). */
  corrections: Correction[];
}

/** An episode's stage across these games: early if any of them only has its early results. */
function stageAcross(states: LeagueState[], n: number): "early" | "final" | null {
  let stage: "early" | "final" | null = null;
  for (const s of states) {
    const st = StateLogic.resultsStage(s.episodes.find((e) => e.number === n));
    if (st === "early") return "early";
    if (st) stage = "final";
  }
  return stage;
}

/** The last episode with results in any of these games. */
const latestIn = (states: LeagueState[]) => Math.max(0, ...states.map((s) => StateLogic.SpoilerLogic.latestWithResults(s)));

/** The episodes you may be told about, merged across your games here (or, playing none, the season's own results). */
export async function seasonEpisodes(user: SessionUser, seasonId: string, couchId: string | null): Promise<SeasonEpisodes> {
  const [{ seen, here }, schedules, follow] = await Promise.all([
    gamesHere(user, seasonId, couchId),
    seasonSchedules([seasonId]),
    pool.query("SELECT early_seen FROM show_follows WHERE user_id = $1 AND season_id = $2", [user.id, seasonId]),
  ]);
  const schedule = schedules.get(seasonId);
  const airAt = (n: number) => schedule?.episodes.find((e) => e.number === n)?.airAt ?? null;
  const now = Date.now();
  const finished = (n: number) => {
    const ep = schedule?.episodes.find((e) => e.number === n);
    return !!ep?.airAt && Date.parse(ep.airAt) + (ep.runtimeMin ?? DEFAULT_RUNTIME_MIN) * 60_000 <= now;
  };
  const mark = seen === EVERYTHING ? Number.POSITIVE_INFINITY : seen;
  const states = here.map((h) => h.state);

  // What you've seen: each episode once, its people and recap from the first game that has them (a Weekly Lineup's
  // for the scorers), every game's line.
  const seenRows = new Map<number, EpisodeSeen>();
  const order = [...here].sort((a, b) => Number(b.game.gameType === "active-roster") - Number(a.game.gameType === "active-roster"));
  for (const h of order) {
    for (const ep of episodesSeen(h.ref, h.state, h.playerId, h.mark)) {
      const had = seenRows.get(ep.number);
      if (!had) seenRows.set(ep.number, ep);
      else {
        had.lines.push(...ep.lines);
        if (ep.stage === "early") had.stage = "early";
      }
    }
  }
  // Each game's lines in the couch's order, whichever game was read first.
  const rank = new Map(here.map((h, i) => [h.game.leagueId, i]));
  for (const ep of seenRows.values()) {
    ep.lines.sort((a, b) => (rank.get(a.leagueId) ?? 0) - (rank.get(b.leagueId) ?? 0));
    // Linked games often ask the same prediction: say it once.
    ep.lines = ep.lines.filter((l, i) => l.gameType !== "predictions" || ep.lines.findIndex((x) => x.gameType === l.gameType && x.big === l.big && x.line === l.line) === i);
  }
  if (!here.length) for (const ep of await notPlaying(user, seasonId, couchId, mark)) seenRows.set(ep.number, ep);

  const rows: EpisodeRow[] = [...seenRows.values()].map((ep) => ({ ...ep, airAt: airAt(ep.number), status: "seen" as const }));
  const latest = latestIn(states);
  const hiddenFrom = Number.isFinite(mark) ? mark + 1 : latest + 1;
  for (let n = hiddenFrom; n <= latest; n++) {
    const stage = stageAcross(states, n);
    if (stage && !seenRows.has(n)) rows.push({ number: n, airAt: airAt(n), status: "hidden", stage });
  }
  // The latest episode that's finished airing with no results in any of your games yet.
  const aired = (schedule?.episodes ?? []).filter((e) => finished(e.number)).map((e) => e.number);
  const last = aired.length ? Math.max(...aired) : 0;
  const waiting = here.length && last > latest && !rows.some((r) => r.number === last) ? { episode: last, airAt: airAt(last) } : null;
  if (waiting) rows.push({ number: waiting.episode, airAt: waiting.airAt, status: "waiting", stage: null });
  rows.sort((a, b) => b.number - a.number);

  const firstHidden = rows.filter((r) => r.status === "hidden").sort((a, b) => a.number - b.number)[0];
  const early = follow.rows[0]?.early_seen as number | null | undefined;
  const count = schedule?.episodeCount ?? null;
  const highest = Math.max(0, ...rows.map((r) => r.number), last);
  const view = here[0] ? StateLogic.GhostLogic.viewFor(here[0].state, here[0].playerId, here[0].mark) : null;
  // Whoever runs a game fills results in from Backstage; anyone else gets the quiet ask, once they've seen the episode.
  const runs = here.some((h) => h.game.yourRole === "commissioner" || h.game.yourRole === "admin");
  const earlySeen = rows.filter((r) => r.status === "seen" && r.stage === "early").map((r) => r.number);
  const fill = couchId && here.length && !runs && earlySeen.length && (await couchFillsResults(couchId)) ? { episode: Math.max(...earlySeen) } : null;
  return {
    seenThrough: Number.isFinite(seen) ? seen : null,
    episodes: rows,
    reveal: firstHidden ? { episode: firstHidden.number, stage: firstHidden.stage ?? "final" } : null,
    waiting,
    final: early && early <= mark && stageAcross(states, early) === "final" ? { episode: early } : null,
    stillIn: view ? view.castaways.filter((c) => c.status !== "eliminated").length : null,
    toAir: count === null || highest < count ? { from: highest + 1, to: count } : null,
    fill,
    corrections: couchId && here.length ? await couchCorrections(here.map((h) => h.game.leagueId), mark, user.id) : [],
  };
}

/** Playing nothing here: each episode of the season's results up to your mark, who went home and what happened (the facts
 *  the stats count, season-stats.ts); with no approved cast to apply them to, who went home from the accepted results. */
async function notPlaying(user: SessionUser, seasonId: string, couchId: string | null, mark: number): Promise<EpisodeSeen[]> {
  const seen = seasonEpisodesSeen((await seasonFactsFor(user, seasonId, couchId)).facts);
  return seen.length ? seen : seasonResults(seasonId, mark);
}

/** Who went home each episode up to your mark, from the season's accepted results. */
async function seasonResults(seasonId: string, mark: number): Promise<EpisodeSeen[]> {
  const { rows } = await pool.query(
    `SELECT d.episode_number AS n, COALESCE(d.applied->>'castawayName', d.castaway_name) AS name, COALESCE(d.applied->>'method', d.method) AS method,
            c.photo_url AS photo
       FROM season_decisions d LEFT JOIN season_cast c ON c.season_id = d.season_id AND c.name = COALESCE(d.applied->>'castawayName', d.castaway_name)
      WHERE d.season_id = $1 AND d.status = 'accepted' AND d.kind = 'elimination' AND d.episode_number <= $2
      ORDER BY d.episode_number DESC, d.created_at`,
    [seasonId, Number.isFinite(mark) ? mark : 100000]
  );
  const by = new Map<number, EpisodeSeen>();
  for (const r of rows) {
    const ep: EpisodeSeen = by.get(r.n) ?? { number: r.n, stage: "final", out: [], happened: [], scorers: [], lines: [] };
    ep.out.push({ id: `${r.n}-${r.name}`, name: r.name, photo: publicMediaSrc(r.photo), method: r.method || null, place: null, knocked: true });
    by.set(r.n, ep);
  }
  return [...by.values()];
}

// ---------- the reveal ----------

export interface SeasonReveal {
  episode: number;
  stage: "early" | "final";
  /** Revealed before: watching it again (or, early_seen, its final scores). */
  again: boolean;
  out: OutFace[];
  happened: Happened[];
  lineup: RevealPart["lineup"];
  games: RevealGame[];
  predictions: RevealGame[];
  /** The table that moves on the last beat: Weekly Lineup once final, else Survival Pool's streaks, else Outlast. */
  table: RevealTable | null;
  /** Another episode whose results are in past this one. */
  next: number | null;
}

/** The game whose table moves: Weekly Lineup once its scores are final; else the pool; else Outlast; else whatever. */
function mainTable(parts: RevealPart[]): RevealTable | null {
  const by = (type: string) => parts.find((p) => p.gameType === type);
  const lineup = by("active-roster");
  return (lineup?.stage === "final" ? lineup.table : null) ?? by("pickem")?.table ?? by("classic-draft")?.table ?? lineup?.table ?? null;
}

/**
 * Reveals episode `n` in every game you play on this season, then returns its beats from `couchId`'s games. An
 * episode you've already revealed comes back as it is now (again: true): its final scores, after an early reveal.
 */
export async function revealSeason(user: SessionUser, seasonId: string, couchId: string | null, n: number): Promise<SeasonReveal> {
  // Where you are is yours, not a couch's (show_follows): the reveal moves every league of yours on the season, on
  // any couch. The beats are this couch's games.
  const before = await gamesHere(user, seasonId, null);
  if (!before.here.some((h) => !couchId || h.game.couchId === couchId)) throw new HttpError(404, "You don't play a game on this show");
  const latest = latestIn(before.here.map((h) => h.state));
  if (!Number.isInteger(n) || n < 1 || n > latest) throw new HttpError(400, "Nothing to reveal for that episode yet");
  const again = before.seen !== EVERYTHING && n <= before.seen;
  // Each league once (reveal.ts moves its linked leagues too, and a second call for one of those is a no-op).
  for (const h of before.here) {
    if (h.mark !== null && n > h.mark) {
      try {
        await markRevealed(user, h.game.leagueId, h.playerId, n);
      } catch (e) {
        // A late joiner's league that isn't in step: left at its own week (it reveals one at a time).
        if (!(e instanceof HttpError)) throw e;
      }
    }
  }

  // The beats, from each game as it stands now (at the new mark): only games that have reached episode n.
  const { here } = await gamesHere(user, seasonId, couchId);
  const parts = here.filter((h) => h.mark === null || h.mark >= n).map((h: GameHere) => revealIn(h.ref, h.state, h.playerId, n, h.userOf)).filter((p) => !!p);
  if (!parts.length) throw new HttpError(400, "Nothing to reveal for that episode yet");
  const stage = parts.some((p) => p.stage === "early") ? "early" : "final";
  const states = here.map((h) => h.state);
  // Seen early: the morning update waits for its final scores. Seen final: the one waiting is done if its own
  // final scores are in too (it's this episode, or an earlier one that has since been finished).
  const { rows: was } = await pool.query("SELECT early_seen FROM show_follows WHERE user_id = $1 AND season_id = $2", [user.id, seasonId]);
  const waitingOn = (was[0]?.early_seen as number | null | undefined) ?? null;
  const early = stage === "early" ? n : waitingOn !== null && stageAcross(states, waitingOn) !== "final" ? waitingOn : null;
  if (early !== waitingOn) {
    await pool.query(
      `INSERT INTO show_follows (user_id, season_id, early_seen) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, season_id) DO UPDATE SET early_seen = EXCLUDED.early_seen, updated_at = now()`,
      [user.id, seasonId, early]
    );
  }
  const first = parts.find((p) => p.out.length || p.happened.length) ?? parts[0];
  const nextUp = latestIn(states) > n ? n + 1 : null;
  return {
    episode: n,
    stage,
    again,
    out: first.out,
    happened: first.happened,
    lineup: parts.find((p) => p.lineup)?.lineup ?? null,
    games: parts.map((p) => p.game).filter((g) => !!g),
    predictions: parts.map((p) => p.predictions).filter((g) => !!g),
    table: mainTable(parts),
    next: nextUp && stageAcross(states, nextUp) ? nextUp : null,
  };
}
