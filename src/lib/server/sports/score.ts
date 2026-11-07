import { createHmac } from "crypto";
import StateLogic from "@/lib/game/state-logic.js";
import Squares from "@/lib/game/sequence/squares.js";
import Bracket from "@/lib/game/sequence/bracket.js";
import type { BracketField } from "@/lib/game/sequence/bracket";
import type { SportsGameFacts } from "@/lib/game/game-spec";
import type { LeagueState } from "@/lib/game/types";
import type { CategoryDefs } from "@/lib/game/sequence/categories";
import { BoutSport, PLAYOFFS, TeamSport, boutsOf, groupOf, playoffsFacts, playoffsStart, renamed, sportOf, storedFacts, type PlayoffGame, type StatBout, type StoredFinal, type StoredPeople, type StoredShape, type Stats } from "@/lib/sports";
import { pool } from "../db";
import { sportsProviders } from "./index";
import type { SportsProvider } from "./types";

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
//
// L8 part 1's engine items, part 2: a league's playoffs slate's games, grouped into their series (src/lib/sports/playoffs.ts: each
// game's round from its note, each series' winner the side that took it), are one draw, "playoffs", a series a bout of it
// (`playoffs`: a card's facts, as the grader reads a tennis draw's), as of the mark, for a bracket of the playoffs.

