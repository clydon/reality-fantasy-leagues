// The format section of episode research (docs/PLAN-start-a-game-gpt.md, "Formats nobody announced", step F2; the study
// behind it is docs/STUDY-format-changes.md). Every show's research answers it: how the game is organised at the END of the
// episode, going into the next one (how the episode was played, the phase, who is grouped with whom, who's on their own,
// who's new, whether a whole group went home) and what changed in it, each change one kind from a small vocabulary with
// when it came in, the episode it takes effect from and how sure the answer is. The words asked live with the rest of the
// prompt (db/episode-research.js); this is what's shared with what reads the answers: the vocabulary, the loose read of an
// answer (a bad value is repaired and reported, never a failed run), the checks a reviewer sees, and our own comparison of
// two states (changesBetween), which is the truth about what changed: the bot's own `changes` are a cross-check, and where
// the two disagree the change is unsure (crossCheck). F3 builds the engine's format state over time on these.
//
// The vocabulary, the state's shape and the prompt's words are the user's to approve when F2 merges (the study says so).
//
// Plain CommonJS, browser-safe, like everything in formats/.

// How this episode's main challenge or vote treated people (`unknown` when the sources don't say).
const PLAYED_AS = ['everyone', 'tribes', 'teams', 'pairs', 'individuals', 'mixed', 'none', 'unknown'];
// How people left this episode: on their own, a whole pair or team together, nobody left.
const WENT_HOME_AS = ['individuals', 'groups', 'nobody', 'unknown'];
// What kind of change (the study's vocabulary). The first six are about who is grouped with whom, which our code can see by
// comparing two states; the last three it can't, so only the answer says them.
const KINDS = ['teams-formed', 'pairs-formed', 'split-into-individuals', 'merge', 'swap', 'newcomer', 'new-phase', 'twist', 'role'];
const GROUPING_KINDS = ['teams-formed', 'pairs-formed', 'split-into-individuals', 'merge', 'swap', 'newcomer'];
// When in the episode a change came in: at its start, partway through, at its end (going into the next).
const WHEN = ['start', 'mid', 'end'];
const SURE = ['high', 'low'];

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const low = (v) => String(v || '').trim().toLowerCase();
const keyOf = (members) => [...members].map(low).sort().join(' + ');

// A value said a little differently ("pair", "Individual", "split into individuals"), per list, read as the list's own.
const ALIASES = {
  playedAs: { individual: 'individuals', solo: 'individuals', pair: 'pairs', team: 'teams', tribe: 'tribes', together: 'everyone', all: 'everyone' },
  wentHomeAs: { individual: 'individuals', group: 'groups', pairs: 'groups', pair: 'groups', teams: 'groups', team: 'groups', none: 'nobody', 'no one': 'nobody' },
  kind: {
    'teams formed': 'teams-formed', 'tribes formed': 'teams-formed', 'pairs formed': 'pairs-formed', 'split into individuals': 'split-into-individuals',
    individuals: 'split-into-individuals', merged: 'merge', 'tribe swap': 'swap', 're pair': 'swap', 're pairing': 'swap', 'new phase': 'new-phase', newcomers: 'newcomer',
  },
  when: { middle: 'mid', 'mid episode': 'mid', beginning: 'start' },
};
/** `v` as one of `list`, forgiving case, spaces for hyphens and a few aliases (`aliases`); null when it isn't one. */
function oneOf(v, list, aliases = {}) {
  const s = low(v);
  if (!s) return null;
  if (list.includes(s)) return s;
  const dashed = s.replace(/[\s_]+/g, '-');
  if (list.includes(dashed)) return dashed;
  const alias = aliases[s] || aliases[s.replace(/-/g, ' ')];
  return alias && list.includes(alias) ? alias : null;
}

const names = (v) => (Array.isArray(v) ? v : []).map(text).filter(Boolean);

/**
 * An answer's format section, read loosely: missing or not an object is null (not asked, or an answer from before it was
 * asked); a value outside its list takes its catch-all ("unknown"; a change's `sure` "low", its `when` null) or is dropped
 * (a change of a kind not in the vocabulary), each repair said in `repairs`. Never throws: the section must never fail a
 * research run the rest of which is fine. Pure.
 */
