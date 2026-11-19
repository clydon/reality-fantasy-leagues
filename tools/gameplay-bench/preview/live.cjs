// A game's preview made on demand, with no browser and no screenshots (docs/PLAN-game-preview.md, "On demand"). The explorer's
// runtime plays the made-up season, every seat's moves the computer players' (players.cjs, E1), the same walk as the bench's
// screenshot preview (season.cjs). Each state a moment's screens show is written as its own temporary copy of the game on the live
// tier (live-db.cjs: zt-gb- rows, the app's real routes), every copy sharing one set of people, so one sign-in sees them all. A
// state a real room's writes make (a draft started, the couch locked in) is made by those writes, on the real routes, as the people
// who make them. Returns the moments with each screen's copy, address, focus and proof (what the card's line points at); the story
// draws each screen live (src/new/preview/story.tsx), signed in as the preview's viewer on the preview host. `down(made)` removes
// every copy.
//
// Needs a running app (`app`, default this lane's) on a local database the live tier can write (AUTH_DATABASE_URL). Development only,
// as the live tier is (it refuses a database that isn't local): the plan's "On demand" says what production needs.
const path = require('path');
const R = require('../explorer/runtime.cjs');
const Live = require('../live-db.cjs');
const Players = require('./players.cjs');
const { walk, draftOpenAtStart, draftOpenLater, teamsOf, isBlind } = require('./season.cjs');
const S = require(path.join(path.resolve(__dirname, '..', '..', '..'), 'src/lib/game/state-logic.js'));
const { typical } = require('./preview.cjs');

const PALETTE = ['#8db85e', '#e86f9a', '#5089c9', '#a76bb0', '#f2804b', '#cfc8bb'];
const copy = (x) => JSON.parse(JSON.stringify(x));

