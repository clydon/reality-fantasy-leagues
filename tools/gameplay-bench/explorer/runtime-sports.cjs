// A generated sports world (core-runtime-30; the breadth program's thirty-sixth capability, sports statistics, first slice: a drafted
// team scored by a sport's stats with plain points, ranked by total, locking at each episode's start).
//
// What a sport context holds (document.cjs already takes kind 'sport'): `key`, its league as the app names it ('football/nfl');
// `format: { id: 'generic' }` (a sport has no show rulebook: nobody goes home, no moments); `engine`, the app's own page context for
// that league (src/lib/sports/page.ts sportPageContext: its stats, positions, sizes) with the couch and the pool, which
// Spec.specProblems checks a game against (contextFor builds it). Its participants are athletes, each with a position
// (`role`, the league's default lineup's slots in turn); its events are the season's episodes (a week or an event's day: the
// cadence is the league's, the spacing the world's); each released event's fact is its box score: `data.lines`, every athlete's
// raw counts as a provider gives them ({ [participantId]: { STAT: n } }), beside the empty `events` and `scoringEvents` every fact has.
//
// How results reach a game: as the server brings them (src/lib/server/sports/score.ts stampStats, on every read and after every
// write): the engine's own stamp (StatsLogic.stamp) of each released episode's lines by castaway, the sport's derived stats
// worked out (Sport.full), every released episode final, each castaway's position group. Stamped keys are never part of a saved
// state (StatsLogic.stampedKeys; db.ts leaves them out), so the materializer writes the lines to the tables the server reads
// (season_events, sports_events), not to the league.
//
// Who sees what (core-runtime-32): a sport's results show straight away, whatever someone's mark, unless they hide sports
// scores too or play only at their own pace there (`guard`, the server's own rule). A person's `hidesScores: true` in the
// definition is that Account setting; the materializer writes it (user_settings.hide_sports_scores).
//
// Locks by the day or the week (core-runtime-34: `lockTimes`), and head to head (rank.by 'matchups': the engine's own, as on a
// show; an episode is a matchup).
//
// Not connected yet (runtime-profile.cjs says so, a gap each): points by position, by place or by a match's format; categories
// and roto; a lock at each game's start; a week of several games scored game by game (ep.statGames); a week
// in progress (some games final); a postponed or cancelled game; any other kind of game on a sport context.
const S = require('../../../src/lib/game/state-logic');
// The app's sport definitions are TypeScript (src/lib/sports), loaded through jiti by the bench's sports.cjs: only when a
// definition has a sport context, so a show's world starts as fast as it did.
let bench = null;
const Bench = () => bench || (bench = require('../sports.cjs'));
const json = v => JSON.parse(JSON.stringify(v));

