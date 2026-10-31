// The couch's standings across every game it plays (docs/PLAN-new-design.md step 8; the mock's couchpages.js and
// hubplus.js): power rankings, head to head, the trophy shelf and its records, and your own numbers. Built from each
// game's table as the viewer may see it (couch-hub.ts reads them at the viewer's mark on each season, guard.ts), so a
// place here is never past where they are. Pure, for the tests.
//
// Power rankings are Couch points since 2026-10-31 (the user): how much each person joins in on the couch (COUCH_POINTS,
// counted by couch-points.ts), not where they placed, which had everyone tied. Head to head, the trophy shelf and your best
// show stay the games' results: each game a person plays is worth points by where they placed in it, normalised to how many
// played (placePoints), so a Survival Pool and an Outlast weigh the same. A game counts once an episode of it has scored as far
// as you've seen; a running game counts where it stands, a finished one where it ended.

export interface StandingRow {
  /** Null for a computer player or anyone without an account: they take up places but aren't ranked. */
  userId: string | null;
  name: string;
  place: number;
  /** "1", "T2". */
  rank: string;
  total: number;
  /** Survival Pool: the best streak (what it ranks by) and the one running now. */
  best?: number;
  streak?: number;
  /** Predictions called right, as far as you've seen. */
  called?: number;
  /** A10 part 4b: the seat (its player id) the row is for. A team two people share is one row a person, each credited with the
   *  team's place, and one team in the field (fieldOf). */
  seat?: string;
  /** A11 part 5: the team of players the row's seat plays for. Its members are one team in the field (fieldOf), each credited with
   *  the team's place, and never in each other's head to head (they played on the same side). */
  side?: string;
}

export interface GameStanding {
  leagueId: string;
  /** The game's own name ("Couch Cup") and its kind's ("Outlast"). */
  name: string;
  gameName: string;
  gameType: string;
  seasonId: string;
  showId: string;
  showName: string;
  /** "Survivor 50". */
  label: string;
  /** A game over a span (docs/PLAN-sports-data.md step 6): its episodes, and how the show says them ("Games 4–6"). */
  span?: { from: number; to: number; name: string } | null;
  artUrl: string | null;
  /** The year the season premiered, for "This year". */
  year: number | null;
  /** The last episode with results, as far as you've seen. 0: nothing yet (the game doesn't count). */
  through: number;
  /** The season has ended, as far as you've seen. */
  ended: boolean;
  /** Step R1: a pool (a pick each episode, the spec's get.by): its table ranks by streak or who's standing, not by points, so its
   *  plaque gives no margin. */
  pool?: boolean;
  /** The table now (at your mark). */
  rows: StandingRow[];
  /** The table one episode earlier, for who moved; null when there wasn't one. */
  before: StandingRow[] | null;
  /** Step A11 part 3: a co-op game (the couch together against the show, its lives everyone's): its result, won or lost by all
   *  (null while it plays), and its lives left of how many. Everyone shares one place in it, so it isn't a finish against each
   *  other: power rankings, head to head, titles and finishes leave it out; the trophy shelf keeps it, everyone winning it or
   *  nobody. What it shows is U1's (A11 part 3's Noticed). */
  coop?: { result: "won" | "lost" | null; lives: number; of: number } | null;
  /** Step A11 part 4: a head-to-head game: its places are its playoffs' and its record's, not its points, so its plaque gives no
   *  margin in points (`by`); its winner is the playoffs' champion (first in its table). */
  matchups?: boolean;
  /** Step A11 part 5: a game played in teams of players: its places are its teams' (every member shares their team's), so its plaque
   *  gives no margin in anyone's own points; its winners are the winning team's members, each credited. */
  teams?: boolean;
}

export interface Person {
  userId: string;
  name: string;
}

/** A place's points: 10 for first, 1 for last, evenly between, whatever the game and however many play it. */
export function placePoints(place: number, of: number): number {
  if (of < 2) return 0;
  return Math.round(1 + (9 * (of - Math.min(place, of))) / (of - 1));
}

