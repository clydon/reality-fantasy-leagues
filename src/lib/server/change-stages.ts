import StateLogic from "@/lib/game/state-logic.js";
import type { ChangePlan, ChangePlanEntry, ChangePlanInput, StageTrigger } from "@/lib/game/state-logic.js";
import * as Spec from "@/lib/game/game-spec/index.js";
import type { GameSpec, SpecStage } from "@/lib/game/game-spec/index.js";
import { at, stageTriggers } from "@/lib/game/formats/format-timeline.js";
import type { Timeline } from "@/lib/game/formats/format-timeline.js";
import { showWords } from "@/lib/game/show-words";
import type { LeagueState } from "@/lib/game/types";
import { timelineForShow } from "@db/format-timeline.js";
import { recordChange } from "./change-log";
import { HttpError, pool, syncStages, tx, withLeagueLock } from "./db";
import { makeLeague } from "./new-game";
import { leaguePhases, openEpisode, scheduleOf, settleIn } from "./phase-starts";
import type { SeasonSchedule } from "./schedule";
import { seatIn, seatsToMirror, takeStageAway } from "./stages";

// A stage a format change starts (docs/PLAN-start-a-game-gpt.md step A12 part 2; the tracker's p7: "automatically start a new draft
// stage whenever there is a major format change such as split into teams or split into individuals"). A game in stages whose later
// stage says `on` { change: the kinds that count, again } gets a copy of that stage, a league of its own like any stage (stages.ts),
// when research is sure the format changed that way: made here, mid-season, keyed `<stage id>@<the change's id>` and tied to the game,
// its draft opening at its start (the episode before has results by then) and counted then (stages.ts settleStageDraft); the stage
// before it (or the copy before) ends with the episode before. Where everything plays is StateLogic.StageLogic.changePlan, worked out
// from the season's format state over time (db/format-timeline.js, from stored research on every read) and the game's own record
// (state.changeStages: when each change was first seen, the maker's answers, what Recent changes has said, the copies taken away), so
// a corrected report works itself out: a copy whose change research no longer says is taken away (soft-deleted, so the overall no
// longer counts what it scored, as a result taken back is), and the stage before it plays on; one that comes back is restored, from
// the first episode still open. Research missing for a while (an episode's answer withdrawn or being asked again) takes nothing away:
// a copy whose change came from an episode with no report now stands as it was. A change research isn't sure of is held and said,
// never acted on. With the maker's OK (extras.changes.ok 'maker') a change waits for it until the lock of the episode it would start
// with, then the game's default (unanswered); the maker's 'skip' takes a started copy away.
//
// Where it's noticed: the season sync (season-decisions.ts syncSeasonLeagues), after every result and every research answer goes
// in, so a change acts as soon as research that says it is stored and its episode's results are in (the full research lands about
// 9 hours after an episode, with the results: the copy starts at the next lock, its draft open in the week between), and a maker
// who hasn't answered by the lock has the default applied by the next sync (the episode's early results). And the maker's answer
// (the stage-changes route). Nothing else writes it.

type Season = { id: string; number: number; slug: string };
type Reads = { tl: Timeline | null; schedule: SeasonSchedule | undefined };
/** What a season's settles share: its format state over time and its schedule, read once (settleSeasonChanges). */
type SeasonReads = Map<string, Promise<Reads>>;

/** The kinds of change in words ("everyone went on to play on their own"), for Recent changes. The words are the user's (U1). */
const CHANGE_WORDS: Record<string, string> = {
  "teams-formed": "teams formed",
  "pairs-formed": "pairs formed",
  "split-into-individuals": "everyone went on to play on their own",
  merge: "the merge",
  swap: "a swap",
  newcomer: "someone new came in",
  "new-phase": "a new phase began",
};
const changeWords = (t: StageTrigger) => (t.kind === "swap" && t.allNew ? "a swap that left no group as it was" : CHANGE_WORDS[t.kind] ?? t.kind);

interface Stage {
  id: string;
  key: string;
  state: LeagueState;
  deleted: boolean;
}

interface Read {
  parentId: string;
  parent: LeagueState;
  name: string;
  couchId: string | null;
  rulebookId: string | null;
  createdBy: string | null;
  season: Season;
  episodeWord: string;
  stages: Stage[];
  input: ChangePlanInput;
}

