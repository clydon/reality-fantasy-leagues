// A game in stages in the runtime (the server's side: src/lib/server/stages.ts, engine-lab.ts makeStages, answer-points.ts stageWalk;
// the engine's: state-logic.js StageLogic). On the server each stage is a league of its own tied to the game (leagues.stage_of,
// stage_key), an ordinary game the engine plays exactly as it would alone; the game holds the seats and its table is the overall,
// worked out on every read from its stages' tables. Here the same: each stage is a game of its own in the definition, derived from
// its parent's spec (never written by hand), which every action, projection, invariant and materialized row treats as any game;
// the parent's table is built from their tables as stageWalk builds it.
//
// Connected: stages that start at an episode or a phase on the game's own season (the specimens' "before the merge, then from it").
// A stage a format change starts (its `on`: change-stages.ts makes a copy when the change comes), a side stage, one alongside (bingo
// with trivia) and one on another season are gaps the profile names.
const S = require('../../../src/lib/game/state-logic'), G = require('../../../src/lib/game/game-spec');
const J = require('./json.cjs');
const SEP = '~';
const childId = (parentId, key) => parentId + SEP + key;
/** A game's stages as its whole spec has them, or null (not a game in stages, or a spec the engine can't read). */
function stagesOf(game) {
  try { const full = G.fullSpec(game.spec); return Array.isArray(full.stages) && full.stages.length ? full.stages : null; } catch { return null; }
}
/** The stages made with the game (engine-lab.ts makeStages): not one a format change starts, nor a side stage (made when theirs comes). */
const madeWith = st => J.object(st) && J.object(st.game) && typeof st.id === 'string' && !G.stageOn(st) && !G.stageSide(st);
/**
 * The definition's games with each game in stages' stages after it: { id: '<game>~<stage>', spec: the game the stage's own league
 * plays (Spec.stageLeagueGame), the game's context, seats, roles and timing, stageOf, stageKey }. Derived every time (a stage game
 * given in the input is replaced by its derivation: the parent's spec is the one source), so it's the same list however often it runs.
 */
function expand(games) {
  const out = [];
  for (const game of games.filter(g => g.stageOf === undefined)) {
    out.push(game);
    for (const [i, st] of (stagesOf(game) || []).entries()) {
      if (!madeWith(st)) continue;
      let spec; try { spec = G.stageLeagueGame(st); } catch { continue; }
      if (!J.object(spec)) continue;
      out.push({ id: childId(game.id, st.id), name: (game.name || 'Stages') + ' · ' + (st.name || 'Stage ' + (i + 1)), contextId: game.contextId, spec: J.clone(spec), contextOverrides: J.clone(game.contextOverrides || {}), contextBindings: [], seats: (game.seats || []).slice(), roles: J.clone(game.roles || {}), timing: game.timing, stageOf: game.id, stageKey: st.id });
    }
  }
  return out;
}
const isParent = game => game.stageOf === undefined && !!stagesOf(game);
const childrenOf = (games, parentId) => games.filter(g => g.stageOf === parentId);
/** Where a stage game sits in its parent's stages (0 for the first), or -1. */
function indexIn(games, child) {
  const parent = games.find(g => g.id === child.stageOf);
  return parent ? (stagesOf(parent) || []).findIndex(st => st.id === child.stageKey) : -1;
}
/**
 * answer-points.ts stageWalk, ported for the connected stages (drafts and pools: no answers, bingo or calls, one season): each stage
 * as it stands, its table as it stood after each episode it played with results (the table anyone on its couch sees at that mark,
 * no seat: `tableAt(child, state, n)` is the production game view's { over, table }), up to the episode it's over at; where it
 * starts and ends, and how it takes someone new. `kids`: [{ game, state }] in the definition's order.
 */