function looseFormatState(v, repairs = []) {
  if (v == null) return null;
  if (!isObj(v)) {
    repairs.push('formatState was not an object -- read as not answered');
    return null;
  }
  const out = {};
  out.playedAs = oneOf(v.playedAs, PLAYED_AS, ALIASES.playedAs) || 'unknown';
  if (v.playedAs != null && out.playedAs === 'unknown' && low(v.playedAs) !== 'unknown') repairs.push(`formatState: playedAs "${v.playedAs}" isn't one of ${PLAYED_AS.join(', ')} -- recorded as "unknown"`);
  out.phase = text(v.phase);
  if (v.groups == null) out.groups = null;
  else if (!Array.isArray(v.groups)) {
    repairs.push('formatState: groups was not a list -- read as not known');
    out.groups = null;
  } else {
    out.groups = v.groups
      .map((g) => (Array.isArray(g) ? { name: null, members: names(g) } : isObj(g) ? { name: text(g.name), members: names(g.members) } : null))
      .filter((g) => g && g.members.length);
  }
  out.alone = names(v.alone);
  out.newcomers = (Array.isArray(v.newcomers) ? v.newcomers : [])
    .map((x) => (typeof x === 'string' ? { name: text(x), replaces: null, group: null } : isObj(x) ? { name: text(x.name), replaces: text(x.replaces), group: text(x.group) } : null))
    .filter((x) => x && x.name);
  out.wentHomeAs = oneOf(v.wentHomeAs, WENT_HOME_AS, ALIASES.wentHomeAs) || 'unknown';
  if (v.wentHomeAs != null && out.wentHomeAs === 'unknown' && low(v.wentHomeAs) !== 'unknown') repairs.push(`formatState: wentHomeAs "${v.wentHomeAs}" isn't one of ${WENT_HOME_AS.join(', ')} -- recorded as "unknown"`);
  out.changes = [];
  for (const c of Array.isArray(v.changes) ? v.changes : []) {
    if (!isObj(c)) continue;
    const kind = oneOf(c.kind, KINDS, ALIASES.kind);
    if (!kind) {
      repairs.push(`formatState: a change of kind "${c.kind}" isn't one of ${KINDS.join(', ')} -- dropped`);
      continue;
    }
    const from = Number.isInteger(c.from) ? c.from : /^\s*\d+\s*$/.test(String(c.from ?? '')) ? Number(c.from) : null;
    out.changes.push({ kind, when: oneOf(c.when, WHEN, ALIASES.when), from: from != null && from >= 1 ? from : null, what: text(c.what) || '', sure: low(c.sure) === 'high' ? 'high' : 'low' });
  }
  return out;
}

/**
 * The format section's names made the list's own (`resolve(name)` -> the name as asked, or null), anyone it can't place
 * dropped, and what a reviewer should see about it, as problems. `state` is changed in place (validateResearch's way).
 * `entries`: the episode's checklist answers (who went home); `goingIn`: the state going into the episode, if known (a
 * whole pair went home: did both partners leave?); `newGroups`: name -> the group research's newGroup says (a named group
 * that disagrees); `episode`: the episode answered, if known (a change announced for later isn't held against the groups at
 * its end). Pure.
 */
