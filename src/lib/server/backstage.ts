import crypto from "crypto";
import StateLogic from "@/lib/game/state-logic.js";
import { applyDecision, orderPlacementsByEpisode, type CastRef, type DecisionFact } from "@/lib/game/decision-apply";
import { previewLines, QUICK_DOUBTS, quickVerdict, trustRows, type PreviewLine, type QuickDoubt } from "@/lib/game/results-changes";
import { publicMediaSrc } from "@/lib/game/selectors";
import type { LeagueState, StagedResearchDecision } from "@/lib/game/types";
import { buildQuickPrompt, parseQuickAnswer } from "@db/bot-research.js";
import { leagueResearchStatus, researchFromPasteForLeague, resolveResearchContext } from "@db/episode-research.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import { resultsChange } from "./change-log";
import { pool, withLeagueLock, HttpError } from "./db";
import { inLeague, stagedForEpisode } from "./episode-research-apply";
import { couchGames, latestBatch, type ChangeLine } from "./league-changes";
import { readyLeague } from "./league-read";
import { leagueStates } from "./league-states";
import { notifyEpisodeResults } from "./push-events";
import { latestAired, seasonSchedules, upNext } from "./schedule";
import { applyHeldTribesIfDue } from "./season-cast";
import { seasonCastRefs } from "./season-decisions";
import type { Game } from "./show-space";

// Backstage › Results (docs/PLAN-new-design.md step 5): getting an episode's results into every game the couch has on
// a season, for whoever runs them. Two passes, both by Ask an AI (copy and paste is the free way; 6c adds One tap and
// Autopilot): the quick check (who went home, minutes after airing: Survival Pool and Outlast settle, the episode goes
// to its early stage) and the full results (every scoring moment: final). Research is shared per season episode
// (db/episode-research.js stages it into season_decisions); applying it is per game, through decision-apply.ts.
//
// Option 5B (2026-10-24): what's trusted applies on its own, without being shown (quickVerdict and trustRows in
// results-changes.ts), so whoever runs the game can still watch the episode fresh; only what the sources disagree on
// waits, and nothing names who went home until they ask (`show`). Each apply is one batch in Recent changes
// (league_changes, change-log.ts) with Undo until the next episode airs; choosing results by hand is tier 2 (a preview of
// what changes first).

export interface BackstageScope {
  user: SessionUser;
  seasonId: string;
  couchId: string;
  /** The couch's games on the season that you run, in the couch's order. */
  games: Game[];
  resultsBy: "admin" | "leagues";
}

/** Whoever runs a game on this couch's season (Commissioner or Game admin). 403 for anyone else on the couch. */
export async function backstageScope(user: SessionUser, seasonId: string, couchId: string | null): Promise<BackstageScope> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  if (!couchId) throw new HttpError(400, "couch required");
  const { rows } = await pool.query("SELECT results_by FROM show_seasons WHERE id = $1", [seasonId]);
  if (!rows.length) throw new HttpError(404, "Season not found");
  const { here, runs } = await couchGames(user, seasonId, couchId);
  const games = here.filter((g) => runs.has(g.leagueId));
  if (!games.length) throw new HttpError(403, "Backstage is for whoever runs a game here");
  return { user, seasonId, couchId, games, resultsBy: rows[0].results_by };
}

interface Loaded {
  game: Game;
  state: LeagueState;
  /** A league catching up gets an episode's results when it reveals it (as classic's research panel). */
  through: number | null;
}

async function load(scope: BackstageScope): Promise<Loaded[]> {
  const states = await leagueStates(scope.games.map((g) => g.leagueId));
  const out: Loaded[] = [];
  for (const game of scope.games) {
    const s = states.get(game.leagueId);
    if (!s) continue;
    const state = await readyLeague(game.leagueId, s);
    out.push({ game, state, through: StateLogic.RevealLogic.revealedThrough(state) });
  }
  return out;
}

const takes = (l: Loaded, episode: number) => l.through === null || episode <= l.through;
type Stage = "none" | "early" | "final";
const stageIn = (state: LeagueState, n: number): Stage => {
  const ep = state.episodes.find((e) => e.number === n);
  return (ep && StateLogic.resultsStage(ep)) || "none";
};
const RANK: Record<Stage, number> = { none: 0, early: 1, final: 2 };

// ---- the read ----

export interface Face {
  name: string;
  photo: string | null;
}

