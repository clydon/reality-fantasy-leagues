// Headless case execution. No DB, browser, global clock replacement or mutable cross-case state.
const path = require('path');
const S = require('../../../src/lib/game/state-logic'), G = require('../../../src/lib/game/game-spec');
const D = require('./document.cjs'), J = require('./json.cjs'), P = require('./planner.cjs'), Data = require('./runtime-data.cjs'), Profile = require('./runtime-profile.cjs'), Stages = require('./stages.cjs');
// Weekly Calls (runtime-calls.cjs), loaded only by a case that has them (it reads the TypeScript calls module).
let callsModule = null; const Calls = () => callsModule || (callsModule = require('./runtime-calls.cjs'));
let waiversModule = null; const Waivers = () => waiversModule || (waiversModule = require('./runtime-waivers.cjs'));
const isWeekly = game => G.callsAsk(G.fullSpec(game.spec).ask);
const isBeatGame = game => (G.fullSpec(game.spec).ask || []).some(q => G.isBeat(q));
/** A14 part 2: how the couch did against the bot (answer-points.ts botLine, ported: it reads the grade, not the DB). */
function botLineOf(view, rows, facts, graded) {
  const qs = new Map(S.AnswerLogic.questions(view).filter(q => G.isBeat(q)).map(q => [q.id, q])), calls = facts.bot;
  if (!qs.size || !calls) return null;
  const seats = new Set(view.players.map(p => p.id)), byWindow = new Map();
  for (const a of rows) { const q = qs.get(a.question); if (!q || !seats.has(a.playerId)) continue; const key = G.botKey(q, a.episode); byWindow.set(key, [...(byWindow.get(key) || []), { playerId: a.playerId, answer: a.answer }]); }
  const line = { called: 0, right: 0, vs: {} };
  for (const [key, call] of calls) {
    const cut = key.lastIndexOf('|'), q = qs.get(key.slice(0, cut)); if (!q) continue;
    const ep = Number(key.slice(cut + 1)), list = byWindow.get(key) || [], right = G.botRight(q, graded.verdicts.get(key) ?? G.verdictOf(q, ep, facts), call, list, facts);
    if (right === null) continue; line.called++; if (right) line.right++;
    const got = graded.earned.get(key);
    for (const a of list) { const r = (line.vs[a.playerId] ??= { beat: 0, beaten: 0 }); if ((got?.get(a.playerId) ?? 0) > 0) r.beat++; else if (right) r.beaten++; }
  }
  return line;
}
const jiti = require('jiti')(__filename, { alias: { '@': path.resolve(__dirname, '../../../src') } });
const { gameView } = jiti('../../../src/lib/game/game-view.ts');
const VERSION = 'core-runtime-28'; // 28: live only is stored as live and strict (settings.lockAtAir: the product's pace setting, 2026-11-13, whose default for a live game is now a move open until you've watched); behaviour unchanged, states differ // 27: a game in stages (stages.cjs: each stage a game of its own beside it, derived from its spec; the game's table the overall, from their tables as answer-points.ts stageWalk reads them; a stage's draft that opens at its start made as it opens, from who's still in) // 26: what whoever runs the game does with its waivers (the waiverWindow, waiverRun and waiverUndo actions, and a claim sent for someone: forId), as the routes and Backstage run them; a free-agency move waits for the week's reveal, as its route makes it // 25: mid-season waivers (claims in a private store, the waiver clock synced on every action as the server syncs it: runtime-waivers.cjs; the claim and freeAgency actions) // 24: an auction's sealed bids, generated and settled at setup as the server settles them // 23: pairs the show forms (context.pairs, in the stored answers' format section), group slots settled from them as the server settles them, the groupSlot action // 22: a pool's second pick (the pick action's second: true) // 21: a world's tribes (context.tribes, in blocks) and a draft spread across them (get.across), drafted in snake rounds // 20: secret roles (the deal, seeded from the game's id, stamped as secret-roles.ts stamps it) // 19: a lineup's captain (captainId with the lineup, as the lineup route takes it) // 18: the top scorer's twist (its choices per episode, the twist action, stamped as twists.ts stamps them) // 17: beat the bot (its calls per window, the botCall action, facts.bot, the bot line) // 16: the projection grades on the viewer's copy carrying its walk, cut at the game's end (answer-points.ts walked), so whole-game questions settle where the game ended // 15: confidence picks (who goes home, ranked surest first) // 14: Weekly Calls (a person's calls on the context: runtime-calls.cjs; the call action) // 13: a game with an answer walk ranks by the walk's totals (frozen at its end), as answer-points.ts pointsOf; the open window's worth (a rollover's jackpot) in the projection // 12: bounties (who voted for whom, stamped as the server stamps it); 5: side bets; 6: season-long questions (asked once: who wins, the final N); 7: head to head (the server's settle on each write); 8: answers refused once you're out or the game has ended (lives, races, head to head's final); 9: only the answers that count (liveRows) once someone's out; 10: stakes held to your points or the bank (answers.ts stakeMost); 11: phases (settleIn after results and at setup) // 2: results need their event to have aired; 3: realistic generated cast names; 4: ownPace stored as production does
const RESTORE = Symbol('restore verified checkpoints');
class Blocked extends Error {
  constructor(report) { super(report.message || report.category); this.report = report; }
}
const blocked = (category, message, extra = {}) => { throw new Blocked({ ok: false, status: 'blocked', category, message, ...extra }); };
const copy = value => J.clone(value);

