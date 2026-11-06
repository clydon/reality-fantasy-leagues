import StateLogic from "@/lib/game/state-logic.js";
import type { SportsGameFacts } from "@/lib/game/game-spec";
import type { LeagueState } from "@/lib/game/types";
import { BoutSport, TeamSport, boutsOf, groupOf, renamed, sportOf, storedFacts, type StatBout, type StoredFinal, type StoredPeople, type StoredShape, type Stats } from "@/lib/sports";
import { pool } from "../db";

// A league's sports games as the server reads them (docs/PLAN-start-a-game-gpt.md track L, L3 parts 1 and 3): each episode's game
// or event (a field's, a card's), from the counts saved with it once it was final (finals.ts, sports_events.lines, people and
// shape), in the league's own people. For a game scored by
// stats, each episode's lines by castaway (their derived stats worked out: Sport.full) and each one's position group (their
// roster's, season_cast.role, before the game's: a soccer sub's is "SUB"); the engine's scorer turns them into each holding's
// moments at the game's table (src/lib/game/sequence/stats.js statMoments: L3 part 2 is its hook), and on a card each one's bouts
// (for a table by its bouts' formats: statMoments' boutsOf). For the sports settles, each
// episode's game as the grader reads it (facts.games: answers.js sportsVerdict), as of a viewer's mark: a game they haven't
// marked seen is still to play for them. For a side answer, each episode's sides.
//
// The people: a saved line is the provider's id for its person (ESPN's athlete id), their season_cast row's provider_ids say who,
// and the league's castaway of that name is them. Someone the league's cast doesn't have keeps the provider's id ("espn:4431679"),
// so who has the most is still right when it's nobody's pick.
//
// L8: a league's slate links several games an episode (a day's, a week's, a round's). Its episode's games are each kept apart
// (`slate`, by the provider's event id) as the grader reads one, with each game's lines (`byGame`: a table that scores each game
// on its own, a bonus at 100 yards, adds them up); its `lines` are each castaway's counts over the episode's final games added
// together (a category over a week: the hook's window), derived stats worked out on the sum. `games` and `sides` are an
// episode's one game's: an episode of several has its own in `slate` (the engine lane's hook says how a question names one).

/** A league's sports games, as far as the server knows them. */
export interface LeagueGames {
  /** Each episode's lines (castaway id to counts; a team game's derived stats worked out), for each episode whose game is final
   *  and saved, as far as the mark; an episode of several games (L8), its final ones' counts added up. */
  lines: Map<number, Record<string, Stats>>;
  /** L8: an episode of several games, each final one's lines (event id to castaway id to counts, derived stats worked out). */
  byGame: Map<number, Map<string, Record<string, Stats>>>;
  /** L8: an episode of several games, each one as the grader reads it (event id to its facts), as far as the mark. */
  slate: Map<number, Map<string, SportsGameFacts>>;
  /** Each castaway's position group, where their roster says one (for a table by position). */
  groups: Record<string, string>;
  /** On a card (a fight card, a tennis event's draws), each episode's bouts by castaway, each its own line at its rounds or sets
   *  (statMoments' boutsOf: a table by format). */
  bouts: Map<number, Record<string, StatBout[]>>;
  /** Each episode's game as the grader reads it, as far as the mark (one past it: still to play); an episode of one game. */
  games: Map<number, SportsGameFacts>;
  /** Each episode's sides (the teams' ids), for a side answer; an episode of one game. */
  sides: Map<number, string[]>;
}

/** The season a league plays (its show's slug and season number), or null. */
async function seasonIdOf(state: LeagueState): Promise<string | null> {
  const s = (state.settings ?? {}) as { showId?: string; wikiSeason?: unknown };
  if (!s.showId || s.wikiSeason == null || !Number.isFinite(Number(s.wikiSeason))) return null;
  const { rows } = await pool.query(
    "SELECT ss.id FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id WHERE sh.slug = $1 AND ss.season_number = $2",
    [s.showId, Number(s.wikiSeason)]
  );
  return (rows[0]?.id as string | undefined) ?? null;
}

