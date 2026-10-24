// Calm clocks (docs/PLAN-new-design.md step 0c, the critique of 2026-10-23): anything more than a day away reads in
// days ("Wed 8:05 PM · in 5 days"); seconds tick only inside the last day. Pure, so tests/new-nav.test.js can
// check it; times are shown in the viewer's own time zone.

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whole calendar days from now to t: 0 today, 1 tomorrow. */
export function dayDiff(t: number, now = Date.now()): number {
  return Math.round((startOfDay(t) - startOfDay(now)) / DAY);
}

/** "Wed 8:05 PM". */
export function airTime(t: number): string {
  return new Date(t).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).replace(",", "");
}

/** Whether a clock for t should tick by the second (inside the last day) rather than read in days. */
export function ticks(t: number, now = Date.now()): boolean {
  return t - now <= DAY;
}

/**
 * How far away t is, calmly: "in 5 days", "tomorrow", "today" when it's more than a day out; inside the last day
 * a countdown ("5:12:33", "12:33"); "now" once it's passed.
 */
export function calm(t: number, now = Date.now()): string {
  if (!ticks(t, now)) {
    const d = dayDiff(t, now);
    return d > 1 ? `in ${d} days` : d === 1 ? "tomorrow" : "today";
  }
  const s = Math.max(0, Math.floor((t - now) / 1000));
  if (s === 0) return "now";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** "Wed 8:05 PM · in 5 days". */
export function calmWhen(t: number, now = Date.now()): string {
  return `${airTime(t)} · ${calm(t, now)}`;
}
