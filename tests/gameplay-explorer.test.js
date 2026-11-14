const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const J = require('../tools/gameplay-bench/explorer/json.cjs');
const D = require('../tools/gameplay-bench/explorer/document.cjs');
const A = require('../tools/gameplay-bench/explorer/analyze.cjs');
const P = require('../tools/gameplay-bench/explorer/planner.cjs');
const G = require('../src/lib/game/game-spec');
const { createSession } = require('../tools/gameplay-bench/session.cjs');
const base = require('./fixtures/gameplay-explorer/base.cjs');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/gameplay-explorer', name + '.json'), 'utf8'));
const legacy = read('legacy-lineup-v1'), context = legacy.scenario.context;
const questionSpec = () => ({ get: { by: 'none' }, score: { by: 'answers' }, rank: { by: 'total' }, ask: [
  { id: 'boot', ask: 'Who goes home?', answer: 'person', points: 2, asked: 'each', settle: { by: 'results', take: 'out' } },
  { id: 'happens', ask: 'Will this moment occur?', answer: 'yesNo', points: 1, asked: 'each', settle: { by: 'moment', moment: context.moments[0].id, take: 'happened' } },
] });
const fixtureDocument = () => D.fromSpec(questionSpec(), context);

test('frozen legacy inputs migrate without mutation, lost state, replay duplication or promoted evidence', () => {
  for (const name of ['legacy-lineup-v1', 'legacy-picks-v1', 'legacy-nfl-v1']) {
    const original = read(name), hash = J.digest(original), d = D.fromLegacy(original), again = D.read(JSON.parse(JSON.stringify(d)));
    assert.equal(J.digest(original), hash);
    assert.deepEqual(D.originalLegacy(again), original);
    assert.equal(d.history.snapshotAt, 'head');
    assert.deepEqual(d.history.entries.map(e => e.command), original.commands);
    assert.deepEqual(d.setup.gameStates[d.games[0].id], original.scenario.state);
    assert.equal(d.provenance.originalHash, hash);
    assert.deepEqual(d.evidence.records, []);
    assert(!Object.hasOwn(d.games[0], 'starters'));
    assert(!Object.hasOwn(d.games[0], 'bench'));
  }
});

test('a canonical scenario holds two games sharing one viewing boundary and per-game roles', () => {
  const d = D.fromLegacy(legacy);
  d.games.push({ ...J.clone(d.games[0]), id: 'second-game', spec: questionSpec(), roles: { 'bench-p-1': 'commissioner' }, timing: 'live-only' });
  const copy = D.read(d);
  assert.equal(copy.world.contexts.length, 1);
  assert.equal(copy.situation.marks.length, 2);
  assert.equal(copy.games[0].timing, 'own-pace');
  assert.equal(copy.games[1].roles['bench-p-1'], 'commissioner');
  assert.deepEqual(copy.games[1].spec, questionSpec());
});

test('document validation rejects bad references, duplicate marks, implicit contexts and unknown aliases', () => {
  const cases = [
    d => d.games[0].contextId = 'missing',
    d => d.games[0].seats.push('unknown-person'),
    d => d.games[0].roles.unknown = 'commissioner',
    d => d.situation.marks.push(J.clone(d.situation.marks[0])),
    d => d.situation.viewerId = 'missing',
    d => d.situation.marks[0].through = 99,
    d => d.world.events[0].contextId = 'missing',
    d => d.world.facts[0].eventId = 'unknown-event',
    d => d.games[0].contextBindings.push({ path: '/stages/0/game', contextId: 'context-1' }),
    d => d.games[0].bench = 3,
    d => d.history.snapshotAt = 'unspecified',
    d => d.situation.timezone = 'invalid/zone',
    d => d.situation.clock = '2026-11-12T12:00:00',
  ];
  for (const mutate of cases) { const d = D.fromLegacy(legacy); mutate(d); assert.throws(() => D.read(d), /Scenario/); }
  assert.throws(() => D.read(questionSpec()), /explicit context/);
  assert.throws(() => D.fromSpec(questionSpec(), {}), /context cannot be empty/);
  assert.throws(() => D.read({ kind: D.KIND, schemaVersion: 3 }), /version 2/);
  assert.throws(() => D.create({ unexpected: true }), /unknown constructor field/);
});

