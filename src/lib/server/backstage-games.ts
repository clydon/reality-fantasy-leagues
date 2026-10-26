import crypto from "crypto";
import StateLogic from "@/lib/game/state-logic.js";
import { rulebookFor } from "@/lib/game/formats/blocks/index.js";
import { pointGroups } from "@/lib/game/formats/rulebook-describe.js";
import type { PointGroup } from "@/lib/game/formats/rulebook-describe";
import { castOf } from "@/lib/game/game-view";
import { previewLines, type PreviewLine } from "@/lib/game/results-changes";
import { gameRules } from "@/lib/game/game-rules";
import type { LeagueState, ReplaceRule, WaiverFeel, WaiverWindows } from "@/lib/game/types";
import { waiverHow, waiverWeek, type WaiverWeek } from "@/lib/game/waiver-view";
import { windowLine } from "@/lib/game/waiver-words.js";
import { blocksAt } from "@/lib/game/formats/rulebook-patch.js";
import { inForceEdits, lineage, rulebookForLeague } from "@db/rulebooks.js";
import { isSuperAdminUser } from "./auth-helpers";
import type { BackstageScope } from "./backstage";
import { plainChange, settingsSetChange, type ChangeSpec } from "./change-log";
import { pool, withLeagueLock, HttpError } from "./db";
import { EVERYTHING, seenThrough } from "./guard";
import { readyLeague } from "./league-read";
import { leagueStates } from "./league-states";
import { notifyWaiverWindow } from "./push-events";
import type { Game } from "./show-space";
import { windowSnapshot, type WindowSnapshot } from "./waiver-pushes";
import { openWindow, processNow, saveClaim } from "./waivers";
import { ourRules, type OurRules } from "./ours";

// Backstage II (docs/PLAN-new-design.md step 6a): the game's own pages for whoever runs it. Waivers (the week running,
// who has picks in, Run now, a window, the feel and Fine-tune), Game settings (lineup size, who can join, each with
// Reset to recommended) and Scoring rules' read side (the rulebook the games follow, and each game's points). Members &
// roles are backstage-members.ts. A Game admin runs results and waivers; settings, rules and roles are a Commissioner's.
// Lock it down (step 15 part 4, the mock's competitive mode): one switch for every game you run here, nobody new joins
// (GhostLogic.allowed), and the rules are frozen for the season: Game settings, the points and Make it ours refuse changes.
//
// Every write is one batch in Recent changes (change-log.ts) and answers its id, so the toast's Undo can take it back
// (tier 1); running waivers moves standings, so it's previewed first (tier 2) and carries its own Undo while free agency
// is open. Nothing here names who went home: a run's moves come from the reader's own copy at their mark.

const FEELS: WaiverFeel[] = ["casual", "balanced", "competitive"];

interface Loaded {
  game: Game;
  state: LeagueState;
  commissioner: boolean;
}

async function load(scope: BackstageScope): Promise<Loaded[]> {
  const states = await leagueStates(scope.games.map((g) => g.leagueId));
  const out: Loaded[] = [];
  for (const game of scope.games) {
    const s = states.get(game.leagueId);
    if (!s) continue;
    out.push({ game, state: await readyLeague(game.leagueId, s), commissioner: game.yourRole === "commissioner" || isSuperAdminUser(scope.user) });
  }
  return out;
}

/** One of the games you run here; `commissioner`: a write only a Commissioner may make (settings, rules, roles). */
export function gameIn(scope: BackstageScope, leagueId: unknown, opts: { commissioner?: boolean } = {}): Game {
  const game = scope.games.find((g) => g.leagueId === leagueId);
  if (!game) throw new HttpError(404, "That game isn't one you run here");
  if (opts.commissioner && game.yourRole !== "commissioner" && !isSuperAdminUser(scope.user)) throw new HttpError(403, "Only a Commissioner changes this");
  return game;
}

/** Where you are on the season, for a run's moves (who came in for whom says who left). */
async function markOf(scope: BackstageScope): Promise<number | null> {
  const seen = await seenThrough(scope.user.id, scope.seasonId);
  return seen === EVERYTHING ? null : seen;
}

async function seatOf(userId: string, leagueId: string): Promise<string | null> {
  const { rows } = await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, userId]);
  return rows[0]?.player_id ?? null;
}

// ---- Waivers ----

const RULE_WORDS: Record<ReplaceRule, string> = {
  always: "Replace right away",
  whenShort: "Only when short",
  windows: "Wait for a waiver window",
  never: "No replacements",
};

