import type { CatalogShow, EpisodeResearchPanel, LeagueState, Player, ResearchApplySummary, StagedResearchDecision } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { TOUR_BEN, TOUR_KAT, TOUR_ME } from "./rise-and-fall";
import { TOUR_CAST_NAMES } from "./samples";

// The commissioner's tour (docs/PLAN-commissioner-tour.md): a practice league on Survivor 51, the real
// show and cast, so the subject is one a player already knows. You run it from the start -- pick the
// show, create the league, import the cast and tune the rules, start the draft, then do the weekly
// job of getting an episode's results in -- and every place a real commissioner would copy a question
// into an AI chat and paste its answer back, the tour does the copying and gives you a ready-made
// answer to paste (samples.ts). Nothing is searched, saved or sent.
//
// The league starts with no cast: importing it is a step of the tour. The computer players (Ben and
// Kat) stand in for friends, draft from a fixed list, and set their own lineups.

/** The join code the tour's league shows. Nothing is sent: it joins nothing. */
export const TOUR_JOIN_CODE = "SURV51";
export const COMM_LEAGUE_NAME = "Sunday Survivors";
export const COMM_SHOW_NAME = "Survivor";
export const COMM_SEASON = 51;

/** What the create-a-league flow lists while the tour runs it: the real show, three of its seasons. */
export const TOUR_CATALOG: CatalogShow[] = [
  {
    slug: "survivor",
    name: "Survivor",
    castaway_term: "Castaway",
    tribe_term: "Tribe",
    art_url: null,
    curated: true,
    seasons: [
      { seasonNumber: 51, name: null, status: "airing", castSize: 21, premiereDate: "2026-09-23", finaleDate: null, resultsBy: "admin" },
      { seasonNumber: 49, name: null, status: "completed", castSize: 18, premiereDate: "2025-09-24", finaleDate: null, resultsBy: "admin" },
      { seasonNumber: 44, name: null, status: "completed", castSize: 18, premiereDate: null, finaleDate: null, resultsBy: "admin" },
    ],
  } as unknown as CatalogShow,
];

const PLAYERS: Player[] = [
  { id: TOUR_ME, name: "You", color: "#45a89a" },
  { id: TOUR_BEN, name: "Ben", color: "#d9704a", automated: true },
  { id: TOUR_KAT, name: "Kat", color: "#a76bb0", automated: true },
];

/** Your league the moment you create it: Ben and Kat in as computer players, no cast, no draft yet. */
export function buildCommissionerState(): LeagueState {
  const state = StateLogic.defaultState() as LeagueState;
  state.players = PLAYERS.map((p) => ({ ...p }));
  state.draftOrder = PLAYERS.map((p) => p.id);
  state.draftForceStarted = false;
  state.settings = {
    ...state.settings,
    leagueTypeId: "active-roster",
    ownershipMode: "exclusive",
    showId: "survivor",
    showFormat: "survivor",
    wikiSeason: COMM_SEASON,
    setupComplete: true,
    // A short roster keeps the practice draft to three picks.
    activeSlots: 2,
    benchSlots: 1,
  } as unknown as LeagueState["settings"];
  StateLogic.ensureEpisodeNumber(state, 1, false);
  return state;
}

// ---------- the computer players ----------

// Who Ben and Kat draft, best first: a fixed list, so the practice always plays out the same way. Mike
// Pinsky, who the tour sends home, is on neither.
const first = (name: string) => name.split(" ")[0];
const BOT_PREFERENCE: Record<string, string[]> = {
  [TOUR_BEN]: ["Ana", "Rob", "Devin", "Kristin", "Maggie", "Ori", "Lewis", "Carter"],
  [TOUR_KAT]: ["Jenna", "Alexis", "Aaliyah", "Cristian", "Brady", "Linnea", "Patt", "Eric"],
};

function byFirstName(state: LeagueState, names: string[]): string[] {
  return names.flatMap((n) => state.castaways.filter((c) => first(c.name) === n).map((c) => c.id));
}

/** Ben and Kat take every turn that's theirs, instantly, until it's yours or the draft ends. */
export function botsDraftSurvivor(state: LeagueState) {
  for (;;) {
    const turn = StateLogic.currentDraftTurn(state);
    if (!turn || turn.isComplete || !turn.playerId || turn.playerId === TOUR_ME) return;
    const free = new Set(StateLogic.freeAgents(state).map((c) => c.id));
    const pick = byFirstName(state, BOT_PREFERENCE[turn.playerId] ?? []).find((id) => free.has(id)) ?? [...free][0];
    if (!pick) return;
    StateLogic.draftToCurrentTurn(state, pick);
  }
}

/** Everyone's Episode `n` lineup, set for them: their first two still in. (Lineups are the player tour's lesson.) */
export function setAllLineups(state: LeagueState, n: number) {
  const ep = state.episodes.find((e) => e.number === n);
  if (!ep) return;
  for (const p of PLAYERS) {
    const mine = state.castaways.filter((c) => c.ownerIds.includes(p.id) && c.status === "active").map((c) => c.id);
    StateLogic.setActiveRosterLineup(state, ep.id, p.id, mine.slice(0, 2));
  }
  ep.lineupsLocked = true;
}

