// The v2 bench bridge (tools/gameplay-bench/runtime-session.cjs + router runtime/*): a definition opened in the bench
// drives frame reads and writes through the same runtime as CLI/HTTP execute. No app, browser or DB needed.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const R = require('../tools/gameplay-bench/explorer/runtime.cjs');
const proof = require('./fixtures/gameplay-explorer/runtime-proof.cjs');
const legacy = require('./fixtures/gameplay-explorer/legacy-lineup-v1.json');
const base = { schemaVersion: 1, context: { username: 'zt_bench', userId: 'fixture-user', seasonId: 'season', couchId: 'couch', gameId: 'old-game' }, responses: { '/api/me/home': { status: 200, body: { user: { id: 'fixture-user' }, shows: [], couches: [{ id: 'couch', members: [] }] } }, '/api/seasons/season/space?couch=couch': { status: 200, body: { show: { name: 'Survivor' }, schedule: {}, you: {} } }, '/api/seasons/season/games?couch=couch': { status: 200, body: { games: [] } } } };

async function withBench(fn) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'gameplay-bench-runtime-'));
  try {
    fs.mkdirSync(path.join(out, 'datasets')); fs.writeFileSync(path.join(out, 'datasets/recorded.json'), JSON.stringify(base));
    const frames = [];
    const router = require('../tools/gameplay-bench/router.cjs').router({ out, activate: async (id, dataset, theme, clock, gameId, runtime) => { frames.push({ id, gameId, runtime }); return { origin: 'http://127.0.0.1:1', url: 'http://127.0.0.1:1/game' }; }, releaseBench() {}, sourceFingerprint: 'test-source' });
    const call = (method, name, body = {}) => router(method, new URL('http://127.0.0.1/__atlas/bench/' + name), body);
    await fn({ call, frames });
  } finally {
    const resolved = fs.realpathSync(out);
    if (path.dirname(resolved) !== fs.realpathSync(os.tmpdir()) || !path.basename(resolved).startsWith('gameplay-bench-runtime-')) throw Error('Unexpected temporary cleanup target');
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
const u = p => new URL('http://127.0.0.1:1' + p);
const gamesOf = runtime => runtime.bundle().responses['/api/seasons/season/games?couch=couch'].body.games;

test('frame writes become runtime actions; rejections are atomic; the export resumes headlessly with the same hash', async () => withBench(async ({ call, frames }) => {
  const opened = await call('POST', 'runtime/open', { live: false, input: proof({ ann: 1, bo: 1 }), gameId: 'lineup', viewerId: 'ann' });
  assert.equal(opened.status, 201); assert.equal(opened.body.status, 'open');
  const { id } = opened.body.state, frame = frames.at(-1).runtime;
  const games = gamesOf(frame);
  assert.equal(games.length, 3);
  assert(games.every(g => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/.test(g.leagueId)), 'application routes need UUID game IDs');
  assert.equal(frames.at(-1).gameId, games[0].leagueId);
  const lineup = games.find(g => g.lineup).lineup, leagueId = games.find(g => g.lineup).leagueId;
  const at = '/api/leagues/' + leagueId + '/episodes/' + lineup.epId + '/lineups/';

  const before = (await call('GET', 'runtime/state?id=' + id)).body.hash;
  const bad = frame.mutate('PUT', u(at + 'ann'), { castawayIds: ['missing'] });
  assert.equal(bad.status, 422);
  assert.equal((await call('GET', 'runtime/state?id=' + id)).body.hash, before, 'a rejected save leaves the runtime unchanged');
  assert.equal(frame.mutate('PUT', u(at + 'bo'), { castawayIds: [] }).status, 403, 'the frame acts only as the selected viewer');
  assert.equal(frame.mutate('POST', u('/api/seasons/season/answers?league=' + leagueId), {}).status, 501, 'unconnected application writes stay explicit gaps');
  assert.equal(frame.mutate('POST', u('/api/leagues/' + leagueId + '/chat'), {}), null, 'unknown writes fall through to the proxy refusal');
  assert.equal(frame.mutate('PUT', u(at + 'ann'), { castawayIds: lineup.roster.slice(0, lineup.slots) }).status, 200);
  assert.deepEqual(gamesOf(frame).find(g => g.lineup).lineup.starters, lineup.roster.slice(0, lineup.slots));

  const stale = await call('POST', 'runtime/apply', { id, expectedRevision: opened.body.state.revision, action: { type: 'clock', at: '2099-01-10T13:00:00.000Z' } });
  assert.equal(stale.status, 409, 'a stale revision cannot overwrite a newer state');
  const state = stale.body.state;
  const clocked = await call('POST', 'runtime/apply', { id, expectedRevision: state.revision, action: { type: 'clock', at: '2099-01-10T13:00:00.000Z' } });
  assert.equal(clocked.body.result.status, 'accepted');
  assert.equal(frame.clock(), '2099-01-10T13:00:00.000Z', 'new frame loads freeze the runtime clock, not the activation time');

  const exported = (await call('GET', 'runtime/export?id=' + id)).body;
  assert.deepEqual(exported.execution.trace.map(t => [t.origin, t.status]), [['bench-frame', 'rejected'], ['bench-frame', 'accepted'], ['bench-control', 'accepted']]);
  const headless = R.execute(exported), http = (await call('POST', 'execute', { input: exported })).body;
  assert.equal(headless.status, 'executed'); assert.equal(http.status, 'executed');
  assert.equal(headless.execution.stateHash, clocked.body.state.hash);
  assert.equal(http.execution.stateHash, clocked.body.state.hash, 'UI, HTTP and headless entry points agree on the same revision and trace');

  const reopened = await call('POST', 'runtime/open', { live: false, input: { ...exported, sourceFingerprint: undefined } });
  assert.equal(reopened.body.state.hash, clocked.body.state.hash); assert.equal(reopened.body.state.viewerId, 'ann');
}));

test('the one reveal moves only that viewer, across every game in the context; viewer switches keep each mark', async () => withBench(async ({ call, frames }) => {
  const opened = await call('POST', 'runtime/open', { live: false, input: proof({ ann: 1, bo: 1 }), gameId: 'picks', viewerId: 'ann' });
  const { id } = opened.body.state, frame = frames.at(-1).runtime;
  assert.equal(frame.mutate('POST', u('/api/seasons/season/reveal'), { episode: 2, replay: true }).status, 422, 'replay only plays a revealed episode');
  const reveal = frame.mutate('POST', u('/api/seasons/season/reveal'), { episode: 2 });
  assert.equal(reveal.status, 200); assert.equal(reveal.body.episode, 2); assert.equal(reveal.body.again, false);
  const people = Object.fromEntries((await call('GET', 'runtime/state?id=' + id)).body.people.map(p => [p.id, p.seen]));
  assert.deepEqual(people, { ann: 2, bo: 1 });
  assert(gamesOf(frame).every(g => !g.catchingUp), 'every game of Ann\'s in the context moved with the one reveal');

  const switched = await call('POST', 'runtime/select', { id, viewerId: 'bo', expectedRevision: (await call('GET', 'runtime/state?id=' + id)).body.revision });
  assert.equal(switched.status, 200); assert.equal(switched.body.state.viewerId, 'bo');
  assert.equal(frames.at(-1).runtime.bundle().responses['/api/seasons/season/space?couch=couch'].body.you.seenThrough, 1);
  assert(gamesOf(frames.at(-1).runtime).every(g => g.catchingUp), 'Bo is still behind in every game');
  const back = await call('POST', 'runtime/select', { id, viewerId: 'ann' });
  assert.equal(frames.at(-1).runtime.bundle().responses['/api/seasons/season/space?couch=couch'].body.you.seenThrough, 2);
  assert.equal(back.body.state.people.find(p => p.id === 'bo').seen, 1);
}));

test('a definition the runtime cannot run returns its gaps, opens no frame and keeps no case', async () => withBench(async ({ call, frames }) => {
  const blocked = await call('POST', 'runtime/open', { live: false, input: legacy });
  assert.equal(blocked.status, 200); assert.equal(blocked.body.status, 'blocked');
  assert.match(blocked.body.message + JSON.stringify(blocked.body.gaps || []), /snapshot|adapter/i);
  assert.equal(frames.length, 0);
  assert.equal((await call('GET', 'runtime/state?id=missing')).status, 404);
}));

test('the explorer can air an episode, publish and correct its results, and step through an opened run', async () => withBench(async ({ call }) => {
  const opened = await call('POST', 'runtime/open', { live: false, input: proof({ ann: 2, bo: 1, eventCount: 5 }), label: 'Three games' });
  const id = opened.body.state.id, ep3 = opened.body.state.events.find(e => e.number === 3);
  assert.equal(opened.body.state.title, 'Three games'); assert.equal(ep3.resultStatus, 'unavailable');
  assert.equal((await call('POST', 'runtime/publish', { id, eventId: ep3.id, status: 'final' })).body.result.status, 'rejected', 'no results before the airing');
  const aired = new Date(Date.parse(ep3.airAt) + 3600000).toISOString();
  assert.equal((await call('POST', 'runtime/apply', { id, action: { type: 'clock', at: aired } })).body.result.status, 'accepted');
  const final = await call('POST', 'runtime/publish', { id, eventId: ep3.id, status: 'final' });
  assert.equal(final.body.result.status, 'accepted');
  const first = final.body.state.events.find(e => e.number === 3); assert.equal(first.resultStatus, 'final'); assert.equal(first.out.length, 1);
  const corrected = await call('POST', 'runtime/publish', { id, eventId: ep3.id, status: 'corrected' });
  assert.notDeepEqual(corrected.body.state.events.find(e => e.number === 3).out, first.out, 'a correction changes who went out');
  const exported = (await call('GET', 'runtime/export?id=' + id)).body;
  const reopened = await call('POST', 'runtime/open', { live: false, input: exported });
  const rid = reopened.body.state.id; assert.deepEqual(reopened.body.state.steps, { recorded: 4, at: 4 }); // the rejected early publish is a recorded step too
  const back = await call('POST', 'runtime/seek', { id: rid, to: 2 });
  assert.deepEqual(back.body.state.steps, { recorded: 4, at: 2 }); assert.equal(back.body.state.events.find(e => e.number === 3).resultStatus, 'unavailable');
  assert.equal((await call('POST', 'runtime/seek', { id: rid, to: 4 })).body.state.events.find(e => e.number === 3).resultStatus, 'corrected');
}));

test("the old bench's recipes open as v2 definitions in the shared runtime (sports stays an explicit gap)", () => {
  const { recipeDefinition } = require('../tools/gameplay-bench/explorer/recipes.cjs'), B = require('../tools/gameplay-bench/scenario.cjs');
  for (const showGame of ['lineup', 'best-ball', 'outlast', 'picks', 'pool']) for (const status of ['due', 'saved', 'locked', 'catchup', 'finished']) {
    const { input } = recipeDefinition({ showGame, status, players: 3, history: 4, pace: 'friend-behind' }), s = R.open(input);
    try {
      const g = s.project(showGame, 'p1').game;
      assert.equal(g.table.length, 3, showGame + ' ' + status); assert.equal(g.over, status === 'finished', showGame + ' ' + status + ' over');
      if (status === 'catchup') assert.equal(s.snapshot().contexts.show.marks.find(m => m.personId === 'p1').through, 2);
    } finally { s.dispose(); }
  }
  for (const p of B.presets) R.open(recipeDefinition({ ...p.values }).input).dispose();
  const lineup = R.open(recipeDefinition({ showGame: 'lineup' }).input);
  try { assert.deepEqual(lineup.export().preparation.notes, [], 'side bets are connected now: no note'); } finally { lineup.dispose(); }
  assert.throws(() => recipeDefinition({ context: 'football/nfl' }), /old bench/);
});

test('side bets: post, guess, refusals, grading by the commissioner, points in the standings, exact replay', () => {
  const { recipeDefinition } = require('../tools/gameplay-bench/explorer/recipes.cjs');
  const s = R.open(recipeDefinition({ showGame: 'lineup', players: 3, history: 3, pace: 'friend-behind' }).input);
  try {
    const next = s.snapshot().contexts.show.events.find(e => e.resultStatus === 'unavailable');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); return r; };
    const no = (a, why) => { const before = s.hash(), r = s.apply(a); assert.equal(r.status, 'rejected', JSON.stringify(a)); assert.match(r.message, why); assert.equal(s.hash(), before); };
    ok({ type: 'bet', gameId: 'lineup', personId: 'p2', eventId: next.id, label: 'Will anyone cry?', points: 2 });
    const bet = s.snapshot().games.lineup.state.episodes.find(e => e.id === next.id).bets[0]; assert.match(bet.id, /^bet-/);
    ok({ type: 'guess', gameId: 'lineup', personId: 'p1', eventId: next.id, betId: bet.id, guess: 'Yes' });
    no({ type: 'guess', gameId: 'lineup', personId: 'p2', eventId: next.id, betId: bet.id, guess: 'No' }, /caught up/); // p2 is the friend behind
    ok({ type: 'guess', gameId: 'lineup', personId: 'p3', eventId: next.id, betId: bet.id, guess: 'No' });
    const preds = () => s.snapshot().games.lineup.state.episodes.find(e => e.id === next.id).bets[0].predictions;
    no({ type: 'grade', gameId: 'lineup', personId: 'p3', eventId: next.id, betId: bet.id, predId: preds()[0].id, value: true }, /Commissioner only/);
    ok({ type: 'clock', at: new Date(Date.parse(next.airAt) + 3600000).toISOString() });
    no({ type: 'guess', gameId: 'lineup', personId: 'p1', eventId: next.id, betId: bet.id, guess: 'Maybe' }, /closed/);
    no({ type: 'bet', gameId: 'lineup', personId: 'p1', eventId: next.id, label: 'Late bet', points: 1 }, /closed/);
    const p1 = preds().find(x => x.playerId === 'p1'), before = s.project('lineup', 'p1').game.table.find(r => r.playerId === 'p1').total;
    ok({ type: 'unguess', gameId: 'lineup', personId: 'p1', eventId: next.id, betId: bet.id, predId: p1.id }); // after the lock: no-op, as the server
    assert.equal(preds().length, 2);
    const sc = s.snapshot().contexts.show, out = sc.participants.find(p => !sc.facts.some(f => (f.data.events || []).some(e => e.castawayId === p.id))).id;
    ok({ type: 'results', contextId: 'show', eventId: next.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: out, method: 'Voted Out' }], scoringEvents: [] } });
    ok({ type: 'grade', gameId: 'lineup', personId: 'p1', eventId: next.id, betId: bet.id, predId: p1.id, value: true });
    ok({ type: 'reveal', contextId: 'show', personId: 'p1' });
    const week = s.project('lineup', 'p1').game.table.find(r => r.playerId === 'p1').weeks.find(w => w.episode === next.number);
    assert.equal(week.predictions, 2, 'the graded bet counts its 2 points in that week'); void before;
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test('season-long questions: answered once (episode 0), private while open, locked at the finale, settled by its winner after your reveal', () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const season = [
    { id: 'winner', ask: 'Who wins?', answer: 'person', points: 3, settle: { by: 'results', take: 'winner' }, asked: 'once', closes: 'finale', pick: 1, from: 'cast' },
    { id: 'top3', ask: 'Who makes the final three?', answer: 'person', points: 1, settle: { by: 'results', take: 'top', place: 3 }, asked: 'once', closes: 'finale', pick: 3, from: 'cast' },
  ];
  const people = [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }, { id: 'p3', name: 'Cy' }];
  const s = R.open(D.create({ seed: 7, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 3, pool: 10 } }], people },
    games: [{ id: 'questions', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, ask: [...Q.spec.ask, ...season] } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 2, eventCount: 3 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'season-long questions are connected: no note');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); return r; };
    const no = (a, why) => { const before = s.hash(), r = s.apply(a); assert.equal(r.status, 'rejected', JSON.stringify(a)); assert.match(r.message, why); assert.equal(s.hash(), before); };
    const q = (p, id) => s.project('questions', p).questions.find(x => x.id === id);
    assert.deepEqual([q('p1', 'winner').episode, q('p1', 'winner').closed, q('p1', 'top3').pick], [0, false, 3]);
    const cast = q('p1', 'winner').options.map(o => o.id), [x, a, b, c] = cast;
    ok({ type: 'answer', gameId: 'questions', personId: 'p1', question: 'winner', episode: 0, answer: x });
    ok({ type: 'answer', gameId: 'questions', personId: 'p1', question: 'top3', episode: 0, answer: [x, a, b] });
    ok({ type: 'answer', gameId: 'questions', personId: 'p2', question: 'winner', episode: 0, answer: c });
    no({ type: 'answer', gameId: 'questions', personId: 'p3', question: 'winner', episode: 3, answer: x }, /episode 0/);
    no({ type: 'answer', gameId: 'questions', personId: 'p3', question: 'top3', episode: 0, answer: [x, a, b, c] }, /at most/);
    assert.ok(!s.project('questions', 'p2').decided.some(r => r.playerId === 'p1' && r.question === 'winner'), "others' answers stay hidden while the question is open");
    const finale = s.snapshot().contexts.show.events.at(-1);
    ok({ type: 'clock', at: new Date(Date.parse(finale.airAt) + 3600000).toISOString() });
    assert.equal(q('p1', 'winner').closed, true);
    no({ type: 'answer', gameId: 'questions', personId: 'p3', question: 'winner', episode: 0, answer: x }, /closed/);
    // The finale: the rest voted out, a and b lose the final vote, x wins.
    const sc = s.snapshot().contexts.show, gone = new Set(sc.facts.flatMap(f => (f.data.events || []).map(e => e.castawayId)));
    assert.ok([x, a, b].every(id => !gone.has(id)), 'the chosen finalists are still in');
    const rest = sc.participants.map(p => p.id).filter(id => !gone.has(id) && ![x, a, b].includes(id));
    ok({ type: 'results', contextId: 'show', eventId: finale.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [...rest.map(id => ({ castawayId: id, method: 'Voted Out' })), { castawayId: a, method: 'Lost Final Tribal (Jury Vote)' }, { castawayId: b, method: 'Lost Final Tribal (Jury Vote)' }, { castawayId: x, method: 'Sole Survivor' }], scoringEvents: [] } });
    const points = (p, id) => s.project('questions', p).decided.find(r => r.playerId === 'p1' && r.question === id)?.points ?? null;
    assert.equal(points('p1', 'winner'), 0, 'not settled for p1 before they watch the finale');
    ok({ type: 'reveal', contextId: 'show', personId: 'p1' });
    assert.equal(points('p1', 'winner'), 3);
    assert.ok(points('p1', 'top3') > 0, 'the final three settle too');
    assert.equal(s.snapshot().games.questions.state.episodes.length, 3, 'a season with a winner appends no episode');
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test("head to head: seats kept at setup, the playoffs placed by the season's length, a champion at the final, nothing past a viewer's mark", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json'), S = require('../src/lib/game/state-logic');
  const people = ['Ann', 'Bo', 'Cy', 'Di'].map((n, i) => ({ id: 'p' + (i + 1), name: n }));
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 4, pool: 14 } }], people },
    games: [{ id: 'h2h', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'matchups', odd: 'bye', playoffs: { teams: 2 } } } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [{ personId: 'p2', contextId: 'show', through: 2 }] }, content: { completedEvents: 3, eventCount: 5 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'head to head is connected: no note');
    const state = () => s.snapshot().games.h2h.state, ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    assert.equal(state().seasonEpisodes, 5, "the season's length, as the server stamps it");
    assert.deepEqual(state().matchupSeats, { p1: 1, p2: 1, p3: 1, p4: 1 }, 'every seat in the schedule from the start (the server settles at its first write)');
    const ann = s.project('h2h', 'p1').game.matchups, bo = s.project('h2h', 'p2').game.matchups;
    assert.equal(ann.record.wins + ann.record.losses + ann.record.ties, 3); assert.ok(bo.record.wins + bo.record.losses + bo.record.ties <= 2, 'Bo, behind, sees no matchup past episode 2');
    assert.deepEqual([ann.playoffs.from, ann.playoffs.teams, ann.playoffs.seeds], [5, 2, null]);
    const publish = n => { const w = s.snapshot().contexts.show, ev = w.events.find(e => e.number === n), gone = new Set(w.facts.flatMap(f => (f.data.events || []).map(e => e.castawayId)));
      const still = w.participants.filter(p => !gone.has(p.id)).map(p => p.id), Data = require('../tools/gameplay-bench/explorer/runtime-data.cjs');
      ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
      ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: Data.outcome(require('../src/lib/game/formats').formatFor('survivor'), still, k => k.length * 7 + n, n === 5), scoringEvents: still.slice(0, 4).map((id, i) => ({ id: 'm-' + n + '-' + i, type: 'rewardWin', castawayId: id })) } }); };
    publish(4); assert.equal(state().playoffsFrom, undefined, 'not placed until their first round has results');
    publish(5); assert.equal(state().playoffsFrom, 5, 'placed once the final has results');
    assert.ok(S.seasonEnded(state()), 'the finale crowned a winner');
    ok({ type: 'reveal', contextId: 'show', personId: 'p1' }); ok({ type: 'reveal', contextId: 'show', personId: 'p1' });
    const after = s.project('h2h', 'p1').game.matchups;
    assert.equal(after.playoffs.seeds.length, 2); assert.ok(after.playoffs.champion && after.playoffs.seeds.includes(after.playoffs.champion), 'a champion from the two seeds');
    assert.equal(s.project('h2h', 'p2').game.matchups.playoffs.champion, null, 'Bo, still behind, sees no champion');
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test('weeks won: connected with its tie rules, counted only through each viewer\'s mark, exact replay', () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  for (const ties of ['all', 'split', 'none']) {
    const s = R.open(D.create({ seed: 9, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 3, pool: 12 } }], people: ['Ann', 'Bo', 'Cy'].map((n, i) => ({ id: 'p' + (i + 1), name: n })) },
      games: [{ id: 'weeks', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'weeks', ties } } }],
      situation: { clock: '2099-01-10T12:00:00.000Z', marks: [{ personId: 'p2', contextId: 'show', through: 1 }] }, content: { completedEvents: 3, eventCount: 5 } }));
    try {
      assert.deepEqual(s.export().preparation.notes || [], [], 'weeks won is connected: no note');
      const all = s.project('weeks', 'p1').game.weeksWon, behind = s.project('weeks', 'p2').game.weeksWon;
      const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
      assert.ok(sum(all) <= (ties === 'all' ? 9 : 3), ties + ': at most one week each episode (several on a tie with ties all): ' + JSON.stringify(all));
      assert.ok(Object.values(behind).every(n => n <= 1), ties + ': Bo, through episode 1, counts at most one week: ' + JSON.stringify(behind));
      const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
    } finally { s.dispose(); }
  }
});

