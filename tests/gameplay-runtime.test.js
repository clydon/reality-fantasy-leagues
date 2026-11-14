const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const R = require('../tools/gameplay-bench/explorer/runtime.cjs');
const J = require('../tools/gameplay-bench/explorer/json.cjs');
const S = require('../src/lib/game/state-logic');
const proof = require('./fixtures/gameplay-explorer/runtime-proof.cjs');
const use = (t, document = proof()) => { const r = R.open(document); t.after(() => r.dispose()); return r; };
const decision = (r, gameId, personId = 'ann') => {
  const game = r.project(gameId, personId).game, move = game.lineup || game.pick;
  return { type: game.lineup ? 'lineup' : 'pick', gameId, personId, eventId: move.epId, ids: game.lineup ? move.roster.slice(-2) : move.available.slice(0, 3) };
};
// Results exist only after an airing (core-runtime-2): pass the event's air time first, as a real night would.
const aired = (r, n) => { const at = r.snapshot().contexts.show.events[n - 1].airAt, t = new Date(Date.parse(at) + 3600000).toISOString(); if (Date.parse(r.snapshot().clock) < Date.parse(t)) assert(r.apply({ type: 'clock', at: t }).ok); };
const result = (r, n, data, resultStatus = 'final') => ({ type: 'results', source: 'provider-fixture', contextId: 'show', eventId: r.snapshot().contexts.show.events[n - 1].id, resultStatus, data });
const noExit = () => ({ events: [], scoringEvents: [], noExit: true });

test('same seed materializes a shared world deterministically with isolated ownership and no global clock replacement', t => {
  const now = Date.now, a = use(t), b = use(t);
  assert.equal(Date.now, now); assert.equal(a.hash(), b.hash());
  const state = a.snapshot();
  for (const built of Object.values(state.games)) {
    assert.deepEqual(built.state.episodes.map(e => e.events), state.games.lineup.state.episodes.map(e => e.events));
    assert.deepEqual(built.state.episodes.map(e => e.scoringEvents), state.games.lineup.state.episodes.map(e => e.scoringEvents));
  }
  assert.equal(a.export().preparation.plan.steps.filter(s => s.adapterId === 'world.context').length, 1);
  const original = b.hash(); assert(a.apply(decision(a, 'lineup')).ok); assert.equal(b.hash(), original);
  state.games.lineup.state.players.length = 0;
  assert.equal(a.snapshot().games.lineup.state.players.length, 2);
  assert.equal(a.export().evidence.interaction, 'headless-only');
});

test('lineup and three fresh picks use production validation; invalid, stale and nonmember actions are atomic', t => {
  const r = use(t), a = decision(r, 'lineup'), p = decision(r, 'picks');
  assert.equal(p.ids.length, 3); assert(r.apply(a).ok); assert(r.apply(p).ok);
  const saved = r.snapshot().games.picks.state;
  assert.deepEqual(S.PickEmLogic.picked(S.pickEmPickFor(saved, p.eventId, 'ann')), p.ids);
  for (const invalid of [{ ...a, ids: ['unknown'] }, { ...p, ids: [...p.ids, p.ids[0]] }, { ...a, personId: 'stranger' }, { ...p, expectedHash: 'stale' }, { ...a, eventId: 'wrong-event' }]) {
    const hash = r.hash(); assert.equal(r.apply(invalid).status, 'rejected'); assert.equal(r.hash(), hash);
  }
  assert.equal(r.apply({ type: 'draft', gameId: 'lineup' }).status, 'blocked');
});

test('explicit clock controls pick and lineup deadlines on either side of the host date', t => {
  for (const clock of ['1900-01-10T12:00:00Z', '2099-01-10T12:00:00Z']) {
    const r = use(t, proof({ clock, timing: 'live-only' }));
    const lineup = decision(r, 'lineup'), pick = decision(r, 'picks');
    assert(r.apply(lineup).ok); assert(r.apply(pick).ok);
    const at = r.snapshot().contexts.show.events[2].airAt;
    assert(r.apply({ type: 'clock', at }).ok);
    assert(r.project('lineup', 'ann').game.lineup.locked);
    assert.equal(r.project('picks', 'ann').game.pick.open, false);
    for (const action of [lineup, pick]) { const hash = r.hash(); assert.equal(r.apply(action).status, 'rejected'); assert.equal(r.hash(), hash); }
    const hash = r.hash(); assert.equal(r.apply({ type: 'clock', at: clock }).status, 'rejected'); assert.equal(r.hash(), hash);
  }
});

