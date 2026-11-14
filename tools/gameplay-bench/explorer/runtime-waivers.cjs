// Mid-season waivers in the runtime: src/lib/server/waivers.js ported, its claims in a runtime store instead of waiver_claims.
//
// The server keeps every claim out of the league's state (private: waiver_claims) and runs the waiver clock lazily under the league
// lock, before and after every write and on a read with a step due (syncWaivers): open a week once an episode has results, cancel it
// if those results are taken back, process it (every claim, computer players' too: Bot.waiverClaim) at its time, close it. The runtime
// does the same on every action, at the scenario's clock, through the same WaiverLogic. Two differences, both for exact replay: a
// week's id is seeded (the engine's is Core.uid), and a claim's place in "who has claims in" is the store's sequence (the table's
// updated_at). A game at its own pace with exclusive teams runs its weeks on the league as it stood at everyone's episode (syncPaced,
// sync point 2 of docs/PLAN-own-pace-games.md), folded back onto the league.
//
// The store, per game: { seq, weeks: { [periodId]: { [playerId]: { claim, seq } } } }.
const S = require('../../../src/lib/game/state-logic');
const Bots = require('../../../src/lib/game/bot-logic.js');
const W = S.WaiverLogic, G = S.GhostLogic;

// ---- A game at your own pace with exclusive teams (waivers.js, ported as is) ----
function pacedMark(state) {
  if (!G.draftsTogether(state)) return null;
  const people = state.players.filter(p => !p.automated && !p.disabled && p.lateJoin);
  if (!people.length) return null;
  return Math.min(...people.map(p => (Number.isInteger(p.lateJoin.seenThrough) ? p.lateJoin.seenThrough : (p.lateJoin.startEpisode || 1) - 1)));
}
function pacedCopy(state) { const n = pacedMark(state); return n === null ? null : S.SpoilerLogic.viewThrough(state, n); }
const OWNED_KEYS = ['ownerIds', 'acquiredVia', 'replenishClaimed', 'formerOwnerId', 'departedVia'];
function foldBack(state, copy) {
  state.midSeason = copy.midSeason;
  copy.castaways.forEach(c => { const f = state.castaways.find(x => x.id === c.id); if (!f) return; OWNED_KEYS.forEach(k => { if (c[k] === undefined) delete f[k]; else f[k] = c[k]; }); });
}
function lossAt(copy) {
  const n = S.SpoilerLogic.latestWithResults(copy), ep = copy.episodes.find(e => e.number === n);
  return !!ep && copy.castaways.some(c => c.exitEpisodeId === ep.id && W.lossOpen(copy, c));
}
function owedIn(copy, period) {
  const owed = copy.players.filter(p => !p.automated && !p.disabled && W.replacementsOwed(copy, p.id, period).count > 0).map(p => p.id);
  return owed.length > 0 && owed.every(id => (period.claimsIn || []).includes(id));
}

// ---- The claim store (waiver_claims) ----
const week = (store, periodId) => (store.weeks[periodId] ||= {});
const claimsOf = (store, period) => Object.fromEntries(Object.entries(store.weeks[period.id] || {}).map(([pid, x]) => [pid, JSON.parse(JSON.stringify(x.claim))]));
function republish(state, store, period) { W.setClaimsIn(state, period, Object.entries(store.weeks[period.id] || {}).sort(([a, x], [b, y]) => x.seq - y.seq || (a < b ? -1 : 1)).map(([pid]) => pid)); }
function dropClaims(store, periodId) { delete store.weeks[periodId]; }

/** The week opened, its id seeded (the engine's is random): wv-<game>-<its episode>-<its place among the game's weeks>. */
function openWeek(state, now, gameId) {
  const p = W.open(state, now);
  p.id = 'wv-' + gameId + '-' + p.episode + '-' + W.periods(state).length;
  return p;
}
function processPeriod(state, store, now, by) {
  const period = W.current(state);
  if (!period || period.phase !== 'open') return null;
  const claims = claimsOf(store, period);
  const bots = G.ownPace(state) ? state.players.filter(p => Bots.isBot(p)).map(p => p.id) : Bots.botIds(state);
  bots.forEach(pid => { if (!claims[pid]) claims[pid] = Bots.waiverClaim(state, pid, period); });
  return W.process(state, claims, { now, by });
}