export interface ResultRow extends Face {
  /** A staged result's id (season_decisions); null for one already in the games. */
  id: string | null;
  kind: string;
  /** What happened, in the show's words: "Voted Out", "Individual immunity win". */
  label: string;
  method: string | null;
  eventType: string | null;
  confidence: string | null;
  sources: number;
}

export interface Need {
  id: "quick" | "full" | "waiting";
  episode: number;
  title: string;
  detail: string;
}

export interface BackstageEpisode {
  number: number;
  airAt: string | null;
  /** The least far along of your games that can take it. */
  stage: Stage;
  /** Your games that can't take it yet (catching up), by name. */
  later: string[];
  /** The newest who-went-home and full-results batches in Recent changes (undone ones included). */
  quick: (ChangeLine & { count: number; own: boolean }) | null;
  full: (ChangeLine & { count: number; own: boolean }) | null;
  /** Staged results not in your games yet: they wait for you. */
  waiting: number;
}

/** What Show me opens: names, faces and what happened. */
export interface Shown {
  out: (Face & { method: string | null })[];
  applied: ResultRow[];
  waiting: ResultRow[];
  /** Who's still in going into it, for entering who went home yourself. */
  cast: Face[];
  methods: string[];
}

export interface Backstage {
  games: { leagueId: string; name: string; gameName: string; gameType: string; role: string | null }[];
  resultsBy: "admin" | "leagues";
  /** The episodes still open (aired, not final everywhere), oldest first; the one asked about, else the first open. */
  open: { number: number; stage: Stage }[];
  episode: BackstageEpisode | null;
  /** The next to air. */
  next: { number: number; airAt: string | null } | null;
  needs: Need[];
  shown?: Shown;
}

const ART = (state: LeagueState) => new Map(state.castaways.map((c) => [c.id, c]));

function rowsIn(state: LeagueState, n: number): ResultRow[] {
  const ep = state.episodes.find((e) => e.number === n);
  if (!ep) return [];
  const cast = ART(state);
  const format = StateLogic.formatOf(state);
  const label = new Map(format.events.map((e) => [e.id, e.label]));
  const face = (id: string) => ({ name: cast.get(id)?.name ?? "Someone", photo: publicMediaSrc(cast.get(id)?.photoUrl) });
  return [
    ...ep.events.map((e) => ({ ...face(e.castawayId), id: null, kind: "elimination", label: e.method, method: e.method, eventType: null, confidence: null, sources: 0 })),
    ...(ep.scoringEvents ?? []).map((e) => ({ ...face(e.castawayId), id: null, kind: "event", label: label.get(e.type) ?? e.type, method: null, eventType: e.type, confidence: null, sources: 0 })),
  ];
}

/** The staged results for an episode that aren't in your games yet, with the season cast's photos. */
async function waitingRows(scope: BackstageScope, first: LeagueState, n: number): Promise<{ rows: StagedResearchDecision[]; refs: CastRef }> {
  const client = await pool.connect();
  let refs: CastRef = [];
  try {
    refs = await seasonCastRefs(client, scope.seasonId);
  } finally {
    client.release();
  }
  const staged = await stagedForEpisode(pool, scope.seasonId, n);
  return { rows: staged.filter((d) => d.status !== "rejected" && !inLeague(first, n, d, refs)), refs };
}

function asRow(state: LeagueState, d: StagedResearchDecision, refs: CastRef): ResultRow {
  const format = StateLogic.formatOf(state);
  const { castaway } = StateLogic.Core.findSeasonCastaway(state, d.castawayName, refs);
  const label = d.kind === "event" ? (format.events.find((e) => e.id === d.eventType)?.label ?? d.eventType) : d.kind === "elimination" ? d.method : d.method || d.kind;
  return {
    id: d.id,
    name: castaway?.name ?? d.castawayName,
    photo: publicMediaSrc(castaway?.photoUrl),
    kind: d.kind,
    label: label || d.kind,
    method: d.method ?? null,
    eventType: d.eventType ?? null,
    confidence: d.confidence ?? null,
    sources: (d.sources || []).length,
  };
}