/** Where a game stands for the server: final once its counts are saved (a final without them yet is still being played for
 *  everyone), off once the provider says it's over without a final (postponed, called off). */
function statusOf(r: { state: string | null; final: boolean | null; lines: unknown; starts_at: Date | null }, now: number): SportsGameFacts["status"] {
  if (r.final) return r.lines ? "final" : "in";
  if (r.state === "post") return "off";
  if (r.state === "in") return "in";
  if (r.state === "pre") return "pre";
  return r.starts_at && r.starts_at.getTime() <= now ? "in" : "pre";
}

/**
 * A league's sports games, as of `mark` (the viewer's: a game past it is still to play for them; null, as it stands): undefined
 * for a league whose season links no games. `now` is for checks.
 */
export async function leagueGames(state: LeagueState, o: { mark?: number | null; now?: Date } = {}): Promise<LeagueGames | undefined> {
  const seasonId = await seasonIdOf(state);
  if (!seasonId) return undefined;
  const [{ rows }, { rows: cast }, { rows: slated }] = await Promise.all([
    pool.query(
      `SELECT e.episode, e.provider, e.league, e.event_id, e.starts_at, e.teams AS linked, f.state, f.final, f.teams, f.lines, f.people, f.shape
         FROM season_events e LEFT JOIN sports_events f ON f.provider = e.provider AND f.league = e.league AND f.event_id = e.event_id
        WHERE e.season_id = $1 ORDER BY e.episode`,
      [seasonId]
    ),
    pool.query("SELECT name, role, provider_ids FROM season_cast WHERE season_id = $1 AND provider_ids IS NOT NULL", [seasonId]),
    pool.query("SELECT 1 FROM sports_slates WHERE season_id = $1", [seasonId]),
  ]);
  if (!rows.length) return undefined;
  const now = (o.now ?? new Date()).getTime();
  const mark = o.mark ?? null;
  // The league's castaways by name; each provider id's person, and their roster's position.
  const byName = new Map<string, string>();
  for (const c of state.castaways ?? []) if (!byName.has(c.name.toLowerCase())) byName.set(c.name.toLowerCase(), c.id);
  const who = new Map<string, { id: string; role: string | null }>();
  for (const c of cast) {
    const id = byName.get(String(c.name).toLowerCase());
    if (!id) continue;
    for (const [provider, athlete] of Object.entries((c.provider_ids ?? {}) as Record<string, string>)) who.set(`${provider}:${athlete}`, { id, role: c.role ?? null });
  }
  const out: LeagueGames = { lines: new Map(), byGame: new Map(), slate: new Map(), groups: {}, bouts: new Map(), games: new Map(), sides: new Map() };
  // L8: a slate's every episode is of several games (one with a single game listed so far too: its shape never changes as more are
  // linked).
  const slate = slated.length > 0;
  /** A game's facts: an episode's one, or one of a slate's episode's. */
  const setGame = (n: number, event: string, facts: SportsGameFacts) => {
    if (!slate) return void out.games.set(n, facts);
    if (!out.slate.has(n)) out.slate.set(n, new Map());
    out.slate.get(n)!.set(event, facts);
  };
  // An event linked to several episodes (a race weekend's sessions, each a listing's episode: season_events.part) is kept whole,
  // not session by session, so it's scored and settled once, on the last of them; the earlier ones are still being played for the
  // server (never the weekend's places on qualifying's episode, nor its lines twice).
  const lastOf = new Map<string, number>();
  const raw = new Map<number, Record<string, Stats>>();
  for (const r of rows) {
    const k = `${r.provider}|${r.league}|${r.event_id}`;
    lastOf.set(k, Math.max(lastOf.get(k) ?? 0, Number(r.episode)));
  }
  for (const r of rows) {
    const n = Number(r.episode);
    // The row's sides with the score it last saw (a final's, before its counts are kept); a game it hasn't seen, the link's.
    const known = ((r.teams ?? r.linked ?? []) as { id: string; score?: number | string | null }[]).map((t) => ({ id: String(t.id), score: Number(t.score) || 0 }));
    const teams = known.map((t) => t.id);
    if (teams.length && !slate) out.sides.set(n, teams);
    const event = String(r.event_id);
    const sport = sportOf(r.league);
    if (!sport) continue;
    if (mark !== null && n > mark) {
      setGame(n, event, { status: "pre", sides: teams.map((id) => ({ id, score: 0 })), lines: {}, teams: {} });
      continue;
    }
    const early = Number(r.episode) < (lastOf.get(`${r.provider}|${r.league}|${r.event_id}`) ?? 0);
    const status = early && statusOf(r, now) === "final" ? "in" : statusOf(r, now);
    if (status !== "final") {
      setGame(n, event, { status, sides: status === "pre" ? teams.map((id) => ({ id, score: 0 })) : known, lines: {}, teams: {} });
      continue;
    }
    // The saved final in the league's people (a team's own ids, its sides, stay as they are).
    const people = (r.people ?? {}) as StoredPeople;
    const idOf = (athlete: string) => who.get(`${r.provider}:${athlete}`)?.id ?? `${r.provider}:${athlete}`;
    for (const [athlete, p] of Object.entries(people)) {
      const c = who.get(`${r.provider}:${athlete}`);
      const group = c ? groupOf(sport, c.role, p.position) : null;
      if (c && group && !out.groups[c.id]) out.groups[c.id] = group;
    }
    const g = renamed(storedOf(sport, r.lines as Record<string, Stats>, people, known, r.shape as StoredShape | null), idOf);
    setGame(n, event, storedFacts(sport, g, "final"));
    // A team game's derived stats worked out (total bases); a field's and a card's lines as the phone scores them (statePoints).
    const full = (lines: Record<string, Stats>) => (sport instanceof TeamSport ? Object.fromEntries(Object.entries(lines).map(([id, l]) => [id, sport.full(l)])) : lines);
    if (slate) {
      if (!out.byGame.has(n)) out.byGame.set(n, new Map());
      out.byGame.get(n)!.set(event, full(g.lines));
      // The episode's counts added up (each game's raw counts: a rate worked out on the sum, never a sum of rates).
      const sum = (raw.get(n) ?? raw.set(n, {}).get(n))!;
      for (const [id, l] of Object.entries(g.lines)) {
        const had = (sum[id] ??= {});
        for (const [k, v] of Object.entries(l)) had[k] = (had[k] ?? 0) + v;
      }
      out.lines.set(n, full(sum));
      continue;
    }
    out.lines.set(n, full(g.lines));
    if (g.kind === "card") out.bouts.set(n, Object.fromEntries(Object.keys(g.lines).map((id) => [id, boutsOf(g.card, g.byBout, id)])));
  }
  return out;
}