/** Runs `fn` with the engine's ids seeded (Core.uid is random: a processed claim's transaction, a free-agency move): <prefix>_zt-<game>-<the
 *  league log's length>-<a counter>, so a replay writes the same ids. */
function seeded(state, gameId, fn) {
  const uid = S.Core.uid, base = (state.midSeason && state.midSeason.log ? state.midSeason.log.length : 0);
  let n = 0;
  S.Core.uid = prefix => (prefix || 'id') + '_zt-' + gameId + '-' + base + '-' + n++;
  try { return fn(); } finally { S.Core.uid = uid; }
}

/** syncWaivers: every step due at `now`, in order. The events, oldest first. */
function sync(state, store, now, gameId) { return seeded(state, gameId, () => syncIn(state, store, now, gameId)); }
function syncIn(state, store, now, gameId) {
  if (G.draftsTogether(state)) return syncPaced(state, store, now, gameId);
  const events = [];
  W.refit(state);
  W.refresh(state);
  for (let i = 0; i < 8; i++) {
    const step = W.due(state, now);
    if (!step) break;
    const period = W.current(state);
    if (step === 'open') { const p = openWeek(state, now, gameId); events.push({ type: 'opened', periodId: p.id, episode: p.episode }); }
    else if (step === 'cancel') { W.cancel(state); dropClaims(store, period.id); events.push({ type: 'cancelled', periodId: period.id, episode: period.episode }); }
    else if (step === 'process') { processPeriod(state, store, now, 'schedule'); events.push({ type: 'processed', periodId: period.id, episode: period.episode }); }
    else { W.close(state, now); dropClaims(store, period.id); events.push({ type: 'closed', periodId: period.id, episode: period.episode }); }
  }
  W.refresh(state);
  return events;
}
function syncPaced(state, store, now, gameId) {
  const copy = pacedCopy(state);
  if (!copy) return [];
  const events = [];
  W.refresh(copy);
  for (let i = 0; i < 8; i++) {
    let step = W.due(copy, now);
    const period = W.current(copy);
    if (step === 'open' && !lossAt(copy)) break;
    if (!step && period && period.phase === 'open' && !period.hold && owedIn(copy, period)) step = 'process';
    if (!step) break;
    if (step === 'open') { const p = openWeek(copy, now, gameId); events.push({ type: 'opened', periodId: p.id, episode: p.episode }); }
    else if (step === 'cancel') { W.cancel(copy); dropClaims(store, period.id); events.push({ type: 'cancelled', periodId: period.id, episode: period.episode }); }
    else if (step === 'process') { processPeriod(copy, store, now, 'schedule'); events.push({ type: 'processed', periodId: period.id, episode: period.episode }); }
    else { W.close(copy, now); dropClaims(store, period.id); events.push({ type: 'closed', periodId: period.id, episode: period.episode }); }
  }
  W.refresh(copy);
  if (events.length) foldBack(state, copy);
  return events;
}

/** saveClaim (the claims route's PUT: { pairs } the whole claim, or { spot } one spot of it): the claim checked and stored, or withdrawn
 *  when empty. null, or why not. */
function saveClaim(state, store, playerId, input, now, gameId) {
  const copy = pacedCopy(state), on = copy || state, period = W.current(on);
  // `{ spot: { dropId, addIds } }`: one spot's ranked choices, the rest of the saved claim kept (WaiverLogic.setSpot), as the app sends it.
  let pairs = input.pairs;
  if (input.spot) {
    if (!period) return 'Waivers aren’t open';
    if (typeof input.spot.dropId !== 'string' || !Array.isArray(input.spot.addIds)) return 'Choose who to drop and who to add';
    pairs = W.setSpot(on, period, playerId, store.weeks[period.id]?.[playerId]?.claim?.pairs || [], input.spot.dropId, input.spot.addIds);
  }
  const checked = W.checkClaim(on, period, playerId, { pairs });
  if (checked.error) return checked.error;
  const w = week(store, period.id);
  if (W.isEmptyClaim(checked.claim)) delete w[playerId]; else w[playerId] = { claim: checked.claim, seq: ++store.seq };
  republish(on, store, period);
  if (copy) { foldBack(state, copy); syncPaced(state, store, now, gameId); }
  return null;
}

