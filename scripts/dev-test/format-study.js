// Dev-only: the format study (docs/PLAN-start-a-game-gpt.md, "Formats nobody announced", F1; the write-up is
// docs/STUDY-format-changes.md). Reads a season's ground truth (tests/fixtures/format-timelines/<show>-<season>.json: each
// episode's phase, how people played and who went home; each grouping's spells, i.e. who was with whom from when; the
// season's twists) and, when the season is on tape, what each episode's recorded research said (the tapes' e<NN>-full.json,
// docs/PLAN-playtests.md), and prints:
//   - the timeline: per episode, the phase, how people played (pairs, teams, tribes, individuals, everyone) and the groups
//     in play, and who went home and how;
//   - every change, worked out by comparing one spell with the next (our code, not anyone's labels: the way F3 will), with
//     its kind, the episode it took effect and how the show brought it in (announced ahead, at the start, mid-episode, at
//     the end of the episode before), plus the season's twists;
//   - how long each grouping lasted (who, from which episode, until which, and what ended it);
//   - for a season on tape: what that episode's research said about each change (which field, which words) and whether the
//     engine could act on it today.
// No database, no bot, no network: the fixtures and the tapes only. The fixtures are hand-made from each season's Wikipedia
// page (its revision is in the file) and the tapes' cast names; a season not on tape uses Wikipedia's short names.
//
//   node scripts/dev-test/format-study.js                         every season in the fixtures, as text
//   node scripts/dev-test/format-study.js the-challenge 41        one season
//   node scripts/dev-test/format-study.js --md                    markdown tables (what the study doc quotes)
//   node scripts/dev-test/format-study.js --check                 each fixture's problems (also in npm test)
//
// TAPES_DIR moves the tapes (default ~/rfl-tapes, as tapes.js has it). The pure parts are exported for
// tests/format-study.test.js and for F2 (scoring the bot's format answers against these timelines) and F4 (blind replays).
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const FIXTURES = path.join(__dirname, "..", "..", "tests", "fixtures", "format-timelines");
const TAPES = process.env.TAPES_DIR || path.join(os.homedir(), "rfl-tapes");

// How people played an episode: the unit a challenge or a vote treats as one.
const PLAYS = ["everyone", "tribes", "teams", "pairs", "individuals", "mixed", "none"];
const GROUPED = new Set(["tribes", "teams", "pairs"]);
const AT = { start: 0, mid: 1, end: 2 };
const OUTS = ["eliminated", "voted out", "purged", "fire", "quit", "medical", "evacuated", "disqualified", "murdered", "banished", "placed", "won"];
// The proposed vocabulary (the study doc; the user's to approve at the merge): what our code calls a change it finds.
const KINDS = ["teams-formed", "pairs-formed", "split-into-individuals", "merge", "swap", "newcomer", "new-phase", "twist", "role"];

// ---------- reading ----------

function fixturePath(show, season, dir = FIXTURES) {
  return path.join(dir, `${show}-${season}.json`);
}

function loadTimeline(show, season, dir = FIXTURES) {
  return JSON.parse(fs.readFileSync(fixturePath(show, season, dir), "utf8"));
}

function fixtures(dir = FIXTURES) {
  return fs
    .readdirSync(dir)
    .map((f) => f.match(/^(.+)-(\d+)\.json$/))
    .filter(Boolean)
    .map((m) => ({ show: m[1], season: Number(m[2]) }));
}

/** Each episode's recorded full research (the parsed payload), keyed by episode number; {} when the season isn't on tape. */
function researchOf(show, season, dir = TAPES) {
  const base = path.join(dir, show, String(season));
  if (!fs.existsSync(base)) return {};
  const out = {};
  for (const f of fs.readdirSync(base)) {
    const m = f.match(/^e(\d+)-full\.json$/);
    if (!m) continue;
    const tape = JSON.parse(fs.readFileSync(path.join(base, f), "utf8"));
    const p = tape.parsed && (tape.parsed.parsed || tape.parsed);
    if (p && typeof p === "object") out[Number(m[1])] = p;
  }
  return out;
}

