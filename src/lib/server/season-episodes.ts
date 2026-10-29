import StateLogic from "@/lib/game/state-logic.js";
import { episodesSeen, revealIn, seasonEpisodesSeen, type EpisodeSeen, type Happened, type OutFace, type RevealGame, type RevealPart, type RevealTable } from "@/lib/game/episode-view";
import { publicMediaSrc } from "@/lib/game/selectors";
import { latestIn, resultsDue, stageAcross } from "@/lib/game/results-due";
import type { SessionUser } from "./auth-helpers";
import { couchFillsResults } from "./community-results";
import { pool, HttpError } from "./db";
import { EVERYTHING } from "./guard";
import { markRevealed } from "./reveal";
import { seasonVerdicts, type EpisodeVerdictLine } from "./ratings";
import { couchCorrections, type Correction } from "./rulings";
import { DEFAULT_RUNTIME_MIN, seasonSchedules } from "./schedule";
import type { ReadOnly } from "./read-only";
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
// so when its final scores land the show space says so once (the morning update), with nothing new to spoil; and
// early_night (step 8) keeps what your Weekly Lineup stood at, so the morning update shows so far → final.
//
// Spoiler-safe through guard.ts: everything is read from your own copy of each league at your mark (game-view.ts,
// episode-view.ts). A hidden episode says only that its results are in, and at which stage.

export type EpisodeStatus = "seen" | "hidden" | "waiting" | "aired";