test('only some moments count, as hits: a moment off the list adds nothing, a listed one on a starter adds exactly one', () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const s = R.open(D.create({ seed: 3, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'g', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments', only: ['idolFound', 'rewardWin'], hits: 'every' }, rank: { by: 'total' } } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 2, eventCount: 4 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'only/hits are connected: no note');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const total = () => s.project('g', 'p1').game.table.find(r => r.playerId === 'p1').total;
    const l = s.project('g', 'p1').game.lineup, ids = l.roster.slice(0, l.slots), bench = l.roster.slice(l.slots);
    ok({ type: 'lineup', gameId: 'g', personId: 'p1', eventId: l.epId, ids });
    const before = total(), ev = s.snapshot().contexts.show.events.find(e => e.id === l.epId);
    ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    const off = ids.map((id, i) => ({ id: 'off-' + i, type: 'individualImmunity', castawayId: id }));
    ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [], noExit: true, scoringEvents: [...off, { id: 'on-0', type: 'idolFound', castawayId: ids[0] }, ...bench.map((id, i) => ({ id: 'bench-' + i, type: 'rewardWin', castawayId: id }))] } });
    ok({ type: 'reveal', contextId: 'show', personId: 'p1' });
    assert.equal(total() - before, 1, 'one listed moment on a starter is one hit; off-list moments and the bench add nothing');
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test("lives: a wrong answer costs one, someone at none is out and refused, a co-op couch at none has lost, as the server refuses", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const spec = (rank, more = {}) => ({ ...Q.spec, score: { ...Q.spec.score, lives: 1, livesOn: ['boot'], ...more }, rank: { by: rank } });
  const s = R.open(D.create({ seed: 4, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'standing', contextId: 'show', timing: 'live-only', spec: spec('standing') }, { id: 'coop', contextId: 'show', timing: 'live-only', spec: spec('coop', { saves: 'all' }) }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 4 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'lives and co-op are connected: no note');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const no = (a, why) => { const before = s.hash(), r = s.apply(a); assert.equal(r.status, 'rejected', JSON.stringify(a)); assert.match(r.message, why); assert.equal(s.hash(), before); };
    const cast = s.project('standing', 'p1').questions.find(q => q.id === 'boot').options.map(o => o.id), [x, y] = cast;
    for (const g of ['standing', 'coop']) { ok({ type: 'answer', gameId: g, personId: 'p1', question: 'boot', episode: 1, answer: x }); ok({ type: 'answer', gameId: g, personId: 'p2', question: 'boot', episode: 1, answer: y }); }
    const ev = s.snapshot().contexts.show.events[0];
    ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: x, method: 'Voted Out' }], scoringEvents: [] } });
    for (const p of ['p1', 'p2']) ok({ type: 'reveal', contextId: 'show', personId: p });
    // Last one standing: Bo was wrong (his one life gone) and is out; Ann ranks first.
    no({ type: 'answer', gameId: 'standing', personId: 'p2', question: 'boot', episode: 2, answer: y }, /out of this game|ended/);
    assert.equal(s.project('standing', 'p1').game.table[0].playerId, 'p1');
    // Co-op, saved only when all saw it coming: Bo's wrong answer cost the couch its one life, so the game is over for both.
    const coop = s.project('coop', 'p1').game.coop;
    assert.equal(coop.lives, 0, JSON.stringify(coop));
    no({ type: 'answer', gameId: 'coop', personId: 'p1', question: 'boot', episode: 2, answer: y }, /ended|closed/);
    assert.ok(s.project('coop', 'p1').questions.every(q => q.closed), 'every question shows closed once the couch has lost');
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test("shared points: a split pot halves between two right; 'only' pays nobody when two are right and the whole when one is", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const ask = [{ id: 'split', ask: 'Who goes home?', answer: 'person', points: 4, asked: 'each', settle: { by: 'results', take: 'out' }, share: 'split' },
    { id: 'only', ask: 'Who goes home, alone?', answer: 'person', points: 3, asked: 'each', settle: { by: 'results', take: 'out' }, share: 'only' },
    { id: 'idol', ask: 'Who finds an idol?', answer: 'person', points: 2, asked: 'each', settle: { by: 'moment', moment: 'idolFound', take: 'who' }, share: 'only' }];
  const s = R.open(D.create({ seed: 8, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 3, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }, { id: 'p3', name: 'Cy' }] },
    games: [{ id: 'q', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, ask } }], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 3 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'share is connected: no note');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const [x, y] = s.project('q', 'p1').questions.find(q => q.id === 'split').options.map(o => o.id);
    const say = (p, question, answer) => ok({ type: 'answer', gameId: 'q', personId: p, question, episode: 1, answer });
    say('p1', 'split', x); say('p2', 'split', x); say('p3', 'split', y);   // two right: 2 each
    say('p1', 'only', x); say('p2', 'only', x); say('p3', 'only', y);     // two right: nobody
    say('p1', 'idol', y); say('p2', 'idol', x); say('p3', 'idol', x);     // Ann alone right: all 2
    const ev = s.snapshot().contexts.show.events[0];
    ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: x, method: 'Voted Out' }], scoringEvents: [{ id: 'i1', type: 'idolFound', castawayId: y }] } });
    ok({ type: 'reveal', contextId: 'show', personId: 'p1' });
    const paid = id => Object.fromEntries(s.project('q', 'p1').decided.filter(d => d.question === id).map(d => [d.playerId, d.points]));
    assert.deepEqual(paid('split'), { p1: 2, p2: 2, p3: 0 });
    assert.deepEqual(paid('only'), { p1: 0, p2: 0, p3: 0 });
    assert.deepEqual(paid('idol'), { p1: 2, p2: 0, p3: 0 });
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test('a draft out of a hat starts recorded as drawn: the server never deals again, late joiners are dealt from its seed', () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json'), S = require('../src/lib/game/state-logic');
  for (const own of ['exclusive', 'shared']) {
    const s = R.open(D.create({ seed: 2, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
      games: [{ id: 'g', contextId: 'show', timing: 'own-pace', spec: { get: { by: 'draft', each: 3, own, order: 'draw' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'total' } } }],
      situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] } }));
    try {
      assert.deepEqual(s.export().preparation.notes || [], [], own + ': a draw is connected');
      const st = s.snapshot().games.g.state;
      assert.ok(S.DrawLogic.drawn(st), own + ': recorded as drawn'); assert.equal(S.DrawLogic.due(st), false, own + ': never due again');
      assert.equal(S.DrawLogic.settle(JSON.parse(JSON.stringify(st))), false, own + ': a server write deals nothing'); assert.ok(S.DrawLogic.dealsLate(st), own + ': a late joiner is dealt');
      if (own === 'exclusive') { const held = st.castaways.flatMap(c => c.ownerIds); assert.equal(new Set(st.castaways.filter(c => c.ownerIds.length).map(c => c.id)).size, held.length, 'nobody shares in an exclusive draw'); }
    } finally { s.dispose(); }
  }
});

