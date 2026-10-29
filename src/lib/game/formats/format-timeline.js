// The format's state over time (docs/PLAN-start-a-game-gpt.md, "Formats nobody announced", step F3; the study behind it is
// docs/STUDY-format-changes.md). Built from each episode's research (its format section, F2: format-state.js), it says for
// every episode who is with whom at its end (going into the next), whether that's sure and why not, how the episode was
// played and in which groups, what changed in it (our comparison of its state with the one before, crossed with the answer's
// own account: the answer's labels are a cross-check, never the truth) and which groups went home whole (worked out from
// the exits, not the answer's word). Over the season: each group's lifetime (who's in it, from which episode, until which,
// what ended it), each spell of a grouping (the groups as a whole, from one change to the next) and the newcomers.
//
// What reads it reads it through the readers at the end: a question about a group (A6's choices), group slots (A10), the
// groups in play (A11's teams, "follow the people"), side stages and a stage started by a change (A12), each with the
// fallback its spec carries for a state that's unsure or not known. The timeline is built from every report at once, so a
// corrected report works out everything after it again; timelineDiff says what moved, for undoing what a report later
// corrected had started.
//
// The user's open questions from F1 (the plan's Noticed), taken as recommended until the user says otherwise: someone going
// home doesn't end a tribe or a team, but a pair down to one is no group (1); a group is its exact members, so any join or
// move ends it and the same people together again later are a new group (4); a group in force at an episode's start is the
// one that played it, a change partway through taking effect after (3).
//
// Plain CommonJS, browser-safe, like everything in formats/.

const FS = require('./format-state.js');

const low = (v) => String(v || '').trim().toLowerCase();
const { keyOf } = FS;
const GROUPING = new Set(FS.GROUPING_KINDS);
// The ways an episode is played without the groups going in (The Challenge 41's individual Episode 9 between paired ones).
const APART = new Set(['individuals', 'everyone']);
// How a game meets a change it can't play through (the 8 PM note): carry on with what's left, void that episode's question
// and its points, or start the game's next stage. Which one a spec carries, and the default, are the user's (A10-A12's
// Noticed); every reader takes it as an option, 'void' when none is given: the safe one.
const FALLBACKS = ['carry-on', 'void', 'next-stage'];
// "Major" by default for a stage a change starts (F1's question 5, its recommendation; the user's to decide): the grouping
// kinds, a swap only when no group is left as it was ('swap-all'). A twist or a role never moves a game's structure.
const MAJOR = ['teams-formed', 'pairs-formed', 'split-into-individuals', 'merge', 'swap-all'];
const TRIGGER_KINDS = [...FS.KINDS.filter((k) => k !== 'twist' && k !== 'role'), 'swap-all'];

const uniq = (names) => {
  const seen = new Set();
  return (names || []).filter((n) => n && !seen.has(low(n)) && seen.add(low(n)));
};
const divided = (s) => !!s && Array.isArray(s.groups) && s.groups.length > 1;
const structural = (c) => GROUPING.has(c.kind) && c.kind !== 'newcomer';

/** The episode a change takes effect from: its own `from`, else this one for a change at the start or partway, else the next. */
function effective(c, n) {
  if (Number.isInteger(c.from)) return c.from;
  return c.when === 'start' || c.when === 'mid' ? n : n + 1;
}

/**
 * One episode's report from its stored research (the combined answer): { episode, state: its format section, left: who it
 * says went home, merged }. An answer from before the section was asked has no state. Pure.
 */
function reportFrom(episode, payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const st = p.formatState && typeof p.formatState === 'object' ? p.formatState : null;
  const left = (Array.isArray(p.castaways) ? p.castaways : []).filter((c) => c && c.leftTheGame === 'yes' && c.name).map((c) => String(c.name));
  return { episode, state: st, left, merged: typeof p.merged === 'string' ? p.merged : null };
}

/**
 * Our changes crossed with the answer's, for episode n (format-state.js crossCheck, with what the timeline adds): a change
 * the answer announces for later than the next episode is `ahead` (it can't show in this episode's groups yet); our
 * divided-to-not-divided matches the answer's merge or split either way, taking its kind (an empty list and one group of
 * everyone read alike); a merge our comparison finds is the answer's too when it says `merged` for the first time; and the
 * episode played without the groups going in (`by: 'played'`, from the answer's own `playedAs`) is unsure unless the answer
 * says the split too. Each change gets an id, stable while the reports up to it are.
 */