test('JSON boundaries reject cycles, nonfinite values, reserved keys and credentials without printing values', () => {
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => D.read(cycle), /Cyclic/);
  assert.throws(() => D.read({ spec: questionSpec(), context: { pool: Infinity } }), /Expected JSON/);
  assert.throws(() => D.read(JSON.parse('{"__proto__":{"polluted":true}}')), /Reserved object key/);
  assert.throws(() => D.read({ password: 'sensitive-test-value' }), error => /Credential-shaped/.test(error.message) && !error.message.includes('sensitive-test-value'));
  const original = J.clone(legacy); original.fixture.context.username = 'real_account';
  assert.throws(() => D.fromLegacy(original), /zt_/);
});

test('canonical hashes and generated IDs do not depend on object key insertion order', () => {
  const one = D.fromSpec({ get: { by: 'none' }, ...questionSpec() }, context);
  const two = D.fromSpec(Object.fromEntries(Object.entries(questionSpec()).reverse()), context);
  assert.equal(one.id, two.id);
  assert.equal(J.digest(one), J.digest(two));
});

test('frozen v1 state still reproduces through the existing generator and accepted commands', () => {
  const B = require('../tools/gameplay-bench/scenario.cjs');
  for (const name of ['legacy-lineup-v1', 'legacy-picks-v1', 'legacy-nfl-v1']) {
    const original = read(name), scenario = B.makeScenario(original.initialConfig);
    for (const command of original.commands) B.command(scenario, command);
    assert.equal(J.digest(scenario.state), J.digest(original.scenario.state), name);
    assert.deepEqual(scenario.marks, original.scenario.marks);
  }
});

test('an arbitrary non-recipe question sheet is analyzed with separate controls and precise unbuilt adapters', () => {
  const d = fixtureDocument(), report = A.analyze(d);
  assert.equal(report.engine.status, 'valid');
  const controls = report.adapterPlan.requirements.filter(r => r.key.startsWith('control:'));
  assert.deepEqual(controls.map(r => r.key).sort(), ['control:person', 'control:yesNo']);
  assert.notEqual(controls[0].scope, controls[1].scope);
  assert.equal(report.adapterPlan.execution, 'not-executed');
  assert.equal(report.adapterPlan.status, 'blocked');
  assert(report.adapterPlan.gaps.some(g => g.key === 'runtime:scenario'));
  assert.equal(report.readiness.design, 'unreviewed');
  assert.equal(report.readiness.interaction, 'unverified');
  assert.equal(J.digest(report), J.digest(A.analyze(d)));
});

test('engine defaults are distinguishable from supplied fields; unknown features are not dropped', () => {
  const d = fixtureDocument(); d.games[0].spec.futureMechanic = { charges: 7 };
  const report = A.analyze(d);
  const future = report.adapterPlan.gaps.find(g => g.key === 'field:futureMechanic/charges');
  assert(future);
  assert.deepEqual(future.sourceLocations, [{ path: '/games/0/spec/futureMechanic/charges', source: 'supplied' }]);
  assert(report.adapterPlan.requirements.some(r => r.sourceLocations.some(o => o.source === 'engine-default')));
  assert.equal(report.nodes[0].normalizedSpec.futureMechanic.charges, 7);
});