test('stakes: held to the bank less what is still riding, refused past it, settled at even odds into the total', () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const ask = [{ ...Q.spec.ask[0], wager: 'total' }, { ...Q.spec.ask[1], wager: 5 }];
  const s = R.open(D.create({ seed: 3, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'q', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, ask, score: { ...Q.spec.score, bank: { start: 10 } }, rank: { by: 'total' } } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 3 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'wagers and banks are connected: no note');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const no = (a, why) => { const before = s.hash(), r = s.apply(a); assert.equal(r.status, 'rejected', JSON.stringify(a)); assert.match(r.message, why); assert.equal(s.hash(), before); };
    const most = () => Object.fromEntries(s.project('q', 'p1').questions.map(q => [q.id, q.stakeMost]));
    assert.deepEqual(most(), { boot: 10, happens: 5 }, 'the bank, and a wager of 5 held to it');
    const x = s.project('q', 'p1').questions[0].options[0].id;
    no({ type: 'answer', gameId: 'q', personId: 'p1', question: 'boot', episode: 1, answer: { answer: x, stake: 11 } }, /Stake 0 to 10/);
    ok({ type: 'answer', gameId: 'q', personId: 'p1', question: 'boot', episode: 1, answer: { answer: x, stake: 6 } });
    assert.deepEqual(most(), { boot: 10, happens: 4 }, '6 riding on the boot leaves 4');
    no({ type: 'answer', gameId: 'q', personId: 'p1', question: 'happens', episode: 1, answer: { answer: 'yes', stake: 5 } }, /Stake 0 to 4/);
    ok({ type: 'answer', gameId: 'q', personId: 'p1', question: 'happens', episode: 1, answer: { answer: 'yes', stake: 4 } });
    const ev = s.snapshot().contexts.show.events[0];
    ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: x, method: 'Voted Out' }], scoringEvents: [{ id: 'r1', type: 'rewardWin', castawayId: x }] } });
    ok({ type: 'reveal', contextId: 'show', personId: 'p1' });
    assert.equal(s.project('q', 'p1').game.table.find(r => r.playerId === 'p1').total, 23, 'the bank 10, the boot 2 + 6, the moment 1 + 4');
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test('settled by the couch: "Who will most of you say goes home?" is right when it matches the majority of the boot answers, whatever happened', () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const ask = [Q.spec.ask[0], { id: 'most', ask: 'Who will most of you say goes home?', answer: 'person', points: 2, asked: 'each', settle: { by: 'players', take: 'majority', of: 'boot', tie: 'none' } }];
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 3, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }, { id: 'p3', name: 'Cy' }] },
    games: [{ id: 'q', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, ask } }], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 3 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'questions the couch settles are connected: no note');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const [x, y, z] = s.project('q', 'p1').questions[0].options.map(o => o.id);
    const say = (p, question, answer) => ok({ type: 'answer', gameId: 'q', personId: p, question, episode: 1, answer });
    say('p1', 'boot', x); say('p2', 'boot', x); say('p3', 'boot', y);   // most of the couch says x
    say('p1', 'most', x); say('p2', 'most', y); say('p3', 'most', x);   // Ann and Cy read the room
    const ev = s.snapshot().contexts.show.events[0];
    ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: z, method: 'Voted Out' }], scoringEvents: [] } });
    ok({ type: 'reveal', contextId: 'show', personId: 'p1' });
    const paid = id => Object.fromEntries(s.project('q', 'p1').decided.filter(d => d.question === id).map(d => [d.playerId, d.points]));
    assert.deepEqual(paid('most'), { p1: 2, p2: 0, p3: 2 }, 'the majority of the boot answers, not who went home');
    assert.deepEqual(paid('boot'), { p1: 0, p2: 0, p3: 0 }, 'nobody named who actually went home');
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test('knockouts: a cut takes the lowest out (their next lineup refused); a race ends once someone reaches it (later answers refused)', () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json'), S = require('../src/lib/game/state-logic');
  const people = [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }, { id: 'p3', name: 'Cy' }];
  const s = R.open(D.create({ seed: 6, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 3, pool: 12 } }], people },
    games: [{ id: 'cut', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'exclusive', order: 'snake' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'standing', cut: [{ at: { every: 1 }, out: 1, tie: 'keep', quiet: 'cut' }] } } },
      { id: 'race', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, ask: [Q.spec.ask[0]], rank: { by: 'total', race: { to: 2 } } } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 4 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'races and cuts are connected: no note');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const no = (a, why) => { const before = s.hash(), r = s.apply(a); assert.equal(r.status, 'rejected', JSON.stringify(a)); assert.match(r.message, why); assert.equal(s.hash(), before); };
    const starters = {}; for (const p of people) { const l = s.project('cut', p.id).game.lineup; starters[p.id] = l.roster.slice(0, l.slots); ok({ type: 'lineup', gameId: 'cut', personId: p.id, eventId: l.epId, ids: starters[p.id] }); }
    const x = s.project('race', 'p1').questions[0].options.find(o => !Object.values(starters).flat().includes(o.id)).id;
    ok({ type: 'answer', gameId: 'race', personId: 'p1', question: 'boot', episode: 1, answer: x });
    const ev = s.snapshot().contexts.show.events[0];
    ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    // Ann's and Bo's starters score; Cy's don't. Who goes home is Ann's pick, nobody's starter.
    ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: x, method: 'Voted Out' }], scoringEvents: [...starters.p1, ...starters.p2].map((id, i) => ({ id: 'w' + i, type: 'individualImmunity', castawayId: id })) } });
    for (const p of people) ok({ type: 'reveal', contextId: 'show', personId: p.id });
    const cut = s.snapshot().games.cut.state;
    assert.equal(S.KnockoutLogic.outOf(cut, 'p3'), 1, 'Cy, lowest, is cut after episode 1');
    // (The production game view still lists Cy's carried lineup as open: a product gap, Designs needed item 10. The write is refused.)
    no({ type: 'lineup', gameId: 'cut', personId: 'p3', eventId: s.snapshot().contexts.show.events[1].id, ids: starters.p3 }, /./);
    // The race to 2: Ann's right boot reaches it in episode 1, so the game is over.
    no({ type: 'answer', gameId: 'race', personId: 'p2', question: 'boot', episode: 2, answer: x }, /ended|closed/);
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test('phases: a game from the merge waits then starts after it is confirmed; one until it ends; "When does the merge start?" settles', () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json'), S = require('../src/lib/game/state-logic');
  const merge = { id: 'merge', ask: 'When does the merge start?', answer: 'number', points: 2, asked: 'once', closes: 'start', settle: { by: 'phase', phase: 'merged', take: 'starts' } };
  const s = R.open(D.create({ seed: 4, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 12 }, phaseStarts: { merged: 3 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'after', contextId: 'show', timing: 'live-only', spec: { span: { from: { phase: 'merged' } }, get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'total' } } },
      { id: 'before', contextId: 'show', timing: 'live-only', spec: { span: { to: { phase: 'merged' } }, get: { by: 'pick', each: 1, repeat: 'never' }, score: { by: 'moments' }, rank: { by: 'total' } } },
      { id: 'q', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, ask: [Q.spec.ask[0], merge] } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 6 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'phase spans and phase-start questions are connected: no note');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const span = g => { const st = s.snapshot().games[g].state; return [S.startEpisode(st), S.endEpisode(st)]; };
    assert.deepEqual(span('after'), [null, null], 'waits for the merge');
    ok({ type: 'answer', gameId: 'q', personId: 'p1', question: 'merge', episode: 0, answer: 3 });
    ok({ type: 'answer', gameId: 'q', personId: 'p2', question: 'merge', episode: 0, answer: 5 });
    for (const n of [1, 2, 3]) {
      const w = s.snapshot().contexts.show, ev = w.events[n - 1], gone = new Set(w.facts.flatMap(f => (f.data.events || []).map(e => e.castawayId)));
      ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
      ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: w.participants.find(p => !gone.has(p.id)).id, method: 'Voted Out' }], scoringEvents: [] } });
      if (n < 3) assert.deepEqual(span('after'), [null, null], 'still waiting after episode ' + n);
    }
    assert.deepEqual(span('after'), [4, null], 'confirmed by episode 3, it plays from the first episode still open');
    assert.equal(span('before')[1], 3, 'the game until the merge ends with it confirmed (never moving back over an aired episode)');
    assert.equal(s.snapshot().games.q.state.episodes.find(e => e.number === 3).postMerge, true, 'results from the merge are post-merge');
    for (let i = 0; i < 3; i++) ok({ type: 'reveal', contextId: 'show', personId: 'p1' });
    const paid = Object.fromEntries(s.project('q', 'p1').decided.filter(d => d.question === 'merge').map(d => [d.playerId, d.points]));
    assert.deepEqual(paid, { p1: 2, p2: 0 }, 'Ann said Episode 3');
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test("bounties: a starter of yours voting out a starter of theirs moves the bounty's points; a miscounted vote moves nothing", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'g', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'exclusive', order: 'snake' }, count: { start: 2 }, score: { by: 'moments', bounty: { points: 2 } }, rank: { by: 'total' } } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 4 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'bounties are connected: no note');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const bounty = p => s.project('g', p).game.twists.bounty?.[p] ?? 0;
    const starters = {};
    for (const p of ['p1', 'p2']) { const l = s.project('g', p).game.lineup; starters[p] = l.roster.slice(0, l.slots); ok({ type: 'lineup', gameId: 'g', personId: p, eventId: l.epId, ids: starters[p] }); }
    const w = s.snapshot().contexts.show, held = new Set([...starters.p1, ...starters.p2, ...s.project('g', 'p1').game.lineup.roster, ...s.project('g', 'p2').game.lineup.roster]);
    const free = w.participants.map(p => p.id).filter(id => !held.has(id));
    // Episode 1: Ann's starter and someone nobody holds vote out Bo's starter; Bo's starter votes for a free one.
    const [hunter] = starters.p1, [mark] = starters.p2, still = w.participants.map(p => p.id);
    const votes = still.map(id => ({ castawayId: id, votedFor: id === mark ? free[0] : mark }));
    for (const v of votes) v.votesReceived = votes.filter(x => x.votedFor === v.castawayId).length;
    const result = (n, data) => { const ev = s.snapshot().contexts.show.events[n - 1]; ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() }); ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data }); };
    result(1, { events: [{ castawayId: mark, method: 'Voted Out' }], scoringEvents: [], votes });
    for (const p of ['p1', 'p2']) ok({ type: 'reveal', contextId: 'show', personId: p });
    const rec = s.snapshot().games.g.state.episodes[0].voteRecord;
    assert.equal(rec.sure, true); assert.deepEqual(rec.out, [mark]);
    // Ann's one starter took 2 from Bo's starter (every other voter is someone else's or nobody's: Ann's second starter voted too).
    const fromAnn = votes.filter(v => v.votedFor === mark && starters.p1.includes(v.castawayId)).length;
    assert.equal(bounty('p1'), 2 * fromAnn); assert.equal(bounty('p2'), -2 * fromAnn);
    assert.ok(fromAnn >= 1 && hunter);
    // Episode 2: Bo's other starter goes, but research miscounts the votes against them: the record isn't sure, nothing moves.
    const mark2 = starters.p2[1], still2 = still.filter(id => id !== mark);
    const votes2 = still2.map(id => ({ castawayId: id, votedFor: id === mark2 ? free[0] : mark2 }));
    for (const v of votes2) v.votesReceived = votes2.filter(x => x.votedFor === v.castawayId).length + (v.castawayId === mark2 ? 1 : 0);
    const l2 = s.project('g', 'p2').game.lineup; ok({ type: 'lineup', gameId: 'g', personId: 'p2', eventId: l2.epId, ids: l2.roster.filter(id => id !== mark).slice(0, l2.slots) });
    result(2, { events: [{ castawayId: mark2, method: 'Voted Out' }], scoringEvents: [], votes: votes2 });
    for (const p of ['p1', 'p2']) ok({ type: 'reveal', contextId: 'show', personId: p });
    assert.equal(s.snapshot().games.g.state.episodes[1].voteRecord.sure, false);
    assert.equal(bounty('p1'), 2 * fromAnn, 'a record that is not sure is void');
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test("teams of players: drawn from the game's own seed, kept once it starts, each team's points the mean of its members' (exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json'), S = require('../src/lib/game/state-logic');
  const doc = () => D.create({ seed: 6, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 4, pool: 12 } }], people: ['Ann', 'Bo', 'Cy', 'Di'].map(n => ({ id: n.toLowerCase(), name: n })) },
    games: [{ id: 'g', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'total', teams: { of: 2 } } } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 3 } });
  const s = R.open(doc()), again = R.open(doc());
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'drawn teams are connected: no note');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const st = () => s.snapshot().games.g.state;
    assert.equal(st().teamDraw.seed, 'zt-g', "seeded from the game's id, never at random");
    assert.equal(S.TeamLogic.fixed(st()), false, 'not kept before the start');
    const drawn = Object.fromEntries(['ann', 'bo', 'cy', 'di'].map(p => [p, S.TeamLogic.sideOf(st(), p)]));
    assert.deepEqual(Object.fromEntries(['ann', 'bo', 'cy', 'di'].map(p => [p, S.TeamLogic.sideOf(again.snapshot().games.g.state, p)])), drawn, 'the same definition draws the same teams');
    assert.deepEqual(Object.values(drawn).sort(), ['t1', 't1', 't2', 't2'], 'two a team');
    for (const p of ['ann', 'bo', 'cy', 'di']) { const l = s.project('g', p).game.lineup; ok({ type: 'lineup', gameId: 'g', personId: p, eventId: l.epId, ids: l.roster.slice(0, l.slots) }); }
    const w = s.snapshot().contexts.show, ev = w.events[0];
    ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: w.participants.at(-1).id, method: 'Voted Out' }], scoringEvents: w.participants.slice(0, 6).map((c, i) => ({ id: 'm' + i, type: 'rewardWin', castawayId: c.id })) } });
    assert.equal(S.TeamLogic.fixed(st()), true, 'kept once the game has started, as the server keeps it on every write');
    assert.deepEqual(Object.fromEntries(['ann', 'bo', 'cy', 'di'].map(p => [p, S.TeamLogic.sideOf(st(), p)])), drawn, 'kept as drawn');
    for (const p of ['ann', 'bo', 'cy', 'di']) ok({ type: 'reveal', contextId: 'show', personId: p });
    const v = s.project('g', 'ann').game, total = new Map(v.table.map(r => [r.playerId, r.total]));
    for (const t of v.teams.teams) { const m = t.members.map(id => total.get(id)); assert.ok(Math.abs(t.points - m.reduce((a, b) => a + b, 0) / m.length) < 1e-9, t.id + ' is its members\' mean'); }
    assert.equal(v.teams.yours, drawn.ann);
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); again.dispose(); }
});