/** A row's kept final as its sport keeps it: a team game's with its sides, a field's or a card's with its shape (one kept as none
 *  has an empty one). */
function storedOf(sport: NonNullable<ReturnType<typeof sportOf>>, lines: Record<string, Stats>, people: StoredPeople, sides: { id: string; score: number }[], shape: StoredShape | null): StoredFinal {
  // A team game's shape is a shootout's goals (L4 part 1a: ESPN's, never in the score) and its periods' ends (L4 part 2).
  if (sport instanceof TeamSport) {
    const t = shape?.kind === "team" ? shape : null;
    const so = t?.shootout ?? {};
    return { final: true, sides: sides.map((s) => (typeof so[s.id] === "number" ? { ...s, shootout: so[s.id] } : s)), ...(t?.periods?.length ? { periods: t.periods } : {}), lines, people };
  }
  if (sport instanceof BoutSport) {
    const s = shape?.kind === "card" ? shape : { card: { event: "", bouts: [], field: [] }, byBout: {}, results: [] };
    return { kind: "card", final: true, card: s.card, byBout: s.byBout, results: s.results, lines, people };
  }
  const s = shape?.kind === "field" ? shape : { event: { event: "", field: [], parts: 0, cut: null }, standings: [] };
  return { kind: "field", final: true, event: s.event, standings: s.standings, lines, people };
}

