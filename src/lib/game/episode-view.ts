import type { Castaway, Episode, LeagueState } from "./types";
import StateLogic from "./state-logic.js";
import { castawayEpisodeStats } from "./active-roster-rows";
import { episodeRecapWins } from "./episode-recap";
import { gameView, type GameCalls, type GameRefIn, type TableRow, type UserOf } from "./game-view";
import { signed } from "./lineup-view";
import { isBetSettled, isKnockedOut, publicMediaSrc } from "./selectors";
import { teamEpisodeBreakdown } from "./team-episode-breakdown";

// The episodes of one season game as the new design shows them (docs/PLAN-new-design.md step 2): each episode
// you've seen with who went home, what happened, the top scorers and your line in the game; and the reveal of one
// episode (its beats: what happened, who went home, your lineup, your other games, the table moving). Built from
// the viewer's own copy at a mark (GhostLogic.viewFor), so it never says anything past what they've revealed:
// the reveal of episode n is the copy at n, against the copy at n - 1. Pure, for the tests; the server merges a
// couch's games on a season (season-episodes.ts).

export interface OutFace {
  id: string;
  name: string;
  photo: string | null;
  method: string | null;
  /** Where they finished: the winner 1st. */
  place: number | null;
  /** Knocked out (not a finalist). */
  knocked: boolean;
}

/** One game's line for an episode: "+6" and who scored it, "Survived", "All safe". */
export interface GameNight {
  leagueId: string;
  gameName: string;
  gameType: string;
  big: string;
  line: string;
  /** Weekly Lineup's points for it, while only the early results are in: "so far". */
  soFar?: boolean;
  /** Your move for it never came in: nobody started, or no pick (the reminder ask's "slipped by", remind.tsx). */
  missed?: boolean;
}

export interface Happened {
  label: string;
  winners: { name: string; colour: string | null }[];
}

export interface Scorer {
  name: string;
  photo: string | null;
  points: number;
}

export interface EpisodeSeen {
  number: number;
  stage: "early" | "final";
  out: OutFace[];
  happened: Happened[];
  /** The episode's best scorers (a game that scores moments); empty otherwise. */
  scorers: Scorer[];
  lines: GameNight[];
}

const first = (name: string) => name.split(" ")[0];

