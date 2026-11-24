import type * as GalleryModule from "@/lib/game/start-gallery/index.js";
import type { Base, PageFacts, Spec } from "@/lib/game/start-gallery/index.js";
import type { MadeGame } from "@/lib/server/made-games";
import type { Home, WizardOptions } from "../../data";
import { dayDiff, lockTime } from "../../clock";
import { epName, type GameLabel } from "@/lib/game/show-words";

// Start a game's gallery, the screens' model (docs/design-round/wizard-r2-spec.md; Round 2 of the redo): what the gallery's screens
// read from the wizard's own page (start-spec.ts wizardOptions: the season's ctx and pack, its made-for games, its starts, how a
// game can run) and the home read (the couch's marks), worked out once: the show's stages with their short start names, the
// lengths a base can take (each checked by the engine), the strip of the season, when moves lock and who it would cost, search,
// and the community's games. The rules themselves are the catalog's (src/lib/game/start-gallery) and the engine's; nothing here
// decides what a game can be.

export type G = typeof GalleryModule;
export type Span = { from: number | { phase: string }; to: number | { phase: string } | null };
export type Pace = WizardOptions["runs"]["choices"][number];

/** A stage of the season: its id, its name, its short start name (research's; until research writes one, a stand-in), the
 *  episode it starts with when research has dated it, and whether it's the one on now. */
export interface Stage {
  id: string;
  name: string;
  start: string;
  at: number | null;
  now: boolean;
}

// TEMP (Round 2, until research writes a stage's short start name: the user's decision, 2026-11-17): the frames' stand-ins.
const START_NAMES: Record<string, string> = { merged: "the merge", merge: "the merge", "post-merge": "the merge" };

export interface Input {
  seasonId: string;
  label: string;
  show: string;
  ep: string;
  eps: string;
  pg: PageFacts;
  /** The next episode to air (or where you are, at your own pace). */
  from: number;
  aired: number;
  /** The season's last episode, only when it's known (never the last one listed). */
  total: number | null;
  listed: { number: number; airAt: string | null }[];
  stages: Stage[];
  runs: WizardOptions["runs"];
  ownPace: boolean;
  made: MadeGame[];
  tells: number;
  asksLeft: number | null;
  couch: { id: string | null; name: string; members: number };
  marks: { userId: string; name: string; seen: number; you: boolean }[];
  sport: boolean;
  /** Step 2.7 (docs/PLAN-sports-ready.md): a sport's season that goes on into its playoffs: where its regular season ends (`fantasy`
   *  for a game scored by players' stats: the NFL's Week 17) and its final's name ("the Super Bowl"); else null. */
  playoffs: { through: number; fantasy: number; final: string } | null;
  nouns: Nouns;
  /** A team's season: each game's name (show-words.ts epName); absent for a show. */
  names?: Record<number, GameLabel> | null;
}

const plain = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;

/** The gallery's input, from the wizard's page and the home read. */
export function inputOf(o: WizardOptions, home: Home | undefined, couchId: string | null, gm: G): Input | null {
  const wz = o.wizard;
  if (!wz) return null;
  const pack = wz.page.pack;
  const ctx = wz.page.ctx;
  const aired = typeof pack.episodes?.aired === "number" ? pack.episodes.aired : 0;
  const total = typeof pack.episodes?.total === "number" ? pack.episodes.total : null;
  const pg = gm.pageFacts(wz.page, { show: o.label });
  const starts = new Map((pack.phases ?? []).map((p) => [p.id, typeof p.starts === "number" ? p.starts : null]));
  const phases = (ctx.phases ?? []).filter((p) => p && p.id);
  const from = o.from;
  const stages: Stage[] = phases.map((p, i) => {
    const at = i === 0 ? 1 : starts.get(p.id) ?? o.phases.find((x) => x.id === p.id)?.at ?? null;
    const named = (p as { startName?: string }).startName;
    return { id: p.id, name: p.name ?? p.id, start: named || START_NAMES[p.id] || (p.name ?? p.id), at, now: false };
  });
  // The stage on now: the last whose start is dated at or before the next episode.
  let now = 0;
  stages.forEach((s, i) => {
    if (s.at != null && s.at <= Math.max(1, from)) now = i;
  });
  if (stages[now]) stages[now].now = true;
  const couch = home?.couches.find((c) => c.id === couchId) ?? null;
  const me = home?.user;
  const show = home?.shows.find((s) => s.seasonId === o.seasonId);
  const myMark = show && typeof show.seenThrough === "number" ? show.seenThrough : null;
  const marks = (couch?.members ?? [])
    .map((m) => ({ userId: m.userId, name: m.name, seen: m.userId === me?.id ? myMark : m.at?.[o.seasonId] ?? null, you: m.userId === me?.id }))
    .filter((m): m is { userId: string; name: string; seen: number; you: boolean } => typeof m.seen === "number");
  return {
    seasonId: o.seasonId,
    label: o.label,
    show: plain(o.show),
    ep: o.part.singular,
    eps: o.part.plural,
    pg,
    from,
    aired,
    total,
    listed: o.starts.map((e) => ({ number: e.number, airAt: e.airAt ?? null })),
    stages,
    runs: o.runs,
    ownPace: o.ownPace,
    made: wz.made,
    tells: wz.tells,
    asksLeft: wz.asksLeft,
    couch: o.couch,
    marks,
    sport: !!o.sport,
    playoffs: o.sport?.playoffs ?? null,
    nouns: nounsOf({ show: o.show }, (pack as { words?: { person?: string; people?: string; group?: string } }).words),
    names: (show ?? home?.couchShows?.find((s) => s.seasonId === o.seasonId))?.gameNames ?? null,
  };
}

