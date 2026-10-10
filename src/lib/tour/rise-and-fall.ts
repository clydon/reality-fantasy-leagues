import type { Castaway, LeagueState, Player } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { formatFor } from "@/lib/game/formats/index.js";

// The guided tour's season (docs/PLAN-guided-tour.md, "The show"): *Rise & Fall*, a made-up baking
// competition. Ten bakers -- four hapless amateurs, four ordinary bakers, a professional and a
// world-renowned master -- you and two computer players, Active Roster with a roster of three (two
// starters, one bench). Clive, the master, is the best baker and wins every week, whoever has him;
// Gus, the most hopeless amateur, is the worst, and is in the bottom two every week until he goes home.
//
// Headshots (public/photos/tour/<key>.jpg) are cropped from an illustrated cast sheet the user
// supplied for the tour.
//
// Unlike demo-season-builder.ts (a finished season, rosters pre-computed, scrubbed episode by episode)
// this one starts UNDRAFTED and plays forward: you draft, the computer players pick instantly, and
// each episode's results are written at the moment it "airs" (scriptEpisode below), from what you
// actually drafted and started. It's all client-side mock state: nothing is saved and no database row
// is needed.

export const TOUR_SHOW_ID = "rise-and-fall";
export const TOUR_SHOW_NAME = "Rise & Fall";
export const TOUR_LEAGUE_NAME = "Rise & Fall";
export const TOUR_TERMS = { castaway: "Baker", tribe: "Team" };
export const TOUR_EPISODES = 2;

// The two scoring events (and nothing for going home: it only opens a roster spot). A data-only
// format, carried on the league as settings.showFormatData like a researched show's, so the real
// engine scores it -- generic's research half is reused, since the tour never researches anything.
const generic = (formatFor("generic") as unknown as { data: Record<string, unknown> }).data;
const FORMAT_DATA = {
  ...generic,
  id: TOUR_SHOW_ID,
  name: TOUR_SHOW_NAME,
  exitMethods: ["Went home", "Winner"],
  terms: TOUR_TERMS,
  winnerExitMethod: "Winner",
  endgameExitMethods: ["Winner"],
  events: [
    { id: "wonWeek", label: "Won the week", defaultPoints: 3 },
    { id: "bottomTwo", label: "Bottom two", defaultPoints: -1 },
  ],
  eventCategories: [{ id: "week", label: "The week", events: ["wonWeek", "bottomTwo"] }],
  recap: [{ label: "Won the week", events: ["wonWeek"] }],
  hasMerge: false,
  hasGroups: false,
  wiki: { ...(generic.wiki as object), eventTypes: [] },
  rules: { research: [{ when: { answer: "wonChallenge", is: "yes" }, award: "wonWeek" }], implied: [] },
};

export const TOUR_ME = "tour_you";
export const TOUR_BEN = "tour_ben";
export const TOUR_KAT = "tour_kat";

const PLAYERS: Player[] = [
  { id: TOUR_ME, name: "You", color: "#45a89a" },
  { id: TOUR_BEN, name: "Ben", color: "#d9704a", automated: true },
  { id: TOUR_KAT, name: "Kat", color: "#a76bb0", automated: true },
];

// Who's who on the cast sheet: Ana, Gus, Ivy and Bruno the amateurs (clueless, hopeless, messy,
// bumbling); Emma, Finn, Hana and Dev ordinary bakers; Jo the professional; Clive world-renowned.
const BAKERS: { key: string; name: string }[] = [
  { key: "ana", name: "Ana" },
  { key: "bruno", name: "Bruno" },
  { key: "clive", name: "Clive" },
  { key: "dev", name: "Dev" },
  { key: "emma", name: "Emma" },
  { key: "finn", name: "Finn" },
  { key: "gus", name: "Gus" },
  { key: "hana", name: "Hana" },
  { key: "ivy", name: "Ivy" },
  { key: "jo", name: "Jo" },
];
const bakerId = (key: string) => `tour_c_${key}`;
/** The best baker: wins every week. */
export const TOUR_STAR = bakerId("clive");
/** The worst: bottom two every week he's still in. */
export const TOUR_FLOP = bakerId("gus");
// Ben knows a master when he sees one: if you don't take Clive first, he does. Ivy is last on both
// lists, so she's the one left over for the pickup -- unless you draft her yourself.
const BOT_PREFERENCE: Record<string, string[]> = {
  [TOUR_BEN]: ["clive", "jo", "dev", "hana", "emma", "finn", "ana", "bruno", "gus", "ivy"].map(bakerId),
  [TOUR_KAT]: ["jo", "dev", "hana", "finn", "emma", "bruno", "gus", "ana", "clive", "ivy"].map(bakerId),
};

