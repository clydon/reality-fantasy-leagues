// Who moves in a game's preview (docs/PLAN-game-preview.md, "Who moves"): every seat, the viewer's too, plays as the app's own
// computer players would (E1: src/lib/game/bot-logic.js), never by moves written for a game. On a copy of the game's state the seat
// is made a computer player, E1 makes its moves there (a lineup and a captain, a pool's pick, a group's slot, a finale pick), and
// each is read back with the engine's own reads and returned as that person's own runtime action, to apply through the runtime like
// any other. The couch stay people on the screens (decision 2); only the copy ever knows them as computer players.
//
// A sheet's answers: E1b (branch `wizard`) gives computer players' answers (`Bots.answers`); until it's merged here, the bench's own
// valid move for the kind, a seeded choice among each open question's options as the projection gives them. One chooser for the
// kind of move, not for any game; it goes once `Bots.answers` exists.
const path = require('path');
const root = path.resolve(__dirname, '..', '..', '..');
const S = require(path.join(root, 'src/lib/game/state-logic.js'));
const Bots = require(path.join(root, 'src/lib/game/bot-logic.js'));
const J = require('../explorer/json.cjs');
const { atClock } = require('./clock.cjs');

const copy = (x) => JSON.parse(JSON.stringify(x));
const LEVEL_MIX = ['solid', 'casual', 'sharp', 'casual', 'solid', 'sharp'];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const roll = (...parts) => parseInt(J.digest(parts).slice(0, 8), 16);

/** The games a person makes moves in: each of the definition's games, but a game in stages itself (its stages are games of their own). */
function playable(session) {
  const games = session.export().input.games;
  return games.filter((g) => !g.spec?.stages);
}

/** `personId`'s moves in `gameId` now, as E1 would make them, as runtime actions (none when nothing's open or E1 has nothing to do). */
function e1Moves(session, gameId, personId) {
  const st0 = session.snapshot().games[gameId]?.state;
  if (!st0 || !st0.players.some((p) => p.id === personId)) return [];
  const st = copy(st0);
  for (const p of st.players) p.automated = p.id === personId;
  // A couch plays at different levels (E1's casual, solid, sharp), as a real one does: by seat, the first solid.
  const seat = st.players.findIndex((p) => p.id === personId);
  st.players[seat].botLevel = LEVEL_MIX[seat % LEVEL_MIX.length];
  // E1 decides at the season's own clock (the runtime's), not the computer's: a lineup or a pick is open until its episode airs then.
  const clock = session.snapshot().clock;
  if (!atClock(clock, () => Bots.run(st))) return [];
  const out = [];
  for (const ep of st.episodes) {
    const lineup = S.ActiveRosterLogic.lineupFor(st, ep.id, personId), before = S.ActiveRosterLogic.lineupFor(st0, ep.id, personId);
    const captain = S.ActiveRosterLogic.captainTimes(st) ? S.ActiveRosterLogic.captainFor(st, ep.id, personId) : undefined;
    // Only a lineup set for that episode (a carried one stands in for later episodes on its own, and isn't a move).
    if (lineup?.length && !S.ActiveRosterLogic.lineupIsCarried(st, ep.id, personId) && (!same(lineup, before) || (captain !== undefined && captain !== S.ActiveRosterLogic.captainFor(st0, ep.id, personId))))
      out.push({ type: 'lineup', gameId, personId, eventId: ep.id, ids: lineup, ...(captain !== undefined && captain !== null ? { captainId: captain } : {}) });
    const pick = S.PickEmLogic.picked(S.PickEmLogic.pickFor(st, ep.id, personId)), had = S.PickEmLogic.picked(S.PickEmLogic.pickFor(st0, ep.id, personId));
    if (pick?.length && !same(pick, had)) out.push({ type: 'pick', gameId, personId, eventId: ep.id, ids: pick });
  }
  return out;
}

/** `personId`'s open answers in `gameId` (the projection's questions not closed and not answered): E1b's once it's here, else the
 *  bench's seeded choice among the options. */