export interface EpisodeRow extends Partial<Omit<EpisodeSeen, "number" | "stage">> {
  number: number;
  airAt: string | null;
  /** aired (step 10): a show you only watch, an episode that's aired with no results to show; `watched` says whether
   *  you've seen it (by where you are). */
  status: EpisodeStatus;
  stage: "early" | "final" | null;
  watched?: boolean;
  /** Its title from the listings, once you've seen it (a title can give an episode away). */
  title?: string | null;
  /** What happened (Fill in what happened: episode-recaps.ts, 0143), once you've seen it. */
  summary?: string | null;
  /** Rate it (step 12 part 1): the couch's verdict and your stars, on an episode you've seen (ratings.ts seasonVerdicts; the
   *  couch's people who share the show, or everyone on Game Your Show's with nobody else on the couch). */
  verdict?: EpisodeVerdictLine;
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

/** A game you joined late and are still catching up in (StateLogic.GhostLogic). */
const catchingUpIn = (h: GameHere) => StateLogic.GhostLogic.isCatchingUp(h.state, h.playerId);

/** The episodes you may be told about, merged across your games here (or, playing none, the season's own results). `ro`:
 *  told from the game open read-only (read-only.ts), as its couch has it: nobody's own line, and no Fill it in. */
export async function seasonEpisodes(user: SessionUser, seasonId: string, couchId: string | null, ro: ReadOnly | null = null): Promise<SeasonEpisodes> {
  const [{ seen, here: all }, schedules, follow, recapRows] = await Promise.all([
    gamesHere(user, seasonId, couchId, ro),
    seasonSchedules([seasonId]),
    pool.query("SELECT early_seen FROM show_follows WHERE user_id = $1 AND season_id = $2", [user.id, seasonId]),
    pool.query("SELECT number, summary FROM season_episodes WHERE season_id = $1 AND summary IS NOT NULL", [seasonId]),
  ]);
  const recaps = new Map(recapRows.rows.map((r) => [r.number as number, r.summary as string]));
  // A game scored from calls or bingo cards (Weekly Calls, Weekly Bingo: step 12) has no results of its own: its show's episodes
  // list as a show you only watch does, every one that's aired.
  const here = all.filter((h) => !StateLogic.getLeagueType(h.state).hasCalls && !StateLogic.getLeagueType(h.state).hasBingo);
  const schedule = schedules.get(seasonId);
  const airAt = (n: number) => schedule?.episodes.find((e) => e.number === n)?.airAt ?? null;
  const now = Date.now();
  const finished = (n: number) => {
    const ep = schedule?.episodes.find((e) => e.number === n);
    return !!ep?.airAt && Date.parse(ep.airAt) + (ep.runtimeMin ?? DEFAULT_RUNTIME_MIN) * 60_000 <= now;
  };
  const mark = seen === EVERYTHING ? Number.POSITIVE_INFINITY : seen;
  // A game you're catching up in (step 9) reveals one episode at a time from its own strip on Tonight (catchUpReveal),
  // so what's hidden and the reveal are the other games'.
  const states = here.filter((h) => !catchingUpIn(h)).map((h) => h.state);

  // What you've seen: each episode once, its people and recap from the first game that has them (a Weekly Lineup's
  // for the scorers), every game's line.
  const seenRows = new Map<number, EpisodeSeen>();
  const order = [...here].sort((a, b) => Number(b.game.gameType === "active-roster") - Number(a.game.gameType === "active-roster"));
  for (const h of order) {
    for (const ep of episodesSeen(h.ref, h.state, h.readOnly ? null : h.playerId, h.mark)) {
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
  // A show you only watch (step 10): every episode that's aired is listed, with results or not, seen by you or not yet.
  if (!here.length) {
    for (const e of schedule?.episodes ?? []) {
      if (finished(e.number) && !seenRows.has(e.number)) {
        const watched = e.number <= mark;
        rows.push({ number: e.number, airAt: e.airAt, status: "aired", stage: null, watched, title: watched ? e.title : null, summary: watched ? (recaps.get(e.number) ?? null) : null });
      }
    }
  }
  const latest = latestIn(states);
  const hiddenFrom = Number.isFinite(mark) ? mark + 1 : latest + 1;
  for (let n = hiddenFrom; n <= latest; n++) {
    const stage = stageAcross(states, n);
    if (stage && !seenRows.has(n)) rows.push({ number: n, airAt: airAt(n), status: "hidden", stage });
  }
  // The latest episode that's finished airing with no results in any of your games yet.
  const aired = (schedule?.episodes ?? []).filter((e) => finished(e.number)).map((e) => e.number);
  const last = aired.length ? Math.max(...aired) : 0;
  const waiting = here.length && last > latestIn(here.map((h) => h.state)) && !rows.some((r) => r.number === last) ? { episode: last, airAt: airAt(last) } : null;
  if (waiting) rows.push({ number: waiting.episode, airAt: waiting.airAt, status: "waiting", stage: null });
  rows.sort((a, b) => b.number - a.number);

  const due = resultsDue(states, mark, follow.rows[0]?.early_seen as number | null | undefined);
  const count = schedule?.episodeCount ?? null;
  const highest = Math.max(0, ...rows.map((r) => r.number), last);
  const view = here[0] ? StateLogic.GhostLogic.viewFor(here[0].state, here[0].playerId, here[0].mark) : null;
  // Whoever runs a game fills results in from Backstage; anyone else gets the quiet ask, once they've seen the episode.
  const runs = here.some((h) => h.game.yourRole === "commissioner" || h.game.yourRole === "admin");
  const earlySeen = rows.filter((r) => r.status === "seen" && r.stage === "early").map((r) => r.number);
  const fill = couchId && here.length && !runs && !ro && earlySeen.length && (await couchFillsResults(couchId)) ? { episode: Math.max(...earlySeen) } : null;
  // Each episode you've seen with its verdict (only through your mark: seasonVerdicts reads nothing past it).
  const verdicts = await seasonVerdicts(user.id, seasonId, couchId, mark);
  for (const r of rows) if (r.status === "seen" || (r.status === "aired" && r.watched)) r.verdict = verdicts.get(r.number) ?? { avg: null, n: 0, mine: null };
  return {
    seenThrough: Number.isFinite(seen) ? seen : null,
    episodes: rows,
    reveal: due.reveal,
    waiting,
    final: due.final,
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
  /** The morning update: your Weekly Lineup as it stood when you revealed this episode early (show_follows.early_night),
   *  now that its final scores are in. `table`'s before is then that early table. */
  soFar: EarlyNight | null;
}

/** Your first Weekly Lineup's night at an early reveal (show_follows.early_night, migration 0118), kept until its final
 *  scores are seen so the morning update can say what changed: so far +14, final +22. */
export interface EarlyNight {
  leagueId: string;
  total: number;
  starters: { name: string; points: number }[];
  table: { playerId: string; place: number; rank: string; total: number }[];
}

function earlyNight(parts: RevealPart[]): EarlyNight | null {
  const p = parts.find((x) => x.lineup);
  if (!p?.lineup) return null;
  return {
    leagueId: p.leagueId,
    total: p.lineup.total,
    starters: p.lineup.starters.map((s) => ({ name: s.name, points: s.points })),
    table: p.table.rows.map((r) => ({ playerId: r.playerId, place: r.after.place, rank: r.after.rank, total: r.after.total })),
  };
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
  // The early night goes with it: your Weekly Lineup as it stood, for the morning update's "so far → final".
  const { rows: was } = await pool.query("SELECT early_seen, early_night FROM show_follows WHERE user_id = $1 AND season_id = $2", [user.id, seasonId]);
  const waitingOn = (was[0]?.early_seen as number | null | undefined) ?? null;
  const kept = (was[0]?.early_night as EarlyNight | null | undefined) ?? null;
  const early = stage === "early" ? n : waitingOn !== null && stageAcross(states, waitingOn) !== "final" ? waitingOn : null;
  if (early !== waitingOn || stage === "early") {
    const night = stage === "early" ? earlyNight(parts) : early === waitingOn ? kept : null;
    await pool.query(
      `INSERT INTO show_follows (user_id, season_id, early_seen, early_night) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, season_id) DO UPDATE SET early_seen = EXCLUDED.early_seen, early_night = EXCLUDED.early_night, updated_at = now()`,
      [user.id, seasonId, early, night ? JSON.stringify(night) : null]
    );
  }
  // The final scores of the episode you revealed early: the table moves from where it stood that night.
  const soFar = again && stage === "final" && waitingOn === n ? kept : null;
  let table = mainTable(parts);
  if (soFar && table?.leagueId === soFar.leagueId) {
    const then = new Map(soFar.table.map((r) => [r.playerId, r]));
    table = { ...table, rows: table.rows.map((r) => ({ ...r, before: then.get(r.playerId) ?? r.before })) };
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
    table,
    next: nextUp && stageAcross(states, nextUp) ? nextUp : null,
    soFar,
  };
}

export interface CatchUpReveal {
  episode: number;
  leagueId: string;
  out: OutFace[];
  game: RevealGame | null;
  lineup: RevealPart["lineup"];
  /** The next episode to catch up on, or null: caught up, playing live from here. */
  next: number | null;
}

/**
 * Catching up (step 9, the mock's catchupStep): reveal the next episode of your own season in one game you joined late,
 * once you've made your move for it, and its beats in that game. One episode at a time (reveal.ts holds that line).
 */
export async function catchUpReveal(user: SessionUser, seasonId: string, couchId: string | null, leagueId: unknown): Promise<CatchUpReveal> {
  const { here } = await gamesHere(user, seasonId, couchId);
  const h = here.find((x) => x.game.leagueId === leagueId);
  if (!h) throw new HttpError(404, "You don't play that game here");
  const late = StateLogic.GhostLogic.lateJoinOf(h.state, h.playerId);
  if (!late?.catchingUp) throw new HttpError(409, "You're caught up");
  const { rows } = await pool.query("SELECT results_seen_through FROM league_memberships WHERE league_id = $1 AND user_id = $2", [h.game.leagueId, user.id]);
  const n = ((rows[0]?.results_seen_through as number | null) ?? (late.startEpisode ?? 1) - 1) + 1;
  await markRevealed(user, h.game.leagueId, h.playerId, n);
  const after = (await gamesHere(user, seasonId, couchId)).here.find((x) => x.game.leagueId === h.game.leagueId);
  if (!after) throw new HttpError(404, "You don't play that game here");
  const part = revealIn(after.ref, after.state, after.playerId, n, after.userOf);
  const still = StateLogic.GhostLogic.isCatchingUp(after.state, after.playerId);
  return { episode: n, leagueId: h.game.leagueId, out: part?.out ?? [], game: part?.game ?? null, lineup: part?.lineup ?? null, next: still ? n + 1 : null };
}