/** The tour league before anyone has drafted: the draft open with you on the clock, Episode 1 ahead. */
export function buildTourState(): LeagueState {
  const state = StateLogic.defaultState() as LeagueState;
  state.players = PLAYERS.map((p) => ({ ...p }));
  state.castaways = BAKERS.map(
    ({ key, name }): Castaway => ({
      id: bakerId(key),
      name,
      tribeId: "",
      ownerIds: [],
      status: "active",
      acquiredVia: null,
      photoUrl: `/photos/tour/${key}.jpg`,
    })
  );
  state.draftOrder = PLAYERS.map((p) => p.id);
  state.draftForceStarted = true;
  state.settings = {
    ...state.settings,
    leagueTypeId: "active-roster",
    ownershipMode: "exclusive",
    showId: TOUR_SHOW_ID,
    showFormat: TOUR_SHOW_ID,
    showFormatData: FORMAT_DATA,
    setupComplete: true,
    activeSlots: 2,
    benchSlots: 1,
    // A roster down to two still in the game is owed a pickup back to three -- so one baker going
    // home opens a spot (the default would wait until you couldn't field a lineup at all).
    replenishEnabled: true,
    replenishAt: 2,
    replenishOrderBy: "rolling",
    tradeEnabled: false,
    finalePredictionsEnabled: false,
    eventPoints: {},
  } as unknown as LeagueState["settings"];
  StateLogic.ensureEpisodeNumber(state, 1, false);
  return state;
}

/** Computer players take every turn that's theirs, instantly, until it's your turn or the draft ends. */
export function botsDraft(state: LeagueState) {
  for (;;) {
    const turn = StateLogic.currentDraftTurn(state);
    if (!turn || turn.isComplete || !turn.playerId || turn.playerId === TOUR_ME) return;
    const free = new Set(StateLogic.freeAgents(state).map((c) => c.id));
    const pick = BOT_PREFERENCE[turn.playerId]?.find((id) => free.has(id));
    if (!pick) return;
    StateLogic.draftToCurrentTurn(state, pick);
  }
}

const episode = (state: LeagueState, n: number) => state.episodes.find((e) => e.number === n);
const lineupOf = (state: LeagueState, n: number, playerId: string) => {
  const ep = episode(state, n);
  return ep ? (StateLogic.activeRosterLineupFor(state, ep.id, playerId) as string[]) : [];
};
const rosterOf = (state: LeagueState, playerId: string) =>
  state.castaways.filter((c) => c.ownerIds.includes(playerId) && c.status === "active").map((c) => c.id);

/** The computer players start their two favourites still in, for this episode. */
function botLineups(state: LeagueState, n: number) {
  const ep = episode(state, n);
  if (!ep) return;
  for (const id of [TOUR_BEN, TOUR_KAT]) {
    const rank = (c: string) => BOT_PREFERENCE[id].indexOf(c);
    const best = rosterOf(state, id).sort((a, b) => rank(a) - rank(b)).slice(0, 2);
    StateLogic.setActiveRosterLineup(state, ep.id, id, best);
  }
}

/** Once the draft's done: everyone else's Episode 1 lineup is in. */
export function afterDraft(state: LeagueState) {
  botLineups(state, 1);
}

/**
 * Episode `n` airs. Clive wins the week every time, whoever has him (it counts only if they started
 * him). Gus is in the bottom two every week he's still in.
 *  1. The other bottom-two spot is one of YOUR starters, and your starter goes home -- Gus, if you
 *     started him -- so you always have a spot to fill with a pickup.
 *  2. The other bottom-two spot is someone else's starter, and Gus goes home if he's still in (else
 *     that other baker does).
 */
