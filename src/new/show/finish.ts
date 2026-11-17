// How someone left, for every face and chart that greys or reds a castaway (BACKLOG 96). A season's winner and its finalists leave
// too (it's how the finale's places are recorded), but reaching the end isn't going home: they keep their colour, never Live Red
// (DESIGN.md: red is for someone going home). The server says who finished (cast-stats.ts `finish`, from the format's end-of-game
// exits, selectors.ts finishOf); a game's own view says the same with `knocked` (left, and not by reaching the end).
import type { CastStat } from "../data";

/** Out of the game the way someone goes home: left, and not by reaching the end. */
export const goneHome = (c: Pick<CastStat, "out" | "finish">) => c.out !== null && !c.finish;

/** How a finisher finished, in the show's words: its own for the winner ("Sole Survivor"), Finalist for the rest; null otherwise. */
export const finishWord = (c: Pick<CastStat, "finish" | "how">) => (c.finish === "won" ? c.how || "Winner" : c.finish === "final" ? "Finalist" : null);