// ---------- the timeline ----------

const cmp = (a, b) => a[0] - b[0] || AT[a[1]] - AT[b[1]];
const keyOf = (members) => [...members].sort().join(" + ");

/** Name -> the episode they left (their first exit), and how. */
function exits(t) {
  const out = new Map();
  for (const ep of t.episodes) for (const o of ep.out || []) if (!out.has(o.name)) out.set(o.name, { episode: ep.n, how: o.how });
  return out;
}

/** Whether someone was still in for (some of) episode n: not gone in an earlier episode. */
function inFor(left, name, n) {
  const l = left.get(name);
  return !l || l.episode >= n;
}

/** The episodes anything was played in (not a reunion), in order. */
function playedEpisodes(t) {
  return t.episodes.filter((e) => e.play !== "none").map((e) => e.n);
}

/**
 * The episodes a layer's spell i is in play for: from its start until the next spell takes over (a next one from the start
 * of episode n leaves it n - 1; one from mid-episode n shares n). A spell takes effect at an episode's start or partway
 * through (a re-pairing after an elimination is from the next episode's start, shown at this one's end).
 */
function spellEpisodes(t, layer, i) {
  const spells = t.groupings[layer].spells;
  const first = spells[i].from[0];
  const next = spells[i + 1];
  const played = playedEpisodes(t);
  const last = next ? (next.from[1] === "start" ? next.from[0] - 1 : next.from[0]) : played[played.length - 1];
  return played.filter((n) => n >= first && n <= last);
}

/** A spell's groups as of episode n: only the people still in for it. */
function groupsOf(spell, left, n) {
  return (spell.groups || [])
    .map((g) => ({ name: g.name || null, members: g.members.filter((m) => inFor(left, m, n)) }))
    .filter((g) => g.members.length);
}

/** The groups of a layer in play during episode n (the spell at its start, then any from mid-episode): [{ at, groups }]. */
function groupsIn(t, layer, n) {
  const left = exits(t);
  const spells = t.groupings[layer].spells;
  const out = [];
  spells.forEach((s, i) => {
    if (spellEpisodes(t, layer, i).includes(n)) out.push({ at: s.from[0] === n ? s.from[1] : "start", groups: groupsOf(s, left, n), spell: i });
  });
  return out;
}

/**
 * The groups of a layer as known at episode n's end (what F2's answer for that episode should say): the last spell in force by
 * then, counting one that takes effect from the next episode only when it was shown by n's end (a re-pairing after the
 * elimination is; a substitution at the next episode's start isn't). Only those still in after n. { groups, alone, spell }.
 */
function stateAtEnd(t, layer, n) {
  const left = exits(t);
  const spells = t.groupings[layer].spells;
  let at = -1;
  spells.forEach((s, i) => {
    const known = s.shown ? cmp(s.shown, [n, "end"]) <= 0 : cmp(s.from, [n, "mid"]) <= 0;
    if (known && s.from[0] <= n + 1) at = i;
  });
  if (at < 0) return { groups: [], alone: [], spell: -1 };
  const still = (m) => inFor(left, m, n + 1);
  const s = spells[at];
  const all = (s.groups || []).map((g) => ({ name: g.name || null, members: g.members.filter(still) }));
  // A group down to one isn't a group: whoever's left of it is on their own (a partner who went home).
  const groups = all.filter((g) => g.members.length > 1);
  const alone = [...(s.alone || []).filter(still), ...all.filter((g) => g.members.length === 1).map((g) => g.members[0])].sort();
  return { groups, alone, spell: at };
}

/**
 * How long each group of a layer lasted: [{ key, name, members, first, last, episodes, ended }]. A group is its exact members
 * (any move, join or re-pairing ends it). `exitsEnd` false (the default): someone leaving the game doesn't end their group (a
 * tribe that loses a member is still that tribe); true: it does (strict exact members). A group down to one isn't a group.
 * `ended`: "season" (it lasted to the end), "left" (its members went home together, or it was down to one), "changed" (a
 * swap, a re-pairing, a split, a merge). Groups shown but never played (a spell overtaken before its first episode) are
 * listed apart, as `never`.
 */