/** What a settle did: the plan, and the copies made, restored, moved and taken away. */
export interface ChangeSettled {
  plan: ChangePlan;
  seasonId: string;
  made: string[];
  restored: string[];
  moved: string[];
  undone: string[];
}

/**
 * The changes each stage a change starts reads: the timeline's (stageTriggers, of its kinds), and, for a live copy whose change came
 * from an episode research has no report for now (withdrawn, or being asked again), its change as the copy has it, so missing research
 * takes nothing away (only a report that says something else does).
 */
function triggersFor(parent: LeagueState, tl: Timeline | null, live: Stage[]): ChangePlanInput["triggers"] {
  const out: ChangePlanInput["triggers"] = {};
  for (const s of StateLogic.StageLogic.onStages(parent)) out[s.id] = tl ? stageTriggers(tl, Spec.stageOn(s)?.change) : { act: [], held: [] };
  for (const c of live) {
    const stage = StateLogic.StageLogic.copyOf(c.key);
    const id = c.key.slice(c.key.indexOf("@") + 1);
    const m = /^(\d+):([\w-]+?)(?::\d+)?$/.exec(id);
    if (!stage || !out[stage] || !m) continue;
    const n = Number(m[1]);
    if ((tl && at(tl, n)?.known) || out[stage].act.some((t) => t.id === id)) continue;
    const from = StateLogic.startEpisode(c.state) ?? n + 1;
    out[stage].act.push({ id, kind: m[2], allNew: false, from, when: null, episode: n, what: "" });
  }
  return out;
}

/** A game in stages whose stages a format change starts, read with everything its plan needs; null for any other game. */
async function readGame(parentId: string, now: Date, reads?: SeasonReads): Promise<Read | null> {
  const { rows } = await pool.query(
    `SELECT l.state, l.name, l.couch_id, l.rulebook_id, l.created_by, ss.id AS season_id, ss.season_number, s.slug, s.episode_term
       FROM leagues l
       JOIN shows s ON s.slug = l.state->'settings'->>'showId'
       JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
      WHERE l.id = $1 AND l.deleted_at IS NULL AND l.stage_of IS NULL`,
    [parentId]
  );
  const r = rows[0];
  if (!r) return null;
  const parent = r.state as LeagueState;
  if (!StateLogic.StageLogic.on(parent) || !StateLogic.StageLogic.onStages(parent).length || parent.settings.archivedAt) return null;
  const { rows: st } = await pool.query("SELECT id, stage_key, state, deleted_at FROM leagues WHERE stage_of = $1 ORDER BY id", [parentId]);
  const stages: Stage[] = st.map((x) => ({ id: x.id as string, key: x.stage_key as string, state: x.state as LeagueState, deleted: !!x.deleted_at }));
  const live = stages.filter((x) => !x.deleted);
  const read = async (): Promise<Reads> => ({
    tl: await timelineForShow(pool, parent.settings.showId, parent.settings.wikiSeason, parent.castaways.map((c) => c.name)),
    schedule: await scheduleOf(r.season_id, now),
  });
  if (reads && !reads.has(r.season_id)) reads.set(r.season_id, read());
  const { tl, schedule } = await (reads ? (reads.get(r.season_id) as Promise<Reads>) : read());
  const starts: ChangePlanInput["starts"] = {};
  const copies: ChangePlanInput["copies"] = {};
  for (const s of live) {
    const from = StateLogic.startEpisode(s.state);
    if (StateLogic.StageLogic.copyOf(s.key)) copies[s.key] = { from };
    else starts[s.key] = from;
  }
  const input: ChangePlanInput = { triggers: triggersFor(parent, tl, live), starts, copies, open: openEpisode(parent, schedule, now), last: schedule?.episodeCount ?? null };
  return {
    parentId,
    parent,
    name: r.name,
    couchId: r.couch_id,
    rulebookId: r.rulebook_id,
    createdBy: r.created_by,
    season: { id: r.season_id, number: r.season_number, slug: r.slug },
    episodeWord: showWords({ episode: r.episode_term }).episode,
    stages,
    input,
  };
}