function crossed(ours, theirs, n, { mergedNow = false, mergedBefore = false } = {}) {
  const said = (theirs || []).map((c) => ({ ...c }));
  const out = [];
  const near = (c) => c.from == null || c.from === n || c.from === n + 1;
  const ended = (k) => k === 'merge' || k === 'split-into-individuals';
  for (const c of ours || []) {
    const near0 = c.by === 'played' ? (x) => x.from == null || x.from <= n : near;
    let i = said.findIndex((x) => x.kind === c.kind && near0(x));
    if (i < 0 && ended(c.kind)) i = said.findIndex((x) => ended(x.kind) && near0(x));
    const base = { moved: c.moved || [], newcomers: c.newcomers || [], allNew: !!c.allNew };
    if (i >= 0) {
      const t = said.splice(i, 1)[0];
      out.push({ kind: t.kind, from: t.from ?? c.from ?? null, when: t.when ?? c.when ?? null, sure: t.sure === 'high' ? 'high' : 'low', by: 'both', what: t.what || '', ...base });
    } else if (ended(c.kind) && c.by !== 'played' && mergedNow && !mergedBefore) {
      out.push({ kind: 'merge', from: null, when: null, sure: 'high', by: 'both', what: 'research says the game merged', ...base });
    } else out.push({ kind: c.kind, from: c.from ?? null, when: c.when ?? null, sure: 'low', by: c.by || 'ours', what: '', ...base });
  }
  for (const t of said) {
    const ahead = Number.isInteger(t.from) && t.from > n + 1;
    const grouping = GROUPING.has(t.kind);
    out.push({ kind: t.kind, from: t.from ?? null, when: t.when ?? null, sure: grouping ? 'low' : t.sure === 'high' ? 'high' : 'low', by: grouping ? 'theirs' : 'said', what: t.what || '', moved: [], newcomers: [], allNew: false, ...(ahead ? { ahead: true } : {}) });
  }
  const seen = new Map();
  return out.map((c) => {
    const k = `${n}:${c.kind}`;
    seen.set(k, (seen.get(k) || 0) + 1);
    return { id: seen.get(k) > 1 ? `${k}:${seen.get(k)}` : k, episode: n, ...c };
  });
}

/**
 * The season's format state over time, from its episodes' reports (reportFrom). `cast`: the names research asks about (who
 * is still in, so someone nowhere shows); `start`: what's known going into the first episode built ({ after: k, state, sure }:
 * the state at episode k's end, k 0 before the premiere; unsure unless `sure`, as a blind replay assumes it), else nothing is
 * until the first report.
 * Never throws on a report: one that doesn't say who is with whom carries the last known groups on, unsure. Pure.
 */
