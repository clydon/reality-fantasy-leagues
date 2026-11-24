import type { Question } from "@/lib/game/game-spec/index.js";
import type { LeagueState } from "@/lib/game/types";
import { TeamSport, sportOf } from "@/lib/sports";
import { pool } from "./db";
import { SportsUnavailable, type SeasonLine, type SportsProvider } from "./sports/types";

// The numbers beside each player a question asks you to name, when a sport's stat settles it (docs/design-round/props-table-spec.md:
// "Who throws for the most yards?" as a table, not a wall of faces). Each player's settling stat per game, in their last game and
// over the season, and that stat group's other counts: from every final of the league this season the app keeps (sports_events.lines,
// by the provider's athlete ids), not only the season's own games, so the other side's quarterback has his season too (a team's
// season holds only its team's games). Only games before this one, and before the next game of the season you haven't seen (your
// mark), so nothing you haven't seen counts. Their team and position from the roster, their injury now, and whether they're on one
// of this game's two teams (the rest of a team's season's people play other weeks).
// The contenders' seasons whole: the app keeps a game's lines only when someone follows it, so the other side's quarterback may
// have one game here. For someone caught up (no mark: results as they come), each contender's season line from the provider (one
// call each, cached a day: ESPN's category named for the stat's group, its column named as the stat's) gives the season and games
// played; their last game stays ours when we hold every game of theirs (else none: ours may not be their latest). Someone behind gets only what's kept up to their mark (a season line would spoil it).

export interface PickStatCol {
  key: string;
  /** As a column says it ("YDS", "TD"). */
  short: string;
  label: string;
}

export interface PickStatRow {
  /** Their team's abbreviation ("CIN"), else its name. */
  team: string | null;
  position: string | null;
  /** The roster's injury code now ("Q", "O", "IR"), else null. */
  injury: string | null;
  /** On one of this game's two teams (false: they play other weeks); null when the game's teams aren't known. */
  inGame: boolean | null;
  /** Games they've a line in this season, as far as you've seen. */
  games: number;
  /** The settling stat: per game (one decimal), in their last game, over the season. */
  per: number | null;
  last: number | null;
  season: number;
  /** The group's other counts, over the season, by key. */
  more: Record<string, number>;
}

export interface PickStats {
  stat: PickStatCol;
  /** The stat's group ("passing"). */
  group: string;
  /** The group's other counts, in the sport's order (at most four). */
  more: PickStatCol[];
  /** By castaway id: everyone the question can name. */
  rows: Record<string, PickStatRow>;
  /** The league's games counted (none yet: the table sorts by position). */
  games: number;
}

const MORE = 4;
/** At most this many season lines asked for one question (each cached a day). */
const LINES = 12;
/** How far before the season's first game a final still counts as this season's (a preseason never does: its lines aren't kept). */
const SEASON_DAYS = 2;

type Side = { id?: string; name?: string; abbreviation?: string };

