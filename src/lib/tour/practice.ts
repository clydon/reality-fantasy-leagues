import type { Castaway, LeagueState, Player } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { eventPoints, seededRandom } from "@/lib/explainer-sample";

// The practice round (docs/PLAN-practice-round.md): the guided tour played on a throwaway copy of the
// league just joined -- its cast as it stood before episode 1, its game type and ownership, its
// scoring and its show's words -- against two computer players with made-up names (never a member's).
//
// Like the tour's Rise & Fall (rise-and-fall.ts) it starts undrafted and plays forward in the store's
// mock mode: nothing is written to the server. Unlike Rise & Fall nothing is scripted to make a point:
// results are random, from the league's own scoring events, and never the real ones -- nobody the
// real season sent home in its first two episodes goes home here.
//
// The functions here only change the state they're handed; the tour's director (tour-store.ts) runs
// them and keeps the clock for an episode "airing".

export type PracticeType = "active-roster" | "classic-draft" | "pickem";

export const PRACTICE_ME = "practice_you";
/** How many episodes each script airs: Eliminator Pool plays two (no repeats is the rule people miss). */
export const PRACTICE_EPISODES: Record<PracticeType, number> = { "active-roster": 1, "classic-draft": 1, pickem: 2 };
/** How long an episode airs for: the beat between lineups locking and "Results are in". */
export const AIR_MS = 4000;

const BOT_NAMES = ["Robin", "Sam", "Jordan", "Casey", "Morgan", "Riley", "Quinn", "Avery", "Drew", "Jamie", "Reese", "Frankie"];
const BOT_COLORS = ["#d9704a", "#a76bb0"];

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const episode = (s: LeagueState, n: number) => s.episodes.find((e) => e.number === n);
const hasResults = (s: LeagueState, n: number) => {
  const e = episode(s, n);
  return !!e && StateLogic.episodeHasResults(e);
};
const shared = (s: LeagueState) => s.settings.ownershipMode === "shared";
const bots = (s: LeagueState) => s.players.filter((p) => p.automated);
const roster = (s: LeagueState, playerId: string) =>
  s.castaways.filter((c) => c.ownerIds.includes(playerId) && c.status === "active").map((c) => c.id);
const lineup = (s: LeagueState, n: number, playerId: string) => {
  const e = episode(s, n);
  return e ? StateLogic.activeRosterLineupFor(s, e.id, playerId) : [];
};