/** "Brady", "Brady and Danny". */
const names = (list: string[]) => (list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`);

/** Who left in this episode, as faces. */
export function outsOf(view: LeagueState, ep: Episode): OutFace[] {
  return view.castaways
    .filter((c) => c.status === "eliminated" && c.exitEpisodeId === ep.id)
    .sort((a, b) => (a.placementOrder ?? 0) - (b.placementOrder ?? 0))
    .map((c) => ({
      id: c.id,
      name: c.name,
      photo: publicMediaSrc(c.photoUrl),
      method: c.exitMethod ?? null,
      place: c.placementOrder ? view.castaways.length - c.placementOrder + 1 : null,
      knocked: isKnockedOut(view, c),
    }));
}

function happenedIn(view: LeagueState, ep: Episode): Happened[] {
  return episodeRecapWins(view, ep).map((w) => ({
    label: w.label,
    winners: [...w.tribes.map((t) => ({ name: t.tribe.name, colour: t.tribe.color })), ...w.castaways.map((c) => ({ name: first(c.name), colour: null }))],
  }));
}

function scorersIn(view: LeagueState, ep: Episode): Scorer[] {
  if (!StateLogic.getLeagueType(view).hasActiveRoster) return [];
  return view.castaways
    .map((c) => ({ name: c.name, photo: publicMediaSrc(c.photoUrl), points: castawayEpisodeStats(view, ep.id, c.id).total }))
    .filter((s) => s.points > 0)
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    .slice(0, 5);
}

/** Your team in an Outlast or Weekly Lineup game, every castaway you've had. */
const teamOf = (view: LeagueState, me: string) => view.castaways.filter((c) => c.ownerIds.includes(me));
const exitNumber = (view: LeagueState, c: Castaway) => view.episodes.find((e) => e.id === c.exitEpisodeId)?.number ?? null;

/** How a Prediction Sheet's night went for you, by episode (answer-points.ts sheetNights): what you answered, how many of those are
 *  settled, how many of those didn't count (off: nobody went home), right, and what they earned. */
export type SheetNights = Map<number, { answered: number; settled: number; off: number; right: number; earned: number }>;

/** Your line in one game for an episode you've seen (a copy at or past it). `sheet`: a Prediction Sheet's nights. */
export function nightIn(game: GameRefIn, view: LeagueState, me: string, ep: Episode, sheet?: SheetNights): GameNight {
  const base = { leagueId: game.leagueId, gameName: game.gameName, gameType: game.gameType };
  if (!StateLogic.inPlay(view, ep.number)) {
    // A game waiting for its phase (step A3) hasn't started either.
    const start = StateLogic.startEpisode(view);
    return { ...base, big: "—", line: start === null || ep.number < start ? "Before the game started" : "After the game ended" };
  }
  const type = StateLogic.getLeagueType(view);
  if (type.hasQuestions) {
    // A Prediction Sheet (step A4 part 2): its answers aren't in the state, so the server says how the night went (sheet).
    // A sheet that asks only for the season (who wins) has nothing for an episode: that isn't a miss.
    if (!StateLogic.AnswerLogic.questions(view).some((q: { asked: string }) => q.asked !== "once")) return { ...base, big: "—", line: "Its questions are for the season" };
    // Its answers couldn't be read: say nothing rather than call it a miss.
    if (!sheet) return { ...base, big: "—", line: "See how your sheet went" };
    const n = sheet.get(ep.number);
    if (!n || !n.answered) return { ...base, big: "No sheet", line: "You didn't answer this one", missed: true };
    if (!n.settled) return { ...base, big: "Waiting", line: `${n.answered} ${n.answered === 1 ? "answer" : "answers"} still to settle` };
    const counted = n.settled - n.off;
    const off = n.off ? `${n.off} didn't count` : "";
    return { ...base, big: `${signed(n.earned)} ${Math.abs(n.earned) === 1 ? "pt" : "pts"}`, line: counted ? `${n.right} of ${counted} right${off ? ` · ${off}` : ""}` : `It didn't count${n.off > 1 ? ` (${n.off})` : ""}` };
  }
  if (type.hasActiveRoster) {
    const b = teamEpisodeBreakdown(view, ep.id, me);
    const soFar = StateLogic.resultsStage(ep) === "early";
    const who = b.started.map((s) => `${first(s.c.name)} ${signed(s.points)}`).join(" · ");
    return { ...base, big: `${signed(b.total)}${soFar ? " so far" : ""}`, line: who || "Nobody started", soFar, ...(who ? {} : { missed: true }) };
  }
  if (type.hasWeeklyPicks) {
    const row = StateLogic.pickEmHistory(view, me).rows.find((r) => r.episode === ep.number);
    const c = row?.castawayId ? StateLogic.getCastaway(view, row.castawayId) : null;
    if (!row || row.correct === null) return { ...base, big: "Waiting", line: c ? `You picked ${first(c.name)}` : "No pick yet" };
    if (!c) return { ...base, big: "No pick", line: "Streak reset", missed: true };
    return row.correct
      ? { ...base, big: "Survived", line: `You picked ${first(c.name)} · streak ${row.streak}` }
      : { ...base, big: "Went home", line: `You picked ${first(c.name)} · streak reset` };
  }
  const team = teamOf(view, me);
  const lost = team.filter((c) => exitNumber(view, c) === ep.number && isKnockedOut(view, c));
  const still = team.filter((c) => c.status !== "eliminated" || (exitNumber(view, c) ?? 0) > ep.number).length;
  return { ...base, big: lost.length ? `Lost ${names(lost.map((c) => first(c.name)))}` : "All safe", line: `${still} of ${team.length} still in after this episode` };
}

