import { after } from "next/server";
import Bots from "@/lib/game/bot-logic.js";
import StateLogic from "@/lib/game/state-logic.js";
import { addBot, botsPlay, MAX_BOTS, type BotLevel } from "@/lib/game/computer-players";
import * as Spec from "@/lib/game/game-spec/index.js";
import type { SpecContext } from "@/lib/game/game-spec/index.js";
import type { Pack } from "@/lib/game/game-words/index.js";
import { spanName } from "@/lib/game/spans";
import { isUuid, type SessionUser } from "./auth-helpers";
import { recordChange } from "./change-log";
import { couchMembers } from "./couches";
import { HttpError, pool } from "./db";
import { deleteLeague } from "./end-game";
import { followLeagueProgress } from "./follows";
import { asksToday, packFor } from "./game-words";
import { refused } from "./game-writes";
import { makeLeague } from "./new-game";
import { copyOf } from "./ours";
import { leaguePhases, scheduleOf, settleIn } from "./phase-starts";
import { queueSeasonBingo } from "./desk-research";
import { madeGames, type MadeGame } from "./made-games";
import { notifyGameStarted } from "./push-events";
import { couchGamesOn, freeName, linkIn, startOptions, watchersOf, type StartOptions } from "./start-game";

// Start a game, the wizard (docs/PLAN-start-a-game-gpt.md U1; U0's settled board "B, settled"). The sheet rolls, checks and words
// every game on the phone (the engine's rollSpec, specProblems and describeSpec, bundled for the browser) from the page this reads:
// G1's context pack and the ctx our check reads (the couch's rules, its size, who's still in as the starter has seen it). Starting
// sends the spec the sheet built, and the server checks it again on that same page before it makes anything ("the server checking
// again on save": round 14's build note).
//
//   GET  /api/seasons/[id]/start?couch=&wizard=1   startOptions, plus `wizard`: the page, the season's last episode when it's
//                                                   known, and the asks of our bot left today
//   POST /api/seasons/[id]/start?couch=  { spec, name?, tell?, bots?, level?, late?, made? }   Start from a spec
//   POST /api/seasons/[id]/start?couch=  { undo: leagueId }                                     the 10-second Undo
//
// Start it tells the couch (only those who watch the show or play it there: U1's note) after a 10-second hold: the push waits in
// the request's `after` and goes only if the game is still standing, so Undo inside the hold takes it back before anyone hears.
// A game in stages (the redraft, trivia too) isn't made here yet: the sheet doesn't offer those twists.

/** How long Start it holds the couch's push for Undo. */
export const TELL_HOLD_MS = 10_000;
/** How long after starting it Undo still takes a game back (the hold, and room for a slow phone). */
const UNDO_MS = 60_000;

export interface WizardPage {
  /** rollSpec's page: the ctx our check reads, and the context pack. */
  page: { ctx: SpecContext; pack: Pack };
  /** The season's last episode, when the listing or the season says; null while nobody knows. */
  last: number | null;
  /** Asks of our bot left today (null: no cap, the desk). */
  asksLeft: number | null;
  /** Who Start it tells: those on the couch who watch the show or play it here. */
  tells: number;
  /** G5: the season's made-for games, for the rail. */
  made: MadeGame[];
}

export type WizardOptions = StartOptions & { wizard: WizardPage | null };

/** What can start, and (for a season with episodes still to air, set up) the wizard's page. */
export async function wizardOptions(user: SessionUser, seasonId: string, couchId: string | null, now = new Date(), late = false, start: number | null = null): Promise<WizardOptions> {
  // `start`: an episode that's aired, to catch up from at your own pace (where you are, on a season still airing).
  const opts = await startOptions(user, seasonId, couchId, null, now, late, start);
  // An aired season at your own pace takes the wizard too (the user, 2026-11-09): it starts where the season's starts say.
  if (opts.blocked) return { ...opts, wizard: null };
  const [{ pack, ctx }, asks, tells, made] = await Promise.all([packFor(user, seasonId, opts.couch.id, now), asksToday(user), audience(user, opts.couch.id, seasonId), madeGames(seasonId)]);
  const listed = Math.max(0, ...opts.starts.map((e) => e.number));
  const last = pack.episodes.total ?? (listed >= opts.from ? listed : null);
  return { ...opts, wizard: { page: { ctx, pack }, last, asksLeft: asks.left, tells: tells.length, made } };
}