function buildTimeline(reports, { cast = [], start = null } = {}) {
  const byEp = new Map();
  for (const r of reports || []) if (r && Number.isInteger(r.episode) && r.episode >= 1) byEp.set(r.episode, r);
  const first = start && Number.isInteger(start.after) ? start.after + 1 : 1;
  const last = Math.max(0, ...byEp.keys());
  const tl = { episodes: [], groups: [], spells: [], newcomers: [], cast: uniq(cast), from: first, last, start: null };
  if (last < first) return tl;

  const gone = new Set();
  const known = new Set(tl.cast.map(low));
  let prev = null;
  if (start && start.state && Array.isArray(start.state.groups)) {
    const groups = start.state.groups.filter((g) => g && g.members && g.members.length > 1).map((g) => ({ id: `${start.after}:${keyOf(g.members)}`, name: g.name || null, members: uniq(g.members) }));
    prev = { episode: start.after, end: { groups, alone: uniq(start.state.alone || []) }, sure: !!start.sure, assumed: !start.sure };
    tl.start = { after: start.after, groups, alone: prev.end.alone, sure: !!start.sure };
    for (const m of [...groups.flatMap((g) => g.members), ...prev.end.alone]) known.add(low(m));
  }
  let mergedBefore = false;
  for (let n = first; n <= last; n++) {
    const r = byEp.get(n) || null;
    const st = r && r.state && typeof r.state === 'object' ? r.state : null;
    const left = uniq(r ? r.left : []);
    const leftLow = new Set(left.map(low));
    const isIn = (m) => !gone.has(low(m)) && !leftLow.has(low(m));
    const goingIn = prev && prev.end ? prev.end : null;
    const reported = !!(st && Array.isArray(st.groups));
    const newcomers = (st && Array.isArray(st.newcomers) ? st.newcomers : []).filter((x) => x && x.name && !known.has(low(x.name)));
    for (const x of newcomers) {
      known.add(low(x.name));
      tl.newcomers.push({ name: x.name, episode: n, replaces: x.replaces || null, group: x.group || null });
    }

    // Who is with whom at the end: as reported (less anyone it has going home: a group down to one is that person on their
    // own), or carried on from the last known end, less who went home.
    let end = null;
    let carried = null;
    if (reported) {
      const raw = st.groups.filter((g) => g && Array.isArray(g.members)).map((g) => ({ name: g.name || null, members: uniq(g.members.filter(isIn)) }));
      end = { groups: raw.filter((g) => g.members.length > 1), alone: uniq([...(st.alone || []).filter(isIn), ...raw.filter((g) => g.members.length === 1).map((g) => g.members[0])]) };
    } else if (goingIn) {
      const raw = goingIn.groups.map((g) => ({ name: g.name, members: g.members.filter(isIn) }));
      end = { groups: raw.filter((g) => g.members.length > 1), alone: uniq([...goingIn.alone.filter(isIn), ...raw.filter((g) => g.members.length === 1).map((g) => g.members[0])]) };
      carried = prev.carried || prev.episode;
    }
    for (const m of end ? [...end.groups.flatMap((g) => g.members), ...end.alone] : []) known.add(low(m));

    // What changed: our comparison (an episode played apart between two grouped states is a split at its start and the
    // new groups at its end), crossed with the answer's own.
    const playedAs = st ? st.playedAs || 'unknown' : null;
    const apart = !!(reported && divided(goingIn) && divided(end) && APART.has(playedAs));
    const names = newcomers.map((x) => x.name);
    let ours = null;
    if (reported && goingIn) {
      ours = apart
        ? [{ kind: 'split-into-individuals', from: n, when: 'start', by: 'played' }, ...FS.changesBetween({ groups: [] }, end, { left, newcomers: names })]
        : FS.changesBetween(goingIn, end, { left, newcomers: names });
    } else if (reported && names.length) ours = [{ kind: 'newcomer', newcomers: names }];
    const mergedNow = !!(r && r.merged === 'yes');
    const changes = crossed(ours, st ? st.changes : [], n, { mergedNow, mergedBefore });
    if (mergedNow) mergedBefore = true;

    // The groups at the end carry on a group going in when they're its exact members, less who went home (Q1 and Q4).
    // Someone the answer before had nowhere (it left them out) joining is that answer filled in, not a join.
    if (end) {
      const before = goingIn && !apart ? goingIn.groups : [];
      const missed = prev && prev.unplaced && prev.unplaced.length ? new Set(prev.unplaced.map(low)) : null;
      const core = (g) => (missed ? g.members.filter((m) => !missed.has(low(m))) : g.members);
      for (const g of end.groups) {
        const was = before.find((p) => keyOf(p.members.filter(isIn)) === keyOf(g.members)) || (missed && before.find((p) => core(g).length > 1 && keyOf(p.members.filter(isIn)) === keyOf(core(g))));
        g.id = was ? was.id : `${n}:${keyOf(g.members)}`;
      }
    }

    // How the episode was played: the groups going in, unless a change at its start made the end's groups the ones that
    // played (Survivor's swaps, the merge), or it was played apart. A change partway through leaves the start's (Q3).
    const startChange = changes.find((c) => structural(c) && !c.ahead && c.by !== 'played' && effective(c, n) === n && c.when === 'start');
    const midChange = changes.find((c) => structural(c) && !c.ahead && effective(c, n) === n && c.when === 'mid');
    // A grouping change one side alone sees, not known to have come at the end, may have come at the start: the play's unsure.
    const doubt = changes.some((c) => structural(c) && !c.ahead && c.by !== 'played' && !(c.by === 'both' && c.sure === 'high') && c.when !== 'end');
    const played = (() => {
      if (apart) return { apart: true, groups: [], mid: null, sure: changes.some((c) => c.by === 'both' && c.sure === 'high' && c.kind === 'split-into-individuals' && c.from != null && c.from <= n) };
      if (startChange && end) return { apart: !divided(end), groups: divided(end) ? end.groups : [], mid: null, sure: startChange.sure === 'high' && startChange.by === 'both' };
      // The premiere, with nothing before it: the groups at its end played it, unless its answer says something changed.
      if (!goingIn && n === 1 && reported && !changes.some((c) => structural(c) && !c.ahead)) return { apart: !divided(end), groups: divided(end) ? end.groups : [], mid: null, sure: true };
      if (!goingIn) return null;
      return { apart: !divided(goingIn), groups: divided(goingIn) ? goingIn.groups : [], mid: midChange && end ? end.groups : null, sure: !!prev.sure && !doubt };
    })();

    // Who went home as a whole group: from the exits and the groups in play at the start, never the answer's word alone.
    const atStart = played && !played.apart && !startChange ? played.groups : [];
    const wentHome = atStart.filter((g) => g.members.length > 1 && g.members.every((m) => leftLow.has(low(m)))).map((g) => ({ group: g.id, members: g.members.slice() }));
    const oursHome = !r ? 'unknown' : wentHome.length ? 'groups' : left.length ? 'individuals' : 'nobody';
    const theirsHome = st ? st.wentHomeAs || 'unknown' : null;

    // Sure: reported, compared with what went in, and every grouping change both sides see (a newcomer, the episode played
    // apart and a change announced for later aside: none of them is about the groups at this end).
    const why = [];
    if (!r) why.push('no research for this episode');
    else if (!st) why.push('its research has no format section');
    else if (!reported) why.push("its research doesn't say who is with whom");
    if (carried) why.push(`the groups are carried on from episode ${carried}`);
    if (reported && !goingIn && changes.some((c) => structural(c) && !c.ahead)) why.push('nothing before it to check its changes against');
    else {
      for (const c of changes) {
        if (!structural(c) || c.ahead || c.by === 'played') continue;
        if (c.by === 'ours') why.push(`our comparison finds a ${c.kind} the answer doesn't say`);
        else if (c.by === 'theirs') why.push(`the answer says ${c.kind}${c.from ? ` from episode ${c.from}` : ''}, but its groups don't show it`);
        else if (c.sure !== 'high') why.push(`the answer isn't sure of the ${c.kind}`);
      }
    }
    if (prev && prev.assumed && n === first && goingIn) why.push('compared with what was assumed before the first episode');

    // Who is still in but nowhere, while the game is divided (an answer that left a pair out).
    const unplaced = [];
    if (end && divided(end) && reported) {
      const placed = new Set([...end.groups.flatMap((g) => g.members), ...end.alone].map(low));
      for (const m of [...tl.cast, ...tl.newcomers.map((x) => x.name)]) if (isIn(m) && !placed.has(low(m))) unplaced.push(m);
    }

    const entry = {
      episode: n,
      reported: !!r,
      known: reported,
      playedAs,
      phase: st ? st.phase || null : null,
      end,
      carried,
      sure: reported && !why.length,
      why,
      played,
      changes,
      left,
      wentHome,
      wentHomeAs: { ours: oursHome, theirs: theirsHome, agree: theirsHome && theirsHome !== 'unknown' && oursHome !== 'unknown' ? theirsHome === oursHome : null },
      newcomers: newcomers.map((x) => ({ name: x.name, replaces: x.replaces || null, group: x.group || null })),
      unplaced,
      merged: r ? r.merged : null,
    };
    tl.episodes.push(entry);
    for (const m of left) gone.add(low(m));
    if (end) prev = entry;
  }
  lifetimes(tl);
  spells(tl);
  return tl;
}

