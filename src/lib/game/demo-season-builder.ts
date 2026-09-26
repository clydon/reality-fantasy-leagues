import type { Bet, Castaway, Episode, LeagueState, MidSeasonLogEntry, Player, Tribe } from "./types";
import { formatFor } from "@/lib/game/formats/index.js";

export type DemoLeagueTypeId = "classic-draft" | "active-roster" | "pickem";

// Shared display label for a demo league type -- used by both the picker (choosing one) and the
// "Previewing demo data" banner (saying which one is currently loaded).
export const DEMO_LEAGUE_TYPE_LABELS: Record<DemoLeagueTypeId, string> = {
  "classic-draft": "Classic Draft",
  "active-roster": "Active Roster",
  pickem: "Eliminator Pool",
};

// Turns one researched demo season (db/migrations/0026_demo_seasons_generic.sql, fetched via
// /api/demo-seasons/:id) into a real LeagueState, for whichever league type the Demo Season picker's
// second step chose and at whichever episode the viewer has scrubbed to. Unlike mock-state.ts's
// buildMockSeasonState() -- one hand-built league, always the same -- this is a small interpreter
// over data, so any of the 3 researched seasons can be tried as any of the 3 league types (a 3x3
// matrix from 3 rows) and replayed at any point in its own history, all without re-deriving anything.
//
// A season's `data` carries no ownership of its own: draft/roster assignment only means something
// once a league type is picked (a pure pick'em season has no roster at all), so it's computed here,
// generically, from the cast + however many fictional players the season ships -- see
// computeRoster() below.

export interface DemoRole {
  value: string;
  sinceEpisode: number;
}

export interface DemoCastaway {
  key: string;
  name: string;
  groupKey?: string | null;
  placement: number;
  exitMethod: string;
  exitEpisode: number;
  role?: DemoRole | null;
  photoUrl?: string | null;
}

export interface DemoPlayer {
  key: string;
  name: string;
  color: string;
}

export interface DemoGroup {
  key: string;
  name: string;
  color: string;
}

export interface DemoSeasonData {
  id: string;
  showId: string;
  showName: string;
  seasonName: string;
  episodeCount: number;
  groups?: DemoGroup[];
  players: DemoPlayer[];
  castaways: DemoCastaway[];
}

const pid = (key: string) => `demo_p_${key}`;
const tid = (key: string) => `demo_t_${key}`;
const cid = (key: string) => `demo_c_${key}`;
const epId = (n: number) => `demo_ep_${n}`;

function buildPlayers(data: DemoSeasonData): Player[] {
  return data.players.map((p) => ({ id: pid(p.key), name: p.name, color: p.color }));
}

// "You" for the demo -- the store gives this player a real membership (see chooseDemoSeason) so the
// demo plays from inside the league (your roster/picks highlighted, able to set lineups and make
// picks) rather than pure commissioner god-mode. Always the season's first listed player; there's no
// real basis to prefer any other fictional player over another.
export function demoSelfPlayerId(data: DemoSeasonData): string {
  return pid(data.players[0].key);
}

const MERGED_TRIBE_KEY = "__merged";

// Real seasons with starting tribes eventually merge them into one -- a demo that keeps everyone in
// their day-1 tribe forever doesn't show that off, or let the Board's tribe grouping be tested
// against it. There's no real-season basis for the EXACT merge episode (that would need the same
// kind of research this file elsewhere flags the accuracy limits of), so this is a plausible,
// disclosed-as-synthetic point partway through the season -- only for a season that HAS starting
// tribes to merge (data.groups), same "gameplay filler, not researched fact" category as the
// invented bets/picks/events elsewhere in this file.
function mergeEpisodeFor(data: DemoSeasonData): number | null {
  if (!data.groups || data.groups.length === 0) return null;
  return Math.max(2, Math.round(data.episodeCount * 0.45));
}

// Tribes as of a given point in the season: starting tribes, plus a merged tribe once the season has
// reached mergeEpisodeFor -- mirroring what GroupLogic.tribeNamed does for a real league's merge
// (creates one new tribe everyone still in the game moves into), just computed directly instead of
// through a per-castaway ep.groups history.
function buildTribes(data: DemoSeasonData, throughEpisode: number): Tribe[] {
  const base = (data.groups || []).map((g) => ({ id: tid(g.key), name: g.name, color: g.color }));
  const mergeEp = mergeEpisodeFor(data);
  if (mergeEp !== null && throughEpisode >= mergeEp) {
    base.push({ id: tid(MERGED_TRIBE_KEY), name: "Merged Tribe", color: "#b0563f" });
  }
  return base;
}