/** A sport context's league: its sport, defaults and page context (the bench's resolve), or a thrown reason. */
function league(context) {
  if (typeof context.key !== 'string' || !context.key) throw Error("A sport context names its league (key: 'football/nfl')");
  return Bench().resolve(context.key);
}
/** A definition's sport context for a league: the app's page context for it, with the couch and the pool (its athletes). */
function contextFor(key, { couch, pool, id = 'sport' } = {}) {
  const c = Bench().resolve(key);
  return { id, kind: 'sport', key, format: { id: 'generic' }, engine: { ...json(c.context), ...(couch === undefined ? {} : { couch }), ...(pool === undefined ? {} : { pool }) } };
}
/** The positions the league's default lineup takes, slot by slot (sports.cjs make's roleFor): generated athletes take them in turn. */
function roles(c) {
  const roleFor = takes => c.sport.id === 'tennis' && c.league.endsWith('/wta') ? 'WS' : c.sport.positions.find(p => takes.includes(p.key) || takes.includes(p.group))?.key || c.sport.positions[0]?.key || 'Player';
  const list = c.defaults.slots.lineup.flatMap(slot => Array(slot.n).fill(roleFor(slot.takes)));
  return list.length ? list : [c.sport.positions[0]?.key || 'Player'];
}
/** Each generated athlete's position, in the cast's order. */
function assignRoles(context, participants) {
  const r = roles(league(context));
  participants.forEach((p, i) => { if (typeof p.role !== 'string' || !p.role) p.role = r[i % r.length]; });
}
/** One released event's box score: every athlete's raw counts (the bench's seeded lines by sport and position; `pick(i)` a seeded number). */
function linesFor(context, participants, pick) {
  const c = league(context);
  return Object.fromEntries(participants.map((p, i) => [p.id, Bench().rawLine(c.sport, p.role, pick(i) % 10)]));
}
const finite = v => typeof v === 'number' && Number.isFinite(v);
/** A sport fact's data, checked: empty `events` and `scoringEvents`, and `lines` by athlete (each a record of finite counts). */
function checkData(world, data) {
  if (!data || !Array.isArray(data.events) || !Array.isArray(data.scoringEvents)) throw Error('Event facts need events and scoringEvents arrays');
  if (Object.keys(data).some(k => !['events', 'scoringEvents', 'lines'].includes(k))) throw Error('Event fact contains an unconnected field');
  if (data.events.length || data.scoringEvents.length) throw Error("A sport's results are its stat lines: nobody goes home and no moment is scored");
  const ok = data.lines && typeof data.lines === 'object' && !Array.isArray(data.lines) && Object.entries(data.lines).every(([id, line]) => world.participants.some(p => p.id === id) && line && typeof line === 'object' && !Array.isArray(line) && Object.values(line).every(finite));
  if (!ok) throw Error("A sport's results need lines: each athlete's counts ({ [participantId]: { STAT: number } })");
}
/**
 * applyFacts for a game on a sport context (runtime-data.cjs applyFacts dispatches here): every released episode's lines stamped
 * on the state as the server stamps them, everything else an episode's results could hold cleared. `released`: the event test.
 */
function applyFacts(world, state, released) {
  const c = league(world.context), lines = {}, finals = [];
  for (const ep of state.episodes) {
    const event = world.events.find(e => e.id === ep.id);
    ep.events = []; ep.scoringEvents = []; delete ep.noExit; delete ep.resultsStage; delete ep.voteRecord;
    if (!event || !released(event)) continue;
    if (event.resultStatus === 'partial') throw Error("A sport's week in progress (some games final) is not connected: publish final results");
    const facts = world.facts.filter(f => f.eventId === event.id);
    if (facts.length !== 1) throw Error('A released event needs exactly one coherent fact bundle: ' + event.id);
    checkData(world, facts[0].data);
    lines[ep.number] = Object.fromEntries(Object.entries(facts[0].data.lines).map(([id, raw]) => [id, c.sport.full(raw)]));
    finals.push(ep.number);
  }
  // As stampStats hands it to the engine for a game scored by stats: the lines, the finals, each castaway's position group; the
  // sport's category definitions only for a game ranked by categories.
  const groups = Object.fromEntries(world.participants.map(p => [p.id, c.sport.position(p.role)?.group || null]).filter(([, g]) => g));
  S.StatsLogic.stamp(state, { lines, finals, groups, ...(S.StatsLogic.categories(state) ? { defs: c.sport.categoryDefs() } : {}) });
  for (const ep of state.episodes) { const event = world.events.find(e => e.id === ep.id); if (event && released(event) && !S.episodeHasResults(ep)) throw Error('Released event has no result facts'); }
}
/**
 * What someone may be told of a context's results: the server's spoiler guard (src/lib/server/guard.ts seenThrough). Their mark;
 * but a sport's season shows its results straight away (Infinity here, the server's EVERYTHING: sports are live, and Account
 * settings' "Sports scores too" is off by default) to anyone with an ordinary seat on it, or none, unless they hide sports scores
 * too (a person's `hidesScores`, user_settings.hide_sports_scores). Someone whose every seat on the season is at its own pace
 * goes by their mark (a late joiner's seat always does). `state`: the runtime's, or a snapshot of it; `games`: the definition's.
 */
