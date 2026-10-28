import StateLogic from "./state-logic.js";
import type { LeagueState } from "./types";
import { BOT_NAMES } from "./practice";

// Computer players in any game (not only the practice couch, solo.ts): seats with no account that bot-logic.js plays, added
// with Start a game's Computer players or Backstage › Members by whoever runs the game (Commissioner or Game admin). Pure, for
// the tests; the server's writes are src/lib/server/computer-players.ts.
//
//   Which games: the draft games and Survival Pool on any show, the ones bot-logic.js plays (the calls and bingo games are each
//   person's own). Where nobody goes home (a series, a sport) the bots have no danger to read and go on form: points per
//   episode, which is what a sport's pool (survive by scoring) and lineups want.
//   Adding: before a draft starts (a bot added after it is an inactive seat: RosterLogic.addPlayer), and in a game with no
//   draft before its first result of its own (later it would have missed picks).
//   Taking out: any time but while the draft is open (the user, 2026-10-27: "they can't be removed during a draft"). Before it,
//   the seat goes; after it, the seat goes with its team, and whoever it drafted is free to pick up.

export type BotLevel = "easy" | "normal" | "sharp";
/** bot-logic.js's LEVELS by the words people read. */
export const BOT_LEVEL: Record<BotLevel, "casual" | "solid" | "sharp"> = { easy: "casual", normal: "solid", sharp: "sharp" };
export const LEVEL_OF: Record<string, BotLevel> = { casual: "easy", solid: "normal", sharp: "sharp" };
export const LEVEL_WORDS: Record<BotLevel, string> = { easy: "Easy", normal: "Normal", sharp: "Sharp" };

/** The most computer players a game takes. */
export const MAX_BOTS = 5;
const NAMES = [...BOT_NAMES, "Rex", "Zoe", "Kit", "Gus", "Mia", "Lou"];

type Seat = LeagueState["players"][number] & { botLevel?: string };

/** The computer players still playing in a game. */
export const botsIn = (s: LeagueState): Seat[] => s.players.filter((p) => p.automated && !p.disabled) as Seat[];

export const levelOf = (p: Seat): BotLevel => LEVEL_OF[p.botLevel ?? "solid"] ?? "normal";

/** Whether bot-logic.js plays this kind of game: a draft or Survival Pool, not a calls or bingo game. */
export function botsPlay(s: LeagueState): boolean {
  const t = StateLogic.getLeagueType(s) as { hasRoster?: boolean; hasWeeklyPicks?: boolean; hasCalls?: boolean; hasBingo?: boolean };
  return !t.hasCalls && !t.hasBingo && !!(t.hasRoster || t.hasWeeklyPicks);
}

/** A draft that's open: started, and not yet done (every pick made, or the blind draft revealed). */
export function draftOpen(s: LeagueState): boolean {
  if (!StateLogic.getLeagueType(s).hasRoster || !StateLogic.isDraftStarted(s)) return false;
  if (s.settings.ownershipMode === "shared") return !StateLogic.BlindDraftLogic.isRevealed(s);
  // currentDraftTurn keeps the order in step with the seats: on a copy, so a read changes nothing.
  const turn = StateLogic.currentDraftTurn(structuredClone(s));
  return !!turn && !turn.isComplete;
}

/** Why a computer player can't join now, or null. */
export function addProblem(s: LeagueState): string | null {
  if (botsIn(s).length >= MAX_BOTS) return `A game takes up to ${MAX_BOTS} computer players`;
  if (StateLogic.getLeagueType(s).hasRoster) {
    if (StateLogic.isDraftStarted(s)) return "The draft has started: computer players join before it does";
  } else if (StateLogic.GhostLogic.isUnderway(s)) return "It's under way: computer players join before its first results";
  return null;
}

/** Why computer players can't be taken out now, or null. */
export const removeProblem = (s: LeagueState): string | null => (draftOpen(s) ? "The draft's open: take them out before it starts or once it's done" : null);

/** A name nobody in the game goes by: the next of NAMES, else "Computer 2". */
export function freeBotName(s: LeagueState): string {
  const taken = new Set(s.players.map((p) => p.name.trim().toLowerCase()));
  const free = NAMES.find((n) => !taken.has(n.toLowerCase()));
  if (free) return free;
  for (let i = 1; ; i++) if (!taken.has(`computer ${i}`)) return `Computer ${i}`;
}

/** Seat a computer player at `level` (no checks: addProblem first). */
export function addBot(s: LeagueState, level: BotLevel): Seat {
  const bot = StateLogic.addPlayer(s, freeBotName(s), { automated: true }) as Seat;
  bot.botLevel = BOT_LEVEL[level];
  return bot;
}