function formatStateProblems(state, { resolve, entries = [], goingIn = null, newcomers = [], episode = null } = {}) {
  if (!state) return [];
  const p = [];
  // Newcomers aren't on the list: this episode's, and anyone an earlier answer said came in (`newcomers`). Their own
  // name first, so a loose match never makes a newcomer someone on the list ("Leo" isn't "Leonardo").
  const newcomerNames = new Map([...newcomers, ...state.newcomers.map((x) => x.name)].filter(Boolean).map((n) => [low(n), n]));
  const place = (name) => {
    if (newcomerNames.has(low(name))) return newcomerNames.get(low(name));
    return (resolve ? resolve(name) : name) || null;
  };
  const dropped = new Set();
  const seen = new Map();
  const groups = [];
  for (const g of state.groups || []) {
    const members = [];
    for (const m of g.members) {
      const who = place(m);
      if (!who) {
        dropped.add(m);
        continue;
      }
      if (seen.has(low(who))) {
        if (seen.get(low(who)) !== g) p.push(`formatState: ${who} is in two groups (kept the first)`);
        continue;
      }
      seen.set(low(who), g);
      members.push(who);
    }
    groups.push({ name: g.name, members });
  }
  const alone = [];
  for (const m of state.alone) {
    const who = place(m);
    if (!who) {
      dropped.add(m);
      continue;
    }
    if (seen.has(low(who))) continue;
    seen.set(low(who), 'alone');
    alone.push(who);
  }
  // A group of one isn't a group: whoever's in it is on their own (a partner who went home, a group the answer emptied).
  for (const g of groups.filter((x) => x.members.length === 1)) {
    p.push(`formatState: a group of one (${g.members[0]}) -- read as on their own`);
    alone.push(g.members[0]);
  }
  if (state.groups) state.groups = groups.filter((x) => x.members.length > 1);
  state.alone = alone;
  if (dropped.size) p.push(`formatState: ${[...dropped].join(', ')} ${dropped.size === 1 ? "isn't" : "aren't"} in the list or the newcomers (dropped)`);
  for (const x of state.newcomers) {
    const asked = resolve ? resolve(x.name) : null;
    if (asked && low(asked) === low(x.name)) p.push(`formatState: ${x.name} is a newcomer but is already in the list`);
    if (x.replaces) x.replaces = (resolve && resolve(x.replaces)) || x.replaces;
  }
  // Who went home, by their checklist answers.
  const left = new Set(entries.filter((e) => e && e.leftTheGame === 'yes').map((e) => low((resolve && resolve(e.name)) || e.name)));
  const inGroups = [...(state.groups || []).flatMap((g) => g.members), ...state.alone].filter((m) => left.has(low(m)));
  if (inGroups.length) p.push(`formatState: ${inGroups.join(', ')} went home this episode but ${inGroups.length === 1 ? 'is' : 'are'} still placed at its end (in a group or on their own)`);
  if (state.groups && state.groups.length) {
    const placed = new Set([...state.groups.flatMap((g) => g.members), ...state.alone].map(low));
    const missing = entries.map((e) => (e && e.name ? (resolve && resolve(e.name)) || e.name : null)).filter((n) => n && !left.has(low(n)) && !placed.has(low(n)));
    if (missing.length) p.push(`formatState: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} still in but in no group and not on their own`);
  }
  if (state.wentHomeAs === 'nobody' && left.size) p.push('formatState: wentHomeAs says nobody left, but the checklist has someone leaving');
  // The answer against itself: a change it lists that its own groups at the end don't show (The Challenge 40's Episode 9
  // said everyone plays alone from 10, and still listed the eras, a label by then, as groups).
  const divided = (state.groups || []).length > 1;
  for (const c of state.changes.filter((x) => !(episode && x.from && x.from > episode + 1))) {
    if (c.kind === 'split-into-individuals' && divided) p.push(`formatState: a change says everyone plays for themselves${c.from ? ` from episode ${c.from}` : ''}, but the groups at the end still divide them`);
    if (c.kind === 'merge' && divided) p.push(`formatState: a change says the groups merged${c.from ? ` from episode ${c.from}` : ''}, but the groups at the end still divide them`);
    if ((c.kind === 'teams-formed' || c.kind === 'pairs-formed') && Array.isArray(state.groups) && !divided) p.push(`formatState: a change says ${c.kind === 'pairs-formed' ? 'pairs' : 'teams'} formed${c.from ? ` from episode ${c.from}` : ''}, but there are no groups at the end`);
  }
  // A whole pair or team going home together (F1's finding: Episode 12 of The Challenge 41 kept Dee in while Derrick went).
  // The groups going in may be from an earlier episode: only who's still in counts (on the list, or a newcomer).
  if (state.wentHomeAs === 'groups' && goingIn && Array.isArray(goingIn.groups)) {
    const before = goingIn.groups.map((g) => g.members.map(place).filter(Boolean)).filter((g) => g.length > 1);
    const whole = before.filter((g) => g.every((m) => left.has(low(m))));
    for (const g of before.filter((x) => x.length <= 3)) {
      const gone = g.filter((m) => left.has(low(m)));
      if (gone.length && gone.length < g.length) {
        const stayed = g.filter((m) => !left.has(low(m)));
        p.push(`formatState: a whole group went home together, but ${gone.join(', ')} left and ${stayed.join(', ')} (with them going in) didn't`);
      }
    }
    if (left.size && !whole.length) p.push('formatState: wentHomeAs says a whole group went home together, but no group going in left whole');
  }
  return p;
}

// ---------- our own comparison ----------

