// How the desk says the bot's runs (docs/PLAN-desk-parity.md step 4; the mock's desk-research.js RS_K, rsWhen, rsDur):
// each kind's words, our usual five (the default: the desk can make another schedule our usual, which the server hands the
// page), the timings a run's stepper offers, and a run's timing in words. Pure, so the server's History lines and the page's
// sheets say the same thing. The runs themselves follow db/bot-research.js (dueAt).

export type RunKind = "quick" | "full" | "schedule" | "trivia" | "bingo";
export interface Run {
  kind: RunKind;
  after: number;
  on: boolean;
  /** The slots it was before it moved (db/bot-research.js carryWas): kept as it is. */
  was?: string[];
}

/** What a run's minutes count from: the episode's end, back from the next episode, or back from its start. */
export type CountFrom = "end" | "next" | "air";

/** `named`: "has no {named} run"; `lack`: what a season without one goes without (the Inbox, Not in its schedule). */
export const KINDS: Record<RunKind, { t: string; short: string; now: string; add: string; took: string; from: CountFrom; named: string; lack: string }> = {
  full: { t: "Full results", short: "full results", now: "The whole checklist for an episode", add: "The whole checklist.", took: "about 3 minutes", from: "end", named: "Full results", lack: "its results wait for the couches" },
  quick: { t: "Who went home", short: "who went home", now: "Who left, and the headline", add: "Who left, and the headline.", took: "about 30 seconds", from: "end", named: "Who went home", lack: "no early results" },
  schedule: { t: "Schedule check", short: "the schedule check", now: "When the next one airs", add: "When the next episode airs, and how long it runs.", took: "under a minute", from: "end", named: "Schedule check", lack: "nobody checks when the next one airs" },
  trivia: { t: "Trivia", short: "trivia", now: "Six questions, then checked", add: "Six questions about it.", took: "about 2 minutes", from: "next", named: "Trivia", lack: "no trivia questions about its episodes" },
  bingo: { t: "Bingo squares", short: "bingo squares", now: "Thirty squares, then checked", add: "Thirty squares for it.", took: "up to 4 minutes", from: "air", named: "Bingo", lack: "its cards won't deal" },
};
/** What a season with no bingo run goes without when it has squares of its own (its bank deals every card). */
export const BINGO_BANK_LACK = "every card deals from the season's own squares";
/** Run now's order: full results first (wide), then the rest. */
export const NOW_ORDER: RunKind[] = ["full", "quick", "schedule", "trivia", "bingo"];

/** Our usual five by default (db/bot-research.js DEFAULT_SCHEDULE): the desk's own, when it's made one, comes from the server. */
export const USUAL: Run[] = [
  { kind: "quick", after: 0, on: true },
  { kind: "full", after: 60, on: true },
  { kind: "full", after: 720, on: true },
  { kind: "trivia", after: 1440, on: true },
  { kind: "bingo", after: 1440, on: true },
];
/** A season's runs at most (db/bot-research.js MAX_RUNS). */
export const MAX_RUNS = 8;
/** The timings a run's stepper steps through, by what it counts from (from the end: endLadder's first hour, then hours). */
export const LADDER: Record<CountFrom, number[]> = {
  end: [0, 5, 10, 15, 20, 30, 45, 60],
  next: [180, 360, 720, 1080, 1440, 2160, 2880],
  air: [60, 180, 360, 720, 1080, 1440, 2160, 2880],
};
/** How far past an episode's end a run counted from it can be stepped (two days). */
export const END_MAX = 2880;

/**
 * The timings a run counted from the end steps through (the user, 2026-10-29: "times on the hour"): the first hour's finer
 * steps (at its end, 5, 10, 15, 20, 30, 45 minutes, an hour), then one hour at a time on the clock's whole hours for the
 * episode that ends at `endMs` in `tz` (from a 9:30 PM end: 11:00 PM, 12:00 AM, ... 12:00 PM the next day, 870), as the
 * minutes from its end. With no episode to go by, an hour at a time from the first hour.
 */
export function endLadder(endMs: number | null, tz: string | null): number[] {
  const out = [...LADDER.end];
  const m = endMs === null ? 0 : Number(new Intl.DateTimeFormat("en-US", { timeZone: tz || undefined, minute: "numeric" }).format(endMs)) % 60;
  for (let a = 60 + ((60 - m) % 60 || 60); a <= END_MAX; a += 60) out.push(a);
  return out;
}
/** A trivia run waits at least this long (minutes) after its episode ends, for the recaps (db/bot-research.js TRIVIA_AFTER_END). */
export const TRIVIA_AFTER_END = 180;

/**
 * When a run lands (ms), or null for never: db/bot-research.js dueAt's rule, for the page's sheets, which work out a new
 * timing's time before it's saved (tests/desk-bot-words.test.js holds the two together). From the episode's end; trivia's
 * back from the next one's start, no sooner than TRIVIA_AFTER_END after the end, never once it airs (no next one: from the
 * end); bingo's back from this one's start, never once it has.
 */
export function runTime(run: { kind: RunKind; after: number }, ends: number, nextAt: number | null, starts: number): number | null {
  const m = run.after * 60_000;
  if (run.kind === "bingo") return starts - m < starts ? starts - m : null;
  if (run.kind !== "trivia" || nextAt === null) return ends + m;
  const due = Math.max(ends + TRIVIA_AFTER_END * 60_000, nextAt - m);
  return due < nextAt ? due : null;
}