test('parlays: right on every leg in a window multiplies each leg; one leg wrong or unanswered multiplies nothing (exact replay)', () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 3, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }, { id: 'p3', name: 'Cy' }] },
    games: [{ id: 'q', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, score: { by: 'answers', parlays: [{ of: ['boot', 'happens'], times: 3 }] } } }], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 3 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'parlays are connected: no note');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const [x, y] = s.project('q', 'p1').questions.find(q => q.id === 'boot').options.map(o => o.id);
    const say = (p, question, answer) => ok({ type: 'answer', gameId: 'q', personId: p, question, episode: 1, answer });
    say('p1', 'boot', x); say('p1', 'happens', 'yes');   // both right: 2 x 3 and 1 x 3
    say('p2', 'boot', x); say('p2', 'happens', 'no');    // one right: 2
    say('p3', 'happens', 'yes');                         // a leg unanswered: 1
    const ev = s.snapshot().contexts.show.events[0];
    ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: x, method: 'Voted Out' }], scoringEvents: [{ id: 'r1', type: 'rewardWin', castawayId: y }] } });
    ok({ type: 'reveal', contextId: 'show', personId: 'p1' });
    const paid = id => Object.fromEntries(s.project('q', 'p1').decided.filter(d => d.question === id).map(d => [d.playerId, d.points]));
    assert.deepEqual(paid('boot'), { p1: 6, p2: 2 });
    assert.deepEqual(paid('happens'), { p1: 3, p2: 0, p3: 1 });
    assert.deepEqual(Object.fromEntries(s.project('q', 'p1').game.table.map(r => [r.playerId, r.total])), { p1: 9, p2: 2, p3: 1 });
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test("multipliers: episode 1's and the finale's points multiply, every other episode's don't (paired sessions with and without times; exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const { outcome } = require('../tools/gameplay-bench/explorer/runtime-data.cjs'), SURVIVOR = require('../src/lib/game/formats').formatFor('survivor');
  const times = [{ times: 2, episode: 1 }, { times: 3, finale: true }];
  const def = withTimes => D.create({ seed: 9, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 8 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [
      { id: 'd', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments', ...(withTimes ? { times } : {}) }, rank: { by: 'total' } } },
      { id: 'k', contextId: 'show', timing: 'live-only', spec: { get: { by: 'pick', each: 1, repeat: 'any' }, score: { by: 'moments', ...(withTimes ? { times } : {}) }, rank: { by: 'total' } } },
    ], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 3 } });
  // The same walk on both: each seat's lineup and pick for episodes 2 and 3, an ordinary episode 2, then the finale (a winner).
  const walk = s => {
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    for (const n of [2, 3]) {
      let picked;
      for (const p of ['p1', 'p2']) {
        const v = s.project('d', p).game.lineup; ok({ type: 'lineup', gameId: 'd', personId: p, eventId: v.epId, ids: v.roster.slice(0, v.slots) });
        const k = s.project('k', p).game.pick; ok({ type: 'pick', gameId: 'k', personId: p, eventId: k.epId, ids: k.available.slice(0, 1) }); picked ??= k.available[0];
      }
      const w = s.snapshot().contexts.show, ev = w.events[n - 1], gone = new Set(w.facts.flatMap(f => (f.data.events || []).map(e => e.castawayId)));
      const still = w.participants.map(x => x.id).filter(id => !gone.has(id)), held = s.project('d', 'p1').game.lineup?.roster?.[0] ?? still[0];
      let i = 0; const events = n === 3 ? outcome(SURVIVOR, still, () => i++) : [{ castawayId: still.at(-1), method: 'Voted Out' }];
      ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
      ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: n === 3 ? outcome(SURVIVOR, still, () => i++, true) : events, scoringEvents: [{ id: 'm' + n, type: 'individualImmunity', castawayId: held }, { id: 'r' + n, type: 'rewardWin', castawayId: picked }] } });
      if (n === 2) ok({ type: 'reveal', contextId: 'show', personId: 'p1' }), ok({ type: 'reveal', contextId: 'show', personId: 'p2' });
    }
    ok({ type: 'reveal', contextId: 'show', personId: 'p1' });   // Ann sees the finale; Bo stays through episode 2
  };
  const a = R.open(def(true)), b = R.open(def(false));
  try {
    assert.deepEqual(a.export().preparation.notes || [], [], 'multipliers are connected: no note');
    walk(a); walk(b);
    // The season grid's rows (a draft's and a pick game's alike): each seat's points for each episode.
    const weeks = (s, g, viewer) => Object.fromEntries(Object.entries(s.project(g, viewer).game.plays.rows).map(([p, rows]) => [p, Object.fromEntries(rows.map(w => [w.episode, w.points]))]));
    for (const g of ['d', 'k']) {
      const x = weeks(a, g, 'p1'), y = weeks(b, g, 'p1');
      assert.equal(a.snapshot().games[g].state.episodes[2].number, 3);
      for (const p of ['p1', 'p2']) for (const n of [1, 2, 3]) assert.equal(x[p][n], y[p][n] * ({ 1: 2, 3: 3 }[n] ?? 1), `${g} ${p} episode ${n}: ${x[p][n]} against ${y[p][n]}`);
      assert.ok([1, 3].some(n => ['p1', 'p2'].some(p => y[p][n] !== 0)), g + ': some multiplied episode scored, so the check means something');
      // Bo, before the finale, sees episode 1 doubled and nothing of the finale.
      const bo = weeks(a, g, 'p2');
      for (const p of ['p1', 'p2']) { assert.equal(bo[p][3], undefined); assert.equal(bo[p][1], x[p][1]); }
    }
    const exported = a.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { a.dispose(); b.dispose(); }
});

test("rollovers: a window nobody earns on carries its points into the next (the open window's jackpot shows it); a win resets it (exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'q', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, ask: [{ ...Q.spec.ask[0], points: 3, rollover: true }, Q.spec.ask[1]] } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 5 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'rollovers are connected: no note');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const opts = s.project('q', 'p1').questions.find(q => q.id === 'boot').options.map(o => o.id);
    const play = (n, answers, out) => {
      for (const [p, a] of Object.entries(answers)) ok({ type: 'answer', gameId: 'q', personId: p, question: 'boot', episode: n, answer: a });
      const ev = s.snapshot().contexts.show.events[n - 1];
      ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
      ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: out, method: 'Voted Out' }], scoringEvents: [] } });
      for (const p of ['p1', 'p2']) ok({ type: 'reveal', contextId: 'show', personId: p });
    };
    const view = () => s.project('q', 'p1');
    assert.equal(view().worth['boot|1'], 3, "the first window's worth is its points");
    play(1, { p1: opts[0], p2: opts[1] }, opts[2]);            // nobody right: 3 carries
    assert.equal(view().worth['boot|2'], 6, "the open window's jackpot: 3 + 3 carried");
    play(2, {}, opts[3]);                                     // nobody answered: 6 carries
    assert.equal(view().worth['boot|3'], 9);
    play(3, { p1: opts[4], p2: opts[5] }, opts[4]);           // Ann right: the 9
    assert.deepEqual(view().earned['boot|3'], { p1: 9 });
    assert.equal(view().worth['boot|4'], 3, 'a win resets it');
    assert.equal(Object.fromEntries(view().game.table.map(r => [r.playerId, r.total])).p1, 9);
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test("co-op lost: a season-long answer settled at the finale after the couch lost counts for nothing in the standings (the walk's totals, as the server)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const { outcome } = require('../tools/gameplay-bench/explorer/runtime-data.cjs'), SURVIVOR = require('../src/lib/game/formats').formatFor('survivor');
  const winner = { id: 'winner', ask: 'Who wins?', answer: 'person', points: 3, settle: { by: 'results', take: 'winner' }, asked: 'once', closes: 'finale', pick: 1, from: 'cast' };
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 8 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'q', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, ask: [Q.spec.ask[0], winner], score: { by: 'answers', lives: 1 }, rank: { by: 'coop' } } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 3 } }));
  try {
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const w = s.snapshot().contexts.show, ids = w.participants.map(x => x.id);
    // Ann calls the winner before anything airs; the boot nobody answers costs the couch its one life at episode 1.
    let i = 0; const finale = outcome(SURVIVOR, ids.slice(1), () => i++, true), champ = finale.find(e => e.method === SURVIVOR.winnerExitMethod).castawayId;
    ok({ type: 'answer', gameId: 'q', personId: 'p1', question: 'winner', episode: 0, answer: champ });
    const result = (n, events) => { const ev = s.snapshot().contexts.show.events[n - 1]; ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() }); ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events, scoringEvents: [] } }); for (const p of ['p1', 'p2']) ok({ type: 'reveal', contextId: 'show', personId: p }); };
    result(1, [{ castawayId: ids[0], method: 'Voted Out' }]);
    assert.equal(s.project('q', 'p1').game.over, true, 'the couch has lost');
    const ev2 = s.snapshot().contexts.show.events[1]; ok({ type: 'clock', at: new Date(Date.parse(ev2.airAt) + 3600000).toISOString() });
    ok({ type: 'results', contextId: 'show', eventId: ev2.id, source: 'provider-fixture', resultStatus: 'final', data: { events: finale, scoringEvents: [] } });
    for (const p of ['p1', 'p2']) ok({ type: 'reveal', contextId: 'show', personId: p });
    const v = s.project('q', 'p1');
    // The sheet grades on the copy cut at the game's end (episode 1, as answer-points.ts walked builds it): no winner was known
    // then, so Ann's right call pays nothing there either (core-runtime-16; before, the runtime's sheet paid it 3).
    assert.equal(v.decided.find(d => d.question === 'winner' && d.playerId === 'p1').points, 0, 'nothing on the sheet after the game ended');
    assert.deepEqual(Object.fromEntries(v.game.table.map(r => [r.playerId, r.total])), { p1: 0, p2: 0 }, "nothing after the couch lost counts");
  } finally { s.dispose(); }
});

test('whole-game moment questions: first and happened settle when it happens; who and how many at the game\'s end (exact replay)', () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const { outcome } = require('../tools/gameplay-bench/explorer/runtime-data.cjs'), SURVIVOR = require('../src/lib/game/formats').formatFor('survivor');
  const once = (id, answer, take, moment, points, extra = {}) => ({ id, ask: id, answer, points, asked: 'once', closes: 'start', settle: { by: 'moment', moment, take }, ...(answer === 'person' ? { from: 'cast' } : {}), ...extra });
  const ask = [once('who', 'person', 'who', 'idolFound', 2, { pick: 2 }), once('first', 'person', 'first', 'idolFound', 3, { pick: 1 }), once('reward', 'yesNo', 'happened', 'rewardWin', 1), once('count', 'number', 'count', 'idolFound', 3)];
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'q', contextId: 'show', timing: 'live-only', spec: { get: { by: 'none' }, score: { by: 'answers' }, rank: { by: 'total' }, ask } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 4 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'whole-game moment questions are connected: no note');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const ids = s.project('q', 'p1').questions.find(q => q.id === 'who').options.map(o => o.id);
    const say = (p, question, answer) => ok({ type: 'answer', gameId: 'q', personId: p, question, episode: 0, answer });
    say('p1', 'who', [ids[0], ids[1]]); say('p1', 'first', ids[0]); say('p1', 'reward', 'yes'); say('p1', 'count', 2);
    say('p2', 'who', [ids[2], ids[3]]); say('p2', 'first', ids[1]); say('p2', 'reward', 'no'); say('p2', 'count', 1);
    const play = (n, scoring, finale) => {
      const w = s.snapshot().contexts.show, ev = w.events[n - 1], gone = new Set(w.facts.flatMap(f => (f.data.events || []).map(e => e.castawayId))), still = w.participants.map(x => x.id).filter(id => !gone.has(id));
      ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
      let i = 0; ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: finale ? outcome(SURVIVOR, still, () => i++, true) : [{ castawayId: still.at(-1), method: 'Voted Out' }], scoringEvents: scoring } });
      for (const p of ['p1', 'p2']) ok({ type: 'reveal', contextId: 'show', personId: p });
    };
    const paid = () => Object.fromEntries(s.project('q', 'p1').decided.map(d => [d.playerId + ' ' + d.question, d.verdict?.state === 'known' ? d.points : 'waiting']));
    assert.equal(s.project('q', 'p1').questions.every(q => q.closed), false, 'open before the game starts');
    play(1, [{ id: 'a', type: 'individualImmunity', castawayId: ids[3] }]);
    assert.equal(s.project('q', 'p1').questions.every(q => q.closed), true, 'locked at the game\'s start');
    assert.equal(paid()['p1 first'], 'waiting', 'no idol yet');
    play(2, [{ id: 'b', type: 'idolFound', castawayId: ids[1] }, { id: 'c', type: 'rewardWin', castawayId: ids[2] }]);
    // The first idol (ids[1], Bo's) and a reward win settle at once; who found one and how many wait for the end.
    assert.deepEqual(paid(), { 'p1 who': 'waiting', 'p1 first': 0, 'p1 reward': 1, 'p1 count': 'waiting', 'p2 who': 'waiting', 'p2 first': 3, 'p2 reward': 0, 'p2 count': 'waiting' });
    play(3, [{ id: 'd', type: 'idolFound', castawayId: ids[0] }]);
    play(4, [], true);
    // The end: idols to ids[1] and ids[0], two of them: Ann's two picks 2 each, her count of 2 right; Bo nothing more.
    assert.deepEqual(paid(), { 'p1 who': 4, 'p1 first': 0, 'p1 reward': 1, 'p1 count': 3, 'p2 who': 0, 'p2 first': 3, 'p2 reward': 0, 'p2 count': 0 });
    assert.deepEqual(Object.fromEntries(s.project('q', 'p1').game.table.map(r => [r.playerId, r.total])), { p1: 8, p2: 3 });
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test('a game that ends early settles its whole-game questions at its end, on the sheet as in the table (the copy cut at the end, as answer-points.ts walked)', () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const { outcome } = require('../tools/gameplay-bench/explorer/runtime-data.cjs'), SURVIVOR = require('../src/lib/game/formats').formatFor('survivor');
  const ask = [Q.spec.ask[0], { id: 'idols', ask: 'Who finds an idol?', answer: 'person', points: 5, pick: 1, asked: 'once', closes: 'start', settle: { by: 'moment', moment: 'idolFound', take: 'who' }, from: 'cast' }];
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'q', contextId: 'show', timing: 'live-only', spec: { get: { by: 'none' }, score: { by: 'answers' }, rank: { by: 'total', race: { to: 2 } }, ask } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 3 } }));
  try {
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const ids = s.project('q', 'p1').questions.find(q => q.id === 'idols').options.map(o => o.id);
    ok({ type: 'answer', gameId: 'q', personId: 'p1', question: 'idols', episode: 0, answer: ids[0] });
    ok({ type: 'answer', gameId: 'q', personId: 'p2', question: 'boot', episode: 1, answer: ids[9] });
    const result = (n, data) => { const ev = s.snapshot().contexts.show.events[n - 1]; ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() }); ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data }); for (const p of ['p1', 'p2']) ok({ type: 'reveal', contextId: 'show', personId: p }); };
    const table = () => Object.fromEntries(s.project('q', 'p1').game.table.map(r => [r.playerId, r.total])), sheet = () => s.project('q', 'p1').decided.find(d => d.question === 'idols');
    result(1, { events: [{ castawayId: ids[9], method: 'Voted Out' }], scoringEvents: [] });   // Bo right: the race to 2 is won
    assert.equal(s.project('q', 'p1').game.over, true); assert.deepEqual(table(), { p1: 0, p2: 2 });
    result(2, { events: [{ castawayId: ids[8], method: 'Voted Out' }], scoringEvents: [{ id: 'i', type: 'idolFound', castawayId: ids[0] }] });   // Ann's pick finds an idol, after the end
    assert.equal(sheet().verdict.state, 'off', 'settled at the end (episode 1): nobody found an idol by then, so it is void');
    let i = 0; result(3, { events: outcome(SURVIVOR, ids.slice(0, 8).reverse(), () => i++, true), scoringEvents: [] });
    assert.deepEqual([sheet().verdict.state, sheet().points], ['off', 0], 'an idol found after the game ended never counts on the sheet');
    assert.deepEqual(table(), { p1: 0, p2: 2 }, 'nor in the standings');
  } finally { s.dispose(); }
});