/** A side answer's faces for the window opening at `episode` (a question asked once: the game's first): its game's sides, from
 *  the games the grader read (`games`: facts.games), else read now; null for an episode with no game linked. */
export async function sidesFor(state: LeagueState, episode: number, games?: Map<number, SportsGameFacts>): Promise<Set<string> | null> {
  const sides = games ? games.get(episode)?.sides.map((s) => s.id) : (await leagueGames(state))?.sides.get(episode);
  return sides?.length ? new Set(sides) : null;
}

/** What a stamp writes (StateLogic.StatsLogic.stamp's `o`). */
type Stamp = { lines: Record<number, Record<string, Stats>>; bouts: Record<number, Record<string, StatBout[]>>; groups: Record<string, string> };
// The league poll reads every 15 s (league-read.ts readyLeague), and a season's kept finals are big (everyone's counts, a game an
// episode): each server instance keeps the last stamp it worked out for a league, with a fingerprint of what it read (32 bytes: the
// season's kept finals, its cast's provider ids and positions, the league's castaways), and reads the finals again only when it moves.
// A final is kept once and never written again (finals.ts), so the fingerprint moves exactly when a game is kept or the cast changes.
const stamps = new Map<string, { key: string; stamp: Stamp }>();
const MAX_STAMPS = 200;
const seasons = new Map<string, string>();

/**
 * L3 part 2, the engine's hook: a game scored by a sport's stats, its games' lines stamped on `state` in place (StateLogic.StatsLogic
 * .stamp): each final, kept game's lines by castaway on its episode, a card's bouts, the cast's position groups, so the engine's
 * scoring sequence scores them as each holding's moments. As it stands (every final game: the viewer's copy is cut at their mark
 * by the spoiler view, as any result is). Never stored: withLeagueLock leaves the stamped keys out of what it saves. Any other game,
 * or one whose season links no games, is left as it is. Returns the state.
 */
export async function stampStats(state: LeagueState): Promise<LeagueState> {
  if (!StateLogic.StatsLogic.on(state)) return state;
  const s = (state.settings ?? {}) as { showId?: string; wikiSeason?: unknown };
  const which = `${s.showId}/${s.wikiSeason}`;
  const seasonId = seasons.get(which) ?? (await seasonIdOf(state));
  if (!seasonId) return state;
  seasons.set(which, seasonId);
  const { rows } = await pool.query(
    `SELECT md5(concat_ws('|',
       (SELECT string_agg(f.event_id || ':' || f.lines_at::text, ',' ORDER BY f.event_id)
          FROM season_events e JOIN sports_events f ON f.provider = e.provider AND f.league = e.league AND f.event_id = e.event_id
         WHERE e.season_id = $1 AND f.lines_at IS NOT NULL),
       (SELECT string_agg(e.episode || ':' || e.event_id, ',' ORDER BY e.episode, e.event_id) FROM season_events e WHERE e.season_id = $1),
       (SELECT string_agg(c.name || ':' || coalesce(c.role, '') || ':' || coalesce(c.provider_ids::text, ''), ',' ORDER BY c.name)
          FROM season_cast c WHERE c.season_id = $1))) AS key`,
    [seasonId]
  );
  const cast = (state.castaways ?? []).map((c) => `${c.id}:${c.name}`).join(",");
  const key = `${seasonId}|${rows[0]?.key}|${cast}`;
  const id = `${seasonId}|${cast}`;
  let hit = stamps.get(id);
  if (!hit || hit.key !== key) {
    const g = await leagueGames(state);
    if (!g) return state;
    hit = { key, stamp: { lines: Object.fromEntries(g.lines), bouts: Object.fromEntries(g.bouts), groups: g.groups } };
    stamps.delete(id);
    stamps.set(id, hit);
    if (stamps.size > MAX_STAMPS) stamps.delete(stamps.keys().next().value!);
  }
  // Each league its own copy of the lines (stamp keeps only its castaways' and the copy is the league's to change).
  return StateLogic.StatsLogic.stamp(state, structuredClone(hit.stamp));
}
