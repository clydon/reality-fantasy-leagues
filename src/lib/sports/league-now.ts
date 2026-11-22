import { leagueName } from "./matchup";
import { episodeFor, seasonWords, slateEpisodes, stageDays, type LeagueCalendar } from "./slate";

// Where a league's season is today, from its calendar (docs/PLAN-sports-couch.md A2: the league card in Your shows says the week,
// or that it's the off-season and when it's back). Nothing about any game's result, so it's the same for everyone: a card says
// "Week 12" whatever anyone hides. Pure: the server's read (src/lib/server/sports/league-now.ts) and the tests
// (tests/sports-league-now.test.js) share it.

export interface LeagueNow {
  league: string;
  /** As its show is named ("NFL", "Premier League"). */
  leagueName: string;
  /** Its season as people say it ("2026", "2026-27"), when the calendar says. */
  season: string | null;
  /** Inside its season today (its regular season, its playoffs or the days between them); else the off-season. */
  on: boolean;
  stage: "regular" | "post" | null;
  /** This week as its games are cut: football's own ("Week 12", "Wild Card"), a daily sport's Monday-to-Sunday week ("Week 5"),
   *  "Playoffs" for a daily sport's playoffs; null off-season, or for a league cut by rounds (a round needs every fixture). */
  week: string | null;
  /** Off-season: the day (the East's) its next stage starts, when the calendar lists it. */
  back: string | null;
}

/** What a card says of a league today, from its calendar. Pure, for the tests. */
export function nowOf(league: string, calendar: LeagueCalendar, cadence: "day" | "week" | "round" | null, today: string): LeagueNow {
  const regular = stageDays(calendar, "regular");
  const post = stageDays(calendar, "post");
  const from = regular?.from ?? post?.from ?? null;
  const to = post?.to ?? regular?.to ?? null;
  const on = !!from && !!to && today >= from && today <= to;
  const stage = !on ? null : post && today >= post.from ? "post" : "regular";
  let week: string | null = null;
  if (on && stage && cadence && cadence !== "round") {
    if (stage === "post" && !calendar.weeks.length) week = "Playoffs";
    else {
      const eps = slateEpisodes(calendar, stage, "week");
      const n = episodeFor(eps, today);
      // Between two of its weeks (a calendar's gap), the one coming.
      const e = n != null ? eps.find((x) => x.n === n) : eps.find((x) => x.from > today);
      week = e?.label ?? null;
    }
  }
  const back = on ? null : ([regular?.from, post?.from].filter((d): d is string => !!d && d > today).sort()[0] ?? null);
  return { league, leagueName: leagueName(league, calendar.leagueName ?? null), season: seasonWords(calendar), on, stage, week, back };
}
