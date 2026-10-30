import StateLogic from "@/lib/game/state-logic.js";
import * as Spec from "@/lib/game/game-spec/index.js";
import type { SpecContext, SpecDescription, SpecProblem, SpecWait } from "@/lib/game/game-spec/index.js";
import * as Capabilities from "@/lib/game/game-spec/capabilities.js";
import { pageName, trackerStatus } from "@/lib/game/capability-rows";
import tracker from "../../../tests/fixtures/engine-capabilities.json";
import type { LeagueState } from "@/lib/game/types";
import type { SessionUser } from "./auth-helpers";
import { contextOf, questionBook } from "./answers";
import { recordChange } from "./change-log";
import { HttpError, pool, syncStages } from "./db";
import { followLeagueProgress } from "./follows";
import { refused } from "./game-writes";
import { makeLeague } from "./new-game";
import { copyOf } from "./ours";
import { leaguePhases, scheduleOf, settleIn } from "./phase-starts";
import { seasonSchedules } from "./schedule";
import { startFrom } from "./start-game";
import { seatIn } from "./stages";

// The engine lab (docs/PLAN-start-a-game-gpt.md step A5; GET/POST /api/desk/lab): an admin's plain page for trying the engine's
// pieces on a real season before the UI exists. Pick a season, then paste a spec or pick a row of the capability tracker
// (tests/fixtures/engine-capabilities.json): the validator's verdict on this season (specProblems with the season's own ctx,
// specWaitsFor), the game in the engine's words (describeSpec: the sentence, How it works, the details), the league type it
// plays as, and the row's status there. "Start it as a test game" makes it a game on the admin's test couch (Settings › Test
// couch) or, locally, a zt- fixture's couch they're on (one a zt_ account made), through the game's writer (RosterLogic.setGame
// with the season's ctx), never on a real couch: from the next episode to air unless the spec says, with a line in its Recent
// changes. G1 plugs the GPT in here later: words, the draft, our check, the spec. A game in stages (step A12 part 1) starts as its
// game and a league for each stage (makeStages), tied to it (stages.ts).

export interface LabSeason {
  seasonId: string;
  label: string;
}

export interface LabCouch {
  couchId: string;
  name: string;
  /** The admin's test couch, or a zt- fixture's. */
  kind: "test" | "fixture";
}

export interface LabRow {
  id: string;
  /** The tracker's part: a dial's value, a worked example, a stretch request, the words corpus. */
  part: "dial" | "example" | "stretch" | "corpus";
  /** The dial's value, or the request's words. */
  what: string;
  /** "Survivor 51", "baseball: Red Sox–Yankees series". */
  page: string | null;
  spec: unknown;
  /** Its status as the tracker reads it (on its own page's rules): yes | step | new | decide | gpt, and its mark. */
  state: string;
  mark: string;
  step: string | null;
  note: string | null;
  decide: string | null;
}

export interface LabOptions {
  seasons: LabSeason[];
  couches: LabCouch[];
  rows: LabRow[];
}

export interface LabVerdict {
  seasonId: string;
  label: string;
  /** What's wrong with it on this season (with the season's ctx: the data-can-settle rule). */
  problems: SpecProblem[];
  /** What it needs that isn't built, and the step that brings it. */
  waits: SpecWait[];
  /** The league type the engine plays it as today, or null. */
  playsAs: string | null;
  describe: SpecDescription | null;
  /** The tracker row's status on this season, when a row was picked. */
  row: { id: string; state: string; mark: string; step: string | null } | null;
  /** It can be started as a test game. */
  startable: boolean;
}

const MARKS = Capabilities.MARKS as Record<string, string>;

/** The tracker's rows, each with its status on its own page's rules (as docs/ENGINE-CAPABILITIES.md says it). */
function labRows(): (LabRow & { raw: Record<string, unknown> })[] {
  return (Capabilities.rowsOf(tracker) as Record<string, unknown>[]).map((r) => {
    const st = trackerStatus(r);
    return {
      raw: r,
      id: String(r.id),
      part: r.part as LabRow["part"],
      what: r.dial ? `${r.dial}: ${r.what}` : String(r.words),
      page: pageName(r.page as never) || null,
      spec: r.spec ?? null,
      state: st.state,
      mark: MARKS[st.state],
      step: st.step,
      note: (r.note as string) ?? null,
      decide: (r.decide as string) ?? null,
    };
  });
}