// Fixed roster sizes rather than derived from cast size: Classic Draft is a 3-pick roster, Active
// Roster a 5-pick one (3 active + 2 bench) -- same shape a real league of that type would default
// to, regardless of how big the real cast happens to be. A cast size that doesn't divide evenly by
// player count leaves a remainder undrafted, same as a real league's free agents.
const ROSTER_SIZE: Record<"classic-draft" | "active-roster", number> = { "classic-draft": 3, "active-roster": 5 };

function computeRoster(
  data: DemoSeasonData,
  leagueTypeId: "classic-draft" | "active-roster"
): { rosterSize: number; ownership: { playerKey: string; castawayKeys: string[] }[] } {
  const playerCount = data.players.length;
  const rosterSize = Math.min(ROSTER_SIZE[leagueTypeId], Math.floor(data.castaways.length / playerCount));
  const draftable = data.castaways.slice(0, rosterSize * playerCount);
  const ownership = data.players.map((p, i) => ({
    playerKey: p.key,
    castawayKeys: draftable.filter((_, idx) => idx % playerCount === i).map((c) => c.key),
  }));
  return { rosterSize, ownership };
}

// One simulated mid-season move (see simulateMidSeasonMoves below): a player dropped `droppedKey`
// (formerOwnerId/departedVia on that castaway) and picked up `addedKey` from the free agent pool
// (acquiredVia on that one, replacing the "draft" every other roster spot gets).
interface DemoMove {
  type: "replenish" | "trade";
  playerKey: string;
  addedKey: string;
  droppedKey: string;
  at: string;
}

function buildCastaways(
  data: DemoSeasonData,
  ownerOf: Map<string, string[]>,
  hasRoster: boolean,
  throughEpisode: number,
  moves: DemoMove[] = []
): Castaway[] {
  const mergeEp = mergeEpisodeFor(data);
  const droppedBy = new Map(moves.map((m) => [m.droppedKey, m]));
  const acquiredVia = new Map(moves.map((m) => [m.addedKey, m.type]));
  return data.castaways.map((c) => {
    const revealed = c.exitEpisode <= throughEpisode;
    // Merged once the season has reached the merge AND this castaway was still in the game going
    // into it (exitEpisode >= mergeEp) -- someone already out before the merge never merged at all,
    // same as a real season.
    const merged = mergeEp !== null && throughEpisode >= mergeEp && c.exitEpisode >= mergeEp;
    const drop = droppedBy.get(c.key);
    return {
      id: cid(c.key),
      name: c.name,
      tribeId: merged ? tid(MERGED_TRIBE_KEY) : c.groupKey ? tid(c.groupKey) : "",
      ownerIds: ownerOf.get(c.key) || [],
      photoUrl: c.photoUrl ?? undefined,
      status: revealed ? "eliminated" : "active",
      placementOrder: revealed ? c.placement : undefined,
      exitMethod: revealed ? c.exitMethod : undefined,
      exitEpisodeId: revealed ? epId(c.exitEpisode) : undefined,
      acquiredVia: hasRoster ? acquiredVia.get(c.key) ?? "draft" : null,
      formerOwnerId: drop ? pid(drop.playerKey) : null,
      departedVia: drop ? drop.type : null,
      // Only meaningful for a replenish drop (see ReplenishLogic.start's own filter on it) -- true
      // here because this move already "happened," same reasoning YourTeamCard's pending-replenish
      // count needs: an already-backfilled loss shouldn't also show up as still owed one.
      replenishClaimed: drop?.type === "replenish",
    };
  });
}