/**
 * Each group's lifetime, onto tl.groups, while the game is divided (one group of everyone, a merged tribe, is no group to
 * ride): { id, name, members (as it formed), now (its members when last seen), shown (the episode whose end first listed
 * it; the start's for one known before the first episode built), played (the episodes it played), from, until, ended (null
 * while it lasts; 'left' when its members went home, 'split', 'merge' or 'changed'), endedAt (the episode whose end it's
 * gone from), endedBy (the change), never (shown, gone before it played), sure (the end that showed it was) }.
 */
function lifetimes(tl) {
  const byId = new Map();
  const goneAfter = new Map();
  const out = new Set();
  const seen = (g, n, sure) => {
    let L = byId.get(g.id);
    if (!L) {
      L = { id: g.id, name: g.name || null, members: g.members.slice(), now: g.members.slice(), shown: n, ends: [], played: [], sure };
      byId.set(g.id, L);
    }
    L.ends.push(n);
    if (g.name) L.name = g.name;
    L.now = g.members.slice();
  };
  if (tl.start && tl.start.groups.length > 1) for (const g of tl.start.groups) seen(g, tl.start.after, tl.start.sure);
  for (const e of tl.episodes) {
    for (const m of e.left) out.add(low(m));
    goneAfter.set(e.episode, new Set(out));
    if (divided(e.end)) for (const g of e.end.groups) seen(g, e.episode, e.sure);
    if (e.played && !e.played.apart) for (const g of e.played.groups) if (byId.has(g.id) && !byId.get(g.id).played.includes(e.episode)) byId.get(g.id).played.push(e.episode);
  }
  for (const L of byId.values()) {
    L.played.sort((a, b) => a - b);
    L.from = L.played.length ? L.played[0] : null;
    L.until = L.played.length ? L.played[L.played.length - 1] : null;
    const lastEnd = L.ends.length ? L.ends[L.ends.length - 1] : tl.from - 1;
    const next = tl.episodes.find((e) => e.episode === lastEnd + 1);
    L.ended = null;
    L.endedAt = null;
    L.endedBy = null;
    if (next && next.end) {
      const gone = goneAfter.get(next.episode);
      const still = L.now.filter((m) => !gone.has(low(m)));
      const why = next.changes.find((c) => structural(c) && !c.ahead && (c.moved.some((m) => L.now.map(low).includes(low(m))) || c.allNew || c.kind === 'merge' || c.kind === 'split-into-individuals'));
      L.ended = still.length <= 1 ? 'left' : why && (why.kind === 'merge' || why.kind === 'split-into-individuals') ? (why.kind === 'merge' ? 'merge' : 'split') : 'changed';
      L.endedAt = next.episode;
      L.endedBy = L.ended === 'left' ? null : why ? why.id : null;
    }
    L.never = L.ended != null && !L.played.length;
    delete L.ends;
  }
  tl.groups = [...byId.values()].sort((a, b) => a.shown - b.shown || (a.from ?? 0) - (b.from ?? 0) || a.id.localeCompare(b.id));
}

/**
 * The spells of a grouping, onto tl.spells: the groups as a whole, from one change to the next. A group going home with its
 * members (a pair voted out together, a tribe losing someone) doesn't end a spell; any other change does, and so does the
 * game no longer being divided. { id, groups (ids), shown, played (the episodes any of its groups played), ended, endedAt,
 * sure (every end it was seen at was) }.
 */
