// The couch's standings across every game it plays (docs/PLAN-new-design.md step 8; the mock's couchpages.js and
// hubplus.js): power rankings, head to head, the trophy shelf and its records, and your own numbers. Built from each
// game's table as the viewer may see it (couch-hub.ts reads them at the viewer's mark on each season, guard.ts), so a
// place here is never past where they are. Pure, for the tests.
//
// One table for every game, whatever kind: each game a person plays gives them points by where they placed in it,
// normalised to how many played (placePoints), so a Survival Pool and an Outlast weigh the same. A game counts once an
// episode of it has scored as far as you've seen; a running game counts where it stands, a finished one where it ended.

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
  artUrl: string | null;
  /** The year the season premiered, for "This year". */
  year: number | null;
  /** The last episode with results, as far as you've seen. 0: nothing yet (the game doesn't count). */
  through: number;
  /** The season has ended, as far as you've seen. */
  ended: boolean;
  /** The table now (at your mark). */
  rows: StandingRow[];
  /** The table one episode earlier, for who moved; null when there wasn't one. */
  before: StandingRow[] | null;
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

export interface RankRow {
  userId: string;
  name: string;
  place: number;
  rank: string;
  total: number;
  /** Where the points came from, by show (the bar). */
  byShow: { showId: string; points: number }[];
  games: number;
  /** Since the last episode: up, down, or null. Only "This year" says. */
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
  year: RankRow[];
  all: RankRow[];
  /** The shows the points came from, most first: the legend and the bar's order. */
  shows: { showId: string; name: string }[];
  h2h: HeadToHead[];
  /** Games counted this year and all-time. */
  counted: { year: number; all: number };
}

const counts = (g: GameStanding) => g.through > 0 && g.rows.length >= 2;

function totals(games: GameStanding[], people: Person[], rowsOf: (g: GameStanding) => StandingRow[] | null) {
  const by = new Map(people.map((p) => [p.userId, { ...p, total: 0, games: 0, shows: new Map<string, number>() }]));
  for (const g of games) {
    const rows = rowsOf(g);
    if (!rows || rows.length < 2) continue;
    for (const r of rows) {
      const t = r.userId ? by.get(r.userId) : undefined;
      if (!t) continue;
      const pts = placePoints(r.place, rows.length);
      t.total += pts;
      t.games++;
      t.shows.set(g.showId, (t.shows.get(g.showId) ?? 0) + pts);
    }
  }
  return [...by.values()].filter((t) => t.games > 0);
}

function table(games: GameStanding[], people: Person[], beforeToo: boolean): RankRow[] {
  const now = ranked(totals(games, people, (g) => g.rows), (t) => t.total);
  const was = beforeToo ? ranked(totals(games, people, (g) => g.before), (t) => t.total) : [];
  return now
    .map(({ item, place, rank }) => {
      const then = was.find((w) => w.item.userId === item.userId);
      return {
        userId: item.userId,
        name: item.name,
        place,
        rank,
        total: item.total,
        byShow: [...item.shows].map(([showId, points]) => ({ showId, points })).sort((a, b) => b.points - a.points),
        games: item.games,
        move: then && then.place !== place ? (then.place > place ? ("up" as const) : ("down" as const)) : null,
      };
    })
    .sort((a, b) => a.place - b.place || a.name.localeCompare(b.name));
}

/** Power rankings and head to head for `me`, or null before any game has scored. `year`: this calendar year. */
export function rankingsOf(games: GameStanding[], people: Person[], me: string, year: number): Rankings | null {
  const all = games.filter(counts);
  if (!all.length) return null;
  const thisYear = all.filter((g) => g.year === year || (!g.ended && g.year === null));
  const pts = new Map<string, number>();
  for (const r of table(all, people, false)) for (const s of r.byShow) pts.set(s.showId, (pts.get(s.showId) ?? 0) + s.points);
  const names = new Map(all.map((g) => [g.showId, g.showName]));
  const h2h: HeadToHead[] = people
    .filter((p) => p.userId !== me)
    .map((p) => {
      const out = { userId: p.userId, name: p.name, games: 0, won: 0, lost: 0, tied: 0 };
      for (const g of all) {
        const mine = g.rows.find((r) => r.userId === me);
        const theirs = g.rows.find((r) => r.userId === p.userId);
        if (!mine || !theirs) continue;
        out.games++;
        if (mine.place < theirs.place) out.won++;
        else if (mine.place > theirs.place) out.lost++;
        else out.tied++;
      }
      return out;
    })
    .filter((h) => h.games > 0)
    .sort((a, b) => b.won - b.lost - (a.won - a.lost) || b.games - a.games || a.name.localeCompare(b.name));
  return {
    year: table(thisYear, people, true),
    all: table(all, people, false),
    shows: [...pts].sort((a, b) => b[1] - a[1]).map(([showId]) => ({ showId, name: names.get(showId) ?? "" })),
    h2h,
    counted: { year: thisYear.length, all: all.length },
  };
}