// A working example of Replenish and Swap in action, not just the toggle turned on -- an actual past
// transaction to look at in Roster detail's former-roster row and the Mid-Season tab's history.
// There's no real-season basis for which specific players would make which specific roster moves
// (this is league management, not a researched fact about the season), so -- same category as the
// synthetic bets/events elsewhere in this file -- this deterministically picks one plausible
// replenish (a player backfilling their earliest loss with the best remaining free agent) and one
// plausible trade (a different player swapping out their own earliest-eliminated pick for a
// different free agent), mutating `ownership` in place to reflect the result.
function simulateMidSeasonMoves(data: DemoSeasonData, ownership: { playerKey: string; castawayKeys: string[] }[]): DemoMove[] {
  if (ownership.length < 2) return [];
  const ownedKeys = new Set(ownership.flatMap((o) => o.castawayKeys));
  const freeAgents = [...data.castaways].filter((c) => !ownedKeys.has(c.key)).sort((a, b) => b.exitEpisode - a.exitEpisode);
  if (freeAgents.length < 2) return [];
  const moves: DemoMove[] = [];

  const replenishOwner = ownership[1];
  const replenishDrop = data.castaways
    .filter((c) => replenishOwner.castawayKeys.includes(c.key))
    .sort((a, b) => a.exitEpisode - b.exitEpisode)[0];
  const replenishAdd = freeAgents[0];
  if (replenishDrop) {
    replenishOwner.castawayKeys = replenishOwner.castawayKeys.filter((k) => k !== replenishDrop.key).concat(replenishAdd.key);
    moves.push({
      type: "replenish",
      playerKey: replenishOwner.playerKey,
      addedKey: replenishAdd.key,
      droppedKey: replenishDrop.key,
      at: "2026-03-02T18:00:00.000Z",
    });
  }

  const tradeOwner = ownership[0];
  const tradeDrop = data.castaways
    .filter((c) => tradeOwner.castawayKeys.includes(c.key))
    .sort((a, b) => a.exitEpisode - b.exitEpisode)[0];
  const tradeAdd = freeAgents.find((c) => c.key !== replenishAdd.key);
  if (tradeDrop && tradeAdd) {
    tradeOwner.castawayKeys = tradeOwner.castawayKeys.filter((k) => k !== tradeDrop.key).concat(tradeAdd.key);
    moves.push({
      type: "trade",
      playerKey: tradeOwner.playerKey,
      addedKey: tradeAdd.key,
      droppedKey: tradeDrop.key,
      at: "2026-03-16T18:00:00.000Z",
    });
  }

  return moves;
}

// One flavor question per show, cycling, so a fuller season doesn't repeat the same bet every time.
// These are gameplay filler (every real league already generates its own bets by hand) rather than
// researched facts, so there's no accuracy concern in inventing them -- only the murder/banishment
// order etc. above needed real sourcing. Every demo season gets one every other episode.
const BET_TEMPLATES: Record<string, string[]> = {
  survivor: ["Does anyone find a hidden immunity idol this episode?", "Is there a tribe swap or twist this episode?"],
  traitors: ["Will a Traitor be exposed at tonight's Round Table?", "Is there a murder this episode?"],
  challenge: ["Do the returning champs win today's daily challenge?", "Does an underdog survive the Elimination?"],
};

function genericBet(data: DemoSeasonData, epNum: number, players: Player[]): Bet {
  const templates = BET_TEMPLATES[data.showId] || ["Will tonight bring a surprise result?"];
  const label = templates[(epNum / 2 - 1) % templates.length];
  return {
    id: `demo_bet_${epNum}`,
    label,
    points: 2,
    predictions: players.map((p, i) => ({
      id: `demo_pr_${epNum}_${p.id}`,
      playerId: p.id,
      guess: i % 2 === 0 ? "Yes" : "No",
      correct: i % 2 === 0,
    })),
  };
}

function buildEpisodesBase(data: DemoSeasonData, players: Player[], throughEpisode: number): Episode[] {
  const lastEp = Math.min(throughEpisode, data.episodeCount);
  const mergeEp = mergeEpisodeFor(data);
  const episodes: Episode[] = [];
  for (let n = 1; n <= lastEp; n++) {
    const events = data.castaways
      .filter((c) => c.exitEpisode === n)
      .map((c) => ({ castawayId: cid(c.key), method: c.exitMethod }));
    const roles = data.castaways
      .filter((c) => c.role && c.role.sinceEpisode === n)
      .map((c) => ({ castawayId: cid(c.key), role: c.role!.value }));
    episodes.push({
      id: epId(n),
      number: n,
      postMerge: mergeEp !== null && n >= mergeEp,
      events,
      exiled: [],
      roles,
      groups: [],
      bets: n % 2 === 0 ? [genericBet(data, n, players)] : [],
      picks: [],
      scoringEvents: [],
      lineups: {},
      lineupsLocked: n < lastEp,
    });
  }
  return episodes;
}

