import type { LeagueNow } from "./league-now";

// A league's art and its season as a ruler (docs/design-round/league-art-spec.md; the user, 2026-11-23: "Sports need to have the
// same static height as shows. They also need artwork. Allow this to be set by user in settings."). The league's band in Your
// shows and its page's bar draw, for each league (artInUse):
//   1. your own choice (user_settings.league_art): one of the app's photos, or your own picture (league_art_pictures);
//   2. else the couch's: its owner's choice, else the first member's to choose, by when they joined (the user, 2026-11-23: "per
//      user but me as the admin can set it for everyone… End goal is everyone in my couch sees art without action on their end, if
//      they want to change it they can");
//   3. else its sport's first photo.
// Pure: the band, the league's page, its settings page, the server's check of a choice and the tests share it.
//
// The app's own art is generated photos only (public/art/generated/manifest.json), never a league's or a team's logo or key art: the
// site never supplies one (docs/PLAN-team-logos.md). The user, 2026-11-23: photos only, no drawn art; a sport without a photo of
// its own wears Arena until one is made (Gemini's billing blocked generation that day). A new photo is one file and one entry here,
// first in its sport's list. A person's own picture is theirs: uploaded, and seen by the people on their couches (the user lifted
// the uploads' takedown guardrail for this, 2026-11-23: docs/PLAN-team-logos.md).

export interface LeagueArt {
  id: string;
  /** What the choice is called on the league's settings page. */
  name: string;
  src: string;
  /** Where the picture sits in this league's band (object-position): its sport, not its empty sky. */
  position: string;
  /** The sports it's for ("football" of "football/nfl"); null for any league. */
  sports: string[] | null;
}

interface ArtSource extends Omit<LeagueArt, "position"> {
  /** The windows a band may show of it; a league takes one by its name, so two leagues wearing the same art don't look alike (the
   *  check: two bands in Arena read as one placeholder). */
  windows: string[];
}

// Each crop is made by scripts/league-art-derive.js: a 576-row strip where the sport is, its exposure lifted so it reads under a
// band's dark fade (the check: the night photos were near black behind it).
const SOURCES: ArtSource[] = [
  { id: "football-night-v1", name: "Under the lights", src: "/art/generated/league/football-night-v1-wide.webp", windows: ["50% 50%"], sports: ["football"] },
  { id: "event-night-v1", name: "Arena", src: "/art/generated/league/event-night-v1-wide.webp", windows: ["50% 0%", "50% 55%", "50% 100%"], sports: null },
];

/** A league's own pick among an art's windows, the same every time for that league. */
const windowOf = (league: string, windows: string[]) => windows[[...league].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % windows.length];

/** Every piece of art, as a league that isn't any in particular would wear it (for checks and the server's list). */
export const LEAGUE_ART: LeagueArt[] = SOURCES.map(({ windows, ...a }) => ({ ...a, position: windows[0] }));

/** A league's sport, as the sports provider names it ("football" of "football/nfl"). */
export const sportOf = (league: string) => league.split("/")[0];

const SPORT_WORDS: Record<string, string> = { mma: "MMA" };
/** The sport as a sentence says it ("baseball", "MMA"). */
export const sportWords = (league: string) => SPORT_WORDS[sportOf(league)] ?? sportOf(league);

/** The art a league can wear, its sport's own first, then what any league can. */
export function artFor(league: string): LeagueArt[] {
  const sport = sportOf(league);
  return [...SOURCES.filter((a) => a.sports?.includes(sport)), ...SOURCES.filter((a) => !a.sports)].map(({ windows, ...a }) => ({ ...a, position: windowOf(league, windows) }));
}

/** The art a league wears for you: your choice while it's still one of its own, else its first. */
export function artOf(league: string, chosen?: string | null): LeagueArt {
  const list = artFor(league);
  return list.find((a) => a.id === chosen) ?? list[0];
}

/** A league as the sports provider names it ("football/nfl", "soccer/eng.1"). */
export const isLeagueKey = (league: unknown): league is string => typeof league === "string" && /^[a-z0-9-]{1,30}\/[a-z0-9.-]{1,40}$/.test(league);

// ---------- whose art: yours, the couch's, or the league's own ----------

/** The choice that means "my own picture" (league_art_pictures). */
export const UPLOAD = "upload";

/** What the app knows of a league's art for you on a couch (GET /api/me/league-art). */
export interface LeagueArtState {
  /** Your choices, by league: an art's id or UPLOAD. */
  mine: Record<string, string>;
  /** Your own pictures, by league: each one's version. */
  pictures: Record<string, number>;
  /** The couch's art, by league: its owner's choice, else the first member's to choose (by when they joined), you included; who
   *  chose it, and for a picture its version. Empty on no couch. */
  couch: Record<string, { art: string; by: string; name: string; picture: number | null }>;
}

export interface ArtInUse {
  art: LeagueArt;
  /** Whose choice it is: yours, the couch's (someone else's), or nobody's yet (the league's own first). */
  from: "you" | "couch" | "default";
  by: { id: string; name: string } | null;
}