/** Signed in as `user` on the app (the bench's own sign-in: its people share one password), for writes on the real routes. */
async function signIn(app, user) {
  const r = await fetch(app + '/api/auth/sign-in/username', { method: 'POST', headers: { 'content-type': 'application/json', origin: app }, body: JSON.stringify({ username: user, password: Live.PASSWORD }) });
  if (!r.ok) throw Error(`sign-in as ${user} failed: ${r.status} ${await r.text()}`);
  const cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  return async (method, url, body) => {
    const res = await fetch(app + url, { method, headers: { cookie, origin: app, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body: json ?? text };
  };
}

/**
 * Make a live preview. `o.input`: a v2 definition (scripts/dev-test/preview-proof.js definition); `o.viewerId` (default the
 * definition's viewer: the couch's owner, who runs the game); `o.app`; `o.db`; `o.resultsFor` (made-up results after the viewer's
 * mark); `o.seasons` (made-up seasons for what's typical, default 5; 0 for none); `o.log`.
 */
async function make(o) {
  const t0 = Date.now(), log = o.log || (() => {}), steps = [];
  let since = t0;
  const lap = (step) => { const now = Date.now(); steps.push({ step, ms: now - since }); since = now; };
  const app = o.app || process.env.BASE || 'http://localhost:3014';
  const s = R.open(o.input);
  const w = walk(s, o);
  const { doc, viewer, top, stages, ctxId, people, couch, seed, events, first, last, night, views, over } = w;
  const states = []; // { snap, writes?: async (made) => void }
  const moments = [];
  const stateOf = (snap, writes) => { states.push({ snap: copy(snap), writes }); return states.length - 1; };
  let moment = null;
  const begin = (kind, episode = null, gameId = top.id) => {
    const e = episode ? events().find((x) => x.number === episode) : null;
    moment = { id: kind + (moments.filter((m) => m.kind === kind).length ? moments.filter((m) => m.kind === kind).length + 1 : ''), kind, episode, game: gameId, airAt: e?.airAt ?? null, screens: [], views: views() };
    moments.push(moment);
  };
  // A screen: which copy (state) it shows, its address in that copy (filled once the copy is written), where to scroll, what to ring.
  // (`ring`: what the card points at on it, found live on the page; `proof` and `bugs` stay empty, the screenshot preview's.)
  const screen = (id, name, state, where, focus = null, ring = null) => moment.screens.push({ id, name, state, where, focus, ring, proof: [], bugs: [] });
  const league = (made, g) => made.leagues[g];
  const where = {
    tonight: (made, q = '') => `/show/${made.season}/tonight${q}`,
    games: (made) => `/show/${made.season}/games`,
    page: (g) => (made) => `/show/${made.season}/game/${league(made, g)}`,
    room: (g) => (made) => `/show/${made.season}/blind?game=${league(made, g)}`,
  };

  // A blind draft's three states on the app's path: open before it starts (Tonight: the runner's Start the draft, or everyone else's
  // wait), started with the couch locked in (the room, yours to make: the real routes' writes), revealed (the teams: the runtime's).
  const draftStates = (open, dealt, gameId) => {
    const want = teamsOf(dealt.games[gameId].state);
    const started = stateOf(open, async (made, as) => {
      const r = await (await as(people[0]))('POST', `/api/seasons/${made.season}/draft`, { leagueId: league(made, gameId), action: 'start' });
      if (r.status !== 200) throw Error(`The draft couldn't start (${r.status}): ${JSON.stringify(r.body).slice(0, 160)}`);
      for (const pid of couch) {
        const x = await (await as(pid))('POST', `/api/leagues/${league(made, gameId)}/draft/blind/lock`, { playerId: pid, castawayIds: want[pid] });
        if (x.status !== 200) throw Error(`${pid} couldn't lock in (${x.status})`);
      }
    });
    const revealed = stateOf(dealt);
    return { started, revealed };
  };

  // 1. The game, and 2. the draft it opens with.
  const start = s.snapshot();
  const blindFirst = [top, ...stages].find((g) => { const st = start.games[g.id]?.state; return isBlind(st) && S.BlindDraftLogic.isRevealed(st) && st.castaways.some((x) => x.ownerIds.length); });
  const opening = blindFirst ? draftOpenAtStart(start, blindFirst.id) : start;
  const atStart = stateOf(opening);
  begin('game');
  screen('games', 'Games', atStart, where.games, null, { selector: '[id^="game-"]' });
  screen('rules', 'How it plays', atStart, where.page(top.id), '[data-game-rules]', { selector: '[data-game-short]' });
  if (blindFirst) {
    begin('draft', first, blindFirst.id);
    const d = draftStates(opening, start, blindFirst.id);
    screen('tonight', 'Tonight', atStart, (made) => where.tonight(made), null, { selector: '[data-strip]' });
    screen('room', 'Draft room', d.started, where.room(blindFirst.id), null, { text: 'Nobody sees until|Choose \\d+' });
    screen('teams', 'The teams', d.revealed, where.room(blindFirst.id), null, { text: `×${people.length}` });
  }
  lap('the game and its draft');

  // 3. Each episode's move: the couch's moves in (E1), the viewer's still to make.
  Players.play(s, couch, seed);
  const due = moveOf(s, top, stages, viewer);
  if (due) {
    begin('week', first, due.game);
    const weekState = stateOf(s.snapshot());
    screen('tonight', 'Tonight', weekState, (made) => where.tonight(made), null, { selector: '[data-strip]' });
    screen('move', 'Your move', weekState, (made) => where.tonight(made, `?moves=${due.tab}&game=${league(made, due.game)}`), null, { text: '^(Who |Start \\d|Pick |Answer |Choose |Does |Will )', within: '[role="dialog"]' });
  }
  Players.play(s, [viewer], seed);
  lap('the weekly move');

  // 4. After the first results, and on: a later stage's draft as it opens.
  let firstAfter = true;
  for (let n = first; n <= last && !over(); n++) {
    const finale = n === last;
    if (n > first) Players.play(s, people, seed);
    const before = s.snapshot();
    night(n, finale ? couch : people);
    const after = s.snapshot();
    if (finale) break;
    const opened = stages.find((g) => { const a = after.games[g.id]?.state, z = before.games[g.id]?.state; return isBlind(a) && a.castaways.some((x) => x.ownerIds.length) && z && !z.castaways.some((x) => x.ownerIds.length); });
    if (firstAfter) {
      const stage = stages.find((g) => { const v = s.project(g.id, viewer).game; return v.from !== null && v.from <= n && (v.to === null || v.to >= n); }) || top;
      begin('after', n, stage.id);
      const afterState = stateOf((opened && draftOpenLater(before, after, doc, opened.id)) || after);
      screen('tonight', 'Tonight', afterState, (made) => where.tonight(made), '[data-game-mini]', { selector: '[data-game-mini]' });
      screen('page', 'Game page', afterState, where.page(stage.id), '[data-game-grid]', { selector: `[data-game-grid] [data-restack="${viewer}"]`, union: true });
      if (s.project(stage.id, viewer).game.lineup) screen('team', 'Your team', afterState, where.page(stage.id), '[data-your-team]', { selector: '[data-your-team]' });
      firstAfter = false;
    }
    if (opened) {
      const open = draftOpenLater(before, after, doc, opened.id);
      if (open) {
        begin('stage', n + 1, opened.id);
        const beforeStart = stateOf(open);
        const d = draftStates(open, after, opened.id);
        screen('tonight', 'Tonight', beforeStart, (made) => where.tonight(made), null, { selector: '[data-strip]' });
        screen('room', 'Draft room', d.started, where.room(opened.id), null, { text: 'Nobody sees until|Choose \\d+' });
        screen('teams', 'The teams', d.revealed, where.room(opened.id), null, { text: `×${people.length}` });
      }
    }
  }
  lap('the season');

  // 5. The finale: the couch has watched; Tonight and the reveal before the viewer has, the game page after.
  begin('finale', last);
  const pre = stateOf(s.snapshot());
  screen('tonight', 'Tonight', pre, (made) => where.tonight(made), null, { selector: '[data-ask-line], [data-progress-reveal], [data-progress-watched]' });
  screen('reveal', 'Reveal', pre, (made) => where.tonight(made, `?page=reveal&ep=${last}`));
  s.apply({ type: 'reveal', contextId: ctxId, personId: viewer }, 'preview');
  const topTwo = s.project(top.id, viewer).game.table.slice().sort((a, c) => c.total - a.total).slice(0, 2).map((r) => r.playerId);
  screen('page', 'Game page', stateOf(s.snapshot()), where.page(top.id), '[data-game-grid]', { selector: topTwo.map((id) => `[data-game-grid] [data-restack="${id}"]`).join(', '), union: true });
  moment.views = views();
  lap('the finale');

  // Each state written as its own copy, the first one's people shared by the rest; then the writes a real room makes.
  const made = [];
  const signIns = new Map();
  const as = async (pid) => { if (!signIns.has(pid)) signIns.set(pid, await signIn(app, made[0].ids.users[pid].username)); return signIns.get(pid); };
  const write = async (k, users) => {
    const st = states[k];
    const ids = await Live.up(st.snap, doc, o.db || undefined, null, users ? { users } : {});
    const shift = Date.now() - Date.parse(st.snap.clock);
    await Live.sync(ids, st.snap, doc, shift);
    made[k] = { ids, season: ids.seasons[ctxId].id, leagues: ids.leagues, shift };
  };
  try {
    // The first copy makes the people (and their colours, as the bench's preview sets them: the profile's own route); the rest share
    // them, written side by side; then the writes a real room makes, in each copy that has them.
    await write(0, null);
    for (const [i, pid] of people.entries()) await (await as(pid))('PUT', '/api/me/profile', { colour: PALETTE[i % PALETTE.length] });
    await Promise.all(states.slice(1).map((_, i) => write(i + 1, made[0].ids.users)));
    for (const [k, st] of states.entries()) if (st.writes) await st.writes(made[k], as);
    lap('the copies');
  } catch (e) {
    await down({ copies: made.filter(Boolean).map((m) => m.ids.key), db: o.db }).catch(() => {});
    throw e;
  }

  const v0 = s.project(top.id, viewer).game;
  for (const m of moments) {
    for (const sc of m.screens) {
      sc.path = sc.where(made[sc.state]);
      delete sc.where;
    }
    // The card's times are the copy's: its own season moved to now (each copy is written at its own moment's clock).
    m.shift = made[m.screens[0].state].shift;
  }
  const preview = {
    schemaVersion: 1,
    live: true,
    madeAt: new Date().toISOString(),
    source: 'tools/gameplay-bench/preview/live.cjs: the explorer runtime on the live tier, each moment a copy of the game, its screens the real app live; every result after the viewer’s mark made up',
    game: { id: top.id, name: top.name || v0.name, short: v0.short, rules: v0.rules, stages: stages.map((g) => ({ id: g.id, name: s.project(g.id, viewer).game.name })) },
    viewer,
    people: doc.world.people.map((x, i) => ({ id: x.id, name: x.name, colour: PALETTE[i % PALETTE.length] })),
    first,
    last,
    seed,
    moments,
    checks: [],
    problems: [],
    // The viewer's sign-in on the preview host (the copies share it), and each copy's key, to remove them.
    viewerUser: made[0].ids.users[viewer].username,
    copies: made.map((m) => m.ids.key),
  };
  const nSeasons = o.seasons ?? 5;
  if (nSeasons) preview.seasons = typical(o.input, nSeasons, seed, w.results, viewer);
  lap('what’s typical');
  preview.ms = Date.now() - t0;
  preview.steps = steps;
  s.dispose();
  log(`live preview: ${moments.length} moments, ${states.length} copies in ${Math.round(preview.ms / 100) / 10} s`);
  return preview;
}

/** The viewer's move each episode, if the game has one: its game and the moves sheet's tab (a lineup's, a pick's). */
function moveOf(s, top, stages, viewer) {
  for (const g of [top, ...stages]) {
    const v = s.project(g.id, viewer).game;
    if (v.lineup && !v.lineup.locked && v.from !== null) return { game: g.id, tab: 'lineup' };
    if (v.pick && v.pick.open) return { game: g.id, tab: 'pool' };
  }
  return null;
}

/** Remove a live preview's copies: the ones that share the first's people first, then the first (which removes the people). */
async function down(preview) {
  const keys = [...(preview.copies || [])];
  for (const key of keys.slice(1).reverse()) await Live.down(key, preview.db || undefined);
  if (keys[0]) await Live.down(keys[0], preview.db || undefined);
}

module.exports = { make, down };