test("Weekly Calls: a person's calls on the context, refused as the calls route refuses them, settled by the season's results into the table (exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 8 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'wc', contextId: 'show', timing: 'live-only', spec: { preset: 'weekly-calls' } }], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 3 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'Weekly Calls is connected: no note');
    const call = (personId, episode, question, answer) => s.apply({ type: 'call', contextId: 'show', personId, episode, question, answer });
    const ok = r => assert.equal(r.status, 'accepted', r.message), no = (r, words) => { assert.equal(r.status, 'rejected'); assert.match(r.message, words); };
    const first = s.project('wc', 'p1').calls;
    assert.equal(first[1].status, 'open'); assert.equal(first[2].refused, 409, 'only the next episode to air is open');
    const out = first[1].questions.find(q => q.key === 'out'), m = first[1].questions.find(q => q.kind === 'yesno');
    assert.equal(first[1].questions.length, 2, "two calls an episode: who goes home and one of the format's moments");
    ok(call('p1', 1, 'out', out.options[0].key)); ok(call('p1', 1, m.key, 'yes')); ok(call('p2', 1, 'out', out.options[1].key));
    no(call('p2', 2, 'out', out.options[1].key), /Calls are open for Episode 1/); no(call('p2', 1, 'out', 'nobody'), /Call someone still in/); no(call('p2', 1, m.key, 'maybe'), /Yes or no/);
    const ev = s.snapshot().contexts.show.events[0];
    ok(s.apply({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() }));
    no(call('p2', 1, m.key, 'no'), /closed when it started/);
    ok(s.apply({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: out.options[0].key, method: 'Voted Out' }], scoringEvents: [{ id: 'moment-wc-1', type: m.key.slice(2), castawayId: out.options[2].key }] } }));
    // Bo hasn't seen episode 1: calling episode 2 needs it seen (its cast pick says who's still in).
    no(call('p2', 2, 'out', out.options[1].key), /See Episode 1 first/);
    ok(s.apply({ type: 'reveal', contextId: 'show', personId: 'p1' }));
    const v = s.project('wc', 'p1');
    assert.deepEqual(v.calls[1].verdicts, { out: { state: 'known', right: [out.options[0].key] }, [m.key]: { state: 'known', right: ['yes'] } });
    assert.deepEqual(Object.fromEntries(v.game.table.map(r => [r.playerId, r.total])), { p1: 2, p2: 0 }, 'Ann right twice, Bo wrong');
    assert.ok(!v.calls[2].questions.some(q => q.key === 'out' && q.options.some(o => o.key === out.options[0].key)), 'who went home is no longer callable');
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test('confidence picks: rank who goes home surest first; a right pick pays its points times its weight (the first `pick`); refused as the engine refuses (exact replay)', () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const ask = [{ id: 'sure', ask: 'Rank who goes home, surest first', answer: 'confidence', points: 1, pick: 3, asked: 'each', settle: { by: 'results', take: 'out' }, closes: 'start' }];
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 3, pool: 8 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }, { id: 'p3', name: 'Cy' }] },
    games: [{ id: 'q', contextId: 'show', timing: 'live-only', spec: { get: { by: 'none' }, score: { by: 'answers' }, rank: { by: 'total' }, ask } }], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 3 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'confidence picks are connected: no note');
    const ids = s.project('q', 'p1').questions[0].options.map(o => o.id);
    const say = (p, answer) => s.apply({ type: 'answer', gameId: 'q', personId: p, question: 'sure', episode: 1, answer });
    for (const [p, a] of [['p1', [ids[0], ids[1], ids[2]]], ['p2', [ids[1], ids[0], ids[3]]], ['p3', [ids[4]]]]) assert.equal(say(p, a).status, 'accepted');
    assert.match(say('p3', [ids[1], ids[1]]).message, /Rank each one once/); assert.match(say('p3', ids.slice(0, 4)).message, /Rank 3 at most/); assert.match(say('p3', [ids[1], 'nobody']).message, /Rank only who is still in/);
    const ev = s.snapshot().contexts.show.events[0];
    s.apply({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    assert.equal(s.apply({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: ids[1], method: 'Voted Out' }], scoringEvents: [] } }).status, 'accepted');
    for (const p of ['p1', 'p2', 'p3']) s.apply({ type: 'reveal', contextId: 'show', personId: p });
    // ids[1] went home: Ann ranked them second (weight 2), Bo first (3), Cy not at all.
    assert.deepEqual(Object.fromEntries(s.project('q', 'p1').game.table.map(r => [r.playerId, r.total])), { p1: 2, p2: 3, p3: 0 });
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test("the weekly card: drawn in turn from the spec's list, only its moments count that week, each a hit once for each pick (exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json'), Spec = require('../src/lib/game/game-spec');
  const card = { from: 'moments', each: 3, of: ['rewardWin', 'individualImmunity', 'satOut', 'idolFound', 'challengeThird'] };
  const spec = { get: { by: 'pick', each: 1, repeat: 'any' }, count: { pick: true }, score: { by: 'moments', only: 'card', hits: 'pick' }, rank: { by: 'total' }, card };
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 8 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'c', contextId: 'show', timing: 'live-only', spec }], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 3 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'a drawn card is connected: no note');
    const lines = n => Spec.cardLines(Spec.cardOf(Spec.fullSpec(spec)), n, null);
    assert.deepEqual([1, 2, 3].map(lines), [['rewardWin', 'individualImmunity', 'satOut'], ['idolFound', 'challengeThird', 'rewardWin'], ['individualImmunity', 'satOut', 'idolFound']], 'three a week, in turn');
    const picked = {};
    for (const p of ['p1', 'p2']) { const k = s.project('c', p).game.pick; picked[p] = k.available[p === 'p1' ? 0 : 1]; assert.equal(s.apply({ type: 'pick', gameId: 'c', personId: p, eventId: k.epId, ids: [picked[p]] }).status, 'accepted'); }
    const ev = s.snapshot().contexts.show.events[0];
    s.apply({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    // Ann's pick: two card moments and the same one again (a hit once); Bo's: one card moment and one off this week's card.
    assert.equal(s.apply({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: 'show-participant-8', method: 'Voted Out' }], scoringEvents: [
      { id: 'm1', type: 'rewardWin', castawayId: picked.p1 }, { id: 'm2', type: 'individualImmunity', castawayId: picked.p1 }, { id: 'm3', type: 'rewardWin', castawayId: picked.p1 },
      { id: 'm4', type: 'idolFound', castawayId: picked.p2 }, { id: 'm5', type: 'satOut', castawayId: picked.p2 }] } }).status, 'accepted');
    for (const p of ['p1', 'p2']) s.apply({ type: 'reveal', contextId: 'show', personId: p });
    assert.deepEqual(Object.fromEntries(s.project('c', 'p1').game.table.map(r => [r.playerId, r.total])), { p1: 2, p2: 1 }, 'idolFound is off episode 1\'s card');
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test("beat the bot: a right answer scores only where the bot's call isn't right; the bot calls before the lock, hidden until it; with no call the window plays (exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const ask = Q.spec.ask.map(q => ({ ...q, beat: { by: 'bot', none: 'plays' } }));
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 3, pool: 8 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }, { id: 'p3', name: 'Cy' }] },
    games: [{ id: 'q', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, ask } }], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 3 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'beat the bot is connected: no note');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const ids = s.project('q', 'p1').questions.find(q => q.id === 'boot').options.map(o => o.id);
    ok({ type: 'botCall', gameId: 'q', question: 'boot', episode: 1, answer: ids[0] });       // the bot names the boot
    ok({ type: 'botCall', gameId: 'q', question: 'happens', episode: 1, answer: 'no' });      // and says no (wrong)
    for (const [p, b, h] of [['p1', ids[0], 'yes'], ['p2', ids[1], 'yes'], ['p3', ids[0], 'no']]) { ok({ type: 'answer', gameId: 'q', personId: p, question: 'boot', episode: 1, answer: b }); ok({ type: 'answer', gameId: 'q', personId: p, question: 'happens', episode: 1, answer: h }); }
    assert.deepEqual(s.project('q', 'p1').game.bot, { called: 0, right: 0, vs: {} }, 'nothing of the bot shows before the lock');
    const result = (n, data) => { const ev = s.snapshot().contexts.show.events[n - 1]; ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() }); return ev; };
    const ev = result(1);
    assert.match(s.apply({ type: 'botCall', gameId: 'q', question: 'boot', episode: 1, answer: ids[1] }).message, /before the window's first lock/);
    ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: ids[0], method: 'Voted Out' }], scoringEvents: [{ id: 'moment-beat-1', type: 'rewardWin', castawayId: ids[3] }] } });
    for (const p of ['p1', 'p2', 'p3']) ok({ type: 'reveal', contextId: 'show', personId: p });
    const paid = () => Object.fromEntries(s.project('q', 'p1').decided.filter(d => d.episode >= 1).map(d => [d.playerId + ' ' + d.question + ' ' + d.episode, d.points]));
    // The bot named the boot: Ann and Cy, right, score nothing for it. It said no to a reward win and was wrong: Ann and Bo score.
    assert.deepEqual(paid(), { 'p1 boot 1': 0, 'p1 happens 1': 1, 'p2 boot 1': 0, 'p2 happens 1': 1, 'p3 boot 1': 0, 'p3 happens 1': 0 });
    assert.deepEqual(s.project('q', 'p1').game.bot, { called: 2, right: 1, vs: { p1: { beat: 1, beaten: 1 }, p2: { beat: 1, beaten: 1 }, p3: { beat: 0, beaten: 1 } } });
    // Episode 2 with no bot call: it plays, every right answer scores.
    const ids2 = s.project('q', 'p1').questions.find(q => q.id === 'boot').options.map(o => o.id);
    ok({ type: 'answer', gameId: 'q', personId: 'p1', question: 'boot', episode: 2, answer: ids2[0] });
    const ev2 = result(2);
    ok({ type: 'results', contextId: 'show', eventId: ev2.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: ids2[0], method: 'Voted Out' }], scoringEvents: [{ id: 'moment-beat-2', type: 'satOut', castawayId: ids2[1] }] } });
    ok({ type: 'reveal', contextId: 'show', personId: 'p1' });
    assert.equal(paid()['p1 boot 2'], 2);
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test("Outlast in reverse: each holding is worth the cast's size + 1 less its forward value, gone home or still in (paired with the same game played forward; exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const def = reverse => D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 8 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'o', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { all: true }, score: { by: 'place', ...(reverse ? { reverse: true } : {}) }, rank: { by: 'total' } } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 3, eventCount: 5 } });
  const a = R.open(def(true)), b = R.open(def(false));
  try {
    assert.deepEqual(a.export().preparation.notes || [], [], 'Outlast in reverse is connected: no note');
    const size = a.snapshot().contexts.show.participants.length;
    const rows = s => Object.fromEntries(s.project('o', 'p1').game.table.map(r => [r.playerId, { total: r.total, held: r.team.length }]));
    const x = rows(a), y = rows(b);
    for (const p of ['p1', 'p2']) {
      assert.ok(x[p].held > 0);
      assert.equal(x[p].total, (size + 1) * x[p].held - y[p].total, `${p}: reverse ${x[p].total} against forward ${y[p].total}, ${x[p].held} held of ${size}`);
    }
    const exported = a.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { a.dispose(); b.dispose(); }
});

test("the top scorer's twist: episode 1's top scorer alone chooses episode 2's twist until it closes; filed and stamped then, it doubles that episode's points (exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const spec = { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments', twist: { of: [{ id: 'double', name: 'Double points', times: 2 }, { id: 'half', name: 'Half points', times: 0.5 }] } }, rank: { by: 'total' } };
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 8 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'g', contextId: 'show', timing: 'live-only', spec }], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 3 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'the twist is connected: no note');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); }, no = (a, words) => assert.match(s.apply(a).message || '', words);
    const lineups = () => { for (const p of ['p1', 'p2']) { const l = s.project('g', p).game.lineup; ok({ type: 'lineup', gameId: 'g', personId: p, eventId: l.epId, ids: l.roster.slice(0, l.slots) }); } };
    const result = (n, mover) => { lineups(); const ev = s.snapshot().contexts.show.events[n - 1]; ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
      ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: 'show-participant-' + (9 - n), method: 'Voted Out' }], scoringEvents: [{ id: 'moment-tw-' + n, type: 'individualImmunity', castawayId: s.project('g', mover).game.lineup?.roster?.[0] ?? s.snapshot().games.g.state.episodes[n - 1].lineups[mover][0] }] } });
      for (const p of ['p1', 'p2']) ok({ type: 'reveal', contextId: 'show', personId: p }); };
    result(1, 'p1');   // Ann's starter wins immunity: she tops episode 1
    const next = s.project('g', 'p1').twist.next;
    assert.deepEqual([next.episode, next.youChoose, next.choice], [2, true, null]);
    no({ type: 'twist', gameId: 'g', personId: 'p2', twist: 'double' }, /You don't choose Episode 2's twist/);
    no({ type: 'twist', gameId: 'g', personId: 'p1', twist: 'triple' }, /isn't one of this game's twists/);
    ok({ type: 'twist', gameId: 'g', personId: 'p1', twist: 'double' });
    assert.equal(s.snapshot().games.g.state.episodes[1].twist, undefined, 'private and unstamped while open');
    const ev2 = s.snapshot().contexts.show.events[1];
    ok({ type: 'clock', at: new Date(Date.parse(ev2.airAt) - 11 * 3600000).toISOString() });   // past the close, 12 hours before
    assert.deepEqual(s.snapshot().games.g.state.episodes[1].twist, { id: 'double', by: 'p1', how: 'chosen' });
    no({ type: 'twist', gameId: 'g', personId: 'p1', twist: 'half' }, /Watch Episode 2's results first/);
    result(2, 'p2');   // Bo's starter wins immunity in a doubled episode
    const sq = Object.fromEntries(Object.entries(s.project('g', 'p1').game.plays.rows).map(([k, rows]) => [k, rows.find(w => w.episode === 2).points]));
    assert.equal(sq.p2, 8, 'individual immunity, 4, doubled');
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test("a captain: one of your starters named with the lineup; their points multiply; one off the lineup is refused; benching them takes the armband off (exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const spec = { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments', captain: { times: 2 } }, rank: { by: 'total' } };
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 8 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'g', contextId: 'show', timing: 'live-only', spec }], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 3 } }));
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'a captain is connected: no note');
    const l1 = s.project('g', 'p1').game.lineup, l2 = s.project('g', 'p2').game.lineup;
    assert.equal(s.apply({ type: 'lineup', gameId: 'g', personId: 'p1', eventId: l1.epId, ids: l1.roster.slice(0, 2), captainId: l1.roster[0] }).status, 'accepted');
    assert.match(s.apply({ type: 'lineup', gameId: 'g', personId: 'p2', eventId: l2.epId, ids: l2.roster.slice(0, 2), captainId: l2.roster[2] }).message, /Your captain is one of your starters/);
    assert.equal(s.apply({ type: 'lineup', gameId: 'g', personId: 'p2', eventId: l2.epId, ids: l2.roster.slice(0, 2) }).status, 'accepted');
    const ev = s.snapshot().contexts.show.events[0];
    s.apply({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    assert.equal(s.apply({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: 'show-participant-8', method: 'Voted Out' }], scoringEvents: [{ id: 'cap-1', type: 'individualImmunity', castawayId: l1.roster[0] }, { id: 'cap-2', type: 'individualImmunity', castawayId: l2.roster[0] }] } }).status, 'accepted');
    for (const p of ['p1', 'p2']) s.apply({ type: 'reveal', contextId: 'show', personId: p });
    assert.deepEqual(Object.fromEntries(s.project('g', 'p1').game.table.map(r => [r.playerId, r.total])), { p1: 8, p2: 4 }, "Ann's captain's immunity doubled; Bo named none");
    // Episode 2: Ann's captain carries until she benches them; then she has none.
    const S = require('../src/lib/game/state-logic'), ep2 = () => s.snapshot().games.g.state.episodes[1];
    assert.equal(S.ActiveRosterLogic.captainFor(s.snapshot().games.g.state, ep2().id, 'p1'), l1.roster[0], 'the captain carries, as a lineup does');
    const l1b = s.project('g', 'p1').game.lineup;
    assert.equal(s.apply({ type: 'lineup', gameId: 'g', personId: 'p1', eventId: l1b.epId, ids: [l1b.roster[1], l1b.roster[2]] }).status, 'accepted');
    assert.equal(S.ActiveRosterLogic.captainFor(s.snapshot().games.g.state, ep2().id, 'p1'), null, 'benched, no armband');
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test("secret roles: dealt once the game starts from the game's own seed; each holder told alone; points off the table until the reveal, then on it (exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const { outcome } = require('../tools/gameplay-bench/explorer/runtime-data.cjs'), SURVIVOR = require('../src/lib/game/formats').formatFor('survivor');
  const spec = { get: { by: 'draft', each: 2, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments', roles: { count: 1, points: 2, on: 'out' } }, rank: { by: 'total' } };
  const def = () => D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 3, pool: 8 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }, { id: 'p3', name: 'Cy' }] },
    games: [{ id: 'g', contextId: 'show', timing: 'live-only', spec }], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 3 } });
  const s = R.open(def());
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'secret roles are connected: no note');
    assert.equal(s.snapshot().stores.roles.g, null, 'not dealt before the game starts');
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const play = n => {
      for (const p of ['p1', 'p2', 'p3']) { const l = s.project('g', p).game.lineup; if (l) ok({ type: 'lineup', gameId: 'g', personId: p, eventId: l.epId, ids: l.roster.slice(0, l.slots) }); }
      const bo = s.project('g', 'p2').game.lineup?.roster || [], w = s.snapshot().contexts.show, ev = w.events[n - 1], gone = new Set(w.facts.flatMap(f => (f.data.events || []).map(e => e.castawayId))), still = w.participants.map(x => x.id).filter(id => !gone.has(id));
      ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
      let i = 0; ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: n === 3 ? outcome(SURVIVOR, still, () => i++, true) : [{ castawayId: still.find(id => bo.includes(id)) ?? still[0], method: 'Voted Out' }], scoringEvents: [] } });
      for (const p of ['p1', 'p2', 'p3']) ok({ type: 'reveal', contextId: 'show', personId: p });
    };
    play(1);
    const deal = s.snapshot().stores.roles.g, holder = deal.holders[0];
    assert.equal(deal.seed, 'zt-g'); assert.deepEqual(deal.holders.length, 1);
    const other = ['p1', 'p2', 'p3'].find(p => p !== holder);
    assert.equal(s.project('g', other).roles.mine, null, 'nobody else is told');
    assert.equal(s.project('g', holder).roles.mine.role, 'Traitor');
    const before = Object.fromEntries(s.project('g', 'p1').game.table.map(r => [r.playerId, r.total]));
    play(2);
    assert.ok(s.project('g', holder).roles.mine.points > 0, 'the holder sees their own points');
    assert.equal(s.project('g', 'p1').roles.revealed, null);
    play(3);
    assert.deepEqual(s.project('g', 'p1').roles.revealed.holders.map(p => p.playerId), [holder], 'revealed at the game\'s end');
    // The same deal from the same definition (the game's own seed).
    const again = R.open(def()); try { again.apply({ type: 'clock', at: '2099-01-11T13:00:00.000Z' }); assert.deepEqual(again.snapshot().stores.roles.g?.holders ?? deal.holders, deal.holders); } finally { again.dispose(); }
    assert.ok(before);
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test("a draft spread across tribes: the world's tribes in blocks; each team drafted with no tribe past its share and every tribe in it (shared and exclusive; exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  for (const own of ['shared', 'exclusive']) {
    const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 3, pool: own === 'exclusive' ? 18 : 12 }, tribes: 3 }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }, { id: 'p3', name: 'Cy' }] },
      games: [{ id: 'g', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 4, own, order: own === 'exclusive' ? 'snake' : 'blind', across: { of: 'group', then: 'keep' } }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'total' } } }],
      situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 3 } }));
    try {
      assert.deepEqual(s.export().preparation.notes || [], [], 'a spread draft is connected: no note');
      const st = s.snapshot().games.g.state;
      assert.deepEqual(st.tribes.map(t => t.id), ['tribe-1', 'tribe-2', 'tribe-3']);
      assert.deepEqual(st.castaways.slice(0, 4).map(c => c.tribeId), ['tribe-1', 'tribe-1', 'tribe-1', 'tribe-1'], 'tribes in blocks, as a cast lists them'); // (exclusive: 18, so the draft has room; drafting the whole cast, the rule lets the last teams take what's left)
      for (const p of st.players) {
        const counts = ['tribe-1', 'tribe-2', 'tribe-3'].map(tr => st.castaways.filter(c => c.ownerIds.includes(p.id) && c.tribeId === tr).length);
        assert.deepEqual([...counts].sort(), [1, 1, 2], own + ' ' + p.id + ': four across three tribes is 2, 1, 1 (got ' + counts + ')');
      }
      if (own === 'exclusive') assert.ok(st.castaways.every(c => c.ownerIds.length <= 1), 'nobody shares');
      const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
    } finally { s.dispose(); }
  }
});

