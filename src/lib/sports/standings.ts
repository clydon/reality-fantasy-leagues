// A league's standings (docs/PLAN-sports-couch.md B1, the Standings tab; the design: docs/design-round/league-standings-spec.md):
// the provider's table read into our own small shape (src/lib/server/sports/espn.ts readStandings), and the pure rules the tab
// draws it by: the order inside a group (the league's own seed, which carries its tiebreaks; soccer's rank), its two views (the
// divisions, or their conferences by seed), the couch's groups first, and the columns each sport reads its table by. The columns
// are the sport's vocabulary (which of ESPN's numbers a fan of it reads first); every number is the provider's.

/** One team's line in its group, as the provider says it. `stats` holds the display values the tab can draw, by our keys. */
export interface StandingEntry {
  team: string;
  short: string;
  abbreviation: string | null;
  color: string | null;
  /** Its wins and losses as numbers, when the provider says (games behind a conference's leader is counted from them). */
  wins: number | null;
  losses: number | null;
  /** Its seed in its top group (the league's order, tiebreaks applied), when the league has one. */
  seed: number | null;
  /** Its place as the provider ranks it (soccer's table), when it says. */
  rank: number | null;
  /** W-L, W-L-T, hockey's W-L-OTL: the provider's summary, else made from its wins and losses. */
  record: string | null;
  stats: Partial<Record<StatKey, string>>;
  /** Clinched a place in the playoffs, or out of them, where the provider marks it (a late season's clinch letters). */
  clinch: "in" | "out" | null;
  /** A soccer table's place note ("Champions League") and its colour (hex, with the #). */
  note: { text: string; color: string | null } | null;
}

export interface StandingGroup {
  id: string;
  name: string;
  short: string | null;
  /** The top group it's in (a division's conference), or null in a league of one level. */
  parent: string | null;
  entries: StandingEntry[];
}

export interface Standings {
  league: string;
  /** The provider's season ("2026", "2026-27"). */
  season: string | null;
  /** The top groups (conferences, MLB's leagues), only in a league of two levels. */
  parents: { id: string; name: string; short: string | null }[];
  /** The groups the provider lists teams in (divisions; a one-level league's conferences or its one table), in its order. */
  groups: StandingGroup[];
  /** When it was read from the provider (ISO). */
  asOf: string;
}

export type StatKey = "pct" | "gb" | "pts" | "gp" | "diff" | "streak" | "l10" | "home" | "road" | "div" | "conf" | "pf" | "pa";

export interface Column {
  key: "record" | StatKey;
  label: string;
  /** The number the sport ranks by (and the record beside it): drawn in ink, the others muted (the check: soccer's P was bold). */
  strong?: boolean;
}

const family = (league: string) => league.split("/")[0];

/** The columns a sport's table is read by, after the team (at most three numbers: the first-view rule R1). */
export function columnsFor(league: string): Column[] {
  switch (family(league)) {
    case "football":
      return [{ key: "record", label: "W-L", strong: true }, { key: "pct", label: "PCT", strong: true }, { key: "diff", label: "DIFF" }];
    case "basketball":
    case "baseball":
      return [{ key: "record", label: "W-L", strong: true }, { key: "pct", label: "PCT" }, { key: "gb", label: "GB", strong: true }];
    case "hockey":
      return [{ key: "record", label: "W-L-OT" }, { key: "pts", label: "PTS", strong: true }];
    case "soccer":
      return [{ key: "gp", label: "P" }, { key: "diff", label: "GD" }, { key: "pts", label: "PTS", strong: true }];
    default:
      return [{ key: "record", label: "W-L", strong: true }, { key: "pts", label: "PTS", strong: true }, { key: "pct", label: "PCT" }];
  }
}

/** The columns a table draws: the sport's, less any the provider gave no team in it. */
export function columnsOf(s: Standings): Column[] {
  const all = s.groups.flatMap((g) => g.entries);
  return columnsFor(s.league).filter((c) => all.some((e) => (c.key === "record" ? e.record : e.stats[c.key]) != null));
}

/** A row's splits, opened in place: the sport's pairs the provider gave, in a fan's order. */
export function splitsOf(e: StandingEntry, league: string): { label: string; value: string }[] {
  const soccer = family(league) === "soccer";
  const pairs: [string, string | null | undefined][] = soccer
    ? [["W-D-L", e.record], ["Home", e.stats.home], ["Away", e.stats.road], ["GF", e.stats.pf], ["GA", e.stats.pa]]
    : [
        ["Home", e.stats.home],
        ["Road", e.stats.road],
        ["Div", e.stats.div],
        ["Conf", e.stats.conf],
        ["Last 10", e.stats.l10],
        [family(league) === "baseball" ? "RS" : family(league) === "hockey" ? "GF" : "PF", e.stats.pf],
        [family(league) === "baseball" ? "RA" : family(league) === "hockey" ? "GA" : "PA", e.stats.pa],
        ["Streak", e.stats.streak],
      ];
  return pairs.filter((p): p is [string, string] => !!p[1] && p[1] !== "-").map(([label, value]) => ({ label, value }));
}