/** A feel's four lines (the mock's WV_FEEL_S), for a league's shape: what the feel would set. */
function feelLines(state: LeagueState, feel: WaiverFeel): string[] | null {
  const r = StateLogic.WaiverLogic.recommendFor(state, feel);
  if (!r || !r.feasible) return null;
  const s = r.settings;
  const w = s.waiverWindows;
  const out =
    s.replaceRule === "always"
      ? "Someone out? Replace them after any episode."
      : s.replaceRule === "whenShort"
        ? `Someone out? Replace them once you're down to ${s.replenishAt}.`
        : s.replaceRule === "windows"
          ? "Someone out? Replace them at the next waiver window."
          : "Out is out: no replacements.";
  const swaps =
    w.swaps <= 0
      ? "No optional swaps."
      : w.schedule === "manual"
        ? "Optional swaps when you open a window."
        : w.schedule === "everyEpisode"
          ? `${w.swaps} optional swap${w.swaps === 1 ? "" : "s"} every episode.`
          : `${w.swaps} optional swap${w.swaps === 1 ? "" : "s"} every ${w.every} episodes.`;
  return [out, swaps, "Lowest score picks first.", s.autoFill ? "Forget to pick? You get the most points left." : "Forget to pick? The spot stays empty."];
}

export interface WaiverAdminGame {
  leagueId: string;
  name: string;
  gameName: string;
  shared: boolean;
  commissioner: boolean;
  feel: WaiverFeel;
  /** On the feel's own settings (else "Customized"). */
  recommended: boolean;
  feels: { key: WaiverFeel; lines: string[] }[];
  settings: {
    replaceRule: ReplaceRule;
    windows: WaiverWindows;
    autoFill: boolean;
    orderBy: string;
    processHours: number;
    freeAgency: boolean;
    roster: number;
  };
  /** "Balanced · Wait for a waiver window · every 3 episodes". */
  summary: string;
  period: {
    id: string;
    episode: number;
    phase: "open" | "processed";
    window: boolean;
    swaps: number;
    /** What the window allows, with no names: "Replace who's out · Swap 1". */
    line: string;
    due: string | null;
    until: string | null;
    /** Opened (or changed) by whoever runs the game. */
    byHand: boolean;
  } | null;
  /** The week's episode you haven't revealed: its run's moves stay hidden from you. */
  revealFirst: number | null;
  claims: { playerId: string; userId: string | null; name: string; in: boolean; you: boolean }[];
  run: {
    periodId: string;
    episode: number;
    at: string;
    /** Who got whom, in picking order; null while you haven't revealed the week's episode. */
    moves: { name: string; userId: string | null; add: string | null; drop: string | null; photo: string | null; why: string }[] | null;
    /** Its line in Recent changes, while Undo is open there. */
    batch: string | null;
    undoable: boolean;
  } | null;
  latest: number;
  /** What players see: How waivers work here. */
  how: WaiverWeek["how"];
}

