import StateLogic from "./state-logic.js";
import { applyDecision, orderPlacementsByEpisode, type DecisionFact } from "./decision-apply";
import type { GameFormat } from "./formats/index";
import { momentsFor } from "./formats/rulebook-moments.js";
import type { RulebookAliases, RulebookBlocks } from "./formats/rulebook-schema";
import { publicMediaSrc } from "./selectors";
import type { Castaway, LeagueSettings, LeagueState } from "./types";

// The cast's stats for the new design's Cast tab, Tonight's Stats card, the stats page and By the numbers
// (docs/PLAN-new-design.md step 3; the mock's explorer.js and stats.js). For anyone, in a game or not: every number
// is counted from a season's results the way a league holds them, up to the episode the viewer is on.
//
// Two halves, both pure:
//   seasonFacts   a season's accepted decisions (season_decisions), applied to an empty league with the season's
//                 cast (decision-apply.ts, as the classic sync applies them), up to the viewer's episode, so the
//                 engine's own scoring (implied events included: who was voted out, jury votes) counts them.
//   castStats     one viewer's stats from such a state (or from their copy of a league): each castaway's events and
//                 points per episode, counted over an episode range, the stats by their full names from the
//                 rulebook (its moments' labels, as How it works names them), the Stats card's order, and Patterns.
//
// The guard's rules (guard.ts) hold here too: nothing past `seen` is in the state, a secret role (the Traitors')
// is told only for someone who has left by then, and so is any result that would give one away ("As a Traitor,
// voted out a fellow Traitor"; someone the Traitors considered murdering is a Faithful). A role is never a group to
// filter by.

export interface CastRow {
  id: string;
  name: string;
  tribeName: string | null;
  photoUrl: string | null;
}

/**
 * A season's results as a league would hold them: its cast (with its starting groups when the viewer may see them)
 * and every accepted decision up to episode `seen`. `settings` says what scores (a game's points, its format and
 * ownership); without points, the format's suggested ones.
 */
export function seasonFacts(opts: { settings: Partial<LeagueSettings>; cast: CastRow[]; withTribes: boolean; decisions: DecisionFact[]; seen: number }): LeagueState {
  const state = StateLogic.defaultState() as LeagueState;
  // defaultState's points are the default format's: start empty, so migrating fills in this format's.
  Object.assign(state.settings, { eventPoints: {} }, opts.settings);
  StateLogic.migrateLeagueState(state);
  StateLogic.applySeasonCast(state, opts.cast, { withTribes: opts.withTribes });
  const refs = opts.cast.map((c) => ({ id: c.id, name: c.name }));
  // Episode order, eliminations first in each (placements count up in the order they're applied).
  const order = opts.decisions
    .filter((d) => d.episode_number >= 1 && d.episode_number <= opts.seen)
    .sort((a, b) => a.episode_number - b.episode_number || Number(b.kind === "elimination") - Number(a.kind === "elimination"));
  for (const d of order) applyDecision(state, d, refs);
  orderPlacementsByEpisode(state);
  return state;
}

export interface StatDef {
  /** "points", or the event id the results record. */
  key: string;
  /** Its full name, from the rulebook ("Voted with the majority"). */
  name: string;
  /** What a count of it is ("times"; empty for a count of units, like innings). */
  unit: string;
}

export interface CastStat {
  name: string;
  /** The first name, unless two share it. */
  first: string;
  photo: string | null;
  /** Their group now (as far as you've seen), and the one they started in. */
  group: string | null;
  start: string | null;
  /** The episode they left in, and how, when you've seen it. */
  out: number | null;
  how: string | null;
  /** A secret role, only once they've left by your episode. */
  role: string | null;
  /** Over the range asked: points, each stat's count (nonzero only), points per episode (null once out), what was
   *  recorded each episode ([episode, stat key]). */
  points: number;
  counts: Record<string, number>;
  perEp: (number | null)[];
  events: [number, string][];
}

export interface Pattern {
  text: string;
  /** The Rank view that shows it. */
  stat: string;
  filter: string;
}

export interface CastStats {
  /** The last episode counted: where you are, or the last with results if that's earlier. 0: nothing yet. */
  through: number;
  from: number;
  to: number;
  /** "tribe", "castaways": the rulebook's words. */
  groupWord: string;
  castWord: string;
  /** The groups people still in are on now, to group Faces and filter by; empty when there are none. */
  groups: { name: string; colour: string }[];
  /** A secret role is part of this show (shown on someone only once they've left). */
  roles: boolean;
  /** Points first, then every stat anyone has, by its full name. */
  stats: StatDef[];
  /** The stats for Tonight's card, best first: something from your latest episode with one clear leader. */
  featured: string[];
  patterns: Pattern[];
  cast: CastStat[];
}

