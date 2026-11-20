// Weekly Bingo in the shared runtime (core-runtime-45, a live preview's: docs/PLAN-preview-release.md), as src/lib/server/bingo.ts
// deals, ticks and counts it, for a card of the show's moments: nine squares each a moment of the format's (keys 'm:<moment id>'),
// settled by the season's results (the episode's accepted moments), every ticked line counting (a card from before the banks: no
// calling, no couch says). Nothing's stored: a card is dealt from a seed of the document, the person and the episode (bingo.ts
// dealCard, its moments rated by how often each has happened in the season so far: likely, maybe, longshot), and each person ticks
// what happened as it aired, missing one in eight (a couch watching), from its airing on. The materializer files each aired episode's
// card and ticks (bingo_cards, bingo_marks), so the server reads them as its own: its lines are this module's.
// A bank's squares (written by research before an episode, settled by the couch's says) aren't connected here.
const path = require('path');
const jiti = require('jiti')(__filename, { alias: { '@': path.resolve(__dirname, '../../../src') } });
const B = jiti('../../../src/lib/game/bingo.ts');
const Plays = jiti('../../../src/lib/game/game-plays.ts');
const S = require('../../../src/lib/game/state-logic'), Seq = require('../../../src/lib/game/sequence/index.js'), J = require('./json.cjs');

const roll = (...parts) => parseInt(J.digest(parts).slice(0, 8), 16);
const released = e => ['final', 'corrected'].includes(e.resultStatus);

/** Whether a game is Weekly Bingo's (StateLogic.piecesOf(...).hasBingo). */
const on = state => !!S.piecesOf(state).hasBingo;

/** The moments that happened in episode n (its accepted results), or null before they're in. */
function happened(world, n) {
  const e = world.events.find(x => x.number === n);
  if (!e || !released(e)) return null;
  const f = world.facts.find(x => x.eventId === e.id);
  return new Set((f?.data.scoringEvents || []).map(m => m.type));
}

/** The squares a card is dealt from: the format's moments (not automatic, not off), each rated by how often it has happened in the
 *  season's results before episode n (most episodes: likely; a quarter or more: maybe; else a longshot; none yet: maybe). */
function bankOf(world, n) {
  const before = world.events.filter(e => e.number < n && released(e)).map(e => happened(world, e.number));
  return (world.context.engine.moments || []).filter(m => !m.auto && !m.off).map(m => {
    const rate = before.length ? before.filter(h => h.has(m.id)).length / before.length : null;
    return { key: 'm:' + m.id, label: m.label || m.id, likelihood: rate === null ? 'maybe' : rate >= 0.6 ? 'likely' : rate >= 0.25 ? 'maybe' : 'longshot' };
  });
}

/** `personId`'s card for episode n (null when the format has too few moments for one). */
const cardOf = (document, world, personId, n) => B.dealCard(bankOf(world, n), `bingo|${document.seed}|${personId}|${n}`);

/** The squares `personId` ticked on episode n's card once it aired: each that happened, but one in eight missed. */
function ticksOf(document, card, world, personId, n) {
  const h = happened(world, n);
  if (!card || !h) return new Set();
  return new Set(card.flatMap((sq, i) => (sq.key.startsWith('m:') && h.has(sq.key.slice(2)) && roll(document.seed, personId, n, i, 'miss') % 8 ? [i] : [])));
}

/** What's settled of each square of a card, by the episode's results: yes, no, or null (free, or not in yet). */
function truthOf(card, world, n) {
  const h = happened(world, n);
  return B.truthOf(card, k => (!h || !k.startsWith('m:') ? null : h.has(k.slice(2)) ? 'yes' : 'no'));
}

/** Each person's card, ticks and lines for an aired episode (the materializer's rows, and the count). */
function episodeCards(document, world, personIds, n) {
  return personIds.map(personId => {
    const card = cardOf(document, world, personId, n), ticked = ticksOf(document, card, world, personId, n);
    return { personId, episode: n, card, ticked: [...ticked], lines: card ? B.countLines(card, ticked, truthOf(card, world, n), null).standing : 0 };
  });
}

/** A Weekly Bingo game as one viewer reads it (bingo.ts leagueBingo): each player's lines through `mark` (the game's own episodes,
 *  aired), at the game's points a line. */
function gameBingo(document, world, full, mark, userOf = id => id) {
  const end = S.endEpisode(full), start = S.startEpisode(full), each = B.pointsPerLine(full);
  const latest = Math.max(0, ...world.events.filter(released).map(e => e.number));
  const through = Math.min(mark ?? Infinity, latest, end ?? Infinity), byEpisode = new Map();
  let lines = new Map();
  if (start !== null && Number.isFinite(through) && through >= Math.max(1, start)) {
    const rows = [];
    for (let n = Math.max(1, start); n <= through; n++) rows.push(...episodeCards(document, world, full.players.map(p => p.id), n).map(r => ({ id: userOf(r.personId), episode: n, n: r.lines })));
    lines = Seq.tally(rows, byEpisode);
  }
  const shown = Math.min(mark ?? Infinity, latest);
  return {
    right: p => Seq.counted(lines.get(userOf(p) ?? '') ?? 0, each),
    episodes: Plays.episodesByPlayer(full.players, userOf, byEpisode, each),
    move: null,
    bingo: null,
    through: Number.isFinite(through) ? through : shown,
    ended: (end !== null && shown >= end) || shown >= world.events.length,
  };
}

module.exports = { on, bankOf, cardOf, ticksOf, episodeCards, gameBingo };