interface LabSeasonRow {
  id: string;
  number: number;
  slug: string;
  label: string;
}

/** A season set up as a game, by id. */
async function seasonOf(seasonId: unknown): Promise<LabSeasonRow> {
  if (typeof seasonId !== "string" || !/^[0-9a-f-]{36}$/i.test(seasonId)) throw new HttpError(400, "Pick a season");
  const { rows } = await pool.query(
    "SELECT ss.id, ss.season_number, s.slug, s.name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1 AND s.set_up_at IS NOT NULL",
    [seasonId]
  );
  const r = rows[0];
  if (!r) throw new HttpError(404, "That season isn't a game yet");
  return { id: r.id, number: r.season_number, slug: r.slug, label: `${r.name}${r.season_number ? ` ${r.season_number}` : ""}` };
}

/** The rules a game on this couch and season plays by (the couch's own copy, Make it ours, else the season's), as its ctx. */
async function rulesOn(season: LabSeasonRow, couchId: string | null): Promise<{ ctx: SpecContext; copyId: string | null }> {
  const here = couchId
    ? (await pool.query("SELECT id FROM leagues WHERE couch_id = $1 AND deleted_at IS NULL AND state->'settings'->>'showId' = $2 AND state->'settings'->>'wikiSeason' = $3", [couchId, season.slug, String(season.number)])).rows.map((r) => r.id as string)
    : [];
  const copy = await copyOf(here);
  return { ctx: { ...contextOf(await questionBook(season.id, copy)), show: season.label }, copyId: copy?.id ?? null };
}

/** The rules a copy of a stage a format change starts plays by on its couch, as its ctx (change-stages.ts makeCopy, A12 part 2). */
export async function stageContext(seasonId: string, couchId: string | null): Promise<SpecContext> {
  return (await rulesOn(await seasonOf(seasonId), couchId)).ctx;
}

/**
 * The couches the admin may start a test game on: their test couch (Settings › Test couch: test_couches.owner_id, though
 * they're not on it themselves), and a zt- fixture's couch they're on (made by a zt_ account: local checks).
 */
async function labCouches(user: SessionUser): Promise<LabCouch[]> {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, true AS test FROM couches c JOIN test_couches t ON t.couch_id = c.id WHERE t.owner_id = $1
     UNION
     SELECT c.id, c.name, false FROM couches c JOIN couch_members m ON m.couch_id = c.id AND m.user_id = $1
       JOIN "user" u ON u.id = c.created_by WHERE u.username LIKE 'zt\\_%'
     ORDER BY 2`,
    [user.id]
  );
  return rows.map((r) => ({ couchId: r.id as string, name: r.name as string, kind: r.test ? "test" : "fixture" }));
}

/** GET: the seasons that are games, the couches a test game can go on, and the tracker's rows with their status. */
export async function labOptions(user: SessionUser): Promise<LabOptions> {
  const { rows } = await pool.query(
    `SELECT ss.id, ss.season_number, s.name FROM show_seasons ss JOIN shows s ON s.id = ss.show_id
      WHERE s.set_up_at IS NOT NULL ORDER BY s.name, ss.season_number DESC`
  );
  return {
    seasons: rows.map((r) => ({ seasonId: r.id as string, label: `${r.name}${r.season_number ? ` ${r.season_number}` : ""}` })),
    couches: await labCouches(user),
    rows: labRows().map((r) => ({ id: r.id, part: r.part, what: r.what, page: r.page, spec: r.spec, state: r.state, mark: r.mark, step: r.step, note: r.note, decide: r.decide })),
  };
}

/** A spec from what was pasted: JSON text or an object. */
function specFrom(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch (e) {
    throw new HttpError(400, `That isn't JSON: ${(e as Error).message}`);
  }
}