function lifetimes(t, layer, { exitsEnd = false } = {}) {
  const left = exits(t);
  const played = playedEpisodes(t);
  const lines = [];
  let active = [];
  for (const n of played) {
    const now = [];
    for (const { groups } of groupsIn(t, layer, n)) {
      for (const g of groups) {
        if (g.members.length < 2) continue;
        const key = keyOf(g.members);
        if (now.some((x) => x.key === key)) continue;
        const prior = active.find((x) => (exitsEnd ? x.key === key : keyOf(x.members.filter((m) => inFor(left, m, n))) === key));
        if (prior) {
          prior.last = n;
          prior.keys.add(key);
          if (!prior.episodes.includes(n)) prior.episodes.push(n);
          now.push({ key, ref: prior });
        } else {
          // `keys`: every member list it's been in play under (a tribe that loses someone carries on under a shorter one).
          const line = { key, name: g.name, members: g.members, first: n, last: n, episodes: [n], keys: new Set([key]) };
          lines.push(line);
          now.push({ key, ref: line });
        }
      }
    }
    active = now.map((x) => x.ref);
  }
  const end = played[played.length - 1];
  for (const l of lines) {
    // Changed: a spell later in its last episode (a mid-episode claim) leaves it out, or two or more of it are still in after.
    const inLast = groupsIn(t, layer, l.last);
    const dropped = inLast.length > 1 && !inLast[inLast.length - 1].groups.some((g) => l.keys.has(keyOf(g.members)));
    const after = played.find((n) => n > l.last);
    const stillIn = l.members.filter((m) => after != null && inFor(left, m, after));
    l.ended = l.last === end ? "season" : dropped || stillIn.length >= 2 ? "changed" : "left";
  }
  const playedKeys = new Set(lines.flatMap((l) => [...l.keys]));
  const never = [];
  t.groupings[layer].spells.forEach((s, i) => {
    if (spellEpisodes(t, layer, i).length) return;
    for (const g of groupsOf(s, left, s.from[0])) {
      const key = keyOf(g.members);
      if (g.members.length > 1 && !playedKeys.has(key)) never.push({ key, name: g.name || null, shown: s.shown });
    }
  });
  return { groups: lines, never };
}

/** A lifetime summary: how many groups lasted 1, 2, ... episodes, the longest and the median. */
function lifetimeSummary(groups) {
  const lengths = groups.map((g) => g.episodes.length).sort((a, b) => a - b);
  const by = {};
  for (const n of lengths) by[n] = (by[n] || 0) + 1;
  const mid = lengths.length ? lengths[Math.floor((lengths.length - 1) / 2)] : 0;
  return { count: lengths.length, by, longest: lengths[lengths.length - 1] || 0, median: mid };
}

/** How the show brought a change in, from when it was shown and when it took effect. */
function broughtIn(shown, from) {
  if (!shown) return "unknown";
  if (shown[0] === from[0]) return shown[1] === "start" ? "at the start" : shown[1] === "mid" ? "mid-episode" : "at the end";
  if (shown[0] === from[0] - 1 && shown[1] === "end") return "at the end of the episode before";
  return shown[0] < from[0] ? `announced ahead (Episode ${shown[0]})` : `shown after (Episode ${shown[0]})`;
}

const playOf = (t, n) => (t.episodes.find((e) => e.n === n) || {}).play;
const prevPlayed = (t, n) => playedEpisodes(t).filter((x) => x < n).pop();

/** The kind of change from one way of playing to another, or null when it's the same. */
function playKind(before, after) {
  if (before === after) return null;
  if (after === "individuals" && GROUPED.has(before)) return "split-into-individuals";
  if (after === "pairs") return "pairs-formed";
  if (after === "teams" || after === "tribes") return "teams-formed";
  if (after === "individuals") return "split-into-individuals";
  return null;
}

/**
 * Every change in a season, worked out from its spells and its episodes' play (our code compares one state with the next; a
 * fixture's labels are only its twists'): [{ kind, layer, from, shown, brought, groups, moved, newcomers, allNew, what }].
 */