test('participant and yes/no stores settle from the same results with explicit weights and spoiler boundaries', t => {
  const r = use(t), lineup = decision(r, 'lineup'); assert(r.apply(lineup).ok);
  const cast = r.snapshot().games.lineup.state.castaways;
  const out = cast.find(c => c.status === 'active' && !lineup.ids.includes(c.id)).id;
  const answer = (personId, question, answer) => ({ type: 'answer', gameId: 'questions', personId, episode: 3, question, answer });
  assert(r.apply(answer('ann', 'boot', out)).ok);
  assert(r.apply(answer('ann', 'happens', 'yes')).ok);
  assert(r.apply(answer('bo', 'boot', out)).ok);
  assert.equal(r.project('questions', 'ann').decided.length, 0);
  const previousWeek = r.project('lineup', 'ann').game.you.week;
  const data = { events: [{ castawayId: out, method: 'Voted Out' }], scoringEvents: [{ id: 'reward', type: 'rewardWin', castawayId: lineup.ids[0] }], noExit: false };
  aired(r, 3); assert(r.apply(result(r, 3, data)).ok);
  assert.equal(r.project('questions', 'ann').game.you.total, 0);
  assert.equal(r.project('lineup', 'ann').game.you.week, previousWeek); // only round 2 is visible
  assert(r.apply({ type: 'reveal', contextId: 'show', personId: 'ann', episode: 3 }).ok);
  const questions = r.project('questions', 'ann');
  assert.equal(questions.game.you.total, 3);
  assert.equal(questions.decided.find(a => a.playerId === 'ann' && a.question === 'boot').points, 2);
  assert.equal(r.project('lineup', 'ann').game.you.week, 7);
  assert.equal(r.project('questions', 'bo').game.you.total, 0);
  assert.equal(r.snapshot().contexts.show.marks.find(m => m.personId === 'bo').through, 2);
  for (const g of Object.values(r.snapshot().games)) assert.equal(g.state.players.find(p => p.id === 'ann').lateJoin.seenThrough, 3);
  const hash = r.hash(); assert.equal(r.apply(answer('ann', 'happens', 'maybe')).status, 'rejected'); assert.equal(r.hash(), hash);
});

test('own-pace catch-up supports independent decisions and reveal; live-only remains locked', t => {
  const r = use(t, proof({ bo: 0 }));
  const a = decision(r, 'picks', 'bo');
  assert.equal(r.project('picks', 'bo').game.pick.episode, 1); assert(r.apply(a).ok);
  assert.equal(r.project('picks', 'bo').game.cast.some(c => c.left), false);
  assert.equal(r.apply({ type: 'reveal', contextId: 'show', personId: 'bo', episode: 2 }).status, 'rejected');
  assert(r.apply({ type: 'reveal', contextId: 'show', personId: 'bo', episode: 1 }).ok);
  assert.equal(r.project('picks', 'bo').game.pick.episode, 2);
  const live = use(t, proof({ bo: 0, timing: 'live-only' }));
  const projection = live.project('picks', 'bo').game;
  assert(projection.revealFirst);
  assert.equal(live.apply({ ...a, eventId: projection.pick?.epId || a.eventId }).status, 'rejected');
});

test('results corrections reconcile all games and invalid provider data rolls back across games', t => {
  const r = use(t); assert(r.apply(result(r, 2, noExit(), 'corrected')).ok);
  for (const built of Object.values(r.snapshot().games)) assert.equal(built.state.episodes[1].events.length, 0);
  for (const data of [{ ...noExit(), roles: [] }, { events: [{ castawayId: 'missing', method: 'Voted Out' }], scoringEvents: [], noExit: false }, { ...noExit(), scoringEvents: [{ id: 'bad', type: 'missing', castawayId: 'show-participant-1' }] }]) {
    const hash = r.hash(); assert.equal(r.apply(result(r, 2, data, 'corrected')).status, 'rejected'); assert.equal(r.hash(), hash);
  }
  assert.equal(r.apply(result(r, 2, noExit(), 'partial')).status, 'rejected');
});

