// Make it a game, the pure half (docs/PLAN-new-design.md step 10 part 2a; the mock's rulebook.js makeGame). A show someone
// added to follow is set up as a game from two answers: how it works (the rulebook prompt, rulebook-research.js) and who's
// in it (the cast prompt, cast-prompt.js, or TVmaze's cast for a series or a talk show). This file is what those answers
// become: the starting rulebook the prompt corrects, the kind the review shows as one line with Change, what to leave out
// when an answer doesn't quite fit, the cast from a listing, and the "found" lines while it's asked. The server half is
// src/lib/server/make-game.ts. Checked by tests/make-game.test.js; nothing here reads the network or the database.
import { BUILT_IN_BLOCKS } from "./formats/blocks/index.js";
import { libraryRulebook } from "./formats/library/index.js";
import { momentsFor } from "./formats/rulebook-moments.js";
import { KINDS, blocksProblems, dropMisfitRefinements, kindOf, partWord, pluralOf, type BlocksProblem, type RulebookBlocks, type RulebookKind } from "./formats/rulebook-schema.js";
import { sameFamily } from "./formats/rulebook-shapes.js";

export type SeriesStart = "reality" | "scripted";

/** A rulebook to start the prompt from: a built-in's blocks, a library file's, or a rulebook row's (the desk's library, or
 *  the same show's other season). */
export interface TemplateRef {
  from: "builtin" | "library" | "rulebook";
  id: string;
}

/**
 * One of the desk's library templates, as templateFor reads it (step 10 part 3): its kind (and a series' start), the show
 * families it's for (the show it was saved from, or a shape's examples), whether the desk saved it from a rulebook's blocks
 * (a legacy mirror of a stored format is only a name match), and its blocks.
 */
export interface LibraryTemplate {
  id: string;
  name: string;
  kind: RulebookKind;
  start: SeriesStart | null;
  shows: string[];
  saved: boolean;
  blocks: RulebookBlocks;
}

// A show we have a rulebook for, by its name. The first that matches wins.
const BY_NAME: [RegExp, TemplateRef][] = [
  [/\bsurvivor\b/i, { from: "builtin", id: "survivor" }],
  [/\btraitors\b/i, { from: "builtin", id: "traitors" }],
  [/^(the )?challenge\b/i, { from: "builtin", id: "challenge" }],
  [/\bamazing race\b/i, { from: "library", id: "the-amazing-race" }],
  [/\bbelow deck\b/i, { from: "library", id: "below-deck" }],
  [/\breal housewives\b/i, { from: "library", id: "the-real-housewives-of-beverly-hills" }],
  [/\bsaturday night live\b|^snl\b/i, { from: "library", id: "saturday-night-live" }],
  [/\bworld series\b|\bmlb\b/i, { from: "library", id: "world-series" }],
  [/^scrubs\b/i, { from: "library", id: "scrubs" }],
];

// Else the kind's nearest. A competition has none: the listings call every reality show "Reality", so a show guessed a
// competition may be a series, and the wrong skeleton costs more than none. Nor a sport: a race series isn't a ball game.
const BY_KIND: Partial<Record<string, TemplateRef>> = {
  "series:scripted": { from: "library", id: "scrubs" },
  "series:reality": { from: "library", id: "below-deck" },
  talk: { from: "library", id: "saturday-night-live" },
};

/** Where a series starts from, as its TV listing's type says: Scripted and Animation are scripted, Documentary reality. */
export function startOf(type: string | null | undefined): SeriesStart | null {
  const t = String(type ?? "").toLowerCase();
  if (t === "scripted" || t === "animation") return "scripted";
  if (t === "documentary" || t === "news") return "reality";
  return null;
}

/**
 * The rulebook a new show's prompt starts from (the design plan's Templates: "the nearest template as a starting
 * skeleton, so the chat corrects a shape instead of inventing one"), reading the desk's library (step 10 part 3): a template
 * the desk saved for a show of that family (or a shape whose examples it is), else one we have by name, else a stored
 * format's mirror of that family, else the nearest of its kind (a series' or a talk show's: the newest the desk saved, else
 * ours), else none. The same show's other season is the server's to look up first.
 */
