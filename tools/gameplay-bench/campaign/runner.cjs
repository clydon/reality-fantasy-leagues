// Resumable headless campaign runner (plan Chunk 4A). A campaign is a directory:
//   manifest.json   pinned: id, seed, generator, case count, limits, and the code versions it ran against
//   attempts.jsonl  one line per attempt start (written BEFORE a case runs)
//   results.jsonl   one line per finished attempt (written AFTER); a case counts once, by its first finished attempt
// An attempt with a start and no result was abandoned (crash, kill, cancel): on resume it is counted as abandoned and
// its case runs again, so an interruption can never leave a false pass. Changed code refuses to resume: start a new,
// linked campaign instead. Workers are worker_threads with a real wall-clock watchdog and a heap limit; case identity
// and seeds come from the manifest and index alone, so worker count and scheduling order never change outcomes.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Worker } = require('worker_threads');
const J = require('../explorer/json.cjs'), Gen = require('./generator.cjs'), R = require('../explorer/runtime.cjs');
const SCHEMA = 1;
const appHash = () => J.treeHash(require('path').resolve(__dirname, '../../../src'));
const versions = tier => ({ ...J.versions(), runtime: R.VERSION, generator: Gen.VERSION, campaign: SCHEMA, ...(tier === 'api' ? { app: appHash() } : {}) });
const lines = file => fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
const append = (file, value) => { const fd = fs.openSync(file, 'a'); try { fs.writeSync(fd, JSON.stringify(value) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } };

function create(dir, input) {
  const manifest = { kind: 'gameplay-campaign', schemaVersion: SCHEMA, id: input.id, seed: input.seed, generator: Gen.VERSION, cases: input.cases,
    tier: input.tier || 'engine', ...(input.tier === 'api' ? { app: input.app || 'http://localhost:3000' } : {}),
    limits: { depth: input.depth ?? 12, caseTimeoutMs: input.caseTimeoutMs ?? (input.tier === 'api' ? 60000 : 30000), heapMb: input.heapMb ?? 256 }, ...(input.inject ? { inject: input.inject } : {}), ...(input.linkedFrom ? { linkedFrom: input.linkedFrom } : {}), versions: versions(input.tier) };
  if (!['engine', 'api'].includes(manifest.tier)) throw Error('Campaign tier is engine or api');
  if (manifest.tier === 'api' && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(manifest.app)) throw Error('The API tier needs a local app URL');
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(manifest.id || '')) throw Error('Campaign id: lowercase letters, digits and dashes');
  if (!Number.isInteger(manifest.seed) || !Number.isInteger(manifest.cases) || manifest.cases < 1 || manifest.cases > 1e6) throw Error('Campaign needs an integer seed and 1 to 1,000,000 cases');
  if (fs.existsSync(path.join(dir, 'manifest.json'))) throw Error('A campaign already exists here; resume it or choose a new directory');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
function load(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  if (manifest.kind !== 'gameplay-campaign' || manifest.schemaVersion !== SCHEMA) throw Error('Not a campaign manifest');
  const now = versions(manifest.tier), drift = Object.keys(now).filter(k => manifest.versions[k] !== now[k]);
  return { manifest, drift };
}

/** Current accounting from the durable files. */
function status(dir) {
  const { manifest, drift } = load(dir), attempts = lines(path.join(dir, 'attempts.jsonl')).filter(a => a.at), results = lines(path.join(dir, 'results.jsonl')); // start lines only (leases/sweeps are bookkeeping)
  const finished = new Set(results.map(r => r.attemptId)), byCase = new Map();
  for (const r of results) if (!byCase.has(r.caseId)) byCase.set(r.caseId, r); // first finished attempt wins; duplicates are retries, not cases
  const outcomes = {}, signatures = {};
  for (const r of byCase.values()) { outcomes[r.outcome] = (outcomes[r.outcome] || 0) + 1; if (r.outcome !== 'pass') (signatures[r.signature] ||= []).push(r.caseId); }
  // Known product defects a case still reproduces (api-checks `known:` signatures): counted apart from failures.
  const known = {}; for (const r of byCase.values()) for (const k of r.known || []) known[k] = (known[k] || 0) + 1;
  return { id: manifest.id, cases: manifest.cases, completed: byCase.size, remaining: manifest.cases - byCase.size, attempts: attempts.length, abandoned: attempts.filter(a => !finished.has(a.attemptId)).length,
    retries: results.length - byCase.size, outcomes, known, failures: Object.fromEntries(Object.entries(signatures).map(([k, v]) => [k, { count: v.length, cases: v.slice(0, 20) }])), drift };
}

/** Run (or resume) until done, cancelled or `limit` more cases have finished. Resolves with status(). */
async function run(dir, { workers = 2, limit = Infinity, signal } = {}) {
  const { manifest, drift } = load(dir);
  if (drift.length) throw Error('Code changed since this campaign started (' + drift.join(', ') + '). Start a linked new campaign; do not resume across versions.');
  const done = new Set(lines(path.join(dir, 'results.jsonl')).map(r => r.caseId));
  // Rows of API-tier attempts that never finished (crash/kill/cancel): remove them before running again.
  if (manifest.tier === 'api') {
    const finished = new Set(lines(path.join(dir, 'results.jsonl')).map(r => r.attemptId)), swept = new Set(lines(path.join(dir, 'attempts.jsonl')).filter(a => a.swept).map(a => a.lease));
    for (const a of lines(path.join(dir, 'attempts.jsonl')).filter(a => a.lease && !finished.has(a.attemptId) && !swept.has(a.lease))) { await require('../live-db.cjs').down(a.lease).catch(() => {}); append(path.join(dir, 'attempts.jsonl'), { attemptId: a.attemptId, lease: a.lease, swept: true }); }
    await require('../live-db.cjs').close().catch(() => {});
  }
  const queue = []; for (let i = 0; i < manifest.cases; i++) if (!done.has(Gen.caseId(manifest, i))) queue.push(i);
  let finishedNow = 0, cancelled = false;
  const n = Math.max(1, Math.min(workers, 16, queue.length || 1));
  const one = () => new Promise(resolve => {
    const next = () => {
      if (cancelled || signal?.aborted || finishedNow >= limit || !queue.length) return resolve();
      const index = queue.shift(), attemptId = crypto.randomUUID(), caseId = Gen.caseId(manifest, index);
      append(path.join(dir, 'attempts.jsonl'), { attemptId, caseId, index, at: new Date().toISOString() });
      const worker = new Worker(path.join(__dirname, 'worker.cjs'), { workerData: { manifest, index }, resourceLimits: { maxOldGenerationSizeMb: manifest.limits.heapMb } });
      let settled = false;
      const finish = result => {
        if (settled) return; settled = true; clearTimeout(watchdog); signal?.removeEventListener('abort', onAbort);
        if (result) { append(path.join(dir, 'results.jsonl'), { attemptId, ...result }); finishedNow++; }
        worker.terminate().finally(next);
      };
      // A real harness watchdog, independent of the scenario's simulated clock.
      const watchdog = setTimeout(() => finish({ caseId, index, outcome: 'timeout', signature: 'timeout', message: 'Exceeded ' + manifest.limits.caseTimeoutMs + ' ms' }), manifest.limits.caseTimeoutMs);
      const onAbort = () => { cancelled = true; finish(null); }; // no result line: the attempt stays abandoned, never a pass
      signal?.addEventListener('abort', onAbort, { once: true });
      worker.on('message', m => { if (m.lease) append(path.join(dir, 'attempts.jsonl'), { attemptId, lease: m.lease }); else if (m.result) finish({ ...m.result, caseId, index }); });
      worker.once('error', e => finish({ caseId, index, outcome: 'infrastructure', signature: 'worker:' + (e.code || 'error'), message: e.message }));
      worker.once('exit', code => { if (!settled) finish(code === 0 ? null : { caseId, index, outcome: 'infrastructure', signature: 'worker-exit', message: 'Worker exited ' + code }); });
    };
    next();
  });
  await Promise.all(Array.from({ length: n }, one));
  return status(dir);
}
module.exports = { create, load, status, run, versions };