function spells(tl) {
  const byId = new Map(tl.groups.map((g) => [g.id, g]));
  const out = [];
  let cur = null;
  for (const e of tl.episodes) {
    const ids = e.end && divided(e.end) ? e.end.groups.map((g) => g.id) : [];
    const same = cur && ids.length && ids.every((id) => cur.groups.includes(id)) && cur.live.filter((id) => !ids.includes(id)).every((id) => byId.get(id) && byId.get(id).ended === 'left');
    if (same) {
      cur.live = ids;
      cur.sure = cur.sure && e.sure;
      continue;
    }
    if (cur) {
      cur.endedAt = e.episode;
      const by = e.changes.find((c) => structural(c) && !c.ahead);
      cur.ended = by ? by.kind : 'changed';
    }
    cur = ids.length ? { id: `s${e.episode}`, groups: ids.slice(), live: ids, shown: e.episode, ended: null, endedAt: null, sure: e.sure } : null;
    if (cur) out.push(cur);
  }
  // The episodes a spell played: from the episode that showed it, every one played in its groups (a change partway
  // through leaves that episode to the spell it started in, Q3).
  for (const s of out) {
    s.played = tl.episodes
      .filter((e) => e.episode >= s.shown && (s.endedAt == null || e.episode <= s.endedAt) && e.played && !e.played.apart && e.played.groups.length > 1 && e.played.groups.every((g) => s.groups.includes(g.id)))
      .map((e) => e.episode);
    delete s.live;
  }
  tl.spells = out;
}

// ---------- the readers ----------

/** One episode of the timeline, or null. */
function at(tl, n) {
  return (tl && tl.episodes.find((e) => e.episode === n)) || null;
}

/**
 * How the game is organised going into episode n, at its lock: the latest end before n, with whether it's sure (that end
 * was, it's the episode just before, and no change announced earlier for n is unsure), why not, and `ahead`: the changes
 * announced earlier that take effect from n. Pure.
 */
function goingInto(tl, n) {
  const start = tl && tl.start && tl.start.after < n ? { episode: tl.start.after, end: { groups: tl.start.groups, alone: tl.start.alone || [] }, sure: tl.start.sure, why: tl.start.sure ? [] : ['what was known before the first episode built is assumed'] } : null;
  const prev = [...(tl ? tl.episodes : [])].reverse().find((e) => e.episode < n && e.end) || start;
  const ahead = (tl ? tl.episodes : []).filter((e) => e.episode < n).flatMap((e) => e.changes.filter((c) => c.ahead && c.from === n));
  if (!prev) return { known: false, divided: false, groups: null, alone: [], asOf: null, sure: false, why: ['nothing is known yet about who is with whom'], ahead };
  const why = [...prev.why];
  if (prev.episode < n - 1) why.push(`nothing is known since episode ${prev.episode}`);
  for (const c of ahead.filter((x) => structural(x))) why.push(`a ${c.kind} was announced for episode ${n}`);
  return { known: true, divided: divided(prev.end), groups: prev.end.groups, alone: prev.end.alone, asOf: prev.episode, sure: prev.sure && !why.length, why, ahead };
}

/** The groups that played episode n: { apart, groups, mid, sure }, or null when it isn't known. Pure. */
function playedIn(tl, n) {
  const e = at(tl, n);
  return e ? e.played : null;
}

/**
 * A6: the groups a question about a group offers at episode n's lock, with the spec's fallback for a state that isn't sure:
 * 'carry-on' offers the last known groups (flagged), 'void' (the default) and 'next-stage' void the question for that episode
 * (no points either way; next-stage also says the game moves on). Not divided going in: nothing to offer, void. Pure.
 */
function groupChoices(tl, n, { fallback = 'void' } = {}) {
  const g = goingInto(tl, n);
  if (g.known && g.sure) return g.divided ? { choices: g.groups, void: false, sure: true, why: [] } : { choices: [], void: true, sure: true, why: ['the game isn\'t divided into groups going into this episode'] };
  if (fallback === 'carry-on' && g.known && g.divided) return { choices: g.groups, void: false, sure: false, why: g.why };
  return { choices: null, void: true, sure: false, why: g.why, ...(fallback === 'next-stage' ? { nextStage: true } : {}) };
}

/**
 * Whether a group picked at episode n's lock is the group that played it: { held, sure, why }. Not held (it changed at the
 * episode's start, it was played apart, it went home before it): its spec's fallback decides (void: no points either way;
 * carry-on, "follow the people": its members' own results). Null: how the episode was played isn't known. Pure.
 */
function heldThrough(tl, groupId, n) {
  const p = playedIn(tl, n);
  if (!p) return { held: null, sure: false, why: ['how this episode was played isn\'t known'] };
  if (p.apart) return { held: false, sure: p.sure, why: ['it was played without groups'] };
  const g = p.groups.find((x) => x.id === groupId);
  return g ? { held: true, sure: p.sure, why: [] } : { held: false, sure: p.sure, why: ['the group didn\'t play it as it was picked'] };
}