function changes(t) {
  const left = exits(t);
  const joined = new Map(t.episodes.flatMap((e) => (e.in || []).map((x) => [x.name, e.n])));
  const out = [];
  const seen = new Set();
  for (const [layer, g] of Object.entries(t.groupings || {})) {
    if (g.label) continue;
    for (let i = 1; i < g.spells.length; i++) {
      const s0 = g.spells[i - 1];
      const s1 = g.spells[i];
      const n = s1.from[0];
      const before = groupsOf(s0, left, n);
      const after = groupsOf(s1, left, n);
      // Each person's place: their group's members, or on their own. Someone moving between a group and being alone moved.
      const still = (m) => inFor(left, m, n);
      const places = (groups, alone) =>
        new Map([...groups.flatMap((x) => x.members.map((m) => [m, keyOf(x.members)])), ...(alone || []).filter(still).map((m) => [m, "alone"])]);
      const b = places(before, s0.alone);
      const a = places(after, s1.alone);
      const moved = [...a.keys()].filter((m) => b.has(m) && b.get(m) !== a.get(m));
      // New: in no group or alone in any spell before this one, and come in (the episode's `in`) by now.
      const newcomers = [...a.keys()].filter((m) => !b.has(m) && joined.has(m) && joined.get(m) <= n && !inEarlierSpell(g.spells, i, m));
      const beforeKeys = new Set(before.map((x) => keyOf(x.members)));
      const kept = after.filter((x) => beforeKeys.has(keyOf(x.members))).length;
      // Someone new taking the place of someone who left (The Challenge 41's Jonna for Cara Maria) is a newcomer, not a swap.
      const changed = after.filter((x) => !beforeKeys.has(keyOf(x.members)));
      const onlyNewcomers = newcomers.length > 0 && changed.every((x) => x.members.some((m) => newcomers.includes(m)));
      const playBefore = s1.from[1] === "mid" ? playOf(t, n) : playOf(t, prevPlayed(t, n) ?? n);
      const played = playOf(t, n);
      let kind;
      if (!after.length) kind = "split-into-individuals";
      else if (!before.length) kind = playKind(playBefore, played) || (played === "pairs" ? "pairs-formed" : "teams-formed");
      else if (after.length === 1 && before.length > 1) kind = "merge";
      else if (onlyNewcomers) kind = "newcomer";
      else kind = playKind(playBefore, played) || (moved.length || newcomers.length ? "swap" : null);
      if (kind) {
        const allNew = after.length > 0 && kept === 0;
        out.push({ kind, layer, from: s1.from, shown: s1.shown, brought: broughtIn(s1.shown, s1.from), groups: kind === "newcomer" ? changed : after, changed, moved: kind === "newcomer" ? [] : moved, newcomers, allNew, what: s1.how || null });
        seen.add(`${s1.from[0]}:${kind}`);
      }
      if (newcomers.length && kind !== "newcomer") out.push({ kind: "newcomer", layer, from: s1.from, shown: s1.shown, brought: broughtIn(s1.shown, s1.from), groups: [], moved: [], newcomers, allNew: false, what: s1.how || null });
    }
  }
  // A change of how people play with no spell behind it (The Challenge 40's eras became teams, then a label).
  const played = playedEpisodes(t);
  for (let i = 1; i < played.length; i++) {
    const kind = playKind(playOf(t, played[i - 1]), playOf(t, played[i]));
    if (!kind || [...seen].some((k) => k.startsWith(`${played[i]}:`))) continue;
    const e = t.episodes.find((x) => x.n === played[i]) || {};
    const from = [played[i], "start"];
    out.push({ kind, layer: null, from, shown: e.playShown || null, brought: broughtIn(e.playShown || null, from), groups: [], moved: [], newcomers: [], allNew: false, what: e.note || null });
  }
  for (const tw of t.twists || []) out.push({ kind: tw.kind, layer: null, from: tw.from, shown: tw.shown, brought: broughtIn(tw.shown, tw.from), groups: [], moved: [], newcomers: [], allNew: false, what: tw.what, words: tw.words || [] });
  return out.sort((x, y) => cmp(x.from, y.from) || KINDS.indexOf(x.kind) - KINDS.indexOf(y.kind));
}