/** "1", "T2" for each value, best first: ties share a place. */
function ranked<T>(items: T[], value: (x: T) => number): { item: T; place: number; rank: string }[] {
  const sorted = [...items].sort((a, b) => value(b) - value(a));
  return sorted.map((item) => {
    const first = sorted.findIndex((x) => value(x) === value(item));
    const tied = sorted.filter((x) => value(x) === value(item)).length > 1;
    return { item, place: first + 1, rank: `${tied ? "T" : ""}${first + 1}` };
  });
}

/**
 * What each thing someone does on the couch is worth in Couch points (the user, 2026-10-31), most first; the rankings page's How
 * you earn them reads it. `group` is the bar's colour and legend. couch-points.ts counts each kind: on the couch itself (joining
 * it, its games and their moves, its chats, polls, watch along plans and reactions) whenever it was, and on your own (shows you
 * follow openly, trivia, bingo, Call it, ratings, days you open the app) since you joined it.
 */
export const COUCH_POINTS = [
  { kind: "couch", points: 10, says: "Joining the couch", group: "here" },
  { kind: "started", points: 10, says: "Starting a game on it", group: "play" },
  { kind: "follow", points: 5, says: "Each show you follow", group: "watch" },
  { kind: "joined", points: 5, says: "Joining a game", group: "play" },
  { kind: "trivia", points: 5, says: "A round of trivia", group: "play" },
  { kind: "bingo", points: 5, says: "A bingo card you mark", group: "play" },
  { kind: "plan", points: 3, says: "Answering a watch along plan", group: "watch" },
  { kind: "move", points: 2, says: "Each move you set", group: "play" },
  { kind: "call", points: 2, says: "A Call it answer", group: "play" },
  { kind: "poll", points: 2, says: "A poll vote", group: "talk" },
  { kind: "rating", points: 2, says: "Rating an episode", group: "watch" },
  { kind: "chat", points: 1, says: "A chat message", cap: "10 a day", group: "talk" },
  { kind: "reaction", points: 1, says: "A watch along reaction", cap: "5 an episode", group: "watch" },
  { kind: "day", points: 1, says: "Each day you open the app", group: "here" },
] as const;
export type PointKind = (typeof COUCH_POINTS)[number]["kind"];
export type PointGroup = (typeof COUCH_POINTS)[number]["group"];
/** The bar's groups, in the order it draws them. */
export const POINT_GROUPS: { group: PointGroup; name: string }[] = [
  { group: "play", name: "Playing" },
  { group: "watch", name: "Watching" },
  { group: "talk", name: "Talking" },
  { group: "here", name: "Showing up" },
];
const WORTH = new Map<string, { points: number; group: PointGroup }>(COUCH_POINTS.map((p) => [p.kind, p]));

/** How many times someone did one kind of thing on the couch (couch-points.ts): ever, this calendar year, the last seven days. */
export interface PointCount {
  userId: string;
  kind: PointKind;
  all: number;
  year: number;
  week: number;
}

export interface RankRow {
  userId: string;
  name: string;
  place: number;
  rank: string;
  /** Couch points. */
  total: number;
  /** Where they came from, by kind (only kinds they have), most first; the bar adds them up by group. */
  byKind: { kind: PointKind; points: number }[];
  /** Points in the last seven days. */
  week: number;
  /** Their place against a week ago: up, down, or null. */
  move: "up" | "down" | null;
}

export interface HeadToHead {
  userId: string;
  name: string;
  /** Games you both play, and how often you finished above them, below them, level. */
  games: number;
  won: number;
  lost: number;
  tied: number;
}

export interface Rankings {
  /** Couch points this calendar year; null until the couch has done something before it (till then it's all time again). */
  year: RankRow[] | null;
  all: RankRow[];
  /** Head to head stays the games' results. */
  h2h: HeadToHead[];
}

/** How many teams a game's rows are: a team two people share counts once (its rows share a `seat`), and so does a team of players
 *  (step A11 part 5: its rows share a `side`). */
export function fieldOf(rows: StandingRow[]): number {
  const seats = new Set<string>();
  let lone = 0;
  for (const r of rows) {
    if (r.side) seats.add(`side:${r.side}`);
    else if (r.seat) seats.add(r.seat);
    else lone++;
  }
  return seats.size + lone;
}