// ---------- the episode's results ----------

/** Episode `n`'s results as a research run would stage them (episodes 1 and 2). Made up; the tour says so. */
export function stageResults(n: number): StagedResearchDecision[] {
  const row = (i: number, d: Partial<StagedResearchDecision> & Pick<StagedResearchDecision, "kind" | "castawayName">): StagedResearchDecision => ({
    id: `tour_r_${n}_${i}`,
    method: "",
    eventType: "",
    juryVotes: null,
    confidence: "high",
    sources: ["https://survivor.fandom.com/wiki/Episode_1"],
    status: "pending",
    fromWiki: true,
    fromResearch: true,
    postMerge: false,
    ...d,
  });
  const rows: StagedResearchDecision[] = [];
  const add = (d: Parameters<typeof row>[1]) => rows.push(row(rows.length, d));
  if (n === 1) {
    add({ kind: "elimination", castawayName: "Mike Pinsky", method: "Voted Out" });
    for (const name of ["Ana Sani", "Rob Antonson", "Kristin Flickinger"]) add({ kind: "event", castawayName: name, eventType: "tribeImmunity" });
    // One result only one source reported: the row to look at before applying.
    add({ kind: "event", castawayName: "Jenna Doore", eventType: "idolFound", confidence: "low", fromWiki: false });
    add({ kind: "event", castawayName: "Jelly Loblack", eventType: "survivedVotes" });
  } else {
    add({ kind: "elimination", castawayName: "Eric Macksoud", method: "Voted Out" });
    for (const name of ["Brady Booker", "Maggie Nestor", "Patt Cannaday"]) add({ kind: "event", castawayName: name, eventType: "tribeImmunity" });
    add({ kind: "event", castawayName: "Cristian Chavez", eventType: "idolFound" });
    add({ kind: "event", castawayName: "Alexis Levine", eventType: "wentOnJourney" });
  }
  return rows;
}

const tourPrompt = (n: number) => [
  `Research episode ${n} of season 51 of "Survivor" and answer for every castaway below.`,
  "",
  "RULES",
  "  - Search for the episode recap and the show's wiki page. Name every page you actually read in sources.",
  "  - For each person answer: did they win tribe immunity, find an idol or advantage, get voted out?",
  '  - Don\'t guess. Answer "unknown" rather than fill in something you haven\'t seen reported.',
  "",
  "Answer with ONE JSON object and nothing else.",
  "",
  `Castaways: ${TOUR_CAST_NAMES.join(", ")}.`,
].join("\n");

/** The results page's panel for a tour episode: the question to copy until its answer is read, then what's staged. */
export function tourPanel(state: LeagueState, n: number, staged: StagedResearchDecision[] | undefined): EpisodeResearchPanel {
  const names = state.castaways.map((c) => c.name);
  const asked = !!staged;
  return {
    episodeNumber: n,
    showName: COMM_SHOW_NAME,
    season: COMM_SEASON,
    coverage: {
      researched: asked,
      researchedAt: asked ? new Date().toISOString() : null,
      total: names.length,
      covered: asked ? names : [],
      lowConfidence: [],
      missing: [],
      needsAsking: asked ? [] : names,
    },
    prompt: asked ? null : tourPrompt(n),
    betCount: 0,
    staged: (staged ?? []).map((d) => ({ ...d, inLeague: inLeague(state, n, d) })),
  } as EpisodeResearchPanel;
}

function inLeague(state: LeagueState, n: number, d: StagedResearchDecision): boolean {
  const ep = state.episodes.find((e) => e.number === n);
  const c = state.castaways.find((x) => x.name === d.castawayName);
  if (!ep || !c) return false;
  if (d.kind === "elimination") return ep.events.some((e) => e.castawayId === c.id);
  return (ep.scoringEvents || []).some((e) => e.type === d.eventType && e.castawayId === c.id);
}

/** Applies the rows you kept to the tour league, as the server's apply route would to a real one. */
export function applyTourResults(
  state: LeagueState,
  n: number,
  items: { kind: StagedResearchDecision["kind"]; castawayName: string; method: string; eventType: string }[]
): ResearchApplySummary {
  const out: ResearchApplySummary = { eliminations: [], events: [], other: [], skipped: [], unresolved: [] };
  const exits = items.filter((i) => i.kind === "elimination");
  if (exits.length) {
    const r = StateLogic.applyEliminationsImport(state, {
      episodes: [{ number: n, postMerge: false, eliminations: exits.map((i) => ({ name: i.castawayName, method: i.method })) }],
    });
    out.eliminations.push(...r.eliminations.map((e: { name: string; method: string }) => ({ name: e.name, method: e.method })));
  }
  const events = items.filter((i) => i.kind === "event" && i.eventType);
  if (events.length) {
    const r = StateLogic.applyScoringEventsImport(state, {
      episodes: [{ number: n, postMerge: false, events: events.map((i) => ({ name: i.castawayName, type: i.eventType, confidence: "high" })) }],
    });
    out.events.push(...r.events.map((e: { name: string; type: string }) => ({ name: e.name, type: e.type })));
  }
  const ep = state.episodes.find((e) => e.number === n);
  if (ep) ep.lineupsLocked = true;
  return out;
}