/** The plan as the game stands, and its season (read only: what the stage-changes route shows). */
export async function changePlanFor(parentId: string, now = new Date()): Promise<{ plan: ChangePlan; seasonId: string } | null> {
  const g = await readGame(parentId, now);
  return g ? { plan: StateLogic.StageLogic.changePlan(g.parent, g.input), seasonId: g.season.id } : null;
}

const stageName = (state: LeagueState, id: string) => StateLogic.StageLogic.stages(state).find((s: SpecStage) => s.id === id)?.name || "The next stage";

/**
 * Each thing the plan says that Recent changes hasn't yet, as { tell (its key in the record's `told`), episode (the episode whose
 * research said it: a line about a change is as much a spoiler as its result), text }. `gone`: the copies being taken away now.
 */
function linesFor(g: Read, state: LeagueState, plan: ChangePlan, gone: string[]): { tell: string; episode: number | null; text: string }[] {
  const told = new Set(StateLogic.StageLogic.changeRecord(state).told);
  const ep = g.episodeWord;
  const out: { tell: string; episode: number | null; text: string }[] = [];
  const say = (tell: string, t: StageTrigger | null, text: string) => {
    if (!told.has(tell)) out.push({ tell, episode: t ? t.episode : null, text });
  };
  const unanswered = StateLogic.StageLogic.changesOf(state)?.unanswered;
  for (const e of plan.entries.filter((x) => x.copy !== null && x.trigger)) {
    const t = e.trigger as StageTrigger;
    say(`start:${e.key}@${e.from}`, t, `The format changed (${changeWords(t)}, from ${ep} ${t.from}): ${stageName(state, e.stage)} starts with ${ep} ${e.from}`);
  }
  for (const x of plan.pending) {
    const tail = unanswered === "start" ? "else it starts by itself" : "else the game carries on as it is";
    say(`ask:${x.key}`, x.trigger, `The format changed (${changeWords(x.trigger)}, from ${ep} ${x.trigger.from}): start ${stageName(state, x.stage)}? Say so before ${ep} ${x.until} starts, ${tail}`);
  }
  for (const x of plan.lapsed) say(`lapsed:${x.key}`, x.trigger, `Nobody said whether to start ${stageName(state, x.stage)} for ${changeWords(x.trigger)} at ${ep} ${x.trigger.from}: the game carries on as it is`);
  for (const x of plan.held) say(`held:${x.trigger.id}`, x.trigger, `Research isn't sure ${changeWords(x.trigger)} at ${ep} ${x.trigger.from}, so the game carries on as it is`);
  for (const x of plan.late) say(`late:${x.key}`, x.trigger, `The format changed (${changeWords(x.trigger)}) too late in the season for ${stageName(state, x.stage)} to start`);
  for (const x of plan.capped) say(`capped:${x.key}`, x.trigger, `The format changed again (${changeWords(x.trigger)}, from ${ep} ${x.trigger.from}), but ${stageName(state, x.stage)} has had its ${Spec.MAX_COPIES} copies: the last plays on`);
  for (const key of gone) {
    const skip = plan.skipped.find((x) => x.key === key);
    const sup = plan.superseded.find((x) => x.key === key);
    const name = stageName(state, StateLogic.StageLogic.copyOf(key) ?? "");
    if (skip) say(`undone:${key}`, skip.trigger, `${name} for ${changeWords(skip.trigger)} at ${ep} ${skip.trigger.from} is called off, and what it scored with it`);
    else if (sup) say(`undone:${key}`, sup.trigger, `${name} for ${changeWords(sup.trigger)} at ${ep} ${sup.trigger.from} is called off: another change came before it started`);
    else say(`undone:${key}`, null, `${name} (${key.split("@")[1]}) is called off: research no longer says the format changed there, so what it scored is taken back`);
  }
  return out;
}

/** The span a stage league plays, as the plan wants it, from its game now: null when it's already that. */
function wantSpan(state: LeagueState, e: { from?: number | null; to?: ChangePlanEntry["to"] }): GameSpec | null {
  const g = StateLogic.gameOf(state) as GameSpec;
  const span = { ...g.span };
  if (e.from !== undefined && e.from !== null && Spec.spanStart(span) !== e.from) span.from = e.from;
  if (e.to !== undefined && !Spec.sameValue(span.to, e.to)) span.to = e.to as GameSpec["span"]["to"];
  return Spec.sameValue(span, g.span) ? null : { ...g, span };
}

