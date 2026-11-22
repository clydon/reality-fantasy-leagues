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
  /** That week's first and last day (the East's, "2026-11-24"), so a league's page reads its own week (docs/PLAN-sports-couch.md
   *  B1: football's as ESPN cuts it, a daily sport's Monday to Sunday); null with no week (off-season, a daily sport's playoffs). */
  from: string | null;
  to: string | null;
  /** Off-season: the day (the East's) its next stage starts, when the calendar lists it. */
  back: string | null;
  /** A league cut by weeks (football): every week of its season and playoffs, in order, for its Scores tab's switcher
   *  (docs/design-round/league-scores-spec.md); none for a league by days. */
  weeks: { label: string; from: string; to: string }[];
  /** A league by days (the NBA, NHL, MLB, soccer): the days it plays this season (ESPN's calendar), its Scores tab's chips. */
  days: string[];
}

/** The Monday and Sunday of a day's week ("2026-11-22", a Sunday: Nov 16 to Nov 22). */
function mondayToSunday(day: string): { from: string; to: string } {
  const t = Date.parse(`${day}T12:00:00Z`);
  const back = (new Date(t).getUTCDay() + 6) % 7;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { from: iso(t - back * 86_400_000), to: iso(t + (6 - back) * 86_400_000) };
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
  let span: { from: string; to: string } | null = null;
  if (on && stage && cadence && cadence !== "round") {
    if (stage === "post" && !calendar.weeks.length) week = "Playoffs";
    else {
      const eps = slateEpisodes(calendar, stage, "week");
      const n = episodeFor(eps, today);
      // Between two of its weeks (a calendar's gap), the one coming.
      const e = n != null ? eps.find((x) => x.n === n) : eps.find((x) => x.from > today);
      week = e?.label ?? null;
      // A daily sport's slate week can stretch over a break (the All-Star days), so its page's week is the plain Monday to Sunday
      // around today; football's is the calendar's own.
      span = !e ? null : calendar.weeks.length ? { from: e.from, to: e.to } : mondayToSunday(today);
    }
  }
  // The season's weeks or game days for the Scores tab's switcher: the calendar's own, both stages.
  const weeks = calendar.weeks.length ? (["regular", "post"] as const).flatMap((st) => slateEpisodes(calendar, st, "week").map((e) => ({ label: e.label, from: e.from, to: e.to }))) : [];
  const days = calendar.weeks.length || !from || !to ? [] : [...new Set(calendar.days)].filter((d) => d >= from && d <= to).sort();
  const back = on ? null : ([regular?.from, post?.from].filter((d): d is string => !!d && d > today).sort()[0] ?? null);
  return { league, leagueName: leagueName(league, calendar.leagueName ?? null), season: seasonWords(calendar), on, stage, week, from: span?.from ?? null, to: span?.to ?? null, back, weeks, days };
}
