import type { Bet, Castaway, Episode, LeagueState, Player, Tribe } from "./types";

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

function buildTribes(data: DemoSeasonData): Tribe[] {
  return (data.groups || []).map((g) => ({ id: tid(g.key), name: g.name, color: g.color }));
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

function buildCastaways(data: DemoSeasonData, ownerOf: Map<string, string[]>, hasRoster: boolean, throughEpisode: number): Castaway[] {
  return data.castaways.map((c) => {
    const revealed = c.exitEpisode <= throughEpisode;
    return {
      id: cid(c.key),
      name: c.name,
      tribeId: c.groupKey ? tid(c.groupKey) : "",
      ownerIds: ownerOf.get(c.key) || [],
      photoUrl: c.photoUrl ?? undefined,
      status: revealed ? "eliminated" : "active",
      placementOrder: revealed ? c.placement : undefined,
      exitMethod: revealed ? c.exitMethod : undefined,
      exitEpisodeId: revealed ? epId(c.exitEpisode) : undefined,
      acquiredVia: hasRoster ? "draft" : null,
      formerOwnerId: null,
      departedVia: null,
    };
  });
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
      postMerge: false,
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

function emptyMidSeasonAndDraft(draftOrder: string[], draftPicksMade: number) {
  return {
    finalePredictions: [],
    finaleActual: { top3: [], winner: null },
    midSeason: { replenish: null, trade: null, log: [] },
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

function buildRosterDemo(data: DemoSeasonData, leagueTypeId: "classic-draft" | "active-roster", throughEpisode: number): LeagueState {
  const players = buildPlayers(data);
  const tribes = buildTribes(data);
  const { rosterSize, ownership } = computeRoster(data, leagueTypeId);
  const castaways = buildCastaways(data, ownerMap(ownership), true, throughEpisode);
  const episodes = buildEpisodesBase(data, players, throughEpisode);
  if (leagueTypeId === "active-roster") {
    // Every drafted castaway is always in the active lineup (activeSlots covers the whole roster) --
    // there's no real-season basis for who a fictional owner would bench week to week, so rather than
    // invent one, the demo just shows the full roster scoring every episode.
    for (const ep of episodes) {
      for (const o of ownership) ep.lineups[pid(o.playerKey)] = o.castawayKeys.map(cid);
    }
  }
  return {
    players,
    tribes,
    castaways,
    episodes,
    ...emptyMidSeasonAndDraft(players.map((p) => p.id), players.length * rosterSize),
    settings: baseSettings(data, leagueTypeId, rosterSize),
  };
}

// Deterministic (not random) so the same season+cursor always replays identically -- a simple
// rotating hash rather than Math.random, which would reshuffle picks on every rebuild.
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
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
  const tribes = buildTribes(data);
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
