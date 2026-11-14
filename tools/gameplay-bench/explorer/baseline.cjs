const fs = require('fs'), path = require('path');
const J = require('./json.cjs');
const root = path.resolve(__dirname, '../../..');
const fixtureDir = path.join(root, 'tests/fixtures/gameplay-explorer');
const G = require('../../../src/lib/game/game-spec'), W = require('../../../src/lib/game/start-wizard');
const Controls = require('../game-controls.cjs'), Sports = require('../sports.cjs');
const jiti = require('jiti')(__filename, { alias: { '@': path.join(root, 'src') } });
const { CONTROLS } = jiti('../../../src/lib/game/game-page/compile.ts');
const { DRAWN } = jiti('../../../src/lib/game/game-page/model.ts');

function inventory() {
  const show = Controls.showCatalog(), sports = Sports.catalog();
  return {
    source: { families: [...G.LEAGUE_TYPES], showBases: W.KINDS.map(k => ({ id: k.base, name: k.name })), primaryPatterns: [...DRAWN.keys()].filter(k => k.startsWith('main:') && k !== 'main:weeklyCard').map(k => k.slice(5)), answerControls: [...CONTROLS], vocabularyHash: J.digest(G.VOCAB) },
    legacyPilot: {
      show: show.map(g => ({ id: g.id, type: g.type, fixture: g.implemented ? 'legacy-generator-connected' : 'adapter-missing', declaredSurfaces: g.surfaces, rendering: 'not-verified-by-inventory', interaction: g.id === 'picks' ? 'single-choice-editor-only; multi-pick commands/history' : 'not-verified-by-inventory', design: 'unreviewed' })),
      sports: sports.map(c => ({ id: c.id, sport: c.sport, games: c.games.map(g => ({ id: g.id, type: g.type, fixture: g.implemented ? 'legacy-generator-connected' : 'adapter-missing', declaredSurfaces: g.surfaces, rendering: 'not-verified-by-inventory', interaction: 'not-verified-by-inventory' })) })),
    },
    counts: { engineFamilies: G.LEAGUE_TYPES.length, showStartingBases: W.KINDS.length, showFixtureRecipes: show.filter(g => g.implemented).length, sportContexts: sports.length, sportRecipeCombinations: sports.reduce((n, c) => n + c.games.filter(g => g.implemented).length, 0) },
  };
}
function capture() {
  const examples = fs.readdirSync(fixtureDir).filter(f => /^legacy-.*-v1\.json$/.test(f)).sort().map(file => {
    const input = JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8'));
    const analysis = require('./analyze.cjs').analyze(input);
    return { file: path.relative(root, path.join(fixtureDir, file)).split(path.sep).join('/'), hash: J.digest(input), specHash: J.digest(input.scenario.spec), stateHash: J.digest(input.scenario.state), config: input.initialConfig, legacyAdapterFingerprint: input.adapterFingerprint, historicalEngineChecks: input.checks, sourceRequirements: analysis.adapterPlan.requirements.filter(r => r.requested).map(r => ({ scope: r.scope, key: r.key })), policy: 'Frozen synthetic v1 input, not current UI or design evidence' };
  });
  return {
    kind: 'gameplay-explorer-baseline', schemaVersion: 1, syntheticClock: '2026-11-12T12:00:00.000Z', capturedWith: J.versions(), ...inventory(), examples,
    knownIssues: [
      { id: 'multi-pick-editor', component: 'src/new/show/dock.tsx', status: 'product-interaction-gap', description: 'The engine/history accepts several picks; the shared quick editor selects one.' },
      { id: 'sports-event-totals', component: 'src/lib/game/game-view.ts', status: 'product-projection-gap', description: 'Some athlete/history projections use event totals while standings use sports stats.' },
      { id: 'v2-runtime', status: 'browser-integration-pending', description: 'A bounded shared headless runtime executes full specs via CLI/HTTP. Visible bench controls/production frames still use the legacy pilot; arbitrary-spec rendering and campaign scheduling remain pending.' },
    ],
    statusPolicy: { discovery: 'not-evidence', engineChecks: 'engine-only', fixtureInput: 'not-a-UI-save', rendering: 'per-surface', interaction: 'per-trace', design: 'scoped-review', userApproval: 'separate' },
  };
}
module.exports = { inventory, capture };