test("a survival pool's mulligans and buyback: the first wrong pick forgiven, the night the lives run out bought back for its cost, the next wrong one out (paired with a plain pool; exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const def = riders => D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'g', contextId: 'show', timing: 'live-only', spec: { get: { by: 'pick', each: 1, repeat: 'any' }, score: { by: 'survive', lives: 1, ...(riders ? { mulligans: 1, buyback: { times: 1, before: null, cost: 3 } } : {}) }, rank: { by: 'standing' } } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 5 } });
  // Ann's pick goes home every night; Bo's never does.
  const night = (s, n) => {
    const picked = {};
    for (const p of ['p1', 'p2']) { const k = s.project('g', p).game.pick; if (!k?.available?.length) continue; picked[p] = k.available[p === 'p1' ? 0 : 1]; assert.equal(s.apply({ type: 'pick', gameId: 'g', personId: p, eventId: k.epId, ids: [picked[p]] }).status, 'accepted'); }
    const ev = s.snapshot().contexts.show.events[n - 1], gone = picked.p1 ?? s.project('g', 'p2').game.pick?.available?.at(-1);
    s.apply({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    assert.equal(s.apply({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: gone, method: 'Voted Out' }], scoringEvents: [] } }).status, 'accepted');
    for (const p of ['p1', 'p2']) s.apply({ type: 'reveal', contextId: 'show', personId: p });
    return s.project('g', 'p1').game;
  };
  const a = R.open(def(true)), b = R.open(def(false));
  try {
    assert.deepEqual(a.export().preparation.notes || [], [], 'buyback and mulligans are connected: no note');
    assert.deepEqual(a.project('g', 'p1').game.twists.pool, { lives: 1, livesOf: 1, mulligans: 1, mulligansOf: 1, out: null, buyBack: false }, 'one mulligan left before any is used');
    let v = night(a, 1);
    assert.deepEqual([v.twists.pool.lives, v.twists.pool.mulligans, v.twists.pool.out], [1, 0, null], 'night 1: forgiven, no life lost, none left');
    v = night(a, 2);
    assert.deepEqual([v.twists.pool.lives, v.twists.pool.out], [1, null], 'night 2: the life lost, bought back with one');
    assert.equal(v.table.find(r => r.playerId === 'p1').points, -3, 'the buyback cost 3 points');
    assert.equal(v.plays.rows.p1.find(w => w.episode === 2).points, -3, 'its night shows the cost');
    v = night(a, 3);
    assert.deepEqual([v.twists.pool.lives, v.twists.pool.out, v.twists.pool.buyBack], [0, 3, false], 'night 3: out, the buyback spent');
    assert.deepEqual(v.table.map(r => r.playerId), ['p2', 'p1']);
    // The plain pool: out the first night.
    assert.equal(night(b, 1).twists.pool.out, 1);
    const exported = a.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { a.dispose(); b.dispose(); }
});

test("a pool's second pick: beside the first, it counts on a night two go home (void otherwise, or every night with counts); right picks first (exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const def = fallback => D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'g', contextId: 'show', timing: 'live-only', spec: { get: { by: 'pick', each: 1, repeat: 'any', second: { fallback } }, score: { by: 'survive' }, rank: { by: 'streak' } } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 4 } });
  // Each night: Ann picks a, second b; Bo picks c, second d (four castaways still in). `gone(a, b, c, d)` says who goes home.
  const night = (s, n, gone) => {
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
    const k = s.project('g', 'p1').game.pick, [a, b, c, d] = k.available;
    ok({ type: 'pick', gameId: 'g', personId: 'p1', eventId: k.epId, ids: [a] }); ok({ type: 'pick', gameId: 'g', personId: 'p1', eventId: k.epId, ids: [b], second: true });
    ok({ type: 'pick', gameId: 'g', personId: 'p2', eventId: k.epId, ids: [c] }); ok({ type: 'pick', gameId: 'g', personId: 'p2', eventId: k.epId, ids: [d], second: true });
    assert.equal(s.apply({ type: 'pick', gameId: 'g', personId: 'p2', eventId: k.epId, ids: [d, a], second: true }).status, 'rejected', 'a second pick is one castaway');
    const ev = s.snapshot().contexts.show.events[n - 1];
    ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: gone(a, b, c, d).map(id => ({ castawayId: id, method: 'Voted Out' })), scoringEvents: [] } });
    for (const p of ['p1', 'p2']) ok({ type: 'reveal', contextId: 'show', personId: p });
    return Object.fromEntries(s.project('g', 'p1').game.table.map(r => [r.playerId, [r.total, r.week]]));
  };
  for (const fallback of ['void', 'counts']) {
    const s = R.open(def(fallback));
    try {
      assert.deepEqual(s.export().preparation.notes || [], [], 'a second pick is connected: no note');
      // Night 1: only Ann's second goes home. Void: nothing counts but the firsts (both right). Counts: Ann's wrong second resets her.
      let t = night(s, 1, (a, b) => [b]);
      assert.deepEqual(t, fallback === 'void' ? { p1: [1, 1], p2: [1, 1] } : { p1: [1, 0], p2: [2, 2] }, fallback + ' night 1');
      // Night 2: two go home, Ann's first and someone nobody picked: both seconds count. Ann's wrong first resets her; Bo's two right.
      const left = s.snapshot().contexts.show.participants.map(x => x.id);
      t = night(s, 2, (a, b, c, d) => [a, left.find(id => ![a, b, c, d].includes(id) && !s.snapshot().contexts.show.facts.some(f => (f.data.events || []).some(e => e.castawayId === id)))]);
      assert.equal(t.p1[1], 0, fallback + ': a wrong first resets the streak, the right second counted first');
      assert.equal(t.p2[1], fallback === 'void' ? 3 : 4, fallback + ': both of Bo\'s picks right on a double night');
      const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
    } finally { s.dispose(); }
  }
});

test("group slots: on a world that forms pairs, a slot opens after the episode that showed them, scores its pair's mean or sum, rides with it and drops at a re-pairing (exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json'), Data = require('../tools/gameplay-bench/explorer/runtime-data.cjs');
  const game = (id, points) => ({ id, contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'shared', order: 'blind', groups: { slots: 1, own: 'shared', swap: false, fallback: 'void', points } }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'total' } } });
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 }, pairs: { every: 2 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [game('mean', 'mean'), game('sum', 'sum')], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 4 } }));
  const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
  const square = (g, n) => s.project(g, 'p1').game.plays.rows.p1.find(w => w.episode === n).points;
  // Each night: the same lineups in both games; the last one still in (nobody in a moment) goes home.
  const night = (n, moments) => {
    for (const g of ['mean', 'sum']) for (const p of ['p1', 'p2']) { const l = s.project(g, p).game.lineup; if (l) ok({ type: 'lineup', gameId: g, personId: p, eventId: l.epId, ids: l.roster.slice(0, l.slots) }); }
    const w = s.snapshot().contexts.show, ev = w.events[n - 1], gone = new Set(w.facts.flatMap(f => (f.data.events || []).map(e => e.castawayId)));
    const boot = w.participants.map(x => x.id).filter(id => !gone.has(id) && !moments.some(m => m.castawayId === id)).at(-1);
    ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: boot, method: 'Voted Out' }], scoringEvents: moments } });
    for (const p of ['p1', 'p2']) ok({ type: 'reveal', contextId: 'show', personId: p });
  };
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'group slots are connected: no note');
    assert.deepEqual(s.project('mean', 'p1').game.twists.offered?.groups ?? [], [], 'nothing on offer before the premiere');
    night(1, []);
    // Going into 2: the premiere's pairs, as the world formed them (the game's records carry their people).
    const offer = s.project('mean', 'p1').game.twists.offered, records = s.snapshot().games.mean.state.episodes[0].formatGroups.end.groups;
    assert.deepEqual(records.map(g => [...g.members].sort()), Data.pairsOf(s.snapshot().contexts.show, 1).groups.map(g => [...g].sort()), "the records are the world's pairs");
    const g = offer.groups[1], pair = records.find(x => x.id === g.id).members;
    assert.equal(s.apply({ type: 'groupSlot', gameId: 'mean', personId: 'p1', eventId: offer.epId, slot: 0, groupId: 'not-a-group' }).status, 'rejected');
    for (const gm of ['mean', 'sum']) ok({ type: 'groupSlot', gameId: gm, personId: 'p1', eventId: offer.epId, slot: 0, groupId: g.id });
    // Episode 2: both of the pair have a moment. The sum game's square is the mean game's plus half the pair's points.
    night(2, [{ id: 'a2', type: 'individualImmunity', castawayId: pair[0] }, { id: 'b2', type: 'rewardWin', castawayId: pair[1] }]);
    const lines = s.snapshot().games.mean.state.episodes[1].scoringEvents.length;
    assert.equal(lines, 2);
    const half = square('sum', 2) - square('mean', 2);
    assert.ok(half > 0, 'the pair scored');
    // Re-paired at episode 2's end, this pair split up: the slot drops going into 3, and episode 3's moment for it scores nothing.
    assert.ok(!Data.pairsOf(s.snapshot().contexts.show, 2).groups.some(x => [...x].sort().join() === [...pair].sort().join()), 'the re-pairing split this pair');
    assert.equal(s.project('mean', 'p1').game.twists.slots[0].status, 'dropped');
    night(3, [{ id: 'a3', type: 'individualImmunity', castawayId: pair[0] }]);
    assert.equal(square('sum', 3), square('mean', 3), 'a dropped slot scores nothing in either');
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test("a pool that never repeats: a night you've used everyone still in is skipped with fallback skip (nothing counts), else a miss (exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const game = (id, fallback) => ({ id, contextId: 'show', timing: 'live-only', spec: { get: { by: 'pick', each: 1, repeat: 'never', ...(fallback ? { fallback } : {}) }, score: { by: 'survive', lives: 2 }, rank: { by: 'standing' } } });
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 5 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [game('skip', 'skip'), game('miss', null)], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 6 } }));
  const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); };
  const c = n => 'show-participant-' + n;
  // Ann picks c1, c2, c3 on nights 1 to 3 (each stays); c5, c4 and c1 go home. Going into night 4 she has used everyone still in (c2, c3).
  const night = (n, pick, boot) => {
    for (const g of ['skip', 'miss']) { const k = s.project(g, 'p1').game.pick; if (pick) ok({ type: 'pick', gameId: g, personId: 'p1', eventId: k.epId, ids: [pick] }); else assert.deepEqual(k?.available ?? [], [], g + ': nobody left to pick'); }
    const ev = s.snapshot().contexts.show.events[n - 1];
    ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: boot, method: 'Voted Out' }], scoringEvents: [] } });
    for (const p of ['p1', 'p2']) ok({ type: 'reveal', contextId: 'show', personId: p });
  };
  try {
    assert.deepEqual(s.export().preparation.notes || [], [], 'skip is connected: no note');
    night(1, c(1), c(5)); night(2, c(2), c(4)); night(3, c(3), c(1));
    night(4, null, c(2));
    const row = g => s.project(g, 'p1').game.table.find(r => r.playerId === 'p1'), pool = g => s.project(g, 'p1').game.twists.pool;
    const night4 = g => s.project(g, 'p1').game.table.find(r => r.playerId === 'p1').picks.find(p => p.episode === 4);
    assert.deepEqual(night4('skip'), { episode: 4, castawayId: null, correct: null }, 'skipped: nothing counts');
    assert.deepEqual(night4('miss'), { episode: 4, castawayId: null, correct: false }, 'a miss');
    assert.deepEqual([pool('skip').lives, row('skip').week], [2, 3], 'skip: both lives, the streak of 3 holds');
    assert.deepEqual([pool('miss').lives, row('miss').week], [1, 0], 'miss: a life lost, the streak reset');
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test("an auction: seeded sealed bids settled at setup as the server settles them (highest first, won at the bid, filled at the lowest price or left short); exact replay", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json'), Data = require('../tools/gameplay-bench/explorer/runtime-data.cjs');
  for (const fallback of ['fill', 'short']) {
    const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 3, pool: 12 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }, { id: 'p3', name: 'Cy' }] },
      games: [{ id: 'a', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'exclusive', order: 'auction', budget: { total: 100, floor: 1, fallback } }, count: { all: true }, score: { by: 'place' }, rank: { by: 'total' } } }],
      situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 4 } }));
    try {
      assert.deepEqual(s.export().preparation.notes || [], [], 'an auction is connected: no note');
      const st = s.snapshot().games.a.state, bids = Data.auctionBids(s.export().input, { id: 'a', spec: {} }, st);
      assert.equal(st.auction.at, '2099-01-10T12:00:00.000Z', 'settled at the scenario clock');
      assert.ok(st.castaways.every(c => c.ownerIds.length <= 1), 'nobody on two teams');
      for (const p of st.players) {
        const mine = st.draftLog.filter(x => x.playerId === p.id);
        assert.ok(mine.reduce((t, x) => t + x.price, 0) <= 100, p.id + ' within the budget');
        for (const x of mine) assert.equal(x.price, x.filled ? 1 : bids[p.id].find(y => y.castawayId === x.castawayId).bid, p.id + ' won ' + x.castawayId + ' at its bid (or filled at 1)');
        if (fallback === 'fill') assert.equal(mine.length, 3, p.id + ' filled to three');
        else assert.ok(mine.every(x => !x.filled), 'short: nobody filled');
      }
      // Ann (seed 5) wins one at 95 and can't pay her other bids after it (each must leave 1 for her last place): short, she has one;
      // filled, two more at 1 each (97 in all). Bo wins two, Cy three.
      const count = pid => st.draftLog.filter(x => x.playerId === pid).length;
      assert.deepEqual(['p1', 'p2', 'p3'].map(count), fallback === 'fill' ? [3, 3, 3] : [1, 2, 3]);
      assert.equal(st.auction.spent.p1, fallback === 'fill' ? 97 : 95);
      const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
    } finally { s.dispose(); }
  }
});

