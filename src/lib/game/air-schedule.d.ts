// Types for air-schedule.js (plain CommonJS so db/auto-research.js can require it under bare node).
export interface AirSeason {
  premiereDate?: string | null;
  airTime?: string | null;
  airTz?: string | null;
  researchWeekday?: number | null;
  researchTime?: string | null;
}
export function zonedToUtc(date: string, time: string, tz: string): Date;
export function parseAirDate(text: string | null | undefined): string | null;
export function episodeAirTime(season: AirSeason, n: number, wikiAirDates?: Record<number, string | null>): Date | null;
export function nextResearchSlot(after: Date, season: AirSeason): Date | null;
export function formatInTz(instant: Date, tz?: string | null): string;
export function localDate(instant: Date, tz: string): string;
export const WEEKDAYS: string[];
export const DEFAULT_AIR_TIME: string;