export interface StatsBook {
  blocks: RulebookBlocks;
  aliases: RulebookAliases;
}

const POINTS: StatDef = { key: "points", name: "Points", unit: "points" };
const round = (n: number) => StateLogic.roundPoints(n);

/** Answers a format's role decisions read: research answers whose rules record a role ("became a Traitor"). */
function roleAnswers(format: GameFormat): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (typeof o.answer === "string") out.add(o.answer);
    Object.values(o).forEach(walk);
  };
  for (const r of format.data?.rules?.research ?? []) if ((r as { stage?: string }).stage === "role") walk((r as { when?: unknown }).when);
  return out;
}

/**
 * The results that give away someone's secret role: any a rule awards by testing a role (a fact, a role answer, a
 * vote by role), any whose name says one ("As a Traitor…", "…by the Traitors…"), and the secret role's own moments.
 */
export function secretEvents(format: GameFormat, book: StatsBook | null): Set<string> {
  const out = new Set<string>();
  if (!format.roles) return out;
  const answers = roleAnswers(format);
  const mentionsRole = (v: unknown): boolean => {
    if (!v || typeof v !== "object") return false;
    const o = v as Record<string, unknown>;
    if (o.fact === "role" || "whenRole" in o || "isRole" in o || "notRole" in o) return true;
    if (typeof o.answer === "string" && answers.has(o.answer)) return true;
    return Object.values(o).some(mentionsRole);
  };
  for (const r of [...(format.data?.rules?.research ?? []), ...(format.data?.rules?.implied ?? [])] as Record<string, unknown>[]) {
    if (!mentionsRole(r)) continue;
    for (const k of ["award", "otherwise", "roleOnRole", "otherOnRole", "roleOnOther", "otherOnOther"]) if (typeof r[k] === "string") out.add(r[k] as string);
  }
  const says = rolesNamed(format, book)!;
  for (const e of format.events) if (says.test(e.label)) out.add(e.id);
  if (book) {
    const twists = (book.blocks.twists ?? []).filter((t) => t.type === "secretRole").map((t) => t.id);
    for (const m of momentsFor(book.blocks)) {
      if (says.test(m.label) || (m.from.twist && twists.includes(m.from.twist))) out.add(book.aliases?.events?.[m.id] ?? m.id);
    }
  }
  return out;
}

/** Matches a name that says a secret role ("Traitor", "the Traitors", "Faithful"); null for a show without one. */
function rolesNamed(format: GameFormat, book: StatsBook | null): RegExp | null {
  if (!format.roles) return null;
  const twists = (book?.blocks.twists ?? []).flatMap((t) => (t.type === "secretRole" ? t.roles : []));
  const names = new Set([format.roles.default, ...format.roles.values.map((v) => format.roles!.roleFor(v)), ...twists]);
  return new RegExp(`\\b(${[...names].map((n) => n.replace(/[^\w ]/g, "")).join("|")})s?\\b`, "i");
}

/** Every stat the results can count, by its full name: the rulebook's moments (not the ways out: Faces says who's
 *  out), then any recorded event the rulebook doesn't name. */
function statDefs(format: GameFormat, book: StatsBook | null): StatDef[] {
  const known = new Set(format.events.map((e) => e.id));
  const defs: StatDef[] = [];
  const add = (d: StatDef) => known.has(d.key) && !defs.some((x) => x.key === d.key) && defs.push(d);
  if (book) {
    for (const m of momentsFor(book.blocks)) {
      if (m.from.wayOut) continue;
      add({ key: book.aliases?.events?.[m.id] ?? m.id, name: m.label, unit: m.ask && (m.ask.type === "integer" || m.ask.type === "number") ? "" : "times" });
    }
  }
  for (const e of format.events) if (!e.implied) add({ key: e.id, name: e.label, unit: "times" });
  return defs;
}

const firstNames = (cast: Castaway[]) => {
  const count = new Map<string, number>();
  for (const c of cast) {
    const f = c.name.split(" ")[0];
    count.set(f, (count.get(f) ?? 0) + 1);
  }
  return (c: Castaway) => (count.get(c.name.split(" ")[0])! > 1 ? c.name : c.name.split(" ")[0]);
};

