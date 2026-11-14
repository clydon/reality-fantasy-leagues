// Side-by-side renderer comparison (plan §6A items 5 and 8): one definition, materialized once PER renderer (isolated
// zt-gb rows, so one side's writes never reach the other), the same surface and person, captured at the same viewport.
// A renderer is a running local app: this checkout (:3000) or a worktree's dev server carrying a redesign.
//
// Needs: UI Atlas (:4400) and each renderer's dev server, all on the same local database.
// Run:   node scripts/dev-test/compare-renderers.js --b=http://localhost:3004 [--a=http://localhost:3000]
//          [--surfaces=tonight,episodes,full] [--viewers=ann,bo] [--width=390] [--file=<definition.json>]
//        `node -e "fetch('http://127.0.0.1:4400/__atlas/bench/runtime/renderers').then(r=>r.json()).then(console.log)"` lists renderers.
// Out:   .ui-atlas/renderer-compare/<surface>-<viewer>-a.png / -b.png and compare.json. Cases are removed after the run.
// Scope: identical inputs and paired captures for review; not a design verdict.
const fs = require('fs'), path = require('path'), { open } = require('./browser');
const root = path.resolve(__dirname, '../..'), base = 'http://127.0.0.1:4400', out = path.join(root, '.ui-atlas/renderer-compare');
const arg = (k, d) => process.argv.find(a => a.startsWith('--' + k + '='))?.slice(k.length + 3) ?? d;
const A = arg('a', 'http://localhost:3000'), B = arg('b');
if (!B) { console.error('Choose a second renderer: --b=http://localhost:30xx'); process.exit(1); }
const surfaces = arg('surfaces', 'tonight,episodes,full').split(','), viewers = arg('viewers', 'ann,bo').split(','), width = Number(arg('width', 390));
const input = arg('file') ? JSON.parse(fs.readFileSync(path.resolve(arg('file')), 'utf8')) : require(path.join(root, 'tests/fixtures/gameplay-explorer/runtime-proof.cjs'))({ ann: 2, bo: 1, eventCount: 5 });
fs.mkdirSync(out, { recursive: true });

(async () => {
  const b = await open({ width, height: 844, motion: 'reduce' }), p = b.page, report = { a: A, b: B, width, shots: [], problems: [] };
  const post = (route, body) => p.request.post(base + '/__atlas/bench/' + route, { data: body }).then(r => r.json());
  const cases = {};
  try {
    for (const [side, app] of [['a', A], ['b', B]]) {
      const r = await post('runtime/open', { input, app, surface: 'full', theme: 'night' });
      if (r.status !== 'open') throw Error(side + ' (' + app + ') did not open: ' + JSON.stringify(r).slice(0, 300));
      cases[side] = r.state.id;
    }
    for (const viewer of viewers) for (const surface of surfaces) for (const side of ['a', 'b']) {
      const r = await post('runtime/select', { id: cases[side], viewerId: viewer, surface, theme: 'night' });
      if (!r.frame) { report.problems.push({ side, viewer, surface, error: r.error || 'no frame' }); continue; }
      const errors = []; p.removeAllListeners('console'); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await p.goto(r.frame.url, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errors.push(e.message));
      await p.waitForTimeout(1200);
      const file = surface + '-' + viewer + '-' + side + '.png'; await p.screenshot({ path: path.join(out, file), fullPage: false });
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      report.shots.push({ side, app: side === 'a' ? A : B, viewer, surface, file, overflow, errors: errors.slice(0, 5) });
      console.log(side + ' ' + viewer + ' ' + surface + (overflow ? ' OVERFLOW' : '') + (errors.length ? ' errors:' + errors.length : ''));
    }
  } finally {
    for (const id of Object.values(cases)) await post('runtime/close', { id }).catch(() => {}); // removes each case's zt-gb rows
    fs.writeFileSync(path.join(out, 'compare.json'), JSON.stringify(report, null, 2));
    await b.close();
    console.log(JSON.stringify({ ok: !report.problems.length, shots: report.shots.length, problems: report.problems, out: path.relative(root, out) }));
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