/** A league's sports games, as far as the server knows them. */
export interface LeagueGames {
  /** Each episode's lines (castaway id to counts; a team game's derived stats worked out), for each episode whose game is final
   *  and saved, as far as the mark; an episode of several games (L8), its final ones' counts added up. */
  lines: Map<number, Record<string, Stats>>;
  /** L8: an episode of several games, each final one's lines (event id to castaway id to counts, derived stats worked out). */
  byGame: Map<number, Map<string, Record<string, Stats>>>;
  /** L8: an episode of several games, each one as the grader reads it (event id to its facts), as far as the mark. */
  slate: Map<number, Map<string, SportsGameFacts>>;
  /** Each castaway's position group, where their roster says one (for a table by position; G3 part 3b, a pool of some positions'
   *  players): every castaway's from their season_cast role, else a kept final's position. */
  groups: Record<string, string>;
  /** G3 part 3b: each team's ESPN id by its name, as the season's linked games name it (a castaway's group is their team's name). */
  teamIds: Record<string, string>;
  /** On a card (a fight card, a tennis event's draws), each episode's bouts by castaway, each its own line at its rounds or sets
   *  (statMoments' boutsOf: a table by format). */
  bouts: Map<number, Record<string, StatBout[]>>;
  /** Each episode's game as the grader reads it, as far as the mark (one past it: still to play); an episode of one game. */
  games: Map<number, SportsGameFacts>;
  /** Each episode's sides (the teams' ids), for a side answer; an episode of one game. */
  sides: Map<number, string[]>;
  /** L3 part 2d: the sport's stats as the engine reads them for categories (Sport.categoryDefs: each one's better, group and a
   *  rate's parts), the season's games' sport's. */
  defs: CategoryDefs;
  /** L3 part 2e: a team sport's regulation periods (Sport.periods: halftime's, for squares), or null. */
  periods: number | null;
  /** L3 part 2f: a slate's episodes whose every game is over (final and kept, or off), as far as the mark: its results are in. */
  done: Set<number>;
  /** L3 part 2f part 2: every episode's games by event id (a slate's, or an episode's one), each as the grader reads it as far as
   *  the mark, with its listing (its name, start and sides by name): a question about each game's (AnswerFacts.slate). */
  eachGame: Map<number, Map<string, SportsGameFacts>>;
  /** L8 part 1's engine items, part 2: a playoffs slate's series as one card's bouts (the draw "playoffs"), as far as the mark:
   *  final once the final's series is won. Null for any other season. */
  playoffs: SportsGameFacts | null;
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
      `SELECT e.episode, e.provider, e.league, e.event_id, e.name AS title, e.starts_at, e.teams AS linked, e.note, e.best_of, f.state, f.final, f.teams, f.lines, f.people, f.shape, f.called,
              (f.odds->>'overUnder')::float8 AS line, f.odds_at AS line_at
         FROM season_events e LEFT JOIN sports_events f ON f.provider = e.provider AND f.league = e.league AND f.event_id = e.event_id
        WHERE e.season_id = $1 ORDER BY e.episode`,
      [seasonId]
    ),
    pool.query("SELECT name, role, provider_ids FROM season_cast WHERE season_id = $1 AND provider_ids IS NOT NULL", [seasonId]),
    pool.query("SELECT stage FROM sports_slates WHERE season_id = $1", [seasonId]),
  ]);
  if (!rows.length) return undefined;
  const now = (o.now ?? new Date()).getTime();
  const mark = o.mark ?? null;
  const who = peopleOf(state, cast);
  const out: LeagueGames = { lines: new Map(), byGame: new Map(), slate: new Map(), groups: {}, teamIds: {}, bouts: new Map(), games: new Map(), sides: new Map(), defs: {}, periods: null, done: new Set(), eachGame: new Map(), playoffs: null };
  // L3 part 2f: a slate's episodes with a game not over yet (still to play, being played, or final without its counts kept).
  const open = new Set<number>();
  const slateEps = new Set<number>();
  // L8: a slate's every episode is of several games (one with a single game listed so far too: its shape never changes as more are
  // linked).
  const slate = slated.length > 0;
  // L8 part 1's engine items, part 2: a playoffs slate's every game as the series read it (its note and series length as linked).
  // An event linked to several episodes is one game, its last episode's row (keyed by its id: a later row replaces it).
  const playoffs: Map<string, PlayoffGame> | null = slated[0]?.stage === "post" ? new Map() : null;
  let row: { note: string | null; best_of: number | null; starts_at: Date | null } | null = null;
  const teamNames = new Map<string, string | null>();
  /** A game's facts: an episode's one, or one of a slate's episode's; with its listing, every episode's by event id (eachGame). */
  let listing: SportsGameFacts["listing"] = undefined;
  const setGame = (n: number, event: string, facts: SportsGameFacts) => {
    if (!out.eachGame.has(n)) out.eachGame.set(n, new Map());
    out.eachGame.get(n)!.set(event, { ...facts, listing });
    if (playoffs && row) playoffs.set(event, { id: event, note: row.note, bestOf: row.best_of, at: row.starts_at ? row.starts_at.toISOString() : null, status: facts.status, sides: facts.sides, episode: n });
    // L3 part 3b: with its listing (its line: an over/under on the game's own line opens with it).
    if (!slate) return void out.games.set(n, { ...facts, listing });
    if (!out.slate.has(n)) out.slate.set(n, new Map());
    out.slate.get(n)!.set(event, facts);
  };
  // An event linked to several episodes (a race weekend's sessions, each a listing's episode: season_events.part) is kept whole,
  // not session by session, so it's scored and settled once, on the last of them; the earlier ones are still being played for the
  // server (never the weekend's places on qualifying's episode, nor its lines twice).
  const lastOf = new Map<string, number>();
  const raw = new Map<number, Record<string, Stats>>();
  // L3 part 2f: a slate's episode's lines, each game's with its derived stats added up; the sport's rates (worked out on the sum).
  const sums = new Map<number, Record<string, Stats>>();
  const rates = new Set<string>();
  const sportOfRows = rows.length ? sportOf(rows[0].league) : null;
  if (sportOfRows) for (const [k, d] of Object.entries(sportOfRows.categoryDefs())) if (d.parts) rates.add(k);
  // G3 part 3b: every castaway's position group from their roster's role (a kept final's position fills in for one with none).
  if (sportOfRows) for (const c of who.values()) {
    const group = groupOf(sportOfRows, c.role);
    if (group && !out.groups[c.id]) out.groups[c.id] = group;
  }
  for (const r of rows) {
    const k = `${r.provider}|${r.league}|${r.event_id}`;
    lastOf.set(k, Math.max(lastOf.get(k) ?? 0, Number(r.episode)));
  }
  for (const r of rows) {
    const n = Number(r.episode);
    row = r;
    // The row's sides with the score it last saw (a final's, before its counts are kept); a game it hasn't seen, the link's.
    const known = ((r.teams ?? r.linked ?? []) as { id: string; score?: number | string | null }[]).map((t) => ({ id: String(t.id), score: Number(t.score) || 0 }));
    const teams = known.map((t) => t.id);
    const named = new Map(((r.linked ?? []) as { id: string; name?: string | null }[]).map((t) => [String(t.id), t.name ?? null]));
    if (playoffs) for (const [id, name] of named) if (!teamNames.get(id)) teamNames.set(id, name);
    for (const [id, name] of named) if (name && !out.teamIds[name]) out.teamIds[name] = id;
    // L3 part 3b: with the latest line read for it (an over/under on the game's own line keeps the one when it opened: answers.ts).
    listing = { name: (r.title as string | null) ?? null, startsAt: r.starts_at ? (r.starts_at as Date).toISOString() : null, sides: teams.map((id) => ({ id, name: named.get(id) ?? null })), line: Number.isFinite(r.line) ? (r.line as number) : null, lineAt: r.line_at ? (r.line_at as Date).toISOString() : null };
    if (teams.length && !slate) out.sides.set(n, teams);
    const event = String(r.event_id);
    const sport = sportOf(r.league);
    if (!sport) continue;
    if (!Object.keys(out.defs).length) out.defs = sport.categoryDefs();
    if (out.periods === null && sport instanceof TeamSport) out.periods = sport.periods.regulation;
    if (slate) slateEps.add(n);
    if (mark !== null && n > mark) {
      setGame(n, event, { status: "pre", sides: teams.map((id) => ({ id, score: 0 })), lines: {}, teams: {} });
      open.add(n);
      continue;
    }
    const early = Number(r.episode) < (lastOf.get(`${r.provider}|${r.league}|${r.event_id}`) ?? 0);
    const status = early && statusOf(r, now) === "final" ? "in" : statusOf(r, now);
    if (status !== "final" && status !== "off") open.add(n);
    if (status !== "final") {
      // L3 part 3b: a game called off says why (postponed: its makeup, when there is one, a game of its own; cancelled).
      const called = status === "off" && (r.called === "postponed" || r.called === "canceled") ? { called: r.called as "postponed" | "canceled" } : {};
      setGame(n, event, { status, sides: status === "pre" ? teams.map((id) => ({ id, score: 0 })) : known, lines: {}, teams: {}, ...called });
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
      const each = full(g.lines);
      out.byGame.get(n)!.set(event, each);
      // The episode's counts added up: each game's with its derived stats worked out on it (a double-double, a defense's points
      // allowed bracket: L3 part 2f), and a rate worked out on the counts' sum, never a sum of rates (its raw counts kept apart).
      const sum = (raw.get(n) ?? raw.set(n, {}).get(n))!;
      const counts = (sums.get(n) ?? sums.set(n, {}).get(n))!;
      for (const [id, l] of Object.entries(g.lines)) {
        const had = (sum[id] ??= {});
        for (const [k, v] of Object.entries(l)) had[k] = (had[k] ?? 0) + v;
        const got = (counts[id] ??= {});
        for (const [k, v] of Object.entries(each[id] ?? {})) if (!rates.has(k)) got[k] = (got[k] ?? 0) + v;
      }
      const whole = full(sum);
      out.lines.set(n, Object.fromEntries(Object.entries(counts).map(([id, l]) => [id, { ...l, ...Object.fromEntries(Object.entries(whole[id] ?? {}).filter(([k]) => rates.has(k))) }])));
      continue;
    }
    out.lines.set(n, full(g.lines));
    if (g.kind === "card") out.bouts.set(n, Object.fromEntries(Object.keys(g.lines).map((id) => [id, boutsOf(g.card, g.byBout, id)])));
  }
  for (const n of slateEps) if (!open.has(n)) out.done.add(n);
  if (playoffs) {
    // Its teams by name as linked (a bracket's faces: QuestionView.draw), and its first game's start.
    const games = [...playoffs.values()];
    out.playoffs = { ...playoffsFacts(games), listing: { name: null, startsAt: playoffsStart(games), sides: [...teamNames].map(([id, name]) => ({ id, name })) } };
  }
  return out;
}