// ---------- the trophy shelf ----------

export interface Plaque {
  leagueId: string;
  seasonId: string;
  label: string;
  gameName: string;
  artUrl: string | null;
  /** Your place, when you played it. */
  you: { place: number; rank: string } | null;
  /** Who won it (a tie: everyone sharing first), and by how much when one did on points. */
  winners: { userId: string | null; name: string }[];
  by: number | null;
  /** The winner also won this show's previous season of this game on the couch. */
  ranItBack: boolean;
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

const pointsGame = (g: GameStanding) => g.gameType !== "pickem";

/** The trophy shelf, or null until a season the couch played has ended (as far as you've seen). */
export function trophiesOf(games: GameStanding[], people: Person[], me: string): TrophyShelf | null {
  const ended = games.filter((g) => g.ended && counts(g));
  if (!ended.length) return null;
  const member = new Map(people.map((p) => [p.userId, p]));
  // Newest first: by year, then the season's label (Survivor 50 before Survivor 49).
  const order = [...ended].sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || b.label.localeCompare(a.label, undefined, { numeric: true }));
  const winnersOf = (g: GameStanding) => g.rows.filter((r) => r.place === 1);
  const plaques: Plaque[] = order.map((g) => {
    const top = winnersOf(g);
    const second = g.rows.find((r) => r.place === 2);
    // The same show's previous season of the same game on the couch, if it had ended too.
    const prev = order.filter((x) => x.showId === g.showId && x.gameType === g.gameType && x.seasonId !== g.seasonId && (x.year ?? 0) <= (g.year ?? 0) && x.label.localeCompare(g.label, undefined, { numeric: true }) < 0)[0];
    const prevWinners = prev ? new Set(winnersOf(prev).map((r) => r.userId).filter(Boolean)) : new Set();
    const mine = g.rows.find((r) => r.userId === me);
    return {
      leagueId: g.leagueId,
      seasonId: g.seasonId,
      label: g.label,
      gameName: g.gameName,
      artUrl: g.artUrl,
      you: mine ? { place: mine.place, rank: mine.rank } : null,
      winners: top.map((r) => ({ userId: r.userId, name: r.userId ? (member.get(r.userId)?.name ?? r.name) : r.name })),
      by: top.length === 1 && second && pointsGame(g) ? Math.round((top[0].total - second.total) * 10) / 10 : null,
      ranItBack: top.length === 1 && !!top[0].userId && prevWinners.has(top[0].userId),
    };
  });

  const titles = new Map<string, number>();
  for (const g of ended) for (const r of winnersOf(g)) if (r.userId && member.has(r.userId)) titles.set(r.userId, (titles.get(r.userId) ?? 0) + 1);
  const finishes = new Map<string, number[]>();
  for (const g of ended) for (const r of g.rows) if (r.userId && member.has(r.userId)) finishes.set(r.userId, [...(finishes.get(r.userId) ?? []), r.place]);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const mostTitles = [...titles].sort((a, b) => b[1] - a[1])[0];

  const records: CouchRecord[] = [];
  if (mostTitles) records.push({ key: "titles", title: "Most titles", line: `${mostTitles[1]} ${mostTitles[1] === 1 ? "title" : "titles"}`, who: member.get(mostTitles[0])! });
  const back = plaques.find((p) => p.ranItBack);
  if (back) {
    const prevLabel = plaques.find((p) => p.seasonId !== back.seasonId && p.gameName === back.gameName && p.winners.some((w) => w.userId === back.winners[0].userId) && p.label.localeCompare(back.label, undefined, { numeric: true }) < 0)?.label;
    records.push({ key: "ranItBack", title: "Ran it back", line: prevLabel ? `${prevLabel} and ${back.label.replace(/^.*?(\d+)$/, "$1")}` : back.label, who: member.get(back.winners[0].userId!)! });
  }
  let streak: { who: string; n: number; label: string } | null = null;
  for (const g of games.filter(counts)) for (const r of g.rows) if (r.userId && member.has(r.userId) && (r.best ?? 0) > (streak?.n ?? 1)) streak = { who: r.userId, n: r.best!, label: g.label };
  if (streak) records.push({ key: "streak", title: "Longest pool streak", line: `${streak.n} episodes · ${streak.label}`, who: member.get(streak.who)! });
  const steady = [...finishes].filter(([, xs]) => xs.length >= 2).sort((a, b) => avg(a[1]) - avg(b[1]))[0];
  if (steady) records.push({ key: "average", title: "Best average finish", line: `${Math.round(avg(steady[1]) * 10) / 10} across ${steady[1].length} games`, who: member.get(steady[0])! });