/** Your predictions on an episode, once graded: "1 of 2 · +2". Null when you made none that are graded. */
function predictionsIn(game: GameRefIn, view: LeagueState, me: string, ep: Episode): GameNight | null {
  if (!StateLogic.betsOn(view)) return null;
  const mine = (ep.bets || [])
    .filter((b) => isBetSettled(b))
    .map((b) => ({ bet: b, guess: (b.predictions || []).find((p) => p.playerId === me) }))
    .filter((x) => x.guess);
  if (!mine.length) return null;
  // A right guess pays only when someone else answered too (classic-view.ts predictionsRight).
  const right = mine.filter((x) => x.guess!.correct === true);
  const paid = right.filter((x) => (x.bet.predictions || []).length >= 2).reduce((n, x) => n + (x.bet.points || 0), 0);
  return {
    leagueId: game.leagueId,
    gameName: "Predictions",
    gameType: "predictions",
    big: `${right.length} of ${mine.length}${paid ? ` · +${paid}` : ""}`,
    line: right.length ? `You called "${right[0].bet.label}"` : "None right this time",
  };
}

/** Every episode with results in your copy at `seen`, newest first. */
export function episodesSeen(game: GameRefIn, full: LeagueState, me: string, seen: number | null, sheet?: SheetNights): EpisodeSeen[] {
  const view = StateLogic.GhostLogic.viewFor(full, me, seen);
  return [...view.episodes]
    .filter((ep) => !ep.resultsHidden && StateLogic.episodeHasResults(ep))
    .sort((a, b) => b.number - a.number)
    .map((ep) => {
      const calls = predictionsIn(game, view, me, ep);
      return {
        number: ep.number,
        stage: StateLogic.resultsStage(ep) ?? "final",
        out: outsOf(view, ep),
        happened: happenedIn(view, ep),
        scorers: scorersIn(view, ep),
        lines: [nightIn(game, view, me, ep, sheet), ...(calls ? [calls] : [])],
      };
    });
}

/** A show you don't play: each episode of the season's results (cast-stats.ts seasonFacts, built up to where you are),
 *  who went home and what happened, with no game's lines or scorers. */
export function seasonEpisodesSeen(facts: LeagueState): EpisodeSeen[] {
  return [...facts.episodes]
    .filter((ep) => StateLogic.episodeHasResults(ep))
    .sort((a, b) => b.number - a.number)
    .map((ep) => ({ number: ep.number, stage: StateLogic.resultsStage(ep) ?? "final", out: outsOf(facts, ep), happened: happenedIn(facts, ep), scorers: [], lines: [] }));
}

// ---------- the reveal ----------

export interface RevealStarter {
  name: string;
  photo: string | null;
  points: number;
  /** What they did: "Individual immunity win · Found an idol". */
  why: string;
}

export interface RevealGame {
  leagueId: string;
  gameName: string;
  gameType: string;
  title: string;
  line: string;
  /** Survival Pool: the streak before and after. */
  streak?: { from: number; to: number };
}

export interface RevealTable {
  leagueId: string;
  gameName: string;
  rows: { playerId: string; userId: string | null; name: string; you: boolean; before: { place: number; rank: string; total: number }; after: { place: number; rank: string; total: number } }[];
}

export interface RevealPart {
  leagueId: string;
  gameType: string;
  stage: "early" | "final";
  out: OutFace[];
  happened: Happened[];
  /** Weekly Lineup: your starters and what they scored. */
  lineup: { gameName: string; starters: RevealStarter[]; total: number; soFar: boolean } | null;
  game: RevealGame | null;
  predictions: RevealGame | null;
  table: RevealTable;
}

/**
 * One game's part of the reveal of episode `n`: the copy at n against the copy at n - 1. Null when the game has
 * nothing for that episode (no results in it yet, or it's past what the game shows this viewer).
 */
/** A Prediction Sheet's reveal (step A4 part 2): its points at the marks before and after (answer-points.ts leagueAnswers), and the
 *  night's answers (sheetNights), which its state doesn't hold. */
export interface RevealSheet {
  was: GameCalls | null;
  now: GameCalls | null;
  nights: SheetNights;
}