// ---------- words ----------

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** An episode by name: a team's game ("Chiefs at Bills"; "KC @ BUF" as a tag), else the input's word and number as before. */
export function epOf(input: Pick<Input, "ep" | "names">, n: number, form: "long" | "short" | "tag" | "col" = "short"): string {
  if (form === "tag") return epName({ episode: "Episode", ep: "Ep", names: input.names }, n, "tag");
  const E = cap(input.ep);
  return epName({ episode: E, ep: E, names: input.names }, n, form);
}
/** "Wed 18", "Thu 26": an episode's air date, short, for the strip. */
export function shortDate(airAt: string | null): string | null {
  const t = airAt ? Date.parse(airAt) : NaN;
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.getDate()}`;
}
/** "Wed 8 PM": a lock, for Start's line. */
export function lockWords(airAt: string | null): string | null {
  const t = airAt ? Date.parse(airAt) : NaN;
  if (!Number.isFinite(t)) return null;
  const d = dayDiff(t);
  return d === 0 ? `tonight ${lockTime(t).replace(/^\w+ /, "").replace(":00", "")}` : lockTime(t).replace(":00", "");
}

/** A stage's start name in a chip: "the merge", else its name. */
export const startOf = (st: Stage) => st.start;

// ---------- how long ----------

export interface Length {
  id: string;
  label: string;
  span: Span;
  ok: boolean;
  why: string | null;
  /** The engine's whole reason, said when the dashed chip is tapped. */
  full: string | null;
}

/** The lengths a base can take from here, from the show's own stages (the user, 2026-11-17): just the next episode, until each
 *  stage still to come, from it, a middle stage alone, the rest of the season. Each checked by our engine with the base. */
export function lengthsOf(spec: Spec | null, input: Input, gm: G): Length[] {
  const { from, stages } = input;
  const later = stages.filter((s, i) => i > 0 && !(s.at != null && s.at <= from));
  const out: { id: string; label: string; span: Span }[] = [{ id: "next", label: `Just ${epOf(input, from)}`, span: { from, to: from } }];
  if (later.length === 1) {
    out.push({ id: `until:${later[0].id}`, label: `Till ${startOf(later[0])}`, span: { from, to: { phase: later[0].id } } });
    out.push({ id: `from:${later[0].id}`, label: `From ${startOf(later[0])}`, span: { from: { phase: later[0].id }, to: null } });
  } else if (later.length > 1) {
    out.push({ id: `until:${later[0].id}`, label: `Till ${startOf(later[0])}`, span: { from, to: { phase: later[0].id } } });
    for (let i = 0; i < later.length; i++) {
      const s = later[i];
      const next = later[i + 1];
      out.push(next ? { id: `just:${s.id}`, label: `Just ${startOf(s)}`, span: { from: { phase: s.id }, to: { phase: next.id } } } : { id: `from:${s.id}`, label: `From ${startOf(s)}`, span: { from: { phase: s.id }, to: null } });
    }
  }
  // Most wanted first (the user's U0 rule): the next episode, the season, then the stages.
  // Step 2.7: a sport's season that goes on into its playoffs, its regular season (the default) and through its final, in place of the
  // rest of the season; started in the playoffs, through the final alone.
  const reg = regularTo(input, spec);
  if (input.playoffs) out.splice(1, 0, ...(reg !== null ? [{ id: "regular", label: "Regular season", span: { from, to: reg } }] : []), { id: "final", label: `Through ${input.playoffs.final}`, span: { from, to: null } });
  else out.splice(1, 0, { id: "rest", label: input.ownPace ? "The whole season" : "The rest of the season", span: { from, to: null } });
  return out.map((l) => {
    if (!spec) return { ...l, ok: true, why: null, full: null };
    // A game in stages runs over its stages (withSpan moves only its first stage's start): any other length would look chosen and
    // change nothing (the review, B1).
    if (Array.isArray(spec.stages) && l.id !== "rest") {
      const full = "A game in stages runs over its own stages";
      return { ...l, ok: false, why: shortWhy(full), full };
    }
    const s = withSpan(spec, l.span);
    const v = gm.check(s, input.pg);
    const full = v.ok ? null : v.problems[0] || v.waits[0] || "";
    return { ...l, ok: v.ok, why: full ? shortWhy(full) : null, full };
  });
}
/** A spec on a span (a game in stages keeps its own; its first stage starts at the span's start). */
export function withSpan(spec: Spec, span: Span): Spec {
  if (Array.isArray(spec.stages)) {
    const stages = spec.stages.map((st, i) => (i === 0 && typeof span.from === "number" ? { ...st, game: { ...st.game, span: { ...(st.game.span ?? {}), from: span.from } as Spec["span"] } } : st));
    return { ...spec, stages };
  }
  return { ...spec, span: { from: span.from, to: span.to } };
}
/** The engine's reason, shortened for a chip: its first clause. */
export function shortWhy(why: string): string {
  const s = why.replace(/\s*\(.*?\)\s*/g, " ").split(/[:;.]/)[0].trim();
  return s.length > 44 ? `${s.slice(0, 42).trim()}…` : s;
}
/**
 * Step 2.7: where a game's regular season ends on a sport's season that goes on into its playoffs: its last regular episode (the
 * fantasy season's for a game scored by players' stats: the NFL's Week 17), no earlier than the start; null when the start is past it
 * (in the playoffs), or for any other season.
 */
export function regularTo(input: Pick<Input, "from" | "playoffs">, spec: Spec | null): number | null {
  const po = input.playoffs;
  if (!po) return null;
  const stats = (spec?.score as { by?: string } | undefined)?.by === "stats";
  const end = stats && po.fantasy >= input.from ? po.fantasy : po.through;
  return end >= input.from ? end : null;
}

/** Which length a span is, for the chips. */
export function lengthId(span: Span | undefined, input: Input): string {
  if (!span) return input.playoffs ? "regular" : "rest";
  const f = span.from;
  const t = span.to;
  if (typeof f === "number" && t === f) return "next";
  // Step 2.7: a sport's season that goes on into its playoffs: through the final (no end), or its regular season.
  if (input.playoffs && typeof f === "number" && t === null) return "final";
  if (input.playoffs && typeof f === "number" && (t === input.playoffs.through || t === input.playoffs.fantasy)) return "regular";
  if (typeof f === "number" && t === null) return "rest";
  if (typeof f === "number" && t && typeof t === "object") return `until:${t.phase}`;
  if (f && typeof f === "object" && t === null) return `from:${f.phase}`;
  if (f && typeof f === "object" && t && typeof t === "object") return `just:${f.phase}`;
  void input;
  return "custom";
}

/** The strip: the aired run folded into one cell, the listed episodes with their dates, the rest, the finale; each cell marked when
 *  it's in the game's stretch, the stages over their runs. */
export interface Cell {
  key: string;
  top: string;
  under: string;
  aired?: boolean;
  in: boolean;
  stage: string | null;
  gap?: boolean;
}
export function stripOf(input: Input, span: Span): { cells: Cell[]; stages: { id: string; label: string; under: string; cells: number }[] } {
  const { from, aired, listed, stages, total } = input;
  const at = (id: string) => stages.find((s) => s.id === id)?.at ?? null;
  const fromN = typeof span.from === "number" ? span.from : at(span.from.phase);
  const toN = span.to === null ? Infinity : typeof span.to === "number" ? span.to : (() => {
    const a = at(span.to.phase);
    return a != null ? a - 1 : -1;
  })();
  const waits = typeof span.from === "object" && fromN == null;
  const inRange = (n: number) => !waits && fromN != null && n >= fromN && n <= toN;
  const stageOfN = (n: number) => {
    let s: string | null = stages[0]?.id ?? null;
    for (const st of stages) if (st.at != null && st.at <= n) s = st.id;
    return s;
  };
  const cells: Cell[] = [];
  // At your own pace on a season that's aired, the game is those episodes: one cell, in the stretch from where it starts.
  if (input.ownPace && total != null && aired >= total) {
    const f = typeof span.from === "number" ? span.from : 1;
    const t = typeof span.to === "number" ? span.to : total;
    if (f > 1) cells.push({ key: "before", top: f > 2 ? `1–${f - 1}` : "1", under: "seen", aired: true, in: false, stage: stageOfN(1) });
    cells.push({ key: "out", top: f === t ? String(f) : `${f}–${t}`, under: "all out", in: true, stage: stageOfN(f) });
    if (t < total) cells.push({ key: "after", top: t + 1 === total ? String(total) : `${t + 1}–${total}`, under: "not in it", in: false, stage: stageOfN(total) });
    return { cells, stages: [] };
  }
  if (aired > 0) cells.push({ key: "aired", top: aired > 1 ? `1–${aired}` : "1", under: "aired", aired: true, in: false, stage: stageOfN(aired) });
  const shown = listed.filter((e) => e.number >= from).slice(0, 2);
  for (const e of shown) cells.push({ key: `e${e.number}`, top: epOf(input, e.number, "col"), under: shortDate(e.airAt) ?? "date not out", in: inRange(e.number), stage: stageOfN(e.number) });
  const lastShown = shown.length ? shown[shown.length - 1].number : from - 1;
  const undated = stages.find((s, i) => i > 0 && s.at == null);
  const restIn = !waits && (toN === Infinity || toN > lastShown + 1);
  if (total == null || total - lastShown > 1) {
    const restStage = undated ? undated.id : stageOfN(lastShown + 1);
    const laterStart = typeof span.from === "object" && waits;
    cells.push({ key: "rest", top: "…", under: laterStart ? "waits for it" : "the rest", gap: true, in: restIn || laterStart, stage: restStage });
  }
  cells.push({ key: "finale", top: "Finale", under: total ? epOf(input, total, "tag") : "no date", in: toN === Infinity && !waits ? true : waits ? span.to === null : false, stage: stages.length ? stages[stages.length - 1].id : null });
  const runs: { id: string; label: string; under: string; cells: number }[] = [];
  for (const c of cells) {
    const last = runs[runs.length - 1];
    if (last && last.id === c.stage) last.cells++;
    else {
      const st = stages.find((s) => s.id === c.stage);
      const first = stages[0]?.id === c.stage;
      runs.push({ id: c.stage ?? "", label: st ? (first ? st.name : `From ${st.start}`) : "", under: st ? (st.now ? "now" : st.at == null ? "no date yet" : epOf(input, st.at, "tag")) : "", cells: 1 });
    }
  }
  return { cells, stages: stages.length > 1 ? runs : [] };
}

/** Start's line: the stretch and the first lock ("Episode 9 to the finale · picks by Wed 8 PM"). */
export function stretchLine(span: Span, input: Input): string {
  const st = (id: string) => input.stages.find((s) => s.id === id);
  const f = span.from;
  const t = span.to;
  const fromWords = typeof f === "number" ? epOf(input, f) : `From ${st(f.phase) ? startOf(st(f.phase)!) : f.phase}`;
  if (typeof f === "number" && t === f) return `Just ${epOf(input, f)}`;
  const toWords = t === null ? "the finale" : typeof t === "number" ? epOf(input, t) : `${st(t.phase) ? startOf(st(t.phase)!) : t.phase}`;
  return typeof f === "number" ? `${fromWords} to ${toWords}` : `${fromWords} to ${toWords}`;
}

// ---------- when moves lock ----------

/** What a lock costs someone behind, in one wording for the closed line and the opened choice. */
export function costWords(m: Pace, b: { name: string; behind: number }, input: Input): string {
  if (m === "strict") return `${b.name} is ${b.behind} ${b.behind === 1 ? input.ep : input.eps} behind and would choose before seeing ${b.behind === 1 ? "it" : "them"}.`;
  return `${b.name} is ${b.behind} ${input.eps} behind: they'd have to catch up before ${epOf(input, input.from + 1)} airs, or miss moves.`;
}