const counts = (g: GameStanding) => g.through > 0 && fieldOf(g.rows) >= 2;
/** A game the couch played against each other (step A11 part 3: not a co-op one, where everyone shares one place). */
const versus = (g: GameStanding) => counts(g) && !g.coop;
/** The seasons you've played on the couch (finished or not), co-op games too. */
const seasonsOf = (games: GameStanding[], me: string) => new Set(games.filter((g) => counts(g) && g.rows.some((r) => r.userId === me)).map((g) => g.seasonId)).size;

/** One Couch points table: everyone on the couch (nobody's left off for having none), ranked, each with where a week ago left
 *  them when `moves` (among those with points then: someone who wasn't on the table a week ago hasn't moved on it). */
function table(counts: PointCount[], people: Person[], count: (c: PointCount) => number, moves: boolean): RankRow[] {
  const by = new Map(people.map((p) => [p.userId, { ...p, total: 0, week: 0, kinds: new Map<PointKind, number>() }]));
  for (const c of counts) {
    const t = by.get(c.userId);
    const worth = WORTH.get(c.kind);
    if (!t || !worth || !count(c)) continue;
    t.total += count(c) * worth.points;
    t.week += c.week * worth.points;
    t.kinds.set(c.kind, (t.kinds.get(c.kind) ?? 0) + count(c) * worth.points);
  }
  const now = ranked([...by.values()], (t) => t.total);
  const was = moves ? ranked([...by.values()].filter((t) => t.total > t.week), (t) => t.total - t.week) : [];
  return now
    .map(({ item, place, rank }) => {
      const then = was.find((w) => w.item.userId === item.userId);
      return {
        userId: item.userId,
        name: item.name,
        place,
        rank,
        total: item.total,
        byKind: [...item.kinds].map(([kind, points]) => ({ kind, points })).sort((a, b) => b.points - a.points),
        week: item.week,
        move: then && then.place !== place ? (then.place > place ? ("up" as const) : ("down" as const)) : null,
      };
    })
    .sort((a, b) => a.place - b.place || a.name.localeCompare(b.name));
}

/**
 * Power rankings for `me`: Couch points all time, and this calendar year once the couch has done something before it; null for
 * a couch of nobody. `counts`: what everyone did (couch-points.ts); `weekInYear`: the last seven days are all this year (so a
 * week ago is in the year's table too, and it can say who moved). Head to head from the games everyone has played.
 */
export function rankingsOf(games: GameStanding[], people: Person[], me: string, counts: PointCount[], weekInYear: boolean): Rankings | null {
  if (!people.length) return null;
  const before = counts.some((c) => c.all > c.year);
  return {
    year: before ? table(counts, people, (c) => c.year, weekInYear).map((r) => (weekInYear ? r : { ...r, week: 0 })) : null,
    all: table(counts, people, (c) => c.all, true),
    h2h: headToHead(games, people, me),
  };
}

/** `me` against everyone else on the couch: every game you've both played against each other, how often you finished above. */
export function headToHead(games: GameStanding[], people: Person[], me: string): HeadToHead[] {
  const all = games.filter(versus);
  return people
    .filter((p) => p.userId !== me)
    .map((p) => {
      const out = { userId: p.userId, name: p.name, games: 0, won: 0, lost: 0, tied: 0 };
      for (const g of all) {
        const mine = g.rows.find((r) => r.userId === me);
        const theirs = g.rows.find((r) => r.userId === p.userId);
        // Two on one team (step A10 part 4b), or on one team of players (A11 part 5), didn't play each other.
        if (!mine || !theirs || (mine.seat && mine.seat === theirs.seat) || (mine.side && mine.side === theirs.side)) continue;
        out.games++;
        if (mine.place < theirs.place) out.won++;
        else if (mine.place > theirs.place) out.lost++;
        else out.tied++;
      }
      return out;
    })
    .filter((h) => h.games > 0)
    .sort((a, b) => b.won - b.lost - (a.won - a.lost) || b.games - a.games || a.name.localeCompare(b.name));
}

// ---------- the trophy shelf ----------