test('checkpoints, reset, fork and pinned resume replay accepted and rejected actions exactly', t => {
  const r = use(t), initial = r.hash(); r.checkpoint('start');
  assert(r.apply(decision(r, 'lineup')).ok); const mid = r.checkpoint('lineup-saved');
  assert.equal(r.apply({ ...decision(r, 'picks'), ids: ['unknown'] }).status, 'rejected');
  assert(r.apply(decision(r, 'picks')).ok);
  const saved = r.export(), resumed = R.resume(saved); t.after(() => resumed.dispose());
  assert.deepEqual(resumed.export(), saved);
  const fork = r.fork('lineup-saved'); t.after(() => fork.dispose()); assert.equal(fork.hash(), mid.hash);
  assert.equal(fork.export().trace.length, 1); assert.notEqual(fork.hash(), r.hash());
  r.reset(); assert.equal(r.hash(), initial); assert.equal(r.export().trace.length, 0);
  for (const mutate of [x => x.versions.engine = 'changed', x => x.state.clock = 'tampered', x => x.checkpoints[0].traceLength = -1, x => x.trace[0].status = 'rejected']) {
    const corrupt = J.clone(saved); mutate(corrupt); assert.throws(() => R.resume(corrupt));
  }
  resumed.dispose(); assert.throws(() => resumed.snapshot(), /disposed/);
});

test('external answer stores stay per-game; spectators cannot write and supplied rows are validated', t => {
  const d = proof(); d.games.push({ ...J.clone(d.games[2]), id: 'other-questions' });
  d.games[2].roles.bo = 'spectator'; const r = use(t, d);
  const action = { type: 'answer', gameId: 'questions', personId: 'ann', episode: 3, question: 'happens', answer: 'yes' };
  const saved = r.apply(action); assert(saved.ok); assert.deepEqual(saved.changedStores, ['answers:questions']); assert.deepEqual(saved.changedGames, ['questions']);
  assert.equal(r.snapshot().stores.answers['other-questions'].length, 0);
  assert.equal(r.apply({ ...action, personId: 'bo' }).status, 'rejected');
  assert(r.project('questions', 'bo').questions.every(q => q.closed));
  for (const stores of [{ unknown: [] }, { questions: [{ playerId: 'ann', episode: 999, question: 'happens', answer: 'yes' }] }]) {
    const bad = proof(); bad.setup.stores.answers = stores; const run = R.execute(bad);
    assert.equal(run.status, 'blocked'); assert.equal(run.category, 'fixture-construction');
  }
});

test('a draft with questions composes answer lines into the production totals', t => {
  const d = proof(); d.games[0].spec.ask = J.clone(d.games[2].spec.ask);
  const r = use(t, d), a = decision(r, 'lineup'); assert(r.apply(a).ok);
  assert(r.apply({ type: 'answer', gameId: 'lineup', personId: 'ann', question: 'happens', episode: 3, answer: 'yes' }).ok);
  aired(r, 3); assert(r.apply(result(r, 3, { events: [], scoringEvents: [{ id: 'reward', type: 'rewardWin', castawayId: a.ids[0] }], noExit: true })).ok);
  assert(r.apply({ type: 'reveal', contextId: 'show', personId: 'ann', episode: 3 }).ok);
  const state = r.snapshot().games.lineup.state, rows = r.snapshot().stores.answers.lineup;
  const withAnswers = S.AnswerLogic.withLines(state, S.AnswerLogic.lines(state, rows));
  const expected = S.computeScores(withAnswers).find(row => row.playerId === 'ann').total;
  assert.equal(r.project('lineup', 'ann').game.you.total, expected);
  assert.equal(S.AnswerLogic.grade(state, rows).points.get('ann'), 1);
});