test('stages are recursively analyzed with distinct identities and explicit context bindings', () => {
  const spec = { stages: [
    { id: 'first', name: 'First', game: { ...J.clone(legacy.scenario.spec), span: { from: 1, to: 2 } } },
    { id: 'second', name: 'Second', game: { ...questionSpec(), span: { from: 3, to: 4 } } },
  ], overall: { by: 'points' } };
  const d = D.fromSpec(spec, context);
  d.world.contexts.push({ id: 'context-2', kind: 'show', engine: { ...J.clone(context), couch: 7 } });
  d.games[0].contextBindings.push({ path: '/stages/1/game', contextId: 'context-2' });
  const report = A.analyze(d);
  assert.equal(report.nodes.length, 3);
  assert.equal(new Set(report.nodes.map(n => n.scope)).size, 3);
  assert.equal(report.nodes[2].contextId, 'context-2');
  assert.equal(report.nodes[2].contextHash, J.digest(d.world.contexts[1].engine));
  assert(report.adapterPlan.gaps.some(g => g.key === 'composition:stages'));
});

test('sports context and invalid or gated definitions retain engine diagnostics', () => {
  const nfl = read('legacy-nfl-v1'), sport = A.analyze(D.fromSpec(nfl.scenario.spec, nfl.scenario.context));
  assert.equal(sport.engine.status, 'valid');
  assert(sport.adapterPlan.gaps.some(g => g.key === 'fact:results/stats'));
  const invalid = fixtureDocument(); invalid.games[0].spec.ask[0].points = -1;
  const report = A.analyze(invalid);
  assert.equal(report.engine.status, 'invalid');
  assert(report.nodes[0].engine.problems.some(p => p.sourcePath.includes('/ask/')));
  const gated = fixtureDocument(); gated.games[0].spec.ask[0].settle = { by: 'outside' };
  assert(A.analyze(gated).nodes[0].engine.waits.length > 0);
});

const requirement = (key, scope = 'game:g') => ({ scope, gameId: scope.slice(5), contextId: 'c', key, origins: ['/test'] });
const adapter = (id, provides, requires = [], owns = []) => ({ id, version: 1, provides, requires, owns });
test('planner orders dependencies and scopes shared facts without executing declarations', () => {
  const report = P.plan([requirement('view')], [adapter('view', ['view'], [{ key: 'facts', scope: 'context' }]), adapter('facts', ['facts'], [], ['store:events'])]);
  assert.equal(report.status, 'planned');
  assert.deepEqual(report.steps.map(n => n.adapterId), ['facts', 'view']);
  assert.equal(report.steps[0].scope, 'context:c');
  assert.equal(report.execution, 'not-executed');
});

test('planner propagates missing dependencies and rejects ambiguous providers and writers', () => {
  const missing = P.plan([requirement('view')], [adapter('view', ['view'], ['facts'])]);
  assert.equal(missing.steps[0].status, 'dependency-blocked');
  assert.equal(missing.gaps[0].key, 'facts');
  const ambiguous = P.plan([requirement('view')], [adapter('a', ['view']), adapter('b', ['view'])]);
  assert.equal(ambiguous.conflicts[0].kind, 'ambiguous-provider');
  const writers = P.plan([requirement('a'), requirement('b', 'game:other')], [adapter('a', ['a'], [], [{ key: 'store:events', scope: 'context' }]), adapter('b', ['b'], [], [{ key: 'store:events', scope: 'context' }])]);
  assert.equal(writers.conflicts[0].kind, 'competing-writers');
  assert.equal(writers.status, 'blocked');
});

test('a dependency later requested directly retains its actual source origin', () => {
  const report = P.plan([requirement('a'), { ...requirement('facts'), origins: ['/actual/facts'] }], [adapter('a', ['a'], ['facts'])]);
  const facts = report.requirements.find(r => r.key === 'facts');
  assert.equal(facts.requested, true);
  assert.deepEqual(facts.origins, ['/actual/facts']);
  assert.deepEqual(report.gaps.find(g => g.key === 'facts').origins, ['/actual/facts']);
});