function waiverAdmin(l: Loaded, me: string, mark: number | null, users: Map<string, string>, batches: Map<string, string>): WaiverAdminGame | null {
  const W = StateLogic.WaiverLogic;
  const s = l.state;
  if (!W.supported(s)) return null;
  const c = W.config(s);
  const R = StateLogic.rosterSize(s);
  const current = W.current(s);
  const seat = s.players.find((p) => users.get(p.id) === me)?.id ?? null;
  const view = StateLogic.GhostLogic.viewFor(s, seat, mark);
  const hidden = !!current && mark !== null && current.episode > mark;
  const faces = new Map(castOf(view).map((f) => [f.id, f]));
  const ran = W.periods(s).filter((p) => p.run);
  const last = ran[ran.length - 1];
  const lastHidden = !!last && mark !== null && last.episode > mark;
  const nameOf = (id: string) => s.players.find((p) => p.id === id)?.name ?? "someone";
  const rule = c.replaceRule;
  const w = c.waiverWindows;
  const feelWord = c.waiverFeel[0].toUpperCase() + c.waiverFeel.slice(1);
  const recommended = W.isRecommended(s);
  return {
    leagueId: l.game.leagueId,
    name: l.game.name,
    gameName: l.game.gameName,
    shared: s.settings.ownershipMode === "shared",
    commissioner: l.commissioner,
    feel: c.waiverFeel,
    recommended,
    feels: FEELS.map((k) => ({ key: k, lines: feelLines(s, k) })).filter((f): f is { key: WaiverFeel; lines: string[] } => !!f.lines),
    settings: {
      replaceRule: rule,
      windows: w,
      autoFill: c.autoFill,
      orderBy: s.settings.replenishOrderBy || "rolling",
      processHours: W.processHours(s),
      freeAgency: W.freeAgencyOn(s),
      roster: R,
    },
    summary: [
      recommended ? feelWord : "Customized",
      RULE_WORDS[rule],
      w.schedule === "manual" ? "you open windows" : w.schedule === "everyEpisode" ? "a window every episode" : `every ${w.every} episodes`,
    ].join(" · "),
    period:
      current && (current.phase === "open" || current.phase === "processed")
        ? {
            id: current.id,
            episode: current.episode,
            phase: current.phase,
            window: !!current.window,
            swaps: current.swaps ?? 0,
            line: windowLine(s, current),
            due: current.phase === "open" ? current.processAt : null,
            until: current.closesAt,
            byHand: current.openedBy === "commissioner",
          }
        : null,
    revealFirst: hidden ? current!.episode : null,
    claims: current
      ? W.rotation(s).map((id) => ({ playerId: id, userId: users.get(id) ?? null, name: nameOf(id), in: current.claimsIn.includes(id), you: users.get(id) === me }))
      : [],
    run: last?.run
      ? {
          periodId: last.id,
          episode: last.episode,
          at: last.run.at,
          moves: lastHidden
            ? null
            : last.run.results
                .filter((r) => r.outcome === "got" && r.castawayId)
                .map((r) => ({
                  name: nameOf(r.playerId),
                  userId: users.get(r.playerId) ?? null,
                  add: faces.get(r.castawayId!)?.name ?? null,
                  drop: r.droppedCastawayId ? (faces.get(r.droppedCastawayId)?.name ?? null) : null,
                  photo: faces.get(r.castawayId!)?.photo ?? null,
                  why: r.kind === "pickup" ? "replaced" : "swapped",
                })),
          batch: batches.get(last.id) ?? null,
          undoable: current?.id === last.id && current.phase === "processed",
        }
      : null,
    latest: Math.max(0, StateLogic.SpoilerLogic.latestWithResults(s)),
    how: waiverHow(view),
  };
}

/** Who each seat is, by league (for faces and "you"). */
async function usersByLeague(leagueIds: string[]): Promise<Map<string, Map<string, string>>> {
  const out = new Map<string, Map<string, string>>(leagueIds.map((id) => [id, new Map()]));
  if (!leagueIds.length) return out;
  const { rows } = await pool.query("SELECT league_id, user_id, player_id FROM league_memberships WHERE league_id = ANY($1::uuid[]) AND player_id IS NOT NULL", [leagueIds]);
  for (const r of rows) out.get(r.league_id)?.set(r.player_id, r.user_id);
  return out;
}

