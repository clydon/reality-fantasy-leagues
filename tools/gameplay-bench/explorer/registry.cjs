const J = require('./json.cjs');

// Only genuinely implemented analysis/input operations are declared here in this milestone.
// Data generators, UI drivers and v2 projection runtime arrive in later chunks, not by assertion.
const adapters = [
  { id: 'engine.context-check', version: 1, provides: ['check:engine'], requires: [], owns: [], evidence: 'engine-only', when: r => r.engineStatus === 'valid' },
  { id: 'compiler.requirement-check', version: 1, provides: ['check:compiler'], requires: [], owns: [], evidence: 'compiler-only', when: r => r.compiled && r.compilerHoles === 0 },
  { id: 'legacy.snapshot-input', version: 1, provides: ['input:state-snapshot'], requires: [], owns: [], evidence: 'preserved-input-only', when: (r, { document }) => {
    const original = document.compatibility?.original;
    const game = document.games.find(g => g.id === r.gameId);
    const context = document.world.contexts.find(c => c.id === game?.contextId);
    return !!(original && game && document.setup.gameStates[game.id]
      && J.digest(document.setup.gameStates[game.id]) === J.digest(original.scenario.state)
      && J.digest(game.spec) === J.digest(original.scenario.spec)
      && J.digest(context.engine) === J.digest(original.scenario.context));
  } },
];
module.exports = { adapters };