export function templateFor(show: { name: string; kind: RulebookKind; type?: string | null }, library: LibraryTemplate[] = []): TemplateRef | null {
  const family = (t: LibraryTemplate) => t.shows.some((s) => sameFamily(s, show.name));
  const saved = library.find((t) => t.saved && family(t));
  if (saved) return { from: "rulebook", id: saved.id };
  const named = BY_NAME.find(([re]) => re.test(show.name.trim()));
  if (named) return named[1];
  const mirror = library.find((t) => !t.saved && family(t));
  if (mirror) return { from: "rulebook", id: mirror.id };
  if (show.kind !== "series" && show.kind !== "talk") return BY_KIND[show.kind] ?? null;
  const start = show.kind === "series" ? (startOf(show.type) ?? "reality") : null;
  const ofKind = library.find((t) => t.saved && t.kind === show.kind && (show.kind !== "series" || (t.start ?? "reality") === start));
  if (ofKind) return { from: "rulebook", id: ofKind.id };
  return BY_KIND[show.kind === "series" ? `series:${start}` : show.kind] ?? null;
}

/** A template's blocks, or null (a rulebook row's from the library templateFor was given). */
export function templateBlocks(ref: TemplateRef | null, library: LibraryTemplate[] = []): RulebookBlocks | null {
  if (!ref) return null;
  if (ref.from === "builtin") return (BUILT_IN_BLOCKS as Record<string, { blocks: RulebookBlocks }>)[ref.id]?.blocks ?? null;
  if (ref.from === "rulebook") return library.find((t) => t.id === ref.id)?.blocks ?? null;
  return (libraryRulebook(ref.id) as { blocks: RulebookBlocks } | null)?.blocks ?? null;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * The rulebook as the kind chosen on the review: its kind (and a series' starting point), the blocks the kind hides
 * emptied (a talk show has no ways out or twists, a sport no twists), a sport's "out for one race" kept only for a sport,
 * and a way to win added when it becomes a competition without one. Worked out from the answer each time, so changing
 * the kind back loses nothing ChatGPT found.
 */
export function withKind(blocks: RulebookBlocks, kind: RulebookKind, start?: SeriesStart | null): RulebookBlocks {
  const b = clone(blocks);
  b.kind = kind;
  if (kind === "series") b.start = start ?? (b.start === "scripted" ? "scripted" : "reality");
  else delete b.start;
  const labels = KINDS[kind].labels;
  if (!labels.waysOut) b.waysOut = [];
  if (!labels.twists) b.twists = [];
  if (kind !== "sport") b.waysOut = (b.waysOut ?? []).filter((w) => w.means !== "outForOne");
  const fin = b.season?.finale?.decidedBy;
  if (kind === "competition" && fin !== "nobody" && fin !== "groupWins" && !(b.waysOut ?? []).some((w) => w.means === "winner")) {
    const id = (b.waysOut ?? []).some((w) => w.id === "wonTheSeason") ? "wonTheSeason2" : "wonTheSeason";
    b.waysOut = [...(b.waysOut ?? []), { id, name: "Won", means: "winner" } as RulebookBlocks["waysOut"][number]];
  }
  return b;
}

const itemOf = (at: string, key: string) => at.match(new RegExp(`^${key}\\[([^\\]]+)\\]`))?.[1] ?? null;
type Named = { id?: string; name?: string; label?: string };

/**
 * An answer that doesn't quite fit, made usable by leaving out what doesn't: a moment, twist, way out or part of an
 * episode with a problem is dropped (an episode keeps at least one part), then what pointed at a dropped part lets go of
 * it (a way out keeps its name, without the cause). A refinement that doesn't fit (a vote skipped by a part that's gone)
 * goes first, and its item stays. What's dropped is listed for the review. Problems left (the cast, the season, the kind)
 * can't be: the answer is asked for again.
 */
export function salvage(blocks: RulebookBlocks): { blocks: RulebookBlocks; dropped: string[]; problems: BlocksProblem[] } {
  const b = clone(blocks);
  const dropped: string[] = [];
  for (let round = 0; round < 4; round++) {
    const { problems } = dropMisfitRefinements(b);
    if (!problems.length) return { blocks: b, dropped, problems };
    let changed = false;
    for (const key of ["customMoments", "twists", "waysOut", "segments"] as const) {
      const bad = new Set(problems.map((p) => itemOf(p.at, key)).filter((x): x is string => !!x));
      if (!bad.size) continue;
      const items = ((b[key] ?? []) as Named[]).map((x, i) => ({ x, key: x && x.id ? x.id : String(i) }));
      const keep = items.filter((r) => !bad.has(r.key));
      if (key === "segments" && !keep.length) continue;
      if (keep.length === items.length) continue;
      for (const r of items.filter((r) => bad.has(r.key))) dropped.push(String(r.x?.name ?? r.x?.label ?? r.key));
      (b as unknown as Record<string, unknown>)[key] = keep.map((r) => r.x);
      changed = true;
      if (key === "customMoments" && b.points) for (const id of bad) delete b.points[id];
      if (key === "segments") {
        const gone = new Set([...bad]);
        for (const w of b.waysOut ?? []) if (w.cause && typeof w.cause === "object" && gone.has(w.cause.segment)) delete (w as { cause?: unknown }).cause;
        for (const m of b.customMoments ?? []) if (m.during && "segment" in m.during && gone.has(m.during.segment)) delete m.during;
      }
    }
    if (!changed) return { blocks: b, dropped, problems };
    // A dropped part's moments go with it: their suggested points and notes too.
    const still = new Set(momentsFor(b, { includeOff: true }).map((m) => m.id));
    for (const id of Object.keys(b.points ?? {})) if (!still.has(id)) delete b.points![id];
    // (A note that only says a moment a later change brings is off stays: blocksProblems takes it.)
    const offOnly = (n: object | undefined) => !!n && Object.keys(n).length === 1 && (n as { off?: unknown }).off === true;
    for (const id of Object.keys(b.momentNotes ?? {})) if (!still.has(id) && !offOnly(b.momentNotes![id])) delete b.momentNotes![id];
  }
  return { blocks: b, dropped, problems: blocksProblems(b) };
}

/**
 * A rulebook can't name anyone (it's read before people have watched): where the review found a name, the sentence goes
 * (a tagline, a premise, a summary, a sentence of what didn't fit) or the item does (a name or a label). The rest stands.
 */
export function scrubNames(blocks: RulebookBlocks, problems: BlocksProblem[]): { blocks: RulebookBlocks; scrubbed: number } {
  const b = clone(blocks) as RulebookBlocks & Record<string, unknown>;
  let scrubbed = 0;
  const leftOutGone = new Set<number>();
  for (const p of problems) {
    if (!/^Names /.test(p.message)) continue;
    scrubbed++;
    if (p.at === "tagline" || p.at === "premise" || p.at === "show") delete b[p.at];
    else if (p.at === "season.finale.summary" && b.season?.finale) delete b.season.finale.summary;
    else if (/^leftOut\[(\d+)\]$/.test(p.at)) leftOutGone.add(Number(p.at.match(/\d+/)![0]));
    else {
      const m = p.at.match(/^(season\.phases|segments|waysOut|twists|customMoments)\[([^\]]+)\]\.(\w+)$/);
      if (!m) continue;
      const [, key, id, field] = m;
      const items = (key === "season.phases" ? b.season?.phases : (b as Record<string, unknown>)[key]) as (Named & Record<string, unknown>)[] | undefined;
      const item = items?.find((x) => x?.id === id);
      if (!item || !items) continue;
      if (field === "summary" || field === "question") delete item[field];
      else if (key !== "season.phases") {
        (b as Record<string, unknown>)[key] = items.filter((x) => x !== item);
        if (key === "customMoments" && b.points) delete b.points[id];
      }
    }
  }
  if (leftOutGone.size) b.leftOut = (b.leftOut ?? []).filter((_, i) => !leftOutGone.has(i));
  return { blocks: b, scrubbed };
}

/** A person (or character) in the cast as Make it a game holds it before it's the season's: a name, a photo, a group, a line. */
export interface MadeCastRow {
  name: string;
  photoUrl: string | null;
  group: string | null;
  /** Who plays them (a scripted series' character), or their role ("Captain"): shown on the review only. */
  note: string | null;
}

/** The parts of TVmaze's /shows/:id/cast the app reads. */
export interface TvCastRow {
  person?: { name?: string | null; image?: { medium?: string | null } | null } | null;
  character?: { name?: string | null; image?: { medium?: string | null } | null } | null;
  self?: boolean | null;
  voice?: boolean | null;
}

const SELF = /^(self|himself|herself|themselves|themself|host|co-host|narrator)$/i;
/** At most this many from a listing (a long-running show's cast can be huge). */
export const LISTING_CAST_MAX = 40;

/**
 * The cast from a show's TV listing: a scripted series' characters (who plays them as the line), else the people (their
 * role as the line, when it's a role and not "Self"). Each name once.
 */
export function castFromListing(rows: TvCastRow[], start: SeriesStart | null): MadeCastRow[] {
  const out: MadeCastRow[] = [];
  const seen = new Set<string>();
  for (const r of rows ?? []) {
    const person = r?.person?.name?.trim() || null;
    const character = r?.character?.name?.trim() || null;
    const scripted = start === "scripted" && !!character && !r?.self && !SELF.test(character);
    const name = scripted ? character! : person;
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const photo = scripted ? (r.character?.image?.medium ?? r.person?.image?.medium ?? null) : (r.person?.image?.medium ?? null);
    const note = scripted ? person : character && !SELF.test(character) && character !== person ? character : null;
    out.push({ name, photoUrl: photo || null, group: null, note });
    if (out.length >= LISTING_CAST_MAX) break;
  }
  return out;
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");

/** The kind as the review's one line says it: "A competition", "A series · reality". */
export function kindName(kind: RulebookKind, start?: string | null): string {
  return KINDS[kind].name + (kind === "series" && start ? ` · ${start}` : "");
}

/**
 * What was found, a line each, as it comes in (the mock's "18 castaways in 3 tribes · How an episode runs: 4 parts · 14
 * things that score · A competition"): from the rulebook once it's in, and the cast once that is.
 */
export function foundLines(blocks: RulebookBlocks | null, cast: MadeCastRow[] | null): string[] {
  const lines: string[] = [];
  if (cast && cast.length) {
    const unit = blocks?.cast?.plural?.trim() || "people";
    const groups = new Set(cast.map((c) => c.group).filter(Boolean));
    const g = blocks?.cast?.groups?.singular?.trim();
    lines.push(`${cast.length} ${cast.length === 1 ? blocks?.cast?.singular?.trim() || "person" : unit}${groups.size > 1 && g ? ` in ${groups.size} ${pluralOf(g)}` : ""}`);
  }
  if (blocks) {
    const kind = kindOf(blocks);
    const part = partWord(blocks).singular;
    const segs = (blocks.segments ?? []).length;
    lines.push(`How ${article(part)} ${part} runs: ${segs} ${segs === 1 ? "part" : "parts"}`);
    const n = momentsFor(blocks).length;
    lines.push(kind === "talk" ? `${n} moments for bingo and calls` : `${n} ${n === 1 ? "thing" : "things"} that score`);
    lines.push(kindName(kind, blocks.start));
  }
  return lines;
}

/** Whether a kind of show needs its cast before it's a game: everything but talk (Weekly Bingo and Weekly Calls don't draft). */
export const needsCast = (kind: RulebookKind) => kind !== "talk";
