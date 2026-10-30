import type { LeagueState, WaiverPair, WaiverPeriod, WaiverResult } from "./types";
import StateLogic from "./state-logic.js";
import { castawayEventStats } from "./active-roster-rows";
import { castOf, type CastFace, type GameRefIn, type UserOf } from "./game-view";
import { ruleAnswers } from "@/components/waivers/waivers-words";

// Simple waivers as one player reads them (docs/PLAN-new-design.md step 6a; the mock's waivers.js, "simple"): the week
// that's running in one of your games, who of yours to replace and how many optional swaps you have, your whole team,
// who's free, your own claim (one spot at a time), the picking order, and the last run in picking order. Built from your
// copy of the league at your mark (GhostLogic.viewFor), so a week opened by an episode you haven't revealed is only
// "reveal Episode N first", and nothing in it says who left. Your claim is passed in: it's private
// (src/lib/server/waivers.js), read for you alone. Pure, for the tests.

export interface WaiverFace {
  id: string;
  name: string;
  photo: string | null;
  group: { name: string; colour: string } | null;
  /** Points as this game counts them. */
  points: number;
  /** The episode they left in, when out. */
  out: number | null;
  /** One quiet positive thing they've done, by the rulebook's words ("Individual immunity win ×2"). */
  tag: string | null;
}

export interface WaiverMove {
  playerId: string;
  userId: string | null;
  name: string;
  you: boolean;
  /** replace: who comes in for someone out; swap: for someone still in. */
  kind: "replace" | "swap";
  add: WaiverFace | null;
  drop: WaiverFace | null;
  outcome: WaiverResult["outcome"];
  /** Which choice it was, 1-based (exclusive leagues only say it when it wasn't the first). */
  choice: number | null;
  /** "2nd choice: jordan got Sharonda first." / "No pick in, so the most points left came in." */
  why: string;
}

export interface WaiverRunView {
  periodId: string;
  /** The episode whose results opened the week. */
  episode: number;
  at: string;
  /** In picking order: who got whom, and why. */
  moves: WaiverMove[];
  /** Free agency's moves since, newest last. */
  freeAgency: WaiverMove[];
}

export interface WaiverWeek extends GameRefIn {
  playerId: string;
  /** Shared ownership: anyone can have the same castaway, so no order and no backups. */
  shared: boolean;
  /** The week's episode isn't revealed yet: reveal it first (nothing here says who left). */
  revealFirst: number | null;
  /** none: no week running; open: picks in until `due`; processed: free agency until `until`. */
  stage: "none" | "open" | "processed";
  period: { id: string; episode: number; window: boolean; swaps: number; due: string | null; until: string | null } | null;
  /** Who of yours to replace this week (the oldest first), and anyone else out a pick may name. */
  replace: string[];
  outIds: string[];
  swapsAllowed: number;
  swapsLeft: number;
  /** Your team: still in first, then who's out. */
  team: WaiverFace[];
  /** Who you may pick: free agents (shared: anyone still in who isn't yours), most points first. */
  free: WaiverFace[];
  /** Your own pick for each spot, first choice first: replacements (oldest loss first), then swaps. */
  spots: { dropId: string; addIds: string[] }[];
  /** Picking order, first pick first (exclusive leagues). */
  order: { playerId: string; userId: string | null; name: string; you: boolean; points: number }[];
  orderBy: "leastPoints" | "rolling" | "mostPoints";
  /** Forget to pick, and the most points left comes in (else the spot stays empty). */
  fallback: boolean;
  /** Free agency after a run, first come, first served. */
  freeAgency: boolean;
  /** The last run you may see. */
  run: WaiverRunView | null;
  /** How it works here: the three answers and When moves happen. */
  how: { out: string; swap: string; order: string; lanes: { episodes: number[]; now: number; replace: boolean[]; swap: boolean[] } };
}

/** A castaway's points and tag by name, counted from the season's facts (the Cast tab's numbers), when the server has them. */
export type FactsOf = (name: string) => { points: number; tag: string | null } | null;