/** A new run's timing: its usual one, else half an hour. */
export const usualAfter = (kind: RunKind, usual: Run[] = USUAL) => usual.find((r) => r.kind === kind)?.after ?? 30;
/** "Usually at its end.", "Usually 1 hr after it ends, and again 12 hr after it ends.", "Not one of our usual runs." */
export function usualWords(kind: RunKind, usual: Run[] = USUAL): string {
  const runs = usual.filter((r) => r.kind === kind);
  return runs.length ? `Usually ${runs.map((r) => when(r)).join(", and again ")}.` : "Not one of our usual runs.";
}
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];
/** "five", or 9 and up as a number: "our usual five". */
export const countWord = (n: number) => WORDS[n] ?? String(n);

/** "5 min", "1 hr", "1 hr 30 min", "a day", "2 days". */
export function dur(m: number): string {
  if (m >= 1440 && m % 1440 === 0) return m === 1440 ? "a day" : `${m / 1440} days`;
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m / 60} hr`;
}
/** "At its end" (counted from the end, 0), "9 hr after it ends", "a day before the next episode", "a day before it airs". */
export function when(r: { kind: RunKind; after: number }): string {
  const f = KINDS[r.kind].from;
  if (r.after === 0 && f === "end") return "at its end";
  return `${dur(r.after)} ${f === "end" ? "after it ends" : f === "next" ? "before the next episode" : "before it airs"}`;
}
export const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
export const and = (l: string[]) => (l.length < 2 ? (l[0] ?? "") : `${l.slice(0, -1).join(", ")} and ${l[l.length - 1]}`);
export const sameRun = (a: { kind: string; after: number }, b: { kind: string; after: number }) => a.kind === b.kind && a.after === b.after;
/** The usual runs a season hasn't got, in our usual order. */
export const missing = (runs: Run[], usual: Run[] = USUAL) => usual.filter((u) => !runs.some((r) => sameRun(r, u)));
export const isUsual = (runs: Run[], usual: Run[] = USUAL) => runs.length === usual.length && usual.every((u) => runs.some((r) => sameRun(r, u) && r.on === u.on));
/** Our usual's kinds a season has no run of at all (on or off): its runs "quietly missing" (the Inbox says so). */
export const lackingKinds = (runs: Run[], usual: Run[] = USUAL) => [...new Set(usual.map((u) => u.kind))].filter((k) => !runs.some((r) => r.kind === k));

/** What Autopilot does after each episode, in a line (the mock's rsAutoLine; Coming up says the same). */
export function autoLine(runs: Run[]): string {
  const k = [...new Set(runs.filter((r) => r.on && KINDS[r.kind].from === "end").map((r) => r.kind))];
  if (k.length === 1 && k[0] === "schedule") return "the schedule check after it";
  if (k.includes("quick") && k.includes("full")) return "who went home, then full results";
  return k.length ? and(k.map((x) => KINDS[x].short)) : "nothing after it";
}

/** Research and the bot's row on the season page: "Autopilot on · 5 runs after each episode". */
export function researchLine(bot: { on: boolean; schedule: Run[] }): string {
  const on = bot.schedule.filter((r) => r.on);
  if (!bot.on) return "Autopilot off · Run now any time";
  return `Autopilot on · ${on.length === 1 ? KINDS[on[0].kind].short : `${on.length} runs`} after each episode`;
}

/**
 * A schedule change in words, for its History line (who made it is History's): one run switched, retimed, added or taken
 * off; Autopilot on or off; the episode's length; or reset to our usual (`usual`, our usual five by default).
 */
export function changeLine(was: { on: boolean; runs: Run[]; minutes: number }, now: { on: boolean; runs: Run[]; minutes: number }, usual: Run[] = USUAL): string {
  const parts: string[] = [];
  if (was.on !== now.on) parts.push(now.on ? "Autopilot on" : "Autopilot off");
  if (was.minutes !== now.minutes) parts.push(`Episode length: ${dur(now.minutes)} (was ${dur(was.minutes)})`);
  const gone = was.runs.filter((r) => !now.runs.some((x) => sameRun(x, r)));
  const added = now.runs.filter((r) => !was.runs.some((x) => sameRun(x, r)));
  const flipped = now.runs.filter((r) => was.runs.some((x) => sameRun(x, r) && x.on !== r.on));
  const k = (r: Run) => KINDS[r.kind].t;
  if (usual.length && gone.length + added.length + flipped.length > 1 && isUsual(now.runs, usual)) parts.push(`Schedule reset to our usual ${countWord(usual.length)}`);
  // Retimed (and maybe switched in the same Save: its sheet has both).
  else if (gone.length === 1 && added.length === 1 && gone[0].kind === added[0].kind)
    parts.push(`${k(added[0])}: ${when(added[0])} (was ${when(gone[0])})${added[0].on !== gone[0].on ? (added[0].on ? ", on" : ", off") : ""}`);
  else {
    for (const r of added) parts.push(`${k(r)} added, ${when(r)}`);
    for (const r of gone) parts.push(`${k(r)} (${when(r)}) taken off`);
    for (const r of flipped) parts.push(`${k(r)} (${when(r)}) ${r.on ? "on" : "off"}`);
  }
  return parts.join(" · ") || "Nothing changed";
}