/** The verdict on a season's rules: what's wrong, what waits, the game in words, the row's status there. */
function verdictOf(season: LabSeasonRow, ctx: SpecContext, spec: unknown, rowId?: unknown): LabVerdict {
  const problems = Spec.specProblems(spec, ctx);
  const waits = problems.length ? [] : Spec.specWaitsFor(spec as never);
  const describe = problems.length ? null : Spec.describeSpec(spec as never, ctx);
  const playsAs = problems.length ? null : Spec.typeOf(spec as never);
  const picked = typeof rowId === "string" ? labRows().find((r) => r.id === rowId) : undefined;
  // The row as written, with the spec on the box in place of its own (a row with none says what it waits for).
  const st = picked ? Capabilities.statusOf({ ...picked.raw, spec }, ctx) : null;
  return {
    seasonId: season.id,
    label: season.label,
    problems,
    waits,
    playsAs,
    describe,
    row: picked && st ? { id: picked.id, state: st.state, mark: MARKS[st.state], step: st.step } : null,
    startable: !problems.length && !waits.length && !!playsAs,
  };
}

/** POST { action: "check", seasonId, spec, row? }: the validator's verdict and the game in words, on this season's rules. */
export async function labCheck(body: { seasonId?: unknown; spec?: unknown; row?: unknown }): Promise<LabVerdict> {
  const season = await seasonOf(body.seasonId);
  const { ctx } = await rulesOn(season, null);
  return verdictOf(season, ctx, specFrom(body.spec), body.row);
}

/**
 * POST { action: "start", seasonId, couchId, spec }: the spec as a test game on the admin's test couch or a zt- fixture's
 * couch, the admin its Commissioner, through the game's writer with the rules it plays by there. A spec that doesn't say where
 * it starts starts with the next episode to air, as Start a game's do. A refused setup takes its half-made league away.
 */
export async function labStart(user: SessionUser, body: { seasonId?: unknown; couchId?: unknown; spec?: unknown }): Promise<{ leagueId: string; name: string; seasonId: string }> {
  const season = await seasonOf(body.seasonId);
  const couch = (await labCouches(user)).find((c) => c.couchId === body.couchId);
  if (!couch) throw new HttpError(403, "Test games go on your test couch (Settings › Test couch) or a zt- fixture's couch");
  const { ctx, copyId } = await rulesOn(season, couch.couchId);
  const pasted = specFrom(body.spec) as Record<string, unknown>;
  const spec = withStart(pasted, startFrom((await seasonSchedules([season.id])).get(season.id), new Date()));
  const verdict = verdictOf(season, ctx, spec);
  if (!verdict.startable || !verdict.playsAs) throw new HttpError(409, verdict.problems[0]?.problem ?? verdict.waits[0]?.problem ?? "No game plays this way yet");
  const starter = (user as { username?: string | null }).username || user.name;
  const { rows: taken } = await pool.query("SELECT count(*)::int AS n FROM leagues WHERE couch_id = $1 AND name LIKE 'Lab · %' AND stage_of IS NULL", [couch.couchId]);
  const name = `Lab · ${verdict.describe?.name ?? (verdict.playsAs === "stages" ? "Stages" : "a game")}${taken[0].n ? ` ${taken[0].n + 1}` : ""}`;
  let seat = "";
  let made: string | null = null;
  // A game of questions starts from Survival Pool's type (nothing held, its results in its state), as Start a game's does; a game in
  // stages too (its stages are leagues of their own).
  const type = verdict.playsAs === "questions" || verdict.playsAs === "stages" ? "pickem" : verdict.playsAs;
  const leagueId = await makeLeague(
    { id: season.id, number: season.number, slug: season.slug },
    {
      name,
      createdBy: user.id,
      type,
      couchId: couch.couchId,
      rulebookId: copyId,
      before: (s) => {
        seat = StateLogic.addPlayer(s, starter).id;
      },
      after: async (s, client, id) => {
        made = id;
        await client.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, $3, 'commissioner')", [id, user.id, seat]);
        refused(StateLogic.setGame(s, spec as never, { ctx }), 409);
        // A game that asks by phase (step A7) records the season's phase starts and its windows now, as the desk and the
        // season sync do later (phase-starts.ts); one that starts or ends at a phase (A3, A12 part 1) settles it, when it's known.
        if (StateLogic.readsPhases(s) || StateLogic.startPhase(s) || StateLogic.endPhase(s)) settleIn(s, await leaguePhases(client, id, season.id), await scheduleOf(season.id));
        await recordChange(client, id, s, { userId: user.id, kind: "game.start", tier: 1, text: `${starter} started ${name} from the engine lab`, detail: { lab: true } });
      },
    }
  ).catch(async (e) => {
    // makeLeague writes the league's row before its setup: a refused setup leaves it behind, so take it away.
    if (made) await pool.query("DELETE FROM leagues WHERE id = $1 AND created_by = $2", [made, user.id]);
    throw e;
  });
  if (!leagueId) throw new HttpError(500, "Couldn't make the game, try again");
  // A game in stages: a league for each stage, tied to it; one that can't be made takes the game (and the stages made) away.
  if (verdict.playsAs === "stages") {
    await makeStages(user, leagueId, name, spec, season, couch.couchId, copyId, ctx).catch(async (e) => {
      await pool.query("DELETE FROM leagues WHERE id = $1 AND created_by = $2", [leagueId, user.id]);
      throw e;
    });
  }
  await followLeagueProgress(user.id, leagueId);
  return { leagueId, name, seasonId: season.id };
}