/** The newest run's line in Recent changes per waiver week, still open to Undo. */
async function runBatches(leagueIds: string[]): Promise<Map<string, string>> {
  if (!leagueIds.length) return new Map();
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (undo->>'periodId') undo->>'periodId' AS period, batch FROM league_changes
      WHERE league_id = ANY($1::uuid[]) AND kind = 'waivers' AND undo->>'type' = 'waivers' AND undone_at IS NULL AND undo_until > now()
      ORDER BY undo->>'periodId', created_at DESC`,
    [leagueIds]
  );
  return new Map(rows.map((r) => [r.period, r.batch]));
}

export async function waiversAdmin(scope: BackstageScope): Promise<{ games: WaiverAdminGame[] }> {
  const loaded = await load(scope);
  const ids = loaded.map((l) => l.game.leagueId);
  const [mark, users, batches] = await Promise.all([markOf(scope), usersByLeague(ids), runBatches(ids)]);
  const games: WaiverAdminGame[] = [];
  for (const l of loaded) {
    const g = waiverAdmin(l, scope.user.id, mark, users.get(l.game.leagueId) ?? new Map(), batches);
    if (g) games.push(g);
  }
  return { games };
}

export type WaiverAction =
  | { action: "window"; swaps: number | null; replace?: boolean }
  | { action: "preview" }
  | { action: "run" }
  | { action: "undo" }
  | { action: "feel"; feel: WaiverFeel }
  | { action: "set"; set: Record<string, unknown> }
  | { action: "claimView"; playerId: string }
  | { action: "claimFor"; playerId: string; dropId: string; addIds: string[] };

// Fine-tune's fields, and what each may be (WaiverLogic.updateSetting checks the values).
const WAIVER_FIELDS = ["replaceRule", "waiverWindows", "autoFill", "waiverProcessHours", "replenishOrderBy", "freeAgencyEnabled"];

/** A waiver write for one game you run: answers its batch in Recent changes (null when nothing changed), or the preview. */
export async function waiverWrite(scope: BackstageScope, leagueId: unknown, body: WaiverAction): Promise<Record<string, unknown>> {
  const game = gameIn(scope, leagueId);
  const id = game.leagueId;
  const user = scope.user.id;
  const batch = crypto.randomUUID();
  const W = StateLogic.WaiverLogic;

  if (body.action === "preview") {
    // Tier 2, with nothing private in it: how many picks are in, never what they are (claims stay private until they run).
    const state = await readyLeague(id, (await leagueStates([id])).get(id)!);
    const p = W.current(state);
    if (!p || p.phase !== "open") throw new HttpError(409, "Waivers aren't open");
    const rotation = W.rotation(state);
    return {
      claimsIn: p.claimsIn.length,
      of: rotation.length,
      fallback: W.autoFillOn(state),
      orderBy: state.settings.replenishOrderBy || "rolling",
      until: p.closesAt,
      shared: state.settings.ownershipMode === "shared",
    };
  }

  // Claim for them (step 7; classic's commissioner "Claim for"): someone who hasn't put picks in, helped over the phone.
  // Their week as they'd see it (their spots, who's free), never their claim; then one spot's picks sent for them, the
  // rest of their claim kept (waivers.js saveClaim { spot }). Only once you've seen the week's episode yourself.
  if (body.action === "claimView" || body.action === "claimFor") {
    const mark = await markOf(scope);
    const check = (s: LeagueState) => {
      const p = W.current(s);
      if (!p || p.phase !== "open") throw new HttpError(409, "Waivers aren't open");
      if (mark !== null && p.episode > mark) throw new HttpError(409, `Reveal Episode ${p.episode} first`);
      if (!W.rotation(s).includes(body.playerId)) throw new HttpError(404, "They aren't in this week's waivers");
    };
    if (body.action === "claimView") {
      const state = await readyLeague(id, (await leagueStates([id])).get(id)!);
      check(state);
      const users = (await usersByLeague([id])).get(id) ?? new Map();
      const week = waiverWeek({ leagueId: id, name: game.name, gameType: game.gameType, gameName: game.gameName, yourRole: game.yourRole }, state, body.playerId, mark, (p) => users.get(p) ?? null, null);
      if (!week) throw new HttpError(409, "Waivers aren't open");
      return { week };
    }
    if (typeof body.dropId !== "string" || !Array.isArray(body.addIds)) throw new HttpError(400, "Choose who to drop and who to add");
    let name = "someone";
    await withLeagueLock(
      id,
      async (s, client) => {
        check(s);
        name = s.players.find((x) => x.id === body.playerId)?.name ?? name;
        const saved = await saveClaim(client, id, s, body.playerId, { spot: { dropId: body.dropId, addIds: body.addIds } }, user);
        if (saved.error) throw new HttpError(400, saved.error);
      },
      // Nobody's names: the picks are private until they run, theirs and whoever sent them.
      () => plainChange(user, "waivers", `Sent ${name}'s waiver pick`)
    );
    return { batch: null };
  }

  if (body.action === "window") {
    if (body.swaps !== null && !Number.isInteger(body.swaps)) throw new HttpError(400, "swaps must be a whole number, or null to turn the window off");
    const done: { before: WindowSnapshot | null; periodId?: string; trimmed: string[]; fresh: boolean } = { before: null, trimmed: [], fresh: false };
    const state = await withLeagueLock(
      id,
      async (s, client) => {
        if (!W.supported(s)) throw new HttpError(400, "This game doesn't use waivers");
        done.before = windowSnapshot(s);
        done.fresh = !W.current(s);
        const r = await openWindow(client, id, s, body.swaps, undefined, { replace: body.replace });
        if (r.error !== undefined) throw new HttpError(/processed/.test(r.error) ? 409 : 400, r.error);
        done.periodId = r.period.id;
        done.trimmed = r.trimmed;
      },
      (_b, after): ChangeSpec => {
        const p = W.periods(after).find((x) => x.id === done.periodId);
        const line = p && body.swaps !== null ? windowLine(after, p) : "";
        return { ...plainChange(user, "waivers", body.swaps === null ? "Turned the waiver window off" : `Opened a waiver window: ${line}`), batch };
      }
    );
    if (done.periodId) notifyWaiverWindow(id, state, done.before, done.periodId, done.trimmed, user);
    return { batch, fresh: done.fresh };
  }

  if (body.action === "run") {
    let periodId = "";
    await withLeagueLock(
      id,
      async (s, client) => {
        if (!W.enabled(s)) throw new HttpError(400, "This game doesn't use waivers");
        periodId = W.current(s)?.id ?? "";
        const refused = await processNow(client, id, s);
        if (refused) throw new HttpError(409, refused);
      },
      (_b, after): ChangeSpec => {
        const p = W.periods(after).find((x) => x.id === periodId);
        const moves = p?.run?.results.filter((r) => r.outcome === "got").length ?? 0;
        return {
          userId: user,
          kind: "waivers",
          tier: 2,
          text: `Ran waivers: ${moves} ${moves === 1 ? "move" : "moves"}`,
          batch,
          undo: { type: "waivers", periodId },
        };
      }
    );
    return { batch };
  }

  if (body.action === "undo") {
    // A run the hourly job made (no line of its own to undo): taken back here, and logged.
    await withLeagueLock(
      id,
      (s) => {
        const refused = W.undo(s);
        if (refused) throw new HttpError(409, refused);
      },
      { ...plainChange(user, "waivers", "Took back the last waiver run", 2), batch }
    );
    return { batch };
  }

  // Settings: a feel (the mock's Casual · Balanced · Competitive, applied on tap) or Fine-tune.
  gameIn(scope, leagueId, { commissioner: true });
  if (body.action === "feel" && !FEELS.includes(body.feel)) throw new HttpError(400, "feel must be casual, balanced or competitive");
  if (body.action === "set" && (!body.set || typeof body.set !== "object" || Object.keys(body.set).some((k) => !WAIVER_FIELDS.includes(k))))
    throw new HttpError(400, `set may change ${WAIVER_FIELDS.join(", ")}`);
  const feel = body.action === "feel" ? body.feel : null;
  const label = feel ? `Waivers on ${feel[0].toUpperCase()}${feel.slice(1)}` : "Changed how waivers work";
  let changed = false;
  await withLeagueLock(
    id,
    (s) => {
      if (!W.supported(s)) throw new HttpError(400, "This game doesn't use waivers");
      if (feel) {
        if (!W.applyRecommendation(s, feel)) throw new HttpError(409, "The cast is too small for that");
      } else for (const [k, v] of Object.entries((body as { set: Record<string, unknown> }).set)) StateLogic.updateSettings(s, k, v);
    },
    (b, a) => {
      const spec = settingsSetChange(user, label, { kind: "settings", batch });
      const out = typeof spec === "function" ? spec(b, a) : spec;
      changed = !!out;
      return out;
    }
  );
  return { batch: changed ? batch : null, text: label };
}