function open(input, internal = {}) {
  const document = D.read(input);
  if (document.games.length > 32 || document.games.some(g => (g.spec.ask || []).length > 64)) blocked('tool-budget', 'The current case budget is 32 games and 64 questions per game, not an engine limit');
  const sizeOf = contextId => {
    const context = document.world.contexts.find(c => c.id === contextId);
    return { participants: document.world.participants.filter(p => p.contextId === contextId).length || context.engine.pool || 18, events: document.world.events.filter(e => e.contextId === contextId).length || document.content.eventCount || (document.content.completedEvents ?? 2) + 1, actors: document.world.people.length || context.engine.couch || 2 };
  };
  const estimatedCells = document.world.contexts.reduce((n, c) => { const s = sizeOf(c.id); return n + s.participants * s.events; }, 0)
    + document.games.reduce((n, g) => { const s = sizeOf(g.contextId); return n + (s.participants + s.actors * (g.spec.get?.each || 1)) * s.events; }, 0);
  if (estimatedCells > 10000) blocked('tool-budget', 'Case exceeds the 10000 participant/choice-event materialization budget; use smaller independent cases', { estimatedCells });
  const analysis = require('./analyze.cjs').analyze(document);
  if (analysis.engine.status !== 'valid' || document.testMode !== 'playable') blocked('engine-definition', 'Runtime requires an engine-valid playable definition', { analysis });
  const support = Profile.inspect(document);
  if (support.gaps.length) blocked('adapter-gap', 'This definition needs additional runtime adapters', { gaps: support.gaps, analysis });
  if (analysis.diagnostics.length) blocked('context-gap', 'Resolve compiler/context diagnostics before execution', { diagnostics: analysis.diagnostics });

  let state = { clock: document.situation.clock, people: [], contexts: {}, games: {}, stores: { answers: {} } };
  const definitions = new Map(document.games.map(g => [g.id, g]));
  const scopes = new Map(document.games.map(g => ['game:' + g.id, g]));
  const contextDefs = new Map(document.world.contexts.map(c => [c.id, c]));
  const adapters = [
    { id: 'world.people', version: 1, provides: ['world:people'], requires: [], owns: ['people'], execute() { state.people = Data.people(document); } },
    { id: 'world.context', version: 1, provides: ['world:context'], requires: [{ key: 'world:people', scope: 'world' }], owns: ['events', 'participants', 'facts', 'marks'], execute(step) { const c = contextDefs.get(step.contextId); state.contexts[c.id] = Data.contextData(document, c, state.people); } },
    { id: 'game.state', version: 1, provides: ['state:game'], requires: [{ key: 'world:context', scope: 'context' }], owns: ['state', 'answers'], execute(step) {
      const game = scopes.get(step.scope), built = Data.gameData(document, game, state.contexts[game.contextId], state.people);
      state.games[game.id] = built;
      const rows = document.setup.stores.answers?.[game.id] || [];
      if (!Array.isArray(rows)) throw Error('Answers store must contain arrays keyed by game ID');
      state.stores.answers[game.id] = copy(rows);
    } },
    { id: 'game.projection', version: 1, provides: ['runtime:game'], requires: ['state:game'], owns: [], execute() {} },
  ];
  const requirements = document.games.map(g => ({ scope: 'game:' + g.id, gameId: g.id, contextId: g.contextId, key: 'runtime:game', origins: [] }));
  const plan = P.plan(requirements, adapters);
  if (plan.status === 'blocked') blocked('adapter-plan', 'Runtime dependency planning failed', { plan });
  try {
    for (const step of plan.steps) adapters.find(a => a.id === step.adapterId).execute(step);
    for (const id of Object.keys(document.setup.stores.answers || {})) if (!definitions.has(id)) throw Error('Answer store refers to an unknown game');
    // Secret roles: each game's deal (secret_role_deals: { seed, seats, holders, role }, or null until due), kept only for a game with roles.
    const roleGames = document.games.filter(g => S.SecretRoleLogic.of(state.games[g.id].state)).map(g => g.id);
    if (roleGames.length) { state.stores.roles = {}; for (const id of roleGames) state.stores.roles[id] = null; }
    // The top scorer's twist: each game's choices by episode (twist_choices: { playerId, twist, filed, how }), kept only for a game with one.
    const twistGames = document.games.filter(g => S.TwistLogic.of(state.games[g.id].state)).map(g => g.id);
    if (twistGames.length) { state.stores.twists = {}; for (const id of twistGames) state.stores.twists[id] = {}; }
    // Mid-season waivers: each game's private claims by week (waiver_claims: runtime-waivers.cjs), kept only for a game that uses them.
    const waiverGames = document.games.filter(g => S.WaiverLogic.enabled(state.games[g.id].state)).map(g => g.id);
    if (waiverGames.length) { state.stores.waivers = {}; for (const id of waiverGames) state.stores.waivers[id] = { seq: 0, weeks: {} }; }
    // Beat the bot: each game's bot calls (bot_calls: one a window, made before its lock; setup.stores.bot[gameId]), kept only where a
    // game plays a question against the bot.
    const botGames = new Set(document.games.filter(isBeatGame).map(g => g.id));
    if (botGames.size || document.setup.stores.bot) {
      state.stores.bot = {};
      for (const id of botGames) state.stores.bot[id] = [];
      for (const [id, rows] of Object.entries(document.setup.stores.bot || {})) {
        if (!botGames.has(id) || !Array.isArray(rows)) throw Error('Bot store must hold arrays keyed by a game with a question played against the bot');
        for (const r of rows) if (typeof r.question !== 'string' || !Number.isInteger(r.episode) || r.answer === undefined || Object.keys(r).some(k => !['question', 'episode', 'answer'].includes(k))) throw Error('Supplied bot call rejected: ' + JSON.stringify(r));
        state.stores.bot[id] = copy(rows);
      }
    }
    // Weekly Calls: each context's calls (made before the case starts: setup.stores.calls[contextId]), kept only where a game counts them.
    const callContexts = new Set(document.games.filter(isWeekly).map(g => g.contextId));
    if (callContexts.size || document.setup.stores.calls) {
      state.stores.calls = {};
      for (const id of callContexts) state.stores.calls[id] = [];
      for (const [id, rows] of Object.entries(document.setup.stores.calls || {})) {
        if (!callContexts.has(id) || !Array.isArray(rows)) throw Error('Calls store must hold arrays keyed by a context a Weekly Calls game is on');
        for (const r of rows) if (!state.people.some(p => p.id === r.personId) || !Number.isInteger(r.episode) || typeof r.question !== 'string' || typeof r.answer !== 'string' || Object.keys(r).some(k => !['personId', 'episode', 'question', 'answer'].includes(k))) throw Error('Supplied call rejected: ' + JSON.stringify(r));
        state.stores.calls[id] = copy(rows);
      }
    }
    for (const [id, built] of Object.entries(state.games)) {
      const spec = G.fullSpec(definitions.get(id).spec);
      const seen = new Set();
      for (const row of state.stores.answers[id]) {
        const q = spec.ask.find(q => q.id === row.question), key = J.canonical([row.playerId, row.episode, row.question]);
        if (!q || !built.state.players.some(p => p.id === row.playerId) || !(q?.asked === 'once' ? row.episode === 0 : built.state.episodes.some(e => e.number === row.episode)) || seen.has(key) || Object.keys(row).some(k => !['playerId', 'episode', 'question', 'answer'].includes(k))) throw Error('Invalid, unconnected or duplicate supplied answer row');
        const before = S.GhostLogic.viewFor(built.state, row.playerId, row.episode - 1);
        const problem = G.answerProblem(q, row.answer, new Set(S.AnswerLogic.faces(before, q, { playerId: row.playerId }).map(c => c.id)));
        if (problem) throw Error('Supplied answer rejected: ' + problem);
        seen.add(key);
      }
    }
  } catch (error) { blocked('fixture-construction', error.message, { plan }); }
  stampAllRoles(); stampAllTwists(); stampAllWaivers();

  const initial = copy(state), initialHash = J.digest(state), versions = { ...J.versions(), runtime: VERSION };
  const versionDrift = ['engine', 'adapters'].filter(k => document.versions[k] !== versions[k]).map(k => ({ component: k, input: document.versions[k], executing: versions[k], policy: 'new execution; previous evidence not promoted' }));
  let trace = [], checkpoints = [], disposed = false;
  const alive = () => { if (disposed) throw Error('Runtime has been disposed'); };
  const worldFor = game => state.contexts[game.contextId];
  const markOf = (game, personId) => worldFor(game).marks.find(m => m.personId === personId)?.through ?? 0;
  // Whoever runs a game: the commissioner its roles name, else its first seat (as the materializer seats them: live-db.cjs).
  const runsGame = (game, full, id) => game.roles[id] === 'commissioner' || (!Object.values(game.roles).includes('commissioner') && full.players[0]?.id === id);
  // calls.ts lateOn's league check: on a game on this context they play at their own pace, one that plays episode n.
  const ownPaceOn = (contextId, personId, n) => document.games.some(g => g.contextId === contextId && state.games[g.id].state.players.some(p => p.id === personId) && S.GhostLogic.playsOwnPace(state.games[g.id].state, personId) && S.inPlay(state.games[g.id].state, n));
  // A question asked once is answered as episode 0 (game_answers' convention) and locks at the game's start or the finale:
  // the finale is the world's last episode, as the server reads it from the season's episode count.
  const finaleOf = game => Math.max(0, ...state.contexts[game.contextId].events.map(e => e.number));
  const askedFor = (q, seen) => q.asked === 'once' ? 0 : seen + 1;
  // answer-points.ts botCallsFor: the bot's calls on a game's questions played against it, each once its window has locked (as the
  // players' questions lock), by window ('question|episode'); botCalled, every window it called. None for a game without such a question.
  const botFacts = (game, full) => {
    const rows = state.stores.bot?.[game.id];
    if (!rows) return {};
    const qs = new Map(S.AnswerLogic.questions(full).filter(q => G.isBeat(q)).map(q => [q.id, q])), now = Date.parse(state.clock), bot = new Map(), botCalled = new Set();
    for (const r of rows) {
      const q = qs.get(r.question);
      if (!q || (q.asked !== 'once' && !S.AnswerLogic.opensAt(full, q, r.episode))) continue;
      const key = G.botKey(q, r.episode); botCalled.add(key);
      if (S.AnswerLogic.closed(full, q, r.episode, { now, finale: finaleOf(game) })) bot.set(key, r.answer);
    }
    return { bot, botCalled };
  };
  // The league as it stands (answer-points.ts asItStands; the server's reads and writes carry it): a game of questions that knocks
  // players out, races or shares lives walked over every answer and result, so it has ended, and someone is out, as the server says.
  const standsOf = (game, full) => G.answerParts(S.gameOf(full)) ? S.AnswerLogic.withWalk(full, S.AnswerLogic.walk(full, state.stores.answers[game.id], { ...S.AnswerLogic.facts(full), ...botFacts(game, full) })) : full;
  // The most someone can stake on a question that draws on their points ('total') or a bank (answers.ts stakeRoom, heldStakes,
  // stakeMost): their points as they stand for them (the walk's total, else graded on their own copy with the answers that count),
  // less what's on the line in their other stakes still to settle. Undefined for a stake that draws on neither (a fixed wager alone).
  function stakeLimit(game, full, q, personId, seen, episode) {
    const bank = G.bankOf(S.gameOf(full));
    if (!G.drawsOnBank(q, bank)) return undefined;
    const seenCopy = S.GhostLogic.viewFor(full, personId, seen), all = state.stores.answers[game.id], facts = S.AnswerLogic.facts(seenCopy);
    const walk = G.answerParts(S.gameOf(seenCopy)) ? S.AnswerLogic.walk(seenCopy, all, facts) : null;
    const view = S.spanView(walk ? S.AnswerLogic.withWalk(seenCopy, walk) : seenCopy), rows = walk ? S.AnswerLogic.liveRows(seenCopy, all, walk.out) : all;
    const graded = S.AnswerLogic.grade(view, rows, S.AnswerLogic.facts(view));
    const points = walk ? (walk.totals[personId] ?? 0) : (graded.points.get(personId) ?? 0), key = q.id + '|' + episode;
    let most = points;
    for (const a of rows) {
      const aq = S.AnswerLogic.questions(full).find(x => x.id === a.question);
      if (a.playerId !== personId || !aq || !G.drawsOnBank(aq, bank)) continue;
      const k = aq.id + '|' + (aq.asked === 'once' ? 0 : a.episode), stake = a.answer?.stake;
      if (k === key || graded.verdicts.get(k)?.state !== 'waiting' || !Number.isInteger(stake) || stake <= 0) continue;
      most -= stake;
    }
    return Math.max(0, Math.floor(most));
  }
  // Secret roles (secret-roles.ts stampSecretRoles, ported): on every read and write, each game with roles is dealt once due (it has
  // started), from a seed of the game's own id (the server's is random: the materialized deal carries this one), marked dealt, and
  // its deal stamped on the state once revealed (secretRoles: { at, holders }), else taken off.
  function stampAllRoles() {
    const now = Date.parse(state.clock), Ro = S.SecretRoleLogic;
    for (const id of Object.keys(state.stores.roles || {})) {
      const st = state.games[id].state, cfg = Ro.of(st);
      if (!cfg) { delete st.secretRoles; delete st.secretRolesDealt; continue; }
      if (!state.stores.roles[id] && Ro.due(st, now)) { const seed = 'zt-' + id, d = Ro.deal(st, seed); state.stores.roles[id] = { seed, seats: d.seats, holders: d.holders, role: cfg.name }; }
      const deal = state.stores.roles[id];
      if (deal) st.secretRolesDealt = true; else delete st.secretRolesDealt;
      const at = Ro.revealAt(st);
      if (deal && at !== null) st.secretRoles = { at, holders: [...deal.holders] }; else delete st.secretRoles;
    }
  }
  // The top scorer's twist (twists.ts stampTwists, ported): on every read and write, each game with a twist files each episode's
  // choice once it closes (the choice, if whoever made it still chooses by the data, else the spec's fallback), in order (each filing
  // read by the next one's chooser), and stamps every filed one on its episode; a league at its own pace (seats at different weeks)
  // plays the fallback every episode, nothing filed.
  // Mid-season waivers (waivers.js syncWaivers, ported: runtime-waivers.cjs): every step due at the scenario's clock, on every game
  // that uses them, as the server runs them on every read and write.
  function stampAllWaivers() {
    for (const [id, store] of Object.entries(state.stores.waivers || {})) Waivers().sync(state.games[id].state, store, Date.parse(state.clock), id);
  }
  function stampAllTwists() {
    const now = Date.parse(state.clock), T = S.TwistLogic;
    for (const [id, rows] of Object.entries(state.stores.twists || {})) {
      const st = state.games[id].state;
      if (!T.of(st)) { st.episodes.forEach(ep => delete ep.twist); continue; }
      const plays = new Set(T.episodes(st)), clear = () => st.episodes.forEach(ep => { if (!plays.has(ep.number)) delete ep.twist; });
      if (S.RevealLogic.isCatchingUp(st)) { clear(); const fb = T.file(st, 0, null, []); plays.forEach(n => { st.episodes.find(e => e.number === n).twist = { ...fb }; }); continue; }
      let series;
      for (const n of [...plays].sort((a, b) => a - b)) {
        const ep = st.episodes.find(e => e.number === n); let row = rows[n];
        if (!row?.filed && T.closed(st, n, now)) {
          const choice = row && row.playerId && row.twist ? { playerId: row.playerId, twist: row.twist } : null;
          if (choice) series ??= S.ScoringLogic.walk(st, { series: true }).series;
          const f = T.file(st, n, choice, choice ? series : []);
          row = rows[n] = { playerId: f.by, twist: f.id, filed: true, how: f.how };
          if (row.twist) series = undefined;
        }
        if (row?.filed) ep.twist = { id: row.twist, by: row.playerId, how: row.how ?? 'fallback' }; else delete ep.twist;
      }
      clear();
    }
  }
  // twists.ts openEpisode: the episode whose twist is being chosen now (the first the game plays that hasn't closed or been filed).
  const openTwist = (st, rows, now) => { if (S.RevealLogic.isCatchingUp(st)) return null; for (const n of S.TwistLogic.episodes(st)) { if (rows[n]?.filed || S.TwistLogic.closed(st, n, now)) continue; return n; } return null; };
  // answer-points.ts stageWalk (stages.cjs walkOf): each of a game in stages' stages as it stands, its table after each episode it
  // played as anyone on its couch sees it at that mark (the production game view, no seat, as the server calls it).
  const STAGE_REF = { leagueId: '', name: '', gameType: '', gameName: '', yourRole: null };
  // (Worked out once for each state the session passes through: every viewer's copy cuts the same walk at their own mark.)
  let walkRev = 0, walkAt = -1; const walks = new Map();
  const stageWalk = game => {
    if (walkAt !== walkRev) { walks.clear(); walkAt = walkRev; }
    if (!walks.has(game.id)) walks.set(game.id, Stages.walkOf(Stages.childrenOf(document.games, game.id).map(g => ({ game: g, state: state.games[g.id].state })), (child, st, n) => gameView(STAGE_REF, st, null, n, () => null, undefined)));
    return walks.get(game.id);
  };
  function resolveGame(gameId) {
    const game = definitions.get(gameId);
    if (!game) throw Error('Unknown game');
    return { game, full: state.games[gameId].state };
  }
  function readActor(game, full, personId) {
    if (!full.players.some(p => p.id === personId && p.active !== false && !p.disabled) || game.roles[personId] === 'spectator') throw Error('Actor is not a playing member of this game');
    return markOf(game, personId);
  }
  // `present` (optional): frame identity only, never state — { leagueId, userOf } for an application frame's IDs.
  function projection(gameId, personId = null, present = {}) {
    alive();
    const { game, full: stored } = resolveGame(gameId);
    // A game in stages as it stands (answer-points.ts asItStands): its stages' tables on it, so its own table is the overall; a
    // viewer's copy cuts them at their mark (SpoilerLogic.viewThrough).
    const full = S.StageLogic.on(stored) ? S.StageLogic.withWalk(stored, stageWalk(game)) : stored;
    if (personId !== null && !state.people.some(p => p.id === personId)) throw Error('Unknown person');
    const member = full.players.some(p => p.id === personId && p.active !== false && !p.disabled) && game.roles[personId] !== 'spectator';
    const seen = personId ? markOf(game, personId) : 0;
    const seenCopy = S.GhostLogic.viewFor(full, member ? personId : null, seen);
    const rows = state.stores.answers[gameId];
    // The facts as the server builds them on the viewer's copy (answer-points.ts answerFacts; its extras are sports-only): the walk
    // needs them passed (head to head and races walk episode by episode), as the grade would read them itself.
    // As answer-points.ts walked: the walk over every answer on the viewer's copy; then that copy carrying its walk, cut at the
    // game's end (spanView: a race won, a couch out of lives, a span's last episode), its facts read from it, so questions about
    // the whole game settle where the game ended (core-runtime-16); and only the answers that count (liveRows: someone out keeps
    // none about the whole game, nor any for a window still open when they went out) for grading, your answers and what's decided.
    // (The bot's calls go in both, as the server's serverFacts does: answer-points.ts factsOf.)
    const bf = botFacts(game, full), seenFacts = { ...S.AnswerLogic.facts(seenCopy), ...bf }, walk = S.AnswerLogic.walk(seenCopy, rows, seenFacts);
    const view = S.spanView(walk ? S.AnswerLogic.withWalk(seenCopy, walk) : seenCopy), facts = { ...S.AnswerLogic.facts(view), ...bf };
    const live = walk ? S.AnswerLogic.liveRows(seenCopy, rows, walk.out) : rows;
    const grade = S.AnswerLogic.grade(view, live, facts), lines = S.AnswerLogic.lines(seenCopy, rows, seenFacts);
    const now = Date.parse(state.clock);
    // The table's points as answer-points.ts pointsOf: a game with a walk (lives, a race, co-op) its walk's totals, frozen once it's
    // over (a season-long answer settled after a co-op couch lost counts for nothing); else the grade's.
    // Weekly Calls: the table from the person's calls (calls.ts leagueCalls); its one question isn't the answer grade's.
    const call = isWeekly(game) ? Calls().gameCalls(worldFor(game), state.stores.calls[game.contextId], full, member ? personId : null, seen, now) : S.AnswerLogic.questions(full).length ? { right: walk ? (id => walk.totals[id] ?? 0) : (id => grade.points.get(id) || 0), move: null, through: seen, walk, lines, bot: botLineOf(view, live, facts, grade) } : undefined;
    const ref = { leagueId: present.leagueId || game.id, name: game.name || 'Synthetic game', gameName: game.name || G.typeOf(game.spec), gameType: G.typeOf(game.spec), yourRole: game.roles[personId] || 'member', ownPace: game.timing === 'own-pace', solo: full.players.length === 1 ? 'private' : null };
    const result = gameView(ref, full, member ? personId : null, seen, present.userOf || (id => id), call, { now, marks: new Map(worldFor(game).marks.map(m => [m.personId, m.through])) });
    const stands = standsOf(game, full);
    const questions = S.AnswerLogic.questions(full).filter(q => !G.isCalls(q)).map(q => {
      const episode = askedFor(q, seen), closed = !member || (q.asked !== 'once' && !full.episodes.some(e => e.number === episode)) || S.AnswerLogic.closed(stands, q, episode, { now, mark: seen, player: member ? personId : null, finale: finaleOf(game) });
      const mine = member ? live.find(r => r.playerId === personId && r.question === q.id && r.episode === episode) : null;
      const limit = member ? stakeLimit(game, full, q, personId, seen, episode) : undefined, stakeMost = limit === undefined ? null : Math.min(limit, typeof q.wager === 'number' ? q.wager : Infinity); // as the sheet: null for a fixed wager alone
      return { id: q.id, ask: q.ask, answer: q.answer, asked: q.asked || 'each', pick: q.pick || 1, wager: q.wager ?? null, stakeMost, episode, closed, mine: mine?.answer ?? null, options: ['person', 'confidence'].includes(q.answer) ? S.AnswerLogic.faces(view, q, { playerId: personId }).map(p => ({ id: p.id, name: p.name })) : q.answer === 'number' ? null : ['yes', 'no'] };
    });
    // Historical answers follow the viewing boundary; pending opponents' answers never appear here.
    // A question asked once (episode 0): others' answers only once it has closed.
    const visiblePlayers = new Set(view.players.map(p => p.id)), openOnce = new Set(questions.filter(q => q.asked === 'once' && !q.closed).map(q => q.id));
    const decided = live.filter(r => visiblePlayers.has(r.playerId) && r.episode <= seen && !(openOnce.has(r.question) && r.playerId !== personId)).map(r => ({ ...r, verdict: grade.verdicts.get(r.question + '|' + r.episode) || null, points: grade.earned.get(r.question + '|' + r.episode)?.get(r.playerId) || 0 }));
    // What each window paid each seat, and a rollover window's worth (its points with the jackpot carried in), as the question sheet
    // grades them (answers.ts readQuestions: every stored row, not only the ones that count), through this viewer's mark.
    const sheet = walk ? S.AnswerLogic.grade(view, rows, facts) : grade, upTo = k => Number(k.split('|')[1]) <= seen;
    const earned = Object.fromEntries([...sheet.earned].filter(([k]) => upTo(k)).map(([k, m]) => [k, Object.fromEntries(m)]));
    // ...and each open window's worth (a rollover's jackpot as the sheet shows it before you answer; the grade stops at the first
    // window still to settle, so nothing past the viewer's copy is in it).
    const opened = new Set(questions.filter(q => !q.closed).map(q => q.id + '|' + q.episode));
    const worth = Object.fromEntries([...sheet.worth].filter(([k]) => upTo(k) || opened.has(k)));
    // Weekly Calls: each episode's calls as this person reads them on the calls route (calls.ts readCalls; { refused } for a 409).
    const calls = isWeekly(game) && personId ? Object.fromEntries(worldFor(game).events.map(e => [e.number, Calls().readCalls(worldFor(game), state.stores.calls[game.contextId], personId, e.number, now, n => ownPaceOn(game.contextId, personId, n))])) : undefined;
    // The top scorer's twist as the twist route's GET gives it to this person: the rules, their seat, the episode being chosen (once
    // they've seen the one before it: who chooses is who scored most in it) and each filed twist they've seen the episode before.
    const tcfg = S.TwistLogic.of(full), trows = state.stores.twists?.[gameId];
    let twist;
    if (tcfg && trows && personId) {
      const seat = member ? personId : null, saw = k => seen >= k, n = openTwist(full, trows, now), name = id => id ? { playerId: id, name: full.players.find(p => p.id === id)?.name ?? '' } : null;
      let next = null;
      if (n !== null && saw(n - 1)) { const who = S.TwistLogic.chooserAt(full, n), youChoose = !!seat && who.playerId === seat, at = S.TwistLogic.closesAt(full, n); next = { episode: n, closesAt: at === null ? null : new Date(at).toISOString(), youChoose, choice: youChoose && trows[n] && trows[n].playerId === seat ? trows[n].twist : null }; }
      const played = full.episodes.filter(ep => ep.twist && saw(ep.number - 1)).sort((a, b) => a.number - b.number).map(ep => ({ episode: ep.number, twist: ep.twist.id, name: tcfg.of.find(x => x.id === ep.twist.id)?.name ?? null, by: name(ep.twist.by), how: ep.twist.how }));
      twist = { twist: tcfg, seat, next, played };
    }
    // Secret roles as the roles route's GET gives them to this person: whether dealt, their seat, their own role (its points with the
    // spec's mates, or alone; who else), and the reveal once they've seen its episode. Nobody else's role before then.
    const rcfg = S.SecretRoleLogic.of(full), deal = state.stores.roles?.[gameId];
    let roles;
    if (rcfg && state.stores.roles && personId) {
      const seat = member ? personId : null, rview = S.GhostLogic.viewFor(full, seat ?? '', seen), holds = !!(deal && seat && deal.holders.includes(seat)), known = S.SecretRoleLogic.known(rview);
      const named = id => ({ playerId: id, name: full.players.find(p => p.id === id)?.name ?? '' });
      roles = { dealt: !!deal, seat, mine: holds ? { role: deal.role, points: rcfg.mates || deal.holders.length < 2 ? S.SecretRoleLogic.pointsOf(rview, seat, deal.holders) : null, mates: rcfg.mates ? deal.holders.filter(id => id !== seat).map(named) : null } : null, revealed: known ? { at: known.at, holders: known.holders.map(named) } : null };
    }
    return copy({ game: result, questions, decided, earned, worth, ...(calls ? { calls } : {}), ...(twist ? { twist } : {}), ...(roles ? { roles } : {}), evidence: { origin: 'production-projection', rendering: 'unverified', interaction: 'headless-only', design: 'unreviewed' } });
  }
  function actionCore(action) {
    if (!J.object(action) || typeof action.type !== 'string') throw Error('An action needs an explicit type');
    const keys = {
      clock: ['at'], reveal: ['contextId', 'personId', 'episode'], results: ['contextId', 'eventId', 'source', 'resultStatus', 'data'],
      lineup: ['gameId', 'personId', 'eventId', 'ids', 'captainId'], pick: ['gameId', 'personId', 'eventId', 'ids', 'second'], groupSlot: ['gameId', 'personId', 'eventId', 'slot', 'groupId'], answer: ['gameId', 'personId', 'episode', 'question', 'answer'], call: ['contextId', 'personId', 'episode', 'question', 'answer'], botCall: ['gameId', 'question', 'episode', 'answer'], twist: ['gameId', 'personId', 'twist'], claim: ['gameId', 'personId', 'pairs', 'spot', 'forId'], freeAgency: ['gameId', 'personId', 'addId', 'dropId'], waiverWindow: ['gameId', 'personId', 'swaps', 'replace'], waiverRun: ['gameId', 'personId'], waiverUndo: ['gameId', 'personId', 'periodId'],
      bet: ['gameId', 'personId', 'eventId', 'label', 'points', 'id'], guess: ['gameId', 'personId', 'eventId', 'betId', 'guess', 'id'], unguess: ['gameId', 'personId', 'eventId', 'betId', 'predId'], grade: ['gameId', 'personId', 'eventId', 'betId', 'predId', 'value'],
    }[action.type];
    if (keys && Object.keys(action).some(k => !['type', 'expectedHash', ...keys].includes(k))) throw Error('Unrecognized action field or legacy alias');
    if (action.expectedHash && action.expectedHash !== J.digest(state)) throw Error('Stale runtime state hash');
    if (action.type === 'clock') {
      const n = Date.parse(action.at);
      if (!Number.isFinite(n) || n < Date.parse(state.clock) || !/(?:Z|[+-]\d\d:\d\d)$/.test(action.at)) throw Error('Advance to an explicit timestamp at or after the current clock');
      state.clock = new Date(n).toISOString(); return;
    }
    if (action.type === 'reveal') {
      const world = state.contexts[action.contextId];
      if (!world || !state.people.some(p => p.id === action.personId)) throw Error('Unknown reveal context/person');
      const mark = world.marks.find(m => m.personId === action.personId), episode = action.episode ?? mark.through + 1;
      if (!Number.isInteger(episode) || episode < 1 || episode > mark.through + 1 || !world.events.some(e => e.number === episode && Data.released(e))) throw Error('Reveal only a released watched event or the next unseen event');
      if (episode <= mark.through) return;
      mark.through = episode;
      for (const game of document.games.filter(g => g.contextId === action.contextId)) Data.syncMarks(world, game, state.games[game.id].state);
      return;
    }
    if (action.type === 'results') {
      const world = state.contexts[action.contextId], event = world?.events.find(e => e.id === action.eventId);
      if (!world || !event) throw Error('Unknown results context/event');
      if (action.source !== 'provider-fixture') throw Error('Result injection needs explicit provider-fixture provenance');
      if (!['partial', 'final', 'corrected'].includes(action.resultStatus)) throw Error('Unsupported result availability transition');
      if (action.resultStatus === 'corrected' && !Data.released(event)) throw Error('A correction requires previous results');
      if (action.resultStatus === 'partial' && ['final', 'corrected'].includes(event.resultStatus)) throw Error('Final results cannot move back to partial');
      if (world.events.some(e => e.number < event.number && !Data.released(e))) throw Error('Publish results in event order');
      // Results exist only after an airing: otherwise chat, recaps and reveals would carry facts nobody could know yet.
      if (event.airAt && Date.parse(state.clock) < Date.parse(event.airAt)) throw Error('Results need the event to have aired: advance the clock past its air time first');
      const allowed = ['events', 'scoringEvents', 'noExit', 'votes']; // votes: who voted for whom, research's (a bounty's record)
      if (!J.object(action.data) || Object.keys(action.data).some(k => !allowed.includes(k))) throw Error('Result payload contains unsupported facts or player choices');
      event.resultStatus = action.resultStatus;
      world.facts = world.facts.filter(f => f.eventId !== event.id);
      world.facts.push({ id: 'fact-' + event.id, contextId: action.contextId, eventId: event.id, source: 'provider-fixture-action', data: copy(action.data) });
      for (const game of document.games.filter(g => g.contextId === action.contextId)) { Data.applyFacts(world, state.games[game.id].state); Data.syncMarks(world, game, state.games[game.id].state); }
      return;
    }
    if (['bet', 'guess', 'unguess', 'grade'].includes(action.type)) return sideBet(action);
    // A seat's twist for the open episode (the twist route's POST, twists.ts chooseTwist): its chooser by the data now, until it closes.
    // A waiver claim (the claims route's PUT { pairs }: ranked { addId, dropId }, the whole claim; empty withdraws it) and a free-agency
    // move (POST .../waivers/free-agency { addId, dropId }), as their routes take them: a game that uses waivers, a seat in it, and, for
    // a claim, the week's episode revealed (waiver-actor.ts).
    // What whoever runs the game does with its waivers (the routes' POST .../waivers/window, /process and /undo; the app's Backstage ›
    // Waivers sends them as window, run and undo, and Recent changes' Undo of a run names its week: league-changes.ts), each on the
    // league itself as the server runs it, the waiver clock synced after it as the lock syncs it:
    //   waiverWindow { swaps, replace? }: open a window (or make the open week one, or change it); swaps null turns it off. Any game
    //     that could have waivers (a draft's), whatever its schedule: a game with none gets its claim store here.
    //   waiverRun: every claim that's in, at once (Process now / Run now).
    //   waiverUndo { periodId? }: the last run taken back while free agency is open; with periodId, only that week's.
    if (['waiverWindow', 'waiverRun', 'waiverUndo'].includes(action.type)) {
      const { game, full } = resolveGame(action.gameId), now = Date.parse(state.clock), Wv = S.WaiverLogic;
      if (!runsGame(game, full, action.personId)) throw Error('Only whoever runs the game runs its waivers');
      if (action.type === 'waiverWindow') {
        if (action.swaps !== null && !Number.isInteger(action.swaps)) throw Error('swaps must be a whole number, or null to turn the window off');
        if (action.replace !== undefined && typeof action.replace !== 'boolean') throw Error('replace must be true or false');
        if (!Wv.supported(full)) throw Error("This league doesn't use waivers");
        const store = ((state.stores.waivers ||= {})[game.id] ||= { seq: 0, weeks: {} });
        const r = Waivers().seeded(full, game.id, () => Waivers().openWindow(full, store, action.swaps, now, { replace: action.replace }, game.id));
        if (r.error) throw Error(r.error);
      } else if (action.type === 'waiverRun') {
        const store = state.stores.waivers?.[game.id];
        if (!store || !Wv.enabled(full)) throw Error("This league doesn't use waivers");
        const refused = Waivers().seeded(full, game.id, () => Waivers().processNow(full, store, now));
        if (refused) throw Error(refused);
      } else {
        // (The route asks for waivers in use first; a game without them has no run to take back, so undo's own refusal says the same.)
        const p = Wv.current(full);
        if (action.periodId !== undefined && (!p || p.id !== action.periodId || p.phase !== 'processed' || !p.run)) throw Error("That waiver run can't be taken back any more");
        const refused = Wv.undo(full);
        if (refused) throw Error(refused);
      }
      return;
    }
    if (action.type === 'claim' || action.type === 'freeAgency') {
      const { game, full } = resolveGame(action.gameId), store = state.stores.waivers?.[game.id], now = Date.parse(state.clock), Wv = S.WaiverLogic;
      // Claim for them (Backstage › Waivers' claimFor: backstage-games.ts waiverWrite): whoever runs the game sends one spot of someone's
      // claim, the rest of it kept and never shown. In the route's order: one spot, a week that's open (the league's own, not a paced
      // copy's), the sender's own reveal of its episode, and someone in this week's waivers.
      if (action.type === 'claim' && action.forId !== undefined) {
        if (!runsGame(game, full, action.personId)) throw Error("That game isn't one you run here");
        if (!J.object(action.spot) || action.pairs !== undefined || typeof action.spot.dropId !== 'string' || !Array.isArray(action.spot.addIds)) throw Error('Choose who to drop and who to add');
        const period = Wv.current(full);
        if (!period || period.phase !== 'open') throw Error("Waivers aren't open");
        if (markOf(game, action.personId) < period.episode) throw Error('Reveal Episode ' + period.episode + ' first');
        if (!Wv.rotation(full).includes(action.forId)) throw Error("They aren't in this week's waivers");
        const store = ((state.stores.waivers ||= {})[game.id] ||= { seq: 0, weeks: {} });
        const problem = Waivers().seeded(full, game.id, () => Waivers().saveClaim(full, store, action.forId, { spot: action.spot }, now, game.id));
        if (problem) throw Error(problem);
        return;
      }
      if (!store || !Wv.enabled(full)) throw Error("This league doesn't use waivers");
      if (!full.players.some(p => p.id === action.personId)) throw Error("You don't have a team in this league");
      // Acting for yourself needs the week's episode revealed first, a claim and a free-agency move alike (waiver-actor.ts: whether
      // you're owed a replacement would say one of yours left).
      const period = Wv.current(action.type === 'claim' ? Waivers().pacedCopy(full) || full : full), seen = markOf(game, action.personId);
      if (period && seen < period.episode) throw Error('Reveal episode ' + period.episode + ' first');
      if (action.type === 'claim') {
        if (!Array.isArray(action.pairs) === !J.object(action.spot)) throw Error('A claim is its ranked pairs, or one spot of it');
        const problem = Waivers().seeded(full, game.id, () => Waivers().saveClaim(full, store, action.personId, action.spot ? { spot: action.spot } : { pairs: action.pairs }, now, game.id));
        if (problem) throw Error(problem);
      } else {
        if (typeof action.addId !== 'string' || !action.addId) throw Error('addId required');
        const refused = Waivers().seeded(full, game.id, () => Wv.freeAgencyMove(full, action.personId, action.addId, action.dropId || null, now));
        if (refused) throw Error(refused);
      }
      return;
    }
    if (action.type === 'twist') {
      const { game, full } = resolveGame(action.gameId), now = Date.parse(state.clock), T = S.TwistLogic, rows = state.stores.twists?.[game.id];
      if (!T.of(full) || !rows) throw Error('This game has no twist');
      if (!full.players.some(p => p.id === action.personId)) throw Error("You don't have a seat in this game");
      const n = openTwist(full, rows, now), mark = markOf(game, action.personId);
      if (n !== null && mark < n - 1) throw Error('Watch Episode ' + (n - 1) + "'s results first: they say who chooses");
      if (!T.of(full).of.some(x => x.id === action.twist)) throw Error("That isn't one of this game's twists");
      if (n === null) throw Error("There's no twist to choose right now");
      const who = T.chooserAt(full, n);
      if (who.playerId !== action.personId) throw Error(who.playerId === null && who.why === 'waiting' ? 'Episode ' + (n - 1) + "'s results aren't final yet: the twist is chosen once they are" : "You don't choose Episode " + n + "'s twist");
      const closes = T.closesAt(full, n);
      if ((closes !== null && now >= closes) || rows[n]?.filed) throw Error('Episode ' + n + "'s twist is already set");
      rows[n] = { playerId: action.personId, twist: action.twist, filed: false, how: null };
      return;
    }
    // The bot's call (db/bot-calls.js files it, a stand-in's here): one a window, before the window's first lock, checked as a seat's
    // answer is against who could be picked then; changeable until the lock.
    if (action.type === 'botCall') {
      const { game, full } = resolveGame(action.gameId), now = Date.parse(state.clock);
      const q = S.AnswerLogic.questions(full).find(x => x.id === action.question && G.isBeat(x));
      if (!q || !state.stores.bot?.[game.id]) throw Error('No question played against the bot by that id');
      if (q.asked === 'once' ? action.episode !== 0 : !(full.episodes.some(e => e.number === action.episode) && S.AnswerLogic.opensAt(full, q, action.episode))) throw Error('Not a window this game asks');
      if (S.AnswerLogic.closed(full, q, action.episode, { now, finale: finaleOf(game) })) throw Error("The bot calls before the window's first lock");
      const view = S.GhostLogic.viewFor(full, null, Math.max(0, action.episode - 1));
      const problem = G.answerProblem(q, action.answer, new Set(S.AnswerLogic.faces(view, q, {}).map(p => p.id)));
      if (problem) throw Error(problem);
      state.stores.bot[game.id] = [...state.stores.bot[game.id].filter(r => !(r.question === q.id && r.episode === action.episode)), { question: q.id, episode: action.episode, answer: copy(action.answer) }];
      return;
    }
    // A call (calls.ts callEpisode): the person's, on the context, for every Weekly Calls game there.
    if (action.type === 'call') {
      const world = state.contexts[action.contextId];
      if (!world || !state.stores.calls?.[action.contextId]) throw Error('No Weekly Calls game on this context');
      if (!state.people.some(p => p.id === action.personId)) throw Error('Unknown person');
      state.stores.calls[action.contextId] = Calls().call(world, state.stores.calls[action.contextId], action, Date.parse(state.clock), n => ownPaceOn(action.contextId, action.personId, n));
      return;
    }
    if (!['lineup', 'pick', 'answer', 'groupSlot'].includes(action.type)) blocked('action-adapter', 'No runtime driver for action ' + action.type);
    const { game, full } = resolveGame(action.gameId), seen = readActor(game, full, action.personId), now = Date.parse(state.clock);
    if (action.type === 'answer') {
      const q = S.AnswerLogic.questions(full).find(q => q.id === action.question);
      if (!q || !['person', 'yesNo', 'number', 'confidence'].includes(q.answer)) throw Error('Unknown or unconnected question');
      if (action.episode !== askedFor(q, seen) || (q.asked !== 'once' && !full.episodes.some(e => e.number === action.episode))) throw Error(q.asked === 'once' ? 'A question for the whole game is answered as episode 0' : 'Only this actor’s next event is open for answers');
      const stands = standsOf(game, full);
      // As answers.ts answerQuestions: on the league as it stands (walked over every answer and result, as the server's read
      // carries it), nobody answers past where the game ended or ends (a last life, one left, head to head's final), nor once out.
      const ends = S.KnockoutLogic.endsAt(stands), ended = S.MatchupLogic.on(stands) ? S.MatchupLogic.endedAt(stands) : (ends !== null && S.gameOver(stands) ? ends : null);
      const limit = ended ?? ends, outAt = S.KnockoutLogic.outOf(stands, action.personId);
      if (limit !== null && ((q.asked === 'once' && ended !== null) || action.episode > limit)) throw Error(ended !== null ? 'This game ended with Episode ' + ended : 'This game ends with Episode ' + ends);
      if (outAt !== null && (q.asked === 'once' || action.episode > outAt)) throw Error('You’re out of this game');
      // Then the lock (the server checks the end and who's out first, so its refusal says why).
      if (S.AnswerLogic.closed(stands, q, action.episode, { now, mark: seen, player: action.personId, finale: finaleOf(game) })) throw Error('Question is closed');
      const view = S.GhostLogic.viewFor(full, action.personId, seen), faces = new Set(S.AnswerLogic.faces(view, q, { playerId: action.personId }).map(p => p.id));
      const most = stakeLimit(game, full, q, action.personId, seen, action.episode);
      const problem = action.answer === null ? null : G.answerProblem(q, action.answer, faces, most === undefined ? undefined : { most });
      if (problem) throw Error(problem);
      const rows = state.stores.answers[game.id].filter(r => !(r.playerId === action.personId && r.episode === action.episode && r.question === q.id));
      if (action.answer !== null) rows.push({ playerId: action.personId, episode: action.episode, question: q.id, answer: copy(action.answer) });
      state.stores.answers[game.id] = rows; return;
    }
    const g = projection(game.id, action.personId).game;
    if (g.revealFirst) throw Error('Reveal the pending results before this live-only decision');
    // A group slot (get.groups), as the group-slots route's PUT { slot, groupId }: into one of their slots for the episode on offer
    // (null empties it), until its lock (the scenario clock: the engine's own lock reads the real one), as they see the league.
    if (action.type === 'groupSlot') {
      const offer = g.twists?.offered;
      if (!offer || offer.epId !== action.eventId) throw Error('Only this actor’s current decision is open');
      if (!Number.isInteger(action.slot) || !(action.groupId === null || typeof action.groupId === 'string')) throw Error('A slot is a number; groupId a group’s id or null');
      if (S.closedForPlay(full.episodes.find(e => e.id === action.eventId), now)) throw Error('This episode has started: its slots are locked');
      const put = working => S.GroupSlotLogic.validatePick(working, action.eventId, action.personId, action.slot, action.groupId) ?? (S.GroupSlotLogic.setPick(working, action.eventId, action.personId, action.slot, action.groupId), null);
      const problem = g.catchingUp ? S.GhostLogic.applyAs(full, action.personId, seen, action.eventId, put) : put(full);
      if (problem) throw Error(problem);
      return;
    }
    const move = action.type === 'lineup' ? g.lineup : g.pick;
    if (!move || move.epId !== action.eventId) throw Error('Only this actor’s current decision is open');
    if (!Array.isArray(action.ids) || action.ids.some(id => typeof id !== 'string') || new Set(action.ids).size !== action.ids.length) throw Error('Choose unique participant IDs');
    const apply = working => {
      // A captain (score.captain) named with the lineup, as the lineup route does: the lineup's problem, then the captain's (one of its
      // starters, or null for none), then both written; left out, the captain stays as it is.
      if (action.type === 'lineup' && 'captainId' in action) {
        if (action.captainId !== null && typeof action.captainId !== 'string') return "captainId is a castaway's id, or null";
        const problem = S.ActiveRosterLogic.validateLineup(working, action.eventId, action.personId, action.ids, now) ?? S.ActiveRosterLogic.validateCaptain(working, action.eventId, action.personId, action.captainId, action.ids);
        if (problem) return problem;
        S.setActiveRosterLineup(working, action.eventId, action.personId, action.ids, now); S.setActiveRosterCaptain(working, action.eventId, action.personId, action.captainId);
        return null;
      }
      if (action.type === 'lineup') return S.setActiveRosterLineup(working, action.eventId, action.personId, action.ids, now) ? null : S.ActiveRosterLogic.validateLineup(working, action.eventId, action.personId, action.ids, now) || 'Lineup rejected';
      // A pool's second pick (get.second), as the picks route takes `second: true`: one castaway beside a first already made.
      if (action.type === 'pick' && 'second' in action) {
        if (action.second !== true || action.ids.length !== 1) return 'A second pick is second: true with one castaway';
        const ep = working.episodes.find(e => e.id === action.eventId), mine = S.pickEmPickFor(working, action.eventId, action.personId);
        if (!S.PickEmLogic.parts(working)?.second || !mine || S.closedForPlay(ep, now)) return 'No second pick here: none in this game, no first pick, or closed';
        S.setPickEmPick(working, action.eventId, action.personId, action.ids[0], { second: true, now });
        return S.pickEmPickFor(working, action.eventId, action.personId)?.second === action.ids[0] ? null : 'Engine rejected the second pick';
      }
      const available = S.pickEmEligibility(working, action.eventId, action.personId).available, each = S.gameOf(working).get.each;
      if (!action.ids.length || action.ids.length > each || !action.ids.every(id => available.includes(id)) || S.closedForPlay(working.episodes.find(e => e.id === action.eventId), now)) return 'Pick count, eligibility or deadline rejected';
      S.setPickEmPick(working, action.eventId, action.personId, action.ids[0], { picks: action.ids, now });
      return J.canonical(S.PickEmLogic.picked(S.pickEmPickFor(working, action.eventId, action.personId))) === J.canonical(action.ids) ? null : 'Engine rejected picks';
    };
    const problem = g.catchingUp ? S.GhostLogic.applyAs(full, action.personId, seen, action.eventId, apply) : apply(full);
    if (problem) throw Error(problem);
  }
  // Side bets (BetLogic; the routes under /api/leagues/{id}/episodes/{ep}/bets). Locks use the scenario clock; the routes'
  // own rules are mirrored: anyone playing posts a bet, a guess is refused while catching up, only the commissioner (the
  // first seat unless roles say otherwise, as the materializer seats them) grades, taking a guess back after the lock is a
  // silent no-op as on the server. Engine ids are random (Core.uid), so ids are the action's own (the server's, for writes
  // made in the app) or derived from the trace: replays stay exact.
  function sideBet(action) {
    const { game, full } = resolveGame(action.gameId), now = Date.parse(state.clock);
    if (!S.betsOn(full)) throw Error('Side bets are off in this game');
    const commissioner = id => runsGame(game, full, id);
    if (!full.players.some(p => p.id === action.personId)) throw Error('Actor is not a playing member of this game');
    let ep = action.eventId === 'upcoming' ? (n => n === null ? null : full.episodes.find(e => e.number === n))(S.betTarget(full)) : full.episodes.find(e => e.id === action.eventId);
    if (!ep) throw Error('Episode not found, or the game is over');
    const closed = S.closedForPlay(ep, now) || S.episodeHasResults(ep), bet = action.betId && (ep.bets || []).find(b => b.id === action.betId);
    const derived = kind => kind + '-' + J.digest([action.gameId, ep.id, kind, trace.length, (ep.bets || []).length]).slice(0, 12);
    if (action.type === 'bet') {
      if (typeof action.label !== 'string' || !action.label.trim() || action.label.length > 200 || typeof action.points !== 'number') throw Error('A bet needs a label and points');
      if (closed) throw Error('Predictions for Episode ' + ep.number + ' closed when it started');
      const made = S.addBet(full, ep.id, action.label, action.points, action.personId);
      if (!made) throw Error("This game doesn't play that episode, so no prediction goes on it");
      made.id = action.id || derived('bet'); return;
    }
    if (!bet) throw Error('Unknown bet');
    if (action.type === 'guess') {
      if (S.GhostLogic.isCatchingUp(full, action.personId)) throw Error("Predictions open once you've caught up");
      if (closed) throw Error('Predictions for Episode ' + ep.number + ' closed when it started');
      if (typeof action.guess !== 'string' || !action.guess.trim() || action.guess.length > 300) throw Error('A guess needs some words');
      const made = S.addBetPrediction(full, ep.id, bet.id, action.personId, action.guess);
      if (!made) throw Error('Guess rejected');
      made.id = action.id || derived('pred'); return;
    }
    const pred = (bet.predictions || []).find(p => p.id === action.predId);
    if (!pred) throw Error('Unknown guess');
    if (action.type === 'unguess') {
      if (pred.playerId !== action.personId && !commissioner(action.personId)) throw Error('You can only take back your own guess');
      if (!closed) S.removeBetPrediction(full, ep.id, bet.id, pred.id); // after the lock: a silent no-op, as on the server
      return;
    }
    if (!commissioner(action.personId)) throw Error('Commissioner only');
    if (![true, false, null].includes(action.value)) throw Error('Mark a guess right, wrong or not yet');
    S.setBetPredictionCorrect(full, ep.id, bet.id, pred.id, action.value);
  }
  // (A game in stages reads its stages' tables: it has changed whenever one of them has.)
  const withParents = ids => [...new Set([...ids, ...document.games.filter(g => g.stageOf !== undefined && ids.includes(g.id)).map(g => g.stageOf)])];
  function apply(action, origin = 'headless-direct') {
    alive(); J.assertJson(action);
    if (typeof origin !== 'string' || !origin || origin.length > 200) throw Error('Action origin must be a nonempty label up to 200 characters');
    if (trace.length >= 1000) return { ok: false, status: 'blocked', category: 'tool-budget', message: '1000-action case budget exceeded' };
    const before = J.digest(state), previous = state;
    state = copy(previous); walkRev++;
    let status = 'accepted', category = 'engine-action', message = null;
    try { actionCore(action); for (const id of Object.keys(state.games)) if (J.digest(state.games[id]) !== J.digest(previous.games[id])) Data.settleWrite(state.contexts[definitions.get(id).contextId], state.games[id].state, { phases: action.type === 'results', clock: state.clock }); /* a stage's draft that opens at its start, opened by results this action applied (db.ts withLeagueLock settleStageDraft; stages.cjs) */ for (const g of document.games) if (g.stageOf !== undefined && J.digest(state.games[g.id]) !== J.digest(previous.games[g.id])) Stages.draftAtStart(document, g, state.games[g.id].state, state.clock); stampAllRoles(); stampAllTwists(); stampAllWaivers(); walkRev++; }
    catch (error) { state = previous; walkRev++; status = error instanceof Blocked ? 'blocked' : 'rejected'; category = error.report?.category || 'validation'; message = error.message; }
    const after = J.digest(state);
    const changedContexts = Object.keys(state.contexts).filter(id => J.digest(state.contexts[id]) !== J.digest(previous.contexts[id]));
    const changedStores = [...Object.keys(state.stores.answers).filter(id => J.digest(state.stores.answers[id]) !== J.digest(previous.stores.answers[id])).map(id => 'answers:' + id), ...Object.keys(state.stores.calls || {}).filter(id => J.digest(state.stores.calls[id]) !== J.digest(previous.stores.calls?.[id])).map(id => 'calls:' + id), ...Object.keys(state.stores.bot || {}).filter(id => J.digest(state.stores.bot[id]) !== J.digest(previous.stores.bot?.[id])).map(id => 'bot:' + id), ...Object.keys(state.stores.twists || {}).filter(id => J.digest(state.stores.twists[id]) !== J.digest(previous.stores.twists?.[id])).map(id => 'twists:' + id), ...Object.keys(state.stores.roles || {}).filter(id => J.digest(state.stores.roles[id]) !== J.digest(previous.stores.roles?.[id])).map(id => 'roles:' + id), ...Object.keys(state.stores.waivers || {}).filter(id => previous.stores.waivers?.[id] === undefined || J.digest(state.stores.waivers[id]) !== J.digest(previous.stores.waivers[id])).map(id => 'waivers:' + id)]; // (a game with no waivers gets its claim store with the first window opened on it: new is changed)
    const clockChanged = state.clock !== previous.clock;
    const record = { id: 'action-' + (trace.length + 1) + '-' + J.digest(action).slice(0, 12), index: trace.length, action: copy(action), origin, status, category, message, before, after, changedContexts, changedStores, clockChanged, changedGames: withParents(Object.keys(state.games).filter(id => clockChanged || changedContexts.includes(definitions.get(id).contextId) || changedStores.includes('answers:' + id) || changedStores.includes('calls:' + definitions.get(id).contextId) || changedStores.includes('bot:' + id) || changedStores.includes('twists:' + id) || changedStores.includes('roles:' + id) || changedStores.includes('waivers:' + id) || J.digest(state.games[id]) !== J.digest(previous.games[id]))) };
    trace.push(record);
    return copy({ ok: status === 'accepted', ...record });
  }
  const history = () => { if (document.history.snapshotAt === 'setup') for (const entry of document.history.entries) { if (!entry.action) blocked('history-adapter', 'Setup history entries need an explicit runtime action'); const result = apply(entry.action, 'document-setup-history'); if (result.status !== (entry.expect || 'accepted')) blocked('setup-history', 'Setup history did not match its expected outcome', { result }); } };
  const api = {
    apply, project: projection,
    snapshot() { alive(); return copy(state); },
    hash() { alive(); return J.digest(state); },
    checkpoint(id) { alive(); if (typeof id !== 'string' || !id || id.length > 200 || checkpoints.length >= 1000 || checkpoints.some(c => c.id === id)) throw Error('Checkpoint ID must be unique and 1–200 characters; maximum 1000 checkpoints'); const c = { id, traceLength: trace.length, hash: J.digest(state) }; checkpoints.push(c); return copy(c); },
    [RESTORE](rows) { checkpoints = copy(rows); },
    export() { alive(); return copy({ kind: 'gameplay-execution', schemaVersion: 1, input: document, versions, initialHash, state, stateHash: J.digest(state), trace, checkpoints, preparation: { profile: support.profile, notes: support.notes || [], plan, versionDrift, estimatedCells, sources: Object.fromEntries(Object.entries(state.games).map(([id, g]) => [id, g.source])) }, evidence: { rendering: 'unverified', interaction: 'headless-only', design: 'unreviewed', userApproval: 'not-requested' } }); },
    reset() { alive(); state = copy(initial); walkRev++; trace = []; checkpoints = []; history(); return api.snapshot(); },
    fork(id) { alive(); const c = checkpoints.find(c => c.id === id); if (!c) throw Error('Unknown checkpoint'); const child = open(document, { skipHistory: true }); for (const r of trace.slice(0, c.traceLength)) child.apply(r.action, r.origin); if (child.hash() !== c.hash) { child.dispose(); throw Error('Checkpoint replay diverged'); } return child; },
    dispose() { state = null; trace = []; checkpoints = []; disposed = true; },
  };
  if (!internal.skipHistory) history();
  return api;
}

