import StateLogic from "./state-logic.js";
import type { Episode, LeagueState } from "./types";
import { orderPlacementsByEpisode, undoDetail, type LedgerDetail } from "./decision-apply";
import { tableOf, type TableRow } from "./game-view";
import { publicMediaSrc } from "./selectors";

// Results changes, and how each is taken back (docs/PLAN-new-design.md step 5: guards by blast radius, Recent changes).
// Any write that changes an episode's results (Backstage's apply and quick check, classic's eliminations, scoring and
// research routes) records what it did by comparing the episode before and after, so one undo covers every way results
// get in: take off what was added, put back what was removed, and return the episode to its stage. And the two calls
// option 5B makes (2026-10-24): which results are trusted to apply on their own, and which wait for whoever runs the
// game. Pure: the server's league-changes.ts and backstage.ts keep the rows and do the writes.

/** What a results write removed, enough to put it back. */
export type RemovedResult =
  | { kind: "elimination"; castawayId: string; method: string; juryVotes: number | null }
  | { kind: "event"; castawayId: string; eventType: string; units: number | null }
  | { kind: "role"; castawayId: string; role: string }
  | { kind: "group"; castawayId: string; tribeId: string | null }
  | { kind: "exiled"; castawayId: string }
  | { kind: "noexit" };

