// When a season's episodes air (db/migrations/0020).
//
// Shared by the app (which episodes have aired, when lineups lock), the research routes (refuse an
// episode that hasn't aired), and the hourly jobs and the bot's clock (db/season-clock.js, reminders.js,
// waivers.js, bot-research.js). Plain CommonJS for the same reason state-logic.js is: the jobs require
// it under bare `node`. (Paid research's weekly slot, nextResearchSlot, went with db/auto-research.js
// at the desk's step 8.)
//
// All wall-clock times are in the season's own time zone (air_tz, e.g. America/New_York) -- "noon
// Eastern" means noon Eastern whichever side of a DST change it falls on. No date library: Intl gives
// us each zone's offset at a given instant, which is all the conversion needs.

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEFAULT_AIR_TIME = "20:00";

// The zone's offset from UTC, in ms, at one instant.
function offsetAt(instant, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** A wall-clock date ("2026-09-24") and time ("20:00") in `tz`, as a real instant. */
function zonedToUtc(date, time, tz) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Twice: the offset at the guessed instant can differ from the offset at the real one across a
  // DST change.
  let utc = guess - offsetAt(new Date(guess), tz);
  utc = guess - offsetAt(new Date(utc), tz);
  return new Date(utc);
}

/** The wall-clock date ("YYYY-MM-DD") of an instant in `tz`. */
function localDate(instant, tz) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** "March 1, 2023" / "2023-03-01" / "1 March 2023" -> "2023-03-01", or null. */
function parseAirDate(text) {
  if (!text) return null;
  const s = String(text).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s);
  if (m) {
    const mi = MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3)));
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  m = /^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})/.exec(s);
  if (m) {
    const mi = MONTHS.findIndex((x) => x.startsWith(m[2].toLowerCase().slice(0, 3)));
    if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

/** An exact start, as research confirmed it (season_episodes, 0067): "2026-11-06T01:00:00Z". Else null. */
function exactAirTime(text) {
  const s = text == null ? "" : String(text).trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) return null;
  const at = new Date(s);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * When episode `n` airs, or null when there's nothing to go on. An exact start research confirmed wins
 * (a special at another time), then the wiki's printed date (it knows about double episodes and weeks
 * off); otherwise weekly from the latest dated episode before it, else from the premiere. A season that
 * airs nightly (show_seasons.release, 0104) steps a day at a time instead; a binge season drops every
 * episode at once, at dropAt. Every caller that leaves `release` out gets weekly, as every season is today.
 *
 * season: { premiereDate, airTime, airTz, release?, dropAt? }
 * wikiAirDates: { [episodeNumber]: "March 1, 2023" | "2026-11-06T01:00:00Z" } (the season_air_dates view)
 */
function episodeAirTime(season, n, wikiAirDates) {
  const tz = season.airTz || "America/New_York";
  const time = (season.airTime || DEFAULT_AIR_TIME).slice(0, 5);
  const exact = exactAirTime(wikiAirDates && wikiAirDates[n]);
  if (exact) return exact;
  const fromWiki = parseAirDate(wikiAirDates && wikiAirDates[n]);
  if (fromWiki) return zonedToUtc(fromWiki, time, tz);
  if (season.release === "binge") {
    const drop = season.dropAt ? new Date(season.dropAt) : null;
    return drop && !Number.isNaN(drop.getTime()) ? drop : null;
  }
  const step = season.release === "nightly" ? 1 : 7;
  // Weekly (or nightly) from the latest earlier episode with a date (so a week off or a moved night carries
  // forward), else from the premiere. Either one is enough on its own. An exact start anchors by its local date,
  // so one special at 9 PM doesn't move the episodes after it.
  let anchorN = season.premiereDate ? 1 : null;
  let anchorDate = season.premiereDate ? String(season.premiereDate).slice(0, 10) : null;
  for (const [k, v] of Object.entries(wikiAirDates || {})) {
    const x = exactAirTime(v);
    const d = x ? localDate(x, tz) : parseAirDate(v);
    if (d && Number(k) < n && (anchorN === null || Number(k) >= anchorN)) {
      anchorN = Number(k);
      anchorDate = d;
    }
  }
  if (anchorDate === null) return null;
  return zonedToUtc(addDays(anchorDate, step * (n - anchorN)), time, tz);
}

/** "Thu, Oct 2, 12:00 PM EDT" in the season's zone. */
function formatInTz(instant, tz) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz || "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(instant);
}

module.exports = { zonedToUtc, parseAirDate, exactAirTime, episodeAirTime, formatInTz, localDate, WEEKDAYS, DEFAULT_AIR_TIME };