const clampInt = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = v == null || v === "" ? NaN : Number(v);
  return Number.isInteger(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

/**
 * One viewer's cast stats from `state` (seasonFacts, or their copy of a league at their mark), through episode
 * `seen` (Infinity: everything), counted over Episodes from..to (clamped to what's counted). `colours`: a game's own
 * group colours by name, so a group looks the same here as in its tables.
 */
export function castStats(state: LeagueState, opts: { seen: number; book: StatsBook | null; from?: unknown; to?: unknown; colours?: Record<string, string> }): CastStats {
  const format = StateLogic.formatOf(state);
  const through = Math.max(0, Math.min(opts.seen, StateLogic.SpoilerLogic.latestWithResults(state)));
  const from = through ? clampInt(opts.from, 1, through, 1) : 0;
  const to = through ? clampInt(opts.to, from, through, through) : 0;
  const epNumber = new Map(state.episodes.map((e) => [e.id, e.number]));
  const secret = secretEvents(format, opts.book);
  // A show with a secret role has groups only if its format has real ones, and never one named for a role: a
  // season's cast can carry the faction as its "tribe" (the Traitors' wiki table), which would tell everyone.
  const says = rolesNamed(format, opts.book);
  const secretGroup = (name: string) => !!says && (!format.hasGroups || says.test(name));
  const tribes = new Map(state.tribes.filter((t) => !secretGroup(t.name)).map((t) => [t.id, t]));
  const groupOf = (id: string | null | undefined) => (id ? (tribes.get(id)?.name ?? null) : null);
  const outOf = (c: Castaway) => {
    const n = c.status === "eliminated" && c.exitEpisodeId ? (epNumber.get(c.exitEpisodeId) ?? null) : null;
    return n !== null && n <= through ? n : null;
  };

  // What each castaway did, episode by episode, as far as you may know it.
  type Did = { ep: number; type: string; units: number; points: number };
  const did = new Map<string, Did[]>(state.castaways.map((c) => [c.id, []]));
  const out = new Map(state.castaways.map((c) => [c.id, outOf(c)]));
  for (const ep of state.episodes) {
    if (ep.number < 1 || ep.number > through) continue;
    for (const ev of StateLogic.ActiveRosterLogic.episodeEvents(state, ep)) {
      const list = did.get(ev.castawayId);
      if (!list || (secret.has(ev.type) && out.get(ev.castawayId) === null)) continue;
      list.push({ ep: ep.number, type: ev.type, units: ev.units ?? 1, points: StateLogic.ActiveRosterLogic.eventPoints(state, ev) });
    }
  }

  const happened = new Set([...did.values()].flat().map((d) => d.type));
  const stats = [POINTS, ...statDefs(format, opts.book).filter((s) => happened.has(s.key))];
  const statKeys = new Set(stats.map((s) => s.key));
  const first = firstNames(state.castaways);
  const cast: CastStat[] = state.castaways.map((c) => {
    const left = out.get(c.id) ?? null;
    const mine = did.get(c.id)!.filter((d) => d.ep >= from && d.ep <= to);
    const counts: Record<string, number> = {};
    for (const d of mine) if (statKeys.has(d.type)) counts[d.type] = round((counts[d.type] ?? 0) + d.units);
    const perEp = Array.from({ length: to - from + 1 }, (_, i) => from + i).map((n) =>
      left !== null && n > left ? null : round(mine.filter((d) => d.ep === n).reduce((a, d) => a + d.points, 0))
    );
    return {
      name: c.name,
      first: first(c),
      photo: publicMediaSrc(c.photoUrl),
      group: groupOf(c.tribeId),
      start: groupOf(c.startTribeId === undefined ? c.tribeId : c.startTribeId),
      out: left,
      how: left !== null ? c.exitMethod || null : null,
      role: left !== null && format.roles ? StateLogic.roleOf(state, c.id) : null,
      points: round(mine.reduce((a, d) => a + d.points, 0)),
      counts,
      perEp: through ? perEp : [],
      events: mine.filter((d) => statKeys.has(d.type)).map((d) => [d.ep, d.type] as [number, string]),
    };
  });

  const stillIn = cast.filter((c) => c.out === null);
  const groups = [...tribes.values()]
    .filter((t) => stillIn.some((c) => c.group === t.name))
    .map((t) => ({ name: t.name, colour: opts.colours?.[t.name.toLowerCase()] ?? t.color }));
  const blocks = opts.book?.blocks;
  return {
    through,
    from,
    to,
    groupWord: blocks?.cast.groups?.singular ?? format.terms.tribe.toLowerCase(),
    castWord: blocks?.cast.plural ?? `${format.terms.castaway.toLowerCase()}s`,
    groups,
    roles: !!format.roles,
    stats,
    featured: featured(stats, cast, to),
    patterns: patterns(cast, groups, opts.book),
    cast,
  };
}

/** The Stats card's order: a stat from your latest episode with one clear leader on two or more, then any clear
 *  leader, then the rest by how many the leader has. Points aren't a stat of the week. */
function featured(stats: StatDef[], cast: CastStat[], latest: number): string[] {
  const ranked = stats
    .filter((s) => s.key !== POINTS.key)
    .map((s, i) => {
      const ns = cast.map((c) => c.counts[s.key] ?? 0).sort((a, b) => b - a);
      const clear = ns[0] >= 2 && ns[0] > (ns[1] ?? 0);
      const fresh = cast.some((c) => c.events.some(([ep, k]) => ep === latest && k === s.key));
      return { key: s.key, score: (clear && fresh ? 2 : 0) + (clear ? 1 : 0), top: ns[0] ?? 0, i };
    })
    .filter((s) => s.top > 0);
  return ranked.sort((a, b) => b.score - a.score || b.top - a.top || a.i - b.i).map((s) => s.key);
}

const lc = (s: string) => (s && !/^[A-Z]{2}/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const one = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * What the numbers show without being asked, each a Rank view that shows it (at most three), from the rulebook's
 * shape rather than one show's names: how the groups compare on a group win; how many people voted out had votes
 * against them before; how many who got an advantage are still in.
 */
function patterns(cast: CastStat[], groups: { name: string }[], book: StatsBook | null): Pattern[] {
  if (!book) return [];
  const found: Pattern[] = [];
  const ev = (id: string) => book.aliases?.events?.[id] ?? id;
  const n = (c: CastStat, key: string) => c.counts[key] ?? 0;
  const live = cast.filter((c) => c.out === null);

  // A group win: the group whose members (still in) have the fewest, against the most.
  const groupWin = momentsFor(book.blocks).find((m) => m.from.segment && m.id.endsWith("GroupWon"));
  if (groupWin && groups.length > 1) {
    const key = ev(groupWin.id);
    const avg = groups
      .map((g) => {
        const members = live.filter((c) => c.group === g.name);
        return { g: g.name, a: members.reduce((x, c) => x + n(c, key), 0) / members.length };
      })
      .sort((x, y) => x.a - y.a);
    const [low, high] = [avg[0], avg[avg.length - 1]];
    if (high.a > low.a) found.push({ text: `${groupWin.label}: ${low.g}'s members have the fewest (${one(low.a)} each, vs ${one(high.a)} on ${high.g})`, stat: key, filter: low.g });
  }

  // Voted out with a warning: survived votes against them in an earlier episode.
  for (const way of book.blocks.waysOut) {
    const seg = way.cause && typeof way.cause === "object" ? book.blocks.segments.find((s) => s.id === (way.cause as { segment: string }).segment) : null;
    if (way.means !== "out" || seg?.decidedBy !== "vote") continue;
    const survived = momentsFor(book.blocks).find((m) => m.from.segment === seg.id && m.id.endsWith("SurvivedVotes"));
    const method = book.aliases?.exits?.[way.id] ?? way.name;
    const gone = cast.filter((c) => c.out !== null && c.how === method);
    if (!survived || !gone.length) continue;
    const key = ev(survived.id);
    const warned = gone.filter((c) => c.events.some(([e, k]) => k === key && e < c.out!));
    // Two ways out recorded as one exit (the Traitors' banishments, by role) are told by where they happen.
    const shared = book.blocks.waysOut.filter((w) => (book.aliases?.exits?.[w.id] ?? w.name) === method).length > 1;
    const how = shared ? `out at the ${seg.name.replace(/^the /i, "")}` : lc(way.name);
    found.push({ text: `${warned.length} of ${gone.length} ${book.blocks.cast.plural} ${how} had received votes before`, stat: key, filter: "all" });
    break;
  }

  // Advantages: how many who got one are still in.
  for (const t of book.blocks.twists ?? []) {
    if (t.type !== "advantage") continue;
    const got = momentsFor(book.blocks).find((m) => m.id === `${t.id}Got`);
    if (!got) continue;
    const key = ev(got.id);
    const holders = cast.filter((c) => n(c, key) > 0);
    if (holders.length) found.push({ text: `${holders.filter((c) => c.out === null).length} of ${holders.length} who got ${t.oneIsCalled} are still in`, stat: key, filter: "all" });
  }
  return found.slice(0, 3);
}
