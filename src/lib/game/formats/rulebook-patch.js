// Rulebook edits (docs/PLAN-rulebooks-implementation.md 4.4, phase 5; docs/PLAN-new-design.md step 6b part 2): what
// changed between two versions of a rulebook's blocks, as ops; putting ops on blocks; the ops in plain words for a
// timeline or a review; and what a rulebook compiles to when the show changed from an episode on.
//
// A rulebook is its base blocks (in force from the premiere) and an ordered list of in-force edits, each
// { fromEpisode, ops }. A "Fix a mistake" is folded into the base (it was always like this: every episode is
// rescored); "The show changed" from episode N stays an edit, so episodes before N keep their rules:
//
//   diffBlocks(a, b)            -> ops: [{ op: 'set', block, value } | { op: 'add', block, value, at }
//                                       | { op: 'update', block, id, value } | { op: 'remove', block, id }]
//   applyOps(blocks, ops)       -> blocks with the ops on them (a copy)
//   blocksAt(base, edits, n)    -> the blocks as of episode n: the base and every edit from n or earlier
//   opLines(ops, before, after) -> ["+ New advantage: Block a Vote", "~ Reward challenge: how often", "− Sent to Exile"]
//   mergeAtEpisode(before, after, n) -> FormatData: `before` up to episode n - 1, `after` from n
//
// List blocks are keyed by item id (ids never change on rename, rulebook-schema.js); everything else is set whole.
// mergeAtEpisode gates with rules.js's own language: a rule only the new version has runs from n (`fromEpisode`), one
// only the old has stops at n - 1 (`untilEpisode`), an event only the old has is retired from n (`retiredFrom`).
// Points come from the new version from the start: suggested points were always each game's to change. Plain
// CommonJS, browser-safe, no dependencies outside formats/, like everything here.
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js */
const { QUESTIONS, labelOf } = require('./rulebook-schema.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const list = (v) => (Array.isArray(v) ? v : []);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (!isObj(v)) return v;
  const out = {};
  for (const k of Object.keys(v).sort()) if (v[k] !== undefined) out[k] = canonical(v[k]);
  return out;
}
const same = (a, b) => JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null));

// The list blocks, and where each lives in the blocks.
const LISTS = {
  segments: { get: (b) => b.segments, put: (b, v) => { b.segments = v; } },
  waysOut: { get: (b) => b.waysOut, put: (b, v) => { b.waysOut = v; } },
  twists: { get: (b) => b.twists, put: (b, v) => { b.twists = v; } },
  customMoments: { get: (b) => b.customMoments, put: (b, v) => { b.customMoments = v; } },
  phases: { get: (b) => b.season && b.season.phases, put: (b, v) => { b.season = { ...(b.season || {}), phases: v }; } },
};
// Everything else is set whole: the top-level answers, who's playing, the finale, the points and notes, how research asks.
const SINGLES = {
  kind: { get: (b) => b.kind, put: (b, v) => { b.kind = v; } },
  start: { get: (b) => b.start, put: (b, v) => { if (v === undefined) delete b.start; else b.start = v; } },
  show: { get: (b) => b.show, put: (b, v) => { if (v === undefined) delete b.show; else b.show = v; } },
  tagline: { get: (b) => b.tagline, put: (b, v) => { if (v === undefined) delete b.tagline; else b.tagline = v; } },
  premise: { get: (b) => b.premise, put: (b, v) => { if (v === undefined) delete b.premise; else b.premise = v; } },
  parts: { get: (b) => b.parts, put: (b, v) => { if (v === undefined) delete b.parts; else b.parts = v; } },
  cast: { get: (b) => b.cast, put: (b, v) => { b.cast = v; } },
  finale: {
    get: (b) => b.season && b.season.finale,
    put: (b, v) => {
      b.season = { ...(b.season || { phases: [] }) };
      if (v === undefined) delete b.season.finale;
      else b.season.finale = v;
    },
  },
  points: { get: (b) => b.points, put: (b, v) => { if (v === undefined) delete b.points; else b.points = v; } },
  momentNotes: { get: (b) => b.momentNotes, put: (b, v) => { if (v === undefined) delete b.momentNotes; else b.momentNotes = v; } },
  leftOut: { get: (b) => b.leftOut, put: (b, v) => { if (v === undefined) delete b.leftOut; else b.leftOut = v; } },
  research: { get: (b) => b.research, put: (b, v) => { if (v === undefined) delete b.research; else b.research = v; } },
};