/**
 * A10: group slots (the user's +1 or +2 roster slot that holds a pair or a team). Per group (of a divided game): its slot opens
 * after the episode that announced it (`opensAfter`) and scores from the next, as long as the group lasts; it drops after
 * the last episode the group played. `void`: an episode the slot can't score because the state at its lock wasn't sure, or
 * the group never played after it was shown (F1's Q2: Cara Maria & Leo, Theo & Dee); with 'carry-on' an unsure episode scores,
 * flagged in `unsure`. Pure.
 */
function groupSlots(tl, { fallback = 'void' } = {}) {
  return (tl ? tl.groups : [])
    .map((L) => {
      const could = L.played.filter((n) => n > L.shown);
      const unsure = could.filter((n) => !goingInto(tl, n).sure || !(playedIn(tl, n) || {}).sure);
      const scores = fallback === 'carry-on' ? could : could.filter((n) => !unsure.includes(n));
      const voided = fallback === 'carry-on' ? [] : unsure.slice();
      if (!could.length && L.ended) voided.push(L.shown + 1);
      return { id: L.id, name: L.name, members: L.members, opensAfter: L.shown, scores, void: voided, unsure: fallback === 'carry-on' ? unsure : [], dropsAfter: L.ended ? L.until ?? L.shown : null, ended: L.ended };
    });
}

/**
 * A12: side stages, one per spell of a grouping that held `after` episodes (2 by default; the user's to choose): it opens after
 * the episode it held them by, scores from the next and closes when the grouping changes (points kept). A spell that never
 * held that long opens nothing (The Challenge 41's rotating pairs, all of The Challenge 39), and nor does one already gone
 * in the report of the episode it would open after (re-paired at that episode's end); one changed at the next episode's
 * start was still there when it opened (Survivor 49's swap tribes: opened after 5, closed by the swap at 6, nothing
 * scored). `sure`: every end it was seen at was; an unsure one is the safe fallbacks' only. Pure.
 */
function sideStages(tl, { after = 2 } = {}) {
  return (tl ? tl.spells : []).map((s) => {
    const opensAfter = s.played[after - 1];
    if (opensAfter == null || (s.ended && s.endedAt <= opensAfter)) return { spell: s.id, groups: s.groups, opens: false, held: s.played.length };
    return { spell: s.id, groups: s.groups, opens: true, held: s.played.length, opensAfter, scores: s.played.slice(after), closesAfter: s.ended ? s.played[s.played.length - 1] : null, ended: s.ended, sure: s.sure };
  });
}

/**
 * A12: the changes a stage starts on, of the spec's kinds (MAJOR by default; 'swap-all' a swap that left no group as it was,
 * 'swap' any swap; a twist or a role never): `act` the sure ones (both sides saw it, the answer sure), each with the episode it
 * takes effect from; `held` the unsure ones, flagged and never acted on. Pure.
 */
function stageTriggers(tl, kinds = MAJOR) {
  const want = new Set((kinds || []).filter((k) => TRIGGER_KINDS.includes(k)));
  const act = [];
  const held = [];
  for (const e of tl ? tl.episodes : []) {
    for (const c of e.changes) {
      const named = want.has(c.kind) || (c.kind === 'swap' && c.allNew && want.has('swap-all'));
      if (!named) continue;
      const t = { id: c.id, kind: c.kind, allNew: c.allNew, from: effective(c, e.episode), when: c.when, episode: e.episode, what: c.what };
      (c.sure === 'high' && (c.by === 'both' || c.by === 'said') && !c.ahead ? act : held).push(t);
    }
  }
  return { act, held };
}

/** Who is still in going into episode n: the cast and anyone who came in before n, less who went home before it. Pure. */
function castAt(tl, n) {
  const gone = new Set((tl ? tl.episodes : []).filter((e) => e.episode < n).flatMap((e) => e.left.map(low)));
  return uniq([...(tl ? tl.cast : []), ...(tl ? tl.newcomers : []).filter((x) => x.episode < n).map((x) => x.name)]).filter((m) => !gone.has(low(m)));
}

/**
 * F3 part 2: the newcomers still in going into episode n who aren't among `names` (the cast research asks about), as research
 * named them: asked about like anyone from the episode after the one they came in, so they get a checklist entry, results
 * and exits. A name matches only exactly (any case): a loose match could make a newcomer someone already on the list. Pure.
 */
function newcomersIn(tl, n, names = []) {
  const asked = new Set((names || []).map(low));
  const gone = new Set((tl ? tl.episodes : []).filter((e) => e.episode < n).flatMap((e) => e.left.map(low)));
  return uniq((tl ? tl.newcomers : []).filter((x) => x.episode < n && !gone.has(low(x.name)) && !asked.has(low(x.name))).map((x) => x.name));
}

/**
 * F3 part 2: who research says came in that the season's cast (`names`) doesn't have yet, for the desk: adding someone to the
 * cast every league sees stays a person's, so this is a cue, as data: [{ name, episode (the one research says they came in),
 * replaces, group, leftIn (the episode they went home in, or null) }]. Pure.
 */
