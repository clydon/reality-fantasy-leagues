// Three unrelated definitions, one shared context. No recipe selector or production account.
const D = require('../../../tools/gameplay-bench/explorer/document.cjs');
const input = require('./questions-input.json');
module.exports = function proof(options = {}) {
  return D.create({
    seed: options.seed ?? 42,
    world: {
      contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...input.context, couch: 2, pool: 18 } }],
      people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }],
    },
    games: [
      { id: 'lineup', contextId: 'show', spec: { get: { by: 'draft', each: 4, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments', points: { rewardWin: 7 } }, rank: { by: 'total' } } },
      { id: 'picks', contextId: 'show', spec: { get: { by: 'pick', each: 3, repeat: 'never' }, score: { by: 'moments' }, rank: { by: 'total' } } },
      { id: 'questions', contextId: 'show', spec: input.spec },
    ].map(game => ({ ...game, timing: options.timing || 'own-pace' })),
    situation: { clock: options.clock || '2099-01-10T12:00:00.000Z', marks: [{ personId: 'ann', contextId: 'show', through: options.ann ?? 2 }, { personId: 'bo', contextId: 'show', through: options.bo ?? 2 }] },
    content: { labels: 'long', completedEvents: 2, eventCount: options.eventCount ?? 3 },
  });
};