/** The ops that take blocks `a` to blocks `b`. */
function diffBlocks(a, b) {
  const A = a || {};
  const B = b || {};
  const ops = [];
  for (const [block, s] of Object.entries(SINGLES)) {
    if (!same(s.get(A), s.get(B))) ops.push({ op: 'set', block, value: clone(s.get(B)) });
  }
  for (const [block, l] of Object.entries(LISTS)) {
    const before = list(l.get(A));
    const after = list(l.get(B));
    const was = new Map(before.map((x) => [x && x.id, x]));
    const now = new Map(after.map((x) => [x && x.id, x]));
    for (const [i, x] of after.entries()) {
      if (!was.has(x.id)) ops.push({ op: 'add', block, value: clone(x), at: i });
      else if (!same(was.get(x.id), x)) ops.push({ op: 'update', block, id: x.id, value: clone(x) });
    }
    for (const x of before) if (!now.has(x.id)) ops.push({ op: 'remove', block, id: x.id });
  }
  return ops;
}

/** Blocks with `ops` on them, as a copy. An op that can't apply (an update of an item that's gone) is skipped. */
function applyOps(blocks, ops) {
  const b = clone(blocks || {});
  for (const o of list(ops)) {
    if (!o) continue;
    if (o.op === 'set' && SINGLES[o.block]) {
      SINGLES[o.block].put(b, clone(o.value));
      continue;
    }
    const l = LISTS[o.block];
    if (!l) continue;
    const items = list(l.get(b)).slice();
    if (o.op === 'add' && o.value && !items.some((x) => x.id === o.value.id)) {
      const at = Number.isInteger(o.at) ? Math.max(0, Math.min(o.at, items.length)) : items.length;
      items.splice(at, 0, clone(o.value));
    } else if (o.op === 'update') {
      const i = items.findIndex((x) => x.id === o.id);
      if (i >= 0) items[i] = clone(o.value);
    } else if (o.op === 'remove') {
      const i = items.findIndex((x) => x.id === o.id);
      if (i >= 0) items.splice(i, 1);
    }
    l.put(b, items);
  }
  return b;
}

/** The blocks as of episode `n`: the base, then each edit in force from `n` or earlier, in the order they start. */
function blocksAt(base, edits, n) {
  const upTo = Number.isFinite(n) ? n : Infinity;
  const inForce = list(edits)
    .filter((e) => e && Number.isInteger(e.fromEpisode) && e.fromEpisode <= upTo)
    .slice()
    .sort((x, y) => x.fromEpisode - y.fromEpisode);
  return inForce.reduce((b, e) => applyOps(b, e.ops), clone(base || {}));
}

// ---------- in words ----------

const ITEM_WORD = { segments: 'segment', waysOut: 'way out', customMoments: 'moment', phases: 'phase' };
const QUESTION_SET = { segments: 'segment', waysOut: 'wayOut', twists: 'twist', customMoments: 'moment', phases: 'phase' };
const SINGLE_WORDS = {
  kind: 'The kind of show', start: 'Where the series starts from', show: "The show's name", tagline: 'The tagline', premise: 'The premise',
  parts: 'What one part is called', cast: "Who's playing", finale: 'The finale', points: 'Suggested points', momentNotes: 'What the league answers',
  leftOut: "What didn't fit", research: 'How research asks',
};
const nameOf = (x) => (x && (x.name || x.label)) || (x && x.id) || 'Something';
const lower = (s) => String(s || '').replace(/\?$/, '').replace(/^./, (c) => c.toLowerCase());

/** The fields an item's update changed, in the editor's words ("how often", "what's on the line"). */
function changedFields(block, was, now) {
  const qs = QUESTIONS[QUESTION_SET[block]] || {};
  const keys = [...new Set([...Object.keys(was || {}), ...Object.keys(now || {})])].filter((k) => k !== 'id' && !same((was || {})[k], (now || {})[k]));
  return keys.map((k) => (k === 'momentsOff' ? 'what it scores' : qs[k] ? lower(qs[k]) : k));
}

