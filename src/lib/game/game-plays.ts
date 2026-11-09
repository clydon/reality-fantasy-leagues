import type { LeagueState } from "./types";
import StateLogic from "./state-logic.js";
import type { CoopWalk } from "./state-logic.js";
import { rosterAtEpisode } from "./active-roster-rows";

// Each person's plays by episode on a game's page (docs/PLAN-start-a-game-gpt.md U1, "Step 2 brief": data first), for the season
// grid (a row a person, a column an episode, a square by kind), the person sheet's strip and its episode block. The kinds are U0's
// census (`make_person_sheet.js classify`), read from the spec: what a square holds (points, a pick, won or lost, weeks won, the
// couch's lives, a race, stages) and what an episode's block shows (a lineup, the team with its best counted, who left, a pick,
// the picks, a card, answers, calls...). Pure, on the viewer's own copy (GhostLogic.viewFor at their mark), so nothing past it is
// in it: a column is an episode they've seen, a pick someone else made shows once it's decided, and the next episode says only
// whether each person's move is set. Each episode's points come from the engine's own series (MatchupLogic.seatSeries: a draft's
// walk, a pool's picks, a walked game of questions), a lineup's weeks (weeksOf), or what the server counted outside the state (a game
// of questions' answers, Weekly Calls' calls, bingo's lines: GameCalls.episodes).

/** What a square holds, by how the game ranks (the census's strip). */
export type GridKind = "points" | "pick" | "result" | "won" | "lives" | "race" | "stages";
/** What an episode's block shows, by how the game is played (the census's week; a game can have two: a pick and its answers). */
export type BlockKind = "lineup" | "counted" | "boots" | "team" | "pick" | "picks" | "card" | "squares" | "slate" | "calls" | "answers";

export interface Square {
  episode: number;
  /** What the episode added for them (points, a count of lines or right calls); null: they weren't in the game for it. */
  points: number | null;
  /** Their total through it (a race's climb). */
  total: number | null;
  /** The couch's most that episode (more than nothing): the bright one. */
  best: boolean;
  /** Weeks won: their side won it. */
  won?: boolean;
  /** A pool's pick: who, and whether they stayed (null: not decided yet, your own only). */
  pick?: { id: string | null; correct: boolean | null };
  /** Head to head: won, lost or tied, both scores and who against (a seat's player id, or a team's name; null: a bye, the median). */
  result?: { r: "W" | "L" | "T"; us: number; them: number | null; against: string | null; median: boolean; round: number | null };
  /** Outlast: who they held going into it, and who of them left in it. */
  held?: string[];
  left?: string[];
}

export interface GamePlays {
  kind: GridKind;
  blocks: BlockKind[];
  /** The columns: each episode the game has played as far as you've seen, oldest first. */
  episodes: number[];
  /** The episode after them, while the game goes on: whose move for it is in (true), not yet (false), or unknown (null). */
  next: { episode: number; set: Record<string, boolean | null> } | null;
  /** A race's target. */
  target: number | null;
  /** Co-op: the couch's lives after each episode, and at the start. */
  lives: { of: number; after: Record<number, number> } | null;
  /** Each person's squares, by player id, one a column. */
  rows: Record<string, Square[]>;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** The census's reading of a spec (U0's classify): its square and its episode's block(s). */
export function kindsOf(spec: Obj): { kind: GridKind; blocks: BlockKind[] } {
  const get = isObj(spec.get) ? spec.get : {};
  const sc = isObj(spec.score) ? spec.score : {};
  const rk = isObj(spec.rank) ? spec.rank : {};
  const count = isObj(spec.count) ? spec.count : {};
  const asks = (Array.isArray(spec.ask) ? spec.ask : []).filter(isObj);
  if (Array.isArray(spec.stages) && spec.stages.length) return { kind: "stages", blocks: [] };
  const race = isObj(rk.race) && rk.race.to != null;
  const kind: GridKind = rk.by === "matchups" ? "result" : rk.by === "coop" ? "lives" : race ? "race" : rk.by === "weeks" ? "won" : get.by === "pick" && sc.by === "survive" ? "pick" : "points";
  const blocks: BlockKind[] = [];
  if (get.by === "draft") blocks.push(count.start != null ? "lineup" : count.best != null ? "counted" : sc.by === "place" ? "boots" : "team");
  else if (get.by === "pick") blocks.push(sc.by === "survive" ? "pick" : "picks");
  else if (get.by === "card") blocks.push("card");
  else if (get.by === "squares") blocks.push("squares");
  if (asks.length) blocks.push(asks.some((q) => q.each === "game" || q.answer === "side") ? "slate" : asks.some((q) => q.answer === "calls") ? "calls" : "answers");
  if (!blocks.length) blocks.push("answers");
  return { kind, blocks };
}

