// A team's season as its page draws it (docs/PLAN-sports-couch.md B2; docs/design-round/team-page-spec.md): the record and streak
// in words, the season's strip (a bar a game by margin, the bye a gap, the playoffs marked), the bye weeks from a league's weeks,
// a daily sport's homestands and road trips, a series's games, and months in the East. Pure: the screen and tests share it.

export interface SeasonGame {
  id: string;
  at: string | null;
  state: "pre" | "in" | "post";
  final: boolean;
  stage: "pre" | "regular" | "post" | null;
  home: boolean | null;
  opponent: { id: string } | null;
  /** The team's score and the opponent's. */
  score: [number, number] | null;
  result: "W" | "L" | "T" | null;
  calledOff: boolean;
}

export interface Week {
  label: string;
  from: string;
  to: string;
}

/** A day in the East ("2026-11-22"), as the league's weeks and days are cut. */
export const eastDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
/** A month in the East ("2026-11"). */
export const eastMonth = (iso: string) => eastDay(iso).slice(0, 7);

const played = (g: SeasonGame) => g.final && !!g.result && !g.calledOff;

/** Their record from the regular season's finals (a preseason's left out), "7–3", a tie as a third number; null before any. */
export function recordOf(games: SeasonGame[]): string | null {
  const done = games.filter((g) => played(g) && g.stage !== "pre" && g.stage !== "post");
  if (!done.length) return null;
  const n = (r: string) => done.filter((g) => g.result === r).length;
  return [n("W"), n("L"), ...(n("T") ? [n("T")] : [])].join("–");
}

/** The streak in words from the latest finals: "Won 2", "Lost 3", "Tied 1"; null before any. */
export function streakOf(games: SeasonGame[]): string | null {
  const done = games.filter((g) => played(g) && g.stage !== "pre").sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
  const last = done.at(-1)?.result;
  if (!last) return null;
  let n = 0;
  for (let i = done.length - 1; i >= 0 && done[i].result === last; i--) n++;
  return `${last === "W" ? "Won" : last === "L" ? "Lost" : "Tied"} ${n}`;
}

/** A league's regular-season weeks the team has no game in, between its first and last regular-season game (football's bye). */
export function byesOf(games: SeasonGame[], weeks: Week[]): Week[] {
  const days = games.filter((g) => g.stage !== "pre" && g.stage !== "post" && !g.calledOff && g.at).map((g) => eastDay(g.at!)).sort();
  if (!days.length) return [];
  const [first, last] = [days[0], days.at(-1)!];
  return weeks.filter((w) => /^Week \d+$/.test(w.label) && w.from > first && w.to < last && !days.some((d) => d >= w.from && d <= w.to));
}

export type StripItem =
  | { kind: "game"; id: string; month: string; result: "W" | "L" | "T" | null; margin: number; playoffStart: boolean }
  | { kind: "bye"; label: string; month: string };

/** The season's strip in date order: each game (to come: no result) and each bye, the first playoff game marked. */
export function stripOf(games: SeasonGame[], byes: Week[]): StripItem[] {
  const gs = games.filter((g) => g.stage !== "pre" && !g.calledOff && g.at).sort((a, b) => a.at!.localeCompare(b.at!));
  const items: (StripItem & { day: string })[] = [];
  let seenPost = false;
  for (const g of gs) {
    const playoffStart = g.stage === "post" && !seenPost;
    if (g.stage === "post") seenPost = true;
    items.push({
      kind: "game",
      id: g.id,
      day: eastDay(g.at!),
      month: eastMonth(g.at!),
      result: played(g) ? g.result : null,
      margin: played(g) && g.score ? Math.abs(g.score[0] - g.score[1]) : 0,
      playoffStart,
    });
  }
  for (const b of byes) items.push({ kind: "bye", label: b.label, day: b.from, month: b.from.slice(0, 7) });
  return items.sort((a, b) => a.day.localeCompare(b.day)).map(({ day, ...i }) => (void day, i));
}

/** The strip's words for a screen reader: "10 games: 7 won, 3 lost; biggest win by 21; won the last 2". */
export function stripWords(items: StripItem[], streak: string | null): string {
  const done = items.filter((i): i is Extract<StripItem, { kind: "game" }> => i.kind === "game" && !!i.result);
  const left = items.filter((i) => i.kind === "game" && !i.result).length;
  if (!done.length) return left ? `${left} games to come` : "No games";
  const n = (r: string) => done.filter((i) => i.result === r).length;
  const wins = done.filter((i) => i.result === "W");
  const parts = [`${done.length} played: ${n("W")} won, ${n("L")} lost${n("T") ? `, ${n("T")} tied` : ""}`];
  if (wins.length) parts.push(`biggest win by ${Math.max(...wins.map((w) => w.margin))}`);
  if (streak) parts.push(streak.toLowerCase().replace(/^(won|lost|tied) (\d+)$/, (_, w, k) => `${w} the last ${k}`));
  if (left) parts.push(`${left} to come`);
  return parts.join("; ");
}

export interface Run {
  home: boolean;
  games: string[];
  from: string;
  to: string;
}

/** A daily sport's homestands and road trips: three or more games in a row at home, or away (a game called off breaks none). */
export function runsOf(games: SeasonGame[], min = 3): Run[] {
  const gs = games.filter((g) => !g.calledOff && g.at && g.home != null && g.stage !== "pre").sort((a, b) => a.at!.localeCompare(b.at!));
  const out: Run[] = [];
  let cur: SeasonGame[] = [];
  const flush = () => {
    if (cur.length >= min) out.push({ home: !!cur[0].home, games: cur.map((g) => g.id), from: cur[0].at!, to: cur.at(-1)!.at! });
    cur = [];
  };
  for (const g of gs) {
    if (cur.length && cur[0].home !== g.home) flush();
    cur.push(g);
  }
  flush();
  return out;
}

/** Each game's place in a series (consecutive games against one opponent, two or more): `{ i, n }`, 1-based; none alone. */
export function seriesPlaces(games: SeasonGame[]): Map<string, { i: number; n: number }> {
  const gs = games.filter((g) => g.at && !g.calledOff).sort((a, b) => a.at!.localeCompare(b.at!));
  const out = new Map<string, { i: number; n: number }>();
  let i = 0;
  while (i < gs.length) {
    let j = i + 1;
    while (j < gs.length && gs[j].opponent?.id && gs[j].opponent?.id === gs[i].opponent?.id) j++;
    if (j - i >= 2) for (let k = i; k < j; k++) out.set(gs[k].id, { i: k - i + 1, n: j - i });
    i = j;
  }
  return out;
}

/** The month a team's schedule opens on: the game on now's or the next game's, else the last month they played. */
export function focusMonth(games: SeasonGame[], now: number): string | null {
  const gs = games.filter((g) => g.at).sort((a, b) => a.at!.localeCompare(b.at!));
  const next = gs.find((g) => g.state === "in") ?? gs.find((g) => !g.calledOff && g.state === "pre" && Date.parse(g.at!) > now - 4 * 3600_000);
  return next ? eastMonth(next.at!) : gs.length ? eastMonth(gs.at(-1)!.at!) : null;
}

/** "1st", "2nd", "23rd". */
export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