/** FactsOf over a facts state (season-stats.ts seasonFactsFor): points and the best positive moment, as the Cast tab counts them. */
export function factsOf(facts: LeagueState): FactsOf {
  const byName = new Map(facts.castaways.map((c) => [c.name, c.id]));
  const memo = new Map<string, { points: number; tag: string | null }>();
  return (name) => {
    const id = byName.get(name);
    if (!id) return null;
    if (!memo.has(name)) memo.set(name, { points: castawayEventStats(facts, id).total, tag: tagOf(facts, id) });
    return memo.get(name)!;
  };
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

/** One quiet positive tag: the moment that's earned them the most, in the rulebook's words. */
function tagOf(view: LeagueState, castawayId: string): string | null {
  const best = castawayEventStats(view, castawayId)
    .byType.filter((s) => s.points > 0)
    .sort((a, b) => b.points * b.count - a.points * a.count)[0];
  return best ? `${best.label}${best.count > 1 ? ` ×${best.count}` : ""}` : null;
}

function faceOf(view: LeagueState, c: CastFace | undefined, scored: FactsOf | null): WaiverFace | null {
  if (!c) return null;
  const f = scored?.(c.name);
  return { id: c.id, name: c.name, photo: c.photo, group: c.tribe, points: f?.points ?? c.points ?? 0, out: c.out, tag: c.left ? null : f ? f.tag : tagOf(view, c.id) };
}

/** A run's results as moves, in picking order. */
function movesOf(view: LeagueState, results: WaiverResult[], me: string, faces: Map<string, CastFace>, userOf: UserOf, scored: FactsOf | null): WaiverMove[] {
  const shared = view.settings.ownershipMode === "shared";
  const name = (id: string | undefined | null) => (id ? (faces.get(id)?.name ?? "someone") : "someone");
  const who = (id: string | undefined) => (id === me ? "you" : (view.players.find((p) => p.id === id)?.name ?? "someone"));
  return results
    .filter((r) => r.outcome === "got" || r.kind === "pickup")
    .map((r) => {
      const player = view.players.find((p) => p.id === r.playerId);
      const pass = r.passed[0];
      const lost = pass
        ? pass.reason === "ahead"
          ? `${who(pass.byPlayerId)} got ${name(pass.castawayId)} first`
          : pass.reason === "cap"
            ? `${name(pass.castawayId)} would have taken the team past the cap`
            : pass.reason === "cash"
              ? `${name(pass.castawayId)} cost more than the cash on hand`
              : `${name(pass.castawayId)} was already gone`
        : "";
      const choice = r.choice ?? 1;
      let why: string;
      if (r.outcome === "noClaim") why = "No pick in";
      else if (r.outcome === "got") why = shared || choice === 1 ? "1st choice" : `${ordinal(choice)} choice: ${lost}`.replace(/: $/, "");
      else why = lost ? `${lost}, so the spot's still open` : "Nobody on the list was free";
      return {
        playerId: r.playerId,
        userId: userOf(r.playerId),
        name: player?.name ?? "someone",
        you: r.playerId === me,
        kind: r.kind === "pickup" ? "replace" : "swap",
        add: faceOf(view, r.castawayId ? faces.get(r.castawayId) : undefined, scored),
        drop: faceOf(view, r.droppedCastawayId ? faces.get(r.droppedCastawayId) : undefined, scored),
        outcome: r.outcome,
        choice: r.outcome === "got" ? choice : null,
        why,
      } satisfies WaiverMove;
    });
}

/** How waivers work in this game, as players read it: the three answers and When moves happen (Backstage's What players see too). */
export function waiverHow(view: LeagueState): WaiverWeek["how"] {
  const answers = ruleAnswers(view);
  const by = view.settings.replenishOrderBy || "rolling";
  const shared = view.settings.ownershipMode === "shared";
  return {
    out: answers.out,
    swap: answers.swap,
    // Simple waivers' words for the standings orders; rolling keeps classic's.
    order: shared ? answers.order : by === "leastPoints" ? "Lowest score picks first." : by === "mostPoints" ? "Highest score picks first." : answers.order,
    lanes: lanesOf(view, Math.max(0, StateLogic.SpoilerLogic.latestWithResults(view))),
  };
}

/** The lanes of When moves happen: a few episodes either side of now, which ones open replacements and swaps. */
function lanesOf(view: LeagueState, now: number) {
  const W = StateLogic.WaiverLogic;
  const rule = W.replaceRule(view);
  const swaps = W.windows(view).swaps > 0;
  const total = Math.max(13, ...view.episodes.map((e) => e.number));
  const first = Math.max(1, now - 2);
  const episodes = Array.from({ length: 10 }, (_, i) => first + i).filter((n) => n < total);
  const window = (n: number) => W.isWindowEpisode(view, n);
  return {
    episodes,
    now,
    replace: episodes.map((n) => rule !== "never" && (W.weekly(view) || window(n))),
    swap: episodes.map((n) => swaps && window(n)),
  };
}

/**
 * Your waiver week in one game, or null when the game has no waivers. `full`: the league's state (its waiver clock run);
 * `seen`: your mark (null: everything); `pairs`: your own claim for the week running, read for you alone; `scored`: points and
 * tags from the season's facts (else the game's own, which Outlast doesn't count by moments).
 */
export function waiverWeek(game: GameRefIn, full: LeagueState, playerId: string, seen: number | null, userOf: UserOf, pairs: WaiverPair[] | null, scored: FactsOf | null = null): WaiverWeek | null {
  const W = StateLogic.WaiverLogic;
  if (!W.supported(full)) return null;
  const view = StateLogic.GhostLogic.viewFor(full, playerId, seen);
  const current = W.current(view);
  if (!W.enabled(view) && !current) return null;
  const faces = new Map(castOf(view).map((c) => [c.id, c]));
  const shared = view.settings.ownershipMode === "shared";
  const inRotation = W.rotation(view).includes(playerId);
  const hidden = !!current?.hidden;
  const live = !!current && !hidden && inRotation;
  const stage: WaiverWeek["stage"] = !current || hidden ? "none" : current.phase === "open" ? "open" : "processed";
  const owed = live ? W.replacementsOwed(view, playerId, current) : { count: 0, lossIds: [] as string[], outIds: [] as string[] };
  const mine = view.castaways.filter((c) => c.ownerIds.includes(playerId));
  const team = [...mine.filter((c) => c.status !== "eliminated"), ...mine.filter((c) => c.status === "eliminated")]
    .map((c) => faceOf(view, faces.get(c.id), scored))
    .filter((f): f is WaiverFace => !!f);
  const free = live
    ? StateLogic.availableFor(view, playerId)
        .map((c) => faceOf(view, faces.get(c.id), scored))
        .filter((f): f is WaiverFace => !!f)
        .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    : [];
  const grouped = live && stage === "open" && pairs?.length ? W.groupPairs(view, current, playerId, pairs) : [];
  const spots: WaiverWeek["spots"] = [];
  for (const p of grouped) {
    const spot = spots.find((s) => s.dropId === p.dropId);
    if (spot) spot.addIds.push(p.addId);
    else spots.push({ dropId: p.dropId, addIds: [p.addId] });
  }
  const scores = StateLogic.computeScores(view);
  const pointsOf = (id: string) => scores.find((r) => r.playerId === id)?.total ?? 0;
  const order = shared
    ? []
    : StateLogic.MidSeasonLogic.order(view, W.rotation(view)).map((id) => ({
        playerId: id,
        userId: userOf(id),
        name: view.players.find((p) => p.id === id)?.name ?? "someone",
        you: id === playerId,
        points: pointsOf(id),
      }));
  // The last run you may see, and free agency's moves in that week since.
  const ran = W.periods(view).filter((p: WaiverPeriod) => p.run && !p.hidden);
  const last = ran[ran.length - 1];
  const run: WaiverRunView | null = last?.run
    ? {
        periodId: last.id,
        episode: last.episode,
        at: last.run.at,
        moves: movesOf(view, last.run.results, playerId, faces, userOf, scored),
        freeAgency: (view.midSeason.log ?? [])
          .filter((tx) => tx.periodId === last.id && tx.via === "freeAgency")
          .map((tx) => ({
            playerId: tx.playerId,
            userId: userOf(tx.playerId),
            name: view.players.find((p) => p.id === tx.playerId)?.name ?? "someone",
            you: tx.playerId === playerId,
            kind: tx.type === "replenish" ? "replace" : "swap",
            add: faceOf(view, faces.get(tx.addedCastawayId), scored),
            drop: faceOf(view, tx.droppedCastawayId ? faces.get(tx.droppedCastawayId) : undefined, scored),
            outcome: "got",
            choice: null,
            why: "Free agency",
          })),
      }
    : null;
  return {
    ...game,
    playerId,
    shared,
    revealFirst: hidden ? current!.episode : null,
    stage,
    period:
      current && !hidden
        ? {
            id: current.id,
            episode: current.episode,
            window: !!current.window,
            swaps: current.swaps ?? 0,
            due: current.phase === "open" ? current.processAt : null,
            until: current.closesAt,
          }
        : null,
    replace: owed.lossIds,
    outIds: owed.outIds,
    swapsAllowed: live ? W.swapsAllowed(current) : 0,
    swapsLeft: live ? W.swapsLeft(view, current, playerId) : 0,
    team,
    free,
    spots,
    order,
    orderBy: (view.settings.replenishOrderBy || "rolling") as WaiverWeek["orderBy"],
    fallback: W.autoFillOn(view),
    freeAgency: W.freeAgencyOn(view),
    run,
    how: waiverHow(view),
  };
}