/** Who's still in going into episode n (and whoever left in it), for entering who went home by hand. */
function castGoingInto(state: LeagueState, n: number): Face[] {
  const ep = state.episodes.find((e) => e.number === n);
  return state.castaways
    .filter((c) => c.status !== "eliminated" || (ep && c.exitEpisodeId === ep.id))
    .map((c) => ({ name: c.name, photo: publicMediaSrc(c.photoUrl) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const day = (iso: string | null, tz: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { weekday: "short", timeZone: tz }) : null;

/**
 * Backstage for a couch's season: the episodes still open and where each stands in your games (no names), what needs
 * you, and, for the one asked about, its newest batches in Recent changes. `show`: Show me, the names and what happened.
 */
export async function backstageRead(scope: BackstageScope, opts: { episode?: number | null; show?: boolean } = {}): Promise<Backstage> {
  const loaded = await load(scope);
  const schedule = (await seasonSchedules([scope.seasonId])).get(scope.seasonId);
  const aired = latestAired(schedule);
  const coming = upNext(schedule);
  const tz = schedule?.airTz ?? "America/New_York";
  const games = scope.games.map((g) => ({ leagueId: g.leagueId, name: g.name, gameName: g.gameName, gameType: g.gameType, role: g.yourRole }));
  const out: Backstage = { games, resultsBy: scope.resultsBy, open: [], episode: null, next: null, needs: [] };
  if (coming && !coming.live) out.next = { number: coming.number, airAt: coming.airAt };
  else if (coming?.live) out.next = { number: coming.number + 1, airAt: schedule?.episodes.find((e) => e.number === coming.number + 1)?.airAt ?? null };
  if (!loaded.length || !aired) return out;

  // Where each aired episode stands: the least far along of the games that can take it. Open: from the first that
  // isn't final after the last that is.
  const stageOf = (n: number): Stage => {
    const can = loaded.filter((l) => takes(l, n));
    return can.length ? can.map((l) => stageIn(l.state, n)).reduce((a, b) => (RANK[b] < RANK[a] ? b : a)) : "final";
  };
  let lastFinal = 0;
  for (let n = aired; n >= 1; n--) {
    if (stageOf(n) === "final") {
      lastFinal = n;
      break;
    }
  }
  for (let n = lastFinal + 1; n <= aired; n++) out.open.push({ number: n, stage: stageOf(n) });
  const n = opts.episode && opts.episode >= 1 && opts.episode <= aired ? opts.episode : (out.open[0]?.number ?? aired);

  const first = loaded.find((l) => takes(l, n)) ?? loaded[0];
  const ids = loaded.map((l) => l.game.leagueId);
  const runs = new Set(ids);
  const { rows: waiting, refs } = await waitingRows(scope, first.state, n);
  const airAt = schedule?.episodes.find((e) => e.number === n)?.airAt ?? null;
  out.episode = {
    number: n,
    airAt,
    stage: stageOf(n),
    later: loaded.filter((l) => !takes(l, n)).map((l) => l.game.name),
    quick: await latestBatch(ids, n, "results.quick", runs),
    full: await latestBatch(ids, n, "results.full", runs),
    waiting: waiting.length,
  };

  for (const o of out.open) {
    const w = o.number === n ? waiting.length : (await waitingRows(scope, first.state, o.number)).rows.length;
    const when = day(schedule?.episodes.find((e) => e.number === o.number)?.airAt ?? null, tz);
    if (w) out.needs.push({ id: "waiting", episode: o.number, title: `${w} ${w === 1 ? "result waits" : "results wait"} for you`, detail: `Episode ${o.number} · the sources don't agree` });
    else if (o.stage === "none") out.needs.push({ id: "quick", episode: o.number, title: `Who went home in Episode ${o.number}?`, detail: `${when ? `Aired ${when} · ` : ""}ask an AI, or enter it yourself` });
    else if (o.stage === "early") out.needs.push({ id: "full", episode: o.number, title: `Fill in Episode ${o.number}'s full scores`, detail: "Who went home is in · one paste scores every game" });
  }

  if (opts.show) {
    out.shown = {
      out: rowsIn(first.state, n).filter((r) => r.kind === "elimination").map((r) => ({ name: r.name, photo: r.photo, method: r.method })),
      applied: rowsIn(first.state, n),
      waiting: waiting.map((d) => asRow(first.state, d, refs)),
      cast: castGoingInto(first.state, n),
      methods: StateLogic.formatOf(first.state).exitMethods,
    };
  }
  return out;
}

// ---- the questions ----

/** The question for Ask an AI: `quick` (who went home) or `full` (everything, research's checklist). */
export async function resultsPrompt(scope: BackstageScope, n: number, kind: "quick" | "full", again = false): Promise<{ prompt: string | null; task: string }> {
  const loaded = await load(scope);
  const first = loaded.find((l) => takes(l, n));
  if (!first) throw new HttpError(400, `Reveal Episode ${n} first: your games are catching up, and get its results when they reveal it.`);
  try {
    if (kind === "quick") {
      const ctx = await resolveResearchContext(pool, first.game.leagueId, n);
      const schedule = (await seasonSchedules([scope.seasonId])).get(scope.seasonId);
      const airAt = schedule?.episodes.find((e) => e.number === n)?.airAt;
      const stillIn = castGoingInto(first.state, n).map((c) => c.name);
      return {
        prompt: buildQuickPrompt({ ...ctx, castNames: stillIn }, airAt ? new Date(airAt) : null, schedule?.airTz ?? "America/New_York"),
        task: `finding out who went home in episode ${n}`,
      };
    }
    const status = await leagueResearchStatus(pool, first.game.leagueId, n, { again });
    return { prompt: status.prompt, task: `researching what happened in episode ${n}` };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, e instanceof Error ? e.message : "Couldn't build the question");
  }
}

// ---- applying ----

/** One result to apply, as decision-apply.ts reads it. */
type Fact = DecisionFact;

const fact = (n: number, f: { kind: Fact["kind"]; castawayName: string; method?: string | null; eventType?: string | null; units?: number | null; postMerge?: boolean; juryVotes?: number | null }): Fact => ({
  episode_number: n,
  post_merge: !!f.postMerge,
  kind: f.kind,
  castaway_name: f.castawayName,
  method: f.method ?? "",
  event_type: f.eventType ?? "",
  jury_votes: f.juryVotes ?? null,
  units: f.units != null ? String(f.units) : null,
  applied: null,
});

/** Applies results to one league's state: who went home marks the episode early (when nothing else is in), the full results final. */
function applyFacts(state: LeagueState, n: number, facts: Fact[], refs: CastRef, quick: boolean): { applied: number; skipped: string[] } {
  const ep = state.episodes.find((e) => e.number === n);
  const stageBefore = ep ? StateLogic.resultsStage(ep) : null;
  let applied = 0;
  const skipped: string[] = [];
  let outs = false;
  for (const f of facts) {
    const { detail, skip } = applyDecision(state, f, refs);
    if (!detail) skipped.push(`${f.castaway_name}: ${skip}`);
    else if (!detail.preexisting) {
      applied++;
      if (f.kind === "elimination") outs = true;
    }
  }
  if (outs) orderPlacementsByEpisode(state);
  const now = state.episodes.find((e) => e.number === n);
  if (now && applied) {
    if (quick && stageBefore === null) StateLogic.setResultsStage(state, now.id, "early");
    if (!quick && facts.some((f) => f.kind === "event")) StateLogic.setResultsStage(state, now.id, "final");
  }
  return { applied, skipped };
}

const WORDS = {
  quick: (n: number, own: boolean) => (own ? `Applied who went home in Episode ${n} on its own` : `Entered who went home in Episode ${n}`),
  full: (n: number, own: boolean, count: number) => (own ? `Applied Episode ${n}'s results on their own (${count})` : `Applied ${count} of Episode ${n}'s results`),
};

/**
 * Applies results to every game you run here that can take the episode: one league at a time under its lock, the same
 * batch in Recent changes, pushes as classic sends them. Returns how many games changed.
 */
async function applyToGames(scope: BackstageScope, n: number, facts: Fact[], opts: { quick: boolean; own: boolean; detail?: Record<string, unknown> }): Promise<{ games: number; skipped: string[]; batch: string }> {
  const loaded = (await load(scope)).filter((l) => takes(l, n));
  if (!loaded.length) throw new HttpError(400, `Reveal Episode ${n} first: your games are catching up.`);
  const batch = crypto.randomUUID();
  const kind = opts.quick ? "results.quick" : "results.full";
  const text = (count: number) => (ep: number) => (opts.quick ? WORDS.quick(ep, opts.own) : WORDS.full(ep, opts.own, count));
  let games = 0;
  const skipped: string[] = [];
  for (const l of loaded) {
    let out = { applied: 0, skipped: [] as string[] };
    const state = await withLeagueLock(
      l.game.leagueId,
      async (s, client) => {
        const refs = await seasonCastRefs(client, scope.seasonId);
        out = applyFacts(s, n, facts, refs, opts.quick);
        if (out.applied) await applyHeldTribesIfDue(client, s);
      },
      resultsChange(scope.user.id, { number: n }, text(facts.length), { kind, batch, detail: { count: facts.length, own: opts.own, ...opts.detail } })
    );
    if (out.applied) games++;
    skipped.push(...out.skipped.map((s) => `${l.game.name}: ${s}`));
    const ep = state.episodes.find((e) => e.number === n);
    if (ep && out.applied && facts.some((f) => f.kind === "elimination")) notifyEpisodeResults(l.game.leagueId, state, ep.id, scope.user.id);
  }
  return { games, skipped, batch };
}

export type PasteResult =
  | { kind: "quick"; applied: { games: number; sources: number; batch: string } | null; waiting: { doubt: QuickDoubt; line: string; out: { name: string; method: string; matched: boolean }[]; sources: number } | null }
  | { kind: "full"; applied: number; waiting: number; games: number; problems: number; batch: string | null };

/**
 * An answer pasted back from Ask an AI. The quick check applies on its own when its sources agree (quickVerdict), else
 * waits with what it found (names included: whoever pasted it has the answer already; the screen keeps them behind Show
 * me). The full results are staged for the season (shared), then whatever's trusted (trustRows) applies on its own.
 */
export async function pasteResults(scope: BackstageScope, n: number, kind: "quick" | "full", answer: unknown, opts: { again?: boolean; confirmed?: boolean } = {}): Promise<PasteResult> {
  if (typeof answer !== "string" || !answer.trim()) throw new HttpError(400, "Paste the AI's answer first.");
  const loaded = await load(scope);
  const first = loaded.find((l) => takes(l, n));
  if (!first) throw new HttpError(400, `Reveal Episode ${n} first: your games are catching up.`);

  if (kind === "quick") {
    const stillIn = castGoingInto(first.state, n).map((c) => c.name);
    let q;
    try {
      q = parseQuickAnswer(answer, stillIn);
    } catch {
      throw new HttpError(400, "That doesn't look like the whole answer. Copy all of it, from { to }.");
    }
    const verdict = quickVerdict(q, StateLogic.formatOf(first.state).exitMethods);
    if (verdict.trusted) {
      const facts = verdict.out.map((o) => fact(n, { kind: "elimination", castawayName: o.name, method: o.method }));
      const r = await applyToGames(scope, n, facts, { quick: true, own: true, detail: { sources: q.sources.length } });
      return { kind: "quick", applied: { games: r.games, sources: q.sources.length, batch: r.batch }, waiting: null };
    }
    return {
      kind: "quick",
      applied: null,
      waiting: {
        doubt: verdict.doubt!,
        line: QUICK_DOUBTS[verdict.doubt!],
        out: q.left.map((p) => ({ name: p.name, method: verdict.out.find((o) => o.name === p.name)?.method ?? "Other", matched: p.matched })),
        sources: q.sources.length,
      },
    };
  }

  let run;
  try {
    run = await researchFromPasteForLeague(pool, first.game.leagueId, n, answer, { again: opts.again === true, confirmed: opts.confirmed === true });
  } catch (e) {
    // Not refused: the sheet asks whether it really is this episode, then sends the same answer with `confirmed`.
    if (e instanceof Error && (e as Error & { code?: string }).code === "EPISODE_MISMATCH") throw new HttpError(409, e.message);
    throw new HttpError(400, e instanceof Error ? e.message : "That answer couldn't be read.");
  }
  const after = await load(scope);
  const lead = after.find((l) => takes(l, n)) ?? first;
  const { rows } = await waitingRows(scope, lead.state, n);
  const said = (run.merged?.disagreements ?? []).map((d) => d.toLowerCase());
  const disputed = new Set(rows.map((r) => r.castawayName.toLowerCase()).filter((name) => said.some((d) => d.startsWith(`${name}:`))));
  const out = lead.state.castaways.filter((c) => c.exitEpisodeId === lead.state.episodes.find((e) => e.number === n)?.id).map((c) => c.name);
  const { trusted, waiting } = trustRows(rows, { disputed, out });
  let applied: { games: number; batch: string } | null = null;
  if (trusted.length) {
    const facts = trusted.map((d) => fact(n, { kind: d.kind, castawayName: d.castawayName, method: d.method, eventType: d.eventType, units: d.units, postMerge: d.postMerge, juryVotes: d.juryVotes }));
    applied = await applyToGames(scope, n, facts, { quick: false, own: true });
  }
  return { kind: "full", applied: trusted.length, waiting: waiting.length, games: applied?.games ?? 0, problems: run.problems.length, batch: applied?.batch ?? null };
}

/** What you chose to apply: a staged result by id (possibly corrected), or who went home by name (entered by hand). */
export interface Chosen {
  id?: string;
  castawayName?: string;
  method?: string;
  eventType?: string;
}

/** The chosen results as facts: staged ones from season_decisions (never the client's word for kind or episode). */
async function chosenFacts(scope: BackstageScope, state: LeagueState, n: number, items: Chosen[], quick: boolean): Promise<Fact[]> {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, "Pick at least one result.");
  const format = StateLogic.formatOf(state);
  if (quick) {
    return items.map((i) => {
      const name = typeof i.castawayName === "string" ? i.castawayName.trim() : "";
      const { castaway } = StateLogic.Core.findCastawayByName(state, name);
      if (!castaway) throw new HttpError(400, `${name || "Someone"} isn't in this cast.`);
      const method = typeof i.method === "string" && format.exitMethods.includes(i.method) ? i.method : null;
      if (!method) throw new HttpError(400, `Say how ${castaway.name} left.`);
      return fact(n, { kind: "elimination", castawayName: castaway.name, method });
    });
  }
  const staged = new Map((await stagedForEpisode(pool, scope.seasonId, n)).map((d) => [d.id, d]));
  const str = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v.trim() : fallback);
  return items.map((i) => {
    const d = staged.get(String(i.id));
    if (!d) throw new HttpError(400, "One of those results is no longer staged for this episode. Open it again.");
    return fact(n, {
      kind: d.kind,
      castawayName: str(i.castawayName, d.castawayName),
      method: d.kind === "elimination" && typeof i.method === "string" && format.exitMethods.includes(i.method) ? i.method : d.method,
      eventType: str(i.eventType, d.eventType ?? ""),
      units: d.units,
      postMerge: d.postMerge,
      juryVotes: d.juryVotes,
    });
  });
}

/** Who sits in each seat of these leagues, for the preview's faces. */
async function seatUsers(leagueIds: string[]): Promise<Map<string, string>> {
  const { rows } = await pool.query("SELECT player_id, user_id FROM league_memberships WHERE league_id = ANY($1::uuid[]) AND player_id IS NOT NULL", [leagueIds]);
  return new Map(rows.map((r) => [r.player_id, r.user_id]));
}

/**
 * Results you chose (tier 2): `preview` works out what they'd do to every game here without writing anything (the
 * sheet's lines); otherwise they're applied, one batch with Undo. `quick`: who went home, entered by hand or confirmed
 * from a quick check that waited.
 */
export async function applyChosen(scope: BackstageScope, n: number, items: Chosen[], opts: { preview?: boolean; quick?: boolean }): Promise<{ lines: PreviewLine[]; games: number } | { games: number; skipped: string[]; batch: string }> {
  const loaded = (await load(scope)).filter((l) => takes(l, n));
  if (!loaded.length) throw new HttpError(400, `Reveal Episode ${n} first: your games are catching up.`);
  const facts = await chosenFacts(scope, loaded[0].state, n, items, !!opts.quick);
  if (opts.preview) {
    const users = await seatUsers(loaded.map((l) => l.game.leagueId));
    const client = await pool.connect();
    let refs: CastRef = [];
    try {
      refs = await seasonCastRefs(client, scope.seasonId);
    } finally {
      client.release();
    }
    const lines: PreviewLine[] = [];
    const seen = new Set<string>();
    for (const l of loaded) {
      const after = structuredClone(l.state);
      applyFacts(after, n, facts, refs, !!opts.quick);
      for (const line of previewLines(l.state, after, l.game.gameName, (p) => users.get(p) ?? null)) {
        // Someone going out shows once, plus once more for each game whose teams lose them.
        if (line.face.kind === "castaway") {
          if (seen.has(line.face.name) && !line.change) continue;
          seen.add(line.face.name);
        }
        lines.push(line);
      }
    }
    return { lines, games: loaded.length };
  }
  return applyToGames(scope, n, facts, { quick: !!opts.quick, own: false });
}