function baseSettings(data: DemoSeasonData, leagueTypeId: DemoLeagueTypeId, rosterSize: number) {
  const isClassic = leagueTypeId === "classic-draft";
  return {
    teamSize: isClassic ? rosterSize || 1 : 3,
    bonusEnabled: true,
    replenishOrderBy: "mostPoints" as const,
    // Only Classic Draft demos run with Replenish/Swap on -- Active Roster's own demo shows off the
    // "field a lineup" mechanic instead, and Eliminator Pool has no roster for either to apply to.
    replenishEnabled: isClassic,
    tradeEnabled: isClassic,
    revealedThroughEpisode: null,
    startEpisode: 1,
    defaultBetPoints: 2,
    finalePredictionsEnabled: false,
    finaleTop3Points: 1,
    finaleWinnerPoints: 3,
    finalePredictionScope: "open",
    draftScheduledAt: null,
    leagueTypeId,
    showId: data.showId,
    showFormat: data.showId,
    setupComplete: true,
    ownershipMode: "exclusive" as const,
    wikiSeason: null,
    activeSlots: 3,
    benchSlots: leagueTypeId === "active-roster" ? 2 : 0,
    eventPoints: {},
    pickemCorrectPoints: 1,
  };
}

function emptyMidSeasonAndDraft(draftOrder: string[], draftPicksMade: number, log: MidSeasonLogEntry[] = []) {
  return {
    finalePredictions: [],
    finaleActual: { top3: [], winner: null },
    // `replenish`/`trade` (the IN-PROGRESS-round state) stay null -- simulateMidSeasonMoves already
    // resolved its moves, there's no live turn to show. `log` is the completed history of them.
    midSeason: { replenish: null, trade: null, log },
    draftOrder,
    draftPicksMade,
    draftForceStarted: true,
    blindDraft: { lockedPlayerIds: [], revealedAt: null },
  };
}

function ownerMap(ownership: { playerKey: string; castawayKeys: string[] }[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const o of ownership) {
    for (const key of o.castawayKeys) {
      map.set(key, [...(map.get(key) || []), pid(o.playerKey)]);
    }
  }
  return map;
}

// Deterministic (not random) so the same season+cursor always replays identically -- a simple
// rotating hash rather than Math.random, which would reshuffle events on every rebuild.
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Active Roster's whole point is the per-episode event catalog (the format's non-implied types --
// Traitors' shieldWon/survivedRoundTable/votedOutTraitor, Survivor's individualImmunity/idolFound/
// etc, Challenge's dailyWin/eliminationWin/captain), and a demo with none of them logged has nothing
// to show off or test against: the League Scoring settings list stays all zeroes, and there's no
// "Last Week" to look at. There's no real-season basis for exactly who won what (that's the same
// research-reliability problem flagged when this season was first built), so this generates
// plausible, gameplay-filler events instead -- same category as the invented side bets and pickem
// picks elsewhere in this file, openly synthetic rather than presented as researched fact. One
// eligible castaway per non-implied type per episode, only sometimes (not every type fires every
// episode -- a real season doesn't either), preferring an owned/drafted castaway so the points
// actually surface somewhere a viewer would look (Your Team, League Scoring).
function addSyntheticScoringEvents(data: DemoSeasonData, ownership: { playerKey: string; castawayKeys: string[] }[], episodes: Episode[]) {
  const explicitTypes = formatFor(data.showId).events.filter((e) => !e.implied);
  if (explicitTypes.length === 0) return;
  const ownedKeys = new Set(ownership.flatMap((o) => o.castawayKeys));
  for (const ep of episodes) {
    // Still in the game AFTER this episode -- never credits an event to someone this same episode
    // just eliminated, which would read as a contradiction (e.g. "survived the vote" then voted out).
    const eligible = data.castaways.filter((c) => c.exitEpisode > ep.number);
    if (eligible.length === 0) continue;
    const pool = eligible.some((c) => ownedKeys.has(c.key)) ? eligible.filter((c) => ownedKeys.has(c.key)) : eligible;
    for (const type of explicitTypes) {
      // Roughly 1 in 3 episodes -- enough to populate stats without every category firing every
      // single episode, which would look mechanical rather than like a real season's variance.
      if (hashStr(`${ep.number}:${type.id}`) % 3 !== 0) continue;
      const idx = hashStr(`${ep.number}:${type.id}:pick`) % pool.length;
      ep.scoringEvents.push({ id: `demo_sev_${ep.number}_${type.id}`, type: type.id, castawayId: cid(pool[idx].key) });
    }
  }
}

