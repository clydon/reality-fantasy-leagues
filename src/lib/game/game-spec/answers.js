// Grading a game's questions (docs/PLAN-start-a-game-gpt.md steps A4 and A6): how each question in a spec's `ask` stands, from
// what the game's results say, and what each answer earns. Pure, like ./schema.js: state-logic.js's AnswerLogic builds the facts
// from a league's state as its viewer sees it (the spoiler guard's view, so nothing past their mark is graded), and calls
// these; the server reads the answers (game_answers, or a draft's finale predictions in its state) and hands them over.
//
//   facts = {
//     from, to      the game's span: its first episode (null while it waits for its phase) and its last (null: the season's end)
//     over          the game is over (its season is, or its span's last episode has results)
//     episodes      Map: episode number -> { out, events, who, in, groups, roles } for the game's own episodes with results.
//                   out: who went home (castaway ids; the winner leaving by winning isn't going home), [] when nobody did,
//                   null while it isn't in; once the full results are in (null before): events, Map moment id -> how many
//                   times it happened, who, Map moment id -> Map castaway id -> how many times it happened to them (a per-unit
//                   moment's units: a couple's judges' points), and roles, Map castaway id -> their secret role as of it (a
//                   show with roles; else empty); in: who was still in at its start; groups: Map castaway id -> the group
//                   (tribe id) they were on in it, after any swap it recorded, or null
//     winner        the season's winner (castaway id), or null
//     ended         the season is over
//     order         everyone by where they finished, the winner first, once the season is over (null before)
//     names         Map castaway id -> name (a choice's options are matched to names)
//     groupNames    Map group id -> name (a choice's options are matched to them too)
//     phases        (A7) Map phase id -> the episode it started, for each phase whose start the viewer has seen
//     windows       (A7) the game's later phase windows, in order: [{ phase, at (where it opens), from (its phase's start) }]
//     seen          (A7) the last episode the viewer has seen with results
//     startIn       (A8) who was in at the game's first episode (a pairs question's pairs are drawn from them)
//     jury          (A8) the finalists' jury votes, once the season is over (null before)
//   }
//   and each episode's `points` (A8): each person's points in it by the game's rules, once its full results are in
//
// A question's window (A7): asked once, the game's episodes; asked each, its episode (and, over N, the next N - 1); every N,
// the run of N from the one it opens at; by phase, from the one it opens at to where the next phase's opens (once the viewer
// has seen that phase begin). Its answers' key is the episode it opens at (0 asked once). It settles once every episode of it
// has its results (and its end is known).
//
//   verdictOf(q, episode, facts)  { state: 'waiting' } | { state: 'off', why } | { state: 'known', right, value?, groups?, each? }
//                                 (right: the right answers: castaway ids, 'yes'/'no', 'over'/'under', options; value: a count;
//                                 groups: the groups the right people were on, for a group answer; each: a question about each
//                                 person's own verdicts, by castaway id)
//   pointsFor(q, verdict, answers) Map playerId -> points, for one question's answers ([{ playerId, answer }]) on one
//                                 episode (a number answer is the closest's, so they're graded together)
//   windowPoints(q, v, answers, facts, { worth })  the same with A9's ways of combining: a pot split between everyone right, only
//                                 the only right one, a rollover's jackpot (worth), a shrinking call (each answer's late, changes)
//   allRight(legs, facts)         who's right on every leg of a parlay in one window (A9)
//   answerProblem(q, value, faces) why an answer can't be given (null: it can), faces: who (or which groups) it can name
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ./schema.js */
const { YES_NO, NAMES, NUMBERS, optionRange } = require('./schema.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const WAITING = Object.freeze({ state: 'waiting' });
const off = (why) => ({ state: 'off', why });
function known(right, value, groups) {
  const v = { state: 'known', right };
  if (value !== undefined) v.value = value;
  // Only when someone right was on a group: a show without groups reads as it always did.
  if (groups && groups.length) v.groups = groups;
  return v;
}
const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const ORDINAL = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const NOBODY = "It didn't happen";

/** The game's episodes from its start, in order, as far as its results go (to its end once it's over). */
function spanEpisodes(facts) {
  if (facts.from === null) return [];
  const known = [...facts.episodes.keys()];
  const last = facts.to !== null ? facts.to : known.length ? Math.max(...known) : facts.from - 1;
  const out = [];
  for (let n = facts.from; n <= last; n++) out.push(n);
  return out;
}

/**
 * A question's window from the episode it opens at (A7): { eps, ended }, its episodes in order and whether its last is known
 * (its own end, the game's, or the next phase's start once the viewer has seen it). Asked once, the game's episodes. Past the
 * game's end, or past the season's last results once it's over, it stops there.
 */
function windowOf(q, start, facts) {
  if (q.asked === 'once') return { eps: spanEpisodes(facts), ended: !!facts.over };
  let end = null;
  if (q.asked === 'every') end = start + q.every - 1;
  else if (q.asked === 'phase') {
    // To where the next phase's window opens, once the viewer has seen that phase begin.
    const next = (facts.windows || []).find((x) => x.at > start);
    end = next && Number.isInteger(facts.seen) && facts.seen >= next.from ? next.at - 1 : null;
  } else end = start + (Number.isInteger(q.over) && q.over > 1 ? q.over : 1) - 1;
  if (facts.to !== null && (end === null || end > facts.to)) end = facts.to;
  const seen = [...facts.episodes.keys()];
  const last = seen.length ? Math.max(...seen) : start - 1;
  // Over: what the game had is all it has.
  if (facts.over && (end === null || end > last)) end = Math.max(start, last);
  const eps = [];
  for (let n = start; n <= (end === null ? last : end); n++) eps.push(n);
  return { eps, ended: end !== null };
}

/**
 * A pairs question's pairs (A8): drawn from who was in at the game's start, the same every time (a shuffle seeded by the
 * question and who's in, never stored), `q.pairs` of them: [[a, b], ...].
 */
function pairsFrom(q, ids) {
  const list = [...new Set(ids)].sort();
  let h = 2166136261;
  for (const ch of `${q.id}|${list.join(',')}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  const out = [];
  for (let i = 0; i + 1 < list.length && out.length < (q.pairs || 0); i += 2) out.push([list[i], list[i + 1]]);
  return out;
}
/** A pair's key, for its answers ({ "a|b": who }): its two ids, sorted. Keyed by who's in it, so a pair drawn again after a
 *  cast correction is never graded against someone's answer for another. */
const pairKey = (pair) => [...pair].sort().join('|');

/**
 * Where each person stands in a ranking (A8), as the places they could hold (0-based, ties sharing a block), `groups` in order
 * (each a list of ids that tie): the order and each one's places.
 */
function placesOf(groups) {
  const order = [];
  const places = {};
  for (const g of groups) {
    const lo = order.length;
    for (const id of g) places[id] = [lo, lo + g.length - 1];
    order.push(...g);
  }
  return { order, places };
}
/** A leaderboard (A8): everyone given, by their counts (a moment's, or their points), the most first, ties together. */
function placesBy(counts, ids) {
  const by = new Map();
  for (const id of ids) {
    const c = counts.get(id) || 0;
    if (!by.has(c)) by.set(c, []);
    by.get(c).push(id);
  }
  return placesOf([...by.keys()].sort((a, b) => b - a).map((c) => by.get(c)));
}

/** The groups (distinct, none for nobody's) a list of people were on in an episode. */
function groupsIn(ids, e) {
  const out = [];
  for (const id of ids) {
    const g = e && e.groups ? e.groups.get(id) : null;
    if (g && !out.includes(g)) out.push(g);
  }
  return out;
}
/** How many times a moment happened to each person in an episode (empty before its full results). */
const tally = (e, moment) => (e && e.who && e.who.get(moment)) || new Map();
/** Who was still in at an episode's start (none when the facts don't say). */
const inAt = (e) => (e && Array.isArray(e.in) ? e.in : []);
/** The people a tally says it happened to most (ties all), and how many times; nobody when it didn't happen. */
function most(counts) {
  let best = 0;
  for (const c of counts.values()) if (c > best) best = c;
  return { best, who: best > 0 ? [...counts].filter(([, c]) => c === best).map(([id]) => id) : [] };
}
/** Who held a role in an episode, among a list of people. */
const holding = (e, ids, role) => ids.filter((id) => e.roles && e.roles.get(id) === role);
/** A ranking's verdict (A8): everyone in order, and the places each could hold (0-based; ties share a block). */
function ranked(order, places) {
  const v = known(order);
  v.places = places;
  return v;
}
/** A group answer's verdict: settled only by the groups the right people were on (nobody on one: off, never a question
 *  nobody can get right). Any other answer's, as it is. */
function forGroups(q, v) {
  if (q.answer !== 'group' || v.state !== 'known' || (v.groups && v.groups.length)) return v;
  return off("Nobody it happened to was on a group");
}

/**
 * What the results say over a window (`w`, windowOf): asked once, the game; over N, every N, by phase (A7). Who went home: asked
 * once, the first to go in the game; over a window, anyone who went home in it.
 */
function overWindow(q, w, facts) {
  const st = q.settle;
  const eps = w.eps;
  const at = (n) => facts.episodes.get(n);
  if (st.by === 'results' && st.take === 'order') {
    // The order they went home in the window (A8: the boot order), once every one of its episodes is in.
    if (!w.ended || !eps.every((n) => { const e = at(n); return !!e && e.out !== null; })) return WAITING;
    // Who went home the same night share their places: nothing in the results says which went first.
    const nights = eps.map((n) => at(n).out).filter((g) => g.length);
    if (!nights.length) return off('Nobody went home');
    const { order, places } = placesOf(nights);
    return ranked(order, places);
  }
  if (st.by === 'results') {
    if (q.asked === 'once') {
      // The first to go home in the game: the first episode someone did, once every one before it is in.
      for (const n of eps) {
        const e = at(n);
        if (!e || e.out === null) return WAITING;
        if (e.out.length) return known(e.out, undefined, groupsIn(e.out, e));
      }
      return facts.over ? off('Nobody went home') : WAITING;
    }
    if (!w.ended || !eps.every((n) => { const e = at(n); return !!e && e.out !== null; })) return WAITING;
    const gone = [];
    const groups = [];
    for (const n of eps) {
      gone.push(...at(n).out);
      for (const g of groupsIn(at(n).out, at(n))) if (!groups.includes(g)) groups.push(g);
    }
    return gone.length ? known(gone, undefined, groups) : off('Nobody went home');
  }
  // Every one of the window's episodes with its full results, once its end is known: what's only known at the end.
  const whole = w.ended && eps.every((n) => { const e = at(n); return !!e && e.events !== null; });
  if (st.by === 'phase') {
    // Whether a phase started in the window: yes once its start is known there; no once it's known elsewhere, or the game is
    // over without it (a start the desk confirms late is never read as "no").
    const s = facts.phases ? facts.phases.get(st.phase) : undefined;
    if (Number.isInteger(s)) return known([eps.includes(s) ? 'yes' : 'no']);
    return facts.over && whole ? known(['no']) : WAITING;
  }
  if (st.by === 'role') {
    if (!whole || !eps.length) return WAITING;
    if (st.take === 'who') {
      // Anyone who held it in the window.
      const who = [];
      for (const n of eps) { const e = at(n); for (const id of holding(e, inAt(e), st.role)) if (!who.includes(id)) who.push(id); }
      return who.length ? known(who) : off(`Nobody was a ${st.role}`);
    }
    // Who held it among those in at the window's last episode.
    const last = at(eps[eps.length - 1]);
    const end = holding(last, inAt(last), st.role);
    return st.take === 'count' ? known([], end.length) : end.length ? known(end) : off(`No ${st.role} made it to the end`);
  }
  if (st.by === 'points' || st.take === 'order') {
    // A leaderboard (A8): everyone in at the window's start by a moment's count, or by their points by the game's rules, over
    // the window, once all of it is in. Who scored most: the top (ties all); nobody, when nobody scored.
    if (!whole || !eps.length) return WAITING;
    const counts = new Map();
    for (const n of eps) {
      const m = st.by === 'points' ? at(n).points || new Map() : tally(at(n), st.moment);
      for (const [id, k] of m) counts.set(id, (counts.get(id) || 0) + k);
    }
    const people = inAt(at(eps[0])).length ? inAt(at(eps[0])) : [...counts.keys()];
    if (st.take === 'most') {
      const best = Math.max(...people.map((id) => counts.get(id) || 0));
      const top = people.filter((id) => (counts.get(id) || 0) === best);
      return best > 0 || top.length < people.length ? known(top, best) : off('Nobody scored');
    }
    const { order, places } = placesBy(counts, people);
    return ranked(order, places);
  }
  if (st.take === 'first') {
    // The first episode it happened in (its number), and who it happened to there, once every episode before it is in.
    for (const n of eps) {
      const e = at(n);
      if (!e || e.events === null) return WAITING;
      const who = [...tally(e, st.moment)].filter(([, k]) => k > 0).map(([id]) => id);
      if (who.length || (e.events.get(st.moment) || 0) > 0) return known(who, n, groupsIn(who, e));
    }
    return whole ? off(NOBODY) : WAITING;
  }
  // A moment over the window: it happened as soon as it does; it didn't, its count, who it happened to and who most, once
  // every one of its episodes has its full results.
  let count = 0;
  const counts = new Map();
  const groups = [];
  for (const n of eps) {
    const e = facts.episodes.get(n);
    if (!e || e.events === null) continue;
    const c = e.events.get(st.moment) || 0;
    if (st.take === 'happened' && c > 0) return known(['yes']);
    count += c;
    for (const [id, k] of tally(e, st.moment)) {
      if (!(k > 0)) continue;
      counts.set(id, (counts.get(id) || 0) + k);
      for (const g of groupsIn([id], e)) if (!groups.includes(g)) groups.push(g);
    }
  }
  if (!whole) return WAITING;
  if (st.take === 'happened') return known(['no']);
  if (st.take === 'count') return known([], count);
  if (st.take === 'who') return counts.size ? known([...counts.keys()], undefined, groups) : off(NOBODY);
  const m = most(counts);
  return m.who.length ? known(m.who, m.best) : off(NOBODY);
}

/** How a question stands for the window it opens at `episode` (asked each, every N or by phase) or the game (asked once;
 *  `episode` ignored). */
function verdictOf(q, episode, facts) {
  const st = q && q.settle;
  if (!st || !['results', 'moment', 'role', 'phase', 'points'].includes(st.by)) return WAITING; // the sports branch's settles, and the calls
  if (q.each) return eachVerdict(q, episode, facts);
  if (st.by === 'results' && st.take === 'outlast') return pairsVerdict(q, facts);
  return forGroups(q, verdictFor(q, episode, facts));
}

/**
 * Who outlasted whom (A8), for each of a pairs question's pairs: decided once one of them goes home (the other outlasted them),
 * both by who went later (at the season's end, by where they finished); off when both made it to the game's end. Known once any
 * pair is decided; each pair's own verdict, by its index.
 */
function pairsVerdict(q, facts) {
  if (!Array.isArray(facts.startIn)) return WAITING;
  const pairs = pairsFrom(q, facts.startIn);
  // The episode each one went home in, as far as every episode before it is in: the game's own exits.
  const left = new Map();
  for (const n of spanEpisodes(facts)) {
    const e = facts.episodes.get(n);
    if (!e || e.out === null) break;
    e.out.forEach((id) => { if (!left.has(id)) left.set(id, n); });
  }
  // Who went later; the same night, a tie (off), unless the season's finish order says (a game that runs to its end: its
  // finale's places); in a game with an end of its own, both still in at it is off too.
  const toEnd = facts.to === null && !!facts.order;
  const verdict = (a, b) => {
    const la = left.get(a);
    const lb = left.get(b);
    if (la && lb && la !== lb) return known([la > lb ? a : b]);
    if (la && !lb) return known([b]);
    if (lb && !la) return known([a]);
    if (toEnd) {
      const ia = facts.order.indexOf(a);
      const ib = facts.order.indexOf(b);
      if (ia >= 0 && ib >= 0 && ia !== ib) return known([ia < ib ? a : b]);
    }
    if (la && lb) return off('They went home the same night');
    return facts.over ? off('Both made it to the end') : WAITING;
  };
  const each = {};
  for (const pair of pairs) each[pairKey(pair)] = verdict(pair[0], pair[1]);
  return Object.values(each).some((v) => v.state !== 'waiting') ? { state: 'known', right: [], each } : WAITING;
}
function verdictFor(q, episode, facts) {
  const st = q.settle;
  const how = `${st.by}:${st.take}`;
  if (how === 'results:winner') return facts.winner ? known([facts.winner]) : facts.ended ? off('Nobody won') : WAITING;
  if (how === 'results:top') return facts.order ? known(facts.order.slice(0, st.place)) : WAITING;
  if (how === 'results:placed') {
    if (!facts.order) return WAITING;
    const who = facts.order[st.place - 1];
    return who ? known([who]) : off(`Nobody finished ${ORDINAL(st.place)}`);
  }
  if (how === 'phase:starts') {
    // Which episode a phase starts in (A7): once the viewer has seen it start; none, once the game is over without it.
    const s = facts.phases ? facts.phases.get(st.phase) : undefined;
    return Number.isInteger(s) ? known([], s) : facts.over ? off("It didn't start while the game was on") : WAITING;
  }
  if (how === 'results:split') {
    // The jury's vote split (A8): the finalists' votes, most first ("5-2-1"), once the season is over.
    if (!facts.ended) return WAITING;
    // A finalist with none is left out, as people say it ("5-3", not "5-3-0"), and so is a zero in an answer.
    const votes = [...(facts.jury || new Map()).values()].filter((n) => Number.isInteger(n) && n > 0).sort((a, b) => b - a);
    return votes.length ? known([votes.join('-')]) : off('No jury vote was recorded');
  }
  const windowedSettle = st.by === 'phase' || st.by === 'points' || st.take === 'first' || st.take === 'order';
  if (q.asked !== 'each' || windowedSettle || (Number.isInteger(q.over) && q.over > 1)) return overWindow(q, windowOf(q, episode, facts), facts);
  const e = facts.episodes.get(episode);
  if (st.by === 'results') {
    if (!e || e.out === null) return WAITING;
    if (st.take === 'stays') return known(inAt(e).filter((id) => !e.out.includes(id)));
    return e.out.length ? known(e.out, undefined, groupsIn(e.out, e)) : off('Nobody went home');
  }
  if (!e || e.events === null) return WAITING;
  if (st.by === 'role') {
    const end = holding(e, inAt(e).filter((id) => !(e.out || []).includes(id)), st.role);
    if (st.take === 'count') return known([], end.length);
    if (st.take === 'end') return end.length ? known(end) : off(`No ${st.role} is still in`);
    const who = holding(e, inAt(e), st.role);
    return who.length ? known(who) : off(`Nobody was a ${st.role}`);
  }
  const c = e.events.get(st.moment) || 0;
  if (st.take === 'happened') return known([c > 0 ? 'yes' : 'no']);
  if (st.take === 'count') return known([], c);
  const counts = new Map([...tally(e, st.moment)].filter(([, k]) => k > 0));
  if (st.take === 'who') return counts.size ? known([...counts.keys()], undefined, groupsIn([...counts.keys()], e)) : off(NOBODY);
  const m = most(counts);
  return m.who.length ? known(m.who, m.best) : off(NOBODY);
}

/**
 * A question about each person (q.each): one verdict for each of those still in when it closes (at its window's start, or,
 * asked once, the game's first), from their own moment or whether they went home or stayed. Waiting until every one of
 * them is known: once every episode of its window has its results (its full results, for a moment) and its end is known.
 */
function eachVerdict(q, episode, facts) {
  const st = q.settle;
  const how = `${st.by}:${st.take}`;
  const moment = st.by === 'moment';
  const first = facts.episodes.get(q.asked === 'once' ? facts.from : episode);
  if (!first) return WAITING;
  const people = inAt(first);
  const w = windowOf(q, q.asked === 'once' ? facts.from : episode, facts);
  const list = w.eps.map((n) => facts.episodes.get(n));
  const ready = w.ended && list.every((e) => !!e && (moment ? e.events !== null : e.out !== null));
  if (!ready) return WAITING;
  const each = {};
  for (const id of people) {
    if (moment) {
      const c = list.reduce((n, e) => n + (tally(e, st.moment).get(id) || 0), 0);
      each[id] = st.take === 'count' ? known([], c) : known([c > 0 ? 'yes' : 'no']);
    } else {
      const out = list.some((e) => e.out.includes(id));
      each[id] = known([(how === 'results:out' ? out : !out) ? 'yes' : 'no']);
    }
  }
  return { state: 'known', right: [], each };
}

/** A number the verdict is about (a count), else null. */
const valueOf = (v) => (v && v.state === 'known' && isNum(v.value) ? v.value : null);

/** The right answers for an answer kind, from a verdict (a choice's options matched to what happened; an over/under to its
 *  line). Null when nothing is right (still to settle, off, or right on the line). */
function rightAnswers(q, v, facts) {
  if (!v || v.state !== 'known') return null;
  const value = valueOf(v);
  if (q.answer === 'overUnder') {
    if (value === null || !isNum(q.line) || value === q.line) return null;
    return [value > q.line ? 'over' : 'under'];
  }
  if (q.answer === 'choice') {
    const opts = Array.isArray(q.options) ? q.options : [];
    let right;
    // A count's range (never who it happened to most, whose verdict carries the top count too), a yes or no, or names.
    if (NUMBERS.includes(`${q.settle.by}:${q.settle.take}`)) {
      right = value === null ? [] : opts.filter((o) => { const r = optionRange(o); return r && value >= r.min && value <= r.max; });
    } else if (v.right.length && v.right.every((r) => YES_NO.includes(r))) right = opts.filter((o) => v.right.includes(norm(o)));
    else {
      // Names: the people who were right, and the groups they were on (which tribe won).
      const name = (id) => norm(facts && facts.names && facts.names.has(id) ? facts.names.get(id) : id);
      const names = new Set(v.right.map(name));
      for (const g of v.groups || []) names.add(norm(facts && facts.groupNames && facts.groupNames.has(g) ? facts.groupNames.get(g) : g));
      right = opts.filter((o) => names.has(norm(o)));
    }
    return right.length ? right : null;
  }
  if (q.answer === 'number') return value === null ? null : [];
  if (q.answer === 'group') return v.groups && v.groups.length ? v.groups : null;
  return v.right;
}

/** One answer's picks: a person or group answer's ids (one, or a list), else the answer itself. */
const picks = (q, a) => (NAMES.includes(q.answer) ? (Array.isArray(a) ? a : [a]).filter((x) => typeof x === 'string' && x) : [a]);
const key = (q, x) => (NAMES.includes(q.answer) ? x : norm(x));
/** A question about each person, as each one's: the same question without `each`; a pairs question's pair, as naming who
 *  outlasts (A8). */
const baseOf = (q) => {
  const b = { ...q };
  delete b.each;
  if (q.answer === 'pairs') Object.assign(b, { answer: 'person', pick: 1 });
  return b;
};
/** The answers given for one person (or pair), of a question about each ({ key: answer } each), as that one's own. */
const eachAnswers = (answers, id) =>
  answers.filter((a) => isObj(a.answer) && Object.prototype.hasOwnProperty.call(a.answer, id)).map((a) => ({ playerId: a.playerId, answer: a.answer[id] }));
/** A wagered question as the answer it's on (A8): the same question without its wager. */
const unwagered = (q) => { const b = { ...q }; delete b.wager; return b; };
/** A wagered answer (A8), as { answer, stake } with its stake held to what the question allows (A9: any of your points, 'total',
 *  as the answer was checked when it was given: answerProblem's `most`). */
const betOf = (q, a) => {
  if (!isObj(a) || !('answer' in a)) return null;
  const stake = Number.isInteger(a.stake) ? Math.max(0, a.stake) : 0;
  return { answer: a.answer, stake: Number.isInteger(q.wager) ? Math.min(stake, q.wager) : stake };
};
/** A split as it's compared (A8): its numbers, most first ("5-2-1"). */
const splitOf = (a) => (Array.isArray(a) && a.every((n) => Number.isInteger(n)) ? a.filter((n) => n > 0).sort((x, y) => y - x).join('-') : null);
/** An order's (A8) places right: each one in its place, or within `within` of it (ties share a block of places). */
function inPlace(q, v, list) {
  const places = (v && v.places) || {};
  const within = Number.isInteger(q.within) ? q.within : 0;
  return (Array.isArray(list) ? list : []).filter((id, i) => { const p = places[id]; return !!p && i >= p[0] - within && i <= p[1] + within; }).length;
}
/** What one answer of A8's kinds earns, by the verdict: an order its places right; confidence each right one's weight (its
 *  rank from the bottom); chips the chips on right ones; a split exactly right. In points. */
function earned(q, v, a, facts) {
  const pts = isNum(q.points) ? q.points : 0;
  if (q.answer === 'order') return inPlace(q, v, a) * pts;
  if (q.answer === 'split') return splitOf(a) !== null && splitOf(a) === v.right[0] ? pts : 0;
  const right = new Set(rightAnswers(q, v, facts) || []);
  if (q.answer === 'confidence') {
    const list = Array.isArray(a) ? a : [];
    const top = isInt(q.pick) ? q.pick : list.length;
    return list.reduce((n, id, i) => n + (right.has(id) ? (top - i) * pts : 0), 0);
  }
  if (q.answer === 'chips') return isObj(a) ? Object.entries(a).reduce((n, [id, c]) => n + (right.has(id) && isInt(c) ? c * pts : 0), 0) : 0;
  return 0;
}
const isInt = (v) => Number.isInteger(v) && v >= 0;
/** A8's answer kinds, scored by earned(). */
const MORE = ['order', 'confidence', 'chips', 'split'];

/**
 * What each answer to one question (on one episode) earns, by its verdict: a right answer its points; a person or group
 * answer its points for each one right; a number the closest's (ties all), right or not. A question about each person: its
 * points for each person answered right (a number, the closest for each person). Nothing until it's settled.
 */
function pointsFor(q, v, answers, facts) {
  const out = new Map();
  if (!v || v.state !== 'known') return out;
  if (q.each || q.answer === 'pairs') {
    if (!isObj(v.each)) return out;
    const base = baseOf(q);
    for (const [id, pv] of Object.entries(v.each)) {
      pointsFor(base, pv, eachAnswers(answers, id), facts).forEach((n, pid) => out.set(pid, (out.get(pid) || 0) + n));
    }
    return out;
  }
  if (MORE.includes(q.answer)) {
    for (const a of answers) {
      const n = earned(q, v, a.answer, facts);
      if (n) out.set(a.playerId, (out.get(a.playerId) || 0) + n);
    }
    return out;
  }
  if (q.wager) {
    // A wager (A8): right, its points and the stake; wrong, the stake lost; nothing either way when nothing's right (off, or
    // right on the line).
    const base = unwagered(q);
    if (!rightAnswers(base, v, facts)) return out;
    for (const a of answers) {
      const bet = betOf(q, a.answer);
      if (!bet) continue;
      const ok = isRight(base, v, { playerId: a.playerId, answer: bet.answer }, [], facts);
      const n = ok ? (isNum(q.points) ? q.points : 0) + bet.stake : -bet.stake;
      if (n) out.set(a.playerId, (out.get(a.playerId) || 0) + n);
    }
    return out;
  }
  const pts = isNum(q.points) ? q.points : 0;
  if (q.answer === 'number') {
    const value = valueOf(v);
    const given = answers.filter((a) => isNum(a.answer));
    if (value === null || !given.length) return out;
    const best = Math.min(...given.map((a) => Math.abs(a.answer - value)));
    for (const a of given) if (Math.abs(a.answer - value) === best) out.set(a.playerId, (out.get(a.playerId) || 0) + pts);
    return out;
  }
  const right = rightAnswers(q, v, facts);
  if (!right) return out;
  const rightSet = new Set(right.map((r) => key(q, r)));
  for (const a of answers) {
    const mine = [...new Set(picks(q, a.answer))];
    const n = mine.filter((x) => rightSet.has(key(q, x))).length;
    if (n) out.set(a.playerId, (out.get(a.playerId) || 0) + n * pts);
  }
  return out;
}

/** Whether one answer (`mine`, one of `answers`) was right: null until it's settled; a number, whether it was the closest; a
 *  question about each person, whether any of theirs was. */
function isRight(q, v, mine, answers, facts) {
  if (!v || v.state !== 'known') return null;
  if (q.each || q.answer === 'pairs') {
    if (!isObj(v.each) || !isObj(mine.answer)) return false;
    const base = baseOf(q);
    return Object.entries(v.each).some(
      ([id, pv]) => Object.prototype.hasOwnProperty.call(mine.answer, id) && !!isRight(base, pv, { playerId: mine.playerId, answer: mine.answer[id] }, eachAnswers(answers, id), facts)
    );
  }
  // A8's kinds: anything earned (an order's place, a confidence pick or a chip on someone right, the split).
  if (MORE.includes(q.answer)) return earned({ ...q, points: 1 }, v, mine.answer, facts) > 0;
  if (q.wager) {
    const bet = betOf(q, mine.answer);
    return !!bet && !!isRight(unwagered(q), v, { playerId: mine.playerId, answer: bet.answer }, [], facts);
  }
  if (q.answer === 'number') return pointsFor(q, v, answers, facts).has(mine.playerId);
  const right = rightAnswers(q, v, facts);
  if (!right) return false;
  const set = new Set(right.map((r) => key(q, r)));
  return picks(q, mine.answer).some((x) => set.has(key(q, x)));
}

/** Two decimal places: a pot split three ways is 3.33 each. */
const cents = (n) => Math.round(n * 100) / 100;
/** What a shrinking call (A9) is worth: its points less `shrink.points` for each episode of the game that had started when it was
 *  made (`late`), or each change made once the game had started (`changes`: a first answer made then is one), never below 0. */
function shrunk(q, worth, a) {
  const sh = q.shrink;
  if (!isObj(sh) || !isNum(sh.points)) return worth;
  const n = sh.per === 'change' ? (a && Number.isInteger(a.changes) ? a.changes : 0) : a && Number.isInteger(a.late) ? a.late : 0;
  return Math.max(0, worth - sh.points * n);
}

/**
 * What each answer to one question earns on one window, with A9's ways of combining: `o.worth`, the window's points (a rollover's
 * jackpot added; its points by default); a share (split: the worth is a pot split between everyone right, by what each would have
 * earned; only: a right answer scores only when nobody else's does); a shrinking call (each answer's `late` or `changes`). Answers:
 * [{ playerId, answer, late?, changes? }]. A wager plays alone, as A8 has it. A question with none of these earns exactly
 * pointsFor's.
 */
function windowPoints(q, v, answers, facts, o) {
  const worth = o && isNum(o.worth) ? o.worth : q.points;
  if (q.wager || (!q.share && !q.shrink && worth === q.points)) return pointsFor(q, v, answers, facts);
  // Each answer's right ones, at a point each (every kind's points are its points times these).
  const units = pointsFor({ ...q, points: 1 }, v, answers, facts);
  const out = new Map();
  const right = [...units].filter(([, u]) => u > 0);
  if (q.share === 'split') {
    const total = right.reduce((n, [, u]) => n + u, 0);
    for (const [pid, u] of right) out.set(pid, cents((worth * u) / total));
    return out;
  }
  if (q.share === 'only') {
    // A person or group answer (A9 part 2, part 1's open item, decided): each right pick nobody else named scores, so two players
    // each alone on a different right one (the final three, a double boot) both do. Anything else: the only player right.
    if (NAMES.includes(q.answer) && !q.each) {
      const rightSet = new Set((rightAnswers(q, v, facts) || []).map((r) => key(q, r)));
      const by = new Map();
      for (const a of answers) {
        for (const x of new Set(picks(q, a.answer))) {
          const k = key(q, x);
          if (rightSet.has(k)) by.set(k, [...(by.get(k) || []), a.playerId]);
        }
      }
      for (const [, pids] of by) if (pids.length === 1) out.set(pids[0], (out.get(pids[0]) || 0) + worth);
      return out;
    }
    if (right.length === 1) out.set(right[0][0], right[0][1] * worth);
    return out;
  }
  const mine = new Map(answers.map((a) => [a.playerId, a]));
  for (const [pid, u] of right) {
    const n = u * shrunk(q, worth, mine.get(pid));
    if (n) out.set(pid, n);
  }
  return out;
}

/**
 * Who's right on every leg of a parlay (A9) in one window: legs [{ q, v, answers }] (each leg's verdict and its answers there).
 * Every leg settled and right for them; a leg that didn't count (off) or that they left blank breaks it.
 */
function allRight(legs, facts) {
  if (!legs.length || legs.some((l) => !l.v || l.v.state !== 'known')) return new Set();
  const first = legs[0].answers.map((a) => a.playerId);
  return new Set(first.filter((pid) => legs.every((l) => {
    const mine = l.answers.find((a) => a.playerId === pid);
    return !!mine && isRight(l.q, l.v, mine, l.answers, facts) === true;
  })));
}

/**
 * Why an answer can't be given, or null: the shape each kind takes. `faces`: the ids a person or group answer can name (who's
 * still in, or your own team; the groups someone still in is on), or who a question about each person asks about, as a Set. A
 * person or group answer naming more than one is a list of different ones, at most its pick. A question about each person is
 * answered as { castawayId: answer }, for any of them.
 */
function answerProblem(q, value, faces, o) {
  if (q.wager) {
    // A8: { answer, stake }, the stake 0 to the wager; A9's 'total', 0 to your points as they stand (o.most; none given, any).
    if (!isObj(value) || !('answer' in value)) return 'Your answer and your stake: { answer, stake }';
    const most = Number.isInteger(q.wager) ? q.wager : o && isNum(o.most) ? Math.max(0, Math.floor(o.most)) : Infinity;
    if (!(Number.isInteger(value.stake) && value.stake >= 0 && value.stake <= most)) {
      if (most === Infinity) return 'A stake is a whole number of points, 0 or more';
      return most === 0 ? 'You have no points to stake yet: stake 0' : `Stake 0 to ${most} points`;
    }
    return answerProblem(unwagered(q), value.answer, faces);
  }
  if (q.each) {
    if (!isObj(value)) return 'An answer for each person: { who: answer }';
    const ids = Object.keys(value);
    if (!ids.length) return 'Answer for someone';
    if (faces && ids.some((id) => !faces.has(id))) return 'Answer only for who is still in';
    const base = baseOf(q);
    for (const id of ids) {
      const p = answerProblem(base, value[id], null);
      if (p) return p;
    }
    return null;
  }
  switch (q.answer) {
    case 'person':
    case 'group': {
      const one = q.answer === 'group' ? 'a group' : 'someone';
      const list = Array.isArray(value) ? value : [value];
      if (!list.length || list.some((x) => typeof x !== 'string' || !x)) return `Name ${one}`;
      if (q.pick === 1 && Array.isArray(value) && value.length !== 1) return 'Name one';
      if (list.length > (q.pick || 1)) return `Name ${q.pick} at most`;
      if (new Set(list).size !== list.length) return 'Name each one once';
      if (faces && list.some((x) => !faces.has(x))) {
        if (q.answer === 'group') return 'Name a group someone still in is on';
        return q.from === 'team' ? 'Name someone on your team who is still in' : 'Name someone still in';
      }
      return null;
    }
    case 'yesNo': return YES_NO.includes(value) ? null : 'Yes or no';
    case 'number': return isNum(value) && value >= 0 && value <= 100000 ? null : 'A number, 0 or more';
    case 'overUnder': return value === 'over' || value === 'under' ? null : 'Over or under';
    case 'choice': return Array.isArray(q.options) && q.options.includes(value) ? null : 'One of its options';
    // A8's kinds.
    case 'order':
    case 'confidence': {
      if (!Array.isArray(value) || !value.length || value.some((x) => typeof x !== 'string' || !x)) return 'Rank someone';
      if (value.length > (q.pick || 0)) return `Rank ${q.pick} at most`;
      if (new Set(value).size !== value.length) return 'Rank each one once';
      if (faces && value.some((x) => !faces.has(x))) return 'Rank only who is still in';
      return null;
    }
    case 'chips': {
      if (!isObj(value) || !Object.keys(value).length) return 'Put your chips on someone: { who: chips }';
      if (Object.values(value).some((c) => !isInt(c))) return 'Chips are whole numbers, 0 or more';
      const total = Object.values(value).reduce((a, b) => a + b, 0);
      if (total < 1 || total > q.chips) return `Spread 1 to ${q.chips} chips`;
      if (faces && Object.keys(value).some((x) => !faces.has(x))) return 'Chips only on who is still in';
      return null;
    }
    case 'split': {
      if (!Array.isArray(value) || !value.length || value.length > 20 || value.some((n) => !isInt(n))) return 'A split is a few whole numbers: [5, 2, 1]';
      const total = value.reduce((a, b) => a + b, 0);
      return total >= 1 && total <= 100 ? null : 'A split adds up to 1 to 100 votes';
    }
    case 'pairs': {
      // { "a|b": who outlasts } (the pair's two ids, sorted), `faces` each pair's "a|b:id" for each one in it.
      if (!isObj(value) || !Object.keys(value).length) return 'Who outlasts whom: { pair: who }';
      if (faces && Object.entries(value).some(([k, id]) => !faces.has(`${k}:${id}`))) return 'Name one of the pair';
      return null;
    }
    default: return "This question isn't answered here";
  }
}

module.exports = { WAITING, verdictOf, rightAnswers, pointsFor, windowPoints, allRight, shrunk, isRight, answerProblem, spanEpisodes, pairsFrom, pairKey, windowOf };