/** Who Start it tells: the couch's members who watch the show or play it here, never the starter. */
async function audience(user: SessionUser, couchId: string, seasonId: string) {
  const [members, here] = await Promise.all([couchMembers([couchId]), couchGamesOn(user, couchId, seasonId)]);
  return watchersOf(user, members.get(couchId) ?? [], seasonId, here);
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const phaseOf = (v: unknown): string | null => (isObj(v) && typeof v.phase === "string" ? v.phase : null);

export interface SpecStarted {
  leagueId: string;
  name: string;
  /** The episode it starts with; null while it waits for its phase. */
  from: number | null;
  to: number | null;
  linked: boolean;
  /** How many the push goes to after the hold (0: Tell the couch was off, or nobody else watches). */
  told: number;
  /** How long the push is held for Undo. */
  holdMs: number;
}

/**
 * Start from a spec (POST { spec, name, tell, bots, level, late, made }): the wizard's game, checked again on the season's page as
 * the starter sees it, made on the couch with them its Commissioner, linked to the couch's other games here, the couch told after
 * the hold. `made` says how the sheet got it (a rail game, Surprise me's seed, a typed ask's id), kept in Recent changes' detail.
 */
export async function startFromSpec(
  user: SessionUser,
  seasonId: string,
  couchId: string | null,
  body: { spec?: unknown; name?: unknown; tell?: unknown; bots?: unknown; level?: unknown; late?: unknown; made?: unknown },
  now = new Date(),
  o: { origin?: string; bot?: string } = {}
): Promise<SpecStarted> {
  if (!isObj(body.spec)) throw new HttpError(400, "spec: the game to start");
  const late = body.late === true;
  // A start on an episode that's aired is a catch-up at your own pace (startOptions' `start`); any other start is checked below.
  const asked = isObj(body.spec) && isObj(body.spec.span) && typeof body.spec.span.from === "number" ? body.spec.span.from : null;
  const opts = await startOptions(user, seasonId, couchId, null, now, late, asked);
  if (opts.blocked) throw new HttpError(409, opts.blocked);
  if (late && !opts.late) throw new HttpError(409, `Nothing's on now to include: it starts with ${opts.part.singular} ${opts.from}`);
  const couch = opts.couch.id;
  const { ctx } = await packFor(user, seasonId, couch, now);
  const spec = structuredClone(body.spec) as Record<string, unknown>;
  if (Array.isArray(spec.stages)) throw new HttpError(409, "A game in stages can't start from here yet");

  // Where it starts: the next to air (or the one on now, with `late`), a later listed one, or a phase still to come; where it ends:
  // the season's end, a later episode, or a phase.
  // No span (a described game that runs all season): from the start the options give (the next to air, or where you are at your
  // own pace) to the season's end.
  if (!isObj(spec.span)) spec.span = { from: opts.from, to: null };
  const span = spec.span as Record<string, unknown>;
  const fromPhase = phaseOf(span.from);
  if (fromPhase) {
    if (late) throw new HttpError(400, "Include the one on now, or start with a phase: not both");
    if (!opts.phases.some((p) => p.id === fromPhase)) throw new HttpError(400, "Pick a phase of the season still to come");
  } else if (typeof span.from !== "number" || !(span.from === opts.from || (!late && opts.starts.some((e) => e.number === span.from)))) {
    throw new HttpError(400, `Pick a start the listing has, from ${opts.part.singular} ${opts.from} on`);
  }
  if (typeof span.to === "number" && typeof span.from === "number" && span.to < span.from) throw new HttpError(400, "It ends before it starts");

  const problems = Spec.specProblems(spec, ctx);
  if (problems.length) throw new HttpError(409, problems[0].problem);
  const waits = Spec.specWaitsFor(spec as never);
  if (waits.length) throw new HttpError(409, waits[0].problem);
  const type = Spec.typeOf(spec as never);
  if (!type) throw new HttpError(409, "No game plays this way yet");

  const bots = typeof body.bots === "number" && Number.isInteger(body.bots) ? body.bots : 0;
  if (bots < 0 || bots > MAX_BOTS) throw new HttpError(400, `Up to ${MAX_BOTS} computer players`);
  const level: BotLevel = body.level === "easy" || body.level === "sharp" ? body.level : "normal";
  const describe = Spec.describeSpec(spec as never, ctx);
  const here = await couchGamesOn(user, couch, seasonId);
  const want = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : describe.short.title || "A game";
  const name = freeName(want, here);
  const starter = (user as { username?: string | null }).username || user.name;
  const { rows: seasonRow } = await pool.query("SELECT ss.season_number, s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [seasonId]);
  const row = { id: seasonId, number: seasonRow[0].season_number as number, slug: seasonRow[0].slug as string };
  const copy = await copyOf(here.map((g) => g.leagueId));
  const to = typeof span.to === "number" ? span.to : null;
  const spanWords = typeof span.from === "number" && to !== null ? spanName(span.from, to, opts.part) : null;
  const P = opts.part.singular.replace(/^./, (c) => c.toUpperCase());
  const when = fromPhase ? ` from when ${opts.phases.find((p) => p.id === fromPhase)?.name ?? fromPhase} starts` : spanWords ? ` for ${spanWords}` : ` from ${P} ${span.from}`;
  const made = isObj(body.made) ? body.made : null;

  let seat = "";
  let leagueMade: string | null = null;
  let settled: number | null = null;
  const leagueId = await makeLeague(row, {
    name,
    createdBy: user.id,
    // A game of questions (or one of the newer kinds with nothing held) starts from Survival Pool's type, as the lab's do.
    type: type === "questions" ? "pickem" : type,
    couchId: couch,
    rulebookId: copy?.id ?? null,
    before: (s) => {
      seat = StateLogic.addPlayer(s, starter).id;
      for (let i = 0; i < bots; i++) addBot(s, level);
    },
    after: async (s, client, id) => {
      leagueMade = id;
      // At your own pace, their mark is the episode before the start (the one they reveal first is the start itself): start-game.ts's.
      await client.query("INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1, $2, $3, 'commissioner', $4)", [
        id,
        user.id,
        seat,
        opts.ownPace ? opts.from - 1 : null,
      ]);
      refused(StateLogic.setGame(s, spec as never, { ctx }), 409);
      if (bots && !botsPlay(s)) throw new HttpError(409, "Computer players don't play this game");
      if (StateLogic.readsPhases(s) || StateLogic.startPhase(s) || StateLogic.endPhase(s)) {
        settleIn(s, await leaguePhases(client, id, seasonId), await scheduleOf(seasonId, now), now);
        settled = StateLogic.startEpisode(s);
      }
      if (late) {
        // Include it: the episode on now stays open past its start, until its results are in (state-logic.js closedForPlay).
        StateLogic.ensureEpisodeNumber(s, opts.from, false);
        const ep = s.episodes.find((e) => e.number === opts.from);
        if (ep && StateLogic.episodeHasResults(ep)) throw new HttpError(409, `${P} ${opts.from}'s results are in already: start from the next one`);
        if (ep) ep.openPastAir = true;
      }
      // At your own pace: every seat, the computer players too, catches up from the start, one episode at a time (GhostLogic);
      // its computer players pick their teams now, from who was in before the start (start-game.ts's).
      if (opts.ownPace) {
        StateLogic.GhostLogic.paceAll(s, typeof span.from === "number" ? span.from : opts.from);
        Bots.paceTeams(s);
      }
      await recordChange(client, id, s, {
        userId: user.id,
        kind: "game.start",
        tier: 1,
        text: `${starter} started ${name}${when}${opts.ownPace ? ", at their own pace" : ""}${bots ? ` with ${bots} computer ${bots === 1 ? "player" : "players"}` : ""}`,
        detail: { spec: true, from: fromPhase ? settled : span.from, ...(fromPhase ? { phase: fromPhase } : {}), to, bots, ...(made ? { made } : {}) },
      });
    },
  }).catch(async (e) => {
    // A refused setup leaves its half-made league behind: take it away.
    if (leagueMade) await pool.query("DELETE FROM leagues WHERE id = $1 AND created_by = $2", [leagueMade, user.id]);
    throw e;
  });
  if (!leagueId) throw new HttpError(500, "Couldn't make the game, try again");
  const linked = await linkIn(leagueId, here, user.id).catch((e) => {
    console.error(`[start-spec] couldn't link ${leagueId}:`, e);
    return false;
  });
  await followLeagueProgress(user.id, leagueId);
  // At your own pace, bingo needs a bank the season may not have: asked of our bot, not waited on (start-game.ts's).
  if (opts.ownPace && o.origin) after(() => queueSeasonBingo(user.id, seasonId, o.origin!, now, o.bot));

  const told = body.tell === false ? [] : (await audience(user, couch, seasonId)).map((p) => p.userId);
  notifyGameStarted({
    userIds: told,
    seasonId,
    leagueId,
    starter,
    show: opts.show,
    gameName: name,
    label: opts.label,
    from: fromPhase ? `when ${opts.phases.find((p) => p.id === fromPhase)?.name ?? "it"} starts` : `${P} ${span.from}`,
    span: spanWords,
    hold: { ms: TELL_HOLD_MS, still: async () => (await pool.query("SELECT 1 FROM leagues WHERE id = $1 AND deleted_at IS NULL", [leagueId])).rows.length > 0 },
  });
  return { leagueId, name, from: fromPhase ? settled : (span.from as number), to, linked, told: told.length, holdMs: TELL_HOLD_MS };
}

/**
 * Undo (POST { undo: leagueId }): a game you started a moment ago, taken back before anyone joined. It goes the way a deleted game
 * goes (restorable from Recent changes for 30 days), its line saying it was taken back; the held push then never goes.
 */
export async function undoStart(user: SessionUser, seasonId: string, leagueId: unknown, now = new Date()): Promise<{ undone: true }> {
  if (typeof leagueId !== "string" || !isUuid(leagueId)) throw new HttpError(400, "Which game?");
  const { rows } = await pool.query(
    `SELECT l.name, l.couch_id, l.created_at, (SELECT count(*)::int FROM league_memberships m WHERE m.league_id = l.id AND m.user_id <> $2) AS others
       FROM leagues l WHERE l.id = $1 AND l.created_by = $2 AND l.deleted_at IS NULL`,
    [leagueId, user.id]
  );
  const r = rows[0];
  if (!r) throw new HttpError(404, "That game isn't yours to take back");
  if (now.getTime() - new Date(r.created_at).getTime() > UNDO_MS) throw new HttpError(409, "Too late to undo: delete it from Backstage instead");
  if (r.others > 0) throw new HttpError(409, "Someone's joined it already: delete it from Backstage instead");
  const starter = (user as { username?: string | null }).username || user.name;
  await deleteLeague(user, { leagueId, gameName: r.name as string, couchId: (r.couch_id as string | null) ?? null, seasonId, text: `${starter} took back ${r.name} just after starting it` });
  return { undone: true };
}