function inEarlierSpell(spells, i, name) {
  return spells.slice(0, i).some((s) => (s.alone || []).includes(name) || (s.groups || []).some((x) => x.members.includes(name)));
}

// ---------- what research said ----------

const GROUPING_KINDS = new Set(["teams-formed", "pairs-formed", "split-into-individuals", "merge", "swap", "newcomer"]);

// Words that say a grouping changed, per kind (lower case; matched as parts of words).
const KIND_WORDS = {
  "teams-formed": ["team", "tribe"],
  "pairs-formed": ["pair", "partner", "lock-in", "lock in", "permanent"],
  "split-into-individuals": ["individual", "on their own", "each for", "team phase is over", "solo"],
  merge: ["merge"],
  swap: ["swap", "switch", "re-pair", "repair", "new partner", "paired with", "partnered with", "reshuffl", "shake", "new tribe", "claim", "dissolv"],
  newcomer: ["alternate", "replacement", "entered", "joined", "new player", "arriv"],
};

const firstName = (n) => String(n).replace(/["“”].*?["“”]\s*/g, "").split(/\s+/)[0];
const WORDS = new Map();
const wordIn = (low, x) => {
  if (!WORDS.has(x)) WORDS.set(x, new RegExp(`\\b${x.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`));
  return WORDS.get(x).test(low);
};
/**
 * Whether a note names someone: their whole name, or their first name when nobody else in `firsts` shares it (`firsts`:
 * first name -> how many of the cast have it). A group's name (`whole`) only as a whole ("New Threats" isn't "new").
 */
const mentions = (text, name, { whole = false, firsts = null } = {}) => {
  if (!text) return false;
  const low = text.toLowerCase();
  const first = firstName(name);
  const tries = whole || (firsts && firsts.get(first) > 1) ? [name] : [name, first];
  return tries.some((x) => x && x.length > 1 && wordIn(low, x));
};
// Lower case, hyphens as spaces ("murder-in-plain-sight" says "plain sight").
const plain = (text) => String(text).toLowerCase().replace(/-/g, " ");
const hasWord = (text, words) => !!text && words.some((w) => plain(text).includes(plain(w)));

/**
 * What an episode's research said about a change: for each episode it could have come in (where it was shown, and where it
 * took effect), the structured fields the engine reads (newGroup, merged, the roles) and the free text it doesn't (rulesNote,
 * summary, notableTwist), with how many of the change's new groups a note names together. `verdict`: "acted on" (a field the
 * engine reads carries it), "free text only" (words a person could read), "nothing", or "not on tape".
 */