/** A group's teams in the league's own order: by seed when every team has one, else the provider's rank, else as it listed them. */
export function ordered(entries: StandingEntry[]): StandingEntry[] {
  if (entries.length && entries.every((e) => e.seed != null)) return [...entries].sort((a, b) => a.seed! - b.seed!);
  if (entries.length && entries.every((e) => e.rank != null)) return [...entries].sort((a, b) => a.rank! - b.rank!);
  return entries;
}

export type View = "group" | "parent";

/** A table's two views' words ("Division", "Conference"; MLB's "League"), or null for a league of one level. */
export function viewWords(s: Standings): { group: string; parent: string } | null {
  if (!s.parents.length) return null;
  return { group: "Division", parent: s.parents.some((p) => /\bLeague\b/.test(p.name)) ? "League" : "Conference" };
}

/** The view a league's fans read first: its divisions, but basketball's conferences (its divisions decide nothing about seeding). */
export function defaultView(s: Standings): View {
  return s.parents.length && family(s.league) === "basketball" ? "parent" : "group";
}

/** A group as a view draws it: its name, and its teams in order, each with its place there (and, by conference, a division leader). */
export interface ShownGroup {
  id: string;
  name: string;
  /** "Div" (a place in the group) or "Seed" (the conference's seed); "#" for a table. */
  placeWord: string;
  /** `division`: by conference, the division it leads, as its conference says it ("East" for the AFC East). */
  rows: { e: StandingEntry; place: number | null; leader: boolean; division: string | null; gb?: string }[];
}

/** The groups a view shows, in the league's order: the divisions as listed, or each conference's teams by seed. */
export function viewOf(s: Standings, view: View): ShownGroup[] {
  const groups = s.groups.map((g) => ({ ...g, entries: ordered(g.entries) }));
  const table = !s.parents.length;
  if (view === "parent" && s.parents.length) {
    const leads = new Map(groups.filter((g) => g.entries.length).map((g) => [g.entries[0].team, g]));
    return s.parents.map((p) => {
      const entries = ordered(groups.filter((g) => g.parent === p.id).flatMap((g) => g.entries));
      const division = (g: StandingGroup | undefined) => (g ? divisionWord(g.name, p) : null);
      // Games behind the conference's leader (the provider's is behind the division's), where the league counts them.
      const top = entries[0];
      const gb = (e: StandingEntry) => {
        if (e.stats.gb == null || top?.wins == null || top.losses == null || e.wins == null || e.losses == null) return undefined;
        const n = (top.wins - e.wins + (e.losses - top.losses)) / 2;
        return n <= 0 ? "-" : String(n);
      };
      return { id: p.id, name: p.short ?? p.name, placeWord: "Seed", rows: entries.map((e, i) => ({ e, place: e.seed ?? i + 1, leader: leads.has(e.team), division: division(leads.get(e.team)), gb: gb(e) })) };
    });
  }
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    placeWord: table ? "#" : "Div",
    rows: g.entries.map((e, i) => ({ e, place: e.rank ?? i + 1, leader: false, division: null })),
  }));
}

/** A division's name inside its conference: "AFC East" in the AFC, "American League East" in the AL, "Atlantic Division": "East",
 *  "East", "Atlantic". */
export function divisionWord(name: string, parent: { name: string; short: string | null }): string {
  const bare = [parent.name, parent.short].filter((x): x is string => !!x).reduce((n, pre) => (n.startsWith(`${pre} `) ? n.slice(pre.length + 1) : n), name);
  return bare.replace(/\s+Division$/i, "").trim() || name;
}

/**
 * The couch's groups first: those holding your teams, then those holding the couch's (by how many fans), then the rest in the
 * league's order. Only whole groups move; the rows inside never do (the first-view rule R3).
 */
export function couchFirst(groups: ShownGroup[], fansOf: (team: string) => { fans: number; yours: boolean }): ShownGroup[] {
  const weight = (g: ShownGroup) => {
    const f = g.rows.map((r) => fansOf(r.e.team));
    return { yours: f.some((x) => x.yours), fans: f.reduce((n, x) => n + x.fans, 0) };
  };
  return groups
    .map((g, i) => ({ g, i, w: weight(g) }))
    .sort((a, b) => Number(b.w.yours) - Number(a.w.yours) || Number(b.w.fans > 0) - Number(a.w.fans > 0) || (a.w.fans > 0 ? b.w.fans - a.w.fans : 0) || a.i - b.i)
    .map((x) => x.g);
}

/** Every place note a table uses, once, in the table's order (soccer's key under it). */
export function notesOf(s: Standings): { text: string; color: string | null }[] {
  const seen = new Map<string, { text: string; color: string | null }>();
  for (const g of s.groups) for (const e of ordered(g.entries)) if (e.note && !seen.has(e.note.text)) seen.set(e.note.text, e.note);
  return [...seen.values()];
}