/** The ops as plain rows for a timeline or a review: "+" added, "~" changed, "−" taken out. */
function opLines(ops, before, after) {
  const find = (blocks, block, id) => list(LISTS[block] && LISTS[block].get(blocks || {})).find((x) => x && x.id === id) || null;
  return list(ops).map((o) => {
    if (o.op === 'set') {
      if (o.block === 'kind') return `~ ${SINGLE_WORDS.kind}: ${labelOf('kind', o.value)}`;
      if (o.block === 'points') {
        const was = (before && before.points) || {};
        const now = o.value || {};
        const n = [...new Set([...Object.keys(was), ...Object.keys(now)])].filter((k) => !same(was[k], now[k])).length;
        return `~ ${SINGLE_WORDS.points}: ${n} ${n === 1 ? 'moment' : 'moments'}`;
      }
      return `~ ${SINGLE_WORDS[o.block] || o.block}`;
    }
    const word = o.block === 'twists' ? lower(labelOf('twistType', (o.value || find(before, o.block, o.id) || {}).type)).replace(/^(a|an) /, '') || 'twist' : ITEM_WORD[o.block] || 'item';
    if (o.op === 'add') return `+ New ${word}: ${nameOf(o.value)}`;
    if (o.op === 'remove') return `− ${nameOf(find(before, o.block, o.id))}`;
    const was = find(before, o.block, o.id);
    const fields = changedFields(o.block, was, o.value);
    return `~ ${nameOf(o.value || find(after, o.block, o.id))}${fields.length ? `: ${fields.join(', ')}` : ''}`;
  });
}

// ---------- what it compiles to, from an episode on ----------

const ruleKey = (rule) => JSON.stringify(canonical(rule));
const unionBy = (key, ...lists) => {
  const out = new Map();
  for (const l of lists) for (const x of list(l)) if (x != null && !out.has(key(x))) out.set(key(x), x);
  return [...out.values()];
};

/** `rule` limited to episodes from..until (either may be absent), or null when that leaves no episode at all. */
function gate(rule, from, until) {
  const r = clone(rule);
  if (from != null && from > 1) r.fromEpisode = Math.max(r.fromEpisode || 1, from);
  if (until != null) r.untilEpisode = r.untilEpisode != null ? Math.min(r.untilEpisode, until) : until;
  if (r.untilEpisode != null && r.untilEpisode < (r.fromEpisode || 1)) return null;
  return r;
}

function mergeRules(before, after, n) {
  const was = new Map(list(before).map((r) => [ruleKey(r), r]));
  const now = new Map(list(after).map((r) => [ruleKey(r), r]));
  const out = [];
  for (const [k, r] of was) {
    if (now.has(k)) out.push(clone(r));
    else {
      const g = gate(r, null, n - 1);
      if (g) out.push(g);
    }
  }
  for (const [k, r] of now) {
    if (was.has(k)) continue;
    const g = gate(r, n, null);
    if (g) out.push(g);
  }
  return out;
}

/**
 * The rules a season plays by when the show changed from episode `n`: format data `before` for episodes 1 to n - 1,
 * `after` from n on. Events and questions are the two together (an event only the old version has is retired from
 * n, so its points still count where it was awarded); everything about the show (names, terms, the wiki read, roles)
 * is the new version's. From the premiere, it's simply `after`.
 */
function mergeAtEpisode(before, after, n) {
  if (!isObj(before) || !(Number.isInteger(n) && n > 1)) return clone(after);
  const b = before;
  const a = after;
  const out = clone(a);
  const nowIds = new Set(list(a.events).map((e) => e.id));
  out.events = [
    ...list(a.events).map(clone),
    ...list(b.events)
      .filter((e) => !nowIds.has(e.id))
      .map((e) => ({ ...clone(e), retiredFrom: Number.isInteger(e.retiredFrom) ? Math.min(e.retiredFrom, n) : n })),
  ];
  // Each category keeps what it had too, so an old episode's retired moment still has its group.
  const cats = new Map(list(a.eventCategories).map((c) => [c.id, { ...clone(c), events: list(c.events).slice() }]));
  for (const c of list(b.eventCategories)) {
    const had = cats.get(c.id);
    const retired = list(c.events).filter((id) => !nowIds.has(id));
    if (had) had.events.push(...retired.filter((id) => !had.events.includes(id)));
    else if (retired.length) cats.set(c.id, { ...clone(c), events: retired });
  }
  out.eventCategories = [...cats.values()];
  out.exitMethods = unionBy((x) => x, a.exitMethods, b.exitMethods);
  if (Array.isArray(a.endgameExitMethods) || Array.isArray(b.endgameExitMethods)) out.endgameExitMethods = unionBy((x) => x, a.endgameExitMethods, b.endgameExitMethods);
  if (isObj(a.research) || isObj(b.research)) {
    out.research = { ...clone(b.research || {}), ...clone(a.research || {}) };
    out.research.checklist = unionBy((q) => q && q.key, a.research && a.research.checklist, b.research && b.research.checklist).map(clone);
  }
  out.rules = {
    research: mergeRules(b.rules && b.rules.research, a.rules && a.rules.research, n),
    implied: mergeRules(b.rules && b.rules.implied, a.rules && a.rules.implied, n),
  };
  return out;
}

module.exports = { diffBlocks, applyOps, blocksAt, opLines, mergeAtEpisode, sameBlocks: same };