// ---- Whoever runs the game (the routes' window, process and undo; Backstage › Waivers' window, run, undo and claimFor) ----
// As the server runs them (waivers.js handOn, BACKLOG 56 fixed 2026-11-14): on the league itself, or, in a game at its own pace with
// exclusive teams, on the copy at everyone's episode, folded back (`none`: such a game with nobody on an episode yet). The waiver
// clock then syncs after the action, as the lock syncs it after every write.
function handOn(state) {
  if (!G.draftsTogether(state)) return { on: state, copy: null, none: false };
  const copy = pacedCopy(state);
  return { on: copy || state, copy, none: !copy };
}
/** The week whoever runs the game sees as the current one (waivers.js currentWeek), or null. */
function currentWeek(state) { const { on, none } = handOn(state); return none ? null : W.current(on); }

/** processNow (Process now / Run now): every claim that's in, at once, by 'commissioner'. A reason on refusal, else null. */
function processNow(state, store, now) {
  const { on, copy, none } = handOn(state);
  const period = none ? null : W.current(on);
  if (!period || period.phase !== 'open') return 'Waivers aren’t open';
  processPeriod(on, store, now, 'commissioner');
  if (copy) foldBack(state, copy);
  return null;
}

/** undoRun (Undo last waiver run): the week's moves taken back, its claims open again, the week held. A reason on refusal, else null. */
function undoRun(state) {
  const { on, copy, none } = handOn(state);
  if (none) return 'There’s no waiver run to undo';
  const refused = W.undo(on);
  if (!refused && copy) foldBack(state, copy);
  return refused;
}
const NOBODY_YET = 'Open a waiver window once everyone has watched an episode';

/** openWindow (Open a waiver window: `swaps` each, or null to turn the window off; opts.replace, the window's own say on replacements).
 *  A week it opens gets the seeded id a week the clock opens gets. Saved claims that no longer fit are trimmed, each trimmed claim
 *  rewritten at one moment (the server's rows share the transaction's now(), so "who has claims in" lists them after the others, by
 *  seat); a week that ends takes every claim. { period, trimmed } or { error }. */
function openWindow(state, store, swaps, now, opts, gameId) {
  const { on, copy, none } = handOn(state);
  if (none) return { error: NOBODY_YET };
  const had = W.current(on);
  const r = W.openWindow(on, swaps, now, opts);
  if (r.error) return { error: copy && /once an episode has results/.test(r.error) ? NOBODY_YET : r.error };
  const period = r.period, trimmed = [];
  if (!had) period.id = 'wv-' + gameId + '-' + period.episode + '-' + W.periods(on).length;
  if (r.closed) { trimmed.push(...Object.keys(store.weeks[period.id] || {})); dropClaims(store, period.id); period.claimsIn = []; if (copy) foldBack(state, copy); return { period, trimmed }; }
  const w = store.weeks[period.id] || {};
  let seq = 0;
  for (const [playerId, x] of Object.entries(w)) {
    const t = W.trimClaim(on, period, playerId, x.claim);
    if (!t.removed) continue;
    trimmed.push(playerId);
    if (W.isEmptyClaim(t.claim)) delete w[playerId]; else w[playerId] = { claim: t.claim, seq: (seq ||= ++store.seq) };
  }
  republish(on, store, period);
  if (copy) foldBack(state, copy);
  return { period, trimmed };
}

module.exports = { sync, saveClaim, pacedCopy, seeded, processNow, openWindow, undoRun, currentWeek };
