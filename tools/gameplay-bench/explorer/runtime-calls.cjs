// Weekly Calls in the shared runtime: the show's calls (`ask: [CALLS]`, the weekly-calls preset), as src/lib/server/calls.ts
// makes, settles and tallies them. A call is a person's, one per episode and question, whichever game on the context counts it
// (episode_calls); stored per context (state.stores.calls[contextId]: { personId, episode, question, answer }). Each episode
// has two (src/lib/game/calls.ts callQuestions: who goes home, from who's still in, and a yes or no on one of the format's
// callable moments in turn), made from the next episode to air until it starts, or at your own pace on a paced season, and
// settled from the season's accepted results (episodeFacts: who went home, and which moments happened once the episode has any).
// Talk shows (settled by the couch's says) and a public pool's Who goes home? (pickEmCallsOn) are not connected.
const path = require('path');
const jiti = require('jiti')(__filename, { alias: { '@': path.resolve(__dirname, '../../../src') } });
const C = jiti('../../../src/lib/game/calls.ts'), B = jiti('../../../src/lib/game/formats/blocks/index.js');
const Plays = jiti('../../../src/lib/game/game-plays.ts');
const S = require('../../../src/lib/game/state-logic'), G = require('../../../src/lib/game/game-spec'), Seq = require('../../../src/lib/game/sequence/index.js');

/** Whether a game is scored by the show's calls (StateLogic.piecesOf(...).hasCalls: Weekly Calls' one question). */
const on = spec => G.callsAsk(G.fullSpec(spec).ask);
/** The season's call book: a built-in format's rulebook (calls.ts seasonBook, for a season without its own rulebook). */
const books = new Map();
function bookOf(world) {
  const id = (world.context || world).format.id;
  if (!books.has(id)) { const rb = B.rulebookFor(id); books.set(id, { blocks: rb.blocks, aliases: rb.aliases ?? null }); }
  return books.get(id);
}
const winners = book => new Set((book.blocks.waysOut ?? []).filter(w => w.means === 'winner').map(w => book.aliases?.exits?.[w.id] ?? w.name));

/** calls.ts episodeFacts from the world's facts through `through`: who went home (not the winner leaving by winning), [] when
 *  nobody did or the episode is final; its moments once it has any (an accepted moment makes it final), else null. */
function factsOf(world, book, through) {
  const out = new Map(), wins = winners(book);
  for (const e of world.events) {
    // Accepted results only: early (partial) ones aren't the season's decisions yet (the materializer writes final and corrected).
    if (e.number > through || !['final', 'corrected'].includes(e.resultStatus)) continue;
    const data = world.facts.find(f => f.eventId === e.id)?.data;
    if (!data) continue;
    const gone = (data.events || []).filter(x => !wins.has(x.method)).map(x => x.castawayId);
    const moments = (data.scoringEvents || []).filter(m => m.units == null || Number(m.units) > 0).map(m => m.type);
    const final = moments.length > 0, noexit = !!data.noExit;
    if (!gone.length && !noexit && !final) continue;
    out.set(e.number, { out: gone.length ? gone : (noexit || final ? [] : null), events: final ? new Set(moments) : null });
  }
  return out;
}
/** Who's still in going into episode `n` (calls.ts stillInAt), as call faces. */
function stillIn(world, facts, n) {
  const gone = new Set();
  for (const [ep, f] of facts) if (ep < n) for (const id of f.out ?? []) gone.add(id);
  return world.participants.filter(p => !gone.has(p.id)).map(p => ({ id: p.id, name: p.name, photo: null }));
}
const airOf = (world, n) => world.events.find(e => e.number === n)?.airAt ?? null;
const aired = (world, n, now) => { const at = airOf(world, n); return !!at && Date.parse(at) <= now; };
/** The next episode to air (calls.ts openEpisode): the first with an air time still to come. */
const openOf = (world, now) => world.events.find(e => e.airAt && Date.parse(e.airAt) > now) || null;
/** A season watched at your own pace (pacedSeason): every listed episode aired (the materialized season is 'airing'). */
const paced = (world, now) => world.events.length > 0 && world.events.every(e => !!e.airAt && Date.parse(e.airAt) <= now);
const latestAired = (world, now) => world.events.reduce((n, e) => (e.airAt && Date.parse(e.airAt) <= now ? e.number : n), 0);

/** One person's view of an episode's calls (calls.ts context + readCalls, less the couch's list): { refused } for what the
 *  route answers 409, else { status, catchUp, questions (keys and options), mine, verdicts }. `ownPace(n)`: whether they're on
 *  a live game at their own pace that plays `n` (lateOn's league check). */