test("mid-season waivers: a week opens with an episode's results, a claim waits for its reveal, the week processes at its time (a claim won, a loss auto-filled), a replacement scores half (paired; exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const waivers = { feel: 'balanced', replace: 'always', short: null, windows: { schedule: 'manual', every: 3, swaps: 0 }, order: 'rolling', hours: 24, freeAgency: true, autoFill: true, own: { replace: 'shared' } };
  const def = half => D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'g', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 2, own: 'exclusive', order: 'snake' }, count: { all: true }, score: { by: 'place', ...(half ? { multiply: [{ joined: 'replacement', times: [0.5] }] } : {}) }, rank: { by: 'total' }, extras: { waivers } } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 4 } });
  const walk = s => {
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); return r; };
    const st = () => s.snapshot().games.g.state, team = p => st().castaways.filter(c => c.ownerIds.includes(p));
    const night = (n, gone) => { const ev = s.snapshot().contexts.show.events[n - 1]; ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() }); ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: gone, method: 'Voted Out' }], scoringEvents: [] } }); };
    const lost = team('p1')[0].id;
    night(1, lost);
    const week = () => st().midSeason.waivers.periods.at(-1);
    assert.deepEqual([week().episode, week().phase], [1, 'open'], 'the results opened a week');
    const free = st().castaways.find(c => !c.ownerIds.length && c.status === 'active').id;
    const early = s.apply({ type: 'claim', gameId: 'g', personId: 'p1', pairs: [{ addId: free, dropId: lost }] });
    assert.equal(early.status, 'rejected'); assert.match(early.message, /Reveal episode 1 first/);
    for (const p of ['p1', 'p2']) ok({ type: 'reveal', contextId: 'show', personId: p });
    ok({ type: 'claim', gameId: 'g', personId: 'p1', pairs: [{ addId: free, dropId: lost }] });
    assert.deepEqual(week().claimsIn, ['p1'], 'who has claims in is public; the claim itself is not in the state');
    assert.ok(!JSON.stringify(st()).includes('"pairs"'), 'no claim in the league state');
    ok({ type: 'clock', at: new Date(Date.parse(week().processAt) + 1000).toISOString() });
    assert.equal(week().phase, 'processed');
    assert.ok(team('p1').some(c => c.id === free && c.acquiredVia === 'replenish'), 'Ann won her claim');
    // Episode 2: Bo loses one and never claims. The week processes with nothing for him; once free agency ends (the next episode
    // airs) the week closes and fills his loss.
    const bos = team('p2')[0].id; night(2, bos);
    for (const p of ['p1', 'p2']) ok({ type: 'reveal', contextId: 'show', personId: p });
    ok({ type: 'clock', at: new Date(Date.parse(week().processAt) + 1000).toISOString() });
    assert.deepEqual([week().phase, week().run.results.find(x => x.playerId === 'p2')?.outcome], ['processed', 'noClaim']);
    assert.ok(!team('p2').some(c => c.acquiredVia === 'replenish'), 'not filled at processing');
    ok({ type: 'clock', at: new Date(Date.parse(week().closesAt) + 1000).toISOString() });
    assert.equal(st().midSeason.waivers.periods.find(p => p.episode === 2).phase, 'closed');
    assert.ok(team('p2').some(c => c.acquiredVia === 'replenish'), 'Bo auto-filled at the close');
    night(3, st().castaways.find(c => !c.ownerIds.length && c.status === 'active').id);
    for (const p of ['p1', 'p2']) ok({ type: 'reveal', contextId: 'show', personId: p });
    return Object.fromEntries(s.project('g', 'p1').game.table.map(r => [r.playerId, r.total]));
  };
  const a = R.open(def(true)), b = R.open(def(false));
  try {
    assert.deepEqual(a.export().preparation.notes || [], [], 'waivers and the multiplier are connected: no note');
    const half = walk(a), full = walk(b);
    assert.ok(full.p1 > half.p1 && Number.isInteger((full.p1 - half.p1) * 2), 'her replacement scores half: ' + JSON.stringify([half, full]));
    const exported = a.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { a.dispose(); b.dispose(); }
});

test("the commissioner's waiver actions: a manual window opens only when they open it; Process now runs the claims that are in; Undo puts everyone back and holds the week; a changed window trims claims; a game with no waivers can have a window; only whoever runs the game (exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json'), W = require('../src/lib/game/state-logic').WaiverLogic;
  // Replacements wait for a window, and windows are opened by hand: no week ever opens by itself.
  const waivers = { feel: 'balanced', replace: 'windows', short: null, windows: { schedule: 'manual', every: 3, swaps: 1 }, order: 'rolling', hours: 24, freeAgency: true, autoFill: true };
  const draft = { get: { by: 'draft', each: 3, own: 'exclusive', order: 'snake' }, count: { all: true }, score: { by: 'place' }, rank: { by: 'total' } };
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'g', contextId: 'show', timing: 'live-only', spec: { ...draft, extras: { waivers } } }, { id: 'plain', contextId: 'show', timing: 'live-only', spec: draft }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 4 } }));
  try {
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); return r; };
    const no = (a, why) => { const r = s.apply(a); assert.equal(r.status, 'rejected', JSON.stringify(a)); assert.match(r.message, why); };
    const st = (g = 'g') => s.snapshot().games[g].state, team = (p, g = 'g') => st(g).castaways.filter(c => c.ownerIds.includes(p)).map(c => c.id).sort();
    const week = (g = 'g') => st(g).midSeason?.waivers?.periods?.at(-1), claims = (g = 'g') => Object.fromEntries(Object.entries(s.snapshot().stores.waivers?.[g]?.weeks?.[week(g)?.id] || {}).map(([p, x]) => [p, x.claim.pairs.map(y => y.addId + '>' + y.dropId)]));
    const c = n => 'show-participant-' + n, win = a => ({ type: 'waiverWindow', gameId: 'g', personId: 'p1', ...a });
    const ev = s.snapshot().contexts.show.events[0];
    ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: c(1), method: 'Voted Out' }], scoringEvents: [] } });
    assert.deepEqual([team('p1'), team('p2')], [[c(1), c(2), c(3)], [c(4), c(5), c(6)]]);
    assert.equal(week(), undefined, 'the results open no week: its windows are opened by hand');
    // Open a window: only whoever runs the game (the first seat), 0 up to the team's size or null, and never one with nothing to claim.
    no({ ...win({ swaps: 1 }), personId: 'p2' }, /Only whoever runs the game/);
    no(win({ swaps: 1.5 }), /whole number/); no(win({ swaps: 4 }), /Choose 0 to 3 swaps/); no(win({ swaps: 0, replace: false }), /nothing to claim/); no(win({ swaps: null }), /no waiver window to turn off/);
    ok(win({ swaps: 1, replace: true }));
    assert.deepEqual([week().id, week().episode, week().phase, week().window, week().swaps, week().replace, week().openedBy], ['wv-g-1-1', 1, 'open', true, 1, true, 'commissioner']);
    // Claim for them waits for the sender's own reveal, and is one spot of someone in this week's waivers; only whoever runs the game.
    no({ type: 'claim', gameId: 'g', personId: 'p1', forId: 'p2', spot: { dropId: c(4), addIds: [c(9)] } }, /Reveal Episode 1 first/);
    for (const p of ['p1', 'p2']) ok({ type: 'reveal', contextId: 'show', personId: p });
    ok({ type: 'claim', gameId: 'g', personId: 'p1', pairs: [{ addId: c(7), dropId: c(1) }, { addId: c(8), dropId: c(2) }] }); // her loss replaced, and a swap
    no({ type: 'claim', gameId: 'g', personId: 'p2', forId: 'p1', spot: { dropId: c(2), addIds: [c(9)] } }, /isn't one you run/);
    no({ type: 'claim', gameId: 'g', personId: 'p1', forId: 'p2', pairs: [{ addId: c(9), dropId: c(4) }] }, /Choose who to drop and who to add/);
    no({ type: 'claim', gameId: 'g', personId: 'p1', forId: 'nobody', spot: { dropId: c(4), addIds: [c(9)] } }, /aren't in this week's waivers/);
    ok({ type: 'claim', gameId: 'g', personId: 'p1', forId: 'p2', spot: { dropId: c(4), addIds: [c(9), c(7)] } }); // Bo's swap, sent for him
    assert.deepEqual([week().claimsIn, claims()], [['p1', 'p2'], { p1: [c(7) + '>' + c(1), c(8) + '>' + c(2)], p2: [c(9) + '>' + c(4), c(7) + '>' + c(4)] }]);
    assert.ok(!JSON.stringify(st()).includes('"pairs"'), 'no claim in the league state');
    // Process now: before its time, by whoever runs the game. Bo (first in the order) swaps; Ann replaces her loss and swaps.
    assert.ok(Date.parse(s.snapshot().clock) < Date.parse(week().processAt));
    no({ type: 'waiverRun', gameId: 'g', personId: 'p2' }, /Only whoever runs the game/);
    const SL = require('../src/lib/game/state-logic'), orderNow = () => SL.MidSeasonLogic.order(st(), W.rotation(st())), before = [team('p1'), team('p2')], order = orderNow();
    ok({ type: 'waiverRun', gameId: 'g', personId: 'p1' });
    assert.deepEqual([week().phase, week().run.by, week().run.results.map(x => [x.playerId, x.kind, x.outcome, x.castawayId, x.droppedCastawayId])], ['processed', 'commissioner', [['p2', 'addDrop', 'got', c(9), c(4)], ['p1', 'pickup', 'got', c(7), c(1)], ['p1', 'addDrop', 'got', c(8), c(2)]]]);
    assert.deepEqual([team('p1'), team('p2')], [[c(3), c(7), c(8)], [c(5), c(6), c(9)]]);
    assert.equal(st().midSeason.log.filter(t => t.periodId === week().id).length, 3);
    no({ type: 'waiverRun', gameId: 'g', personId: 'p1' }, /Waivers aren.t open/);
    no(win({ swaps: 2 }), /have processed/);
    // Undo: only that week's run (Recent changes names it), by whoever runs the game. Everyone back, the order back, the claims as they
    // were, and the week held: its time passes and it stays open.
    no({ type: 'waiverUndo', gameId: 'g', personId: 'p2' }, /Only whoever runs the game/);
    no({ type: 'waiverUndo', gameId: 'g', personId: 'p1', periodId: 'another-week' }, /can't be taken back any more/);
    ok({ type: 'waiverUndo', gameId: 'g', personId: 'p1', periodId: week().id });
    assert.deepEqual([team('p1'), team('p2')], before, 'everyone back');
    assert.deepEqual([week().phase, week().hold, week().run, week().claimsIn, st().midSeason.log.length, orderNow()], ['open', true, null, ['p1', 'p2'], 0, order]);
    assert.deepEqual(claims(), { p1: [c(7) + '>' + c(1), c(8) + '>' + c(2)], p2: [c(9) + '>' + c(4), c(7) + '>' + c(4)] }, 'the claims reopen as they were');
    no({ type: 'waiverUndo', gameId: 'g', personId: 'p1' }, /no waiver run to undo/);
    ok({ type: 'clock', at: new Date(Date.parse(week().processAt) + 1000).toISOString() });
    assert.equal(week().phase, 'open', 'held past its time');
    // The window changed to no swaps: Ann's swap goes and her replacement stays; Bo's claim was only a swap, so it's gone. A trimmed
    // claim counts as changed just then.
    ok(win({ swaps: 0, replace: true }));
    assert.deepEqual([week().swaps, week().claimsIn, claims()], [0, ['p1'], { p1: [c(7) + '>' + c(1)] }]);
    ok({ type: 'waiverRun', gameId: 'g', personId: 'p1' });
    assert.deepEqual([team('p1'), team('p2')], [[c(2), c(3), c(7)], [c(4), c(5), c(6)]]);
    ok({ type: 'waiverUndo', gameId: 'g', personId: 'p1' }); ok({ type: 'waiverRun', gameId: 'g', personId: 'p1' }); // (no week named: the last run)
    ok({ type: 'clock', at: new Date(Date.parse(week().closesAt) + 1000).toISOString() });
    assert.equal(week().phase, 'closed');
    no({ type: 'waiverUndo', gameId: 'g', personId: 'p1' }, /no waiver run to undo/);
    // A game with no waivers: nothing to run, but a window whenever whoever runs it wants one. It keeps waivers on while it runs;
    // turned off, the week is over on the spot and can't be opened again for that episode.
    assert.deepEqual([W.supported(st('plain')), W.enabled(st('plain')), 'plain' in s.snapshot().stores.waivers], [true, false, false]);
    no({ type: 'waiverRun', gameId: 'plain', personId: 'p1' }, /doesn't use waivers/);
    ok({ type: 'waiverWindow', gameId: 'plain', personId: 'p1', swaps: 1 });
    assert.deepEqual([week('plain').id, week('plain').phase, week('plain').openedBy, W.enabled(st('plain')), s.snapshot().stores.waivers.plain], ['wv-plain-1-1', 'open', 'commissioner', true, { seq: 0, weeks: {} }]);
    ok({ type: 'claim', gameId: 'plain', personId: 'p2', spot: { dropId: c(4), addIds: [c(9)] } });
    ok({ type: 'waiverWindow', gameId: 'plain', personId: 'p1', swaps: null });
    assert.deepEqual([week('plain').phase, week('plain').turnedOff, week('plain').claimsIn, claims('plain'), W.enabled(st('plain'))], ['closed', true, [], {}, false]);
    no({ type: 'waiverWindow', gameId: 'plain', personId: 'p1', swaps: 1 }, /have processed/);
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
});

test("a free-agency move waits for the week's reveal, as a claim does", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json');
  const waivers = { feel: 'balanced', replace: 'always', short: null, windows: { schedule: 'manual', every: 3, swaps: 0 }, order: 'rolling', hours: 24, freeAgency: true, autoFill: false };
  const s = R.open(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
    games: [{ id: 'g', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 2, own: 'exclusive', order: 'snake' }, count: { all: true }, score: { by: 'place' }, rank: { by: 'total' }, extras: { waivers } } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 4 } }));
  try {
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); return r; };
    const st = () => s.snapshot().games.g.state, week = () => st().midSeason.waivers.periods.at(-1), ev = s.snapshot().contexts.show.events[0];
    const lost = st().castaways.find(c => c.ownerIds.includes('p1')).id, free = st().castaways.find(c => !c.ownerIds.length).id;
    ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
    ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: lost, method: 'Voted Out' }], scoringEvents: [] } });
    ok({ type: 'waiverRun', gameId: 'g', personId: 'p1' });
    assert.equal(week().phase, 'processed');
    const early = s.apply({ type: 'freeAgency', gameId: 'g', personId: 'p1', addId: free, dropId: lost });
    assert.equal(early.status, 'rejected'); assert.match(early.message, /Reveal episode 1 first/);
    ok({ type: 'reveal', contextId: 'show', personId: 'p1' });
    ok({ type: 'freeAgency', gameId: 'g', personId: 'p1', addId: free, dropId: lost });
    assert.ok(st().castaways.find(c => c.id === free).ownerIds.includes('p1'));
  } finally { s.dispose(); }
});

