// A sport's stats from its games (docs/PLAN-sports-data.md step 4; src/lib/server/sports/stats.ts fills them, rosters.ts shows
// them), for any sport. A game's line is the provider's own tables and columns (a hitter's `H-AB AB R H RBI ... AVG`, an AFL
// player's `D G B T`), and what adds up is read from the values themselves, never from a list of stats: whole numbers add (H, HR,
// K, goals, disposals), "x-y" pairs of them add both sides (H-AB "3-4" and "1-3" make "4-7"), and anything else doesn't (AVG
// ".279", ERA "2.70", IP "5.1" in thirds, a time "18:32", a race's "1st"): those show in the season line. So far is only the
// games up to your mark (the spoiler guard's), and coming in is the season line from before these games began.

/** One table of someone's line, in the provider's own columns. `name`: the provider's ("batting"); null for a sport with one. */
export interface LineTable {
  name: string | null;
  labels: string[];
  values: string[];
}

export interface StatItem {
  label: string;
  value: string;
}

/** Someone's line in one game (`episode` N), or coming in (episode 0, with what it covers in `label`). `key`: "provider:athlete". */
export interface GameLine {
  episode: number;
  key: string;
  label?: string | null;
  tables: LineTable[];
}

/** The season's stages, as the provider says them (sports/types.ts SeasonStage). */
export type Stage = "pre" | "regular" | "post";

const EMPTY = /^(?:-{1,2}|—)?$/;
const WHOLE = /^[+-]?\d+$/;
const PAIR = /^\d+-\d+$/;
/** A race's places listed game by game: the latest this many. */
const LISTED = 5;

/** How a column's values add: "count" (whole numbers), "pair" ("x-y", both whole), or null (they don't). Empty values ("", "-",
 *  "--") are left out; a column of nothing but empties doesn't add. */
export function addsAs(values: string[]): "count" | "pair" | null {
  const v = values.map((x) => x.trim()).filter((x) => !EMPTY.test(x));
  if (!v.length) return null;
  if (v.every((x) => WHOLE.test(x))) return "count";
  if (v.every((x) => PAIR.test(x))) return "pair";
  return null;
}

/** "1st", "2nd", "3rd", "11th", "22nd": a place, written so it never adds. */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
}

/**
 * Someone's games added up: table by table (in the order they first appear), each column that adds, in the provider's order. A
 * count that's half of a pair column ("H" and "AB", of "H-AB") is left to the pair, and a count of 0 is left out (a pair is
 * always kept: "0-4" says something). A table where nothing adds (a race's place) lists its first column game by game, the
 * latest few. Null when nothing's left.
 */
export function addUp(games: LineTable[][]): StatItem[] | null {
  const tables: { name: string | null; labels: string[]; columns: Map<string, string[]> }[] = [];
  for (const game of games) {
    for (const t of game) {
      let x = tables.find((y) => y.name === t.name);
      if (!x) tables.push((x = { name: t.name, labels: [], columns: new Map() }));
      t.labels.forEach((label, i) => {
        if (!x!.columns.has(label)) {
          x!.labels.push(label);
          x!.columns.set(label, []);
        }
        x!.columns.get(label)!.push(t.values[i] ?? "");
      });
    }
  }
  const out: StatItem[] = [];
  for (const t of tables) {
    const kinds = new Map(t.labels.map((l) => [l, addsAs(t.columns.get(l)!)]));
    const halves = new Set(t.labels.filter((l) => kinds.get(l) === "pair").flatMap((l) => l.split("-")));
    const before = out.length;
    for (const label of t.labels) {
      const values = t.columns.get(label)!.map((v) => v.trim()).filter((v) => !EMPTY.test(v));
      const kind = kinds.get(label);
      if (kind === "pair") {
        const [a, b] = values.reduce(([a, b], v) => [a + Number(v.split("-")[0]), b + Number(v.split("-")[1])], [0, 0]);
        out.push({ label, value: `${a}-${b}` });
      } else if (kind === "count" && !halves.has(label)) {
        const sum = values.reduce((n, v) => n + Number(v), 0);
        if (sum) out.push({ label, value: sum > 0 && values.some((v) => v.startsWith("+")) ? `+${sum}` : String(sum) });
      }
    }
    if (out.length === before && !t.labels.some((l) => kinds.get(l)) && t.labels.length) {
      const listed = t.columns.get(t.labels[0])!.filter((v) => !EMPTY.test(v.trim()));
      for (const value of listed.slice(-LISTED)) out.push({ label: "", value });
    }
  }
  return out.length ? out : null;
}

/**
 * Coming in's line from someone's season tables: the first (the provider's main one: a hitter's batting, a pitcher's pitching), in
 * the provider's order, only the columns the season's games show too when there are any (`shown`: the box scores' labels; so a
 * season line's GP, WAR and the like are left out), empties left out. Null when there's nothing.
 */
export function seasonItems(tables: LineTable[], shown: Iterable<string> | null): StatItem[] | null {
  const t = tables[0];
  if (!t) return null;
  const all = t.labels.map((label, i) => ({ label, value: (t.values[i] ?? "").trim() })).filter((x) => !EMPTY.test(x.value));
  const only = shown ? new Set(shown) : null;
  const some = only ? all.filter((x) => only.has(x.label)) : all;
  const items = some.length ? some : all;
  return items.length ? items : null;
}

/**
 * Which season's line is coming in for games in `season`, at `stage` of it: a postseason's own regular season; anything else's,
 * the season before (a regular season's own line holds the very games being shown). `regular`: the provider's season has stages,
 * so the line is its regular season (a soccer league's season has none: it's just "the season").
 */
export function comingInSeason(season: number, stage: Stage | null): { season: number; regular: boolean } {
  return { season: stage === "post" ? season : season - 1, regular: stage !== null };
}

/** What coming in covers, said: "2026 regular season", "2025-26 season". */
export const comingInLabel = (name: string, regular: boolean) => `${name} ${regular ? "regular season" : "season"}`;

export interface StatsView {
  people: Map<string, { comingIn: StatItem[] | null; soFar: StatItem[] | null }>;
  /** So far is through this episode: the latest game up to the mark with any lines; null when there's none. */
  through: number | null;
  comingInLabel: string | null;
}

/**
 * Each person's stats as someone at `mark` may see them: coming in (episode 0) always, and so far, every game from episode 1 to
 * the mark added up (never a game past it). `shown`: every label the season's games show (coming in's columns; a label isn't a
 * spoiler).
 */
export function statsView(lines: GameLine[], mark: number, shown: Iterable<string> | null): StatsView {
  const seen = lines.filter((l) => l.episode >= 1 && l.episode <= mark).sort((a, b) => a.episode - b.episode);
  const people: StatsView["people"] = new Map();
  const games = new Map<string, LineTable[][]>();
  for (const l of seen) games.set(l.key, [...(games.get(l.key) ?? []), l.tables]);
  const labels = shown ? [...shown] : null;
  for (const l of lines) {
    if (l.episode !== 0) continue;
    const comingIn = seasonItems(l.tables, labels);
    if (comingIn) people.set(l.key, { comingIn, soFar: null });
  }
  for (const [key, g] of games) {
    const soFar = addUp(g);
    if (soFar) people.set(key, { comingIn: people.get(key)?.comingIn ?? null, soFar });
  }
  return {
    people,
    through: seen.at(-1)?.episode ?? null,
    comingInLabel: lines.find((l) => l.episode === 0 && l.label && l.tables.length)?.label ?? null,
  };
}
