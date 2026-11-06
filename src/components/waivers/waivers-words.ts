import type { LeagueState, ReplaceRule, WaiverFeel, WaiverWindows } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { swapPhrase, windowLine } from "@/lib/game/waiver-words.js";

// The words waivers speak in (docs/PLAN-waivers-v2.md "Phase 2: picked design" -> Words), in one place
// so the Waivers page, its settings, the rules sheet and the create wizard never say a rule two ways.
// The guiding rule: if it needs a lot of words, the UX isn't intuitive. Short labels, no sums on screen,
// and never "pickup" or "add/drop" (code keeps those names; people read Replace and Swap).

export const FEELS: WaiverFeel[] = ["casual", "balanced", "competitive"];
export const FEEL_LABEL: Record<WaiverFeel, string> = { casual: "Casual", balanced: "Balanced", competitive: "Competitive" };

/** The four rules, as the settings' radio rows say them. Classic never shows "Only when short". */
export function ruleRows(state: LeagueState, shortAt: number): { rule: ReplaceRule; title: string; detail: string }[] {
  const rows: { rule: ReplaceRule; title: string; detail: string }[] = [
    { rule: "always", title: "Replace right away", detail: "After any episode." },
    { rule: "whenShort", title: "Only when short", detail: `Once a team is down to ${shortAt} still in.` },
    { rule: "windows", title: "Wait for a waiver window", detail: "They stay on the team until then." },
    { rule: "never", title: "No replacements", detail: "Out is out." },
  ];
  return StateLogic.getLeagueType(state).hasActiveRoster ? rows : rows.filter((r) => r.rule !== "whenShort");
}

/** None · 1 · 2 … · All (the whole roster). */
export function swapsLabel(n: number, roster: number): string {
  return n <= 0 ? "None" : n >= roster ? "All" : String(n);
}

/** "Swap 1" / "Swap up to 2" / "Swap any": what a window allows, with no names (waiver-words.js). */
export { swapPhrase };

/** The claim deadline, as the settings say it: "1 day before". */
export function deadlineLabel(hours: number): string {
  return hours === 24 ? "1 day before" : hours === 48 ? "2 days before" : `${hours} hours before`;
}
/** ...and in a sentence: "a day". */
export function deadlineWords(hours: number): string {
  return hours === 24 ? "a day" : hours === 48 ? "two days" : `${hours} hours`;
}

export const ORDER_LABEL: Record<string, string> = { rolling: "Rolling", leastPoints: "Fewest points first", mostPoints: "Most points first" };

/** Settings a feel's bullets are written from: the league's own, or a recommendation's. */
export interface WaiverShape {
  replaceRule: ReplaceRule;
  replenishAt?: number | null;
  waiverWindows: WaiverWindows;
  waiverProcessHours?: number;
  replenishOrderBy?: string;
  autoFill: boolean;
}

/**
 * The Suggested card's four bullets (settings 1A, the create wizard): how a league set this way plays,
 * in plain words, each with an icon key. The Casual · Balanced · Competitive switch rewrites them live.
 */
