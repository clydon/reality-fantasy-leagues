import type { Bet, Castaway, Episode, LeagueState, Player, Tribe } from "./types";

// Turns one researched demo season (db/migrations/0025_demo_seasons.sql, fetched via
// /api/demo-seasons/:id) into a real LeagueState, at whichever episode the viewer has scrubbed to.
// Unlike mock-state.ts's buildMockSeasonState() -- which is one hand-built league, always the same
// -- this is a small interpreter over data, so a season researched once can be replayed as any
// point in its own history without re-deriving anything.
//
// Only three league types exist, and this season format maps each demo season to exactly one of
// them (see the migration's comment) rather than trying to build all three for every season, which
// would need a lot of invented ownership/lineup detail with no real-season basis.

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

export interface DemoOwnership {
  playerKey: string;
  castawayKeys: string[];
}

export interface DemoSeasonData {
  id: string;
  showId: string;
  showName: string;
  seasonName: string;
  leagueTypeId: "classic-draft" | "active-roster" | "pickem";
  episodeCount: number;
  groups?: DemoGroup[];
  players: DemoPlayer[];
  castaways: DemoCastaway[];
  ownership?: DemoOwnership[];
  activeSlots?: number;
  benchSlots?: number;
  teamSize?: number;
  // Total picks already "made" across every player -- SnakeDraftStrategy.currentTurn reads this
  // against players.length * rosterSize to decide the draft is complete, so it has to equal the
  // real total from `ownership` exactly (the migration's generator script asserts this at
  // authoring time; see its assertSeason).
  draftPicksMade?: number;
  betEveryOtherEpisode?: boolean;
}

const pid = (key: string) => `demo_p_${key}`;
const tid = (key: string) => `demo_t_${key}`;
const cid = (key: string) => `demo_c_${key}`;
const epId = (n: number) => `demo_ep_${n}`;

function buildPlayers(data: DemoSeasonData): Player[] {
  return data.players.map((p) => ({ id: pid(p.key), name: p.name, color: p.color }));
}

function buildTribes(data: DemoSeasonData): Tribe[] {
  return (data.groups || []).map((g) => ({ id: tid(g.key), name: g.name, color: g.color }));
}

function ownersOf(data: DemoSeasonData, key: string): string[] {
  return (data.ownership || []).filter((o) => o.castawayKeys.includes(key)).map((o) => pid(o.playerKey));
}

function buildCastaways(data: DemoSeasonData, throughEpisode: number): Castaway[] {
  return data.castaways.map((c) => {
    const revealed = c.exitEpisode <= throughEpisode;
    return {
      id: cid(c.key),
      name: c.name,
      tribeId: c.groupKey ? tid(c.groupKey) : "",
      ownerIds: ownersOf(data, c.key),
      status: revealed ? "eliminated" : "active",
      placementOrder: revealed ? c.placement : undefined,
      exitMethod: revealed ? c.exitMethod : undefined,
      exitEpisodeId: revealed ? epId(c.exitEpisode) : undefined,
      acquiredVia: data.ownership ? "draft" : null,
      formerOwnerId: null,
      departedVia: null,
    };
  });
}

// One flavor question per show, cycling, so a fuller season doesn't repeat the same bet every time.
// These are gameplay filler (every real league already generates its own bets by hand) rather than
// researched facts, so there's no accuracy concern in inventing them -- only the murder/banishment
// order etc. above needed real sourcing.
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
      bets: data.betEveryOtherEpisode && n % 2 === 0 ? [genericBet(data, n, players)] : [],
      picks: [],
      scoringEvents: [],
      lineups: {},
      lineupsLocked: n < lastEp,
    });
  }
  return episodes;
}

function baseSettings(data: DemoSeasonData) {
  return {
    teamSize: data.teamSize ?? 3,
    bonusEnabled: !!data.betEveryOtherEpisode,
    replenishOrderBy: "mostPoints" as const,
    replenishEnabled: false,
    tradeEnabled: false,
    revealedThroughEpisode: null,
    startEpisode: 1,
    defaultBetPoints: 2,
    finalePredictionsEnabled: false,
    finaleTop3Points: 1,
    finaleWinnerPoints: 3,
    finalePredictionScope: "open",
    draftScheduledAt: null,
    leagueTypeId: data.leagueTypeId,
    showId: data.showId,
    showFormat: data.showId,
    setupComplete: true,
    ownershipMode: "exclusive" as const,
    wikiSeason: null,
    activeSlots: data.activeSlots ?? 3,
    benchSlots: data.benchSlots ?? 2,
    eventPoints: {},
    pickemCorrectPoints: 1,
  };
}

// draftPicksMade has to equal the real total across `ownership` -- SnakeDraftStrategy.currentTurn
// compares it against players.length * rosterSize to decide the draft is "complete", and a mismatch
// would either show a fictional "still drafting" turn or under/over-count picks. Falls back to one
// pick per player for a league type with no ownership at all (pickem never reads this).
function emptyMidSeasonAndDraft(data: DemoSeasonData, draftOrder: string[]) {
  return {
    finalePredictions: [],
    finaleActual: { top3: [], winner: null },
    midSeason: { replenish: null, trade: null, log: [] },
    draftOrder,
    draftPicksMade: data.draftPicksMade ?? draftOrder.length,
    draftForceStarted: true,
    blindDraft: { lockedPlayerIds: [], revealedAt: null },
  };
}

function buildClassicDraftDemo(data: DemoSeasonData, throughEpisode: number): LeagueState {
  const players = buildPlayers(data);
  const tribes = buildTribes(data);
  const castaways = buildCastaways(data, throughEpisode);
  const episodes = buildEpisodesBase(data, players, throughEpisode);
  return {
    players,
    tribes,
    castaways,
    episodes,
    ...emptyMidSeasonAndDraft(data, players.map((p) => p.id)),
    settings: baseSettings(data),
  };
}

function buildActiveRosterDemo(data: DemoSeasonData, throughEpisode: number): LeagueState {
  const players = buildPlayers(data);
  const tribes = buildTribes(data);
  const castaways = buildCastaways(data, throughEpisode);
  const episodes = buildEpisodesBase(data, players, throughEpisode);
  // Every drafted castaway is always in the active lineup (activeSlots covers the whole roster) --
  // there's no real-season basis for who a fictional owner would bench week to week, so rather than
  // invent one, the demo just shows the full roster scoring every episode.
  for (const ep of episodes) {
    for (const o of data.ownership || []) {
      ep.lineups[pid(o.playerKey)] = o.castawayKeys.map(cid);
    }
  }
  return {
    players,
    tribes,
    castaways,
    episodes,
    ...emptyMidSeasonAndDraft(data, players.map((p) => p.id)),
    settings: baseSettings(data),
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
  const castaways = buildCastaways(data, throughEpisode);
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
    ...emptyMidSeasonAndDraft(data, []),
    settings: baseSettings(data),
  };
}

export function buildDemoState(data: DemoSeasonData, throughEpisode: number): LeagueState {
  if (data.leagueTypeId === "active-roster") return buildActiveRosterDemo(data, throughEpisode);
  if (data.leagueTypeId === "pickem") return buildPickEmDemo(data, throughEpisode);
  return buildClassicDraftDemo(data, throughEpisode);
}
