// A person's weekly share of the month's preview budget (docs/PLAN-preview-release.md, decision 4, revised 2026-11-20: "can we
// dynamically scale the number of previews allowed based on active users? and also reshape their limit in a per day or per week
// limit?"). The month's budget is fixed by the plan it's on, so more people means a smaller share each, never more previews: what's
// left this month, split between the people likely to preview, over the weeks left, kept between a floor (nobody's shut out while
// the budget lasts) and a ceiling (nobody drains it). The service's own monthly cap stays the hard stop. Pure, for its tests.

/** Never fewer than this a week while the month's budget lasts. */
export const SHARE_FLOOR = 3;
/** Never more than this a week, however quiet the month. */
export const SHARE_CEILING = 20;
/** People counted as previewing at the least, so a quiet month doesn't hand one person the lot. */
export const SHARE_MIN_PEOPLE = 5;
/** What a preview costs the service when the month has none to average yet (measured 2026-11-20: 8.4 s of CPU, its phones included). */
export const PREVIEW_COST_MS = 8400;

export interface ShareInputs {
  /** Previews the month's budget still has room for. */
  previewsLeft: number;
  /** People who previewed in the last 30 days. */
  people: number;
  /** Weeks left in the month (a fraction is fine). */
  weeksLeft: number;
}

/** The weekly share: previews left ÷ people ÷ weeks left, between the floor and the ceiling. */
export function weeklyShare({ previewsLeft, people, weeksLeft }: ShareInputs): number {
  const share = Math.floor(Math.max(0, previewsLeft) / Math.max(SHARE_MIN_PEOPLE, people) / Math.max(1, weeksLeft));
  return Math.max(SHARE_FLOOR, Math.min(SHARE_CEILING, share));
}

/** How many previews a month's ledger still has room for: its CPU left over what a preview has cost on average this month. */
export function previewsLeftIn(month: { previews: number; cpuMs: number; budgetMs: number }): number {
  const each = month.previews > 0 ? month.cpuMs / month.previews : PREVIEW_COST_MS;
  return Math.max(0, Math.floor((month.budgetMs - month.cpuMs) / Math.max(1, each)));
}

/** Weeks from `now` to the end of its month (UTC, as the service's ledger keeps months). */
export function weeksLeftIn(now: Date): number {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(0, end - now.getTime()) / (7 * 864e5);
}