type Client = Parameters<typeof recordChange>[0];
/** A stage league's span written as the plan wants it (inside its own write, on `s`), with a line in its Recent changes. */
async function respanIn(g: Read, stageId: string, s: LeagueState, client: Client, e: { from?: number | null; to?: ChangePlanEntry["to"] }, why: string): Promise<boolean> {
  const next = wantSpan(s, e);
  if (!next) return false;
  const problems = StateLogic.setGame(s, next);
  if (problems.length) {
    console.error(`[change-stages] couldn't move ${stageId}: ${problems.map((p: { problem: string }) => p.problem).join("; ")}`);
    return false;
  }
  if (StateLogic.endPhase(s) || StateLogic.readsPhases(s)) settleIn(s, await leaguePhases(client, stageId, g.season.id), await scheduleOf(g.season.id));
  const from = StateLogic.startEpisode(s);
  const to = StateLogic.endEpisode(s);
  await recordChange(client, stageId, s, { userId: null, kind: "game.settled", tier: 1, text: `Plays ${g.episodeWord}s ${from ?? "?"}${to === null ? " on" : ` to ${to}`}: ${why}` });
  return true;
}
async function respan(g: Read, stage: Stage, e: { from?: number | null; to?: ChangePlanEntry["to"] }, why: string): Promise<boolean> {
  if (!wantSpan(stage.state, e)) return false;
  let moved = false;
  await withLeagueLock(stage.id, async (s, client) => {
    moved = await respanIn(g, stage.id, s, client, e, why);
  });
  return moved;
}

/** A copy of a stage a format change starts, made as the engine lab makes a stage (engine-lab.ts makeStages): a league on the game's
 *  couch, season and rules, the game's seats under the same ids (those the stages mirror: stages.ts seatsToMirror), its game the
 *  stage's from the plan's start to its end, tied to the game. A copy that can't be made takes its half-made league away. */
async function makeCopy(g: Read, e: ChangePlanEntry): Promise<boolean> {
  // Made meanwhile (another settle at the same time): nothing to do.
  const { rows: had } = await pool.query("SELECT 1 FROM leagues WHERE stage_of = $1 AND stage_key = $2", [g.parentId, e.key]);
  if (had.length) return false;
  const st = StateLogic.StageLogic.stages(g.parent).find((x: SpecStage) => x.id === e.stage) as SpecStage;
  const base = Spec.stageGame(st, e.from as number);
  const game = { ...base, span: { ...base.span, from: e.from as number, to: (e.to ?? null) as GameSpec["span"]["to"] } } as GameSpec;
  const kind = Spec.playsAs(Spec.fullSpec(game));
  if (!kind) throw new Error(`stage ${st.id} plays as no game`);
  // The rules the game plays by on its couch (its own questions are checked against them, as the lab does).
  const { stageContext } = await import("./engine-lab");
  const ctx = await stageContext(g.season.id, g.couchId);
  const t = e.trigger as StageTrigger;
  const name = `${g.name} · ${st.name || "Stage"}${(e.copy ?? 1) > 1 ? ` ${e.copy}` : ""}`;
  let made: string | null = null;
  await makeLeague(g.season, {
    name,
    createdBy: g.createdBy,
    type: Spec.madeAs(kind),
    couchId: g.couchId,
    rulebookId: g.rulebookId,
    before: (s) => {
      for (const p of seatsToMirror(g.parent).filter((x) => !x.disabled)) seatIn(s, p);
    },
    after: async (s, client, leagueId) => {
      made = leagueId;
      const problems = StateLogic.setGame(s, game, { ctx: { ...ctx, pool: undefined } });
      if (problems.length) throw new Error(problems.map((p: { problem: string }) => p.problem).join("; "));
      await client.query("UPDATE leagues SET stage_of = $2, stage_key = $3 WHERE id = $1", [leagueId, g.parentId, e.key]);
      if (StateLogic.readsPhases(s) || StateLogic.endPhase(s)) settleIn(s, await leaguePhases(client, leagueId, g.season.id), await scheduleOf(g.season.id));
      await recordChange(client, leagueId, s, {
        userId: null,
        kind: "game.start",
        tier: 1,
        episode: t.episode,
        text: `${st.name || "A new stage"} of ${g.name}, from ${g.episodeWord} ${e.from}: the format changed (${changeWords(t)})`,
        detail: { stageOf: g.parentId, change: t },
      });
    },
  }).catch(async (err) => {
    // makeLeague writes the league's row before its setup: a refused setup (or a second copy meanwhile) leaves it behind.
    if (made) await pool.query("DELETE FROM leagues WHERE id = $1 AND stage_of IS NULL", [made]);
    throw err;
  });
  return true;
}

