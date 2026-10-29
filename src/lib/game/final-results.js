// Early and final results (the user's decisions, 2026-10-29). Players get an episode's early results right after it airs (the
// quick run: who went home) and its final results at a fixed time: FINAL_TIME the day after it airs, in the season's own time
// zone (by noon Eastern the sources are reliable). Everyone is told when: the words say it ("Final results by 12:00 PM
// tomorrow", in the reader's own time, then "Final results are in"), the "Final results are in" push goes then (the hourly job,
// db/reminders.js), and the bot's last full run of the night lands before it (db/bot-research.js DEFAULT_SCHEDULE). A result
// still waiting on its sources at that time follows when it settles, as it always has: the time is about when to look.
//
// Plain CommonJS (as air-schedule.js is) so the hourly jobs can require it under bare node; typed in final-results.d.ts.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see above
const Air = require("./air-schedule.js");

const FINAL_TIME = "12:00";
const DEFAULT_TZ = "America/New_York";
const DAY = 24 * 60 * 60 * 1000;

// An episode that starts this soon after midnight aired the night before (a 12:30 AM start is Wednesday night's, not Thursday's).
const NIGHT_BEFORE = 4 * 60 * 60 * 1000;

/** When an episode that starts at `airAt` has its final results: FINAL_TIME the day after it airs, in the season's `tz`. */
function finalResultsAt(airAt, tz) {
  if (!airAt) return null;
  const at = new Date(airAt);
  if (Number.isNaN(at.getTime())) return null;
  const zone = tz || DEFAULT_TZ;
  return Air.zonedToUtc(Air.addDays(Air.localDate(new Date(at.getTime() - NIGHT_BEFORE), zone), 1), FINAL_TIME, zone);
}

/** "12:00 PM tomorrow", "12:00 PM today", "9:00 AM Friday", "12:00 PM Oct 31": in `tz` (the reader's; their device's when left out). */
function finalWhen(finalAt, now, tz) {
  const at = new Date(finalAt);
  const t = now instanceof Date ? now : new Date(now ?? Date.now());
  const zone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const clock = at.toLocaleTimeString("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" });
  const days = Math.round((Date.parse(`${Air.localDate(at, zone)}T00:00:00Z`) - Date.parse(`${Air.localDate(t, zone)}T00:00:00Z`)) / DAY);
  if (days === 0) return `${clock} today`;
  if (days === 1) return `${clock} tomorrow`;
  if (days > 1 && days < 7) return `${clock} ${at.toLocaleDateString("en-US", { timeZone: zone, weekday: "long" })}`;
  return `${clock} ${at.toLocaleDateString("en-US", { timeZone: zone, month: "short", day: "numeric" })}`;
}

/**
 * What to say about an episode's final results, beside "Early results are in" or in its place: "Final results are in" once
 * they are; before that "Final results by 12:00 PM tomorrow" (its time, in the reader's zone); and once that time has passed
 * with a result still waiting on its sources, "Final results soon". Null with nothing to go on (no time for the episode).
 */
function finalLine(stage, finalAt, now, tz) {
  if (stage === "final") return "Final results are in";
  if (!finalAt) return null;
  const t = now instanceof Date ? now.getTime() : (now ?? Date.now());
  return Date.parse(finalAt instanceof Date ? finalAt.toISOString() : finalAt) > t ? `Final results by ${finalWhen(finalAt, t, tz)}` : "Final results soon";
}

module.exports = { FINAL_TIME, finalResultsAt, finalWhen, finalLine };
