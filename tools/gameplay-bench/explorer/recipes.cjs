// The old bench's recipe form as v2 definitions (plan §6A item 11): the same choices (game type and its quantities,
// players, episodes aired, situation, viewing pace, timing, names, photos, viewer, seed) become a scenario document the
// shared runtime and the explorer open, instead of the pilot's hand-built state. The pilot's own validation and spec
// building (scenario.cjs configOf, game-controls.cjs specOf) are reused, so limits and specs stay identical.
//
// Differences from the pilot, deliberately (the runtime's rules, not the pilot's shortcuts):
// - "Decision needed" leaves this episode's decisions open for everyone, not only the viewer; "Decision saved" sets them for
//   everyone caught up.
// - "Round locked" marks the next episode's decisions locked; "Game finished" ends the game's span at the last aired episode.
// - Sports contexts are not converted: generated sports statistics aren't connected to the runtime yet (the old bench
//   keeps serving them until they are).
const B = require('../scenario.cjs'), Controls = require('../game-controls.cjs'), D = require('./document.cjs');
const CONTEXT = require('../../../tests/fixtures/gameplay-explorer/questions-input.json').context; // JSON Survivor context
const NAMES = ['Alex', 'Riley', 'Sam', 'Jordan', 'Morgan', 'Casey', 'Drew', 'Taylor'];
const LIFECYCLE = { due: 'unspecified', saved: 'saved', locked: 'locked', catchup: 'unspecified', finished: 'unspecified' }; // finished: the span ends at the last aired episode

function label(labels, name) {
  return labels === 'long' ? name + ' de la Cruz Montgomery-Wellington' : labels === 'unbroken' ? name + 'VeryLongUnbrokenName'.repeat(5) : name;
}
/** A v2 definition for a recipe; `{ input, label }`. Throws with a plain reason for what the runtime can't run yet. */
function recipeDefinition(input = {}) {
  const config = B.configOf(input);
  if (config.context !== 'show') throw Error('Sports recipes still run in the old bench: generated sports statistics aren’t connected to the shared runtime yet.');
  const spec = Controls.specOf(config), history = config.history, players = config.players;
  spec.span = { from: 1, to: config.status === 'finished' ? Math.max(1, history) : null };
  const people = Array.from({ length: players }, (_, i) => ({ id: 'p' + (i + 1), name: label(config.labels === 'shared' ? 'normal' : config.labels, NAMES[i % NAMES.length] + (i >= NAMES.length ? ' ' + (i + 1) : '')) }));
  const viewer = config.viewer, behind = i => config.pace === 'mixed' ? i % 4 : config.pace === 'friend-behind' && i === (viewer + 1) % players && players > 1 ? 2 : (config.pace === 'you-behind' || config.status === 'catchup') && i === viewer ? 2 : 0;
  const marks = people.map((p, i) => ({ personId: p.id, contextId: 'show', through: config.progress?.[i] ?? Math.max(0, history - behind(i)) }));
  const game = Controls.showCatalog().find(g => g.id === config.showGame);
  const document = D.create({
    seed: config.seed,
    world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...CONTEXT, couch: players, pool: 18 } }], people },
    games: [{ id: config.showGame, name: game?.name, contextId: 'show', spec, timing: config.timing }],
    situation: { clock: '2099-01-10T12:00:00.000Z', viewerId: people[viewer].id, marks, lifecycle: LIFECYCLE[config.status] },
    // Two episodes beyond the aired ones: someone can air and publish the next and the season still has one to come (the
    // production read path appends an episode the runtime doesn't model once a season runs out).
    content: { labels: config.labels, images: config.images, completedEvents: history, eventCount: history + 2 },
  });
  const words = { due: 'decision needed', saved: 'decision saved', locked: 'round locked', catchup: 'behind', finished: 'game finished' }[config.status];
  return { input: document, label: (game?.name || config.showGame) + ' · ' + players + (players === 1 ? ' player' : ' players') + ' · ' + history + ' aired · ' + words };
}
module.exports = { recipeDefinition };