/** How a results change is taken back (league_changes.undo). */
export interface ResultsUndo {
  type: "results";
  episode: number;
  /** What the write added, as the season sync's ledger records it (decision-apply.ts), so undoDetail takes it off. */
  added: LedgerDetail[];
  removed: RemovedResult[];
  /** The episode's stage before: nothing in yet, early (who went home) or final. */
  stageBefore: "early" | "final" | null;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * What changed in one episode's results between two copies of a league, or null when nothing did. An entry that changed
 * in place (an elimination's method) counts as removed and added again, so the undo restores the old one.
 */
export function resultsDiff(before: LeagueState, after: LeagueState, episode: number): ResultsUndo | null {
  const was = before.episodes.find((e) => e.number === episode);
  const now = after.episodes.find((e) => e.number === episode);
  if (!now && !was) return null;
  const added: LedgerDetail[] = [];
  const removed: RemovedResult[] = [];
  const base = (castawayId: string, kind: LedgerDetail["kind"]): LedgerDetail => ({ episodeNumber: episode, castawayId, kind });

  const pair = <T>(list: (e: Episode | undefined) => T[], key: (x: T) => string) => {
    const a = new Map(list(was).map((x) => [key(x), x]));
    const b = new Map(list(now).map((x) => [key(x), x]));
    return {
      gone: [...a].filter(([k, x]) => !b.has(k) || !same(b.get(k), x)).map(([, x]) => x),
      come: [...b].filter(([k, x]) => !a.has(k) || !same(a.get(k), x)).map(([, x]) => x),
    };
  };

  const outs = pair((e) => e?.events ?? [], (x) => x.castawayId);
  for (const x of outs.gone) removed.push({ kind: "elimination", castawayId: x.castawayId, method: x.method, juryVotes: x.juryVotes ?? null });
  for (const x of outs.come) added.push(base(x.castawayId, "elimination"));

  const events = pair((e) => e?.scoringEvents ?? [], (x) => x.id);
  for (const x of events.gone) removed.push({ kind: "event", castawayId: x.castawayId, eventType: x.type, units: x.units ?? null });
  for (const x of events.come) added.push({ ...base(x.castawayId, "event"), eventType: x.type, eventId: x.id });

  const roles = pair((e) => e?.roles ?? [], (x) => x.castawayId);
  for (const x of roles.gone) removed.push({ kind: "role", castawayId: x.castawayId, role: x.role });
  for (const x of roles.come) added.push(base(x.castawayId, "role"));

  const groups = pair((e) => e?.groups ?? [], (x) => x.castawayId);
  for (const x of groups.gone) removed.push({ kind: "group", castawayId: x.castawayId, tribeId: x.tribeId });
  for (const x of groups.come) added.push(base(x.castawayId, "group"));

  const exiled = pair((e) => (e?.exiled ?? []).map((x) => ({ castawayId: x.castawayId })), (x) => x.castawayId);
  for (const x of exiled.gone) removed.push({ kind: "exiled", castawayId: x.castawayId });
  for (const x of exiled.come) added.push(base(x.castawayId, "exiled"));

  // Nobody went home (step 6c): the episode's mark, with no one to name.
  if (was?.noExit && !now?.noExit) removed.push({ kind: "noexit" });
  if (now?.noExit && !was?.noExit) added.push(base("", "noexit"));

  if (!added.length && !removed.length) return null;
  return { type: "results", episode, added, removed, stageBefore: was ? StateLogic.resultsStage(was) : null };
}

/** Takes a results change back: what it added comes off (newest first), what it removed goes back, and the stage with it. */
export function undoResults(state: LeagueState, undo: ResultsUndo) {
  for (const d of [...undo.added].reverse()) undoDetail(state, d);
  if (undo.removed.length) {
    const ep = StateLogic.ensureEpisodeNumber(state, undo.episode, false);
    for (const r of undo.removed) {
      if (r.kind === "elimination") {
        const c = StateLogic.getCastaway(state, r.castawayId);
        if (c && c.status !== "eliminated") StateLogic.addElimination(state, ep.id, r.castawayId, r.method, r.juryVotes);
      } else if (r.kind === "event") StateLogic.ActiveRosterLogic.addEvent(state, ep.id, r.eventType, r.castawayId, r.units);
      else if (r.kind === "role") StateLogic.addRole(state, ep.id, r.castawayId, r.role);
      else if (r.kind === "group") StateLogic.addGroupChange(state, ep.id, r.castawayId, r.tribeId);
      else if (r.kind === "noexit") StateLogic.setNoExit(state, ep.id, true);
      else StateLogic.addExiled(state, ep.id, r.castawayId);
    }
  }
  if (undo.added.some((d) => d.kind === "elimination") || undo.removed.some((r) => r.kind === "elimination")) orderPlacementsByEpisode(state);
  const ep = state.episodes.find((e) => e.number === undo.episode);
  // "final" takes the mark off, which is also how an episode with nothing in reads.
  if (ep) StateLogic.setResultsStage(state, ep.id, StateLogic.episodeHasResults(ep) && undo.stageBefore === "early" ? "early" : "final");
}

// ---- 5B: what applies on its own ----

/** The quick check's answer (db/bot-research.js parseQuickAnswer): who left, how, and where it was read. */
export interface QuickAnswer {
  found: boolean;
  left: { name: string; how: string | null; matched: boolean }[];
  headline: string | null;
  sources: string[];
}

/** Why a quick check's answer waits for whoever runs the game, in words that name nobody. */
export type QuickDoubt = "not-found" | "nobody" | "unknown-name" | "one-source" | "how";

export const QUICK_DOUBTS: Record<QuickDoubt, string> = {
  "not-found": "It couldn't find anything about this episode yet. Ask again in a few minutes.",
  nobody: "It says nobody went home. Check it before anything applies.",
  "unknown-name": "It named someone we couldn't match to the cast.",
  "one-source": "It found only one source.",
  how: "It wasn't clear how they left.",
};

/** How someone left in the show's own words: the format's exit method `how` names, else null. */
export function exitMethodFor(how: string | null, exitMethods: string[]): string | null {
  if (!how) return exitMethods.find((m) => m !== "Other") ?? null;
  const h = how.trim().toLowerCase();
  return exitMethods.find((m) => m.toLowerCase() === h) ?? exitMethods.find((m) => m !== "Other" && h.includes(m.toLowerCase())) ?? null;
}

/**
 * Whether a quick check applies on its own: it found the episode, everyone it names is someone still in, it says how
 * they left in the show's words, and at least two sources agree. Anything less waits (`doubt`).
 */
export function quickVerdict(q: QuickAnswer, exitMethods: string[]): { trusted: boolean; doubt: QuickDoubt | null; out: { name: string; method: string }[] } {
  const out = q.left.filter((p) => p.matched).map((p) => ({ name: p.name, method: exitMethodFor(p.how, exitMethods) ?? "Other" }));
  const doubt: QuickDoubt | null = !q.found
    ? "not-found"
    : !q.left.length
      ? "nobody"
      : q.left.some((p) => !p.matched)
        ? "unknown-name"
        : q.left.some((p) => !exitMethodFor(p.how, exitMethods))
          ? "how"
          : q.sources.length < 2
            ? "one-source"
            : null;
  return { trusted: !doubt, doubt, out };
}

/** A staged result as the trust rule reads it (season_decisions, episode-research-apply.ts stagedForEpisode). */
export interface StagedRow {
  kind: string;
  castawayName: string;
  confidence: string | null;
  status: string;
}

/**
 * Which staged results apply on their own: high confidence, about someone research didn't contradict itself on
 * (`disputed`, lower case), and, for who went home, agreeing with whoever is already out in that episode (`out`, from
 * the quick check or anything entered before). Everything else waits for whoever runs the game.
 */
export function trustRows<T extends StagedRow>(rows: T[], opts: { disputed?: Set<string>; out?: string[] } = {}): { trusted: T[]; waiting: T[] } {
  const disputed = opts.disputed ?? new Set<string>();
  const out = new Set((opts.out ?? []).map((n) => n.toLowerCase()));
  const trusted: T[] = [];
  const waiting: T[] = [];
  for (const r of rows) {
    if (r.status === "rejected") continue;
    const name = r.castawayName.toLowerCase();
    const ok = r.confidence === "high" && !disputed.has(name) && !(r.kind === "elimination" && out.size && !out.has(name));
    (ok ? trusted : waiting).push(r);
  }
  return { trusted, waiting };
}

// ---- tier 2: what a results change does to the tables ----

export interface PreviewLine {
  /** A player (their account, for the face) or a castaway (their photo). */
  face: { kind: "player"; userId: string | null; name: string } | { kind: "castaway"; name: string; photo: string | null };
  label: string;
  change: string;
  dir: "up" | "down" | null;
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const and = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/**
 * What a results change does to one game, read off its table before and after (game-view.ts tableOf): who goes out and
 * whose team loses them, then each player whose place or score moves, the biggest first. Shown only to whoever runs the
 * game, after they've chosen to see the results.
 */
export function previewLines(before: LeagueState, after: LeagueState, gameName: string, userOf: (playerId: string) => string | null): PreviewLine[] {
  const pieces = StateLogic.piecesOf(after);
  const a = tableOf(before, "", userOf);
  const b = new Map(tableOf(after, "", userOf).map((r) => [r.playerId, r]));
  const lines: PreviewLine[] = [];
  const outBefore = new Set(before.castaways.filter((c) => c.status === "eliminated").map((c) => c.id));
  for (const c of after.castaways.filter((x) => x.status === "eliminated" && !outBefore.has(x.id))) {
    const owners = pieces.hasRoster ? a.filter((r) => r.team.includes(c.id)).map((r) => r.name) : [];
    lines.push({
      face: { kind: "castaway", name: c.name, photo: publicMediaSrc(c.photoUrl) },
      label: `${c.name} out · ${gameName}`,
      change: owners.length ? `${and(owners)} ${owners.length === 1 ? "loses" : "lose"} them` : "",
      dir: null,
    });
  }
  // Nobody went home (step 6c): said once, whatever the game.
  const hadNoExit = (n: number) => !!before.episodes.find((y) => y.number === n)?.noExit;
  for (const e of after.episodes.filter((x) => x.noExit && !hadNoExit(x.number))) {
    lines.push({ face: { kind: "castaway", name: "Nobody", photo: null }, label: `Nobody went home in Episode ${e.number}`, change: "", dir: null });
  }
  const moved: { line: PreviewLine; size: number }[] = [];
  for (const r of a) {
    const n: TableRow | undefined = b.get(r.playerId);
    if (!n) continue;
    const place = n.place !== r.place ? `${n.place < r.place ? "▲" : "▼"} ${n.rank.startsWith("T") ? "T" : ""}${ordinal(n.place)}` : "";
    const pool = pieces.hasWeeklyPicks;
    const delta = pool ? (n.week ?? 0) - (r.week ?? 0) : n.total - r.total;
    if (!place && !delta) continue;
    const score = !delta
      ? ""
      : pool
        ? (r.week ?? 0) > 0 && (n.week ?? 0) === 0
          ? "streak ends"
          : `streak ${r.week ?? 0} → ${n.week ?? 0}`
        : `${delta > 0 ? "+" : ""}${delta}`;
    moved.push({
      line: {
        face: { kind: "player", userId: r.userId, name: r.name },
        label: `${r.name} · ${gameName}`,
        change: [place, score].filter(Boolean).join(", "),
        dir: n.place < r.place ? "up" : n.place > r.place ? "down" : null,
      },
      size: Math.abs(r.place - n.place) * 100 + Math.abs(delta),
    });
  }
  moved.sort((x, y) => y.size - x.size);
  // Everyone gaining the same and nobody changing places (each boot outlasted) is one line, not one each.
  if (moved.length > 1 && moved.length === a.length && moved.every((m) => !m.line.dir && m.line.change === moved[0].line.change)) {
    return [...lines, { face: { kind: "player", userId: null, name: "Everyone" }, label: `Everyone · ${gameName}`, change: `${moved[0].line.change} each`, dir: null }];
  }
  return [...lines, ...moved.map((m) => m.line)];
}