// ---- Game settings ----

// Recommended settings (Who can join's recommended one depends on ownership: GhostLogic.recommendedJoinMode).
const REC = { activeSlots: 3, benchSlots: 2, teamSize: 3, allowLateJoiners: true };

export interface GameSettings {
  leagueId: string;
  name: string;
  gameName: string;
  gameType: string;
  commissioner: boolean;
  shared: boolean;
  draftStarted: boolean;
  /** The next episode: lineup changes start there. */
  from: number | null;
  /** Weekly Lineup: who scores each week and the bench (the bench is set at the draft). */
  lineup: { starters: number; bench: number; rec: { starters: number; bench: number } } | null;
  /** Outlast: the team's size, set at the draft. */
  team: { size: number; rec: number } | null;
  /** Who can join (step 9): anyone on the couch (castaways on several teams: they catch up), ask me first, or nobody new. */
  joining: { mode: "open" | "ask" | "locked"; rec: "open" | "ask" };
  /** Waivers' one line, for the row into its page; null without waivers. */
  waivers: string | null;
  /** Lock it down (step 15 part 4): competitive mode, nobody new, rules frozen for the season. */
  lockedDown: boolean;
}

/** A game locked down (step 15 part 4): its rules don't change for the season. */
export const FROZEN = "Locked down for the season: the rules are frozen. Turn off Lock it down in Game settings first.";

// What Game settings may change, and the limits (the bench and Outlast's team are set at the draft).
const SETTING_FIELDS = ["activeSlots", "benchSlots", "teamSize", "allowLateJoiners", "joinMode"];

/** The settings Lock it down freezes: Game settings' and the points (waivers stay the week's business). Undo asks too. */
export const FROZEN_FIELDS = new Set([...SETTING_FIELDS, "eventPoints"]);

