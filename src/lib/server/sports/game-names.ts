import { easternDay } from "@/lib/game/tv-listings";
import type { GameLabel } from "@/lib/game/show-words";
import { pool } from "../db";
import { sportsProviders } from "./index";
import { teamOfKey } from "./team-season";
import { SportsUnavailable } from "./types";

// Each game of a team's season by what it is (docs/design-round/props-table-spec.md, "Naming a game of a sport"): "Week 11 at
// Bengals", "at Bengals", "@CIN", never "Game 10" (the user, 2026-11-23: "G10 and game 10 means nothing to users"). Read for a team's
// season only (sports_matchups keyed by its team: team-season.ts teamOfKey), the side that isn't the team being the opponent. A
// league's season (a slate: "Week 11") and a matchup's (its own two teams every game) keep their own words. A schedule is public: no
// spoiler in a name.

/** Leagues played week by week, whose games people name by the week ("Week 11"). */
const WEEKLY = /^football\//;

type Side = { id?: unknown; name?: unknown; abbreviation?: unknown; home?: unknown };

/** "Cincinnati Bengals" as people say it, "Bengals": the provider's short name for it, else its name's last word. */
function nickOf(name: string, nicks: Map<string, string>, id: string): string {
  return nicks.get(id) ?? name.split(" ").slice(-1)[0] ?? name;
}

/** Each team-season's games' names, by season id and episode; a season that isn't a team's has none. */
export async function sportsGameNames(seasonIds: string[]): Promise<Map<string, Record<number, GameLabel>>> {
  const out = new Map<string, Record<number, GameLabel>>();
  if (!seasonIds.length) return out;
  const { rows } = await pool.query(
    `SELECT m.season_id, m.key, m.provider, m.league, m.regular_through, e.episode, COALESCE(f.teams, e.teams) AS teams, COALESCE(f.starts_at, e.starts_at) AS starts_at, e.note
       FROM sports_matchups m JOIN season_events e ON e.season_id = m.season_id
       LEFT JOIN sports_events f ON f.provider = e.provider AND f.league = e.league AND f.event_id = e.event_id
      WHERE m.season_id = ANY($1::uuid[]) AND m.key LIKE '%:season:%' AND e.part IS NULL
      ORDER BY m.season_id, e.episode`,
    [seasonIds]
  );
  if (!rows.length) return out;
  // The providers' short names ("Bengals", "Red Sox"), from the league's team list (cached; an outage falls back to the last word).
  const nicks = new Map<string, string>();
  for (const key of new Set(rows.map((r) => `${r.provider}|${r.league}`))) {
    const [pid, league] = key.split("|");
    const p = sportsProviders().find((x) => x.id === pid);
    try {
      for (const t of (await p?.teams(league))?.teams ?? []) if (t.also[0]) nicks.set(t.id, t.also[0]);
    } catch (e) {
      if (!(e instanceof SportsUnavailable)) console.error("[sports] game names:", e);
    }
  }
  const bySeason = new Map<string, typeof rows>();
  for (const r of rows) bySeason.set(r.season_id, [...(bySeason.get(r.season_id) ?? []), r]);
  for (const [seasonId, eps] of bySeason) {
    const team = teamOfKey(eps[0].key as string)?.team;
    if (!team) continue;
    const weekly = WEEKLY.test(eps[0].league as string);
    // Week 1 is the week (Tuesday to Monday, Eastern) of the team's first game; a bye leaves a week out, as the league counts.
    const first = eps.find((e) => e.starts_at)?.starts_at as Date | undefined;
    const weekOf = (at: Date | null) => {
      if (!first || !at) return null;
      const day = (d: Date) => Date.parse(`${easternDay(d)}T12:00:00Z`);
      const tue = (t: number) => t - ((new Date(t).getUTCDay() + 5) % 7) * 86_400_000;
      return Math.round((tue(day(at)) - tue(day(first))) / (7 * 86_400_000)) + 1;
    };
    const names: Record<number, GameLabel> = {};
    for (const e of eps) {
      const sides = (Array.isArray(e.teams) ? (e.teams as Side[]) : []).filter((s) => typeof s.id === "string" && typeof s.name === "string");
      const mine = sides.find((s) => s.id === team);
      const them = sides.find((s) => s.id !== team);
      if (!mine || !them) continue;
      // Both teams, away at home, as a scoreboard says it ("Chiefs at Bills"): someone who started a game on a team they don't follow
      // knows the game by its two teams, not by one side's schedule (the user, 2026-11-23). No home side known: the team's, "vs".
      const nick = (s: Side) => nickOf(s.name as string, nicks, s.id as string);
      const abbr = (s: Side) => (typeof s.abbreviation === "string" && s.abbreviation ? s.abbreviation : nick(s).slice(0, 3).toUpperCase());
      const home = mine.home === true ? mine : them.home === true ? them : null;
      const [a, b] = home ? [home === mine ? them : mine, home] : [mine, them];
      const join = home ? "at" : "vs";
      const pair = `${nick(a)} ${join} ${nick(b)}`;
      const at = e.starts_at ? new Date(e.starts_at) : null;
      const playoff = e.regular_through != null && e.episode > (e.regular_through as number);
      const round = playoff && typeof e.note === "string" && e.note.trim() ? e.note.replace(/\s*-\s*Game \d+$/i, "").trim() : null;
      const week = weekly && !playoff ? weekOf(at) : null;
      const date = at ? at.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" }) : null;
      const when = round ?? (week ? `Week ${week}` : date);
      names[e.episode as number] = {
        long: when ? `${pair}, ${when}` : pair,
        short: pair,
        tag: `${abbr(a)} ${home ? "@" : "vs"} ${abbr(b)}`,
        col: `${home && home !== mine ? "@" : ""}${abbr(them)}`,
        sides: [String(a.id), String(b.id)],
      };
    }
    if (Object.keys(names).length) out.set(seasonId, names);
  }
  return out;
}