test("stages: two games split at the merge, each a game of its own; the second drafted as it opens from who's still in (an exclusive draft that no longer fits is shared); the overall adds their tables, through each viewer's mark (exact replay)", () => {
  const D = require('../tools/gameplay-bench/explorer/document.cjs'), Q = require('./fixtures/gameplay-explorer/questions-input.json'), S = require('../src/lib/game/state-logic'), P = require('../tools/gameplay-bench/explorer/runtime-profile.cjs');
  const lineup = { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'total' } };
  const outlast = { preset: 'outlast', get: { by: 'draft', each: 4, own: 'exclusive', order: 'snake' }, count: { all: true }, score: { by: 'place' }, rank: { by: 'total' } };
  const staged = game => ({ stages: [{ id: 'before', name: 'Before the merge', game: { ...game, span: { from: 1, to: { phase: 'merged' } } } }, { id: 'after', name: 'Merged', game: { ...game, span: { from: { phase: 'merged' } } } }], overall: { by: 'points' } });
  const world = { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 3, pool: 12 }, phaseStarts: { merged: 3 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }, { id: 'p3', name: 'Cy' }] };
  const doc = D.create({ seed: 9, world, games: [{ id: 'two', contextId: 'show', timing: 'live-only', spec: staged(lineup) }, { id: 'out', contextId: 'show', timing: 'live-only', spec: staged(outlast) }], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: 6 } });
  // The definition: each stage a game of its own after its game, derived from its spec.
  assert.deepEqual(doc.games.map(g => [g.id, g.stageOf ?? null]), [['two', null], ['two~before', 'two'], ['two~after', 'two'], ['out', null], ['out~before', 'out'], ['out~after', 'out']]);
  assert.deepEqual(D.read(doc), doc, 'derived the same however often it is read');
  assert.equal(doc.games[2].spec.extras.draft.opens, 'start', "a later stage's draft opens at its start");
  // What stays a gap: own pace, an overall by places, a rider on a stage.
  const gapsOf = games => P.inspect(D.create({ seed: 9, world, games, situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] } })).gaps.map(g => g.path);
  assert.deepEqual(gapsOf([{ id: 'g', contextId: 'show', timing: 'own-pace', spec: staged(lineup) }]), ['/games/0/timing']);
  assert.deepEqual(gapsOf([{ id: 'g', contextId: 'show', timing: 'live-only', spec: { ...staged(lineup), overall: { by: 'places' } } }]), ['/games/0/spec/overall']);
  assert.deepEqual(gapsOf([{ id: 'g', contextId: 'show', timing: 'live-only', spec: { ...staged(lineup), stages: [staged(lineup).stages[0], { ...staged(lineup).stages[1], game: { ...lineup, score: { by: 'moments', captain: { times: 2 } }, span: { from: { phase: 'merged' } } } }] } }]), ['/games/0/spec/stages/1/game']);
  // ...and a stage drafted out of a hat, or with waivers of its own beyond a window opened by hand (the specimens' are by hand only).
  const firstAs = game => ({ ...staged(lineup), stages: [{ ...staged(lineup).stages[0], game: { ...game, span: { from: 1, to: { phase: 'merged' } } } }, staged(lineup).stages[1]] });
  const byHand = { feel: 'balanced', replace: 'never', short: null, windows: { schedule: 'manual', every: 3, swaps: 0 }, order: 'rolling', hours: 24, freeAgency: true, autoFill: true };
  assert.deepEqual(gapsOf([{ id: 'g', contextId: 'show', timing: 'live-only', spec: firstAs({ ...lineup, get: { ...lineup.get, order: 'draw' } }) }]), ['/games/0/spec/stages/0/game']);
  assert.deepEqual(gapsOf([{ id: 'g', contextId: 'show', timing: 'live-only', spec: firstAs({ ...lineup, extras: { waivers: { ...byHand, replace: 'always' } } }) }]), ['/games/0/spec/stages/0/game']);
  assert.deepEqual(gapsOf([{ id: 'g', contextId: 'show', timing: 'live-only', spec: firstAs({ ...lineup, extras: { waivers: byHand, bets: { points: 1 } } }) }]), []);
  const s = R.open(doc);
  try {
    const ok = a => { const r = s.apply(a); assert.equal(r.status, 'accepted', JSON.stringify(a) + ' ' + r.message); return r; };
    const st = g => s.snapshot().games[g].state, span = g => [S.startEpisode(st(g)), S.endEpisode(st(g))];
    const team = (g, p) => st(g).castaways.filter(c => c.ownerIds.includes(p)).map(c => c.id), table = (g, p) => Object.fromEntries(s.project(g, p).game.table.map(t => [t.playerId, t.total]));
    const cast = n => 'show-participant-' + n, people = ['p1', 'p2', 'p3'];
    // Before the merge: the second stage waits (no start, nobody on a team, no lineup to set); the game's table is the first stage's.
    assert.deepEqual([span('two~before'), span('two~after')], [[1, null], [null, null]]);
    assert.deepEqual(people.map(p => team('two~after', p).length), [0, 0, 0]);
    assert.equal(s.project('two~after', 'p1').game.lineup, null);
    assert.equal(S.DraftLogic.waits(st('two~after')), "The draft opens once it's known where the game starts");
    // The game itself holds no team and takes no move: its stages do.
    const l1 = s.project('two~before', 'p1').game.lineup;
    assert.equal(s.apply({ type: 'lineup', gameId: 'two', personId: 'p1', eventId: l1.epId, ids: l1.roster.slice(0, 2) }).status, 'rejected');
    const play = n => {
      const w = s.snapshot().contexts.show, ev = w.events[n - 1];
      // (Whoever is behind has results to reveal first: a live game takes no lineup from them till then.)
      for (const g of ['two~before', 'two~after']) for (const p of people) { const v = s.project(g, p).game, l = v.lineup; if (l && l.episode === n && !v.revealFirst) ok({ type: 'lineup', gameId: g, personId: p, eventId: l.epId, ids: l.roster.slice(0, l.slots) }); }
      ok({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
      // Castaway n goes home in episode n; castaways 5 and 9 each win a reward (a moment that scores for whoever starts them).
      ok({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: cast(n), method: 'Voted Out' }], scoringEvents: [{ id: 'r5-' + n, type: 'rewardWin', castawayId: cast(5) }, { id: 'r9-' + n, type: 'rewardWin', castawayId: cast(9) }] } });
    };
    play(1); play(2);
    for (const p of people) { ok({ type: 'reveal', contextId: 'show', personId: p }); ok({ type: 'reveal', contextId: 'show', personId: p }); }
    assert.deepEqual(table('two', 'p1'), table('two~before', 'p1'), 'a stage that has not started counts nothing');
    assert.deepEqual([span('two~after'), span('out~after')], [[null, null], [null, null]], 'still waiting for the merge');
    // Outlast before the merge, by hand: each holding 1 + the boots it has outlasted; castaways 1 and 2 (Ann's) went 1st and 2nd.
    assert.deepEqual(table('out~before', 'p1'), { p1: 1 + 2 + 3 + 3, p2: 12, p3: 12 });
    play(3);
    // Episode 3 confirms the merge: the first stage ends with it, the second starts with the next, and its draft is made at once.
    assert.deepEqual([span('two~before'), span('two~after'), span('out~before'), span('out~after')], [[1, 3], [4, null], [1, 3], [4, null]]);
    const gone = new Set([cast(1), cast(2), cast(3)]);
    for (const g of ['two~after', 'out~after']) for (const p of people) {
      assert.equal(team(g, p).length, g === 'two~after' ? 3 : 4, g + ' ' + p + ' has a whole team');
      assert.ok(team(g, p).every(id => !gone.has(id)), g + ' ' + p + ' drafted only from who is still in');
    }
    // Three seats times four is more than the nine still in: the exclusive snake is played shared from then on (a private draft).
    assert.deepEqual([S.gameOf(st('out~before')).get.own, S.gameOf(st('out~after')).get.own, S.gameOf(st('out~after')).get.order], ['exclusive', 'shared', 'blind']);
    assert.ok(st('out~after').blindDraft.revealedAt && st('two~after').blindDraft.revealedAt, 'revealed as it opened');
    // Ann and Bo watch episode 3; Cy stays at 2. The second stage has no episode yet: the overall is still the first stage's.
    ok({ type: 'reveal', contextId: 'show', personId: 'p1' }); ok({ type: 'reveal', contextId: 'show', personId: 'p2' });
    assert.deepEqual(table('two', 'p1'), table('two~before', 'p1'));
    assert.deepEqual(table('out~before', 'p1'), { p1: 1 + 2 + 3 + 4, p2: 16, p3: 16 });
    assert.equal(s.project('two~before', 'p1').game.over, true);
    assert.equal(s.project('two~after', 'p1').game.lineup.episode, 4, 'the second stage asks for its first lineup');
    play(4);
    ok({ type: 'reveal', contextId: 'show', personId: 'p1' });
    // The overall, by points: each seat's two stages added up as each stage's own table shows them.
    const sum = (a, b) => Object.fromEntries(people.map(p => [p, a[p] + b[p]]));
    assert.deepEqual(table('two', 'p1'), sum(table('two~before', 'p1'), table('two~after', 'p1')));
    assert.deepEqual(table('out', 'p1'), sum(table('out~before', 'p1'), table('out~after', 'p1')));
    // ...and by hand for Outlast: the first stage as it stood at its end; in the second, castaway 4 went 4th, everyone else has outlasted four.
    const after = Object.fromEntries(people.map(p => [p, team('out~after', p).reduce((n, id) => n + (id === cast(4) ? 4 : 5), 0)]));
    assert.deepEqual(table('out', 'p1'), { p1: 10 + after.p1, p2: 16 + after.p2, p3: 16 + after.p3 });
    assert.ok(Object.values(table('two~after', 'p1')).some(x => x !== 0), 'the second stage scored');
    // Bo (through 3) sees the first stage only; Cy (through 2) sees it as it stood after episode 2.
    assert.deepEqual(table('out', 'p2'), { p1: 10, p2: 16, p3: 16 });
    assert.deepEqual(table('out', 'p3'), { p1: 9, p2: 12, p3: 12 });
    assert.deepEqual(table('two', 'p3'), table('two~before', 'p3'));
    const exported = s.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { s.dispose(); }
  // A game made once the merge is known: the first stage ended with the last episode played, the second starts with the next,
  // drafted at setup from who's still in then. And one split at an episode: the second stage's draft opens as the one before it ends.
  const late = R.open(D.create({ seed: 9, world, games: [{ id: 'two', contextId: 'show', timing: 'live-only', spec: staged(lineup) },
    { id: 'eps', contextId: 'show', timing: 'live-only', spec: { stages: [{ id: 'a', game: { ...lineup, span: { from: 1, to: 5 } } }, { id: 'b', game: { ...lineup, span: { from: 6 } } }], overall: { by: 'points' } } }], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 4, eventCount: 7 } }));
  try {
    const st = g => late.snapshot().games[g].state, out = new Set(st('two').castaways.filter(c => c.status !== 'active').map(c => c.id));
    assert.deepEqual([[S.startEpisode(st('two~before')), S.endEpisode(st('two~before'))], [S.startEpisode(st('two~after')), S.endEpisode(st('two~after'))]], [[1, 4], [5, null]]);
    assert.equal(out.size, 4);
    for (const p of ['p1', 'p2', 'p3']) { const mine = st('two~after').castaways.filter(c => c.ownerIds.includes(p)); assert.equal(mine.length, 3); assert.ok(mine.every(c => !out.has(c.id))); }
    assert.equal(late.project('two~after', 'p1').game.lineup.episode, 5);
    assert.equal(S.DraftLogic.waits(st('eps~b')), "The draft opens once Episode 5's results are in");
    const w = late.snapshot().contexts.show, ev = w.events[4];
    assert.equal(late.apply({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() }).status, 'accepted');
    assert.equal(late.apply({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [], scoringEvents: [], noExit: true } }).status, 'accepted');
    assert.equal(st('eps~b').castaways.filter(c => c.ownerIds.includes('p1')).length, 3, 'drafted as episode 5 ended the stage before');
    const exported = late.export(), replay = R.resume(exported); try { assert.equal(replay.hash(), exported.stateHash); } finally { replay.dispose(); }
  } finally { late.dispose(); }
  // Fewer still in than a team takes (BACKLOG 60): nobody can lock a sheet in, as the server refuses every one, so the draft stays
  // open and unmade, the stage has no team (its lineup reads as set, with nobody to start), and it counts nothing in the overall.
  const few = R.open(D.create({ seed: 9, world: { ...world, contexts: [{ ...world.contexts[0], engine: { ...Q.context, couch: 3, pool: 8 } }] }, games: [{ id: 'six', contextId: 'show', timing: 'live-only', spec: staged({ ...lineup, get: { ...lineup.get, each: 6 } }) }], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 3, eventCount: 6 } }));
  try {
    const st = few.snapshot().games['six~after'].state;
    assert.equal(st.castaways.filter(c => c.status === 'active').length, 5);
    assert.deepEqual([S.startEpisode(st), S.DraftLogic.waits(st), st.castaways.some(c => c.ownerIds.length)], [4, null, false]);
    assert.equal(S.BlindDraftLogic.validateSubmission(st, 'p1', st.castaways.filter(c => c.status === 'active').map(c => c.id)), 'Pick exactly 6 castaways');
    { const l = few.project('six~after', 'p1').game.lineup; assert.deepEqual([l.episode, l.roster, l.need, l.set], [4, [], 0, true]); }
    assert.deepEqual(few.project('six', 'p1').game.table.map(r => r.total), few.project('six~before', 'p1').game.table.map(r => r.total));
  } finally { few.dispose(); }
});