export interface Plaque {
  leagueId: string;
  seasonId: string;
  label: string;
  /** A game over a span: which ("Games 4–6"), under the season's label. */
  span: string | null;
  gameName: string;
  artUrl: string | null;
  /** Your place, when you played it. */
  you: { place: number; rank: string } | null;
  /** Who won it (a tie: everyone sharing first), and by how much when one did on points. */
  winners: { userId: string | null; name: string }[];
  by: number | null;
  /** The winner also won this show's previous season of this game on the couch. */
  ranItBack: boolean;
  /** Step A11 part 3: a co-op game's result (everyone its winners when it was won, nobody when it was lost; null when it ended
   *  undecided: archived while it played, or its last night still to settle), absent otherwise. Its `you` is the shared place. */
  coop?: { result: "won" | "lost" | null };
}

export interface CouchRecord {
  key: "titles" | "ranItBack" | "streak" | "average";
  title: string;
  line: string;
  who: Person;
}

export interface TrophyShelf {
  /** Your titles, the seasons you've played on the couch (finished or not), and how you usually finish. */
  titles: number;
  seasons: number;
  average: number | null;
  /** Who holds the most titles, when it isn't only you. */
  leader: { who: Person; titles: number } | null;
  plaques: Plaque[];
  records: CouchRecord[];
}

const pointsGame = (g: GameStanding) => !g.pool;

/** `x` came before `g` on the couch: an earlier season of the show, or an earlier span of the same season. */
const earlier = (x: GameStanding, g: GameStanding) =>
  x.seasonId !== g.seasonId
    ? (x.year ?? 0) <= (g.year ?? 0) && x.label.localeCompare(g.label, undefined, { numeric: true }) < 0
    : !!x.span && !!g.span && x.span.to < g.span.from;

