// The strip's words for a pick when another pick game is on for the same episode (BACKLOG 240). Pure, beside the strip
// (src/new/show/strip.tsx), so tests/strip-pick-words.test.js can load it.
import type { Move } from "../data";
import type { ShowData } from "../screens/show-space";
import { kindOf } from "@/lib/game/spans";

/**
 * A pick's words when another game on the show asks the same of that episode (BACKLOG 240, the user's yes, 2026-11-21), so "Pick who
 * survives" isn't read as the one-episode game "Who survives?" beside it: a longer game by the name the Games tab gives it ("Survival
 * Pool: pick who survives"); a one-episode game by its own ("Who goes home?"). Null when the pick is the only one (the strip's words
 * as they were).
 */
export function pickWords(show: Pick<ShowData, "games">, m: Pick<Move, "kind" | "leagueId" | "episode">): string | null {
  if (m.kind !== "pick") return null;
  const on = (g: ShowData["games"][number]) => !g.archived && (!g.span || m.episode == null || (g.span.from <= m.episode && g.span.to >= m.episode));
  const picks = show.games.filter((g) => g.gameType === "pickem" && on(g));
  const mine = picks.find((g) => g.leagueId === m.leagueId);
  if (!mine || picks.length < 2) return null;
  const oneEpisode = (g: ShowData["games"][number]) => !!g.span && g.span.from === g.span.to;
  // A one-episode game's own name, without the episode it was named for (night.tsx quickName's rule).
  if (oneEpisode(mine)) return kindOf(mine.name).replace(/[\s·]*\b(ep|episode)\s*\d+$/i, "");
  // Twins among your longer games go by their own names, as the Games tab's rows do; otherwise by the game's.
  const twins = show.games.filter((g) => g.yourRole && g.gameType === mine.gameType && !oneEpisode(g)).length > 1;
  return `${twins && mine.name !== mine.gameName ? mine.name : mine.gameName}: pick who survives`;
}
