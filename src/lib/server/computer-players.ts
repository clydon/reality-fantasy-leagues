import crypto from "crypto";
import StateLogic from "@/lib/game/state-logic.js";
import { addBot, addProblem, botSnapshot, botsIn, botsPlay, levelOf, removeProblem, BOT_LEVEL, LEVEL_WORDS, type BotLevel } from "@/lib/game/computer-players";
import type { LeagueState } from "@/lib/game/types";
import { isUuid, type SessionUser } from "./auth-helpers";
import { dropBlindPicksForPlayer } from "./blind-draft";
import { plainChange, type BotUndo } from "./change-log";
import type { PoolClient } from "pg";
import { withLeagueLock, HttpError } from "./db";
import { stagesBegun } from "./stages";
import { couchGames } from "./league-changes";

// Computer players in a couch's games (src/lib/game/computer-players.ts has the rules): Backstage › Members lists each game's,
// and whoever runs it (Commissioner or Game admin) adds one, sets its level, or takes one or all of them out. Each change is a
// line in Recent changes, with a typed Undo (Settings Round 3b, rule 6): one added goes again, a level goes back, and seats taken out
// (tier 3) come back for 30 days, with whoever they'd drafted while nobody else holds them.

export interface BotSeat {
  playerId: string;
  name: string;
  level: BotLevel;
}

/** A game's computer players, for whoever runs it. */
export interface GameBots {
  bots: BotSeat[];
  /** Why one can't be added now, or null. */
  add: string | null;
  /** Why they can't be taken out now, or null. */
  remove: string | null;
  /** After the draft, a bot taken out takes its team with it. */
  drafted: boolean;
}

/** A game's computer players, or null when they don't play it (computer-players.ts botsPlay). */
export function gameBots(s: LeagueState): GameBots | null {
  const bots = botsIn(s);
  if (!botsPlay(s) && !bots.length) return null;
  return {
    bots: bots.map((p) => ({ playerId: p.id, name: p.name, level: levelOf(p) })),
    add: botsPlay(s) ? addProblem(s) : "Computer players don't play this game",
    remove: removeProblem(s),
    drafted: !!s.draftPicksMade || StateLogic.BlindDraftLogic.isRevealed(s),
  };
}

const isLevel = (v: unknown): v is BotLevel => v === "easy" || v === "normal" || v === "sharp";

/** The game, when you run it on this couch's season. */
async function yours(user: SessionUser, seasonId: string, couchId: string | null, leagueId: unknown): Promise<string> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  if (!couchId) throw new HttpError(400, "couch required");
  if (typeof leagueId !== "string") throw new HttpError(400, "leagueId required");
  const { runs } = await couchGames(user, seasonId, couchId);
  if (!runs.has(leagueId)) throw new HttpError(403, "Only whoever runs this game changes its computer players");
  return leagueId;
}

export type BotAction = { leagueId?: unknown; action?: unknown; level?: unknown; playerId?: unknown; all?: unknown };

/**
 * add { level }: a computer player joins (named after nobody here). level { playerId, level }: how sharp it plays.
 * remove { playerId } or { all: true }: they go, never while the draft's open.
 */
/** E1e: a game in stages has no draft of its own to go by; once any stage has begun (its draft, or results), computer players neither
 *  join nor go (a stage's open draft would shift under whoever's waiting). Null otherwise. */
async function stagesProblem(s: LeagueState, client: PoolClient, leagueId: string): Promise<string | null> {
  if (!StateLogic.StageLogic.on(s)) return null;
  return (await stagesBegun(client, leagueId)) ? "The game's stages have begun: computer players join or go before they do" : null;
}

export async function changeBots(user: SessionUser, seasonId: string, couchId: string | null, body: BotAction): Promise<{ names: string[]; batch: string }> {
  const leagueId = await yours(user, seasonId, couchId, body.leagueId);
  const names: string[] = [];
  const batch = crypto.randomUUID();
  let undo: BotUndo | null = null;
  if (body.action === "add") {
    const level = isLevel(body.level) ? body.level : "normal";
    await withLeagueLock(
      leagueId,
      async (s, client) => {
        if (!botsPlay(s)) throw new HttpError(409, "Computer players don't play this game");
        const problem = addProblem(s) ?? (await stagesProblem(s, client, leagueId));
        if (problem) throw new HttpError(409, problem);
        const bot = addBot(s, level);
        names.push(bot.name);
        undo = { type: "bot", action: "add", playerId: bot.id };
      },
      () => ({ ...plainChange(user.id, "players", `Added a computer player, ${names[0]} (${LEVEL_WORDS[level]})`), batch, undo })
    );
  } else if (body.action === "level") {
    if (!isLevel(body.level)) throw new HttpError(400, "level must be easy, normal or sharp");
    const level = body.level;
    await withLeagueLock(
      leagueId,
      (s) => {
        const bot = botsIn(s).find((p) => p.id === body.playerId);
        if (!bot) throw new HttpError(404, "That computer player isn't in this game");
        undo = { type: "bot", action: "level", playerId: bot.id, before: bot.botLevel, after: BOT_LEVEL[level] };
        bot.botLevel = BOT_LEVEL[level];
        names.push(bot.name);
      },
      () => ({ ...plainChange(user.id, "players", `${names[0]} plays ${LEVEL_WORDS[level]} now`), batch, undo })
    );
  } else if (body.action === "remove") {
    await withLeagueLock(
      leagueId,
      async (s, client) => {
        const problem = removeProblem(s) ?? (await stagesProblem(s, client, leagueId));
        if (problem) throw new HttpError(409, problem);
        const out = botsIn(s).filter((p) => body.all === true || p.id === body.playerId);
        if (!out.length) throw new HttpError(404, body.all === true ? "There are no computer players in this game" : "That computer player isn't in this game");
        undo = { type: "bot", action: "remove", seats: out.map((bot) => botSnapshot(s, bot.id)) };
        for (const bot of out) {
          // As classic's DELETE: the seat, whoever it drafted (free again), and any blind lock-in it made.
          StateLogic.removePlayer(s, bot.id);
          await dropBlindPicksForPlayer(client, leagueId, bot.id);
          StateLogic.BlindDraftLogic.setLockedPlayerIds(s, StateLogic.BlindDraftLogic.lockedPlayerIds(s).filter((id) => id !== bot.id));
          names.push(bot.name);
        }
      },
      () => ({
        ...plainChange(user.id, "players", names.length > 1 ? `Took out the computer players (${names.join(", ")})` : `Took out ${names[0]}, a computer player`, 3),
        batch,
        undo,
        undoUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      })
    );
  } else throw new HttpError(400, "action must be add, level or remove");
  return { names, batch };
}