/** The league's castaways by name, and each provider id's person (`provider:athlete`) with their roster's position. */
function peopleOf(state: LeagueState, cast: { name: string; role: string | null; provider_ids: Record<string, string> | null }[]): Map<string, { id: string; role: string | null }> {
  const byName = new Map<string, string>();
  for (const c of state.castaways ?? []) if (!byName.has(c.name.toLowerCase())) byName.set(c.name.toLowerCase(), c.id);
  const who = new Map<string, { id: string; role: string | null }>();
  for (const c of cast) {
    const id = byName.get(String(c.name).toLowerCase());
    if (!id) continue;
    for (const [provider, athlete] of Object.entries(c.provider_ids ?? {})) who.set(`${provider}:${athlete}`, { id, role: c.role ?? null });
  }
  return who;
}

/**
 * L3 part 2e: a bracket question's draw for an episode's card (`cls` the draw: tennis's "MS"), as listed now, in the league's people
 * (sequence/bracket.js bracketOf: who's in it, each round's matches and winners so far): the kept final's once it's final (`games`,
 * the grader's, when it has them), else the provider's card as it stands (provider.game: cached an hour until it's final, cache.ts),
 * so an answer made before the event starts is checked against the draw as listed then. Null for an episode with no card linked,
 * or a card with none of that draw. `providers` is for checks. L8 part 1's engine items, part 2: the draw "playoffs" is a league's
 * playoffs slate's series as linked now (leagueGames' `playoffs`, or `playoffs` when the grader has them), whatever the episode.
 */
