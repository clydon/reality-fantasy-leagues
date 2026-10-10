import type { SeasonDecision, ShowSeason } from "@/lib/game/types";
import * as Air from "@/lib/game/air-schedule.js";

// A catalogued season's episodes as Admin lists them -- which exist, which have aired, and what's
// been gathered for each -- shared by the season's Episodes tab, an episode's page and Admin's To do
// list. Moved out of the old season-episodes.tsx so those three agree on what "aired" means.
//
// "Aired" comes from the season's air schedule (premiere date + air time, weekly, with the wiki's own
// air dates overriding). Without one, an episode counts as aired once there's data for it, and the
// next one's air date is unknown.

export const TIME_ZONES = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Los_Angeles", "Pacific"],
  ["Europe/London", "UK"],
  ["UTC", "UTC"],
] as const;

export const STATUS_LABEL: Record<ShowSeason["status"], string> = { airing: "Airing", completed: "Completed", upcoming: "Upcoming" };

export function airSchedule(season: ShowSeason) {
  const tz = season.airTz || "America/New_York";
  const wikiAirDates: Record<number, string> = {};
  for (const [k, v] of Object.entries(season.wikiAirDates || {})) wikiAirDates[Number(k)] = v;
  const schedule = {
    premiereDate: season.premiereDate,
    airTime: season.airTime,
    airTz: tz,
    researchWeekday: season.researchWeekday,
    researchTime: season.researchTime,
    researchDelayHours: season.researchDelayHours,
  };
  const hasSchedule = !!season.premiereDate || Object.keys(wikiAirDates).length > 0;
  const airsAt = (n: number) => (hasSchedule ? Air.episodeAirTime(schedule, n, wikiAirDates) : null);
  return { tz, schedule, wikiAirDates, hasSchedule, airsAt };
}

export type EpisodeRow = {
  n: number;
  airsAt: Date | null;
  aired: boolean;
  researched: boolean;
  decisions: SeasonDecision[];
  pending: number;
};

/**
 * The season's episodes, newest first. The episode count (when set) caps everything: counting weekly
 * from the premiere runs past the finale forever, and a misread wiki pull can claim episodes that never
 * existed -- both used to produce dozens of phantom rows for a finished season.
 *
 *   completed -- every episode up to the count, all aired. Without a count, just the ones with data.
 *   airing    -- aired so far (from the schedule) or with data, plus the next one to air.
 *   upcoming  -- nothing has aired; the first episode, if its air date is known.
 */
export function episodeRows(season: ShowSeason, decisions: SeasonDecision[], now: Date): EpisodeRow[] {
  const { hasSchedule, airsAt } = airSchedule(season);
  const researched = new Set(season.researchedEpisodes ?? []);
  const byEpisode = new Map<number, SeasonDecision[]>();
  for (const d of decisions) {
    const list = byEpisode.get(d.episode_number);
    if (list) list.push(d);
    else byEpisode.set(d.episode_number, [d]);
  }
  const count = season.episodeCount ?? null;
  const cap = (n: number) => (count ? Math.min(n, count) : n);
  const completed = season.status === "completed";
  const withData = cap(Math.max(0, season.wikiEpisodesThrough ?? 0, ...researched, ...byEpisode.keys()));
  let lastAired = 0;
  if (hasSchedule && !completed) {
    for (let n = 1; n <= (count ?? 60); n++) {
      const t = airsAt(n);
      if (!t || t > now) break;
      lastAired = n;
    }
  }
  const known = Math.max(withData, lastAired);
  const knownAirsAt = airsAt(known);
  const knownIsUpcoming = !!knownAirsAt && knownAirsAt > now;
  const last = completed ? (count ?? withData) : cap(knownIsUpcoming ? known : known + 1);
  const rows: EpisodeRow[] = [];
  for (let n = last; n >= 1; n--) {
    const at = airsAt(n);
    const hasData = researched.has(n) || byEpisode.has(n) || n <= (season.wikiEpisodesThrough ?? 0);
    const ds = byEpisode.get(n) ?? [];
    rows.push({
      n,
      airsAt: at,
      aired: completed || (at ? at <= now : hasData),
      researched: researched.has(n),
      decisions: ds,
      pending: ds.filter((d) => d.status === "pending").length,
    });
  }
  return rows;
}

/** The next episode to air, for Admin's "Coming up". Null without a schedule or once it's all aired. */
export function nextToAir(season: ShowSeason, now: Date): { n: number; at: Date } | null {
  if (season.status === "completed") return null;
  const { hasSchedule, airsAt } = airSchedule(season);
  if (!hasSchedule) return null;
  const max = season.episodeCount ?? 60;
  for (let n = 1; n <= max; n++) {
    const at = airsAt(n);
    if (!at) return null;
    if (at > now) return { n, at };
  }
  return null;
}

/**
 * When auto-research will pick an episode up -- only for one it hasn't researched yet, and only for
 * slots after auto-research was switched on (older episodes are the manual button's).
 */
export function autoResearchNote(season: ShowSeason, row: Pick<EpisodeRow, "n" | "researched" | "airsAt">, now: Date): { text: string; bad?: boolean } | null {
  if (!season.autoResearch || row.researched || !row.airsAt) return null;
  const { schedule, tz } = airSchedule(season);
  const slot = Air.nextResearchSlot(row.airsAt, schedule);
  const since = season.autoResearchSince ? new Date(season.autoResearchSince) : now;
  const attempt = season.lastAutoAttempts?.[String(row.n)];
  if (!slot || slot < since) return null;
  if (attempt && !attempt.ok) return { text: `Auto research failed: ${attempt.message ?? "unknown error"}`, bad: true };
  if (slot > now) return { text: `Auto research ${Air.formatInTz(slot, tz)}` };
  return { text: "Auto research due, runs within the hour" };
}

/** "Airs Wed, Oct 14, 8:00 PM EDT" / "Aired …" / the fallbacks when there's no schedule. */
export function airLine(row: Pick<EpisodeRow, "airsAt" | "aired">, season: ShowSeason): string {
  const { tz, hasSchedule } = airSchedule(season);
  if (row.airsAt) return `${row.aired ? "Aired" : "Airs"} ${Air.formatInTz(row.airsAt, tz)}`;
  return row.aired ? "Aired" : hasSchedule ? "Upcoming" : "Air date unknown";
}

/** The schedule as one line: "Weekly from Sep 24 · 8:00 PM Eastern · 13 episodes". */
export function scheduleLine(season: ShowSeason): string {
  const { tz } = airSchedule(season);
  const zone = TIME_ZONES.find(([id]) => id === tz)?.[1] ?? tz;
  const parts: string[] = [];
  if (season.premiereDate) {
    const d = new Date(`${season.premiereDate}T12:00:00Z`);
    parts.push(`Weekly from ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })}`);
    const [h, m] = (season.airTime || Air.DEFAULT_AIR_TIME).split(":").map(Number);
    const t = new Date(Date.UTC(2000, 0, 1, h, m));
    parts.push(`${t.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" })} ${zone}`);
  } else {
    parts.push("No premiere date");
  }
  parts.push(season.episodeCount ? `${season.episodeCount} episodes` : "episode count not set");
  return parts.join(" · ");
}
