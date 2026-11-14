// Chunk 4 of docs/PLAN-GAMEPLAY-SCENARIO-EXPLORER.md: the three-case interaction proof, on the REAL routes (live tier).
// One definition, three unrelated games sharing a context (runtime-proof.cjs): a two-starter lineup, three fresh picks
// and a participant + yes/no question sheet. Ann is caught up, Bo a week behind. The journey, through the bench and the
// real application UI: initial state, decisions saved in the product's own editors, a clock past airtime (locks),
// results published, Ann's reveal, settlement, player detail, and Bo's view and reveal. After each phase the real
// /games standings are compared with the runtime's headless projection; every real write is compared by the bench.
// Product or driver behaviour that blocks a step is recorded as a reproducible finding, not worked around.
//
// Needs: app (:3000), UI Atlas (:4400, restart after bench edits: bash scripts/dev-test/restart-atlas.sh), local DB.
// Run:   node scripts/dev-test/check-explorer-proof.js [--width=390]
// Out:   .ui-atlas/explorer-proof/ (screenshots, proof-report.json). Rows are zt-gb- and removed with the case.
// Evidence scope: scoped interaction checks. Not a design review or a matrix pass.
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict'), { open } = require('./browser');
const root = path.resolve(__dirname, '../..'), base = 'http://127.0.0.1:4400', app = 'http://localhost:3000', out = path.join(root, '.ui-atlas/explorer-proof');
fs.mkdirSync(out, { recursive: true });
const R = require(path.join(root, 'tools/gameplay-bench/explorer/runtime.cjs')), { signIn } = require(path.join(root, 'tools/ui-atlas/data.cjs'));
const width = Number(process.argv.find(a => a.startsWith('--width='))?.slice(8) || 390);
const definition = require(path.join(root, 'tests/fixtures/gameplay-explorer/runtime-proof.cjs'))({ ann: 2, bo: 1, eventCount: 5 }); // a fourth event: the production read path keeps an upcoming episode while a season airs
const defFile = path.join(out, 'proof-definition.json'); fs.writeFileSync(defFile, JSON.stringify(definition));