export async function gameSettings(scope: BackstageScope): Promise<{ games: GameSettings[] }> {
  const loaded = await load(scope);
  return {
    games: loaded.map((l) => {
      const s = l.state;
      const type = StateLogic.getLeagueType(s);
      const W = StateLogic.WaiverLogic;
      const next = StateLogic.currentEpisode(s);
      const c = W.supported(s) ? W.config(s) : null;
      return {
        leagueId: l.game.leagueId,
        name: l.game.name,
        gameName: l.game.gameName,
        gameType: l.game.gameType,
        commissioner: l.commissioner,
        shared: s.settings.ownershipMode === "shared",
        draftStarted: StateLogic.DraftLogic.isStarted(s),
        from: next?.number ?? null,
        lineup: type.hasActiveRoster
          ? { starters: StateLogic.ActiveRosterLogic.activeSlots(s), bench: StateLogic.ActiveRosterLogic.benchSlots(s), rec: { starters: REC.activeSlots, bench: REC.benchSlots } }
          : null,
        team: type.hasRoster && !type.hasActiveRoster ? { size: s.settings.teamSize, rec: REC.teamSize } : null,
        joining: { mode: StateLogic.GhostLogic.joinMode(s), rec: StateLogic.GhostLogic.recommendedJoinMode(s) },
        waivers: c ? `${RULE_WORDS[c.replaceRule]} · ${c.waiverWindows.swaps > 0 ? `${c.waiverWindows.swaps} optional swap${c.waiverWindows.swaps === 1 ? "" : "s"} per window` : "no optional swaps"}` : null,
        lockedDown: StateLogic.GhostLogic.lockedDown(s),
      };
    }),
  };
}

/** A Game settings change (`set`), or `reset`: that section back to recommended. Commissioner only; one batch with Undo. */
export async function settingsWrite(
  scope: BackstageScope,
  leagueId: unknown,
  body: { set?: Record<string, unknown>; reset?: "lineup" | "team" | "joining"; text?: string }
): Promise<{ batch: string | null }> {
  const game = gameIn(scope, leagueId, { commissioner: true });
  const set: Record<string, unknown> =
    body.reset === "lineup"
      ? { activeSlots: REC.activeSlots, benchSlots: REC.benchSlots }
      : body.reset === "team"
        ? { teamSize: REC.teamSize }
        : body.reset === "joining"
          ? { joinMode: "recommended" }
          : (body.set ?? {});
  if (!Object.keys(set).length || Object.keys(set).some((k) => !SETTING_FIELDS.includes(k))) throw new HttpError(400, `set may change ${SETTING_FIELDS.join(", ")}`);
  const batch = crypto.randomUUID();
  let changed = false;
  await withLeagueLock(
    game.leagueId,
    (s) => {
      if (StateLogic.GhostLogic.lockedDown(s)) throw new HttpError(409, FROZEN);
      const drafted = StateLogic.DraftLogic.isStarted(s);
      for (const [k, v] of Object.entries(set)) {
        if (k === "allowLateJoiners") {
          StateLogic.updateSettings(s, k, v !== false);
          continue;
        }
        // Who can join (step 9): open, ask or locked; anything else is the recommended one. An exclusive game can't be
        // open (its castaways are one team's each, so whoever runs it lets people in).
        if (k === "joinMode") {
          const mode = v === "recommended" ? StateLogic.GhostLogic.recommendedJoinMode(s) : v;
          if (mode !== "open" && mode !== "ask" && mode !== "locked") throw new HttpError(400, "Who can join is open, ask or locked");
          if (mode === "open" && !StateLogic.GhostLogic.sharedJoin(s)) throw new HttpError(400, "Each castaway is on one team here, so new players need your OK");
          StateLogic.updateSettings(s, k, mode);
          continue;
        }
        const n = Number(v);
        if (!Number.isInteger(n)) throw new HttpError(400, `${k} must be a whole number`);
        const now = Number((s.settings as unknown as Record<string, number>)[k]);
        // The team is what everyone drafted: once the draft has started its size doesn't move, so a Weekly Lineup's
        // starters come off the bench (or go back to it), and the bench and Outlast's team stay as they are.
        if ((k === "benchSlots" || k === "teamSize") && drafted) {
          if (n !== now && !(k === "benchSlots" && "activeSlots" in set)) throw new HttpError(409, "That's set at the draft");
          continue;
        }
        if (k === "activeSlots") {
          const roster = StateLogic.rosterSize(s);
          if (n < 1 || (drafted ? n > roster : n > 8)) throw new HttpError(400, drafted ? `Starters must be 1 to ${roster}, the team's size` : "Starters must be 1 to 8");
          if (drafted) StateLogic.updateSettings(s, "benchSlots", roster - n);
        }
        if (k === "benchSlots" && (n < 0 || n > 6)) throw new HttpError(400, "Bench must be 0 to 6");
        if (k === "teamSize" && (n < 1 || n > 10)) throw new HttpError(400, "Team size must be 1 to 10");
        StateLogic.updateSettings(s, k, n);
        // Fewer starters from the next episode: a lineup already set for it (or carried into it) keeps its first ones.
        if (k === "activeSlots" && n < now) {
          for (const ep of s.episodes.filter((e) => !StateLogic.ActiveRosterLogic.isLineupLocked(s, e.id))) {
            for (const p of s.players) {
              const lineup = StateLogic.activeRosterLineupFor(s, ep.id, p.id);
              if (lineup.length > n) ep.lineups = { ...(ep.lineups ?? {}), [p.id]: lineup.slice(0, n) };
            }
          }
        }
      }
    },
    (b, a) => {
      const spec = settingsSetChange(scope.user.id, body.reset ? "Set the game back to recommended" : (body.text ?? "Changed the game's settings"), { batch });
      const out = typeof spec === "function" ? spec(b, a) : spec;
      changed = !!out;
      return out;
    }
  );
  return { batch: changed ? batch : null };
}