/** The trophy shelf, or null until a season the couch played has ended (as far as you've seen). */
export function trophiesOf(games: GameStanding[], people: Person[], me: string): TrophyShelf | null {
  const ended = games.filter((g) => g.ended && counts(g));
  if (!ended.length) return null;
  const member = new Map(people.map((p) => [p.userId, p]));
  // Newest first: by year, then the season's label (Survivor 50 before Survivor 49), then the span that ended later.
  const order = [...ended].sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || b.label.localeCompare(a.label, undefined, { numeric: true }) || (b.span?.to ?? 0) - (a.span?.to ?? 0));
  // Step A11 part 3: a co-op game's winners are everyone when it was won, nobody when it was lost.
  const winnersOf = (g: GameStanding) => (g.coop ? (g.coop.result === "won" ? g.rows : []) : g.rows.filter((r) => r.place === 1));
  const plaques: Plaque[] = order.map((g) => {
    const top = winnersOf(g);
    // One winner: one team, though two people sharing it are a row each (step A10 part 4b).
    const one = fieldOf(top) === 1;
    const second = g.rows.find((r) => r.place === 2);
    // The same game's previous run on the couch (the show's previous season, or this season's previous span), if it had ended too.
    // Step A11 part 3: never a co-op game (its winners are everyone, not someone who beat the couch).
    const prev = order.filter((x) => x.showId === g.showId && x.gameType === g.gameType && x.leagueId !== g.leagueId && !x.coop && earlier(x, g))[0];
    const prevWinners = prev ? new Set(winnersOf(prev).map((r) => r.userId).filter(Boolean)) : new Set();
    const mine = g.rows.find((r) => r.userId === me);
    return {
      leagueId: g.leagueId,
      seasonId: g.seasonId,
      label: g.label,
      span: g.span?.name ?? null,
      gameName: g.gameName,
      artUrl: g.artUrl,
      you: mine ? { place: mine.place, rank: mine.rank } : null,
      winners: top.map((r) => ({ userId: r.userId, name: r.userId ? (member.get(r.userId)?.name ?? r.name) : r.name })),
      by: one && second && pointsGame(g) && !g.coop && !g.matchups && !g.teams ? Math.round((top[0].total - second.total) * 10) / 10 : null,
      ranItBack: one && !g.coop && top.some((r) => !!r.userId && prevWinners.has(r.userId)),
      ...(g.coop ? { coop: { result: g.coop.result } } : {}),
    };
  });

  // Titles and finishes are against each other: a co-op game's (step A11 part 3) is the couch's, not anyone's over the rest.
  const titles = new Map<string, number>();
  for (const g of ended.filter((x) => !x.coop)) for (const r of winnersOf(g)) if (r.userId && member.has(r.userId)) titles.set(r.userId, (titles.get(r.userId) ?? 0) + 1);
  const finishes = new Map<string, number[]>();
  for (const g of ended.filter((x) => !x.coop)) for (const r of g.rows) if (r.userId && member.has(r.userId)) finishes.set(r.userId, [...(finishes.get(r.userId) ?? []), r.place]);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const mostTitles = [...titles].sort((a, b) => b[1] - a[1])[0];

  const records: CouchRecord[] = [];
  if (mostTitles) records.push({ key: "titles", title: "Most titles", line: `${mostTitles[1]} ${mostTitles[1] === 1 ? "title" : "titles"}`, who: member.get(mostTitles[0])! });
  const back = plaques.find((p) => p.ranItBack);
  if (back) {
    const standing = new Map(ended.map((g) => [g.leagueId, g]));
    const before = (p: Plaque, userId: string | null) => p.leagueId !== back.leagueId && !p.coop && p.gameName === back.gameName && p.winners.some((w) => w.userId === userId) && earlier(standing.get(p.leagueId)!, standing.get(back.leagueId)!);
    // Of a shared team that won, whichever of them won it before too.
    const winner = back.winners.find((w) => plaques.some((p) => before(p, w.userId))) ?? back.winners[0];
    const prev = plaques.find((p) => before(p, winner.userId));
    // "Survivor 49 and 50"; two spans of one season, "Survivor 51 · Episodes 6–7 and Episodes 8–9".
    const line = !prev ? back.label : prev.seasonId === back.seasonId ? `${back.label} · ${prev.span} and ${back.span}` : `${prev.label} and ${back.label.replace(/^.*?(\d+)$/, "$1")}`;
    records.push({ key: "ranItBack", title: "Ran it back", line, who: member.get(winner.userId!)! });
  }
  let streak: { who: string; n: number; label: string } | null = null;
  for (const g of games.filter(counts)) for (const r of g.rows) if (r.userId && member.has(r.userId) && (r.best ?? 0) > (streak?.n ?? 1)) streak = { who: r.userId, n: r.best!, label: g.label };
  if (streak) records.push({ key: "streak", title: "Longest pool streak", line: `${streak.n} episodes · ${streak.label}`, who: member.get(streak.who)! });
  const steady = [...finishes].filter(([, xs]) => xs.length >= 2).sort((a, b) => avg(a[1]) - avg(b[1]))[0];
  if (steady) records.push({ key: "average", title: "Best average finish", line: `${Math.round(avg(steady[1]) * 10) / 10} across ${steady[1].length} games`, who: member.get(steady[0])! });

  const mine = finishes.get(me) ?? [];
  return {
    titles: titles.get(me) ?? 0,
    seasons: seasonsOf(games, me),
    average: mine.length ? Math.round(avg(mine)) : null,
    leader: mostTitles && (mostTitles[0] !== me || [...titles.values()].filter((n) => n === mostTitles[1]).length > 1) ? { who: member.get(mostTitles[0])!, titles: mostTitles[1] } : null,
    plaques,
    records,
  };
}

// ---------- your numbers (the profile) ----------

export interface YourNumbers {
  titles: number;
  /** Your Couch points and place, in the table the rankings open on: this year's once there is one (`thisYear`), else all time. */
  points: number;
  place: string | null;
  thisYear: boolean;
  seasons: number;
  /** The show you do best at: the most points per game. */
  bestShow: { showId: string; name: string; seasonId: string; artUrl: string | null } | null;
  called: number;
  /** Your best finish in a season that's over. */
  bestFinish: { rank: string; label: string; gameName: string } | null;
}

