// Chunk 4A acceptance (docs/PLAN-GAMEPLAY-SCENARIO-EXPLORER.md): the resumable headless campaign runner.
// Uninterrupted vs interrupted/crashed/resumed with a different worker count; cancellation never records a pass;
// an injected failure reproduces independently and minimizes; changed code refuses to resume. No DB, app or browser.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const C = require('../tools/gameplay-bench/campaign/runner.cjs'), Case = require('../tools/gameplay-bench/campaign/case.cjs'), Gen = require('../tools/gameplay-bench/campaign/generator.cjs');
const spec = { id: 'accept', seed: 4242, cases: 10, depth: 8, inject: [{ index: 6, step: 3 }] };
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gameplay-campaign-'));
const clean = dir => { const r = fs.realpathSync(dir); if (path.dirname(r) !== fs.realpathSync(os.tmpdir()) || !path.basename(r).startsWith('gameplay-campaign-')) throw Error('Unexpected cleanup target'); fs.rmSync(r, { recursive: true, force: true }); };
const outcomes = dir => Object.fromEntries(fs.readFileSync(path.join(dir, 'results.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).map(r => [r.caseId, [r.outcome, r.signature || null, r.finalHash || null]]));

test('an interrupted, crashed and resumed run matches an uninterrupted one, with honest accounting', async () => {
  const a = temp(), b = temp();
  try {
    C.create(path.join(a, 'c'), spec); C.create(path.join(b, 'c'), spec);
    const whole = await C.run(path.join(a, 'c'), { workers: 3 });
    assert.equal(whole.completed, 10); assert.equal(whole.remaining, 0); assert.equal(whole.attempts, 10); assert.equal(whole.abandoned, 0);
    assert.deepEqual(whole.outcomes, { pass: 9, fail: 1 }); assert.deepEqual(Object.keys(whole.failures), ['injected']);

    const partial = await C.run(path.join(b, 'c'), { workers: 2, limit: 4 });
    assert(partial.completed >= 4 && partial.completed < 10, 'stopped after a limit: ' + partial.completed);
    // A crash mid-case: an attempt started and never finished.
    const { manifest } = C.load(path.join(b, 'c')), done = new Set(Object.keys(outcomes(path.join(b, 'c'))));
    const pending = Array.from({ length: 10 }, (_, i) => i).find(i => !done.has(Gen.caseId(manifest, i)));
    fs.appendFileSync(path.join(b, 'c', 'attempts.jsonl'), JSON.stringify({ attemptId: crypto.randomUUID(), caseId: Gen.caseId(manifest, pending), index: pending, at: new Date().toISOString() }) + '\n');
    const resumed = await C.run(path.join(b, 'c'), { workers: 1 });
    assert.equal(resumed.completed, 10); assert.equal(resumed.abandoned, 1, 'the crashed attempt is counted, not passed');
    assert.equal(resumed.attempts, 11); assert.equal(resumed.retries, 0);
    assert.deepEqual(resumed.outcomes, whole.outcomes);
    assert.deepEqual(outcomes(path.join(b, 'c')), outcomes(path.join(a, 'c')), 'every case has the same outcome and final state hash');
  } finally { clean(a); clean(b); }
});

test('cancellation leaves in-flight cases abandoned, never passed', async () => {
  const dir = temp();
  try {
    C.create(path.join(dir, 'c'), { ...spec, id: 'cancel', inject: undefined });
    const controller = new AbortController(); setTimeout(() => controller.abort(), 150);
    const s = await C.run(path.join(dir, 'c'), { workers: 2, signal: controller.signal });
    assert(s.remaining > 0, 'cancel should stop early');
    assert.equal(s.completed + s.abandoned <= s.attempts, true);
    const after = await C.run(path.join(dir, 'c'), { workers: 2 });
    assert.equal(after.completed, 10); assert.deepEqual(after.outcomes, { pass: 10 });
  } finally { clean(dir); }
});

test('a failing case reproduces on its own and minimizes to the steps that matter', () => {
  const manifest = { ...spec, generator: Gen.VERSION, limits: { depth: 8 } };
  const failing = Case.runCase(manifest, 6); assert.equal(failing.outcome, 'fail'); assert.equal(failing.signature, 'injected');
  assert.equal(Case.runCase(manifest, 5).outcome, 'pass', 'other cases are unaffected');
  const { steps } = Case.reproducer(manifest, 6); assert.equal(steps.length, 8);
  assert.equal(Case.runCase(manifest, 6, { steps }).signature, 'injected');
  const minimal = Case.minimize(manifest, 6, steps, 'injected'); assert.equal(minimal.length, 4, 'the injected failure needs exactly four steps');
});

test('changed code refuses to resume a campaign', async () => {
  const dir = temp();
  try {
    C.create(path.join(dir, 'c'), { ...spec, id: 'drift' });
    const file = path.join(dir, 'c', 'manifest.json'), m = JSON.parse(fs.readFileSync(file, 'utf8'));
    m.versions.engine = 'older'; fs.writeFileSync(file, JSON.stringify(m));
    await assert.rejects(C.run(path.join(dir, 'c')), /Start a linked new campaign/);
  } finally { clean(dir); }
});