test('setup histories replay once on open/reset; unsupported head histories and budgets are explicit', t => {
  const d = proof(); d.history.entries = [{ id: 'invalid-choice', action: { type: 'pick', gameId: 'picks', personId: 'ann', eventId: 'missing', ids: ['unknown'] }, expect: 'rejected' }];
  const r = use(t, d); assert.equal(r.export().trace.length, 1); r.reset(); assert.equal(r.export().trace.length, 1);
  const resumed = R.resume(r.export()); t.after(() => resumed.dispose()); assert.equal(resumed.export().trace.length, 1);
  d.history.snapshotAt = 'head'; assert(R.execute(d).gaps.some(g => g.path === '/history'));
  const oversized = proof(); oversized.content.eventCount = 60; oversized.world.contexts[0].engine.pool = 1000;
  assert.equal(R.execute(oversized).category, 'tool-budget');
  const stale = proof(); stale.versions.engine = 'older-engine'; const run = R.execute(stale);
  assert(run.ok); assert.equal(run.execution.preparation.versionDrift[0].component, 'engine');
});

test('unsupported modifiers, implicit rulebooks and unreconciled snapshots stay explicit gaps', () => {
  const modified = proof(); modified.games[0].spec.extras = { captain: 2 };
  assert.equal(R.execute(modified).status, 'blocked');
  const missing = proof(); delete missing.world.contexts[0].format;
  assert(R.execute(missing).gaps.some(g => /explicit built-in format/.test(g.reason)));
  const legacy = require('./fixtures/gameplay-explorer/legacy-lineup-v1.json');
  assert(R.execute(legacy).gaps.some(g => /snapshot reconciliation/.test(g.reason)));
});

test('headless result expectations and HTTP execution use the exact same runtime hashes', async () => {
  const d = proof(), steps = [{ action: { type: 'lineup', gameId: 'lineup', personId: 'stranger', eventId: 'unknown', ids: [] }, expect: 'rejected' }];
  const queries = [{ gameId: 'questions', personId: 'ann' }], direct = R.execute(d, steps, queries);
  assert(direct.ok); assert.equal(direct.execution.trace[0].status, 'rejected');
  const router = require('../tools/gameplay-bench/router.cjs').router({ out: path.join(os.tmpdir(), 'no-recorded-runtime-dataset'), releaseBench() {} });
  const http = await router('POST', new URL('http://localhost/__atlas/bench/execute'), { input: d, steps, queries });
  assert.equal(http.status, 200); assert.deepEqual(http.body, direct);
  const window = {};
  require('vm').runInNewContext(fs.readFileSync(path.join(__dirname, '../tools/gameplay-bench/runtime-client.js'), 'utf8'), { window, fetch: async (url, request) => {
    const response = await router('POST', new URL(url, 'http://localhost'), JSON.parse(request.body));
    return { ok: response.status === 200, status: response.status, json: async () => response.body };
  } });
  const browser = await window.__GAMEPLAY_EXPLORER__.execute(d, steps, queries);
  assert.deepEqual(browser, direct);
  const resumed = R.execute(direct); assert(resumed.ok); assert.equal(resumed.execution.stateHash, direct.execution.stateHash);
});

test('CLI execution saves durable structured results, resumes them and preserves existing evidence files', t => {
  // (.ui-atlas is git-ignored scratch: a fresh checkout has none until something makes it.)
  const root = path.resolve(__dirname, '..'); fs.mkdirSync(path.join(root, '.ui-atlas'), { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, '.ui-atlas/runtime-test-'));
  t.after(() => { const target = fs.realpathSync(dir); assert.equal(path.dirname(target), fs.realpathSync(path.join(root, '.ui-atlas'))); assert(path.basename(target).startsWith('runtime-test-')); fs.rmSync(target, { recursive: true, force: true }); });
  const input = path.join(dir, 'input.json'), output = path.join(dir, 'result.json'), replay = path.join(dir, 'resumed.json');
  fs.writeFileSync(input, JSON.stringify(proof()));
  const run = (file, out) => cp.spawnSync(process.execPath, ['scripts/gameplay-bench.js', 'execute', '--file=' + file, '--out=' + path.relative(root, out)], { cwd: root, encoding: 'utf8' });
  const first = run(input, output); assert.equal(first.status, 0, first.stderr);
  const expected = R.execute(proof());
  assert.equal(JSON.parse(fs.readFileSync(output)).execution.stateHash, expected.execution.stateHash);
  const next = run(output, replay); assert.equal(next.status, 0, next.stderr);
  assert.equal(JSON.parse(next.stdout).stateHash, expected.execution.stateHash);
  const bytes = fs.readFileSync(output, 'utf8'); assert.equal(run(input, output).status, 1); assert.equal(fs.readFileSync(output, 'utf8'), bytes);
});
