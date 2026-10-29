
// Dates and times as a season's Setup says them (docs/PLAN-desk-parity.md step 3): in the season's own zone, as its schedule
// is set ("Wednesdays 8:05 PM Eastern"). Shared by desk-setup.ts and desk-schedule.ts.

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "2026-10-28" in the zone. */
export const ymd = (t: Date, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
export const dayGap = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
export const fmt = (t: Date, tz: string, o: Intl.DateTimeFormatOptions) => t.toLocaleString("en-US", { timeZone: tz, ...o }).replace(",", "");
export const yearOf = (t: Date, tz: string, now: Date) => (ymd(t, tz).slice(0, 4) !== ymd(now, tz).slice(0, 4) ? `, ${ymd(t, tz).slice(0, 4)}` : "");
/** "8:05 PM". */
export const timeIn = (t: Date, tz: string) => fmt(t, tz, { hour: "numeric", minute: "2-digit" });
/** "Sep 23", "Dec 17, 2025". */
export const mdIn = (t: Date, tz: string, now: Date) => fmt(t, tz, { month: "short", day: "numeric" }) + yearOf(t, tz, now);
/** "tonight", "today", "tomorrow", "yesterday", else "Wed Nov 4". */
export function dayIn(t: Date, tz: string, now: Date): string {
  const k = dayGap(ymd(now, tz), ymd(t, tz));
  if (k === 0) return Number(fmt(t, tz, { hour: "numeric", hour12: false })) >= 17 ? "tonight" : "today";
  if (k === 1) return "tomorrow";
  if (k === -1) return "yesterday";
  return fmt(t, tz, { weekday: "short", month: "short", day: "numeric" }) + yearOf(t, tz, now);
}
/** "tonight, 9:00 PM", "Wed Nov 4, 9:00 PM". */
export const whenAt = (t: Date, tz: string, now: Date) => `${dayIn(t, tz, now)}, ${timeIn(t, tz)}`;
// The zones a season's schedule can be in (classic's admin-season.ts had them until step 8 of docs/PLAN-desk-parity.md).
const TIME_ZONES = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Los_Angeles", "Pacific"],
  ["Europe/London", "UK"],
  ["UTC", "UTC"],
] as const;
/** A zone's name ("Eastern"), else its id. */
export const zoneOf = (tz: string) => TIME_ZONES.find(([id]) => id === tz)?.[1] ?? tz;
/** The zones Setup offers: [id, name]. */
export const ZONES: [string, string][] = TIME_ZONES.map(([id, name]) => [id, name]);