export function shapeBullets(shape: WaiverShape, o: { classic: boolean; shared: boolean; roster: number; shortAt: number }): { icon: "out" | "win" | "ord" | "clk"; text: string }[] {
  const w = shape.waiverWindows;
  const out =
    shape.replaceRule === "always"
      ? "Lose someone? Replace them right after the episode."
      : shape.replaceRule === "whenShort"
        ? `Lose someone? Replace them once you're down to ${o.shortAt} still in.`
        : shape.replaceRule === "windows"
          ? "Lose someone? They wait for a waiver window."
          : "Lose someone? No replacement.";
  const swaps = swapPhrase(w.swaps, o.roster).toLowerCase();
  const win =
    w.schedule === "manual"
      ? w.swaps > 0 && o.classic
        ? "You open waiver windows, like after the merge."
        : w.swaps > 0 || shape.replaceRule === "windows"
          ? "You open waiver windows when you want them."
          : "No waiver windows unless you open one."
      : w.swaps <= 0
        ? w.schedule === "everyEpisode"
          ? "A waiver window after every episode."
          : `A waiver window every ${w.every} episodes.`
        : w.schedule === "everyEpisode"
          ? `${cap(swaps)} after any episode.`
          : `A waiver window every ${w.every} episodes: ${swaps}.`;
  const by = shape.replenishOrderBy || "rolling";
  const ord = o.shared
    ? "Everyone can pick the same free agent."
    : by === "rolling"
      ? "Get a free agent, go to the back of the line."
      : by === "leastPoints"
        ? "Fewest points gets first pick."
        : "Most points gets first pick.";
  const clk = shape.autoFill
    ? "Forget to claim? They get the top free agent."
    : `Claims are due ${deadlineWords(shape.waiverProcessHours ?? 24)} before each episode.`;
  return [
    { icon: "out", text: out },
    { icon: "win", text: win },
    { icon: "ord", text: ord },
    { icon: "clk", text: clk },
  ];
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** The episode after `after` that opens a waiver window on its own (with swaps, if `swaps`), or null. */
export function nextWindow(state: LeagueState, after: number, swaps = true): number | null {
  const W = StateLogic.WaiverLogic;
  const total = Math.max(13, ...state.episodes.map((e) => e.number));
  for (let n = after + 1; n < total; n++) if (W.isWindowEpisode(state, n) && (!swaps || W.windows(state).swaps > 0)) return n;
  return null;
}

/** The latest episode with results this viewer has seen (0 before any). */
export function latestEpisode(state: LeagueState): number {
  return Math.max(0, StateLogic.SpoilerLogic.latestWithResults(state));
}

/** A phase of the season by its id, when there's no rulebook to name it: "merged" is "Merged". */
export const phaseWord = (id: string) => cap(id.replace(/[-_]+/g, " "));

/**
 * Waivers that start with a phase of the season (WaiverLogic.startsAt) whose start this viewer hasn't seen: its id. Never where
 * it starts: a start past what they've seen says nothing yet (as AnswerLogic's phases). Null when they run from the start, or
 * it's started (or started before the game did).
 */
export function waiversAhead(state: LeagueState): string | null {
  const from = StateLogic.WaiverLogic.startsAt(state);
  if (!from) return null;
  const start = StateLogic.startEpisode(state);
  if (from.at !== null && (start === null || from.at <= start || latestEpisode(state) >= from.at)) return null;
  return from.phase;
}

/**
 * The rules sheet's three answers (and the quiet week's sentence): when one of yours is voted out, when
 * you can swap someone still in, and who gets a free agent two people want. For THIS league. `names`: the
 * season's phases by id, for waivers that start with one (else "merged" reads "Merged").
 */
export function ruleAnswers(state: LeagueState, names?: Record<string, string>): { out: string; swap: string; order: string } {
  const W = StateLogic.WaiverLogic;
  const rule = W.replaceRule(state);
  const w = W.windows(state);
  const R = StateLogic.rosterSize(state);
  const after = latestEpisode(state);
  const next = nextWindow(state, after);
  const out =
    rule === "always"
      ? "You can replace them after any episode."
      : rule === "whenShort"
        ? `You can replace them once you're down to ${W.shortAt(state)} still in.`
        : rule === "windows"
          ? w.schedule === "manual"
            ? "You can replace them when your commissioner opens a waiver window."
            : `You can replace them at the next waiver window${next ? ` (after Episode ${next})` : ""}.`
          : "They stay on your team: there are no replacements.";
  const n = w.swaps >= R ? "any" : String(w.swaps);
  let swap =
    w.swaps <= 0
      ? w.schedule === "manual"
        ? "When your commissioner opens a waiver window that allows swaps."
        : "There are no swaps in this league."
      : w.schedule === "manual"
        ? "When your commissioner opens a waiver window."
        : w.schedule === "everyEpisode"
          ? `After any episode: ${n === "any" ? "any of them" : n === "1" ? "1 swap" : `up to ${n}`}.`
          : `Once every ${w.every} episodes, ${n === "any" ? "any of them" : n === "1" ? "1 swap" : `up to ${n} swaps`}${next ? `: next after Episode ${next}` : ""}.`;
  // Waivers that start with a phase, still ahead: nothing until it, then a window replacing everyone who's out, then the usual.
  const ahead = waiversAhead(state);
  let replace = out;
  if (ahead) {
    const P = names?.[ahead] ?? phaseWord(ahead);
    const then = (line: string) => `After that, ${line.charAt(0).toLowerCase()}${line.slice(1)}`;
    replace = `They stay on your team until ${P} starts. After its first episode, a waiver window lets you replace everyone who's out. ${rule === "never" ? "After that, out is out." : then(out)}`;
    if (w.swaps > 0) swap = `Not until ${P} starts: its waiver window allows ${n === "any" ? "swapping any of them" : n === "1" ? "1 swap" : `up to ${n} swaps`}. ${then(swap)}`;
  }
  const by = state.settings.replenishOrderBy || "rolling";
  const order = state.settings.ownershipMode === "shared"
    ? "Nobody: everyone can have the same free agent in this league."
    : by === "rolling"
      ? "Whoever's first in line. Get a free agent and you go to the back, so a quiet week moves you up."
      : `Whoever's higher in the standings order: ${by === "leastPoints" ? "fewest" : "most"} points first.`;
  return { out: replace, swap, order };
}

/** What a waiver window allows, with no names: the sheet's preview, the commissioner's plate and the
 *  "Waiver window open" push all use waiver-words.js's one line. */
export { windowLine };