export function yourNumbers(games: GameStanding[], rankings: Rankings | null, trophies: TrophyShelf | null, me: string): YourNumbers {
  // Places against each other (step A11 part 3: a co-op game's shared place says nothing of how you did against the couch).
  const played = games.filter((g) => versus(g) && g.rows.some((r) => r.userId === me));
  const perShow = new Map<string, { pts: number; n: number; g: GameStanding }>();
  for (const g of played) {
    const r = g.rows.find((x) => x.userId === me)!;
    const s = perShow.get(g.showId) ?? { pts: 0, n: 0, g };
    s.pts += placePoints(r.place, fieldOf(g.rows));
    s.n++;
    if ((g.year ?? 0) >= (s.g.year ?? 0)) s.g = g;
    perShow.set(g.showId, s);
  }
  const best = [...perShow.values()].sort((a, b) => b.pts / b.n - a.pts / a.n)[0];
  const finishes = games.filter((g) => g.ended && versus(g)).flatMap((g) => g.rows.filter((r) => r.userId === me).map((r) => ({ r, g })));
  const top = finishes.sort((a, b) => a.r.place - b.r.place)[0];
  const row = (rankings?.year ?? rankings?.all)?.find((r) => r.userId === me);
  return {
    titles: trophies?.titles ?? 0,
    points: row?.total ?? 0,
    place: row ? row.rank : null,
    thisYear: !!rankings?.year,
    seasons: seasonsOf(games, me),
    bestShow: best ? { showId: best.g.showId, name: best.g.showName, seasonId: best.g.seasonId, artUrl: best.g.artUrl } : null,
    called: games.reduce((n, g) => n + (g.rows.find((r) => r.userId === me)?.called ?? 0), 0),
    bestFinish: top ? { rank: top.r.rank.replace(/^T/, ""), label: top.g.label, gameName: top.g.gameName } : null,
  };
}

// ---------- couch accolades (By the numbers) ----------

export interface Accolade {
  key: string;
  stat: string;
  /** A person, the two sharing it ("alex and riley"), or (Most-watched show) a show's name. */
  who: string;
  /** The person's, or the first of those sharing it. */
  userId: string | null;
  /** The two sharing it, when two do: neither leads alone. */
  tied?: Person[];
  line: string;
}

/**
 * Whether a lead says something worth naming (the user, 2026-10-31: too many sharing first said nothing). `leaders`: how many share
 * the top count; `top`: that count; `field`: how many could have it (a season's counted cast, a couch's people). One leader alone
 * always does. A shared lead only between two (three or more never), when it's more than once (a count of one is "did it", not a
 * lead) and it singles them out: a quarter of the field or fewer share it, so a field of eight or more.
 *
 *   named  ⇔  leaders = 1  ∨  (leaders = 2 ∧ top ≥ 2 ∧ leaders ≤ field / 4)
 */
export function leadWorthNaming(leaders: number, top: number, field: number): boolean {
  return leaders === 1 || (leaders === 2 && top >= 2 && leaders <= field / 4);
}