export function scriptEpisode(state: LeagueState, n: number) {
  const ep = episode(state, n);
  if (!ep || StateLogic.episodeHasResults(ep)) return;
  const inGame = (id: string) => StateLogic.getCastaway(state, id)?.status === "active";
  const mine = lineupOf(state, n, TOUR_ME);
  const others = [...lineupOf(state, n, TOUR_KAT), ...lineupOf(state, n, TOUR_BEN)];
  const ordinary = (id: string) => id !== TOUR_STAR && id !== TOUR_FLOP;
  StateLogic.addScoringEvent(state, ep.id, "wonWeek", TOUR_STAR);
  let out: string | undefined;
  let partner: string | undefined;
  if (n === 1) {
    out = mine.includes(TOUR_FLOP) ? TOUR_FLOP : (mine.find(ordinary) ?? mine[0]);
    partner = out === TOUR_FLOP ? others.find(ordinary) : TOUR_FLOP;
  } else if (inGame(TOUR_FLOP)) {
    out = TOUR_FLOP;
    partner = others.find(ordinary) ?? mine.find(ordinary);
  } else {
    out = others.find(ordinary) ?? mine.find(ordinary);
  }
  for (const id of [out, partner]) if (id) StateLogic.addScoringEvent(state, ep.id, "bottomTwo", id);
  if (out) StateLogic.addElimination(state, ep.id, out, "Went home");
  ep.lineupsLocked = true;
  if (n < TOUR_EPISODES) {
    StateLogic.ensureEpisodeNumber(state, n + 1, false);
    botLineups(state, n + 1);
  }
}

/** Results in and seen: anyone owed a pickup gets a round, with you first. */
export function startPickups(state: LeagueState) {
  if (!state.midSeason.replenish) StateLogic.startReplenish(state);
}

/** Your pickup's done: close the round and start them next week in the slot that opened. */
export function afterPickup(state: LeagueState) {
  const turn = StateLogic.currentReplenishTurn(state);
  if (turn && !turn.isComplete) return;
  state.midSeason.replenish = null;
  const ep = episode(state, 2);
  if (!ep) return;
  const current = lineupOf(state, 2, TOUR_ME).filter((id) => rosterOf(state, TOUR_ME).includes(id));
  const added = [...state.castaways].reverse().find((c) => c.ownerIds.includes(TOUR_ME) && c.acquiredVia === "replenish");
  const next = added && !current.includes(added.id) ? [...current, added.id].slice(-2) : current;
  StateLogic.setActiveRosterLineup(state, ep.id, TOUR_ME, next);
}

/** What Ben says in chat once Episode 1 is revealed: a gloat if he's on top, else something sour. */
export function benLine(state: LeagueState): string {
  const scores = StateLogic.computeScores(state) as { playerId: string; total: number }[];
  const top = Math.max(...scores.map((s) => s.total));
  const leaders = scores.filter((s) => s.total === top).map((s) => s.playerId);
  if (leaders.length === 1 && leaders[0] === TOUR_BEN) return "Top of the table after week one. Didn't even break a sweat 😎";
  if (leaders.includes(TOUR_ME)) return "Enjoy it while it lasts. Week two is mine 😤";
  return "Rough week. Somebody keep Gus away from the oven 🙄";
}

/** Who has Clive, and whether they started him, in episode `n` -- for the host's line after a reveal. */
export function starIn(state: LeagueState, n: number): { owner: string | null; started: boolean } {
  const owner = StateLogic.getCastaway(state, TOUR_STAR)?.ownerIds[0] ?? null;
  return { owner, started: !!owner && lineupOf(state, n, owner).includes(TOUR_STAR) };
}

/** The free agent you'll be picking up (Ivy, unless you drafted her). */
export function pickupName(state: LeagueState): string | null {
  return StateLogic.freeAgents(state).find((c) => c.status === "active")?.name ?? null;
}