function guard(state, games, contextId, personId) {
  const world = state.contexts[contextId], mark = world.marks.find(m => m.personId === personId)?.through ?? 0;
  if (world.context.kind !== 'sport' || state.people.find(p => p.id === personId)?.hidesScores) return mark;
  const seats = games.filter(g => g.contextId === contextId).map(g => state.games[g.id]?.state).filter(st => st && (st.players || []).some(p => p.id === personId));
  return !seats.length || seats.some(st => !S.GhostLogic.lateJoinOf(st, personId)) ? Infinity : mark;
}
/**
 * Each episode's lock for a sport's game that closes by the day or the week (core-runtime-34), as the server stamps it on every
 * read (src/lib/server/air-times.ts stampSportLocks): the app's own rule (src/lib/sports/locks.ts locksOf) over the game's own
 * episodes (its span: a game that starts later never locks with a game before it), from each one's start. Every episode on a
 * day locks at that day's first start, or every episode in a week (Tuesday to Monday) at the week's first; days and weeks are
 * Eastern time's. A Map of episode number to an ISO instant, or null for any other game (it locks at each episode's own start).
 *
 * `shiftMs`: the calendar the starts are read on. A day and a week are the real calendar's, and a case written to the database
 * has its schedule moved so the scenario's clock is the server's now (live-db.cjs: no route takes a clock); the server groups
 * the moved starts. So a real-route harness sets the same shift here (the session's `calendar(shiftMs)`) before it compares,
 * and the locks come back in the scenario's time. 0, the scenario's own calendar, everywhere else.
 */
function lockTimes(world, state, shiftMs = 0) {
  if (world.context.kind !== 'sport') return null;
  const closes = S.gameOf(state).closes;
  if (closes !== 'daily' && closes !== 'weekly') return null;
  const from = S.startEpisode(state) ?? 1, to = S.endEpisode(state);
  const starts = world.events.filter(e => e.number >= from && (to == null || e.number <= to)).map(e => ({ episode: e.number, at: e.airAt ? new Date(Date.parse(e.airAt) + shiftMs).toISOString() : null }));
  return new Map([...Bench().locksOf(starts, closes)].map(([n, at]) => [n, new Date(Date.parse(at) - shiftMs).toISOString()]));
}
/** The locks on a state's episodes, in place (around an action: the engine's own lock check reads ep.locksAt); `unstampLocks` takes them off. */
function stampLocks(world, state, shiftMs = 0) {
  const locks = lockTimes(world, state, shiftMs);
  for (const ep of state.episodes || []) { if (locks && locks.has(ep.number)) ep.locksAt = locks.get(ep.number); else delete ep.locksAt; }
  return state;
}
function unstampLocks(state) { for (const ep of state.episodes || []) delete ep.locksAt; return state; }
/** The state with its locks on a copy of its episodes (a read: the kept state never holds them), or the state itself when it has none. */
function withLocks(world, state, shiftMs = 0) {
  const locks = lockTimes(world, state, shiftMs);
  return locks && locks.size ? { ...state, episodes: state.episodes.map(ep => (locks.has(ep.number) ? { ...ep, locksAt: locks.get(ep.number) } : ep)) } : state;
}
/** A state as it would be saved: without what a stamp writes (the server leaves the same keys out: db.ts withLeagueLock). */
function saved(state) {
  const keys = new Set(S.StatsLogic.stampedKeys());
  return JSON.parse(JSON.stringify(state, (k, v) => (keys.has(k) ? undefined : v)));
}
module.exports = { league, contextFor, assignRoles, linesFor, checkData, applyFacts, saved, guard, lockTimes, stampLocks, unstampLocks, withLocks };