function newcomerCues(tl, names = []) {
  const asked = new Set((names || []).map(low));
  return (tl ? tl.newcomers : [])
    .filter((x) => !asked.has(low(x.name)))
    .map((x) => {
      const out = (tl.episodes || []).find((e) => e.episode >= x.episode && e.left.some((m) => low(m) === low(x.name)));
      return { name: x.name, episode: x.episode, replaces: x.replaces || null, group: x.group || null, leftIn: out ? out.episode : null };
    });
}

// The words for how the timeline says the groups going in were played (F3 part 2: the season's word beside the format section).
const PLAY_WORD = { tribes: 'tribe', teams: 'team' };

/**
 * F3 part 2: the season's word for its named groups going into episode n, when the timeline says it (they were played as
 * tribes or teams, and aren't pairs: staging moves nobody onto a pair); else null, and the show's own word stands (its data:
 * Survivor's tribe, Dancing with the Stars' couple). The prompt's lines beside the format section and newGroup's read it. Pure.
 */
function groupWord(tl, n) {
  const g = goingInto(tl, n);
  if (!g.known || !g.divided || FS.isPairs(g.groups)) return null;
  const e = at(tl, g.asOf);
  const said = e && e.carried ? at(tl, e.carried) : e;
  return (said && PLAY_WORD[said.playedAs]) || null;
}

/**
 * Whether a set of groups is pairs the league doesn't hold (FormatStates.movesFromState stages nobody onto them): pairs, none
 * of which is a group the league has by name (`tribes`, the league's group names). Those live only in the timeline. Anything
 * else stays the league's: named tribes and teams are staged as moves, and a set of small tribes one of which the league has
 * (Survivor late in its pre-merge, an answer leaving a tribe unnamed or spelling it its own way) is still its tribes. Pure.
 */
function unstaged(groups, tribes = []) {
  const have = new Set((tribes || []).map((t) => FS.tribeKey(t)));
  const list = (groups || []).filter((g) => g && g.members && g.members.length > 1);
  if (!list.length || !FS.isPairs(list)) return false;
  return !list.some((g) => g.name && have.has(FS.tribeKey(g.name)));
}

/** A group's name as a player reads it: its own, else its members ("Ann & Bea", "Ann, Bea & Cy"). */
function groupLabel(g) {
  if (g.name) return g.name;
  const m = g.members || [];
  return m.length <= 2 ? m.join(' & ') : `${m.slice(0, -1).join(', ')} & ${m[m.length - 1]}`;
}

/**
 * A6 on F3 (part 2): the groups a group question asked each episode offers and is graded on, per episode, where the timeline
 * is their source: from the first episode going into which the game is divided into pairs the league doesn't hold (unstaged:
 * The Challenge's pairs), and every episode after it (one played by everyone, or each for themselves, offers none) until
 * tribes or teams are going in again, and (F4) where the league's own groups would be read, an episode research says was
 * played in such pairs when nothing said so going into it (a paired season's premiere), or without groups (by everyone, each for
 * themselves), or going into which nobody is in a group: nothing offered, so it's off, through `through` (the league's latest episode: a lock past the last report is still the
 * timeline's, its groups the last known, unsure). Tribes and teams stay the league's own (its staged tribe moves, which a person
 * accepts), so a season of them (Survivor) has no entry here and plays as before. `cast`: the league's castaways ({ id, name });
 * `resolve(name)`: a member's castaway id (the league's forgiving match), else an exact match by name; `tribes`: the league's
 * group names. Map n -> { offered: [{ id, name, members: castaway ids }], byCastaway: Map castaway id -> the group offered,
 * lockSure: the state going in was, why: why not, played: null while episode n has no report and none after it, else { sure,
 * held: the offered groups that played it as offered } }. An episode with research but no format section, or none while a
 * later one has it, played unsure. A group offered whose members all went home in the episode held (nobody else was with them
 * at its end): a whole pair voted out together. Pure.
 */