function shuffle<T>(list: T[], rand: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const any = <T,>(list: T[]): T | undefined => list[Math.floor(Math.random() * list.length)];

// ---------- who can practice ----------

/** The cast as it stood before episode 1: everyone who ever played, nobody gone, in their first groups. */
function castBefore(raw: LeagueState): { castaways: Castaway[]; tribes: LeagueState["tribes"] } {
  const before = JSON.parse(JSON.stringify(StateLogic.SpoilerLogic.viewThrough(raw, 0))) as LeagueState;
  return { castaways: before.castaways.filter((c) => c.status === "active"), tribes: before.tribes };
}

/** Two computer players when the cast has room for three exclusive teams, else one; null: no room. */
function botCount(raw: LeagueState, castSize: number): number | null {
  const type = StateLogic.getLeagueType(raw);
  if (!type.hasRoster) return castSize >= 4 ? 2 : null;
  const size = StateLogic.rosterSize(raw);
  if (size < 1) return null;
  if (raw.settings.ownershipMode === "shared") return castSize > size ? 2 : null;
  if (castSize >= size * 3) return 2;
  return castSize >= size * 2 ? 1 : null;
}

/** The practice script this league plays, or null: a game type with no script yet, or no cast to draft. */
export function practiceTypeOf(raw: LeagueState): PracticeType | null {
  const id = StateLogic.getLeagueType(raw).id;
  if (id !== "active-roster" && id !== "classic-draft" && id !== "pickem") return null;
  return botCount(raw, castBefore(raw).castaways.length) === null ? null : id;
}

/** Who the real season sent home in episodes 1 and 2: never sent home in practice (no real result, ever). */
export function realEarlyExits(raw: LeagueState): string[] {
  const early = new Set(raw.episodes.filter((e) => e.number <= 2).map((e) => e.id));
  return raw.castaways.filter((c) => c.exitEpisodeId && early.has(c.exitEpisodeId)).map((c) => c.id);
}

/** The computer players' names, picked so none matches a member's first name. */
export function practiceBotNames(raw: LeagueState): string[] {
  const taken = new Set(raw.players.map((p) => first(p.name).toLowerCase()));
  const n = botCount(raw, castBefore(raw).castaways.length) ?? 2;
  return shuffle(BOT_NAMES.filter((name) => !taken.has(name.toLowerCase())), seededRandom(raw.players.map((p) => p.id).join())).slice(0, n);
}

/** The practice league before anyone has drafted or picked: Episode 1 ahead, the draft open with you
 *  first. You play under your own name in the league. */
export function buildPracticeState(raw: LeagueState, botNames: string[], myName: string): LeagueState {
  const { castaways, tribes } = castBefore(raw);
  const state = StateLogic.defaultState() as LeagueState;
  const me: Player = { id: PRACTICE_ME, name: myName, color: "#45a89a" };
  state.players = [me, ...botNames.map((name, i): Player => ({ id: `practice_bot_${i}`, name, color: BOT_COLORS[i % BOT_COLORS.length], automated: true }))];
  state.tribes = tribes;
  state.castaways = castaways.map(
    ({ startTribeId, ...c }): Castaway => ({
      ...c,
      tribeId: startTribeId ?? c.tribeId,
      ownerIds: [],
      acquiredVia: null,
      formerOwnerId: null,
      departedVia: null,
      replenishClaimed: false,
    }),
  );
  state.draftOrder = state.players.map((p) => p.id);
  state.draftForceStarted = true;
  state.settings = {
    ...JSON.parse(JSON.stringify(raw.settings)),
    startEpisode: 1,
    revealedThroughEpisode: null,
    draftScheduledAt: null,
    setupComplete: true,
    allowLateJoiners: false,
    // One or two episodes: no pickups, swaps or finale picks to get to.
    replenishEnabled: false,
    tradeEnabled: false,
    finalePredictionsEnabled: false,
    hideStartersUntilLock: false,
  };
  StateLogic.ensureEpisodeNumber(state, 1, false);
  return state;
}

// ---------- the computer players ----------

/** Snake draft: computer players take every turn that's theirs, at random, until it's yours or the draft's done. */
function botsDraft(s: LeagueState) {
  for (;;) {
    const turn = StateLogic.currentDraftTurn(s);
    if (!turn || turn.isComplete || !turn.playerId || turn.playerId === PRACTICE_ME) return;
    const pick = any(StateLogic.freeAgents(s).filter((c) => c.status === "active"));
    if (!pick) return;
    StateLogic.draftToCurrentTurn(s, pick.id);
  }
}

/** Blind draft: you lock in, the computer players lock in random teams, and everything reveals at once. */
export function lockInBlind(s: LeagueState, playerId: string, picks: string[]) {
  const size = StateLogic.rosterSize(s);
  const cast = s.castaways.filter((c) => c.status === "active").map((c) => c.id);
  const all: Record<string, string[]> = { [playerId]: picks };
  for (const b of bots(s)) all[b.id] = shuffle(cast).slice(0, size);
  StateLogic.BlindDraftLogic.setLockedPlayerIds(s, Object.keys(all));
  StateLogic.BlindDraftLogic.reveal(s, all);
}

function botLineups(s: LeagueState, n: number) {
  const e = episode(s, n);
  if (!e) return;
  const slots = StateLogic.ActiveRosterLogic.activeSlots(s);
  for (const b of bots(s)) StateLogic.setActiveRosterLineup(s, e.id, b.id, shuffle(roster(s, b.id)).slice(0, slots));
}

function botPicks(s: LeagueState, n: number) {
  const e = episode(s, n);
  if (!e) return;
  for (const b of bots(s)) {
    const pick = any(StateLogic.pickEmEligibility(s, e.id, b.id).available);
    if (pick) StateLogic.setPickEmPick(s, e.id, b.id, pick);
  }
}

// Classic's side bet, when the league has them on: one question on Episode 1, both computer players
// answering, so it can pay out (a bet needs two guesses).
export const PRACTICE_BET = "Who goes home first?";
const practiceBet = (s: LeagueState) => episode(s, 1)?.bets?.find((b) => b.createdByPlayerId === null && b.label === PRACTICE_BET) ?? null;
function addBet(s: LeagueState) {
  const e = episode(s, 1);
  if (!e) return;
  const bet = StateLogic.addBet(s, e.id, PRACTICE_BET, s.settings.defaultBetPoints || 1, null);
  if (!bet) return;
  const cast = shuffle(s.castaways.filter((c) => c.status === "active"));
  bots(s).forEach((b, i) => StateLogic.addBetPrediction(s, e.id, bet.id, b.id, first(cast[i]?.name ?? "")));
}

/** Your guess on the practice bet, if there is a bet: null when the league has no side bets. */
export function practiceBetFor(s: LeagueState): { label: string; points: number; guessed: boolean } | null {
  const bet = practiceBet(s);
  if (!bet) return null;
  return { label: bet.label, points: bet.points, guessed: bet.predictions.some((p) => p.playerId === PRACTICE_ME) };
}

// ---------- the week ----------

/** Whether your part of episode `n` is done (lineup set, guess in, pick locked): then it airs. */
export function readyToAir(s: LeagueState, n: number): boolean {
  const type = StateLogic.getLeagueType(s);
  const e = episode(s, n);
  if (!e || StateLogic.episodeHasResults(e)) return false;
  if (type.hasRoster && !StateLogic.currentDraftTurn(s)?.isComplete) return false;
  if (type.hasActiveRoster) {
    const need = Math.min(StateLogic.ActiveRosterLogic.activeSlots(s), roster(s, PRACTICE_ME).length);
    return lineup(s, n, PRACTICE_ME).length >= need;
  }
  if (type.hasWeeklyPicks) return !!StateLogic.pickEmPickFor(s, e.id, PRACTICE_ME);
  const bet = practiceBetFor(s);
  return !s.settings.bonusEnabled || (!!bet && bet.guessed);
}

/**
 * The rest of the league reacting to what you did. Every rule is idempotent on the state, so running
 * it again after its own change does nothing. Returns whether it changed the league, and the episode
 * that should start airing now, if one should.
 */
export function directPractice(s: LeagueState): { changed: boolean; air: number | null } {
  const type = StateLogic.getLeagueType(s);
  if (type.hasRoster) {
    const turn = StateLogic.currentDraftTurn(s);
    if (!shared(s) && turn && !turn.isComplete && turn.playerId !== PRACTICE_ME) {
      botsDraft(s);
      return { changed: true, air: null };
    }
    if (!turn?.isComplete) return { changed: false, air: null };
  }
  for (const e of [...s.episodes].sort((a, b) => a.number - b.number)) {
    if (StateLogic.episodeHasResults(e)) continue;
    const others = bots(s);
    if (type.hasActiveRoster && others.some((b) => !e.lineups?.[b.id])) {
      botLineups(s, e.number);
      return { changed: true, air: null };
    }
    if (type.hasWeeklyPicks && others.some((b) => !StateLogic.pickEmPickFor(s, e.id, b.id))) {
      botPicks(s, e.number);
      return { changed: true, air: null };
    }
    // The episode after the last one the script plays is open (your next lineup), but never airs.
    if (e.number > PRACTICE_EPISODES[type.id as PracticeType]) return { changed: false, air: null };
    if (type.id === "classic-draft" && e.number === 1 && s.settings.bonusEnabled && !practiceBet(s)) {
      addBet(s);
      return { changed: true, air: null };
    }
    if (!readyToAir(s, e.number)) return { changed: false, air: null };
    // It starts now: picks close and lineups lock, and every screen says so.
    if (!e.airsAt || (type.hasActiveRoster && !e.lineupsLocked)) {
      e.airsAt = e.airsAt ?? new Date().toISOString();
      if (type.hasActiveRoster) e.lineupsLocked = true;
      return { changed: true, air: e.number };
    }
    return { changed: false, air: e.number };
  }
  return { changed: false, air: null };
}

/** The ordinary things that score in an episode (no endgame or leaving events), biggest first. */
function ordinaryEvents(s: LeagueState): { id: string; points: number }[] {
  const format = StateLogic.formatOf(s);
  const off = new Set(
    ((format.eventCategories ?? []) as { id: string; events: string[] }[])
      .filter((c) => c.id === "endgame" || c.id === "leaving")
      .flatMap((c) => c.events),
  );
  return (format.events as { id: string; defaultPoints?: unknown; implied?: boolean; retiredFrom?: number }[])
    .filter((e) => !e.implied && !off.has(e.id) && !(Number.isInteger(e.retiredFrom) && (e.retiredFrom as number) <= 1))
    .map((e) => ({ id: e.id, points: eventPoints(s, e) }))
    .filter((e) => e.points !== 0)
    .sort((a, b) => b.points - a.points);
}

/** The show's ordinary way of leaving: Voted Out, Banished, Eliminated. */
const exitMethod = (s: LeagueState) => (StateLogic.formatOf(s).exitMethods as string[])[0] ?? "Eliminated";

/**
 * Episode `n` airs: random results written straight in. Who goes home is never one of the real
 * season's early exits (`avoid`), and never your Episode 1 pick in the Pool -- so the streak lesson
 * lands -- or, where it can be helped, one of your own team.
 */
export function airEpisode(s: LeagueState, n: number, avoid: string[]) {
  const e = episode(s, n);
  if (!e || StateLogic.episodeHasResults(e)) return;
  const type = StateLogic.getLeagueType(s);
  const skip = new Set(avoid);
  const active = s.castaways.filter((c) => c.status === "active").map((c) => c.id);
  const free = active.filter((id) => !skip.has(id));

  if (type.hasActiveRoster) {
    const events = ordinaryEvents(s);
    const gains = events.filter((x) => x.points > 0);
    const loss = events.filter((x) => x.points < 0).pop();
    const starters = lineup(s, n, PRACTICE_ME);
    const bench = roster(s, PRACTICE_ME).filter((id) => !starters.includes(id));
    const give = (ev: { id: string } | undefined, id: string | undefined) => {
      if (ev && id) StateLogic.addScoringEvent(s, e.id, ev.id, id);
    };
    // One of your starters does something big, and one of your bench something too (it won't count);
    // each computer player's starters score; someone takes the biggest loss.
    give(gains[0], any(starters));
    give(gains[1] ?? gains[0], any(bench));
    bots(s).forEach((b, i) => give(gains[(i + 2) % Math.max(gains.length, 1)], any(lineup(s, n, b.id))));
    give(loss, any(bots(s).flatMap((b) => lineup(s, n, b.id))) ?? any(starters));
    const mine = new Set(roster(s, PRACTICE_ME));
    const out = any(free.filter((id) => !mine.has(id))) ?? any(free.filter((id) => !starters.includes(id))) ?? any(free);
    if (out) StateLogic.addElimination(s, e.id, out, exitMethod(s));
    e.lineupsLocked = true;
    // "Set your next lineup": the next episode is open, with everyone's carried over.
    StateLogic.ensureEpisodeNumber(s, n + 1, false);
    return;
  }

  if (type.hasWeeklyPicks) {
    const pick = StateLogic.pickEmPickFor(s, e.id, PRACTICE_ME)?.castawayId;
    const out = n === 1 ? (any(free.filter((id) => id !== pick)) ?? any(free)) : any(free);
    if (out) StateLogic.addElimination(s, e.id, out, exitMethod(s));
    if (n < PRACTICE_EPISODES.pickem) StateLogic.ensureEpisodeNumber(s, n + 1, false);
    return;
  }

  // Classic: someone goes home and everyone still in moves up a point. With a side bet, the first
  // computer player's guess goes home when it can, so the bet shows paying out.
  const mine = new Set(roster(s, PRACTICE_ME));
  const bet = practiceBet(s);
  const named = (guess: string) => free.find((id) => !mine.has(id) && matches(guess, StateLogic.getCastaway(s, id)?.name ?? ""));
  const botGuess = bet?.predictions.find((p) => p.playerId !== PRACTICE_ME)?.guess;
  const out = (botGuess && named(botGuess)) || any(free.filter((id) => !mine.has(id))) || any(free);
  if (out) StateLogic.addElimination(s, e.id, out, exitMethod(s));
  const outName = out ? (StateLogic.getCastaway(s, out)?.name ?? "") : "";
  for (const p of bet?.predictions ?? []) StateLogic.setBetPredictionCorrect(s, e.id, bet!.id, p.id, matches(p.guess, outName));
}

/** A typed guess names this castaway: their full name or their first name, any case. */
function matches(guess: string, name: string): boolean {
  const g = guess.trim().toLowerCase();
  return !!g && (g === name.toLowerCase() || g === first(name).toLowerCase());
}

// ---------- what the host says about it ----------

const nameOf = (s: LeagueState, id: string | null | undefined) => (id ? (StateLogic.getCastaway(s, id)?.name ?? "") : "");
export const firstNameOf = (s: LeagueState, id: string | null | undefined) => first(nameOf(s, id));

/** Who went home in episode `n`. */
export function wentHome(s: LeagueState, n: number): string | null {
  return episode(s, n)?.events[0]?.castawayId ?? null;
}

/** Your total and place, for the standings line. */
export function myStanding(s: LeagueState): { total: number; place: number; tied: boolean } {
  const rows = (StateLogic.computeScores(s) as { playerId: string; total: number }[]).filter((r) => s.players.some((p) => p.id === r.playerId));
  const mine = rows.find((r) => r.playerId === PRACTICE_ME)?.total ?? 0;
  return { total: StateLogic.roundPoints(mine), place: rows.filter((r) => r.total > mine).length + 1, tied: rows.filter((r) => r.total === mine).length > 1 };
}

/** Active Roster: points one of your bench scored in episode `n`, that didn't count. */
export function benchMiss(s: LeagueState, n: number): { name: string; points: number } | null {
  const e = episode(s, n);
  if (!e) return null;
  const starters = StateLogic.activeRosterLineupFor(s, e.id, PRACTICE_ME);
  const ev = (e.scoringEvents ?? []).find((x) => {
    const c = StateLogic.getCastaway(s, x.castawayId);
    return !!c && c.ownerIds.includes(PRACTICE_ME) && !starters.includes(x.castawayId);
  });
  if (!ev) return null;
  const points = StateLogic.ActiveRosterLogic.pointsFor(s, ev.type);
  return points > 0 ? { name: firstNameOf(s, ev.castawayId), points } : null;
}

/** Eliminator Pool: your pick for episode `n`, and whether they stayed (null until it's aired). */
export function myPick(s: LeagueState, n: number): { id: string; stayed: boolean | null } | null {
  const e = episode(s, n);
  const pick = e && StateLogic.pickEmPickFor(s, e.id, PRACTICE_ME);
  if (!e || !pick) return null;
  return { id: pick.castawayId, stayed: StateLogic.episodeHasResults(e) ? !e.events.some((x) => x.castawayId === pick.castawayId) : null };
}

export { hasResults as practiceHasResults };