/**
 * Lock it down (step 15 part 4; the mock's settings.js "Competitive mode"): on or off for every game you run here as a
 * Commissioner, in one batch with Undo, a line each in Recent changes for the whole couch to see.
 */
export async function lockDownWrite(scope: BackstageScope, on: unknown): Promise<{ batch: string | null; games: number }> {
  if (typeof on !== "boolean") throw new HttpError(400, "lockDown must be true or false");
  const mine = scope.games.filter((g) => g.yourRole === "commissioner" || isSuperAdminUser(scope.user));
  if (!mine.length) throw new HttpError(403, "Only a Commissioner changes this");
  const batch = crypto.randomUUID();
  let changed = 0;
  for (const game of mine) {
    await withLeagueLock(
      game.leagueId,
      (s) => StateLogic.updateSettings(s, "lockedDown", on),
      (b, a) => {
        const spec = settingsSetChange(scope.user.id, on ? "Locked the game down for the season: nobody new joins, the rules are frozen" : "Took the game off lock down: back to casual", { batch });
        const out = typeof spec === "function" ? spec(b, a) : spec;
        if (out) changed++;
        return out;
      }
    );
  }
  return { batch: changed ? batch : null, games: changed };
}

/** Whether any of these games is locked down: Make it ours and the couch's rules are frozen while one is. */
export async function anyLockedDown(leagueIds: string[]): Promise<boolean> {
  const states = await leagueStates(leagueIds);
  return leagueIds.some((id) => {
    const s = states.get(id) as LeagueState | undefined;
    return !!s && StateLogic.GhostLogic.lockedDown(s);
  });
}

// ---- Scoring rules: a game's points ----

/**
 * Change the points (step 6b part 3): Weekly Lineup's points for some of its moments, for the whole season (the engine
 * keeps one number per moment, so every episode is scored again). Commissioner only; `preview` says what moves first
 * (tier 2), then one batch with Undo.
 */