/** A question's stat table, or null for one no sport's stat settles. `faces`: whom it can name; `episode`: the game it's about. */
export async function pickStats(seasonId: string, state: LeagueState, q: Question, faces: string[], episode: number, mark: number | null, providers: SportsProvider[] | null = null): Promise<PickStats | null> {
  const st = q.settle as { by?: string; stat?: string } | undefined;
  if (q.answer !== "person" || st?.by !== "stat" || !st.stat || !faces.length) return null;
  const { rows: eps } = await pool.query(
    `SELECT e.episode, e.provider, e.league, COALESCE(f.starts_at, e.starts_at) AS at, COALESCE(f.teams, e.teams) AS teams
       FROM season_events e LEFT JOIN sports_events f ON f.provider = e.provider AND f.league = e.league AND f.event_id = e.event_id
      WHERE e.season_id = $1 ORDER BY e.episode`,
    [seasonId]
  );
  const here = eps.find((e) => e.episode === episode) ?? eps[0];
  const sport = here ? sportOf(here.league as string) : null;
  const def = sport?.stats.find((s) => s.key === st.stat);
  if (!here || !sport || !def) return null;
  const abbr = new Map<string, string>();
  for (const e of eps) for (const t of Array.isArray(e.teams) ? (e.teams as Side[]) : []) if (t.name && t.abbreviation) abbr.set(t.name, t.abbreviation);
  const sides = new Set((Array.isArray(here.teams) ? (here.teams as Side[]) : []).map((t) => t.name).filter((x): x is string => !!x));
  // Up to this game's start, and to the first game of the season past your mark.
  const time = (v: unknown) => (v ? new Date(v as string).getTime() : null);
  const ends = [time(here.at), mark !== null && Number.isFinite(mark) ? time(eps.find((e) => e.episode === mark + 1)?.at) : null].filter((x): x is number => x !== null);
  const until = ends.length ? new Date(Math.min(...ends)) : new Date();
  const first = time(eps.find((e) => e.at)?.at);
  const from = new Date((first ?? until.getTime()) - SEASON_DAYS * 86_400_000);
  const [{ rows: finals }, { rows: cast }] = await Promise.all([
    pool.query("SELECT event_id, starts_at, lines FROM sports_events WHERE provider = $1 AND league = $2 AND final AND lines IS NOT NULL AND starts_at >= $3 AND starts_at < $4 ORDER BY starts_at", [here.provider, here.league, from, until]),
    pool.query("SELECT id, provider_ids FROM season_cast WHERE season_id = $1 AND provider_ids IS NOT NULL", [seasonId]),
  ]);
  // Each face's athlete id at this provider, through their season cast row.
  const athleteOfRow = new Map(cast.map((c) => [c.id as string, (c.provider_ids as Record<string, string> | null)?.[here.provider as string] ?? null]));
  const more = sport.stats.filter((s) => s.group === def.group && s.key !== def.key && s.kind === "count" && !s.place).slice(0, MORE);
  const col = (s: { key: string; short: string; label: string }): PickStatCol => ({ key: s.key, short: s.short, label: s.label });
  const stamped = state as LeagueState & { castProps?: Record<string, Record<string, string>>; castInjuries?: Record<string, { code: string }> };
  const tribes = new Map((state.tribes ?? []).map((t) => [t.id, t.name]));
  const full = (l: Record<string, number>) => (sport instanceof TeamSport ? sport.full(l) : l);
  const rows: Record<string, PickStatRow> = {};
  for (const id of faces) {
    const c = state.castaways.find((x) => x.id === id);
    const athlete = c?.seasonCastId ? athleteOfRow.get(c.seasonCastId) : null;
    let n = 0;
    let season = 0;
    let last: number | null = null;
    const totals: Record<string, number> = {};
    if (athlete) {
      for (const f of finals) {
        const raw = (f.lines as Record<string, Record<string, number>>)[athlete];
        if (!raw) continue;
        const line = full(raw) as Record<string, number>;
        n++;
        const v = Number(line[def.key] ?? 0);
        season += v;
        last = v;
        for (const m of more) totals[m.key] = (totals[m.key] ?? 0) + Number(line[m.key] ?? 0);
      }
    }
    const team = c?.tribeId ? (tribes.get(c.tribeId) ?? null) : null;
    rows[id] = {
      team: team ? (abbr.get(team) ?? team) : null,
      position: stamped.castProps?.[id]?.position ?? null,
      injury: stamped.castInjuries?.[id]?.code ?? null,
      inGame: sides.size && team ? sides.has(team) : null,
      games: n,
      per: n ? Math.round((season / n) * 10) / 10 : null,
      last,
      season,
      more: totals,
    };
  }
  // The contenders' season lines: everyone in this game at a position that has the stat here (both quarterbacks, backups too).
  const p = mark === null || !Number.isFinite(mark) ? providers?.find((x) => x.id === here.provider) : undefined;
  if (p) {
    const at = new Set(faces.filter((id) => rows[id].inGame !== false && rows[id].season > 0).map((id) => rows[id].position).filter(Boolean));
    const asked = faces.filter((id) => rows[id].inGame !== false && rows[id].position && at.has(rows[id].position)).slice(0, LINES);
    const year = new Date(first ?? until.getTime()).getUTCFullYear();
    const lineOf = async (athlete: string): Promise<SeasonLine | null> => {
      try {
        // ESPN's year for a season over New Year is its end (the NBA's 2026-27 is 2027): the start's first, then the next.
        for (const y of [year, year + 1]) {
          const l = (await p.seasonStats(here.league as string, athlete, y))?.find((x) => x.category.toLowerCase() === def.group.toLowerCase() && x.labels.includes(def.short));
          if (l) return l;
        }
      } catch (e) {
        if (!(e instanceof SportsUnavailable)) console.error("[pick-stats] season line:", e);
      }
      return null;
    };
    const lines = await Promise.all(asked.map(async (id) => {
      const c = state.castaways.find((x) => x.id === id);
      const athlete = c?.seasonCastId ? athleteOfRow.get(c.seasonCastId) : null;
      return [id, athlete ? await lineOf(athlete) : null] as const;
    }));
    for (const [id, l] of lines) {
      if (!l) continue;
      const v = (label: string) => {
        const i = l.labels.indexOf(label);
        const x = i >= 0 ? Number(String(l.values[i]).replace(/,/g, "")) : NaN;
        return Number.isFinite(x) ? x : null;
      };
      const gp = v("GP");
      const total = v(def.short);
      const r = rows[id];
      // Only a fuller season than the one kept (never fewer games than we've counted ourselves).
      if (gp === null || total === null || gp < r.games) continue;
      // Games we don't hold: the one we do may not be their latest, so no "last game" rather than a stale one.
      if (gp > r.games) r.last = null;
      r.games = gp;
      r.season = total;
      r.per = gp ? Math.round((total / gp) * 10) / 10 : null;
      for (const m of more) {
        const x = v(m.short);
        if (x !== null) r.more[m.key] = x;
      }
    }
  }
  return { stat: col(def), group: def.group, more: more.map(col), rows, games: finals.length };
}