/** Whether a set of groups is pairs: every group two people, or all but one (The Challenge 39's seven pairs and a trio). */
function isPairs(groups) {
  if (!groups.length || groups.some((g) => g.members.length > 3)) return false;
  return groups.filter((g) => g.members.length === 2).length >= Math.max(1, groups.length - 1);
}

/**
 * What changed between two states (the end of one episode and the end of a later one), worked out by our code, never from
 * anyone's labels: [{ kind, moved, newcomers, allNew, groups }], or null when either state doesn't say who is with whom.
 * `left`: who went home in between (their going isn't a move); `newcomers`: who came in. One group, or none, is the game
 * not divided (a merged tribe, or everyone for themselves), so going from one to the other is no change. Pure.
 */
function changesBetween(before, after, { left = [], newcomers = [] } = {}) {
  if (!before || !after || !Array.isArray(before.groups) || !Array.isArray(after.groups)) return null;
  const gone = new Set(left.map(low));
  const fresh = new Set(newcomers.map(low));
  const still = (g) => ({ name: g.name || null, members: g.members.filter((m) => !gone.has(low(m))) });
  // The shape before is as it was played (someone going home in between doesn't make pairs stop being pairs); who moved is
  // worked out from what's left of it.
  const shape = before.groups.filter((g) => g.members.length > 1);
  const b = before.groups.map(still).filter((g) => g.members.length > 1);
  const a = after.groups.map(still).filter((g) => g.members.length > 1);
  const out = [];
  const add = (kind, extra = {}) => out.push({ kind, moved: [], newcomers: [], allNew: false, groups: a, ...extra });
  const divided = (x) => x.length > 1;
  if (!divided(shape) && !divided(a)) {
    // Not divided either side; nothing to compare.
  } else if (divided(shape) && !a.length) add('split-into-individuals');
  else if (divided(shape) && a.length === 1) add('merge');
  else if (!divided(shape)) add(isPairs(a) ? 'pairs-formed' : 'teams-formed', { allNew: true });
  else {
    // Each group after carries on one from before when it has its name, or more than half of each is the same people (a
    // tribe that gained one); otherwise it's new. Who moved: everyone in a group that's new, and whoever joined a group that
    // carried on, who was somewhere else before (in another group, or on their own). Newcomers aren't moves, and nor is
    // being left on your own by someone going home.
    const wasPlaced = new Set([...b.flatMap((g) => g.members), ...(before.alone || [])].map(low));
    const overlap = (x, y) => x.members.filter((m) => y.members.map(low).includes(low(m))).length;
    const carries = (ga) =>
      (ga.name && b.find((gb) => gb.name && low(gb.name) === low(ga.name))) ||
      b.find((gb) => overlap(ga, gb) * 2 > ga.members.length && overlap(ga, gb) * 2 > gb.members.length) ||
      null;
    const moved = a.flatMap((ga) => {
      const gb = carries(ga);
      return ga.members.filter((m) => !fresh.has(low(m)) && wasPlaced.has(low(m)) && !(gb && gb.members.map(low).includes(low(m))));
    }).map(low);
    const beforeKeys = new Set(b.map((g) => keyOf(g.members)));
    const kept = a.filter((g) => beforeKeys.has(keyOf(g.members))).length;
    const movedNames = a.flatMap((g) => g.members).filter((m) => moved.includes(low(m)));
    // Someone new taking the place of someone who left (Jonna for Cara Maria, beside Leo) moves nobody: their partner was
    // on their own once Cara Maria left, so it's the newcomer change below, not a swap. Nobody moved, nobody new and every
    // group carrying one on is no change, whatever the sizes read as (a tribe of two beside one of three isn't pairs
    // turning into teams when someone an earlier answer left out is placed; pairs joined by newcomers into trios is).
    if (!moved.length && a.every((ga) => carries(ga)) && !a.some((ga) => ga.members.some((m) => fresh.has(low(m))))) {
      // No change.
    } else if (isPairs(shape) && !isPairs(a)) add('teams-formed', { moved: movedNames, allNew: kept === 0 });
    else if (!isPairs(shape) && isPairs(a)) add('pairs-formed', { moved: movedNames, allNew: kept === 0 });
    else if (moved.length) add('swap', { moved: movedNames, allNew: kept === 0 });
  }
  if (newcomers.length) out.push({ kind: 'newcomer', moved: [], newcomers: newcomers.slice(), allNew: false, groups: [] });
  return out;
}