/** "ann", "ann and bo", "ann, bo and cy". */
export function joinNames(names: string[]): string {
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** A streaming season's first to finish on the couch (step 14 part 2), from show_follows.finished_at. */
export interface FirstFinish {
  userId: string;
  showName: string;
  /** When they reached its last episode (ms). */
  at: number;
  /** When it dropped (ms), or null when nothing says. */
  dropAt: number | null;
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * The couch's own accolades: who follows the most shows (only what they share), the show the most people watch, who's
 * called the most predictions, who talks most this month, who reacts most in watch alongs and who watches along most this
 * month (step 13 part 3), who's on the longest Survival Pool run now, and who was first to finish a streaming season (step
 * 14 part 2: the newest such first). Each only when it says something (a count worth naming); a count shared at the top names
 * everyone sharing it (2026-10-31), never one of them as if they led alone, and only when the tie is worth naming (leadWorthNaming).
 */
export function accoladesOf(opts: {
  people: Person[];
  /** Each person's shared follows, by show. */
  follows: { userId: string; showId: string; showName: string }[];
  /** Messages in the couch's chats in the last 30 days, by person. */
  messages: Map<string, number>;
  games: GameStanding[];
  /** Watch along reactions said to the couch in the last 30 days, by person (on shows they follow openly). */
  reactions?: Map<string, number>;
  /** Episodes watched along on the couch in the last 30 days, by person (on shows they follow openly). */
  watchAlongs?: Map<string, number>;
  /** Each streaming season's first to finish, only seasons the viewer has finished (couch-hub.ts says who may be counted). */
  firstFinishes?: FirstFinish[];
}): Accolade[] {
  const { people, follows, messages, games } = opts;
  const member = new Map(people.map((p) => [p.userId, p]));
  const out: Accolade[] = [];
  /** The most anyone on the couch has, when it's at least `min`, and everyone who has it (by name): a tie names them all, when
   *  it's worth naming at all (leadWorthNaming, the couch the field). */
  const leader = (m: Map<string, number>, min: number) => {
    const on = [...m].filter(([id]) => member.has(id));
    const n = Math.max(0, ...on.map(([, x]) => x));
    if (!on.length || n < min) return null;
    const ids = on
      .filter(([, x]) => x === n)
      .map(([id]) => id)
      .sort((a, b) => member.get(a)!.name.localeCompare(member.get(b)!.name));
    if (!leadWorthNaming(ids.length, n, people.length)) return null;
    return { n, by: { who: joinNames(ids.map((id) => member.get(id)!.name)), userId: ids[0], ...(ids.length > 1 ? { tied: ids.map((id) => member.get(id)!) } : {}) } };
  };

  const shows = new Map<string, Set<string>>();
  const watchers = new Map<string, { name: string; who: Set<string> }>();
  for (const f of follows) {
    if (!member.has(f.userId)) continue;
    shows.set(f.userId, (shows.get(f.userId) ?? new Set()).add(f.showId));
    const w = watchers.get(f.showId) ?? { name: f.showName, who: new Set() };
    w.who.add(f.userId);
    watchers.set(f.showId, w);
  }
  const most = leader(new Map([...shows].map(([id, s]) => [id, s.size])), 2);
  if (most) {
    // Nobody else watching is one person's to say.
    const alone = most.by.tied ? 0 : [...shows.get(most.by.userId)!].filter((s) => watchers.get(s)!.who.size === 1).length;
    out.push({ key: "shows", stat: "Most shows on their list", ...most.by, line: `${most.n} shows${alone ? ` · ${alone} nobody else watches` : ""}` });
  }
  const watched = [...watchers].sort((a, b) => b[1].who.size - a[1].who.size)[0];
  if (watched && watched[1].who.size >= 2) out.push({ key: "watched", stat: "Most-watched show", who: watched[1].name, userId: null, line: `${watched[1].who.size} of ${people.length} watch it` });

  const called = new Map<string, number>();
  for (const g of games) for (const r of g.rows) if (r.userId && r.called) called.set(r.userId, (called.get(r.userId) ?? 0) + r.called);
  const caller = leader(called, 1);
  if (caller) out.push({ key: "called", stat: "Called it most", ...caller.by, line: `${caller.n} ${caller.n === 1 ? "prediction" : "predictions"} right` });

  const talker = leader(messages, 3);
  if (talker) out.push({ key: "chat", stat: "Says the most", ...talker.by, line: `${talker.n} messages this month` });

  const reactor = leader(opts.reactions ?? new Map(), 5);
  if (reactor) out.push({ key: "reactions", stat: "Most reactions this month", ...reactor.by, line: `${reactor.n} reactions` });
  const along = leader(opts.watchAlongs ?? new Map(), 2);
  if (along) out.push({ key: "watch-alongs", stat: "Most watch alongs", ...along.by, line: `${along.n} this month` });

  let run: { who: string; n: number; label: string } | null = null;
  for (const g of games) if (!g.ended && g.through > 0) for (const r of g.rows) if (r.userId && member.has(r.userId) && (r.streak ?? 0) > (run?.n ?? 1)) run = { who: r.userId, n: r.streak!, label: g.label };
  if (run) out.push({ key: "streak", stat: "On a streak", who: member.get(run.who)!.name, userId: run.who, line: `${run.n} in a row · ${run.label} Survival Pool` });

  // The mock's "First to finish · jordan · Severance, in 4 days": the newest first finish.
  const first = (opts.firstFinishes ?? []).filter((f) => member.has(f.userId)).sort((a, b) => b.at - a.at)[0];
  if (first) {
    const days = first.dropAt != null ? Math.max(1, Math.round((first.at - first.dropAt) / DAY_MS)) : null;
    out.push({
      key: "first-finish",
      stat: "First to finish",
      who: member.get(first.userId)!.name,
      userId: first.userId,
      line: days == null ? first.showName : `${first.showName}, in ${days === 1 ? "a day" : `${days} days`}`,
    });
  }
  return out;
}