function readCalls(world, store, personId, n, now, ownPace) {
  const book = bookOf(world), isAired = aired(world, n, now), open = openOf(world, now);
  if (!Number.isInteger(n) || n < 1 || n > 1000) return { refused: 400, message: 'Which episode?' };
  if (!isAired && (!open || open.number !== n)) return { refused: 409, message: open ? `Calls are open for Episode ${open.number}` : `Episode ${n} has no air time yet` };
  const mark = world.marks.find(m => m.personId === personId)?.through ?? 0, isPaced = paced(world, now);
  const late = !isPaced && isAired && mark === n - 1 && !aired(world, n + 1, now) && !!ownPace?.(n);
  const onIt = (isPaced || late) && isAired && mark === n - 1;
  const behind = (!isAired || isPaced) && mark < n - 1;
  const showsOut = onIt || (isAired ? mark >= n : !behind);
  const facts = showsOut ? factsOf(world, book, isAired && !onIt ? n : n - 1) : new Map();
  const questions = showsOut ? C.callQuestions(book, n, stillIn(world, facts, n)) : [];
  const mine = Object.fromEntries(store.filter(c => c.personId === personId && c.episode === n).map(c => [c.question, c.answer]));
  const out = { episode: n, status: onIt ? 'open' : behind ? 'behind' : isAired ? 'closed' : 'open', catchUp: behind ? n - 1 : isAired && mark < n && !onIt ? n : null, questions, mine, verdicts: null, paced: onIt };
  if (isAired && mark >= n) out.verdicts = Object.fromEntries(questions.map(q => [q.key, C.verdictOf(q.key, q.by, facts.get(n) ?? null, null)]));
  return out;
}

/** A call made, changed or taken back (calls.ts callEpisode's calls), or an Error with the route's words. */
function call(world, store, action, now, ownPace) {
  if (typeof action.question !== 'string' || !/^(out|m:[\w.-]{1,100})$/.test(action.question)) throw Error(`"${action.question}" isn't one of Episode ${action.episode}'s calls`);
  const n = action.episode, read = readCalls(world, store, action.personId, n, now, ownPace);
  if (read.refused) throw Error(read.message);
  const mark = world.marks.find(m => m.personId === action.personId)?.through ?? 0;
  if (aired(world, n, now) && !read.paced) throw Error(paced(world, now) && mark >= n ? `You've seen Episode ${n}: its calls are closed` : `Calls for Episode ${n} closed when it started`);
  if (read.status === 'behind') throw Error(`See Episode ${n - 1} first: its calls say who's still in`);
  const q = read.questions.find(x => x.key === action.question);
  if (!q) throw Error(`"${action.question}" isn't one of Episode ${n}'s calls`);
  const rest = store.filter(c => !(c.personId === action.personId && c.episode === n && c.question === q.key));
  if (action.answer === null) return rest;
  if (typeof action.answer !== 'string' || !q.options.some(o => o.key === action.answer)) throw Error(q.kind === 'cast' ? 'Call someone still in' : 'Yes or no');
  return [...rest, { personId: action.personId, episode: n, question: q.key, answer: action.answer }];
}

/** A Weekly Calls game's calls as one viewer reads them (calls.ts leagueCalls): each player's right calls from the game's start
 *  through the viewer's mark (and the game's end), each episode's for the season grid, and the next show's calls as the move. */
function gameCalls(world, store, full, personId, mark, now, userOf = id => id) {
  const book = bookOf(world), end = S.endEpisode(full), start = S.startEpisode(full);
  const through = Math.min(mark ?? Infinity, end ?? Infinity), users = full.players.map(p => userOf(p.id)).filter(Boolean);
  const byEpisode = new Map();
  let rights = new Map();
  if (start !== null && users.length && Math.min(through, 100000) >= Math.max(1, start)) {
    const upTo = Number.isFinite(through) ? through : 100000;
    const made = store.filter(c => users.includes(c.personId) && c.episode >= Math.max(1, start) && c.episode <= upTo);
    if (made.length) {
      const facts = factsOf(world, book, upTo);
      const right = made.filter(c => C.isRight(C.verdictOf(c.question, 'results', facts.get(c.episode) ?? null, null), c.answer));
      rights = Seq.tally(right.map(c => ({ id: c.personId, episode: c.episode, n: 1 })), byEpisode);
    }
  }
  const right = p => rights.get(userOf(p) ?? '') ?? 0;
  // The move: the next show's calls (callsMade), how many of its questions this person has called.
  const open = openOf(world, now), mine = personId ? store.filter(c => c.personId === userOf(personId)) : [];
  const keys = open ? C.callKeys(book, open.number, world.participants.length > 0) : [];
  const made = open ? { episode: open.number, airAt: open.airAt, made: mine.filter(c => c.episode === open.number && keys.includes(c.question)).length, of: keys.length } : null;
  const shown = Math.min(through, latestAired(world, now));
  const ended = (end !== null && shown >= end) || shown >= world.events.length;
  return {
    right,
    episodes: Plays.episodesByPlayer(full.players, userOf, byEpisode),
    through: shown,
    ended,
    move: start !== null && made && (end === null || made.episode <= end) ? { epId: '', episode: made.episode, airsAt: made.airAt, open: true, call: null, available: [], made: made.made, of: made.of, right: personId ? right(personId) : 0 } : null,
  };
}

module.exports = { on, bookOf, factsOf, readCalls, call, gameCalls };