/**
 * Our changes against the answer's own, for one episode: [{ kind, from, when, sure, by, what }]. A grouping change both
 * found takes the answer's episode and moment and its sureness; one only our comparison found is unsure (`by: 'ours'`,
 * when and from unknown); one only the answer has, of a grouping kind, is unsure too (`by: 'theirs'`: the states don't show
 * it). A change our code can't see (a new phase, a twist, a role) is the answer's alone, as sure as it says (`by: 'said'`).
 * `ours` null (the states can't be compared): every grouping change the answer has is unsure. Pure.
 */
function crossCheck(ours, theirs) {
  const said = (theirs || []).slice();
  const out = [];
  for (const c of ours || []) {
    const i = said.findIndex((x) => x.kind === c.kind);
    if (i >= 0) {
      const t = said.splice(i, 1)[0];
      out.push({ kind: c.kind, from: t.from, when: t.when, sure: t.sure === 'high' ? 'high' : 'low', by: 'both', what: t.what, moved: c.moved, newcomers: c.newcomers, allNew: c.allNew });
    } else out.push({ kind: c.kind, from: null, when: null, sure: 'low', by: 'ours', what: '', moved: c.moved, newcomers: c.newcomers, allNew: c.allNew });
  }
  for (const t of said) {
    const grouping = GROUPING_KINDS.includes(t.kind);
    out.push({ kind: t.kind, from: t.from, when: t.when, sure: grouping ? 'low' : t.sure, by: grouping ? 'theirs' : 'said', what: t.what });
  }
  return out;
}

/** Everyone in a state, grouped or on their own. */
function placedIn(state) {
  return state ? [...(state.groups || []).flatMap((g) => g.members), ...(state.alone || [])] : [];
}

// A group's name as the show might say it either way: "Hina", "Hina Tribe", "the new Hina" are one tribe.
const QUALIFIERS = /\b(the|tribe|team|new|original)\b/g;
const tribeKey = (name) => low(name).replace(/[^a-z0-9\s]/g, ' ').replace(QUALIFIERS, ' ').replace(/\s+/g, ' ').trim();

/**
 * Each person's group in an episode as its format section has it, for staging's group moves (F3: who is with whom comes
 * from the section; `newGroup` beside it is asked only of someone who moved and went home the same night, whom the groups at
 * the end can't hold). F2's proof: newGroup named a new tribe for 7 of the 27 people who changed one, and partners' names as
 * groups on The Challenge; the section had every tribe right. Returns name -> the group to move them to, or null (no move),
 * for everyone the section speaks for: everyone on a named tribe or team. A named group that is a tribe going in, said
 * any way ("Hina Tribe" for "Hina"), keeps the staged spelling and moves only who wasn't on it; a name no tribe going in
 * has is a new tribe (a swap's, the merge's), and everyone on it moves there. Pairs (and pairs with a trio, unless every
 * group is a tribe already), an unnamed group (a merged tribe the answer didn't name) and a section that doesn't say who
 * is with whom speak for nobody: the engine's groups are named tribes and teams, and The Challenge's pairs live in the
 * format's state over time (format-timeline.js). `goingIn`: name -> their group going into the episode. Pure.
 */
function movesFromState(state, goingIn = {}) {
  const out = new Map();
  if (!state || !Array.isArray(state.groups)) return out;
  const groups = state.groups.filter((g) => g && Array.isArray(g.members) && g.members.length > 1);
  const was = new Map(Object.entries(goingIn || {}).map(([k, v]) => [low(k), v]));
  const tribes = new Map();
  for (const v of was.values()) if (text(v) && !tribes.has(tribeKey(v))) tribes.set(tribeKey(v), text(v));
  const known = (g) => text(g.name) && tribes.has(tribeKey(g.name));
  if (!groups.length || (isPairs(groups) && !groups.every(known))) return out;
  for (const g of groups) {
    if (!text(g.name)) continue;
    const to = tribes.get(tribeKey(g.name)) || text(g.name);
    for (const m of g.members) {
      const before = was.get(low(m));
      out.set(m, before && tribeKey(before) === tribeKey(to) ? null : to);
    }
  }
  return out;
}

module.exports = { PLAYED_AS, WENT_HOME_AS, KINDS, GROUPING_KINDS, WHEN, SURE, ALIASES, oneOf, looseFormatState, formatStateProblems, isPairs, changesBetween, crossCheck, placedIn, keyOf, movesFromState, tribeKey };