  const mine = finishes.get(me) ?? [];
  return {
    titles: titles.get(me) ?? 0,
    seasons: new Set(games.filter((g) => counts(g) && g.rows.some((r) => r.userId === me)).map((g) => g.seasonId)).size,
    average: mine.length ? Math.round(avg(mine)) : null,
    leader: mostTitles && (mostTitles[0] !== me || [...titles.values()].filter((n) => n === mostTitles[1]).length > 1) ? { who: member.get(mostTitles[0])!, titles: mostTitles[1] } : null,
    plaques,
    records,
  };
}

// ---------- your numbers (the profile) ----------

export interface YourNumbers {
  titles: number;
  /** This year's ranking points, and your place. */
  points: number;
  place: string | null;
  seasons: number;
  /** The show you do best at: the most points per game. */
  bestShow: { showId: string; name: string; seasonId: string; artUrl: string | null } | null;
  called: number;
  /** Your best finish in a season that's over. */
  bestFinish: { rank: string; label: string; gameName: string } | null;
}

export function yourNumbers(games: GameStanding[], rankings: Rankings | null, trophies: TrophyShelf | null, me: string): YourNumbers {
  const played = games.filter((g) => counts(g) && g.rows.some((r) => r.userId === me));
  const perShow = new Map<string, { pts: number; n: number; g: GameStanding }>();
  for (const g of played) {
    const r = g.rows.find((x) => x.userId === me)!;
    const s = perShow.get(g.showId) ?? { pts: 0, n: 0, g };
    s.pts += placePoints(r.place, g.rows.length);
    s.n++;
    if ((g.year ?? 0) >= (s.g.year ?? 0)) s.g = g;
    perShow.set(g.showId, s);
  }
  const best = [...perShow.values()].sort((a, b) => b.pts / b.n - a.pts / a.n)[0];
  const finishes = games.filter((g) => g.ended && counts(g)).flatMap((g) => g.rows.filter((r) => r.userId === me).map((r) => ({ r, g })));
  const top = finishes.sort((a, b) => a.r.place - b.r.place)[0];
  const row = rankings?.year.find((r) => r.userId === me);
  return {
    titles: trophies?.titles ?? 0,
    points: row?.total ?? 0,
    place: row ? row.rank : null,
    seasons: new Set(played.map((g) => g.seasonId)).size,
    bestShow: best ? { showId: best.g.showId, name: best.g.showName, seasonId: best.g.seasonId, artUrl: best.g.artUrl } : null,
    called: games.reduce((n, g) => n + (g.rows.find((r) => r.userId === me)?.called ?? 0), 0),
    bestFinish: top ? { rank: top.r.rank.replace(/^T/, ""), label: top.g.label, gameName: top.g.gameName } : null,
  };
}

// ---------- couch accolades (By the numbers) ----------

export interface Accolade {
  key: string;
  stat: string;
  /** A person, or (Most-watched show) a show's name. */
  who: string;
  userId: string | null;
  line: string;
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
 * 14 part 2: the newest such first). Each only when it says something (a count worth naming).
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
  const leader = (m: Map<string, number>, min: number) => {
    const top = [...m].filter(([id]) => member.has(id)).sort((a, b) => b[1] - a[1] || member.get(a[0])!.name.localeCompare(member.get(b[0])!.name))[0];
    return top && top[1] >= min ? top : null;
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
    const alone = [...shows.get(most[0])!].filter((s) => watchers.get(s)!.who.size === 1).length;
    out.push({ key: "shows", stat: "Most shows on their list", who: member.get(most[0])!.name, userId: most[0], line: `${most[1]} shows${alone ? ` · ${alone} nobody else watches` : ""}` });
  }
  const watched = [...watchers].sort((a, b) => b[1].who.size - a[1].who.size)[0];
  if (watched && watched[1].who.size >= 2) out.push({ key: "watched", stat: "Most-watched show", who: watched[1].name, userId: null, line: `${watched[1].who.size} of ${people.length} watch it` });

  const called = new Map<string, number>();
  for (const g of games) for (const r of g.rows) if (r.userId && r.called) called.set(r.userId, (called.get(r.userId) ?? 0) + r.called);
  const caller = leader(called, 1);
  if (caller) out.push({ key: "called", stat: "Called it most", who: member.get(caller[0])!.name, userId: caller[0], line: `${caller[1]} ${caller[1] === 1 ? "prediction" : "predictions"} right` });

  const talker = leader(messages, 3);
  if (talker) out.push({ key: "chat", stat: "Says the most", who: member.get(talker[0])!.name, userId: talker[0], line: `${talker[1]} messages this month` });

  const reactor = leader(opts.reactions ?? new Map(), 5);
  if (reactor) out.push({ key: "reactions", stat: "Most reactions this month", who: member.get(reactor[0])!.name, userId: reactor[0], line: `${reactor[1]} reactions` });
  const along = leader(opts.watchAlongs ?? new Map(), 2);
  if (along) out.push({ key: "watch-alongs", stat: "Most watch alongs", who: member.get(along[0])!.name, userId: along[0], line: `${along[1]} this month` });

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
