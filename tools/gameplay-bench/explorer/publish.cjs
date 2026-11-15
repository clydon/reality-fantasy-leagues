// An episode's results, generated from a case's seed: what the bench's Publish button sends (runtime-session.cjs publish) and what
// the first page's situations publish (situations.cjs), one function so both make the same results. A show's: who goes out (the
// season's last episode crowns a winner and its finalists: runtime-data.cjs outcome) and one moment; a correction picks a different
// exit. A sport's: its box score (runtime-sports.cjs resultsFor: every athlete's line, a field's with its standings, a slate's
// week its games'), from the seed, the episode and the status (a correction's differ).
const J = require('./json.cjs');
/** The `results` action's data for `eventId` in context `contextId` of a session snapshot `snap` (its definition `document`). */
function resultsData(snap, document, contextId, eventId, status) {
  const world = snap.contexts[contextId], event = world.events.find(e => e.id === eventId);
  if (!event) throw Error('Unknown episode');
  const h = k => parseInt(J.digest([document.seed, eventId, status, k]).slice(0, 8), 16);
  if (world.context.kind === 'sport') return require('./runtime-sports.cjs').resultsFor(world.context, world.participants, i => h('line:' + i), event);
  const F = require('../../../src/lib/game/formats'), RD = require('./runtime-data.cjs');
  const before = world.facts.find(f => f.eventId === eventId)?.data.events?.[0]?.castawayId, gone = new Set(world.facts.filter(f => f.eventId !== eventId).flatMap(f => (f.data.events || []).map(o => o.castawayId)));
  const still = world.participants.filter(p => !gone.has(p.id) && (status !== 'corrected' || p.id !== before));
  if (still.length < 2) throw Error('Too few people still in to publish results');
  const finale = event.number === world.events.length, format = F.formatFor(world.context.format.id);
  const moments = (world.context.engine.moments || []).filter(m => !m.auto && !m.off).map(m => m.id), outs = RD.outcome(format, still.map(p => p.id), k => h(k === 'exit' ? 'out' : k), finale);
  const votes = RD.bounties(document) ? RD.voteFacts(format, still.map(p => p.id), outs, k => h('vote:' + k)) : undefined; // a bounty's votes (who voted for whom)
  return { events: outs, scoringEvents: moments.length ? [{ id: 'bench-' + eventId + '-' + status, type: moments[h('moment') % moments.length], castawayId: still[h('who') % still.length].id }] : [], ...(outs.length ? {} : { noExit: true }), ...(votes ? { votes } : {}) };
}
module.exports = { resultsData };