export async function drawNow(state: LeagueState, episode: number, cls: string, o: { games?: Map<number, SportsGameFacts>; playoffs?: SportsGameFacts | null; providers?: SportsProvider[] } = {}): Promise<BracketField | null> {
  const field = (f: SportsGameFacts | null | undefined) => (f?.bouts ? Bracket.bracketOf(f.bouts, cls) : null);
  // L8 part 1's engine items, part 2: a league's playoffs, its series as linked now (the grader's, when it has them).
  if (cls === PLAYOFFS) {
    // Given (null too: the caller looked), else read now.
    const out = field("playoffs" in o ? o.playoffs : (await leagueGames(state))?.playoffs);
    return out && out.first !== null ? out : null;
  }
  const known = field(o.games?.get(episode));
  if (known && known.first !== null) return known;
  const seasonId = await seasonIdOf(state);
  if (!seasonId) return null;
  const [{ rows }, { rows: cast }] = await Promise.all([
    pool.query("SELECT provider, league, event_id FROM season_events WHERE season_id = $1 AND episode = $2 ORDER BY event_id LIMIT 1", [seasonId, episode]),
    pool.query("SELECT name, role, provider_ids FROM season_cast WHERE season_id = $1 AND provider_ids IS NOT NULL", [seasonId]),
  ]);
  const r = rows[0];
  const sport = r ? sportOf(r.league) : null;
  const p = r ? (o.providers ?? sportsProviders()).find((x) => x.id === r.provider) : null;
  if (!r || !sport || !(sport instanceof BoutSport) || !p) return null;
  const g = await p.game(r.league, r.event_id);
  if (!g || g.kind !== "card") return null;
  const who = peopleOf(state, cast);
  const f = storedFacts(sport, renamed(g, (athlete) => who.get(`${r.provider}:${athlete}`)?.id ?? `${r.provider}:${athlete}`), g.final ? "final" : "in");
  const out = field(f);
  return out && out.first !== null ? out : null;
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

/** A final game's score as the squares read it (StatsLogic.stamp's `o.games`). */
type GameScore = Pick<SportsGameFacts, "status" | "sides" | "periods">;
/** What a stamp writes (StateLogic.StatsLogic.stamp's `o`). */
type Stamp = { lines: Record<number, Record<string, Stats>>; bouts: Record<number, Record<string, StatBout[]>>; groups: Record<string, string>; teamIds: Record<string, string>; finals: number[]; defs: CategoryDefs; games: Record<number, GameScore>; periods: number | null; byGame: Record<number, Record<string, Record<string, Stats>>> };
// The league poll reads every 15 s (league-read.ts readyLeague), and a season's kept finals are big (everyone's counts, a game an
// episode): each server instance keeps the last stamp it worked out for a league, with a fingerprint of what it read (32 bytes: the
// season's kept finals, its games called off, its cast's provider ids and positions, the league's castaways), and reads the finals again only when it moves.
// A final is kept once and never written again (finals.ts), so the fingerprint moves exactly when a game is kept or the cast changes.
const stamps = new Map<string, { key: string; stamp: Stamp }>();
const MAX_STAMPS = 200;
const seasons = new Map<string, string>();

/**
 * L3 part 2, the engine's hook: a game scored by a sport's stats, its games' lines stamped on `state` in place (StateLogic.StatsLogic
 * .stamp): each final, kept game's lines by castaway on its episode, a card's bouts, the cast's position groups, so the engine's
 * scoring sequence scores them as each holding's moments. Part 2c: a game asking a question a sport's game settles (its final, a
 * stat in it) gets each episode whose game is final (`finals`: its results are in; the grader reads the games themselves,
 * answer-points.ts serverFacts), a game scored by stats those too. As it stands (every final game: the viewer's copy is cut at their
 * mark by the spoiler view, as any result is). Never stored: withLeagueLock leaves the stamped keys out of what it saves. Any other
 * game, or one whose season links no games, is left as it is. Returns the state.
 */
export async function stampStats(state: LeagueState): Promise<LeagueState> {
  if (!StateLogic.StatsLogic.reads(state)) return state;
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
       (SELECT string_agg(f.event_id, ',' ORDER BY f.event_id)
          FROM season_events e JOIN sports_events f ON f.provider = e.provider AND f.league = e.league AND f.event_id = e.event_id
         WHERE e.season_id = $1 AND f.state = 'post' AND NOT f.final),
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
    // An episode's one game final (a league's slate's episodes are 2f's: their lines are their final games' already). L3 part 3b:
    // or called off (postponed, cancelled): its results are in, nothing happened (nothing scores, its questions don't count), so
    // the game moves on past it.
    const finals = [...g.games].filter(([, f]) => f.status === "final" || f.status === "off").map(([n]) => n);
    // L3 part 2e: each final game's score, for squares (its sides and each period's end); a called-off one's its status alone (its
    // squares pay nobody: payScore's 'off').
    const games = Object.fromEntries(finals.map((n) => { const f = g.games.get(n)!; return [n, { status: f.status, sides: f.sides, ...(f.periods ? { periods: f.periods } : {}) }]; }));
    // L3 part 2f: a slate's episode only once every game in it is over (its results then: a partial week is never in), its lines
    // the week's and each game's (a table scored game by game: byGame).
    const lines = Object.fromEntries([...g.lines].filter(([n]) => !g.slate.has(n) || g.done.has(n)));
    const byGame = Object.fromEntries([...g.byGame].filter(([n]) => g.done.has(n)).map(([n, m]) => [n, Object.fromEntries(m)]));
    hit = { key, stamp: { lines, bouts: Object.fromEntries(g.bouts), groups: g.groups, teamIds: g.teamIds, finals: [...finals, ...g.done], defs: g.defs, games, periods: g.periods, byGame } };
    stamps.delete(id);
    stamps.set(id, hit);
    if (stamps.size > MAX_STAMPS) stamps.delete(stamps.keys().next().value!);
  }
  // Each league its own copy of the lines (stamp keeps only its castaways' and the copy is the league's to change); a game of
  // questions, its finals alone (the grader reads the games); the sport's stats' defs only for a game ranked by categories; squares
  // their finals' scores, the sport's periods and each locked episode's digits; a slate's each game's lines beside its week's.
  const { defs, games, periods, teamIds, ...lines } = hit.stamp;
  const stamp = StateLogic.SquaresLogic.on(state)
    ? { finals: [...hit.stamp.finals], games: structuredClone(games), periods, digits: squareDigits(state) }
    : StateLogic.StatsLogic.on(state)
      ? { ...structuredClone(lines), ...(StateLogic.StatsLogic.categories(state) ? { defs } : {}) }
      : StateLogic.StatsLogic.readsGames(state)
        ? { finals: [...hit.stamp.finals] }
        : {};
  // G3 part 3b: a pool of some teams' or positions' players (PoolLogic), each castaway's position group and the ESPN id of the team
  // they're listed on now (their group's name, as the season's linked games name it).
  const filter = StateLogic.PoolLogic.filter(state);
  if (filter) Object.assign(stamp, { groups: { ...hit.stamp.groups }, ...(Object.keys(teamIds).length ? { teams: teamsOf(state, teamIds) } : {}) });
  return StateLogic.StatsLogic.stamp(state, stamp);
}