function researchSays(t, change, research) {
  // Where it was shown, where it took effect, and the episode after (a report that came in late).
  const eps = [...new Set([change.shown && change.shown[0], change.from[0], change.from[0] + 1].filter((n) => n != null))].sort((a, b) => a - b);
  const words = change.words && change.words.length ? change.words : KIND_WORDS[change.kind] || [];
  const found = [];
  let onTape = false;
  // The change's own people (who moved, who's in its groups) and the groups that are new with it (a claim that re-forms two
  // pairs is about those two, not the four that stayed).
  const moved = new Set([...change.moved, ...change.groups.flatMap((g) => g.members), ...change.newcomers]);
  const groups = (change.changed || change.groups).filter((g) => g.members.length > 1);
  const grouping = GROUPING_KINDS.has(change.kind);
  for (const n of eps) {
    const p = research[n];
    if (!p) continue;
    onTape = true;
    const cast = Array.isArray(p.castaways) ? p.castaways : [];
    const say = { episode: n, late: n > change.from[0], structured: [], text: [] };
    // newGroup carries a grouping change only on someone it moved: anyone else's is another change, or a mistake.
    const newGroup = grouping ? cast.filter((c) => moved.has(c.name) && typeof c.newGroup === "string" && c.newGroup.trim()) : [];
    if (newGroup.length) say.structured.push({ field: "newGroup", count: newGroup.length, of: moved.size, values: [...new Set(newGroup.map((c) => c.newGroup))] });
    if (change.kind === "merge" && p.merged === "yes") say.structured.push({ field: "merged", value: "yes" });
    if (change.kind === "role") {
      const recruits = cast.filter((c) => c.recruitedAsTraitor === "yes" || c.becameTraitor === "yes").map((c) => c.name);
      if (recruits.length) say.structured.push({ field: "recruitedAsTraitor", who: recruits });
    }
    const matched = (text) => words.filter((w) => plain(text).includes(plain(w)));
    if (hasWord(p.rulesNote, words)) say.text.push({ field: "rulesNote", quote: p.rulesNote, words: matched(p.rulesNote) });
    if (hasWord(p.summary, words)) say.text.push({ field: "summary", quote: p.summary, words: matched(p.summary) });
    const notes = cast.filter((c) => c.notableTwist).map((c) => ({ name: c.name, note: c.notableTwist }));
    const firsts = new Map();
    for (const c of cast) firsts.set(firstName(c.name), (firsts.get(firstName(c.name)) || 0) + 1);
    if (groups.length) {
      const named = groups.filter((g) =>
        g.name
          ? g.members.some((m) => notes.some((x) => x.name === m && mentions(x.note, g.name, { whole: true })))
          : g.members.some((m) => notes.some((x) => x.name === m && g.members.some((o) => o !== m && mentions(x.note, o, { firsts }))))
      );
      if (named.length) say.text.push({ field: "notableTwist", groupsNamed: named.length, of: groups.length, notes: notes.filter((x) => moved.has(x.name) && hasWord(x.note, words)).length });
    } else {
      const hits = notes.filter((x) => hasWord(x.note, words));
      if (hits.length) say.text.push({ field: "notableTwist", notes: hits.length, quote: hits[0].note });
    }
    if (say.structured.length || say.text.length) found.push(say);
  }
  const inTime = found.filter((f) => !f.late);
  const verdict = !onTape
    ? "not on tape"
    : inTime.some((f) => f.structured.length)
      ? "acted on"
      : found.some((f) => f.structured.length)
        ? "acted on late"
        : found.length
          ? "free text only"
          : "nothing";
  return { verdict, found };
}

// ---------- the checks a fixture must pass ----------

/** A fixture's problems (an empty list is a sound one): numbering, play kinds, exits, spells in order, nobody twice in one. */
function timelineProblems(t) {
  const p = [];
  if (!t || !t.show || !Number.isInteger(t.season)) p.push("no show or season");
  if (!t || !Array.isArray(t.episodes) || !t.episodes.length) return [...p, "no episodes"];
  t.episodes.forEach((e, i) => {
    if (e.n !== i + 1) p.push(`episode ${i + 1} is numbered ${e.n}`);
    if (!PLAYS.includes(e.play)) p.push(`episode ${e.n}: play ${e.play} isn't one of ${PLAYS.join(", ")}`);
    for (const o of e.out || []) if (!OUTS.includes(o.how)) p.push(`episode ${e.n}: ${o.name} left by ${o.how}`);
    if (e.playShown && !isMoment(e.playShown, t.episodes.length)) p.push(`episode ${e.n}: playShown must be [episode, "start" | "mid" | "end"]`);
  });
  const outs = t.episodes.flatMap((e) => (e.out || []).map((o) => o.name));
  for (const n of new Set(outs)) if (outs.filter((x) => x === n).length > 1) p.push(`${n} leaves twice`);
  const left = exits(t);
  const last = t.episodes.length;
  for (const [layer, g] of Object.entries(t.groupings || {})) {
    if (!g || !Array.isArray(g.spells) || !g.spells.length) {
      p.push(`${layer}: no spells`);
      continue;
    }
    g.spells.forEach((s, i) => {
      if (!isMoment(s.from, last) || s.from[1] === "end") return p.push(`${layer} spell ${i}: from must be [episode, "start" | "mid"]`);
      if (s.shown && !isMoment(s.shown, last)) return p.push(`${layer} spell ${i}: shown must be [episode, "start" | "mid" | "end"]`);
      if (s.shown && cmp(s.shown, s.from) > 0 && !(s.shown[0] === s.from[0])) p.push(`${layer} spell ${i}: shown after it took effect`);
      if (i && isMoment(g.spells[i - 1].from, last) && cmp(g.spells[i - 1].from, s.from) > 0) p.push(`${layer} spell ${i}: out of order`);
      const everyone = [...(s.groups || []).flatMap((x) => x.members), ...(s.alone || [])];
      for (const m of new Set(everyone)) if (everyone.filter((x) => x === m).length > 1) p.push(`${layer} spell ${i}: ${m} is in it twice`);
      for (const m of everyone) if (!inFor(left, m, s.from[0])) p.push(`${layer} spell ${i}: ${m} left before Episode ${s.from[0]}`);
    });
  }
  for (const tw of t.twists || []) {
    if (!KINDS.includes(tw.kind)) p.push(`twist ${tw.what}: kind ${tw.kind}`);
    if (!isMoment(tw.from, last) || (tw.shown && !isMoment(tw.shown, last))) p.push(`twist ${tw.what}: from and shown must be [episode, "start" | "mid" | "end"]`);
  }
  return p;
}

