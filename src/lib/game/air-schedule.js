// When a season's episodes air, and when its weekly auto-research runs (db/migrations/0020).
//
// Shared by the admin UI (which episodes have aired, when the next auto-research is), the research
// route (refuse an episode that hasn't aired), and db/auto-research.js (what's due now). Plain
// CommonJS for the same reason state-logic.js is: the CLI has to require it under bare `node`.
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

function weekdayOf(date) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
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

/**
 * When episode `n` airs, or null when there's nothing to go on. The wiki's printed date wins
 * (it knows about double episodes and weeks off); otherwise weekly from the premiere.
 *
 * season: { premiereDate, airTime, airTz }   wikiAirDates: { [episodeNumber]: "March 1, 2023" }
 */
function episodeAirTime(season, n, wikiAirDates) {
  const tz = season.airTz || "America/New_York";
  const time = (season.airTime || DEFAULT_AIR_TIME).slice(0, 5);
  const fromWiki = parseAirDate(wikiAirDates && wikiAirDates[n]);
  if (fromWiki) return zonedToUtc(fromWiki, time, tz);
  // Weekly from the latest earlier episode the wiki DID date (so a schedule shift carries forward),
  // else from the premiere. Either one is enough on its own.
  let anchorN = season.premiereDate ? 1 : null;
  let anchorDate = season.premiereDate ? String(season.premiereDate).slice(0, 10) : null;
  for (const [k, v] of Object.entries(wikiAirDates || {})) {
    const d = parseAirDate(v);
    if (d && Number(k) < n && (anchorN === null || Number(k) >= anchorN)) {
      anchorN = Number(k);
      anchorDate = d;
    }
  }
  if (anchorDate === null) return null;
  return zonedToUtc(addDays(anchorDate, 7 * (n - anchorN)), time, tz);
}

/**
 * When auto-research picks up an episode that aired at `after`: researchDelayHours after it (0035),
 * or, for a season still on the older weekly setting, the first weekday-at-time slot at or after it
 * (0 = Sunday, in tz). Null when neither is set.
 */
function nextResearchSlot(after, season) {
  if (season.researchDelayHours != null) return new Date(after.getTime() + Number(season.researchDelayHours) * 3600 * 1000);
  if (season.researchWeekday == null || !season.researchTime) return null;
  const tz = season.airTz || "America/New_York";
  const time = String(season.researchTime).slice(0, 5);
  let date = localDate(after, tz);
  for (let i = 0; i < 9; i++) {
    if (weekdayOf(date) === Number(season.researchWeekday)) {
      const slot = zonedToUtc(date, time, tz);
      if (slot.getTime() >= after.getTime()) return slot;
    }
    date = addDays(date, 1);
  }
  return null;
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

module.exports = { zonedToUtc, parseAirDate, episodeAirTime, nextResearchSlot, formatInTz, localDate, WEEKDAYS, DEFAULT_AIR_TIME };
