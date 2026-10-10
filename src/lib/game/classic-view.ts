import type { Castaway, Episode, LeagueState, Player } from "./types";
import StateLogic from "./state-logic.js";

// What Classic's screens (Overview's Standings and Your Team, the Episodes list, an episode's page)
// read about a team and the boot order, so they agree with each other and with the scoring
// (EliminationOrderScoringStrategy): a castaway who goes out scores their place in the boot order
// for whoever owns them, and a right prediction pays its points when somebody else guessed too.
// Everything reads the viewer's spoiler-trimmed state, so none of it can run ahead of their reveal.

/** A team in the order it's shown: still in first (by name), then who's out, most recent first. */
export function teamOrder(roster: Castaway[]): Castaway[] {
  const inGame = roster.filter((c) => c.status !== "eliminated").sort((a, b) => a.name.localeCompare(b.name));
  const out = roster.filter((c) => c.status === "eliminated").sort((a, b) => (b.placementOrder ?? 0) - (a.placementOrder ?? 0));
  return [...inGame, ...out];
}

/** "2 of 3 standing", "All 3 standing", or null for an empty team. */
export function standingLine(roster: Castaway[]): string | null {
  if (roster.length === 0) return null;
  const standing = roster.filter((c) => c.status !== "eliminated").length;
  return standing === roster.length ? `All ${roster.length} standing` : `${standing} of ${roster.length} standing`;
}

/** Who scored from this episode's exits: each owner of each castaway who went, and their place. */
export function episodeBanks(state: LeagueState, ep: Episode): { player: Player; castaway: Castaway; points: number }[] {
  const out: { player: Player; castaway: Castaway; points: number }[] = [];
  ep.events.forEach((ev) => {
    const c = StateLogic.getCastaway(state, ev.castawayId);
    if (!c || typeof c.placementOrder !== "number") return;
    c.ownerIds.forEach((id) => {
      const player = StateLogic.getPlayer(state, id);
      if (player) out.push({ player, castaway: c, points: c.placementOrder! });
    });
  });
  return out;
}

/** "You bank 3", "Sam banks 3", "Sam and Josie bank 3" -- who scored from one castaway going out. */
export function banksLine(state: LeagueState, c: Castaway, me: string | null): string | null {
  if (typeof c.placementOrder !== "number") return null;
  const names = c.ownerIds
    .map((id) => (id === me ? "You" : StateLogic.getPlayer(state, id)?.name))
    .filter((n): n is string => !!n)
    .sort((a, b) => Number(b === "You") - Number(a === "You"));
  if (names.length === 0) return null;
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${who} ${names.length === 1 && who !== "You" ? "banks" : "bank"} ${c.placementOrder}`;
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
