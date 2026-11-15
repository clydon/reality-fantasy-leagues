// The game page's situations on the explorer page (tools/gameplay-bench/explorer/situations.cjs; docs/GAME-PAGE-SITUATIONS.md):
// for each situation, Open… › A game-page situation › its entry opens the real game page in the bench's phone frame as its
// viewer, on the real routes (zt-gb rows the bench removes when it closes the case). Checked: the frame is signed in as the
// situation's viewer, the game page renders, nothing scrolls sideways, and the page's own UI checks come back. A screenshot of
// each (`.ui-atlas/situations/<id>.png`) and the page's words (`<id>.txt`) are kept for the design round.
//
// Needs: Atlas on :4400 (bash scripts/dev-test/restart-atlas.sh) and the app on :3000 (npm run dev).
// Run:   node scripts/dev-test/check-situations-page.js [--only=<regex on the id>]
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict'), { open } = require('./browser');
const root = path.resolve(__dirname, '../..'), base = 'http://127.0.0.1:4400', out = path.join(root, '.ui-atlas/situations');
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7);
const { list } = require(path.join(root, 'tools/gameplay-bench/explorer/situations.cjs'));
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await open({ width: 1440, height: 1000, motion: 'reduce' }), p = b.page, results = [];
  try {
    await p.goto(base + '/__atlas/explorer'); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__?.ready, {}, { timeout: 20000 });
    for (const x of list().filter(y => !only || new RegExp(only).test(y.id))) {
      try {
        await p.locator('#open').click(); await p.locator('#open-situation').click();
        await p.locator('[data-situation="' + x.id + '"]').click();
        const app = p.frameLocator('#device-a iframe');
        await app.locator('[data-game-page]').waitFor({ timeout: 45000 });
        await p.waitForFunction(() => !!window.__GAMEPLAY_EXPLORER_PAGE__.sides.a?.oracles, {}, { timeout: 30000 });
        const ui = await p.evaluate(() => window.__GAMEPLAY_EXPLORER_PAGE__.ui);
        assert.equal(ui.surface, 'full', 'opens on the game page');
        const user = await app.locator('body').evaluate(() => fetch('/api/me/home').then(r => r.json()).then(j => j.user?.username || j.user?.name)).catch(() => null);
        // (A zt username is the person's name, lower case, its first twelve letters and digits: live-db.cjs usernameOf.)
        const name = await p.evaluate(v => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.people.find(x => x.id === v)?.name || v, ui.viewerId);
        assert.match(String(user), new RegExp('^' + (name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'p') + '_ztgb'), 'signed in as ' + ui.viewerId + ', got ' + user);
        const page = await app.locator('body').evaluate(() => ({ text: document.body.innerText, wide: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }));
        assert.ok(!page.wide, 'nothing scrolls sideways');
        fs.writeFileSync(path.join(out, x.id + '.txt'), page.text);
        await p.locator('#device-a').screenshot({ path: path.join(out, x.id + '.png') });
        results.push({ id: x.id, ok: true }); console.log('PASS ' + x.id + ': ' + x.label);
      } catch (e) { results.push({ id: x.id, ok: false, error: e.message }); console.log('FAIL ' + x.id + ': ' + e.message.split('\n')[0]); await p.screenshot({ path: path.join(out, x.id + '-fail.png') }).catch(() => {}); }
    }
  } finally { await b.close(); }
  const bad = results.filter(r => !r.ok);
  console.log(bad.length ? bad.length + ' FAILED of ' + results.length : 'ALL PASS (' + results.length + ')');
  process.exit(bad.length ? 1 : 0);
})();