(async () => {
  const b = await open({ width: 1536, height: 1080, motion: 'reduce' }), p = b.page, steps = [], findings = [];
  let shot = 0;
  const step = async (name, fn) => { try { await fn(); steps.push({ name, ok: true }); console.log('PASS ' + name); } catch (e) { steps.push({ name, ok: false, error: e.message }); await p.screenshot({ path: path.join(out, 'fail-' + steps.length + '.png') }).catch(() => {}); console.log('FAIL ' + name + ': ' + e.message.slice(0, 220)); } };
  const finding = (id, text, repro) => { findings.push({ id, text, repro }); console.log('FINDING ' + id + ': ' + text); };
  const snap = async name => p.screenshot({ path: path.join(out, String(++shot).padStart(2, '0') + '-' + name + '.png') });
  const bench = (route, body) => body ? p.request.post(base + '/__atlas/bench/' + route, { data: body }).then(r => r.json()) : p.request.get(base + '/__atlas/bench/' + route).then(r => r.json());
  const state = async () => bench('runtime/state?id=' + (await p.evaluate(() => window.__GAMEPLAY_BENCH__?.state?.id)));
  const preview = () => p.frameLocator('#preview');
  const waitFor = async (test, ms = 15000) => { const end = Date.now() + ms; let last; while (Date.now() < end) { last = await state(); if (test(last)) return last; await p.waitForTimeout(400); } throw Error('timed out: ' + JSON.stringify(last?.trace?.slice(-3) || [])); };
  const selectGame = async id => { await p.locator('#runtime-game').selectOption(id); await p.waitForFunction(id => window.__GAMEPLAY_BENCH__?.state?.gameId === id, id, { timeout: 20000 }); };
  const selectViewer = async id => { await p.locator('#viewer').selectOption(id); await p.waitForFunction(id => window.__GAMEPLAY_BENCH__?.state?.viewerId === id, id, { timeout: 20000 }); };
  const surface = async (name, ready) => { await p.locator('[data-surface="' + name + '"]').click(); if (ready) await preview().locator(ready).first().waitFor({ timeout: 30000 }); };
  const control = async action => { const st = await state(), r = await bench('runtime/apply', { id: st.id, action }); assert.equal(r.result?.status, 'accepted', JSON.stringify(r).slice(0, 300)); return r; };
  // Real /games, as each person, against the runtime's own production projection of the same exported state.
  const standingsAgree = async label => {
    const st = await state(), exported = await bench('runtime/export?id=' + st.id), queries = [];
    for (const person of st.people) for (const g of st.games) queries.push({ gameId: g.id, personId: person.id });
    const headless = R.execute(exported, [], queries); assert.equal(headless.status, 'executed', headless.message);
    for (const person of st.people) {
      const cookie = await signIn(app, st.live.users[person.id], 'zt-pass-12345');
      const real = await (await fetch(app + '/api/seasons/' + st.live.seasonId + '/games?couch=' + st.live.couchId, { headers: { cookie } })).json();
      for (const g of st.games) {
        const r = real.games.find(x => x.leagueId === st.live.leagues[g.id]), h = headless.projections.find(x => x.gameId === g.id && x.personId === person.id).view.game;
        assert(r, label + ': ' + g.id + ' missing for ' + person.id);
        assert.deepEqual(r.table.map(x => [x.playerId, x.total]), h.table.map(x => [x.playerId, x.total]), label + ': ' + g.id + ' standings for ' + person.id);
      }
    }
  };
  try {
    await p.goto(base + '/__atlas/bench'); await p.waitForFunction(() => window.__GAMEPLAY_BENCH__?.ready, {}, { timeout: 45000 });
    await p.locator('#viewport').selectOption(width >= 1000 ? '1280x900' : '390x844').catch(() => {});
    await step('open the proof definition on real routes', async () => { await p.locator('#load').setInputFiles(defFile); await p.waitForFunction(() => window.__GAMEPLAY_BENCH__?.mode === 'runtime', {}, { timeout: 40000 }); const st = await state(); assert(st.live, 'expected the live tier'); assert.equal(st.games.length, 3); });
    await step('initial standings agree (server vs runtime)', () => standingsAgree('initial'));
    // Tonight's own-pace plates (fixed 2026-11-12): a caught-up seat on an airing season gets no "You finished it";
    // someone behind gets their catch-up plate.
    await step('Tonight: no finish plate for caught-up Ann while episodes still air', async () => {
      await selectViewer('ann');
      const loaded = p.waitForResponse(r => /\/api\/seasons\/[^/]+\/games\?/.test(r.url()) && r.status() === 200, { timeout: 30000 });
      await surface('tonight'); const games = (await (await loaded).json()).games || []; await p.waitForTimeout(1200);
      // Non-vacuous: the data that used to draw the false plate is there (own pace, caught up, not over).
      assert(games.some(g => g.ownPace && g.pace && !g.catchUp && !g.over), 'no caught-up own-pace game in the real /games response');
      assert.equal(await preview().locator('[data-pace-finish]').count(), 0, 'a finish plate on an airing season'); await snap('tonight-ann');
    });
    await step('Tonight: Bo, behind, gets his catch-up plates', async () => {
      await selectViewer('bo'); await surface('tonight'); await preview().locator('[data-pace-plate]').first().waitFor({ timeout: 25000 });
      assert.equal(await preview().locator('[data-pace-finish]').count(), 0); await snap('tonight-bo'); await selectViewer('ann');
    });

    // ---- Lineup: initial state, a decision in the real quick editor, an invalid choice, player detail.
    await step('lineup: full page renders', async () => { await selectViewer('ann'); await selectGame('lineup'); await surface('full', '[data-game-page]'); await snap('lineup-full'); });
    await step('lineup: real quick editor save is accepted by server and runtime', async () => {
      await surface('quick'); const dialog = preview().getByRole('dialog'); await dialog.waitFor({ timeout: 25000 });
      const choices = dialog.locator('button[data-starter]:not([disabled])'), n = await choices.count(); assert(n >= 3, 'lineup editor offers ' + n);
      const was = await choices.evaluateAll(x => x.map(e => e.getAttribute('aria-pressed'))); for (let i = 0; i < n; i++) if (was[i] === 'true') await choices.nth(i).click();
      // An invalid choice first: one starter too many (the spec starts two).
      for (const i of [0, 1, 2]) await choices.nth(i).click();
      const save = dialog.getByRole('button', { name: 'Save', exact: true }), disabled = await save.isDisabled().catch(() => true);
      const pressed = await choices.evaluateAll(x => x.filter(e => e.getAttribute('aria-pressed') === 'true').length);
      if (pressed > 2 && !disabled) finding('lineup-overfill', 'The quick lineup editor lets a third starter be chosen with Save enabled for a two-starter lineup.', 'proof {ann:2}, Lineup, Quick action, tap three players');
      await choices.nth(2).click().catch(() => {}); // back to two
      if ((await choices.evaluateAll(x => x.filter(e => e.getAttribute('aria-pressed') === 'true').length)) !== 2) { for (const i of [0, 1, 2]) if ((await choices.nth(i).getAttribute('aria-pressed')) === 'true') await choices.nth(i).click(); await choices.nth(n - 1).click(); await choices.nth(n - 2).click(); }
      const before = (await state()).trace.length; await p.locator('#preview').scrollIntoViewIfNeeded(); await save.click();
      const st = await waitFor(s => s.trace.length > before); const last = st.trace.at(-1);
      assert.equal(last.origin, 'bench-frame-live'); assert.equal(last.type, 'lineup'); assert.equal(last.status, 'accepted', last.message || '');
      assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1))); await snap('lineup-saved');
    });
    await step('lineup: player detail opens the real lineup sheet', async () => { await surface('detail', '[data-lineup-sheet], [data-player]'); await snap('lineup-detail'); });

    // ---- Picks: three fresh picks with long names.
    await step('picks: full page renders the pick move', async () => { await selectGame('picks'); await surface('full', '[data-game-page]'); await snap('picks-full'); });
    await step('picks: real quick editor saves and the server agrees', async () => {
      await surface('quick'); const dialog = preview().getByRole('dialog'); await dialog.waitFor({ timeout: 25000 });
      const picks = dialog.locator('button[data-pick]:not([disabled])'), n = await picks.count(); assert(n >= 3, 'pick editor offers ' + n);
      for (const i of [0, 1, 2]) await picks.nth(i).click();
      const pressed = await picks.evaluateAll(x => x.filter(e => e.getAttribute('aria-pressed') === 'true').length);
      assert.equal(pressed, 3, 'the quick pick editor holds ' + pressed + ' of three picks (fixed 2026-11-12: PickMove.each/picks, castawayIds)');
      const before = (await state()).trace.length; await p.locator('#preview').scrollIntoViewIfNeeded();
      await dialog.getByRole('button', { name: /^Save|^Pick|^Lock/ }).first().click();
      const st = await waitFor(s => s.trace.length > before); const last = st.trace.at(-1);
      assert.equal(last.type, 'pick'); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1))); await snap('picks-saved');
    });

    // ---- Question sheet: a participant answer and a yes/no answer.
    await step('questions: full page shows both open questions', async () => { await selectGame('questions'); await surface('full', '[data-game-page]'); for (const q of ['boot', 'happens']) await preview().locator('[data-question="' + q + '"][data-question-status="open"]').waitFor({ timeout: 20000 }); await snap('questions-open');
      const labels = await preview().locator('[data-question="boot"] button').evaluateAll(x => x.map(e => e.innerText.trim().replace(/\s+/g, ' ')));
      if (new Set(labels).size < labels.length) finding('answer-faces-indistinct', 'Participant answer choices show only the first word of a name, so ' + (labels.length - new Set(labels).size) + ' of ' + labels.length + ' choices read the same (long names sharing a first word; also two contestants with one first name).', 'proof content labels:long, Prediction sheet, Who goes home?');
    });
    await step('questions: answers saved through the real sheet agree with the runtime', async () => {
      const page = preview(), change = page.locator('[data-questions-change]'); if (await change.count()) await change.click();
      for (const q of ['boot', 'happens']) await page.locator('[data-question="' + q + '"] button[aria-pressed="false"]').first().click();
      const before = (await state()).trace.length; await page.locator('[data-sheet-save]').first().click();
      const st = await waitFor(s => s.trace.length >= before + 2); assert(st.trace.slice(before).every(t => t.type === 'answer' && t.status === 'accepted'), JSON.stringify(st.trace.slice(before)));
      assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1))); await snap('questions-saved');
    });
    await step('standings agree after decisions', () => standingsAgree('decisions'));

    // ---- Lock: the clock passes episode 3's airtime (server schedule shifted to match).
    await step('clock past airtime locks the lineup and the questions', async () => {
      await control({ type: 'clock', at: '2099-01-11T13:00:00.000Z' });
      await surface('full', '[data-game-page]'); const status = await preview().locator('[data-question]').evaluateAll(x => x.map(e => e.getAttribute('data-question-status')));
      assert(!status.includes('open'), 'questions still open after airtime: ' + status); await snap('questions-locked');
      await selectGame('lineup'); await surface('full', '[data-game-page]'); await snap('lineup-locked');
    });

    // ---- Results for episode 3, published once; settled in every game.
    const st0 = await state(), exported = await bench('runtime/export?id=' + st0.id), world = exported.execution.state.contexts.show;
    const annBoot = (exported.execution.state.stores.answers.questions || []).find(r => r.playerId === 'ann' && r.question === 'boot')?.answer;
    const exitId = world.participants.find(x => x.id === annBoot) ? annBoot : world.participants.find(x => !world.facts.some(f => f.data.events.some(e => e.castawayId === x.id))).id;
    await step('results for episode 3 publish into every game', async () => {
      await control({ type: 'results', contextId: 'show', eventId: 'show-event-3', source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: exitId, method: 'Voted Out' }], scoringEvents: [{ id: 'proof-moment-1', type: 'rewardWin', castawayId: world.participants.find(x => x.id !== exitId).id }] } });
    });
    await step('Ann reveals episode 3 across all her games (real reveal, runtime agrees)', async () => {
      const before = await state(); await p.locator('#reveal').click(); await preview().locator('[data-beat],[data-stage]').first().waitFor({ timeout: 30000 }); await snap('ann-reveal');
      const st = await waitFor(s => s.people.find(x => x.id === 'ann').seen === 3); assert.equal(st.people.find(x => x.id === 'bo').seen, before.people.find(x => x.id === 'bo').seen);
      assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
    });
    await step('questions settle for Ann: graded right by the server and shown so on the Episodes tab', async () => {
      // The graded sheet's UI lives on the Episodes tab and Tonight's extras (SheetResultRow), which the bench has no
      // surface for yet (Chunk 5); the real /answers response for episode 3 is the server's own grading.
      const st = await state(), cookie = await signIn(app, st.live.users.ann, 'zt-pass-12345');
      const sheet = await (await fetch(app + '/api/seasons/' + st.live.seasonId + '/answers?league=' + st.live.leagues.questions + '&episode=3', { headers: { cookie } })).json();
      const boot = sheet.questions?.find(q => q.id === 'boot'), mine = boot?.people?.find(x => x.you);
      assert(boot && mine, 'no graded boot answer for Ann: ' + JSON.stringify(sheet).slice(0, 300));
      assert.equal(boot.status, 'closed'); assert.equal(mine.right, annBoot === exitId, JSON.stringify(mine));
      // And in the real UI: the Episodes tab's row for episode 3 opens the graded sheet.
      await surface('episodes'); await preview().locator('button[data-ep="3"]').first().click(); await preview().locator('[data-episode-page="3"]').first().waitFor({ timeout: 20000 });
      const row = preview().locator('[data-sheet-result-row="3"]').first(); await row.waitFor({ timeout: 25000 }); await snap('episodes-sheet-row');
      await p.locator('#preview').scrollIntoViewIfNeeded(); await row.scrollIntoViewIfNeeded(); await row.click(); await preview().locator('[data-question="boot"] [data-question-mine]').first().waitFor({ timeout: 20000 });
      assert.equal(await preview().locator('[data-question="boot"] [data-question-mine]').first().getAttribute('data-question-mine'), mine.right ? 'right' : 'wrong'); await snap('episodes-sheet-graded');
    });
    await step('standings agree after results and reveal', () => standingsAgree('results'));

    // ---- Detail for the other two games.
    for (const g of ['picks', 'questions']) await step(g + ': player detail opens from the full game', async () => {
      await selectGame(g); await surface('detail'); await preview().locator('[role="dialog"], [data-sheet-player], [data-lineup-sheet]').first().waitFor({ timeout: 25000 }); await snap(g + '-detail');
    });

    // ---- A server-side rejection through the real UI: the lineup locks while it is being edited.
    await step('lineup locked mid-edit: server and runtime both reject the save', async () => {
      // Opened from the game page's own strip (the bench's Quick action taps the first strip button, which after a reveal can be a recap).
      await selectGame('lineup'); await surface('full', '[data-game-page]'); const strip = preview().locator('[data-game-strip]').first(), kind = await strip.getAttribute('data-game-strip');
      assert.equal(kind, 'move', 'the lineup strip is "' + kind + '", not an open move'); await strip.locator('button').click();
      const dialog = preview().getByRole('dialog'); await dialog.waitFor({ timeout: 25000 });
      const choices = dialog.locator('button[data-starter]:not([disabled])'), n = await choices.count(); assert(n >= 2, 'lineup editor offers ' + n);
      const was = await choices.evaluateAll(x => x.map(e => e.getAttribute('aria-pressed'))); for (let i = 0; i < n; i++) if (was[i] === 'true') await choices.nth(i).click();
      await choices.nth(0).click(); await choices.nth(1).click();
      await control({ type: 'clock', at: '2099-01-12T13:00:00.000Z' }); // episode 4 airs at 12:00
      const before = (await state()).trace.length; await p.locator('#preview').scrollIntoViewIfNeeded(); await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      const st = await waitFor(s => s.trace.length > before); const last = st.trace.at(-1), cmp = st.live.comparisons.at(-1);
      assert.equal(last.status, 'rejected', 'runtime accepted a save after the lock'); assert.equal(cmp.serverOk, false, 'server accepted a save after the lock: ' + JSON.stringify(cmp));
      assert.equal(cmp.agree, true, JSON.stringify(cmp)); await snap('lineup-rejected');
    });

    // ---- Episode 4: partial, an early reveal, final, then a correction.
    const pickOut = async () => { const ex = await bench('runtime/export?id=' + (await state()).id), w = ex.execution.state.contexts.show, gone = new Set(w.facts.filter(f => f.eventId !== 'show-event-4').flatMap(f => f.data.events.map(e => e.castawayId))); return w.participants.filter(x => !gone.has(x.id)).map(x => x.id); };
    const ep4 = (status, outId, rewardId) => control({ type: 'results', contextId: 'show', eventId: 'show-event-4', source: 'provider-fixture', resultStatus: status, data: { events: [{ castawayId: outId, method: 'Voted Out' }], scoringEvents: [{ id: 'proof-moment-4', type: 'rewardWin', castawayId: rewardId }] } });
    const still = await pickOut();
    await step('episode 4 partial results: Ann reveals early, standings agree', async () => {
      await ep4('partial', still[0], still[1]);
      await p.locator('#reveal').click(); await preview().locator('[data-beat],[data-stage]').first().waitFor({ timeout: 30000 }); await snap('ann-reveal-early');
      const st = await waitFor(s => s.people.find(x => x.id === 'ann').seen === 4); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      await standingsAgree('partial');
    });
    await step('episode 4 final results: standings agree', async () => { await ep4('final', still[0], still[1]); await standingsAgree('final'); });
    await step('episode 4 corrected (a different exit): standings agree', async () => { await ep4('corrected', still[2], still[1]); await standingsAgree('corrected'); });

    // ---- Bo, a week behind: his own view, then one reveal.
    await step('Bo sees catch-up views and his questions wait', async () => {
      await selectViewer('bo'); await surface('full', '[data-game-page]'); const status = await preview().locator('[data-question]').evaluateAll(x => x.map(e => e.getAttribute('data-question-status')));
      assert(!status.includes('open'), 'Bo, behind, has open questions: ' + status); await snap('bo-questions');
    });
    await step("Bo's moves sheet names his own episode, open until he reveals it (fixed 2026-11-12)", async () => {
      // In its own tab, on the same case and real routes (the bench iframe's state after a long journey isn't the point).
      const st = await state(), bo = st.people.find(x => x.id === 'bo');
      const sel = await bench('runtime/select', { id: st.id, viewerId: 'bo', gameId: 'lineup', surface: 'full', theme: 'night' });
      const tab = await p.context().newPage(); await tab.setViewportSize({ width: 390, height: 844 });
      try {
        await tab.goto(sel.frame.url, { waitUntil: 'networkidle', timeout: 45000 }); await tab.waitForTimeout(800);
        const strip = tab.locator('[data-game-strip]').first(); assert.equal(await strip.getAttribute('data-game-strip'), 'move', 'no open move for Bo');
        await strip.locator('button').click(); await tab.waitForTimeout(1200);
        const change = tab.getByRole('button', { name: /Change your lineup|Set your lineup/ });
        if (await change.count()) { await change.first().click(); await tab.waitForTimeout(1200); }
        const text = (await tab.getByRole('dialog').allInnerTexts()).map(t => t.replace(/\s+/g, ' ')).find(t => /YOUR MOVES/i.test(t)) || '';
        assert.match(text, new RegExp('Episode ' + (bo.seen + 1) + ' · change it until you reveal it'), text.slice(0, 160));
        assert.match(text, /Revealing the episode does\./, 'the footer still says airtime locks it');
        await tab.screenshot({ path: path.join(out, String(++shot).padStart(2, '0') + '-bo-moves-sheet.png') });
        // Squeezed cards (the original finding): every visible choice keeps a usable width.
        const narrow = await tab.getByRole('dialog').locator('button[data-starter], button[data-pick]').evaluateAll(x => x.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.width < 64; }).length);
        assert.equal(narrow, 0, narrow + ' choices narrower than 64px');
      } finally { await tab.close(); }
      await selectViewer('bo');
    });
    await step('Bo reveals one episode; Ann keeps her mark', async () => {
      const annBefore = (await state()).people.find(x => x.id === 'ann').seen; await p.locator('#reveal').click(); await preview().locator('[data-beat],[data-stage]').first().waitFor({ timeout: 30000 }); await snap('bo-reveal');
      const st = await waitFor(s => s.people.find(x => x.id === 'bo').seen === 2); assert.equal(st.people.find(x => x.id === 'ann').seen, annBefore); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
    });
    await step('standings agree at the end', () => standingsAgree('end'));
    const st = await state(); fs.writeFileSync(path.join(out, 'comparisons.json'), JSON.stringify(st.live?.comparisons || [], null, 2));
  } finally {
    const report = { ok: steps.every(s => s.ok), steps, findings, errors: b.errors, scope: 'scoped interaction checks on real routes; no design review or matrix pass' };
    fs.writeFileSync(path.join(out, 'proof-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ok: report.ok, passed: steps.filter(s => s.ok).length, failed: steps.filter(s => !s.ok).map(s => s.name), findings: findings.map(f => f.id), errors: b.errors.slice(0, 8) }));
    if (!report.ok) process.exitCode = 1;
    await b.close();
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