/** [episode, "start" | "mid" | "end"], the episode one of the season's. */
function isMoment(m, last) {
  return Array.isArray(m) && Number.isInteger(m[0]) && m[0] >= 1 && m[0] <= last && Object.prototype.hasOwnProperty.call(AT, m[1]);
}

// ---------- printing ----------

const ep = (from) => (from[1] === "mid" ? `${from[0]} (mid)` : String(from[0]));
const groupLine = (groups) => {
  if (!groups.length) return "none";
  const sizes = groups.map((g) => g.members.length);
  const named = groups.filter((g) => g.name).map((g) => `${g.name} ${g.members.length}`);
  if (named.length === groups.length) return named.join(", ");
  const by = {};
  for (const s of sizes) by[s] = (by[s] || 0) + 1;
  return Object.entries(by)
    .map(([s, c]) => `${c} × ${s}`)
    .join(" + ");
};
const changeLine = (c) => {
  const bits = [];
  if (c.kind === "swap") bits.push(c.allNew ? "every group new" : `${c.moved.length} moved`);
  if (c.newcomers.length) bits.push(`new: ${c.newcomers.join(", ")}`);
  if (c.groups.length && c.kind !== "swap") bits.push(groupLine(c.groups));
  return bits.join("; ");
};
const saidLine = (s) => {
  if (s.verdict === "not on tape") return "not on tape";
  if (!s.found.length) return "nothing";
  return s.found
    .map((f) => {
      const bits = [
        ...f.structured.map((x) => (x.field === "newGroup" ? `newGroup on ${x.count}` : x.field === "merged" ? "merged: yes" : `${x.field}: ${x.who.join(", ")}`)),
        ...f.text.map((x) =>
          x.field === "notableTwist"
            ? x.of
              ? `notableTwist names ${x.groupsNamed} of ${x.of} groups`
              : `notableTwist (${x.notes} notes)`
            : `${x.field} ("${x.words.join('", "')}")`
        ),
      ];
      return `E${f.episode}${f.late ? " (late)" : ""}: ${bits.join(", ")}`;
    })
    .join("; ");
};