function answerMoves(session, gameId, personId, seed) {
  const view = session.project(gameId, personId), open = (view.questions || []).filter((q) => !q.closed && (q.mine === null || q.mine === undefined));
  if (!open.length) return [];
  if (typeof Bots.answers === 'function') {
    const st = copy(session.snapshot().games[gameId].state);
    for (const p of st.players) p.automated = p.id === personId;
    const now = Date.parse(session.snapshot().clock);
    const mine = atClock(now, () => Bots.answers(st, [], { now })).filter((a) => a.playerId === personId);
    if (mine.length) return mine.map((a) => ({ type: 'answer', gameId, personId, question: a.question, episode: a.episode, answer: a.answer }));
  }
  const r = (...k) => roll(seed, gameId, personId, q0Key, ...k);
  let q0Key = '', staked = 0; // what this batch has staked already: one person's stakes share their room
  return open.flatMap((q) => {
    q0Key = q.id + '|' + q.episode;
    let answer;
    // Each kind's shape, as the sheet takes it: who outlasts whom in each pair; one option for each of a trivia round's questions; a
    // vote split; a ranked order or one of the options (people, yes/no, over/under, a choice).
    if (q.answer === 'pairs') answer = Object.fromEntries((q.options || []).map((p) => [p.key, p.ids[r(p.key) % 2]]));
    else if (q.answer === 'trivia') {
      if (!(q.options || []).length) return []; // no round for this episode (the premiere's): nothing to answer
      answer = Object.fromEntries(q.options.map((t) => [t.id, t.options[r(t.id) % t.options.length]]));
    } else if (q.answer === 'split') {
      const jury = 5 + (r('jury') % 5), first = Math.ceil(jury / 2) + (r('lead') % 2);
      answer = [Math.min(jury, first), jury - Math.min(jury, first), 0].filter((x, i) => i < 2 || x > 0);
    } else if (q.answer === 'ticket') {
      // A ticket: some of its legs (between its least and most), staked below as any wager.
      const t = q.options;
      if (!t || !Array.isArray(t.of)) return [];
      const n = t.min + (r('legs') % (t.max - t.min + 1));
      const legs = t.of.slice().sort((a, b) => r(a) - r(b)).slice(0, n);
      const room = Math.max(0, (q.stakeMost ?? 0) - staked), stake = Math.floor((room * (1 + (r('stake') % 3))) / 10);
      staked += stake;
      return [{ type: 'answer', gameId, personId, question: q.id, episode: q.episode, answer: { legs, stake } }];
    } else if (q.answer === 'number') {
      if (!Array.isArray(q.options) || !q.options.length) return [];
      answer = q.options[r('n') % q.options.length];
    } else {
      const ids = (q.options || []).map((o) => (o && typeof o === 'object' ? o.id : o)).filter((x) => x !== undefined && x !== null);
      if (!ids.length) return [];
      const pickN = Math.max(1, q.pick || 1);
      const order = ids.slice().sort((a, b) => r(a) - r(b));
      answer = ['order', 'confidence'].includes(q.answer) || pickN > 1 ? order.slice(0, pickN) : order[0];
    }
    // A wager: some of what they may stake (a tenth to a half of it), as a couch would; nothing when there's nothing to stake.
    const room = Math.max(0, (q.stakeMost ?? (typeof q.wager === 'number' ? q.wager : 0)) - (q.stakeMost === null || q.stakeMost === undefined ? 0 : staked));
    const stake = Math.max(0, Math.floor((room * (1 + (r('stake') % 5))) / 10));
    staked += stake;
    return [{ type: 'answer', gameId, personId, question: q.id, episode: q.episode, answer: q.wager === null || q.wager === undefined ? answer : { answer, stake } }];
  });
}

/**
 * A stock market's trade (a free-agency move at the market's terms: MarketLogic), now and then, as a couch trades: about one week in
 * three, sell their cheapest holding for the best value they can afford (points so far for the price), checked by the engine's own
 * rule (MarketLogic.moveProblem). None without a market, or when nothing fits.
 */
function marketMoves(session, gameId, personId, seed) {
  const st = session.snapshot().games[gameId]?.state;
  if (!st || !S.MarketLogic.on(st) || !st.players.some((p) => p.id === personId)) return [];
  if (roll(seed, gameId, personId, 'trade', S.PriceLogic.latest(st)) % 3) return [];
  const prices = S.PriceLogic.prices(st), points = S.PriceLogic.points(st);
  const live = st.castaways.filter((c) => c.status !== 'eliminated');
  const mine = live.filter((c) => c.ownerIds.includes(personId)).sort((a, b) => (prices.get(a.id) || 0) - (prices.get(b.id) || 0));
  const free = live.filter((c) => !c.ownerIds.includes(personId)).sort((a, b) => (points.get(b.id) || 0) / Math.max(1, prices.get(b.id) || 1) - (points.get(a.id) || 0) / Math.max(1, prices.get(a.id) || 1));
  const drop = mine[0];
  if (!drop) return [];
  const adds = free.filter((c) => !S.MarketLogic.moveProblem(st, personId, drop.id, c.id, prices)).slice(0, 3).map((c) => c.id);
  if (!adds.length) return [];
  // While the week's waivers are open, a claim (settled at their run, as the server runs them); once they've run, free agency.
  const week = S.WaiverLogic.current(st);
  if (week?.phase === 'open') return [{ type: 'claim', gameId, personId, spot: { dropId: drop.id, addIds: adds } }];
  if (week?.phase === 'processed') return [{ type: 'freeAgency', gameId, personId, addId: adds[0], dropId: drop.id }];
  return [];
}

/** Every move `personIds` have open now, across the definition's games, in a stable order. */
function movesFor(session, personIds, seed) {
  const out = [];
  for (const g of playable(session)) for (const pid of personIds) out.push(...e1Moves(session, g.id, pid), ...answerMoves(session, g.id, pid, seed), ...marketMoves(session, g.id, pid, seed));
  return out;
}

/** Apply `personIds`' open moves through the runtime; a move the runtime refuses is reported, never forced. Returns what happened. */
function play(session, personIds, seed) {
  const done = [];
  for (const action of movesFor(session, personIds, seed)) {
    const r = session.apply(action, 'preview-players');
    done.push({ action: { type: action.type, gameId: action.gameId, personId: action.personId, eventId: action.eventId, question: action.question }, status: r.status, message: r.status === 'accepted' ? undefined : r.message });
  }
  return done;
}

module.exports = { movesFor, play, e1Moves, answerMoves, playable };