export interface LockState {
  value: Pace;
  recommended: Pace;
  choices: Pace[];
  /** A start at a stage, or a game in stages: it can't wait for people yet. */
  phased: boolean;
  /** Someone the setting would cost a move, and how far behind they are. */
  costs: { name: string; behind: number } | null;
  behind: { name: string; behind: number; seen: number }[];
}
/** When moves lock for this game: today's choices and defaults (start-game.ts runs), whether a stage start rules out waiting, and
 *  who on the couch would miss moves (the user's pick, 2026-11-17: named closed only when it costs them). */
export function lockOf(spec: Spec | null, span: Span, input: Input, chosen: Pace | null): LockState {
  const ownTeams = !!spec && spec.get?.by === "draft" && spec.get.own !== "shared";
  // A game played alone or only with computer players (nobody else told: tellsLine's "Just you for now"): a sport's waits for you
  // (runs.alone, docs/PLAN-sports-ready.md step 2.6), whatever its teams; live for a league of people.
  const alone = input.tells === 0 && input.runs.alone ? input.runs.alone : null;
  const recommended: Pace = input.ownPace ? "own" : (alone ?? (ownTeams ? input.runs.exclusive : input.runs.recommended));
  const phased = typeof span.from === "object" || Array.isArray(spec?.stages);
  let value = chosen ?? recommended;
  if (phased && value === "own") value = "live";
  const behind = input.marks.filter((m) => !m.you && input.aired - m.seen > 0).map((m) => ({ name: m.name, behind: input.aired - m.seen, seen: m.seen })).sort((a, b) => b.behind - a.behind);
  const cut = value === "live" ? behind.filter((b) => b.behind >= 2) : value === "strict" ? behind : [];
  return { value, recommended, choices: input.ownPace ? ["own"] : input.runs.choices, phased, costs: cut[0] ?? null, behind };
}