/** G3 part 3b: each castaway's team as an ESPN id: the name of the group they're in now (castaway.tribeId) as the linked games name it. */
function teamsOf(state: LeagueState, ids: Record<string, string>): Record<string, string> {
  const named = new Map(Object.entries(ids).map(([name, id]) => [name.toLowerCase(), id]));
  const tribes = new Map((state.tribes ?? []).map((t) => [t.id, t.name]));
  const out: Record<string, string> = {};
  for (const c of state.castaways ?? []) {
    const name = c.tribeId ? tribes.get(c.tribeId) : null;
    const id = name ? named.get(name.toLowerCase()) : undefined;
    if (id) out[c.id] = id;
  }
  return out;
}

/**
 * L3 part 2e: a squares game's digits for each episode that has locked and hasn't kept its own yet (SquaresLogic.toDraw), each drawn
 * from a secret only the server reads and the episode's id (an HMAC: the same every read, and nobody, the phone included, can work
 * them out before the lock, so nobody picks a good number). SquaresLogic.settle keeps them in the league at the next write.
 */
function squareDigits(state: LeagueState): Record<number, { rows: number[][]; cols: number[][] }> {
  const parts = StateLogic.SquaresLogic.parts(state);
  if (!parts) return {};
  const secret = process.env.BETTER_AUTH_SECRET || "gys-squares-dev";
  return Object.fromEntries(StateLogic.SquaresLogic.toDraw(state).map((e: { number: number; id: string }) => [e.number, Squares.digitsOf(createHmac("sha256", secret).update(`squares|${e.id}`).digest("hex"), parts.grid)]));
}
