import * as Capabilities from "./game-spec/capabilities.js";
import type { SpecContext } from "./game-spec/index.js";
import type { CallBook } from "./calls";
import { BUILT_IN_BLOCKS } from "./formats/blocks/index.js";
import { contextOf } from "./question-choices";
import SAMPLES from "../../../tests/fixtures/rulebook-samples.js";

// The capability tracker's pages (docs/PLAN-start-a-game-gpt.md step A5): what a row's page can settle, for its status. Shared by
// the doc's generator (scripts/engine-capabilities.js) and the engine lab (engine-lab.ts), so both read a row the same way.
//
// A page's `rulebook` names the rules its specs are checked against: a built-in (survivor, traitors, challenge) or one of
// tests/fixtures/rulebook-samples.js (belowDeck, pluribus, snl, formula1, amazingRace). A show with neither names a show of its
// kind as a stand-in (`checkedAs`: Dancing with the Stars against The Amazing Race's, couples out each week and a winner).

type Page = { show?: string; season?: number | null; sport?: string; league?: string; event?: string | null; rulebook?: string | null; checkedAs?: boolean } | null | undefined;

/** The rules a `rulebook` key names, or null. */
export function bookOf(key: string | null | undefined): CallBook | null {
  if (!key) return null;
  const built = (BUILT_IN_BLOCKS as Record<string, CallBook>)[key];
  if (built) return built;
  const s = (SAMPLES as Record<string, unknown>)[key] as { blocks?: unknown } | undefined;
  if (!s) return null;
  return (s.blocks ? s : { blocks: s, aliases: null }) as CallBook;
}

const ctxCache = new Map<string, SpecContext | null>();
/** What a row's page can settle (game-spec specProblems' ctx), or null when its page names no rules. */
export function pageCtx(page: Page): SpecContext | null {
  const key = page?.rulebook ?? "";
  if (!ctxCache.has(key)) {
    const book = bookOf(key);
    ctxCache.set(key, book ? contextOf(book) : null);
  }
  return ctxCache.get(key) ?? null;
}

/** "Survivor 51", "football: NFL". */
export const pageName = (page: Page): string => Capabilities.pageName(page ?? null);

/** A row's status as the tracker reads it: on its own page's rules. */
export const trackerStatus = (row: Record<string, unknown>) => Capabilities.statusOf(row, pageCtx(row.page as Page));