export interface PlaysIn {
  /** The table's rows (their ids, a pool's picks, a lineup's weeks), in its order. */
  rows: { playerId: string; picks: { episode: number; castawayId: string | null; correct: boolean | null }[]; weeks: { episode: number; total: number }[] }[];
  /** The latest episode the game counts as far as you've seen (GameView.through). */
  through: number;
  /** What the server counted outside the state, each episode's by player (a game of questions, Weekly Calls, bingo). */
  outside?: Map<string, Map<number, number>> | null;
  /** The next episode's moves in, by player (a lineup, a pick: weekProgress; a game of questions: the server's), else null. */
  next?: { episode: number; set: Record<string, boolean | null> } | null;
  coop?: CoopWalk | null;
}

export function playsOf(view: LeagueState, i: PlaysIn): GamePlays {
  const spec = StateLogic.gameOf(view) as unknown as Obj;
  const { kind, blocks } = kindsOf(spec);
  const start = StateLogic.startEpisode(view) ?? 1;
  const end = StateLogic.endEpisode(view);
  const last = Math.min(i.through, end ?? Number.POSITIVE_INFINITY);
  const episodes: number[] = [];
  for (let n = Math.max(1, start); n <= last; n++) if (StateLogic.inPlay(view, n)) episodes.push(n);
  const ids = i.rows.map((r) => r.playerId);

  // Each episode's points by player: the server's count, a lineup's weeks, or the growth of the engine's series.
  const points = new Map<string, Map<number, number>>(ids.map((id) => [id, new Map()]));
  const totals = new Map<string, Map<number, number>>(ids.map((id) => [id, new Map()]));
  if (i.outside) {
    for (const id of ids) {
      const mine = i.outside.get(id);
      let run = 0;
      for (const n of episodes) {
        const p = mine?.get(n) ?? 0;
        run += p;
        points.get(id)!.set(n, p);
        totals.get(id)!.set(n, run);
      }
    }
  } else if (i.rows.some((r) => r.weeks.length)) {
    for (const r of i.rows) {
      let run = 0;
      for (const w of r.weeks) {
        run += w.total;
        points.get(r.playerId)!.set(w.episode, w.total);
        totals.get(r.playerId)!.set(w.episode, run);
      }
    }
  } else {
    let series: { number: number; totals: Map<string, number> }[] = [];
    try {
      series = StateLogic.MatchupLogic.seatSeries(view);
    } catch {
      series = [];
    }
    const before = new Map<string, number>();
    for (const x of series) {
      for (const id of ids) {
        if (!x.totals.has(id)) continue;
        const t = x.totals.get(id) ?? 0;
        points.get(id)!.set(x.number, round(t - (before.get(id) ?? 0)));
        totals.get(id)!.set(x.number, t);
        before.set(id, t);
      }
    }
  }

  // The week's results the square shows: head to head's games, the weeks won, an Outlast's boots.
  const side = sideOf(view);
  const results = kind === "result" ? matchupResults(view) : null;
  const weeks = kind === "won" ? weekWinners(view) : null;
  const boots = blocks.includes("boots");
  const lives = kind === "lives" && i.coop ? { of: i.coop.of, after: Object.fromEntries(episodes.map((n) => [n, i.coop!.of - i.coop!.lost.filter((l) => l.episode <= n).length])) } : null;

  const rows: Record<string, Square[]> = {};
  for (const r of i.rows) {
    const picks = new Map(r.picks.map((p) => [p.episode, p]));
    const mine = points.get(r.playerId)!;
    rows[r.playerId] = episodes.map((n) => {
      const p = mine.has(n) ? mine.get(n)! : null;
      const sq: Square = { episode: n, points: p, total: totals.get(r.playerId)!.get(n) ?? null, best: false };
      if (kind === "pick") {
        const pk = picks.get(n);
        if (pk) sq.pick = { id: pk.castawayId, correct: pk.correct };
      }
      if (results) {
        const res = results.get(n)?.get(side(r.playerId) ?? "");
        if (res) sq.result = res;
      }
      if (weeks) {
        const w = weeks.get(n);
        if (w) sq.won = w.includes(side(r.playerId) ?? "");
      }
      if (boots) {
        const ep = view.episodes.find((e) => e.number === n);
        if (ep) {
          const held = rosterAtEpisode(view, r.playerId, ep.id);
          sq.held = held.map((c) => c.id);
          sq.left = held.filter((c) => c.status === "eliminated" && c.exitEpisodeId === ep.id).map((c) => c.id);
        }
      }
      return sq;
    });
  }
  // The bright square: each episode's most, when it's more than nothing.
  episodes.forEach((n, k) => {
    const top = Math.max(0, ...ids.map((id) => rows[id][k].points ?? 0));
    if (top > 0) for (const id of ids) if (rows[id][k].points === top) rows[id][k].best = true;
  });

  const target = isObj(spec.rank) && isObj(spec.rank.race) && typeof spec.rank.race.to === "number" ? spec.rank.race.to : null;
  return { kind, blocks, episodes, next: i.next ?? null, target, lives, rows };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** A seat's side: itself, or the team of players it plays for (head to head and weeks won play sides). */
function sideOf(view: LeagueState): (playerId: string) => string | null {
  try {
    return StateLogic.MatchupLogic.sideOf(view);
  } catch {
    return (p) => p;
  }
}

/** Head to head's games by episode, each side's result: the regular season's weeks, then the playoffs' rounds played. */
function matchupResults(view: LeagueState): Map<number, Map<string, NonNullable<Square["result"]>>> {
  const out = new Map<number, Map<string, NonNullable<Square["result"]>>>();
  let walk: ReturnType<typeof StateLogic.MatchupLogic.run> = null;
  try {
    walk = StateLogic.MatchupLogic.run(view);
  } catch {
    walk = null;
  }
  if (!walk) return out;
  const teams = StateLogic.TeamLogic.on(view);
  // A side as the square names it: a seat's player id (the client names it), a team's name.
  const nameOf = (s: string | null) => (s === null ? null : teams ? (StateLogic.TeamLogic.nameOf(view, s) ?? s) : s);
  const put = (n: number, s: string, v: NonNullable<Square["result"]>) => {
    if (!out.has(n)) out.set(n, new Map());
    out.get(n)!.set(s, v);
  };
  for (const w of walk.weeks) {
    for (const g of w.games) {
      if (g.result === null) continue;
      const median = g.b === null && g.bPoints !== null;
      put(w.number, g.a, { r: g.result === "tie" ? "T" : g.result === "a" ? "W" : "L", us: g.aPoints, them: g.bPoints, against: nameOf(g.b), median, round: null });
      if (g.b !== null) put(w.number, g.b, { r: g.result === "tie" ? "T" : g.result === "b" ? "W" : "L", us: g.bPoints ?? 0, them: g.aPoints, against: nameOf(g.a), median: false, round: null });
    }
  }
  walk.rounds.forEach((rd, k) => {
    if (!rd.played) return;
    for (const g of rd.games) {
      if (!g.a || !g.b || g.winner === null) continue;
      put(rd.number, g.a, { r: g.winner === g.a ? "W" : "L", us: g.aPoints ?? 0, them: g.bPoints, against: nameOf(g.b), median: false, round: k + 1 });
      put(rd.number, g.b, { r: g.winner === g.b ? "W" : "L", us: g.bPoints ?? 0, them: g.aPoints, against: nameOf(g.a), median: false, round: k + 1 });
    }
  });
  return out;
}

/** Weeks won: each episode's winning sides. */
function weekWinners(view: LeagueState): Map<number, string[]> {
  try {
    const w = StateLogic.WeekLogic.run(view);
    return new Map((w?.weeks ?? []).map((x) => [x.number, x.winners]));
  } catch {
    return new Map();
  }
}

/** What the server counted by episode and account (Seq.tally's byEpisode: right calls, bingo lines), as each seat's by episode at
 *  `each` points a count (a line's points; a call's 1). A seat with no account counts nothing. */
export function episodesByPlayer(
  players: { id: string }[],
  userOf: (playerId: string) => string | null,
  byEpisode: Map<number, Map<string, number>>,
  each = 1
): Map<string, Map<number, number>> {
  const out = new Map<string, Map<number, number>>();
  for (const p of players) {
    const u = userOf(p.id);
    const mine = new Map<number, number>();
    if (u) for (const [n, at] of byEpisode) if (at.has(u)) mine.set(n, (at.get(u) ?? 0) * each);
    out.set(p.id, mine);
  }
  return out;
}

/** A game of questions' points by episode (AnswerLogic.grade's `earned`, by window "question|episode"; the game's own, asked once,
 *  aren't an episode's and stay in the total only). */
export function episodesOfEarned(earned: Map<string, Map<string, number>>): Map<string, Map<number, number>> {
  const out = new Map<string, Map<number, number>>();
  for (const [key, by] of earned) {
    const n = Number(key.slice(key.lastIndexOf("|") + 1));
    if (!Number.isInteger(n) || n < 1) continue;
    for (const [p, pts] of by) {
      if (!out.has(p)) out.set(p, new Map());
      const m = out.get(p)!;
      m.set(n, round((m.get(n) ?? 0) + pts));
    }
  }
  return out;
}