/** A spec that doesn't say where it starts starts with `from` (the next episode to air); a game in stages, its first stage. */
function withStart(pasted: Record<string, unknown>, from: number): Record<string, unknown> {
  if (!pasted || typeof pasted !== "object") return pasted;
  if (Array.isArray(pasted.stages)) {
    const [first, ...rest] = pasted.stages as Record<string, unknown>[];
    const game = first && typeof first.game === "object" && first.game ? (first.game as Record<string, unknown>) : null;
    const span = game && typeof game.span === "object" && game.span ? (game.span as Record<string, unknown>) : null;
    if (!game || (span && span.from !== undefined)) return pasted;
    return { ...pasted, stages: [{ ...first, game: { ...game, span: { ...(span ?? {}), from } } }, ...rest] };
  }
  return pasted.span ? pasted : { ...pasted, span: { from, to: null } };
}

/**
 * A game in stages' stage leagues (step A12 part 1, stages.ts), each an ordinary game on the same couch, season and rules, made as
 * the game was (makeLeague), its spec the stage's game written through its writer with the season's ctx (a later stage's exclusive
 * count waits for its draft to open: StateLogic.settleDraftShare), tied to the game (stage_of, stage_key), with the game's seats under
 * the same ids and their memberships; a stage that starts or ends at a phase settled when that's known.
 */
async function makeStages(user: SessionUser, parentId: string, name: string, spec: unknown, season: LabSeasonRow, couchId: string, copyId: string | null, ctx: SpecContext): Promise<void> {
  const full = Spec.fullSpec(spec as never);
  const { rows } = await pool.query("SELECT state FROM leagues WHERE id = $1", [parentId]);
  const parent = rows[0].state as LeagueState;
  for (const [i, stage] of (full.stages ?? []).entries()) {
    // A12 part 2: a stage a format change starts is made when its change comes (change-stages.ts), a copy each time.
    if (Spec.stageOn(stage)) continue;
    const kind = Spec.playsAs(stage.game);
    const stageCtx: SpecContext = i > 0 ? { ...ctx, pool: undefined } : ctx;
    await makeLeague(
      { id: season.id, number: season.number, slug: season.slug },
      {
        name: `${name} · ${stage.name || `Stage ${i + 1}`}`,
        createdBy: user.id,
        type: Spec.madeAs(kind as never),
        couchId,
        rulebookId: copyId,
        // The game's seats before the results arrive (so nobody's a late joiner), as the game's were; their memberships, and anyone
        // else's, with the sync below.
        before: (s) => {
          for (const p of parent.players.filter((x) => !x.ghost && !x.disabled)) seatIn(s, p);
        },
        after: async (s, client, id) => {
          refused(StateLogic.setGame(s, stage.game, { ctx: stageCtx }), 409);
          await client.query("UPDATE leagues SET stage_of = $2, stage_key = $3 WHERE id = $1", [id, parentId, stage.id]);
          if (StateLogic.readsPhases(s) || StateLogic.startPhase(s) || StateLogic.endPhase(s)) settleIn(s, await leaguePhases(client, id, season.id), await scheduleOf(season.id));
          await recordChange(client, id, s, { userId: user.id, kind: "game.start", tier: 1, text: `${stage.name || `Stage ${i + 1}`} of ${name}, from the engine lab`, detail: { lab: true, stageOf: parentId } });
        },
      }
    );
  }
  // Every stage's memberships, as the game's (stages.ts).
  await syncStages(parentId, parent);
}
