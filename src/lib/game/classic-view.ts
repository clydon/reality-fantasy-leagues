import type { Castaway, Episode, LeagueState, Player } from "./types";
import StateLogic from "./state-logic.js";

// What Classic's screens (Overview's Standings and Your Team, the Episodes list, an episode's page)
// read about a team and the boot order, so they agree with each other and with the scoring
// (EliminationOrderScoringStrategy): a castaway earns 1 point plus 1 for every elimination they
// outlast, counted as it happens (so whoever goes out keeps their place in the boot order), and a
// right prediction pays its points when somebody else guessed too.
// Everything reads the viewer's spoiler-trimmed state, so none of it can run ahead of their reveal.

/** A team in the order it's shown: still in first (by name), then who's out, most recent first. */
export function teamOrder(roster: Castaway[]): Castaway[] {
  const inGame = roster.filter((c) => c.status !== "eliminated").sort((a, b) => a.name.localeCompare(b.name));
  const out = roster.filter((c) => c.status === "eliminated").sort((a, b) => (b.placementOrder ?? 0) - (a.placementOrder ?? 0));
  return [...inGame, ...out];
}

/** "3 still in", "2 still in · 1 out", "All 3 out", or null for an empty team. */
export function standingLine(roster: Castaway[]): string | null {
  if (roster.length === 0) return null;
  const standing = roster.filter((c) => c.status !== "eliminated").length;
  const out = roster.length - standing;
  if (standing === 0) return `All ${out} out`;
  return out ? `${standing} still in · ${out} out` : `${standing} still in`;
}

/** A castaway's Classic points so far: 1 + every elimination they've outlasted (final once out). */
export function castawayPoints(state: LeagueState, c: Castaway): number {
  return StateLogic.EliminationOrderScoringStrategy.castawayPoints(state, c);
}

export interface EpisodeGain {
  player: Player;
  /** What this player's team earned from this episode. */
  points: number;
  /** Their castaways still in after it, each up by `each`. */
  stillIn: number;
  each: number;
  /** Theirs who went out in it, with where they ended. */
  out: { castaway: Castaway; final: number }[];
}

/**
 * What each team earned from one episode: every castaway still in afterwards gains 1 per elimination
 * in it, and one who went out keeps 1 for each of that episode's exits they outlasted. Teams that
 * earned nothing and lost nobody are left out; biggest gain first.
 */
export function episodeGains(state: LeagueState, ep: Episode): EpisodeGain[] {
  const before = StateLogic.SpoilerLogic.viewThrough(state, ep.number - 1);
  const after = StateLogic.SpoilerLogic.viewThrough(state, ep.number);
  const each = ep.events.filter((ev) => StateLogic.getCastaway(after, ev.castawayId)?.status === "eliminated").length;
  const gains: EpisodeGain[] = [];
  state.players.forEach((player) => {
    let points = 0;
    let stillIn = 0;
    const out: EpisodeGain["out"] = [];
    state.castaways
      .filter((c) => c.ownerIds.includes(player.id))
      .forEach((c) => {
        const a = StateLogic.getCastaway(after, c.id);
        const b = StateLogic.getCastaway(before, c.id);
        if (!a || !b || b.status === "eliminated") return;
        points += castawayPoints(after, a) - castawayPoints(before, b);
        if (a.status === "eliminated") out.push({ castaway: a, final: castawayPoints(after, a) });
        else stillIn++;
      });
    if (points > 0 || out.length) gains.push({ player, points, stillIn, each, out });
  });
  return gains.sort((a, b) => b.points - a.points);
}

/** "3 still in, +1 each · Kim out, ends on 4" -- how a team's episode gain came about. */
export function gainDetail(g: EpisodeGain): string {
  return [
    g.stillIn > 0 && `${g.stillIn} still in, +${g.each} each`,
    ...g.out.map((o) => `${o.castaway.name.split(" ")[0]} out, ends on ${o.final}`),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "You keep 3", "Sam keeps 3", "Sam and Josie keep 3" -- where one castaway's points stop. */
export function keepsLine(state: LeagueState, c: Castaway, me: string | null): string | null {
  if (typeof c.placementOrder !== "number") return null;
  const names = c.ownerIds
    .map((id) => (id === me ? "You" : StateLogic.getPlayer(state, id)?.name))
    .filter((n): n is string => !!n)
    .sort((a, b) => Number(b === "You") - Number(a === "You"));
  if (names.length === 0) return null;
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${who} ${names.length === 1 && who !== "You" ? "keeps" : "keep"} ${c.placementOrder}`;
}

/** This player's predictions on this episode that were right and paid (the scoring's own rule). */
export function predictionsRight(state: LeagueState, ep: Episode, playerId: string | null) {
  const right: { label: string; points: number }[] = [];
  if (playerId && state.settings.bonusEnabled) {
    (ep.bets || []).forEach((bet) => {
      if ((bet.predictions || []).length < 2) return;
      if ((bet.predictions || []).some((p) => p.playerId === playerId && p.correct === true)) {
        right.push({ label: bet.label, points: bet.points || 0 });
      }
    });
  }
  return { right, points: right.reduce((n, r) => n + r.points, 0) };
}

/** Everyone out by the end of episode `n`, first out first. */
export function bootOrderThrough(state: LeagueState, n: number): Castaway[] {
  const epNumber = (c: Castaway) => state.episodes.find((e) => e.id === c.exitEpisodeId)?.number;
  return state.castaways
    .filter((c) => c.status === "eliminated" && (epNumber(c) ?? 0) <= n)
    .sort((a, b) => (a.placementOrder ?? 0) - (b.placementOrder ?? 0));
}