function study(show, season, { md = false } = {}) {
  const t = loadTimeline(show, season);
  const research = researchOf(show, season);
  const onTape = Object.keys(research).length > 0;
  const lines = [];
  const say = (s) => lines.push(s);
  say(md ? `### ${t.title} (${show} ${season})` : `== ${t.title} (${show} ${season})${onTape ? `, research on tape for ${Object.keys(research).length} episodes` : ", not on tape"}`);
  const layers = Object.keys(t.groupings || {}).filter((l) => !t.groupings[l].label);
  if (md) say(`\n| Ep | Phase | Played as | ${layers.map((l) => `${l}s in play`).join(" | ")}${layers.length ? " | " : ""}Went home |\n|---|---|---|${layers.map(() => "---|").join("")}---|`);
  for (const e of t.episodes) {
    const cells = layers.map((l) =>
      groupsIn(t, l, e.n)
        .map((x) => (x.at === "mid" ? `then ${groupLine(x.groups)} (mid)` : groupLine(x.groups)))
        .join(", ") || "-"
    );
    const out = (e.out || []).map((o) => `${o.name} (${o.how})`).join(", ") || "-";
    if (md) say(`| ${e.n} | ${e.phase} | ${e.play} | ${cells.join(" | ")}${cells.length ? " | " : ""}${out} |`);
    else say(`E${String(e.n).padStart(2)} ${e.phase.padEnd(16)} ${e.play.padEnd(11)} ${cells.join(" | ").padEnd(28)} out: ${out}`);
  }
  const cs = changes(t);
  say(md ? `\n| Took effect | Kind | Brought in | What | Research said | The engine today |\n|---|---|---|---|---|---|` : "\nchanges:");
  for (const c of cs) {
    const s = researchSays(t, c, research);
    const today = { "acted on": "acts on it", "acted on late": "acts on it, late", "free text only": "can't act (free text)", nothing: "nothing to act on" }[s.verdict] || "-";
    const what = [changeLine(c), c.what].filter(Boolean).join(". ");
    if (md) say(`| ${ep(c.from)} | ${c.kind} | ${c.brought} | ${what.replace(/\|/g, "/")} | ${saidLine(s)} | ${today} |`);
    else say(`  ${ep(c.from).padEnd(8)} ${c.kind.padEnd(22)} ${c.brought.padEnd(34)} ${what.slice(0, 90)}\n           research: ${saidLine(s)} -> ${today}`);
  }
  for (const l of layers) {
    for (const exitsEnd of [false, true]) {
      const { groups, never } = lifetimes(t, l, { exitsEnd });
      const sum = lifetimeSummary(groups);
      const by = Object.entries(sum.by)
        .map(([n, c]) => `${c} lasted ${n}`)
        .join(", ");
      const label = exitsEnd ? "exact members (an exit ends it)" : "an exit doesn't end it";
      say(`${md ? "\n" : ""}${l} lifetimes, ${label}: ${sum.count} groups; ${by}; longest ${sum.longest}, median ${sum.median}${never.length ? `; ${never.length} shown but never played (${never.map((x) => x.key).join("; ")})` : ""}`);
      if (!exitsEnd && !md)
        for (const g of groups.filter((x) => x.episodes.length > 1)) say(`    ${g.name ? g.name + ": " : ""}${g.key}  E${g.first}-E${g.last} (${g.episodes.length}), ${g.ended}`);
    }
  }
  if (!layers.length) say(md ? "\nNo groupings: everyone plays for themselves." : "no groupings");
  return lines.join("\n");
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const md = args.includes("--md");
  const check = args.includes("--check");
  const rest = args.filter((a) => !a.startsWith("--"));
  if (rest.length === 1 || (rest.length >= 2 && !/^\d+$/.test(rest[1]))) {
    console.error("usage: format-study.js [<show> <season number>] [--md] [--check]");
    process.exit(2);
  }
  const which = rest.length >= 2 ? [{ show: rest[0], season: Number(rest[1]) }] : fixtures();
  let bad = 0;
  for (const { show, season } of which) {
    if (check) {
      const p = timelineProblems(loadTimeline(show, season));
      console.log(`${show} ${season}: ${p.length ? p.join("; ") : "sound"}`);
      bad += p.length;
      continue;
    }
    console.log(study(show, season, { md }));
    console.log("");
  }
  process.exit(bad ? 1 : 0);
}

module.exports = {
  FIXTURES,
  KINDS,
  PLAYS,
  loadTimeline,
  fixtures,
  researchOf,
  exits,
  playedEpisodes,
  spellEpisodes,
  groupsIn,
  stateAtEnd,
  lifetimes,
  lifetimeSummary,
  broughtIn,
  changes,
  researchSays,
  timelineProblems,
  study,
};