function groupFacts(tl, { cast = [], tribes = [], resolve = null, through = 0 } = {}) {
  const out = new Map();
  if (!tl || !tl.episodes.length) return out;
  const byName = new Map((cast || []).filter((c) => c && c.id && c.name).map((c) => [low(c.name), c.id]));
  const idOf = (m) => (resolve && resolve(m)) || byName.get(low(m)) || null;
  let source = false;
  for (let n = tl.from; n <= Math.max(tl.last + 1, Number.isInteger(through) ? through : 0); n++) {
    const g = goingInto(tl, n);
    if (g.known && g.divided && unstaged(g.groups, tribes)) source = true;
    else if (g.known && g.divided) source = false;
    // F4 (the blind replays): where the league's own groups would be read, the timeline still knows when they aren't who
    // plays with whom, and the episode is its with nothing offered (off, no points either way), never graded on them:
    //   - pairedNow: research says it was played in pairs the league doesn't hold, when nothing said so going in. A paired
    //     season's premiere (The Challenge 41's: its own pairs are in no report, the section being the state at its end, so it's
    //     its `playedAs` and the pairs at its end; the league's groups were the cast list's labels, Vets and New Threats), or
    //     pairs at an episode's start after everyone played together;
    //   - apartNow: its own report says it was played without groups, by everyone or each for themselves, and nobody is in a
    //     group at its end either (The Challenge 40's 1 and 10: its league's groups are the eras, teams only in 3-9; Survivor's
    //     merge); one played alone between grouped states (an individual immunity before a merge) stays the league's;
    //   - noneGoingIn: nobody is in a group going into it (each for themselves, one group of everyone), so nothing is offered
    //     at its lock either.
    const e = at(tl, n);
    const pairedNow =
      !source &&
      !!e &&
      e.reported &&
      ((!!e.played && !e.played.apart && e.played.groups.length > 1 && unstaged(e.played.groups, tribes)) ||
        (e.playedAs === 'pairs' && !!e.end && e.end.groups.length > 1 && unstaged(e.end.groups, tribes)));
    const apartNow = !source && !pairedNow && !!e && e.reported && APART.has(e.playedAs) && !divided(e.end);
    const noneGoingIn = !source && !pairedNow && g.known && !g.divided;
    if (!source && !pairedNow && !apartNow && !noneGoingIn) continue;
    const groups = source && g.known && g.divided ? g.groups : [];
    const offered = groups.map((x) => ({ id: x.id, name: groupLabel(x), members: x.members.map(idOf).filter(Boolean), names: x.members }));
    const byCastaway = new Map(offered.flatMap((x) => x.members.map((id) => [id, x.id])));
    let played = null;
    if (e && e.reported && e.played) {
      const ids = new Set(e.played.apart ? [] : e.played.groups.map((x) => x.id));
      const left = new Set(e.left.map(low));
      const whole = (x) => x.names.length > 1 && x.names.every((m) => left.has(low(m)));
      played = { sure: !!e.played.sure && e.known, held: new Set(offered.filter((x) => ids.has(x.id) || (!e.played.apart && whole(x))).map((x) => x.id)) };
    } else if (e) played = { sure: false, held: new Set() };
    const why = pairedNow ? ["who played with whom in this episode wasn't known going into it"] : apartNow && !noneGoingIn ? ['it was played without groups'] : g.why;
    const lockSure = (source || noneGoingIn) && !pairedNow ? !!g.sure : false;
    // Why an entry the league's own groups would otherwise have answered is off, so the sheet and the verdict can say so:
    // 'apart', played without groups; 'unknown', played in groups nobody knew going in (pairedNow, or groups drawn at the start
    // of an episode nobody was in one going into: The Challenge 39's teams); null before its report (nobody in a group going in,
    // as far as is known) and on the timeline's own entries.
    const offAs = pairedNow ? 'unknown' : apartNow ? 'apart' : noneGoingIn && e && e.reported ? (APART.has(e.playedAs) ? 'apart' : 'unknown') : null;
    out.set(n, { offered: offered.map(({ names, ...x }) => x), byCastaway, lockSure, why, played, off: offAs });
  }
  return out;
}

/**
 * What a corrected report changed: the first episode the two timelines tell differently (its end, how it was played or its
 * changes), the changes gone, new or told differently (by id: what a stage started on a change now gone has to undo), and the
 * groups whose lifetime moved. Pure.
 */
function timelineDiff(before, after) {
  const sig = (e) =>
    e
      ? JSON.stringify([
          e.end ? [e.end.groups.map((g) => g.id).sort(), [...e.end.alone].map(low).sort()] : null,
          e.played ? [e.played.apart, e.played.groups.map((g) => g.id).sort(), e.played.sure] : null,
          e.sure,
          e.changes.map((c) => [c.id, c.from, c.when, c.sure, c.by]),
        ])
      : null;
  const eps = [...new Set([...before.episodes, ...after.episodes].map((e) => e.episode))].sort((a, b) => a - b);
  const from = eps.find((n) => sig(at(before, n)) !== sig(at(after, n))) ?? null;
  const changeMap = (tl) => new Map(tl.episodes.flatMap((e) => e.changes.map((c) => [c.id, JSON.stringify([c.kind, effective(c, e.episode), c.sure, c.by, c.allNew])])));
  const a = changeMap(before);
  const b = changeMap(after);
  const groupMap = (tl) => new Map(tl.groups.map((g) => [g.id, JSON.stringify([g.played, g.ended, g.endedAt])]));
  const ga = groupMap(before);
  const gb = groupMap(after);
  return {
    from,
    changes: { gone: [...a.keys()].filter((k) => !b.has(k)), added: [...b.keys()].filter((k) => !a.has(k)), moved: [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k)) },
    groups: { gone: [...ga.keys()].filter((k) => !gb.has(k)), added: [...gb.keys()].filter((k) => !ga.has(k)), moved: [...ga.keys()].filter((k) => gb.has(k) && ga.get(k) !== gb.get(k)) },
  };
}

module.exports = { FALLBACKS, MAJOR, TRIGGER_KINDS, effective, reportFrom, crossed, buildTimeline, at, goingInto, playedIn, groupChoices, heldThrough, groupSlots, sideStages, stageTriggers, castAt, newcomersIn, newcomerCues, groupWord, unstaged, groupLabel, groupFacts, timelineDiff };