function walkOf(kids, tableAt) {
  return { stages: kids.map(({ game, state }) => {
    const from = S.startEpisode(state), latest = S.SpoilerLogic.latestWithResults(state), entries = [];
    for (let n = from ?? latest + 1; n <= latest; n++) {
      if (!state.episodes.some(e => e.number === n && S.episodeHasResults(e))) continue;
      const v = tableAt(game, state, n);
      entries.push({ episode: n, over: v.over, rows: v.table.map(t => ({ playerId: t.playerId, points: t.total, place: t.place })) });
      if (v.over) break;
    }
    const joins = entries.length && entries[entries.length - 1].over ? 'over' : S.StageLogic.joinsOf(state);
    return { key: game.stageKey, leagueId: game.id, from, to: S.lastEpisode(state), joins, entries };
  }) };
}
/**
 * A draft that opens at its game's start (the draft room's opens 'start': a later stage's, DraftLogic.waits), as it opens. The
 * runtime starts after a draft, so this one is made the moment it opens, by the engine's own draft: first the server's
 * settleStageDraft (an exclusive draft the seats no longer fit among who's still in is played shared from then on:
 * settleDraftShare), then every seat's team from who's still in, seeded from the definition and the game: a private draft locked in
 * and revealed (BlindDraftLogic, each sheet checked as the lock route checks it), or a snake picked turn by turn
 * (DraftLogic.pick). Stamped at the scenario's clock, so a replay drafts the same. A generated setup
 * operation, never a person's move: the draft room as actions is its own capability.
 * Returns { shared: what settleDraftShare did or null, short: true when a sheet can't be made (fewer still in than a team takes:
 * nobody can lock one in, so the draft stays open) } or null when there's no draft to make now.
 */
function draftAtStart(document, game, state, clock) {
  const room = S.gameOf(state).get.by === 'draft' ? S.gameOf(state).extras.draft : null;
  if (!room || room.opens !== 'start' || S.DraftLogic.waits(state) || S.DraftLogic.begun(state)) return null;
  const shared = S.settleDraftShare(state), g = S.gameOf(state).get;
  const num = (...parts) => parseInt(J.digest([document.seed, game.id, 'stage-draft', ...parts]).slice(0, 8), 16);
  const order = pid => S.PoolLogic.offered(state).map(c => c.id).sort((a, b) => num(pid, a) - num(pid, b) || (a < b ? -1 : 1));
  const stamp = () => { for (const k of ['draftTurnAt', 'draftStartedAt']) if (state[k]) state[k] = clock; for (const x of state.draftLog || []) x.at = clock; };
  if (!['snake', 'blind'].includes(g.order)) throw Error('Only a snake or a private draft opens at its start here (the profile refuses the rest)');
  if (g.own === 'shared') {
    S.DraftLogic.forceStart(state); stamp();
    const seats = S.BlindDraftLogic.eligiblePlayers(state), picks = {};
    for (const p of seats) { const ids = order(p.id).slice(0, g.each); if (S.BlindDraftLogic.validateSubmission(state, p.id, ids)) return { shared, short: true }; picks[p.id] = ids; }
    S.BlindDraftLogic.setLockedPlayerIds(state, seats.map(p => p.id));
    S.BlindDraftLogic.reveal(state, picks, clock);
    S.BlindDraftLogic.setLockedPlayerIds(state, []);
    return { shared, short: false };
  }
  S.DraftLogic.forceStart(state);
  for (let i = 0; i < 1000; i++) {
    const turn = S.DraftLogic.currentTurn(state);
    if (!turn || turn.isComplete) break;
    const made = state.draftPicksMade, want = order(turn.playerId);
    for (const id of want) { S.DraftLogic.pick(state, id); if (state.draftPicksMade > made) break; }
    if (state.draftPicksMade === made) { stamp(); return { shared, short: true }; }
  }
  stamp();
  return { shared, short: false };
}
module.exports = { SEP, childId, stagesOf, madeWith, expand, isParent, childrenOf, indexIn, walkOf, draftAtStart };
