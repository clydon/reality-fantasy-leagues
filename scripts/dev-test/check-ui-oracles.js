// Browser-tier UI oracles over generated campaign cases (plan §6A item 7). Each case is a campaign walk (engine tier),
// exported and opened in the bench's live tier on a chosen renderer, then every person's host and game pages are
// checked at phone width for cheap, broad defects. These are not a design review or user approval.
//   overflow     the page scrolls sideways
//   indistinct   two choices in one control group read the same (a dialog, a question, a strip)
//   unnamed      a button or link has no accessible name
//   due-offscreen a due move on a game page is not within the first phone screen (principle 6)
//   failed-read  a request failed (>= 400), by URL; console-error: any other console error
//   (placeholderMedia counts the seeded GIFs' fake media; a fixture gap, not a finding)
//
// Needs: app(s), UI Atlas (:4400), local DB(s). Run:
//   node scripts/dev-test/check-ui-oracles.js [--cases=3] [--seed=7] [--app=http://localhost:3000] [--width=390] [--surfaces=tonight,episodes,full]
// Out: .ui-atlas/ui-oracles/<app port>/report.json and a screenshot per finding. Cases are closed (rows removed) after.
const fs = require('fs'), path = require('path'), { open } = require('./browser');
const root = path.resolve(__dirname, '../..'), base = 'http://127.0.0.1:4400';
const C = require(path.join(root, 'tools/gameplay-bench/campaign/case.cjs')), Gen = require(path.join(root, 'tools/gameplay-bench/campaign/generator.cjs'));
const arg = (k, d) => process.argv.find(a => a.startsWith('--' + k + '='))?.slice(k.length + 3) ?? d;
const app = arg('app', 'http://localhost:3000'), width = Number(arg('width', 390)), cases = Number(arg('cases', 3)), seed = Number(arg('seed', 7));
const surfaces = arg('surfaces', 'tonight,episodes,full').split(',');
const out = path.join(root, '.ui-atlas/ui-oracles', new URL(app).port || '80'); fs.mkdirSync(out, { recursive: true });
const manifest = { id: 'ui-oracles', seed, generator: Gen.VERSION, limits: { depth: 10 } };

// Runs inside the page: the cheap structural oracles.
function pageOracles(height) {
  const found = [], examined = { choices: 0, sample: [] }, vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const text = e => (e.getAttribute('aria-label') || e.innerText || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
  if (document.documentElement.scrollWidth > innerWidth + 1) found.push({ oracle: 'overflow', detail: document.documentElement.scrollWidth + ' > ' + innerWidth });
  for (const e of document.querySelectorAll('button, a[href], [role="button"]')) if (vis(e) && !text(e) && !e.querySelector('img[alt]:not([alt=""]), svg[aria-label], [aria-label]')) found.push({ oracle: 'unnamed', detail: e.outerHTML.slice(0, 140) });
  for (const group of document.querySelectorAll('[role="dialog"], [data-question], [data-game-strip], [role="group"], [role="radiogroup"]')) {
    // Visible text, as a person reads it (an accessible name can differ and still leave two choices looking the same).
    const seen = e => (e.innerText || '').replace(/\s+/g, ' ').trim();
    const labels = [...group.querySelectorAll('button[aria-pressed], [role="radio"], [data-pick], [data-starter]')].filter(vis).map(seen).filter(Boolean);
    examined.choices += labels.length; if (examined.sample.length < 6) examined.sample.push(...labels.slice(0, 6 - examined.sample.length));
    const dup = labels.filter((l, i) => labels.indexOf(l) !== i);
    if (dup.length) found.push({ oracle: 'indistinct', detail: { group: (group.getAttribute('data-question') || group.getAttribute('role') || group.tagName).toString(), repeated: [...new Set(dup)].slice(0, 3), of: labels.length } });
  }
  const due = document.querySelector('[data-game-due="yes"]');
  if (due) { const r = due.getBoundingClientRect(); if (r.top > height) found.push({ oracle: 'due-offscreen', detail: 'due move at y=' + Math.round(r.top) }); }
  return { found, examined };
}

(async () => {
  const b = await open({ width, height: 844, motion: 'reduce' }), p = b.page, report = { app, width, manifest, results: [] };
  const post = (route, body) => p.request.post(base + '/__atlas/bench/' + route, { data: body }).then(r => r.json());
  try {
    for (let index = 0; index < cases; index++) {
      const walked = C.runCase(manifest, index, { keep: true });
      if (walked.outcome !== 'pass') { report.results.push({ index, skipped: walked.outcome }); continue; }
      const execution = walked.session.export(); walked.session.dispose();
      const opened = await post('runtime/open', { input: execution, app, surface: 'full', theme: 'night' });
      if (opened.status !== 'open') { report.results.push({ index, error: opened.message || opened.error }); continue; }
      const id = opened.state.id;
      try {
        for (const person of opened.state.people) for (const surface of surfaces) for (const game of surface === 'full' ? opened.state.games : [null]) {
          const sel = await post('runtime/select', { id, viewerId: person.id, ...(game ? { gameId: game.id } : {}), surface, theme: 'night' });
          if (!sel.frame) { report.results.push({ index, person: person.id, surface, game: game?.id, error: sel.error }); continue; }
          const errors = [], failed = [], placeholder = []; p.removeAllListeners('console'); p.removeAllListeners('response');
          p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
          // Failed responses by URL. The seeded GIFs' placeholder media (zt-bench) is a known fixture gap, reported apart.
          p.on('response', r => { if (r.status() >= 400) (/zt-bench/.test(r.url()) ? placeholder : failed).push(r.status() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 160)); });
          await p.goto(sel.frame.url, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errors.push(e.message));
          await p.waitForTimeout(800);
          const { found: findings, examined } = await p.evaluate(pageOracles, 844);
          for (const e of failed) findings.push({ oracle: 'failed-read', detail: e });
          for (const e of errors) findings.push({ oracle: 'console-error', detail: e });
          const where = 'c' + index + '-' + person.id + '-' + surface + (game ? '-' + game.id : '');
          if (findings.length) await p.screenshot({ path: path.join(out, where + '.png') });
          report.results.push({ index, caseId: walked.caseId, person: person.id, mark: person.seen, surface, game: game?.id || null, findings, examined, placeholderMedia: placeholder.length });
          console.log(where + ': ' + (findings.length ? findings.map(f => f.oracle).join(', ') : 'clean') + (examined.choices ? ' (' + examined.choices + ' choices: ' + examined.sample.join(' / ') + ')' : ''));
        }
      } finally { await post('runtime/close', { id }).catch(() => {}); }
    }
  } finally {
    const all = report.results.flatMap(r => (r.findings || []).map(f => f.oracle)), counts = all.reduce((n, o) => (n[o] = (n[o] || 0) + 1, n), {});
    report.summary = { pages: report.results.filter(r => r.findings).length, findings: counts };
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report.summary));
    await b.close();
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