/** Someone's own picture as a league's art: its link carries its version, so a browser keeps it for good. */
export function pictureArt(league: string, userId: string, version: number, name: string): LeagueArt {
  return {
    id: `${UPLOAD}:${userId}`,
    name,
    src: `/api/people/${encodeURIComponent(userId)}/league-art?league=${encodeURIComponent(league)}&v=${version}`,
    position: "50% 50%",
    sports: null,
  };
}

/** Whether a choice is one a league can take: one of its own, or your picture when you have one for it. */
export function isArtChoice(league: string, art: unknown, hasPicture: boolean): art is string {
  return typeof art === "string" && (art === UPLOAD ? hasPicture : artFor(league).some((a) => a.id === art));
}

/** The art a league wears for you (see the head of the file), and whose choice it is. */
export function artInUse(league: string, state: LeagueArtState | null | undefined, me: { id: string; name: string }): ArtInUse {
  const own = (art: string | undefined, by: { id: string; name: string }, picture: number | null | undefined): LeagueArt | null => {
    if (!art) return null;
    if (art === UPLOAD) return picture ? pictureArt(league, by.id, picture, by.id === me.id ? "Your picture" : `${by.name}'s picture`) : null;
    return artFor(league).find((a) => a.id === art) ?? null;
  };
  const mine = own(state?.mine[league], me, state?.pictures[league]);
  if (mine) return { art: mine, from: "you", by: me };
  const c = state?.couch[league];
  const theirs = c ? own(c.art, { id: c.by, name: c.name }, c.picture) : null;
  if (c && theirs) return { art: theirs, from: c.by === me.id ? "you" : "couch", by: { id: c.by, name: c.name } };
  return { art: artFor(league)[0], from: "default", by: null };
}

// ---------- the season as a ruler ----------

/** A league's season along a band's foot, the way a show's episodes are: where now stands, and what the ends and now are called. */
export interface SeasonRuler {
  /** Where now stands, 0 to 1. */
  at: number;
  /** Under the couch's teams: the week's number ("12"), as the band's title says it; the stage in the playoffs ("Wild Card",
   *  "Playoffs"); empty for a league with no weeks (soccer's rounds), placed by the date alone. */
  label: string;
  /** The ends: the first and last regular weeks ("1", "18"); a league with no weeks, its regular season's first and last days. */
  start: string;
  end: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDay = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
const DAY = 86_400_000;
const dayMs = (d: string) => Date.parse(`${d}T12:00:00Z`);
const WEEK = /^Week (\d+)$/;

/**
 * Where a league's season is today, for its band's ruler; null off-season (nothing to place). In weeks wherever the band's title
 * says one (the check: "WEEK 6" over a ruler of dates read as two scales): football by its own weeks, 1 to its last regular week; a
 * daily sport by its Monday-to-Sunday weeks across the regular season. A league with no weeks (soccer's rounds) by the date, from
 * its regular season's first day to its last. In the playoffs the ruler is full and now stands at its end, named by the stage.
 * Nothing about any game's result: the same for everyone, whatever they hide.
 */
export function rulerOf(now: LeagueNow | null | undefined, today: string): SeasonRuler | null {
  if (!now?.on) return null;
  const n = Number(WEEK.exec(now.week ?? "")?.[1] ?? NaN);
  const last = Math.max(0, ...now.weeks.map((w) => Number(WEEK.exec(w.label)?.[1] ?? 0)));
  if (last > 1) {
    if (now.stage === "post") return { at: 1, label: now.week ?? "Playoffs", start: "1", end: String(last) };
    // Between two of its weeks with none named (a calendar's gap): nothing to place.
    return Number.isFinite(n) ? { at: Math.min(1, Math.max(0, n / last)), label: String(n), start: "1", end: String(last) } : null;
  }
  const reg = now.regular;
  if (!reg || reg.to <= reg.from) return null;
  if (reg.weeks || Number.isFinite(n) || now.stage === "post") {
    // A daily sport's weeks, counted as its title's week is (league-now.ts: its slate's weeks); an older read without the count,
    // Monday to Sunday from the week its regular season starts.
    const first = dayMs(reg.from) - ((new Date(dayMs(reg.from)).getUTCDay() + 6) % 7) * DAY;
    const total = reg.weeks ?? Math.floor((dayMs(reg.to) - first) / (7 * DAY)) + 1;
    if (now.stage === "post") return { at: 1, label: now.week ?? "Playoffs", start: "1", end: String(total) };
    // The days between its regular season and its playoffs: the season done, nothing more to name.
    if (today > reg.to) return { at: 1, label: "", start: "1", end: String(total) };
    // A week it can't name (a calendar's gap): nothing to place.
    if (!Number.isFinite(n)) return null;
    const end = Math.max(total, n);
    return { at: Math.min(1, Math.max(0, n / end)), label: String(n), start: "1", end: String(end) };
  }
  const ends = { start: shortDay(reg.from), end: shortDay(reg.to) };
  const at = (dayMs(today) - dayMs(reg.from)) / (dayMs(reg.to) - dayMs(reg.from));
  return { at: Math.min(1, Math.max(0, at)), label: "", ...ends };
}