export async function pointsWrite(
  scope: BackstageScope,
  leagueId: unknown,
  body: { points?: unknown; preview?: boolean }
): Promise<{ lines: PreviewLine[] } | { batch: string | null }> {
  const game = gameIn(scope, leagueId, { commissioner: true });
  if (game.gameType !== "active-roster") throw new HttpError(400, "Only Weekly Lineup scores by moment");
  const s0 = (await leagueStates([game.leagueId])).get(game.leagueId) as LeagueState | undefined;
  if (!s0) throw new HttpError(404, "League not found");
  if (StateLogic.GhostLogic.lockedDown(s0)) throw new HttpError(409, FROZEN);
  const known = new Set(StateLogic.formatOf(s0).events.map((e: { id: string }) => e.id));
  const given = body.points && typeof body.points === "object" ? Object.entries(body.points as Record<string, unknown>) : [];
  if (!given.length) throw new HttpError(400, "Nothing changed");
  const points: Record<string, number> = {};
  for (const [id, v] of given) {
    const n = Number(v);
    if (!known.has(id)) throw new HttpError(400, `"${id}" isn't one of this game's moments`);
    if (!Number.isFinite(n) || n < -50 || n > 50) throw new HttpError(400, "Points are -50 to 50");
    points[id] = StateLogic.roundPoints(n);
  }
  const apply = (s: LeagueState) => StateLogic.updateSettings(s, "eventPoints", { ...(s.settings.eventPoints ?? {}), ...points });
  if (body.preview) {
    const after = structuredClone(s0);
    apply(after);
    const { rows: seats } = await pool.query("SELECT player_id, user_id FROM league_memberships WHERE league_id = $1 AND player_id IS NOT NULL", [game.leagueId]);
    const users = new Map(seats.map((r) => [r.player_id, r.user_id]));
    return { lines: previewLines(s0, after, game.gameName, (p) => users.get(p) ?? null) };
  }
  const batch = crypto.randomUUID();
  let changed = false;
  const n = Object.keys(points).length;
  // Points aren't a plain setting (settingsSetChange leaves them out): their own line, and an Undo that puts them back.
  await withLeagueLock(game.leagueId, (s) => {
    if (StateLogic.GhostLogic.lockedDown(s)) throw new HttpError(409, FROZEN);
    apply(s);
  }, (b, a) => {
    if (JSON.stringify(b.settings.eventPoints ?? null) === JSON.stringify(a.settings.eventPoints ?? null)) return null;
    changed = true;
    return {
      userId: scope.user.id,
      kind: "rules.points",
      tier: 2,
      text: `Changed the points for ${n} ${n === 1 ? "moment" : "moments"}: the season is scored again`,
      batch,
      detail: { fields: ["eventPoints"] },
      undo: { type: "settingsSet", before: { eventPoints: b.settings.eventPoints ?? null }, after: { eventPoints: a.settings.eventPoints ?? null } },
    };
  });
  return { batch: changed ? batch : null };
}

// ---- Scoring rules: the read side ----

export interface GameRules {
  leagueId: string;
  name: string;
  gameName: string;
  gameType: string;
  /** Weekly Lineup's points, grouped as How it works groups them. */
  points: PointGroup[] | null;
  /** The other games, in plain words. */
  lines: string[];
}

export interface ScoringRules {
  /** "ZT Survivor 51" (a rulebook row) or the show's format ("Survivor"). */
  rulebook: { name: string; season: boolean; following: number };
  games: GameRules[];
  /** Make it ours (step 6b part 3): following the season's rulebook or the couch's own copy, and the copy's choices. */
  ours: OurRules;
  /** A game here is locked down (step 15 part 4): the rules are frozen for the season, nothing on this page changes. */
  frozen: boolean;
}

export async function scoringRules(scope: BackstageScope): Promise<ScoringRules> {
  const loaded = await load(scope);
  const mark = await markOf(scope);
  let rulebook: ScoringRules["rulebook"] | null = null;
  const games: GameRules[] = [];
  for (const l of loaded) {
    const seat = await seatOf(scope.user.id, l.game.leagueId);
    const view = StateLogic.GhostLogic.viewFor(l.state, seat, mark);
    const format = StateLogic.formatOf(view);
    const row = await rulebookForLeague(pool, { leagueId: l.game.leagueId, settings: l.state.settings });
    if (!rulebook) {
      const line = row ? await lineage(pool, row.id) : null;
      rulebook = row
        ? { name: row.name, season: true, following: line?.following ?? 1 }
        : { name: format.name.replace(/^The /, ""), season: false, following: 0 };
    }
    // The rulebook as it stood at your episode: a show change from a later one isn't on the page yet.
    const book = row?.blocks ? { blocks: blocksAt(row.blocks, await inForceEdits(pool, row.id), mark ?? Infinity), aliases: row.aliases } : rulebookFor(format.id, format.data);
    const weekly = l.game.gameType === "active-roster";
    games.push({
      leagueId: l.game.leagueId,
      name: l.game.name,
      gameName: l.game.gameName,
      gameType: l.game.gameType,
      points: weekly
        ? pointGroups(book.blocks, {
            compiled: format.data,
            aliases: book.aliases,
            points: l.state.settings.eventPoints,
            ownership: l.state.settings.ownershipMode,
            seen: mark ?? Infinity,
          })
        : null,
      lines: weekly ? [] : gameRules(view),
    });
  }
  return {
    rulebook: rulebook ?? { name: "this show", season: false, following: 0 },
    games,
    ours: await ourRules(scope),
    frozen: loaded.some((l) => StateLogic.GhostLogic.lockedDown(l.state)),
  };
}
