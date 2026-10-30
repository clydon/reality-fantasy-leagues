// Types for air-schedule.js (plain CommonJS so db/season-clock.js and the hourly jobs can require it under bare node).
export interface AirSeason {
  premiereDate?: string | null;
  airTime?: string | null;
  airTz?: string | null;
  /** How it airs (show_seasons.release, 0104): weekly when left out. */
  release?: "weekly" | "nightly" | "binge" | null;
  /** When a binge season drops every episode (show_seasons.drop_at). */
  dropAt?: string | Date | null;
}
export function zonedToUtc(date: string, time: string, tz: string): Date;
export function parseAirDate(text: string | null | undefined): string | null;
/** An exact start research confirmed (season_episodes, 0067), e.g. "2026-11-06T01:00:00Z"; else null. */
export function exactAirTime(text: string | null | undefined): Date | null;
/** An exact start as written, read in `tz` when its offset is the zone's other one (a daylight-saving slip); else as written. */
export function exactInZone(text: string | null | undefined, tz: string | null | undefined): Date | null;
export function episodeAirTime(season: AirSeason, n: number, wikiAirDates?: Record<number, string | null>): Date | null;
export function formatInTz(instant: Date, tz?: string | null): string;
export function localDate(instant: Date, tz: string): string;
/** "YYYY-MM-DD" plus `n` days. */
export function addDays(date: string, n: number): string;
export const WEEKDAYS: string[];
export const DEFAULT_AIR_TIME: string;
