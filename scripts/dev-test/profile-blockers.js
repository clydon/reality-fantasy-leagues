// Which runtime-profile gaps block the gameplay matrix's show specimens, most often first: the breadth program's way of picking the
// next capability (docs/PLAN-GAMEPLAY-SCENARIO-EXPLORER.md §6A Progress). Each specimen is opened as one game in a Survivor world
// of three people and checked against the bounded runtime profile (tools/gameplay-bench/explorer/runtime-profile.cjs). Sports
// specimens are left out. A game in stages is opened live, as the engine lab (its only door) makes one. No app, browser or DB.
//
// Needs: the matrix report (.ui-atlas/gameplay-matrix.json): node scripts/gameplay-matrix.js build
// Run:   node scripts/dev-test/profile-blockers.js [--top=18] [--path=score/parlays] [--kinds]
//        --path lists the specimens a gap blocks (their spec's relevant keys), to see which shapes a capability must cover.
//        --kinds breaks the unconnected questions (other answer kinds) down by shape: answer · asked · closes · settled by, and
//        "alone", the specimens nothing else blocks.
const path = require('path');
const root = path.resolve(__dirname, '../..');
const P = require(path.join(root, 'tools/gameplay-bench/explorer/runtime-profile.cjs')), D = require(path.join(root, 'tools/gameplay-bench/explorer/document.cjs'));
const Q = require(path.join(root, 'tests/fixtures/gameplay-explorer/questions-input.json'));
const arg = k => process.argv.find(a => a.startsWith('--' + k + '='))?.slice(k.length + 3);
// Give the path without its leading slash (score/parlays): Git Bash rewrites a leading /score/... into a Windows path.
const top = Number(arg('top') || 18), only = arg('path') ? '/' + arg('path').replace(/^\/+/, '') : null;
let report;
try { report = require(path.join(root, '.ui-atlas/gameplay-matrix.json')); } catch { console.error('No matrix report: run node scripts/gameplay-matrix.js build'); process.exit(1); }
const count = new Map(), blocked = [], kinds = new Map(); let ok = 0, n = 0, docErrors = 0;
for (const s of report.specimens) {
  if (!s.spec || s.sport) continue; n++;
  let doc;
  try { doc = D.create({ seed: 1, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 3, pool: 12 }, tribes: 2, pairs: { every: 2 } }], people: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }, { id: 'p3', name: 'C' }] }, games: [{ id: 'g', contextId: 'show', spec: s.spec, ...(s.spec.stages ? { timing: 'live-only' } : {}) }], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] } }); }
  catch { docErrors++; continue; }
  const r = P.inspect(doc);
  if (!r.gaps.length) { ok++; continue; }
  const keys = new Set(r.gaps.map(g => g.path.replace(/^\/games\/0\/spec/, '').replace(/\/\d+(\/|$)/g, '/#$1') + ' :: ' + g.reason));
  for (const k of keys) count.set(k, (count.get(k) || 0) + 1);
  if (only && [...keys].some(k => k.startsWith(only))) blocked.push(s.spec);
  // Unconnected questions by shape (--kinds), and whether nothing else blocks the specimen.
  const asks = r.gaps.filter(g => /^\/games\/0\/spec\/ask\/\d+$/.test(g.path) && /^Only per-event/.test(g.reason)), alone = r.gaps.every(g => asks.includes(g));
  for (const g of asks) {
    const q = s.spec.ask[Number(g.path.split('/').pop())], k = [q.answer, q.asked, q.closes, (q.settle?.by || '') + (q.settle?.take ? ':' + q.settle.take : '')].join(' · ');
    const c = kinds.get(k) || { all: 0, alone: 0 }; c.all++; if (alone) c.alone++; kinds.set(k, c);
  }
}
console.log(JSON.stringify({ specimens: n, runnable: ok, docErrors }));
console.log([...count].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, v]) => v + '  ' + k).join('\n'));
if (process.argv.includes('--kinds')) console.log('\nUnconnected questions (answer · asked · closes · settled by), and how many nothing else blocks:\n' + [...kinds].sort((a, b) => b[1].all - a[1].all).map(([k, c]) => c.all + ' (alone ' + c.alone + ')  ' + k).join('\n'));
if (only) {
  const shapes = new Map();
  for (const spec of blocked) { const k = JSON.stringify({ get: spec.get?.by, score: spec.score?.by, rank: spec.rank?.by, at: only.split('/').filter(Boolean).reduce((o, p) => (o && p !== '#' ? o[p] : o), spec) }); shapes.set(k, (shapes.get(k) || 0) + 1); }
  console.log('\n' + only + ': ' + blocked.length + ' specimens\n' + [...shapes].sort((a, b) => b[1] - a[1]).map(([k, v]) => v + '  ' + k).join('\n'));
}
