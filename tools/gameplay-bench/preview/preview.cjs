// A game's preview, made by the bench for any definition it runs, with no one driving it (docs/PLAN-game-preview.md, "The bench's
// previews"). It opens the definition in the explorer's runtime, materializes it on the live tier (zt-gb- rows in the app's own
// database, the real routes), plays the season moment by moment with every seat's moves the computer players' (players.cjs, E1),
// and at each moment shoots the app's real screens as the viewer at 390 x 844, with where each screen proves the moment and any
// words it says that the season contradicts. It writes preview.json (the game, its moments, their screens and checks, and the
// production views the story's cards read) beside the shots, and returns it.
//
// The moments come from what the game has, read from its own state and views (a draft at the start, a weekly move, results, a
// stage's new draft, someone out, the finale), never one template; the screens are the app's own routes, the same for every game.
//
// The truth check, at every moment: what's due for the viewer as the engine knows it (actionItems on the server's own state, plus
// a sheet's open questions from the projection) against what Tonight's strip and the Games tab say; the standings a screen shows
// against the season's; and the known word checks. A screen that disagrees carries the bug in plain words ("App bug: says 'All
// set', but your draft is due"). The routes' writes are api-checks' job, run at the end.
//
// Called the same way from the CLI (scripts/gameplay-bench.js preview), HTTP (POST /__atlas/bench/preview) and the browser
// transport (window.__GAMEPLAY_EXPLORER__.preview). Needs a running app (`app`, default this lane's) on a local database the live
// tier can write (AUTH_DATABASE_URL); every row is the case's own and is removed at the end (`keep` leaves it).
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..', '..');
const R = require('../explorer/runtime.cjs');
const Data = require('../explorer/runtime-data.cjs');
const { resultsData } = require('../explorer/publish.cjs');
const S = require(path.join(root, 'src/lib/game/state-logic.js'));
const { actionItems, runnerItems } = require(path.join(root, 'src/lib/game/action-items.js'));
const Players = require('./players.cjs');
const { atClock } = require('./clock.cjs');

const W = 390, H = 844, HOUR = 3600000;
// Faces chosen in profile, from the palette (src/lib/people.ts PALETTE: Sage, Rose, Lake, Orchid), so a couch's colours never clash.
const PALETTE = ['#8db85e', '#e86f9a', '#5089c9', '#a76bb0', '#f2804b', '#cfc8bb'];
// What a due move is called on a mark (the preview's own words).
const NOUN = { draftStart: 'starting the draft (it waits for you)', blindDraft: 'your draft', draftTurn: 'your draft pick', lineup: 'your lineup', pick: 'your pick', prediction: 'a prediction', questions: 'your answers', waiver: 'a waiver claim', lateJoin: 'where you start' };
const fmt = (n) => String(Math.round(n * 10) / 10);
const copy = (x) => JSON.parse(JSON.stringify(x));

// The season's walk and its draft helpers are shared with the live preview (season.cjs).
const { walk, draftOpenAtStart, draftOpenLater, teamsOf, isBlind } = require('./season.cjs');