/**
 * Settles a game in stages whose stages a format change starts: the plan worked out from the season's format state over time, what
 * it says the game hasn't said yet recorded on the game (its record and Recent changes), then its stage leagues made, restored, moved
 * or taken away to match. Null for any other game. One stage failing is logged and done again by the next settle. `reads`: a season's
 * format state and schedule shared by every game a season sync settles.
 */
export async function settleChanges(parentId: string, now = new Date(), reads?: SeasonReads): Promise<ChangeSettled | null> {
  const g = await readGame(parentId, now, reads);
  if (!g) return null;
  const S = StateLogic.StageLogic;
  const live = g.stages.filter((x) => !x.deleted);
  const wanted = (p: ChangePlan) => new Set(p.entries.filter((e) => e.copy !== null).map((e) => e.key));
  const goneNow = (p: ChangePlan) => live.filter((x) => S.copyOf(x.key) && !wanted(p).has(x.key)).map((x) => x.key);
  const backNow = (p: ChangePlan) => [...wanted(p)].filter((k) => !live.some((x) => x.key === k) && g.stages.some((x) => x.deleted && x.key === k));
  // The game's own record first, in its write (only when there's something to record).
  const plan0 = S.changePlan(g.parent, g.input);
  const rec0 = S.changeRecord(g.parent);
  const needs = Object.keys(plan0.seen).length > 0 || linesFor(g, g.parent, plan0, goneNow(plan0)).length > 0 || goneNow(plan0).some((k) => !rec0.undone.includes(k)) || backNow(plan0).length > 0;
  let plan = plan0;
  let parent = g.parent;
  if (needs) {
    parent = await withLeagueLock(parentId, async (s, client) => {
      plan = S.changePlan(s, g.input);
      const rec = S.changeRecord(s);
      const gone = goneNow(plan);
      const back = backNow(plan);
      // A copy coming back can be taken away again and said again; one going can be said to start again when it's back.
      const forget = (t: string) => back.some((k) => t === `undone:${k}`) || gone.some((k) => t.startsWith(`start:${k}@`));
      s.changeStages = { ...rec, told: rec.told.filter((t) => !forget(t)) };
      const lines = linesFor(g, s, plan, gone);
      s.changeStages = {
        ...rec,
        seen: { ...rec.seen, ...plan.seen },
        told: [...rec.told.filter((t) => !forget(t)), ...lines.map((l) => l.tell)],
        undone: [...new Set([...rec.undone.filter((k) => !back.includes(k)), ...gone])],
      };
      for (const l of lines) await recordChange(client, parentId, s, { userId: null, kind: "game.settled", tier: 1, episode: l.episode, text: l.text });
    });
  }
  const out: ChangeSettled = { plan, seasonId: g.season.id, made: [], restored: [], moved: [], undone: [] };
  // Copies taken away: soft-deleted with their memberships (restored, and mirrored again, if their change comes back).
  for (const key of goneNow(plan)) {
    const st = live.find((x) => x.key === key) as Stage;
    try {
      await tx((client) => takeStageAway(client, st.id));
      out.undone.push(key);
    } catch (e) {
      console.error(`[change-stages] couldn't take ${key} of ${parentId} away:`, e);
    }
  }
  for (const e of plan.entries) {
    try {
      if (e.copy === null) {
        // The stage before the first copy: it ends where that starts (or plays on).
        if (e.to === undefined) continue;
        const st = live.find((x) => x.key === e.stage);
        if (st && (await respan(g, st, { to: e.to }, e.to === null ? "no format change has started the next stage" : "the next stage starts at a format change"))) out.moved.push(st.key);
        continue;
      }
      const st = live.find((x) => x.key === e.key);
      if (st) {
        if (await respan(g, st, { from: e.from, to: e.to }, "where its format change and the next put it")) out.moved.push(st.key);
        continue;
      }
      const was = g.stages.find((x) => x.deleted && x.key === e.key);
      if (was) {
        // Its change is back (a report corrected again): restored in one write, its results caught up, where the plan puts it now; its
        // seats' memberships mirrored below.
        const { syncLeagueDecisions } = await import("./season-decisions");
        await withLeagueLock(was.id, async (s, client) => {
          await client.query("UPDATE leagues SET deleted_at = NULL, deleted_by = NULL WHERE id = $1", [was.id]);
          await syncLeagueDecisions(client, was.id, s);
          await recordChange(client, was.id, s, { userId: null, kind: "game.settled", tier: 1, text: "Back: research says its format change again" });
          await respanIn(g, was.id, s, client, { from: e.from, to: e.to }, "where its format change and the next put it");
        });
        out.restored.push(e.key);
        continue;
      }
      if (await makeCopy(g, e)) out.made.push(e.key);
    } catch (err) {
      console.error(`[change-stages] ${parentId} ${e.key}:`, err);
    }
  }
  // Every stage's seats and memberships as the game's (a copy just made or restored gets them here; a settle that failed partway is
  // put right by the next: stagesToSeat writes only what differs).
  await syncStages(parentId, parent);
  return out;
}