// ---------- search ----------

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
const SYN: Record<string, string[]> = {
  head: ["h2h", "versus", "vs"], bet: ["betting", "wager", "stake", "bank", "parlay", "pot"], team: ["teams", "draft", "fantasy"],
  cry: ["cries", "crying", "tears"], cries: ["cry", "crying"], watch: ["outlast"], pick: ["pool", "picks"], guess: ["predict", "prediction", "call"],
  draft: ["pick", "team"], quiz: ["trivia"], solo: ["alone", "me"], bot: ["computer"],
};
/** Bases that match what was typed, best first: a word in the name counts most, then the line, then the screen's sentences. A
 *  sentence (four words or more) is also something to describe. */
const STOP = new Set(["a", "an", "the", "to", "of", "and", "or", "in", "on", "for", "with", "my", "our", "i", "we", "each", "who", "what", "game", "games"]);
export function searchBases(q: string, bases: Base[]): { base: Base; score: number }[] {
  const ws = words(q).filter((w) => !STOP.has(w));
  if (!ws.length) return [];
  const phrase = words(q).join(" ");
  const all = new Set(ws.flatMap((w) => [w, ...(SYN[w] ?? [])]));
  const out: { base: Base; score: number }[] = [];
  for (const b of bases) {
    let score = 0;
    const name = words(b.name);
    const line = words(b.plain);
    const about = words(b.about);
    for (const w of all) {
      if (name.some((x) => x.startsWith(w))) score += 5;
      if (line.some((x) => x.startsWith(w))) score += 2;
      if (about.some((x) => x.startsWith(w))) score += 1;
    }
    if (phrase.length > 3 && words(b.name).join(" ").includes(phrase)) score += 12;
    if (score) out.push({ base: b, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 6);
}
export const isSentence = (q: string) => words(q).length >= 4;

// ---------- the community ----------

export interface Community {
  i: number;
  name: string;
  hook: string;
  base: Base | null;
  badge: string;
  spec: Spec;
  ours: boolean;
  bet: boolean;
  /** Made up for the frames: how many saved it, and couches that played it (no community yet). */
  saves: number;
  couches: number;
}
/** The base a made-for game is (its kind, then what it asks or how it scores and wins): what its row and screen lead with. */
export function baseFor(spec: Spec, bases: Base[], gm: G): Base | null {
  const by = (id: string) => bases.find((b) => b.id === id) ?? null;
  const s = spec.preset ? gm.expand(spec) : spec;
  const k = gm.kindOf(s);
  const score = (s.score ?? {}) as Record<string, unknown>;
  const rank = (s.rank ?? {}) as Record<string, unknown>;
  const get = (s.get ?? {}) as Record<string, unknown>;
  const asks = (Array.isArray(s.ask) ? s.ask : []) as Record<string, unknown>[];
  if (k === "draft") {
    const count = (s.count ?? {}) as Record<string, unknown>;
    if (rank.by === "matchups") return by("h2h");
    if (rank.race) return by("race");
    if (Array.isArray(rank.cut)) return by("guillotine");
    if (score.by === "place") return by(get.order === "draw" ? "hat" : "outlast");
    if (count.best) return by("bestball");
    return by("fantasy");
  }
  if (k === "pick") {
    if (score.by === "survive") return by(get.repeat === "never" ? "norepeat" : typeof score.lives === "number" ? "lives" : rank.by === "matchups" ? "h2hpicks" : "pool");
    return by(s.card ? "objectives" : "picks");
  }
  if (k === "card") return by("bingo");
  if (k === "stages") return by("redraft");
  if (asks.some((q) => q.answer === "calls")) return by("calls");
  if (score.bank) return by(s.card ? "props" : "bank");
  if (Array.isArray(score.parlays)) return by("parlay");
  if (asks.some((q) => q.share === "split")) return by("pot");
  if (asks.some((q) => (q.settle as { by?: string } | undefined)?.by === "players")) return by("majority");
  if (asks.some((q) => q.answer === "confidence")) return by("confidence");
  if (asks.some((q) => q.answer === "order")) return by("bootorder");
  if (asks.every((q) => q.asked === "once" || q.closes === "finale")) return by("seasonpred");
  return by("sheet");
}
/** The season's made-for games as the community's (ours, marked "Made by us"), each re-spanned from the next episode: one episode,
 *  until the next stage, or the season, as its length said when it was made. */
export function communityOf(input: Input, bases: Base[], gm: G): Community[] {
  const later = input.stages.find((s, i) => i > 0 && !(s.at != null && s.at <= input.from));
  return (input.made ?? []).map((m, i) => {
    const span: Span = m.length === "one" ? { from: input.from, to: input.from } : m.length === "few" ? (later ? { from: input.from, to: { phase: later.id } } : { from: input.from, to: input.from + 2 }) : { from: input.from, to: null };
    const spec = withSpan(m.spec as Spec, span);
    const badge = m.length === "one" ? `1 ${input.ep}` : m.length === "few" ? (later ? `Till ${startOf(later)}` : `3 ${input.eps}`) : "Season";
    // Made up for the frames: saves and couches (there's no community yet), steady from the name.
    const seed = [...m.name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    return { i, name: m.name, hook: m.hook, base: baseFor(m.spec as Spec, bases, gm), badge, spec, ours: true, bet: m.bet, saves: 40 + (seed % 180), couches: 3 + (seed % 40) };
  });
}
/** The ready game for the next episode: the made-for one-episode game that plays first, else none. */
export function readyOf(community: Community[], input: Input, gm: G): Community | null {
  for (const c of community) if (c.badge.startsWith("1 ") && gm.check(c.spec, input.pg).ok) return c;
  return null;
}

// ---------- what everyone does ----------

/** How much a base asks of everyone each week, 0 to 3, for the effort mark. */
export function effortOf(effort: string): 0 | 1 | 2 | 3 {
  if (/nothing/i.test(effort)) return 0;
  if (/once|just watch|change it/i.test(effort)) return 1;
  if (/^1 (pick|guess)|a card while|a quiz/i.test(effort)) return 2;
  return 3;
}

// ---------- a fitted draft's number ----------

const WORD_N: Record<number, string> = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight" };
/** A base's words with the number its draft was fitted to (4 of you, 10 still in: "Pick 2", "picking two"), so the square and the
 *  screen say what this season can seat (PFD's check: the earliest surface says the fitted number). */
/** The base's own draft size against the game's, for its words: a game drafting another number reads as that number ("picking
 *  two"), whether the gallery fitted it to who's left, a control changed it, or it was saved that way; null when they match. */
export function sizeFit(gm: G, base: Base, spec: Spec): { each: number; to: number | "shared" } | null {
  if (!base.spec || Array.isArray(spec.stages)) return null;
  const d = (gm.expand(base.spec).get ?? {}) as { by?: string; each?: number; own?: string };
  const g = (spec.get ?? {}) as { by?: string; each?: number; own?: string };
  if (d.by !== "draft" || g.by !== "draft") return null;
  const was = typeof d.each === "number" ? d.each : 3;
  if (g.own === "shared" && d.own !== "shared") return { each: was, to: "shared" };
  return typeof g.each === "number" && g.each !== was ? { each: was, to: g.each } : null;
}
export function fitWords(text: string, fitted: { each: number; to: number | "shared" } | null | undefined): string {
  if (!fitted || fitted.to === "shared") return text;
  const from = fitted.each;
  const to = fitted.to;
  return text.replace(new RegExp(`\\b${from}\\b`), String(to)).replace(new RegExp(`\\b${WORD_N[from]}\\b`), WORD_N[to] ?? String(to));
}

// ---------- the show's own nouns ----------

/** The season's nouns (the payload's words: a show with tribes is Survivor's kind), so a base written in Survivor's words reads in
 *  this show's: castaways, tribes and the show's own moments are Survivor's, and on another show its cast and groups say so. */
export function nounsOf(o: { show: string }, words: { person?: string; people?: string; group?: string } | undefined) {
  const group = words?.group;
  const survivor = /survivor/i.test(o.show) || group === "tribe";
  const person = survivor ? "castaway" : words?.person && words.person !== "person" ? words.person : "cast member";
  const people = survivor ? "castaways" : words?.people && words.people !== "people" ? words.people : "cast members";
  return { survivor, person, people, group: group || "group", groups: group ? `${group}s` : "groups" };
}
export type Nouns = ReturnType<typeof nounsOf>;
/** A base's words in the season's nouns; a sentence about Survivor's own moments (immunity, idols, tribes, the vote) on another show
 *  is left out (its rules, in the engine's own words, are a tap away). */
export function say(text: string, n: Nouns, line = false): string {
  if (n.survivor) return text;
  const swap = (t: string) =>
    t
      .replace(/castaways/g, n.people)
      .replace(/castaway/g, n.person)
      .replace(/Castaways/g, n.people[0].toUpperCase() + n.people.slice(1))
      .replace(/tribes/g, n.groups)
      .replace(/tribe/g, n.group);
  if (line) return swap(text);
  const out = text
    .split(/(?<=\.)\s+/)
    .filter((s) => !/immunity|idol|tribal|\btribe|jury|the merge|Toka|Savu|\bvote/i.test(s))
    .join(" ");
  return swap(out || text);
}

// ---------- a game's base ----------

/** The base a game was made from, for a game that comes without one (Run it back's, our AI's): baseFor's, else the catalog's base
 *  whose shape is nearest (its kind, how people are got and owned, how it scores, its preset): a sport's bases, say. */
export const baseOfGame = (spec: Spec, bases: Base[], gm: G): Base | null => baseFor(spec, bases, gm) ?? nearestBase(spec, bases, gm);

function nearestBase(spec: Spec, bases: Base[], gm: G): Base | null {
  const sig = (s: Spec) => {
    const x = s as { preset?: string; get?: { by?: string; own?: string }; score?: { by?: string }; count?: { start?: number }; stages?: unknown[]; ask?: unknown[]; card?: unknown };
    return { kind: gm.kindOf(s), get: x.get?.by ?? null, own: x.get?.own ?? null, score: x.score?.by ?? null, preset: x.preset ?? null, lineup: !!x.count && "start" in (x.count ?? {}), stages: Array.isArray(x.stages) ? x.stages.length : 0 };
  };
  const want = sig(spec);
  let best: Base | null = null;
  let top = 0;
  for (const b of bases) {
    if (!b.spec) continue;
    const have = sig(b.spec as Spec);
    if (have.kind !== want.kind) continue;
    const n = 4 + (have.get === want.get ? 2 : 0) + (have.own === want.own ? 2 : 0) + (have.score === want.score ? 2 : 0) + (have.preset === want.preset ? 3 : 0) + (have.lineup === want.lineup ? 1 : 0) + (have.stages === want.stages ? 1 : 0);
    if (n > top) {
      top = n;
      best = b;
    }
  }
  return best;
}