function buildRosterDemo(data: DemoSeasonData, leagueTypeId: "classic-draft" | "active-roster", throughEpisode: number): LeagueState {
  const players = buildPlayers(data);
  const tribes = buildTribes(data, throughEpisode);
  const { rosterSize, ownership } = computeRoster(data, leagueTypeId);
  // Only Classic Draft demos run with Replenish/Swap turned on (see baseSettings) -- no point
  // simulating a move nothing in the league can act on. Mutates `ownership` in place, so
  // buildCastaways below already sees the post-move rosters.
  const moves = leagueTypeId === "classic-draft" ? simulateMidSeasonMoves(data, ownership) : [];
  const castaways = buildCastaways(data, ownerMap(ownership), true, throughEpisode, moves);
  const episodes = buildEpisodesBase(data, players, throughEpisode);
  if (leagueTypeId === "active-roster") {
    // Every drafted castaway is always in the active lineup (activeSlots covers the whole roster) --
    // there's no real-season basis for who a fictional owner would bench week to week, so rather than
    // invent one, the demo just shows the full roster scoring every episode.
    for (const ep of episodes) {
      for (const o of ownership) ep.lineups[pid(o.playerKey)] = o.castawayKeys.map(cid);
    }
    addSyntheticScoringEvents(data, ownership, episodes);
  }
  const log: MidSeasonLogEntry[] = moves.map((m, i) => ({
    id: `demo_tx_${i}`,
    type: m.type,
    playerId: pid(m.playerKey),
    addedCastawayId: cid(m.addedKey),
    droppedCastawayId: cid(m.droppedKey),
    at: m.at,
  }));
  return {
    players,
    tribes,
    castaways,
    episodes,
    ...emptyMidSeasonAndDraft(players.map((p) => p.id), players.length * rosterSize, log),
    settings: baseSettings(data, leagueTypeId, rosterSize),
  };
}

// Assigns each fictional player a valid weekly pick for every episode, honoring both PickEmLogic
// rules (no repeat until everyone still in the game has been picked once this cycle; never the same
// person back-to-back) -- there's no real-season basis for what a fictional player would have
// guessed, so this just needs to be a LEGAL history, not a realistic one. Correctness itself isn't
// stored: PickEmLogic derives it live from the episode's actual events, same as a real league.
// Verified against the real PickEmLogic.eligibility check at authoring time (zero violations).
function generatePicks(
  playerIds: string[],
  episodeNumbers: number[],
  activeAt: (episodeNumber: number) => string[]
): Record<number, { playerId: string; castawayId: string }[]> {
  const cursors = playerIds.map((playerId) => ({ playerId, cycleUsed: new Set<string>(), lastPick: null as string | null }));
  const out: Record<number, { playerId: string; castawayId: string }[]> = {};
  for (const epNum of episodeNumbers) {
    const active = activeAt(epNum);
    out[epNum] = [];
    if (active.length === 0) continue;
    for (const cur of cursors) {
      if (active.every((id) => cur.cycleUsed.has(id))) cur.cycleUsed = new Set();
      let candidates = active.filter((cid2) => !cur.cycleUsed.has(cid2) && cid2 !== cur.lastPick);
      if (candidates.length === 0) candidates = active.filter((cid2) => cid2 !== cur.lastPick);
      if (candidates.length === 0) candidates = active;
      const idx = (epNum * 7 + hashStr(cur.playerId)) % candidates.length;
      const pick = candidates[idx];
      cur.cycleUsed.add(pick);
      cur.lastPick = pick;
      out[epNum].push({ playerId: cur.playerId, castawayId: pick });
    }
  }
  return out;
}

function buildPickEmDemo(data: DemoSeasonData, throughEpisode: number): LeagueState {
  const players = buildPlayers(data);
  const tribes = buildTribes(data, throughEpisode);
  const castaways = buildCastaways(data, new Map(), false, throughEpisode);
  const episodes = buildEpisodesBase(data, players, throughEpisode);
  const episodeNumbers = episodes.map((e) => e.number);
  const picksByEpisode = generatePicks(
    players.map((p) => p.id),
    episodeNumbers,
    (n) => data.castaways.filter((c) => c.exitEpisode >= n).map((c) => cid(c.key))
  );
  for (const ep of episodes) ep.picks = picksByEpisode[ep.number] || [];
  return {
    players,
    tribes,
    castaways,
    episodes,
    ...emptyMidSeasonAndDraft([], 0),
    settings: baseSettings(data, "pickem", 0),
  };
}

export function buildDemoState(data: DemoSeasonData, leagueTypeId: DemoLeagueTypeId, throughEpisode: number): LeagueState {
  if (leagueTypeId === "pickem") return buildPickEmDemo(data, throughEpisode);
  return buildRosterDemo(data, leagueTypeId, throughEpisode);
}