/**
 * Settles every game in stages on a season whose stages a format change starts (each on its own; one failing is logged and never
 * stops the rest; the season's format state and schedule read once): after every season sync. How many games had a copy made,
 * restored, moved or taken away.
 */
export async function settleSeasonChanges(seasonId: string, now = new Date()): Promise<number> {
  const { rows } = await pool.query(
    `SELECT l.id FROM leagues l
       JOIN shows s ON s.slug = l.state->'settings'->>'showId'
       JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
      WHERE ss.id = $1 AND l.deleted_at IS NULL AND l.stage_of IS NULL AND COALESCE(l.state->'settings'->>'archivedAt', '') = ''
        AND l.state->'settings'->'stages' @> '[{"on": {}}]'::jsonb`,
    [seasonId]
  );
  const reads: SeasonReads = new Map();
  let n = 0;
  for (const r of rows) {
    try {
      const did = await settleChanges(r.id, now, reads);
      if (did && (did.made.length || did.restored.length || did.moved.length || did.undone.length)) n++;
    } catch (e) {
      console.error(`[change-stages] game ${r.id}:`, e);
    }
  }
  return n;
}

/**
 * The maker's answer on a change that starts a stage (the stage-changes route): 'start' or 'skip' (a skip takes a started copy
 * away), only on a change research is sure of for this game, recorded on the game with a line, then the game settled (its plan
 * returned). A problem in words is a 400.
 */
export async function answerChange(parentId: string, key: string, what: string, user: { id: string; name: string }, now = new Date()): Promise<ChangeSettled | null> {
  const got = await changePlanFor(parentId, now);
  const p = got?.plan;
  const item = p ? [...p.entries, ...p.pending, ...p.lapsed, ...p.skipped, ...p.late, ...p.capped, ...p.superseded].find((x) => x.key === key) : undefined;
  if (!item || !item.trigger) throw new HttpError(400, "That isn't a format change research is sure of for this game");
  const t = item.trigger;
  await withLeagueLock(parentId, async (s, client) => {
    const problem = StateLogic.StageLogic.decide(s, key, what, user.id, now.toISOString());
    if (problem) throw new HttpError(400, problem);
    const name = stageName(s, StateLogic.StageLogic.copyOf(key) ?? "");
    await recordChange(client, parentId, s, { userId: user.id, kind: "game.settled", tier: 1, episode: t.episode, text: `${user.name} said ${what === "start" ? "start" : "no to"} ${name} for ${changeWords(t)} at ${t.from}` });
  });
  return settleChanges(parentId, now);
}
