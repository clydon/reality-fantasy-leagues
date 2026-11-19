// How a game's preview plays its made-up season in the explorer's runtime (docs/PLAN-game-preview.md), shared by the two ways a
// preview is made: the bench's, which shoots the real screens (preview.cjs), and the live one, made on demand with no browser
// (live.cjs). One walk, so both play the same season the same way: each night's results (made up past the viewer's mark, decision 7),
// who reveals them, and a draft reopened where the real room runs it.
const path = require('path');
const root = path.resolve(__dirname, '..', '..', '..');
const { resultsData } = require('../explorer/publish.cjs');
const Data = require('../explorer/runtime-data.cjs');
const S = require(path.join(root, 'src/lib/game/state-logic.js'));
const Players = require('./players.cjs');

const HOUR = 3600000;
const copy = (x) => JSON.parse(JSON.stringify(x));

/** The first stage's (or the game's) blind draft open, as a new game's is before anyone picks: the runtime dealt it at the start;
 *  here nobody's on a team, nobody's locked in and nothing's revealed (BlindDraftLogic's public half), so the real room runs it. */
function draftOpenAtStart(snap, gameId) {
  const next = copy(snap), st = next.games[gameId].state;
  for (const x of st.castaways) x.ownerIds = [];
  st.draftPicksMade = 0;
  st.blindDraft = { lockedPlayerIds: [], revealedAt: null };
  return next;
}
/** A later stage's draft open as the results that open it come in (check-stages-explorer.js draftOpen): its state from before those
 *  results, with them applied and its span settled as the runtime settles any write, less the draft the runtime then makes. */
function draftOpenLater(before, after, document, gameId) {
  const st = copy(before.games[gameId].state), world = after.contexts[document.games.find((g) => g.id === gameId).contextId], game = document.games.find((g) => g.id === gameId);
  Data.applyFacts(world, st); Data.syncMarks(world, game, st); Data.settleWrite(world, st, { phases: true, clock: after.clock });
  if (S.DraftLogic.waits(st) || st.castaways.some((x) => x.ownerIds.length)) return null;
  return { ...after, games: { ...after.games, [gameId]: { ...after.games[gameId], state: st } } };
}
const teamsOf = (st) => Object.fromEntries(st.players.map((p) => [p.id, st.castaways.filter((x) => x.ownerIds.includes(p.id)).map((x) => x.id).sort()]));
const isBlind = (st) => !!st && S.BlindDraftLogic.on(st);

/** One session's walk: who's who, the season's episodes and the viewer's mark, and the steps that move it (`must`: an action the
 *  runtime must accept; `night`: episode n airs, its results come in and `who` reveal it). `o.viewerId`, `o.seed`, `o.resultsFor`. */
function walk(s, o = {}) {
  const doc = s.export().input;
  const viewer = o.viewerId || doc.situation.viewerId;
  const top = doc.games.find((g) => g.stageOf === undefined);
  const stages = doc.games.filter((g) => g.stageOf === top.id);
  const playable = Players.playable(s);
  const ctxId = top.contextId;
  const people = doc.world.people.map((p) => p.id);
  const couch = people.filter((id) => id !== viewer);
  const seed = o.seed ?? doc.seed;
  const events = () => s.snapshot().contexts[ctxId].events;
  const markOf = (pid) => s.snapshot().contexts[ctxId].marks?.find?.((m) => m.personId === pid)?.through ?? doc.situation.marks.find((m) => m.personId === pid)?.through ?? 0;
  const first = markOf(viewer) + 1;
  const last = Math.max(...events().map((e) => e.number));
  const results = o.resultsFor || ((sess, n) => { const snap = sess.snapshot(), e = snap.contexts[ctxId].events.find((x) => x.number === n); return resultsData(snap, sess.export().input, ctxId, e.id, 'final'); });
  const must = (action) => { const r = s.apply(action, 'preview'); if (r.status !== 'accepted') throw Error('Refused: ' + JSON.stringify(action).slice(0, 160) + ' (' + r.message + ')'); return r; };
  const night = (n, who = people) => {
    const e = events().find((x) => x.number === n);
    must({ type: 'clock', at: new Date(Math.max(Date.parse(s.snapshot().clock), Date.parse(e.airAt) + 2 * HOUR)).toISOString() });
    must({ type: 'results', contextId: ctxId, eventId: e.id, source: 'provider-fixture', resultStatus: 'final', data: results(s, n) });
    for (const p of who) s.apply({ type: 'reveal', contextId: ctxId, personId: p }, 'preview');
  };
  const views = () => Object.fromEntries(doc.games.map((g) => [g.id, s.project(g.id, viewer)]));
  const over = () => s.project(top.id, viewer).game.over;
  return { doc, viewer, top, stages, playable, ctxId, people, couch, seed, events, markOf, first, last, results, must, night, views, over };
}

module.exports = { walk, draftOpenAtStart, draftOpenLater, teamsOf, isBlind, HOUR };