function resume(saved) {
  J.assertJson(saved);
  if (saved.kind !== 'gameplay-execution' || saved.schemaVersion !== 1 || !Array.isArray(saved.trace) || !Array.isArray(saved.checkpoints) || saved.trace.length > 1000 || saved.checkpoints.length > 1000) throw Error('Expected a bounded execution bundle');
  if (J.digest(saved.versions) !== J.digest({ ...J.versions(), runtime: VERSION })) throw Error('Execution versions changed; start a linked new run instead of silently resuming');
  const session = open(saved.input, { skipHistory: true });
  try {
    if (session.hash() !== saved.initialHash) throw Error('Initial materialization diverged');
    for (const [index, record] of saved.trace.entries()) {
      if (record.index !== index || typeof record.origin !== 'string') throw Error('Invalid action trace order/origin');
      const next = session.apply(record.action, record.origin);
      if (next.status !== record.status || next.before !== record.before || next.after !== record.after) throw Error('Action replay diverged at index ' + record.index);
    }
    if (session.hash() !== saved.stateHash || J.digest(saved.state) !== saved.stateHash) throw Error('Saved state hash does not match replay');
    const ids = new Set();
    for (const checkpoint of saved.checkpoints) {
      if (typeof checkpoint.id !== 'string' || !checkpoint.id || checkpoint.id.length > 200 || ids.has(checkpoint.id) || !Number.isInteger(checkpoint.traceLength) || checkpoint.traceLength < 0 || checkpoint.traceLength > saved.trace.length) throw Error('Invalid checkpoint identity/position');
      ids.add(checkpoint.id);
      const expected = checkpoint.traceLength === 0 ? saved.initialHash : saved.trace[checkpoint.traceLength - 1]?.after;
      if (expected !== checkpoint.hash) throw Error('Invalid checkpoint hash');
    }
    // Retain named checkpoints at their original trace positions without trusting stored state.
    session[RESTORE](saved.checkpoints);
    return session;
  } catch (error) { session.dispose(); throw error; }
}
function execute(input, steps = [], queries = []) {
  let session;
  try {
    if (!Array.isArray(steps) || steps.length > 1000) throw Error('Provide at most 1000 action steps');
    if (!Array.isArray(queries) || queries.length > 64) throw Error('Provide at most 64 projection queries');
    if (input?.execution?.kind === 'gameplay-execution') input = input.execution;
    session = input?.kind === 'gameplay-execution' ? resume(input) : open(input);
    const outcomes = steps.map(step => { const action = J.object(step) && J.object(step.action) ? step.action : step; const expected = (J.object(step) && step.expect) || 'accepted'; const result = session.apply(action); return { expected, actual: result.status, matched: result.status === expected, actionId: result.id }; });
    const projections = queries.map(q => ({ gameId: q.gameId, personId: q.personId ?? null, view: session.project(q.gameId, q.personId ?? null) }));
    return { ok: outcomes.every(o => o.matched), status: outcomes.every(o => o.matched) ? 'executed' : 'failed', outcomes, projections, execution: session.export() };
  } catch (error) { return { ...(error instanceof Blocked ? error.report : { ok: false, status: 'failed', category: 'runtime-input', message: error.message }), ...(session ? { execution: session.export() } : {}) }; }
  finally { session?.dispose(); }
}
module.exports = { VERSION, Blocked, open, resume, execute };