async function make(o) {
  const t0 = Date.now(), steps = [], log = o.log || (() => {});
  let since = t0;
  const lap = (step) => { const now = Date.now(); steps.push({ step, ms: now - since }); since = now; };
  process.env.BASE = o.app || process.env.BASE || 'http://localhost:3014';
  const BASE = process.env.BASE;
  const Live = require('../live-db.cjs');
  const { open, api } = require(path.join(root, 'scripts/dev-test/browser.js'));
  const out = path.resolve(o.out);
  const shotsDir = path.join(out, 'shots');
  fs.mkdirSync(shotsDir, { recursive: true });

  const s = R.open(o.input);
  const { doc, viewer, top, stages, playable, ctxId, people, couch, seed, events, markOf, first, last, results, must, night, views, over } = walk(s, o);

  const ids = await Live.up(s.snapshot(), doc, o.db || undefined);
  lap('materialize');
  // The season's times moved to now, exactly (the app's now is the runtime's clock: rounding it, even to the hour, moved what the
  // engine counts as due and was tried and dropped, 2026-11-18; the screens' times are when the preview was made).
  const shift = (snap) => Date.now() - Date.parse(snap.clock);
  const sync = async (snap = s.snapshot()) => { s.calendar?.(shift(snap)); await Live.sync(ids, snap, doc, shift(snap)); };
  const as = {};
  const call = async (who, method, url, body) => { as[who] ||= await api({ user: ids.users[who].username, pass: Live.PASSWORD }); return as[who].call(method, url, body); };
  const league = (g) => ids.leagues[g], season = ids.seasons[ctxId].id;
  const page = (g) => `/show/${season}/game/${league(g)}`, tonight = `/show/${season}/tonight`, games = `/show/${season}/games`, room = (g) => `/show/${season}/blind?game=${league(g)}`;
  const moments = [], checks = [];
  let b = null, p = null;
  try {
    await sync();
    for (const [i, pid] of people.entries()) {
      const r = await call(pid, 'PUT', '/api/me/profile', { colour: PALETTE[i % PALETTE.length] });
      if (r.status !== 200) throw Error(`${pid}'s colour wasn't saved (${r.status})`);
    }
    b = await open({ user: ids.users[viewer].username, pass: Live.PASSWORD, width: W, height: H, motion: 'reduce' });
    p = b.page;
    await p.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important}'; document.head.appendChild(st); }));
    lap('sign in');

    // ---- On a screen ----
    const timing = process.env.PREVIEW_TIMING === '1';
    const go = async (url, ready) => {
      const g0 = Date.now(), tick = (what) => timing && log(`    ${what} ${Date.now() - g0} ms · ${url.replace(/[0-9a-f-]{36}/g, ':id')}`);
      await p.goto(BASE + url, { waitUntil: 'domcontentloaded' }).catch(async (e) => { if (!/ERR_ABORTED|frame was detached/.test(e.message)) throw e; await p.waitForTimeout(2000); await p.goto(BASE + url, { waitUntil: 'domcontentloaded' }); });
      tick('loaded');
      if (ready) await p.locator(ready).first().waitFor({ timeout: 60000 });
      tick('ready');
      // A page with a move due keeps polling, so the network never goes quiet: a short wait, the page's own ready mark is the real one.
      await p.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
      tick('quiet');
      await p.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 8000 }).catch(() => {});
      tick('fonts');
      await p.waitForTimeout(500);
    };
    const dialog = () => p.locator('[role="dialog"]:not([aria-hidden="true"])').last();
    const onScreen = (x) => x && x.w > 0 && x.h > 0 && x.y < H && x.y + x.h > 0;
    const boxesOf = async (sel, { union = false, max = 6 } = {}) => {
      const all = await p.locator(sel).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })).catch(() => []);
      const vis = all.filter(onScreen).slice(0, max);
      if (!union || vis.length < 2) return vis;
      const x0 = Math.min(...vis.map((v) => v.x)), y0 = Math.min(...vis.map((v) => v.y));
      return [{ x: x0, y: y0, w: Math.max(...vis.map((v) => v.x + v.w)) - x0, h: Math.max(...vis.map((v) => v.y + v.h)) - y0 }];
    };
    const textBoxes = async (text, exact = false) => (await p.getByText(text, { exact }).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })).catch(() => [])).filter(onScreen).slice(0, 6);
    let moment = null;
    /** The screen as the phone shows it, `focus` scrolled to its top; where it proves the moment; what it says the season doesn't. */
    const shoot = async (id, name, what, { focus, proof, bugs } = {}) => {
      if (focus) {
        const el = p.locator(focus).first();
        if (await el.count()) { await el.evaluate((e) => { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -16); }); await p.waitForTimeout(700); }
      }
      const file = `${moment.id}-${id}.jpg`;
      await p.screenshot({ path: path.join(shotsDir, file), type: 'jpeg', quality: 80 });
      const found = [];
      for (const check of bugs || []) { const x = await check(); if (x) found.push(x); }
      const stripEl = p.locator('[data-strip]').first();
      const strip = (await stripEl.count()) ? { tone: await stripEl.getAttribute('data-strip'), title: ((await stripEl.locator('[data-strip-title]').first().textContent({ timeout: 300 }).catch(() => null)) || '').trim() } : null;
      const screen = { id, name, file, what, url: p.url().replace(BASE, '').replace(/[0-9a-f-]{36}/g, ':id'), proof: proof ? await proof() : [], bugs: found, ...(strip ? { strip } : {}) };
      moment.screens.push(screen);
      log(`  ${moment.id} · ${name}${found.length ? ' · ' + found.map((x) => x.text).join(' · ') : ''}`);
      return screen;
    };

    // ---- What's due: the engine against the screen ----
    /** What's due for the viewer now, as the engine knows it: actionItems on each game's state as the server holds it (the screens'
     *  state: a draft reopened, the draft room's own writes), at the season's own clock (the runtime's: the state keeps the season's
     *  own times, the screens show them moved to now); for a viewer who runs the game, its runnerItems too (a draft with no time set
     *  waits for them to start it: docs/design-round/draft-start-spec.md); and a sheet's open questions from the projection (the
     *  kind actionItems leaves out). */
    const engineDue = async () => {
      const real = await Live.read(ids), clock = s.snapshot().clock, items = [];
      for (const g of playable) {
        const st = real.states.get(league(g.id));
        if (!st) continue;
        const me = real.members.find((m) => m.league_id === league(g.id) && m.player_id === viewer);
        for (const it of atClock(clock, () => actionItems(st, viewer, me?.results_seen_through ?? null))) if (!it.who || it.who === 'you') items.push({ game: g.id, kind: it.kind, text: it.text, deadline: it.deadline ?? null });
        if (me?.role === 'commissioner') for (const it of atClock(clock, () => runnerItems(st))) items.push({ game: g.id, kind: it.kind, text: it.text, deadline: null });
        const open = (s.project(g.id, viewer).questions || []).filter((q) => !q.closed && (q.mine === null || q.mine === undefined));
        if (open.length) items.push({ game: g.id, kind: 'questions', text: `${open.length} question${open.length > 1 ? 's' : ''} open`, deadline: null });
      }
      return items;
    };
    /** The due strip on this screen (Tonight's, the Games tab's) against the engine: a move due when one is, all set when none is. */
    const dueCheck = (due) => async () => {
      const strip = p.locator('[data-strip]').first();
      if (!(await strip.count())) return null;
      const tone = await strip.getAttribute('data-strip');
      const title = ((await strip.locator('[data-strip-title]').first().textContent({ timeout: 300 }).catch(() => null)) || (await strip.innerText()).split('\n')[0] || '').trim();
      const says = tone === 'due' || tone === 'waits';
      const boxes = await boxesOf('[data-strip]', { max: 1 });
      checks.push({ moment: moment.id, check: 'due', engine: due.map((d) => d.kind), screen: { tone, title }, agree: says === due.length > 0 });
      if (due.length && !says) return { kind: 'due', text: `App bug: says “${title}”, but ${NOUN[due[0].kind] || 'a move'} is due`, boxes };
      if (!due.length && tone === 'due') return { kind: 'due', text: `App bug: asks for a move (“${title}”), but nothing's due`, boxes };
      return null;
    };
    /** The standings on a game page against the season's (the viewer's own view of that game). */
    const standingsCheck = (gameId) => async () => {
      const rows = await p.locator('[data-game-grid] [data-restack]').evaluateAll((els) => {
        const by = {};
        for (const e of els) { const id = e.getAttribute('data-restack'); (by[id] ||= []).push(e); }
        return Object.entries(by).map(([id, list]) => ({ id, total: (list[list.length - 1].querySelector('b')?.textContent || '').trim() }));
      }).catch(() => []);
      if (!rows.length) return null;
      const table = s.project(gameId, viewer).game.table;
      const wrong = rows.filter((r) => { const t = table.find((x) => x.playerId === r.id); const n = Number(r.total.replace('−', '-')); return t && Number.isFinite(n) && Math.abs(n - t.total) > 1e-9; });
      checks.push({ moment: moment.id, check: 'standings', agree: !wrong.length });
      if (!wrong.length) return null;
      const t = table.find((x) => x.playerId === wrong[0].id);
      return { kind: 'standings', text: `App bug: shows ${t.name} on ${wrong[0].total}, but the season has ${fmt(t.total)}`, boxes: await boxesOf(`[data-game-grid] [data-restack="${wrong[0].id}"]`, { union: true }) };
    };
    /** Your team's numbers against your score: what the screen lists (each castaway's points for you, and any predictions) must add up
     *  to your total in the season. */
    const teamCheck = (gameId) => async () => {
      const v = s.project(gameId, viewer).game;
      if (!v.you?.team?.length || !(await p.locator('[data-your-team]').count())) return null;
      const shown = await p.locator('[data-your-team] [data-team-points]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-team-points')))).catch(() => []);
      const sum = shown.length ? shown.reduce((t, n) => t + (Number.isFinite(n) ? n : 0), 0) : v.you.team.reduce((t, id) => t + (v.cast.find((c) => c.id === id)?.points ?? 0), 0);
      const agree = Math.abs(sum - v.you.total) < 0.051;
      checks.push({ moment: moment.id, check: 'team', agree });
      return agree ? null : { kind: 'team', text: `App bug: “Your team” adds up to ${fmt(sum)}, but you scored ${fmt(v.you.total)}`, boxes: await boxesOf('[data-your-team]', { max: 1 }) };
    };
    /** A "still in" count of nobody, in a game section. */
    const stillInCheck = async () => { const x = await textBoxes(/\b0 of 0 still in/); return x.length ? { kind: 'words', text: 'App bug: says “0 of 0 still in”, in a game nobody’s knocked out of', boxes: x.slice(0, 2) } : null; };

    // ---- The moments ----
    // A moment: which game it's about, its episode and when that airs, and the live tier's shift (the screens show the season's times
    // moved to now: the card adds the shift, so its words and the screen's agree).
    const begin = (id, kind, episode = null, gameId = top.id) => {
      const e = episode ? events().find((x) => x.number === episode) : null;
      moment = { id, kind, episode, game: gameId, airAt: e?.airAt ?? null, shift: shift(s.snapshot()), screens: [] };
      moments.push(moment);
      return moment;
    };
    const finish = () => { moment.views = views(); };

    // A draft the game opens with, run in the real room, on the app's path: Tonight before it starts (whoever runs the game has it to
    // start, everyone else sees it waiting: the due check against the engine's runnerItems), then the room, started by the viewer's own
    // Start if they run it (else by whoever does, on the route); the couch lock in (their teams the runtime's), the viewer's room is
    // shot waiting on them, then they lock in too and the room is shot revealed; the server's teams are compared with the runtime's.
    const draftRoom = async (gameId, want, label) => {
      const before = await engineDue();
      await go(tonight, '[data-strip]');
      await shoot('tonight', 'Tonight', `${label}: Tonight, before the draft starts`, { proof: () => boxesOf('[data-strip]', { max: 1 }), bugs: [dueCheck(before)] });
      await go(room(gameId), '[data-draft]');
      const start = p.locator('[data-draft-start]').first();
      const runs = before.some((d) => d.kind === 'draftStart' && d.game === gameId);
      const hasStart = (await start.count()) > 0;
      checks.push({ moment: moment.id, check: 'start', agree: runs === hasStart });
      moment.startMissing = runs && !hasStart;
      if (hasStart) { await start.click(); await p.waitForTimeout(2000); }
      else {
        const r = await call(people[0], 'POST', `/api/seasons/${season}/draft`, { leagueId: league(gameId), action: 'start' });
        if (r.status !== 200) throw Error(`The draft couldn't start (${r.status}): ${JSON.stringify(r.body).slice(0, 200)}`);
      }
      for (const pid of couch) {
        const r = await call(pid, 'POST', `/api/leagues/${league(gameId)}/draft/blind/lock`, { playerId: pid, castawayIds: want[pid] });
        if (r.status !== 200) throw Error(`${pid} couldn't lock in (${r.status}): ${JSON.stringify(r.body).slice(0, 200)}`);
      }
      await go(room(gameId), '[data-draft]');
      await shoot('room', 'Draft room', `${label}: the draft room, the couch locked in, yours to make`, { proof: () => textBoxes(/Nobody sees until|Choose \d+/), bugs: [async () => (moment.startMissing ? { kind: 'start', text: 'App bug: Tonight says “Start the draft”, but the draft room has no Start', boxes: [] } : null)] });
      const r = await call(viewer, 'POST', `/api/leagues/${league(gameId)}/draft/blind/lock`, { playerId: viewer, castawayIds: want[viewer] });
      if (r.status !== 200) throw Error(`The viewer couldn't lock in (${r.status})`);
      const real = (await Live.read(ids)).states.get(league(gameId));
      checks.push({ moment: moment.id, check: 'draft', agree: JSON.stringify(teamsOf(real)) === JSON.stringify(want) && !!real.blindDraft?.revealedAt });
      await go(room(gameId), '[data-draft]');
      await shoot('teams', 'The teams', `${label}: the teams, revealed`, { proof: () => textBoxes(`×${people.length}`, true) });
    };

    // 1. The game: where it lives, and how it plays (what it is, how you win).
    begin('game', 'game');
    const blindFirst = [top, ...stages].find((g) => { const st = s.snapshot().games[g.id]?.state; return isBlind(st) && S.BlindDraftLogic.isRevealed(st) && st.castaways.some((x) => x.ownerIds.length); });
    const want1 = blindFirst ? teamsOf(s.snapshot().games[blindFirst.id].state) : null;
    if (blindFirst) await sync(draftOpenAtStart(s.snapshot(), blindFirst.id));
    let due = await engineDue();
    await go(games, '[id^="game-"]');
    await shoot('games', 'Games', 'The Games tab: the new game', { proof: () => boxesOf('[id^="game-"]', { max: 1 }), bugs: [dueCheck(due)] });
    await go(page(top.id), '[data-game-page]');
    await shoot('rules', 'How it plays', 'The game page: how it plays', { focus: '[data-game-rules]', proof: () => boxesOf('[data-game-short]', { max: 1 }) });
    finish();
    lap('the game');

    // 2. The draft it opens with (a blind draft: the real room).
    if (blindFirst) {
      begin('draft', 'draft', first, blindFirst.id);
      await draftRoom(blindFirst.id, want1, 'The draft');
      await sync();
      finish();
      lap('the draft');
    }

    // 3. Each episode's move, if the game has one: Tonight's strip and the quick action it opens, before the viewer moves.
    Players.play(s, couch, seed);
    await sync();
    due = await engineDue();
    const weekly = due.some((d) => ['lineup', 'pick', 'questions', 'prediction'].includes(d.kind));
    if (weekly) {
      begin('week', 'week', first, due.find((d) => ['lineup', 'pick', 'questions', 'prediction'].includes(d.kind))?.game || top.id);
      await go(tonight, '[data-strip]');
      await shoot('tonight', 'Tonight', `Tonight before ${first}: the move and its lock`, { proof: () => boxesOf('[data-strip]', { max: 1 }), bugs: [dueCheck(due)] });
      const button = p.locator('[data-strip] button').first();
      if (await button.count()) {
        await button.click();
        await dialog().waitFor({ timeout: 20000 }).catch(() => {});
        await p.waitForTimeout(1200);
        await shoot('move', 'Your move', 'The quick action Tonight opens', { proof: async () => (await dialog().getByText(/^(Who |Start \d|Pick |Answer |Choose |Does |Will )/).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })).catch(() => [])).filter(onScreen).slice(0, 1) });
      }
      finish();
      lap('the weekly move');
    }
    Players.play(s, [viewer], seed);
    await sync();

    // 4. After the first results, and on through the season: each later stage's draft as it opens, someone out, the finale.
    let firstAfter = true, outShown = false;
    for (let n = first; n <= last && !over(); n++) {
      const finale = n === last;
      if (n > first) { Players.play(s, people, seed); }
      const before = s.snapshot();
      night(n, finale ? couch : people);
      const after = s.snapshot();
      if (finale) break;
      // A later stage's blind draft the night's results opened (the runtime deals it: here it opens in the real room).
      const opened = stages.find((g) => { const a = after.games[g.id]?.state, z = before.games[g.id]?.state; return isBlind(a) && a.castaways.some((x) => x.ownerIds.length) && z && !z.castaways.some((x) => x.ownerIds.length); });
      if (firstAfter) {
        await sync(opened ? draftOpenLater(before, after, doc, opened.id) || undefined : undefined);
        const stage = stages.find((g) => { const v = s.project(g.id, viewer).game; return v.from !== null && v.from <= n && (v.to === null || v.to >= n); }) || top;
        begin('after', 'after', n, stage.id);
        await go(page(stage.id), '[data-game-page]');
        await shoot('page', 'Game page', `The game page after ${n}`, { focus: '[data-game-grid]', proof: () => boxesOf(`[data-game-grid] [data-restack="${viewer}"]`, { union: true }), bugs: [standingsCheck(stage.id)] });
        // Further down the same page, your own team: what each scored for you, which must add up to your total (the team check).
        if (await p.locator('[data-your-team]').count()) await shoot('team', 'Your team', `Your team after ${n}: what each scored for you`, { focus: '[data-your-team]', proof: () => boxesOf('[data-your-team]', { max: 1 }), bugs: [teamCheck(stage.id)] });
        await go(tonight, '[data-strip]');
        await shoot('tonight', 'Tonight', `Tonight after ${n}: the game's section`, { focus: '[data-game-mini]', proof: () => boxesOf('[data-game-mini]', { max: 1 }), bugs: [stillInCheck] });
        finish();
        lap('after the first results');
        firstAfter = false;
      }
      if (opened) {
        const open = draftOpenLater(before, after, doc, opened.id);
        if (open) {
          await sync(open);
          begin('stage', 'stage', n + 1, opened.id);
          await draftRoom(opened.id, teamsOf(after.games[opened.id].state), 'The next stage');
          finish();
          lap('a stage changes');
        }
      }
      await sync();
      // Someone knocked out (a pool, lives): the first time the viewer is.
      const you = s.project(top.id, viewer).game.you;
      if (!outShown && you && (you.out || you.record?.alive === false || you.alive === false)) {
        begin('out', 'out', n);
        await go(page(top.id), '[data-game-page]');
        await shoot('page', 'Game page', `The game page: out after ${n}`, { proof: () => textBoxes(/\bOut\b|knocked out|You're out|You’re out/) });
        finish();
        outShown = true;
        lap('someone out');
      }
    }

    // 5. The finale: the couch has watched; the viewer reveals it on the real reveal, then the game page.
    await sync();
    begin('finale', 'finale', last);
    const winner = () => { const t = s.project(top.id, people.find((x) => x !== viewer) || viewer).game.table.slice().sort((a, c) => c.total - a.total); return t[0]; };
    await go(tonight, '[data-ask-line], [data-progress-reveal], [data-strip]');
    // Where you meet the finale: Tonight, its results waiting for you.
    await shoot('tonight', 'Tonight', 'Tonight at the finale: its results waiting for you', { proof: () => boxesOf('[data-ask-line], [data-progress-reveal], [data-progress-watched]', { max: 1 }) });
    const ask = p.locator('[data-ask-yes], [data-progress-reveal], [data-progress-watched]').first();
    if (await ask.count()) {
      await ask.click();
      await dialog().waitFor({ timeout: 20000 }).catch(() => {});
      await p.waitForTimeout(1200);
      for (let k = 0; k < 16; k++) {
        const beat = dialog().locator('[data-beat]').last();
        if (await beat.isVisible().catch(() => false)) {
          if ((await beat.getAttribute('data-beat')) === 'table') {
            await p.waitForTimeout(2000);
            const rows = await p.locator('[data-table-move] > div').evaluateAll((els) => els.map((e) => ({ name: e.querySelector('b')?.textContent || '', total: Number(([...e.querySelectorAll('span')].pop()?.textContent || '').replace('−', '-')), y: e.getBoundingClientRect().y })).sort((a, c) => a.y - c.y)).catch(() => []);
            const w = winner();
            const game = s.project(top.id, people.find((x) => x !== viewer) || viewer).game.table.slice().sort((a, c) => c.total - a.total);
            const me = doc.world.people.find((x) => x.id === viewer)?.name;
            const here = rows.findIndex((r) => r.name === me) + 1, there = game.findIndex((r) => r.playerId === viewer) + 1;
            const differs = rows.length && (rows.some((r, i) => r.name !== game[i]?.name) || rows.some((r) => { const t = game.find((x) => x.name === r.name); return t && Number.isFinite(r.total) && Math.abs(t.total - r.total) > 1e-9; }));
            const ord = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
            await shoot('reveal', 'Reveal', 'The finale’s reveal: where everyone finished', { bugs: [async () => (!differs || !w ? null : { kind: 'reveal', text: rows[0]?.name !== w.name ? `App bug: the reveal puts ${rows[0].name} 1st, but ${w.name} wins the game` : here && there && here !== there ? `App bug: the reveal shows one stage, where you’re ${ord(here)}; in the game you finished ${ord(there)}` : 'App bug: the reveal shows one stage’s points, not the game’s', boxes: await boxesOf('[data-table-move]', { max: 1 }) })] });
            break;
          }
          await beat.click(); await p.waitForTimeout(1400);
        } else {
          const yes = dialog().locator(':is([data-watched-yes], [data-step-guard-yes], button:has-text("Reveal"))').last();
          if (!(await yes.isVisible().catch(() => false))) break;
          await yes.click(); await p.waitForTimeout(2000);
        }
      }
    }
    s.apply({ type: 'reveal', contextId: ctxId, personId: viewer }, 'preview');
    await sync();
    await go(page(top.id), '[data-game-page]');
    const topTwo = s.project(top.id, viewer).game.table.slice().sort((a, c) => c.total - a.total).slice(0, 2).map((r) => r.playerId);
    await shoot('page', 'Game page', 'The game page, the season over', { proof: async () => (await Promise.all(topTwo.map((id) => boxesOf(`[data-game-grid] [data-restack="${id}"]`, { union: true })))).flat() });
    finish();
    lap('the finale');

    // The routes against the runtime, for this case (api-checks.cjs): its own findings, kept beside the screens'.
    const problems = (await require('../api-checks.cjs').checkCase({ app: BASE, ids, snap: s.snapshot(), document: doc, project: (g, pp) => s.project(g, pp) })).map((x) => x.signature + (x.message ? ': ' + x.message : ''));
    lap('route checks');
    const v0 = s.project(top.id, viewer).game;
    const preview = {
      schemaVersion: 1,
      id: o.id || path.basename(out),
      madeAt: new Date().toISOString(),
      source: 'tools/gameplay-bench/preview/preview.cjs: the explorer runtime on the live tier, the real screens as the viewer at 390; every result after the viewer’s mark made up',
      app: BASE,
      game: { id: top.id, name: top.name || v0.name, short: v0.short, rules: v0.rules, stages: stages.map((g) => ({ id: g.id, name: s.project(g.id, viewer).game.name })) },
      viewer,
      people: doc.world.people.map((x, i) => ({ id: x.id, name: x.name, colour: PALETTE[i % PALETTE.length] })),
      first,
      last,
      seed,
      moments,
      checks,
      problems,
      ms: Date.now() - t0,
      steps,
    };
    if (o.seasons) preview.seasons = typical(o.input, o.seasons, seed, results, viewer);
    fs.writeFileSync(path.join(out, 'preview.json'), JSON.stringify(preview));
    return preview;
  } finally {
    if (b) await b.close().catch(() => {});
    if (o.keep) log(`kept zt-gb-${ids.key}`);
    else await Live.down(ids.key, o.db || undefined).catch((e) => log('could not remove zt-gb-' + ids.key + ': ' + e.message));
    await Live.close();
    s.dispose();
  }
}

/** What's typical: `n` more seasons of the same game played headless the same way (its players' moves, its results), each one's end
 *  standings per game (the story counts them with the game's own rules). */
function typical(input, n, seed, results, viewer) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const sd = (Number(seed) || 1) * 1000 + i;
    const s = R.open({ ...copy(input), seed: sd });
    try {
      const doc = s.export().input, top = doc.games.find((g) => g.stageOf === undefined), ctxId = top.contextId, people = doc.world.people.map((p) => p.id);
      const events = s.snapshot().contexts[ctxId].events, first = (doc.situation.marks.find((m) => m.personId === viewer)?.through ?? 0) + 1, last = Math.max(...events.map((e) => e.number));
      for (let k = first; k <= last && !s.project(top.id, viewer).game.over; k++) {
        Players.play(s, people, sd);
        const e = s.snapshot().contexts[ctxId].events.find((x) => x.number === k);
        s.apply({ type: 'clock', at: new Date(Math.max(Date.parse(s.snapshot().clock), Date.parse(e.airAt) + 2 * HOUR)).toISOString() });
        const r = s.apply({ type: 'results', contextId: ctxId, eventId: e.id, source: 'provider-fixture', resultStatus: 'final', data: results(s, k) });
        if (r.status !== 'accepted') break;
        for (const p of people) s.apply({ type: 'reveal', contextId: ctxId, personId: p });
      }
      out.push({ seed: sd, tables: Object.fromEntries(doc.games.map((g) => [g.id, s.project(g.id, viewer).game.table])) });
    } catch (e) {
      out.push({ seed: sd, error: String(e.message || e).slice(0, 200) });
    } finally { s.dispose(); }
  }
  return out;
}

module.exports = { make, typical, _h: { draftOpenAtStart, draftOpenLater } };