export function revealIn(game: GameRefIn, full: LeagueState, me: string, n: number, userOf: UserOf, sheet?: RevealSheet): RevealPart | null {
  const after = StateLogic.GhostLogic.viewFor(full, me, n);
  const ep = after.episodes.find((e) => e.number === n && !e.resultsHidden);
  if (!ep || !StateLogic.episodeHasResults(ep)) return null;
  const type = StateLogic.getLeagueType(after);
  const stage = StateLogic.resultsStage(ep) ?? "final";

  let lineup: RevealPart["lineup"] = null;
  if (type.hasActiveRoster && StateLogic.inPlay(after, n)) {
    const b = teamEpisodeBreakdown(after, ep.id, me);
    lineup = {
      gameName: game.gameName,
      starters: b.started.map((s) => ({ name: s.c.name, photo: publicMediaSrc(s.c.photoUrl), points: s.points, why: s.items.map((i) => i.label).join(" · ") })),
      total: b.total,
      soFar: stage === "early",
    };
  }

  let part: RevealGame | null = null;
  const base = { leagueId: game.leagueId, gameName: game.gameName, gameType: game.gameType };
  if (type.hasQuestions && sheet && StateLogic.inPlay(after, n)) {
    const night = nightIn(game, after, me, ep, sheet?.nights);
    part = { ...base, title: night.big === "No sheet" ? "No sheet from you" : night.big === "Waiting" ? "Your sheet waits" : `${night.big} on your sheet`, line: night.line };
  }
  if (type.hasWeeklyPicks && StateLogic.inPlay(after, n)) {
    const rows = StateLogic.pickEmHistory(after, me).rows;
    const row = rows.find((r) => r.episode === n);
    const before = rows.filter((r) => r.episode < n && r.correct !== null).slice(-1)[0]?.streak ?? 0;
    const c = row?.castawayId ? StateLogic.getCastaway(after, row.castawayId) : null;
    if (row && row.correct !== null) {
      part = {
        ...base,
        title: !c ? "No pick" : row.correct ? `${first(c.name)} survived` : `${first(c.name)} went home`,
        line: row.correct ? `${row.streak} in a row` : before ? `Your streak ended at ${before}` : "Your streak starts again",
        streak: { from: before, to: row.streak },
      };
    }
  } else if (type.hasRoster && !type.hasActiveRoster) {
    const team = teamOf(after, me);
    const lost = team.filter((c) => exitNumber(after, c) === n && isKnockedOut(after, c));
    const others = after.players
      .filter((p) => p.id !== me && !p.ghost && p.active !== false)
      .map((p) => ({ p, gone: after.castaways.filter((c) => c.ownerIds.includes(p.id) && exitNumber(after, c) === n && isKnockedOut(after, c)) }))
      .filter((x) => x.gone.length);
    const still = team.filter((c) => c.status !== "eliminated").length;
    part = {
      ...base,
      title: lost.length ? `You lost ${names(lost.map((c) => first(c.name)))}` : still === team.length ? `All ${team.length} still in` : `${still} of ${team.length} still in`,
      line: others.length ? others.map((x) => `${x.p.name} lost ${names(x.gone.map((c) => first(c.name)))}`).join(" · ") : "Nobody else lost anyone",
    };
  }

  const calls = predictionsIn(game, after, me, ep);
  const predictions: RevealGame | null = calls ? { ...base, gameName: "Predictions", gameType: "predictions", title: calls.big.replace(/^(\d+) of (\d+)/, "$1 of $2 right"), line: calls.line } : null;

  const was = gameView(game, full, me, n - 1, userOf, sheet?.was ?? undefined).table;
  const now = gameView(game, full, me, n, userOf, sheet?.now ?? undefined).table;
  const at = (rows: TableRow[], id: string) => rows.find((r) => r.playerId === id);
  const table: RevealTable = {
    leagueId: game.leagueId,
    gameName: game.gameName,
    rows: now.map((r) => {
      const b = at(was, r.playerId) ?? r;
      return { playerId: r.playerId, userId: r.userId, name: r.name, you: r.you, before: { place: b.place, rank: b.rank, total: b.total }, after: { place: r.place, rank: r.rank, total: r.total } };
    }),
  };

  return { leagueId: game.leagueId, gameType: game.gameType, stage, out: outsOf(after, ep), happened: happenedIn(after, ep), lineup, game: part, predictions, table };
}