test('baseline source vocabulary and frozen requirement manifests expose drift without creating coverage passes', () => {
  const baseline = require('./fixtures/gameplay-explorer/baseline.json');
  const current = require('../tools/gameplay-bench/explorer/baseline.cjs').capture();
  assert.deepEqual(current.source, baseline.source, 'Source capability drift needs review');
  for (const example of baseline.examples) {
    const now = current.examples.find(e => e.file === example.file);
    assert(now);
    assert.equal(now.hash, example.hash, 'Frozen exports must not be silently overwritten');
    assert.deepEqual(now.sourceRequirements, example.sourceRequirements, 'Requirement discovery changed; review new gaps');
  }
  assert.equal(current.statusPolicy.discovery, 'not-evidence');
});

test('planner identifies dependency cycles and invalid registrations instead of recursing indefinitely', () => {
  const report = P.plan([requirement('a')], [adapter('a', ['a'], ['b']), adapter('b', ['b'], ['a'])]);
  assert.equal(report.cycles.length, 1);
  assert(report.steps.every(s => s.status === 'dependency-blocked'));
  assert.throws(() => P.plan([], [adapter('same', []), adapter('same', [])]), /duplicate/);
  assert.throws(() => P.plan([], [{ ...adapter('bad-version', []), version: 0 }]), /Invalid/);
});

test('legacy session exports remain v1 while the additive document endpoint supplies a v2 head snapshot', () => {
  const session = createSession(base, { players: 2, history: 1 });
  const g = session.view(); session.command({ type: 'lineup', episodeId: g.lineup.epId, playerId: g.playerId, ids: g.lineup.roster.slice(0, 3) });
  const original = J.clone(session.export()), document = session.document();
  assert.equal(original.schemaVersion, 1);
  assert.equal(document.schemaVersion, 2);
  assert.deepEqual(D.originalLegacy(document), original);
  const analysis = A.analyze(document);
  assert(analysis.adapterPlan.steps.some(n => n.adapterId === 'legacy.snapshot-input'));
  assert.equal(analysis.readiness.runtime, 'blocked');
  assert(analysis.runtimeSupport.gaps.some(g => /snapshot reconciliation/.test(g.reason)));
});

test('inspection HTTP routes work without recorded data or an app, and session document export is additive', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'gameplay-explorer-'));
  try {
    const router = require('../tools/gameplay-bench/router.cjs').router({ out, activate: async() => ({ origin: 'http://127.0.0.1:1', url: 'http://127.0.0.1:1/game' }), releaseBench() {}, sourceFingerprint: 'test-source' });
    const url = name => new URL('http://127.0.0.1/__atlas/bench/' + name);
    const report = await router('POST', url('analyze'), { input: { spec: questionSpec(), context } });
    assert.equal(report.status, 200); assert.equal(report.body.engine.status, 'valid');
    const normalized = await router('POST', url('normalize'), { input: legacy });
    assert.deepEqual(D.originalLegacy(normalized.body), legacy);
    const invalid = await router('POST', url('analyze'), { input: questionSpec() });
    assert.equal(invalid.status, 400);
    fs.mkdirSync(path.join(out, 'datasets')); fs.writeFileSync(path.join(out, 'datasets/recorded.json'), JSON.stringify(base));
    const created = await router('POST', url('generate'), { config: { players: 2, history: 1 } });
    assert.equal(created.status, 201);
    const exported = await router('GET', url('document?id=' + created.body.id), {});
    assert.equal(exported.body.schemaVersion, 2);
    const snapshot = await router('GET', url('snapshot?id=' + created.body.id), {});
    assert.equal(snapshot.body.schemaVersion, 1);
  } finally {
    const resolved = fs.realpathSync(out), tempRoot = fs.realpathSync(os.tmpdir());
    if (path.dirname(resolved) !== tempRoot || !path.basename(resolved).startsWith('gameplay-explorer-')) throw Error('Unexpected temporary cleanup target');
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
