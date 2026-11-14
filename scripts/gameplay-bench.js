// Local fixture generation and source-driven scenario inspection. Never creates a DB game.
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), args = process.argv.slice(2), command = args.shift() || 'generate';
const aliases = { 'context-file': 'contextFile', 'steps-file': 'stepsFile', 'queries-file': 'queriesFile' };
function optionsOf(args) {
  return Object.fromEntries(args.map(arg => {
    if (!/^--[a-z][a-zA-Z-]*=.+/.test(arg)) throw Error('Expected --name=value');
    const i = arg.indexOf('='), key = arg.slice(2, i);
    return [aliases[key] || key, arg.slice(i + 1)];
  }));
}
function read(file) {
  if (fs.statSync(file).size > 12 * 1024 * 1024) throw Error('Scenario file exceeds the 12 MB local inspection budget');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function write(file, value) {
  const output = path.resolve(root, file), rel = path.relative(root, output);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw Error('Output must be inside the workspace');
  if (fs.existsSync(output)) throw Error('Output already exists; choose another --out filename to preserve evidence');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(value, null, 2) + '\n');
  return rel.split(path.sep).join('/');
}
function allow(options, keys) { for (const key of Object.keys(options)) if (!keys.includes(key)) throw Error('Unknown option ' + key); }
try {
  const options = optionsOf(args);
  if (command === 'execute') {
    allow(options, ['file', 'stepsFile', 'queriesFile', 'out']);
    if (!options.file || !options.out) throw Error('Use execute --file=<scenario or execution.json> --out=<new result.json> [--steps-file=<steps.json>] [--queries-file=<queries.json>]');
    const input = read(path.resolve(options.file));
    // The CLI saves the whole case result. Accept that file again without hand-editing its envelope.
    const result = require('../tools/gameplay-bench/explorer/runtime.cjs').execute(input.execution || input, options.stepsFile ? read(path.resolve(options.stepsFile)) : [], options.queriesFile ? read(path.resolve(options.queriesFile)) : []);
    const file = write(options.out, result);
    console.log(JSON.stringify({ ok: result.ok, status: result.status, category: result.category || null, message: result.message || null, stateHash: result.execution?.stateHash || null, actions: result.execution?.trace.length || 0, outcomes: result.outcomes || [], gaps: result.gaps?.slice(0, 8) || [], file }));
    if (!result.ok) process.exitCode = result.status === 'blocked' ? 2 : 1;
  } else if (['inspect', 'normalize', 'baseline'].includes(command)) {
    allow(options, ['file', 'contextFile', 'out']);
    let result;
    if (command === 'baseline') result = require('../tools/gameplay-bench/explorer/baseline.cjs').capture();
    else {
      if (!options.file) throw Error('Use ' + command + ' --file=<scenario/replay/spec.json> [--context-file=<context.json>] [--out=<new file>]');
      const D = require('../tools/gameplay-bench/explorer/document.cjs');
      const document = D.read(read(path.resolve(options.file)), options.contextFile ? { context: read(path.resolve(options.contextFile)) } : {});
      result = command === 'normalize' ? document : require('../tools/gameplay-bench/explorer/analyze.cjs').analyze(document);
    }
    if (command === 'normalize' && !options.out) throw Error('Normalization needs --out=<new file>; the original is preserved');
    const file = options.out ? write(options.out, result) : null;
    const summary = command === 'inspect'
      ? { documentId: result.documentId, engine: result.engine, ...result.summary, readiness: result.readiness, diagnostics: result.diagnostics, firstGaps: result.adapterPlan.gaps.slice(0, 8), report: file }
      : command === 'baseline' ? { counts: result.counts, examples: result.examples.map(e => ({ file: e.file, hash: e.hash })), report: file }
        : { documentId: result.id, schemaVersion: result.schemaVersion, games: result.games.length, snapshotAt: result.history.snapshotAt, file };
    console.log(JSON.stringify(summary));
    if (command === 'inspect' && result.engine.status === 'invalid') process.exitCode = 2;
  } else if (command === 'generate') {
    const keys = ['seed', 'players', 'starters', 'bench', 'history', 'status', 'labels', 'images', 'pace', 'timing', 'progress', 'context', 'sportGame', 'showGame', 'rosterSize', 'bestCount', 'picksPerRound'];
    allow(options, [...keys, 'out', 'format']);
    if (options.format && !['legacy', 'document'].includes(options.format)) throw Error('Choose --format=legacy or --format=document');
    const config = {};
    for (const key of keys) if (options[key] !== undefined) config[key] = key === 'progress' ? options[key].split(',').map(Number) : ['seed', 'players', 'starters', 'bench', 'history', 'rosterSize', 'bestCount', 'picksPerRound'].includes(key) ? Number(options[key]) : options[key];
    const { createSession } = require('../tools/gameplay-bench/session.cjs');
    const base = read(path.join(root, '.ui-atlas/datasets/recorded.json')), session = createSession(base, config);
    const data = options.format === 'document' ? session.document() : session.export();
    const file = write(options.out || '.ui-atlas/bench-fixture.json', data);
    console.log(JSON.stringify({ ok: session.checks().every(c => c.pass), file, format: data.kind, config: session.scenario.config, checks: session.checks(), url: 'http://127.0.0.1:4400/__atlas/bench?scenario=' + encodeURIComponent(JSON.stringify(session.initialConfig)), ...(options.format === 'document' ? { loadPolicy: 'V2 inspection/document export. The current browser replay loader still expects version 1; the URL opens its legacy pilot configuration.' } : {}) }));
  } else if (command === 'campaign') {
    // campaign --dir=<new or existing dir> [--create=<id> --seed=<n> --cases=<n> [--depth=<n>] [--tier=engine|api [--app=http://localhost:3000]]] [--workers=<n>] [--limit=<n>] [--status=1] [--repro=<case index> --out=<new file>]
    allow(options, ['dir', 'create', 'seed', 'cases', 'depth', 'tier', 'app', 'workers', 'limit', 'status', 'repro', 'out']);
    if (!options.dir) throw Error('Use campaign --dir=<dir> (see docs/GAMEPLAY-EXPLORER.md#campaigns)');
    const C = require('../tools/gameplay-bench/campaign/runner.cjs'), dir = path.resolve(root, options.dir), rel = path.relative(root, dir);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw Error('Campaign directory must be inside the workspace');
    if (options.create) C.create(dir, { id: options.create, seed: Number(options.seed), cases: Number(options.cases), depth: options.depth ? Number(options.depth) : undefined, tier: options.tier, app: options.app });
    if (options.repro !== undefined) {
      const { manifest } = C.load(dir), Case = require('../tools/gameplay-bench/campaign/case.cjs'), index = Number(options.repro);
      const { document, steps, executeSteps } = Case.reproducer(manifest, index), result = Case.runCase(manifest, index, { steps });
      const minimal = result.outcome === 'fail' ? Case.minimize(manifest, index, steps, result.signature) : null;
      const file = write(options.out || '.ui-atlas/campaign-repro-' + index + '.json', { kind: 'gameplay-campaign-reproducer', campaign: manifest.id, index, result, input: document, steps, executeSteps, minimalSteps: minimal });
      console.log(JSON.stringify({ file, outcome: result.outcome, signature: result.signature || null, steps: steps.length, minimalSteps: minimal ? minimal.length : null, hint: 'node scripts/gameplay-bench.js execute --file=<input> --steps-file=<steps> runs it again; the bench opens the input.' }));
    } else if (options.status) console.log(JSON.stringify(C.status(dir)));
    else {
      const controller = new AbortController(); process.once('SIGINT', () => { console.error('Cancelling: in-flight cases stay abandoned and rerun on resume.'); controller.abort(); });
      C.run(dir, { workers: options.workers ? Number(options.workers) : 2, limit: options.limit ? Number(options.limit) : Infinity, signal: controller.signal })
        .then(s => { console.log(JSON.stringify(s)); if (s.outcomes.fail || s.outcomes.error || s.outcomes.timeout || s.outcomes.infrastructure) process.exitCode = 1; })
        .catch(e => { console.error(e.message); process.exitCode = 1; });
    }
  } else throw Error('Use generate, inspect, normalize, execute, campaign or baseline. See docs/GAMEPLAY-EXPLORER.md.');
} catch (e) { console.error(e.message); process.exitCode = 1; }
