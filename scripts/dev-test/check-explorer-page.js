// The gameplay explorer page (/__atlas/explorer; the approved bench-v2 design, 2026-11-12), driven as a person would:
// open the example, situate (viewer, Air it, publish, reveal), switch screens, run the route checks, compare with another
// running app version, side bets, season-long questions answered on the real game page through the finale, head to head
// played through its playoff final, weeks won, only some moments counted as hits, co-op lives, bounties, teams, parlays, multipliers (the finale played on the page), rollovers,
// and each later capability's own step (the newest: a game in stages, --only="stages:"), export and
// replay headlessly, the phone layout and a definition that can't open.
//
// Needs: the app (:3000), UI Atlas (:4400; restart after bench edits: bash scripts/dev-test/restart-atlas.sh), local DB.
// Run:   node scripts/dev-test/check-explorer-page.js [--b=http://localhost:30xx]   (compare is skipped without a second app)
//        [--only=<regex>]: only the steps whose names match (each capability's step opens its own definition), e.g. --only=parlay
// Out:   .ui-atlas/explorer-page/ (screenshots, report.json). Cases are closed (zt-gb rows removed) as the page closes them.
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict'), { open } = require('./browser');
const root = path.resolve(__dirname, '../..'), base = 'http://127.0.0.1:4400', out = path.join(root, '.ui-atlas/explorer-page');
fs.mkdirSync(out, { recursive: true });
const R = require(path.join(root, 'tools/gameplay-bench/explorer/runtime.cjs')), D = require(path.join(root, 'tools/gameplay-bench/explorer/document.cjs'));
const B = process.argv.find(a => a.startsWith('--b='))?.slice(4), only = process.argv.find(a => a.startsWith('--only='))?.slice(7);
const blockedFile = path.join(out, 'blocked-definition.json'); fs.writeFileSync(blockedFile, JSON.stringify(D.read(require(path.join(root, 'tests/fixtures/gameplay-explorer/legacy-lineup-v1.json')))));
// A questions game with the season-long questions (who wins, the final three), one episode before the finale.
const seasonFile = path.join(out, 'season-long-definition.json'), Q = require(path.join(root, 'tests/fixtures/gameplay-explorer/questions-input.json'));
fs.writeFileSync(seasonFile, JSON.stringify(D.create({ seed: 11, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'questions', name: 'Season calls', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, ask: [...Q.spec.ask,
    { id: 'winner', ask: 'Who wins?', answer: 'person', points: 3, settle: { by: 'results', take: 'winner' }, asked: 'once', closes: 'finale', pick: 1, from: 'cast' },
    { id: 'top3', ask: 'Who makes the final three?', answer: 'person', points: 1, settle: { by: 'results', take: 'top', place: 3 }, asked: 'once', closes: 'finale', pick: 3, from: 'cast' }] } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 2, eventCount: 3 } })));
// A game from the merge (Episode 3 in this world), two episodes played: it waits until the merge is confirmed.
const phaseFile = path.join(out, 'from-the-merge-definition.json');
fs.writeFileSync(phaseFile, JSON.stringify(D.create({ seed: 4, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 12 }, phaseStarts: { merged: 3 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'merge', name: 'From the merge', contextId: 'show', timing: 'live-only', spec: { span: { from: { phase: 'merged' } }, get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'total' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 2, eventCount: 6 } })));
// Bounties: three episodes played, each starter of Ann's that votes out one of Bo's takes 2 points from Bo (one record miscounted).
const bountyFile = path.join(out, 'bounty-definition.json');
fs.writeFileSync(bountyFile, JSON.stringify(D.create({ seed: 11, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'bounty', name: 'Bounty hunters', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 4, own: 'exclusive', order: 'snake' }, count: { start: 3 }, score: { by: 'moments', bounty: { points: 2 } }, rank: { by: 'total' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 3, eventCount: 5 } })));
// Teams of players: four people drawn into two teams (their mean), two episodes played.
const teamsFile = path.join(out, 'teams-definition.json');
fs.writeFileSync(teamsFile, JSON.stringify(D.create({ seed: 6, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 4, pool: 12 } }], people: ['Ann', 'Bo', 'Cy', 'Di'].map(n => ({ id: n.toLowerCase(), name: n })) },
  games: [{ id: 'teams', name: 'Team lineup', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'total', teams: { of: 2 } } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 2, eventCount: 4 } })));
// A cut every episode (the lowest out), four people, one episode played: someone is already out.
const cutFile = path.join(out, 'cut-definition.json');
fs.writeFileSync(cutFile, JSON.stringify(D.create({ seed: 12, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 4, pool: 14 } }], people: ['Ann', 'Bo', 'Cy', 'Di'].map(n => ({ id: n.toLowerCase(), name: n })) },
  games: [{ id: 'cut', name: 'The guillotine', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'exclusive', order: 'snake' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'standing', cut: [{ at: { every: 1 }, out: 1, tie: 'keep', quiet: 'cut' }] } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 4 } })));
// Settled by the couch: "Who will most of you say goes home?", right when it matches most of the boot answers.
const playersFile = path.join(out, 'players-settle-definition.json');
fs.writeFileSync(playersFile, JSON.stringify(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'room', name: 'Read the room', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, ask: [Q.spec.ask[0], { id: 'most', ask: 'Who will most of you say goes home?', answer: 'person', points: 2, asked: 'each', settle: { by: 'players', take: 'majority', of: 'boot', tie: 'none' } }] } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 4 } })));
// Stakes from a bank of 10: "Who goes home?" takes any of it, "Will this moment occur?" up to 5.
const stakeFile = path.join(out, 'stakes-definition.json');
fs.writeFileSync(stakeFile, JSON.stringify(D.create({ seed: 3, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'stakes', name: 'Double or nothing', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, ask: [{ ...Q.spec.ask[0], wager: 'total' }, { ...Q.spec.ask[1], wager: 5 }], score: { ...Q.spec.score, bank: { start: 10 } }, rank: { by: 'total' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 4 } })));
// A Weekly Lineup whose teams came out of a hat (exclusive): recorded as drawn, so the server never deals again.
const drawFile = path.join(out, 'drawn-draft-definition.json');
fs.writeFileSync(drawFile, JSON.stringify(D.create({ seed: 2, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'drawn', name: 'Out of a hat', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'exclusive', order: 'draw' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'total' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 2, eventCount: 4 } })));
// Shared points: "Who goes home?" a split pot, "Who finds an idol?" only for the only one right.
const shareFile = path.join(out, 'shared-points-definition.json');
fs.writeFileSync(shareFile, JSON.stringify(D.create({ seed: 8, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'share', name: 'Shared calls', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, ask: [
    { id: 'boot', ask: 'Who goes home?', answer: 'person', points: 4, asked: 'each', settle: { by: 'results', take: 'out' }, share: 'split' },
    { id: 'idol', ask: 'Who finds an idol?', answer: 'person', points: 2, asked: 'each', settle: { by: 'moment', moment: 'idolFound', take: 'who' }, share: 'only' }] } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 4 } })));
// A co-op prediction game: the couch shares three lives, a night saved only when everyone who answered saw it coming.
const coopFile = path.join(out, 'coop-lives-definition.json');
fs.writeFileSync(coopFile, JSON.stringify(D.create({ seed: 6, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'coop', name: 'Together', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, score: { ...Q.spec.score, lives: 3, livesOn: ['boot'], saves: 'all' }, rank: { by: 'coop' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 4 } })));
// A Weekly Lineup where only two moments count, each a hit worth 1.
const onlyFile = path.join(out, 'only-hits-definition.json');
fs.writeFileSync(onlyFile, JSON.stringify(D.create({ seed: 3, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'only', name: 'Only two count', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments', only: ['idolFound', 'rewardWin'], hits: 'every' }, rank: { by: 'total' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 3, eventCount: 5 } })));
// Weekly Lineup ranked by weeks won (a week two top is shared), three people, three episodes in.
const weeksFile = path.join(out, 'weeks-won-definition.json');
fs.writeFileSync(weeksFile, JSON.stringify(D.create({ seed: 9, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 3, pool: 12 } }], people: ['Ann', 'Bo', 'Cy'].map(n => ({ id: n.toLowerCase(), name: n })) },
  games: [{ id: 'weeks', name: 'Weeks won', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'weeks', ties: 'split' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 3, eventCount: 5 } })));
// A parlay: "Who goes home?" and "Will this moment occur?" together, both right doubling each. Episode 1 is played: Ann was right
// on both (her answers read from the world's generated facts), Bo on the boot alone.
const parlayFile = path.join(out, 'parlay-definition.json');
{
  const def = setup => D.create({ seed: 7, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
    games: [{ id: 'parlay', name: 'Parlay night', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, score: { by: 'answers', parlays: [{ of: ['boot', 'happens'], times: 2 }] } } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 4 }, ...(setup ? { setup } : {}) });
  const probe = R.open(def()), w = probe.snapshot().contexts.show; probe.dispose();
  const f1 = w.facts.find(x => x.eventId === w.events[0].id).data, boot = f1.events[0].castawayId, happened = f1.scoringEvents.some(m => m.type === 'rewardWin') ? 'yes' : 'no';
  fs.writeFileSync(parlayFile, JSON.stringify(def({ stores: { answers: { parlay: [
    { playerId: 'ann', episode: 1, question: 'boot', answer: boot }, { playerId: 'ann', episode: 1, question: 'happens', answer: happened },
    { playerId: 'bo', episode: 1, question: 'boot', answer: boot }, { playerId: 'bo', episode: 1, question: 'happens', answer: happened === 'yes' ? 'no' : 'yes' }] } } })));
}
// Multipliers: a Weekly Lineup whose episode 1 counts double and whose finale counts triple; two episodes played, the finale next.
const timesFile = path.join(out, 'multipliers-definition.json');
const timesDef = times => D.create({ seed: 12, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'times', name: 'Big nights', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments', ...(times ? { times } : {}) }, rank: { by: 'total' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 2, eventCount: 3 } });
fs.writeFileSync(timesFile, JSON.stringify(timesDef([{ times: 2, episode: 1 }, { times: 3, finale: true }])));
// Each seat's points on each episode as `viewer` sees them, and the same run replayed on its twin without times.
const gridOf = (s, viewer) => Object.fromEntries(Object.entries(s.project('times', viewer).game.plays.rows).map(([seat, rows]) => [seat, Object.fromEntries(rows.map(w => [w.episode, w.points]))]));
// Whole-game moment questions, answered before the start: who finds an idol, who wins immunity first, will anyone go to Exile,
// how many reward wins. Three episodes played, the finale next. Ann's answers follow the history so far (the first immunity winner,
// someone who found an idol, the reward wins so far); Bo's don't.
const onceFile = path.join(out, 'whole-game-definition.json');
{
  const once = (id, ask, answer, take, moment, points) => ({ id, ask, answer, points, asked: 'once', closes: 'start', settle: { by: 'moment', moment, take }, ...(answer === 'person' ? { pick: 1, from: 'cast' } : {}) });
  const ask = [once('idols', 'Who finds an idol this season?', 'person', 'who', 'idolFound', 2), once('firstImmunity', 'Who wins individual immunity first?', 'person', 'first', 'individualImmunity', 3),
    once('exile', 'Will anyone go to Exile?', 'yesNo', 'happened', 'wentToExile', 1), once('rewards', 'How many reward wins this season?', 'number', 'count', 'rewardWin', 3)];
  const def = setup => D.create({ seed: 1, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
    games: [{ id: 'whole', name: 'The whole season', contextId: 'show', timing: 'live-only', spec: { get: { by: 'none' }, score: { by: 'answers' }, rank: { by: 'total' }, ask } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 3, eventCount: 4 }, ...(setup ? { setup } : {}) });
  const probe = R.open(def()), w = probe.snapshot().contexts.show; probe.dispose();
  const moments = w.events.flatMap(e => (w.facts.find(f => f.eventId === e.id)?.data.scoringEvents || []).map(m => ({ n: e.number, ...m })));
  const of = type => moments.filter(m => m.type === type), cast = w.participants.map(x => x.id), other = id => cast.find(x => x !== id);
  const firstImm = of('individualImmunity').sort((a, b) => a.n - b.n)[0]?.castawayId ?? cast[0], idol = of('idolFound')[0]?.castawayId ?? cast[1];
  const row = (playerId, question, answer) => ({ playerId, episode: 0, question, answer });
  fs.writeFileSync(onceFile, JSON.stringify(def({ stores: { answers: { whole: [
    row('ann', 'idols', idol), row('ann', 'firstImmunity', firstImm), row('ann', 'exile', 'yes'), row('ann', 'rewards', of('rewardWin').length),
    row('bo', 'idols', other(idol)), row('bo', 'firstImmunity', other(firstImm)), row('bo', 'exile', 'no'), row('bo', 'rewards', of('rewardWin').length + 3)] } } })));
}
// Weekly Calls: Ann and Bo, one episode played. Before it aired Ann called its boot right and Bo wrong (setup calls); episode 2's
// calls are open.
const callsFile = path.join(out, 'weekly-calls-definition.json');
{
  const def = setup => D.create({ seed: 3, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
    games: [{ id: 'calls', name: 'Call it', contextId: 'show', timing: 'live-only', spec: { preset: 'weekly-calls' } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [{ personId: 'ann', contextId: 'show', through: 1 }, { personId: 'bo', contextId: 'show', through: 1 }] }, content: { completedEvents: 1, eventCount: 3 }, ...(setup ? { setup } : {}) });
  const probe = R.open(def()), w = probe.snapshot().contexts.show; probe.dispose();
  const boot = w.facts.find(f => f.eventId === w.events[0].id).data.events[0].castawayId, other = w.participants.map(x => x.id).find(id => id !== boot);
  fs.writeFileSync(callsFile, JSON.stringify(def({ stores: { calls: { show: [{ personId: 'ann', episode: 1, question: 'out', answer: boot }, { personId: 'bo', episode: 1, question: 'out', answer: other }] } } })));
}
// Confidence picks: "Rank who goes home, surest first" (three; the first worth 3). Episode 1 played: Ann ranked its boot second (2).
const sureFile = path.join(out, 'confidence-definition.json');
{
  const sure = { id: 'sure', ask: 'Rank who goes home, surest first', answer: 'confidence', points: 1, pick: 3, asked: 'each', settle: { by: 'results', take: 'out' }, closes: 'start' };
  const def = setup => D.create({ seed: 3, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
    games: [{ id: 'sure', name: 'Surest first', contextId: 'show', timing: 'live-only', spec: { get: { by: 'none' }, score: { by: 'answers' }, rank: { by: 'total' }, ask: [sure] } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 3 }, ...(setup ? { setup } : {}) });
  const probe = R.open(def()), w = probe.snapshot().contexts.show; probe.dispose();
  const boot = w.facts.find(f => f.eventId === w.events[0].id).data.events[0].castawayId, others = w.participants.map(x => x.id).filter(id => id !== boot);
  fs.writeFileSync(sureFile, JSON.stringify(def({ stores: { answers: { sure: [{ playerId: 'ann', episode: 1, question: 'sure', answer: [others[0], boot, others[1]] }, { playerId: 'bo', episode: 1, question: 'sure', answer: [others[2]] }] } } })));
}
// The weekly card: a pick game where only this week's card counts (three of five moments, in turn), each a hit once a pick.
const cardFile = path.join(out, 'weekly-card-definition.json'), cardSpec = { get: { by: 'pick', each: 1, repeat: 'any' }, count: { pick: true }, score: { by: 'moments', only: 'card', hits: 'pick' }, rank: { by: 'total' },
  card: { from: 'moments', each: 3, of: ['rewardWin', 'individualImmunity', 'satOut', 'idolFound', 'challengeThird'] } };
fs.writeFileSync(cardFile, JSON.stringify(D.create({ seed: 3, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'card', name: 'This week\'s card', contextId: 'show', timing: 'live-only', spec: cardSpec }], situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 3 } })));
// Beat the bot: "Who goes home?" and the moment question against the bot's calls. Episode 1 played: the bot named the boot (Ann did
// too: nothing for her) and said no to the moment, wrongly when it happened (Ann's yes scores).
const beatFile = path.join(out, 'beat-the-bot-definition.json');
{
  const def = setup => D.create({ seed: 3, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
    games: [{ id: 'beat', name: 'Beat the bot', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, ask: Q.spec.ask.map(q => ({ ...q, beat: { by: 'bot', none: 'plays' } })) } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 3 }, ...(setup ? { setup } : {}) });
  const probe = R.open(def()), w = probe.snapshot().contexts.show; probe.dispose();
  const d1 = w.facts.find(f => f.eventId === w.events[0].id).data, boot = d1.events[0].castawayId, happened = d1.scoringEvents.some(m => m.type === 'rewardWin') ? 'yes' : 'no';
  fs.writeFileSync(beatFile, JSON.stringify(def({ stores: {
    answers: { beat: [{ playerId: 'ann', episode: 1, question: 'boot', answer: boot }, { playerId: 'ann', episode: 1, question: 'happens', answer: happened }] },
    bot: { beat: [{ question: 'boot', episode: 1, answer: boot }, { question: 'happens', episode: 1, answer: happened === 'yes' ? 'no' : 'yes' }] } } })));
}
// Outlast in reverse: three each, three episodes played (the earlier yours go home, the more you score).
const reverseFile = path.join(out, 'outlast-reverse-definition.json');
fs.writeFileSync(reverseFile, JSON.stringify(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 8 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'reverse', name: 'First out wins', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { all: true }, score: { by: 'place', reverse: true }, rank: { by: 'total' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 3, eventCount: 5 } })));
// The top scorer's twist: a Weekly Lineup with double or half points; episode 1 played, so its top scorer chooses episode 2's twist.
const twistFile = path.join(out, 'top-scorer-twist-definition.json');
fs.writeFileSync(twistFile, JSON.stringify(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 8 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'twist', name: 'Twist night', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments', twist: { of: [{ id: 'double', name: 'Double points', times: 2 }, { id: 'half', name: 'Half points', times: 0.5 }] } }, rank: { by: 'total' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 3 } })));
// A captain: a Weekly Lineup whose captain (one of your starters, named with the lineup) scores double. One episode played.
const captainFile = path.join(out, 'captain-definition.json');
fs.writeFileSync(captainFile, JSON.stringify(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 8 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'captain', name: 'Captain lineup', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments', captain: { times: 2 } }, rank: { by: 'total' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 3 } })));
// Secret roles: a three-person Weekly Lineup where one seat is dealt the Traitor once the game starts; two episodes played.
const rolesFile = path.join(out, 'secret-roles-definition.json');
fs.writeFileSync(rolesFile, JSON.stringify(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 3, pool: 9 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }, { id: 'cy', name: 'Cy' }] },
  games: [{ id: 'roles', name: 'Traitors', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 2, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments', roles: { count: 1, points: 2, on: 'out' } }, rank: { by: 'total' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 2, eventCount: 4 } })));
// A draft spread across tribes: three tribes, four each, the draft spread (2, 1, 1); one episode played.
const acrossFile = path.join(out, 'spread-draft-definition.json');
fs.writeFileSync(acrossFile, JSON.stringify(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 12 }, tribes: 3 }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'across', name: 'One from each tribe', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 4, own: 'shared', order: 'blind', across: { of: 'group', then: 'keep' } }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'total' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 3 } })));
// A survival pool's riders: two pools on one world whose first episode's picks went home: one bought back (one life, 3 points off),
// one forgiven (a mulligan, the streak carries on); two episodes played.
const poolFile = path.join(out, 'pool-riders-definition.json');
fs.writeFileSync(poolFile, JSON.stringify(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'buyback', name: 'Second chances', contextId: 'show', timing: 'live-only', spec: { get: { by: 'pick', each: 1, repeat: 'never' }, score: { by: 'survive', lives: 1, buyback: { times: 1, before: null, cost: 3 } }, rank: { by: 'standing' } } },
    { id: 'mulligan', name: 'One on the house', contextId: 'show', timing: 'live-only', spec: { get: { by: 'pick', each: 1, repeat: 'never' }, score: { by: 'survive', mulligans: 1 }, rank: { by: 'streak' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 2, eventCount: 5 } })));
// Group slots on a world that forms pairs (re-paired every two episodes): one slot, the pair's mean; one episode played, so the
// premiere's pairs are on offer going into episode 2.
const groupsFile = path.join(out, 'group-slots-definition.json');
fs.writeFileSync(groupsFile, JSON.stringify(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 }, pairs: { every: 2 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'groups', name: 'Plus one', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'shared', order: 'blind', groups: { slots: 1, own: 'shared', swap: false, fallback: 'void', points: 'mean' } }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'total' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 5 } })));
// A pool that never repeats and skips a night you've used everyone still in: five castaways, four episodes played; Ann's history
// (seed 8) is right three nights, then skipped (nobody left she hadn't picked).
const skipFile = path.join(out, 'skip-pool-definition.json');
fs.writeFileSync(skipFile, JSON.stringify(D.create({ seed: 8, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 5 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'skip', name: 'No repeats', contextId: 'show', timing: 'live-only', spec: { get: { by: 'pick', each: 1, repeat: 'never', fallback: 'skip' }, score: { by: 'survive', lives: 2 }, rank: { by: 'standing' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 4, eventCount: 6 } })));
// An auction (Outlast, exclusive, everyone's $100, the lowest price 1, filled): sealed bids settled at setup; one episode played. Ann
// (seed 5) wins one castaway at 95 and is filled with two more at 1.
const auctionFile = path.join(out, 'auction-definition.json');
fs.writeFileSync(auctionFile, JSON.stringify(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 3, pool: 12 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }, { id: 'cy', name: 'Cy' }] },
  games: [{ id: 'auction', name: 'Sealed bids', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'exclusive', order: 'auction', budget: { total: 100, floor: 1, fallback: 'fill' } }, count: { all: true }, score: { by: 'place' }, rank: { by: 'total' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 4 } })));
// Mid-season waivers (Outlast, exclusive; every loss replaced, a replacement scoring half): one episode played. Ann (seed 1) lost one
// in it, made no claim, and the week has processed: free agency is open until the next episode airs.
const waiversFile = path.join(out, 'waivers-definition.json');
fs.writeFileSync(waiversFile, JSON.stringify(D.create({ seed: 1, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'waivers', name: 'Second wind', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 2, own: 'exclusive', order: 'snake' }, count: { all: true }, score: { by: 'place', multiply: [{ joined: 'replacement', times: [0.5] }] }, rank: { by: 'total' }, extras: { waivers: { feel: 'balanced', replace: 'always', short: null, windows: { schedule: 'manual', every: 3, swaps: 0 }, order: 'rolling', hours: 24, freeAgency: true, autoFill: true, own: { replace: 'shared' } } } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 4 } })));
// A draft with no waivers of its own (most drafts: Outlast, exclusive, nobody replaced): one episode played, Ann (seed 1, who runs
// the game: its first seat) lost one in it. The only waivers it ever sees are a window she opens by hand.
const handWindowFile = path.join(out, 'hand-window-definition.json');
fs.writeFileSync(handWindowFile, JSON.stringify(D.create({ seed: 1, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'byhand', name: 'No second chances', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 2, own: 'exclusive', order: 'snake' }, count: { all: true }, score: { by: 'place' }, rank: { by: 'total' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 4 } })));
// A streak pool with a second pick (void on a night only one goes home); one episode played.
const secondFile = path.join(out, 'second-pick-definition.json');
fs.writeFileSync(secondFile, JSON.stringify(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
  games: [{ id: 'second', name: 'Two shots', contextId: 'show', timing: 'live-only', spec: { get: { by: 'pick', each: 1, repeat: 'never', second: { fallback: 'void' } }, score: { by: 'survive' }, rank: { by: 'streak' } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 1, eventCount: 5 } })));
// Rollovers: "Who goes home?" worth 3 and rolling over; episode 1 both wrong, episode 2 nobody answered, so episode 3's is worth 9.
const rollFile = path.join(out, 'rollover-definition.json');
{
  const def = setup => D.create({ seed: 8, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
    games: [{ id: 'roll', name: 'Jackpot', contextId: 'show', timing: 'live-only', spec: { ...Q.spec, ask: [{ ...Q.spec.ask[0], points: 3, rollover: true }, Q.spec.ask[1]] } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 2, eventCount: 4 }, ...(setup ? { setup } : {}) });
  const probe = R.open(def()), w = probe.snapshot().contexts.show; probe.dispose();
  const boot = w.facts.find(x => x.eventId === w.events[0].id).data.events[0].castawayId, wrong = w.participants.map(x => x.id).filter(id => id !== boot);
  fs.writeFileSync(rollFile, JSON.stringify(def({ stores: { answers: { roll: [
    { playerId: 'ann', episode: 1, question: 'boot', answer: wrong[0] }, { playerId: 'bo', episode: 1, question: 'boot', answer: wrong[1] }] } } })));
}
// Weekly Lineup head to head, four people, a two-team playoff final at the season's last episode (5).
const h2hFile = path.join(out, 'head-to-head-definition.json');
fs.writeFileSync(h2hFile, JSON.stringify(D.create({ seed: 5, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 4, pool: 14 } }], people: ['Ann', 'Bo', 'Cy', 'Di'].map(n => ({ id: n.toLowerCase(), name: n })) },
  games: [{ id: 'h2h', name: 'Head to head', contextId: 'show', timing: 'live-only', spec: { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'matchups', playoffs: { teams: 2 } } } }],
  situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 3, eventCount: 5 } })));

// A game in stages: two Weekly Lineups split at the merge (Episode 3 in this world), each a game of its own with its own draft, the
// overall by points. Two episodes played; Ann caught up, Bo one behind. Made live, as the engine lab (its only door) makes one.
const stagesFile = path.join(out, 'stages-definition.json');
{
  const lineup = { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'total' } };
  fs.writeFileSync(stagesFile, JSON.stringify(D.create({ seed: 9, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 12 }, phaseStarts: { merged: 3 } }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }] },
    games: [{ id: 'stages', name: 'Before and after', contextId: 'show', timing: 'live-only', spec: { stages: [{ id: 'before', name: 'Before the merge', game: { ...lineup, span: { from: 1, to: { phase: 'merged' } } } }, { id: 'after', name: 'Merged', game: { ...lineup, span: { from: { phase: 'merged' } } } }], overall: { by: 'points' } } }],
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: [{ personId: 'bo', contextId: 'show', through: 1 }] }, content: { completedEvents: 2, eventCount: 6 } })));
}

(async () => {
  const b = await open({ width: 1440, height: 1000, motion: 'reduce' }), p = b.page, steps = [];
  const step = async (name, fn) => { if (only && !new RegExp(only, 'i').test(name)) return; try { await fn(); steps.push({ name, ok: true }); console.log('PASS ' + name); } catch (e) { steps.push({ name, ok: false, error: e.message }); await p.screenshot({ path: path.join(out, 'fail-' + steps.length + '.png') }).catch(() => {}); console.log('FAIL ' + name + ': ' + e.message.slice(0, 200)); } };
  const page = () => p.evaluate(() => { const x = window.__GAMEPLAY_EXPLORER_PAGE__; return { ui: x.ui, a: x.sides.a && { state: x.sides.a.state, oracles: x.sides.a.oracles }, b: x.sides.b && { state: x.sides.b.state } }; });
  const checked = async (side = 'a') => p.waitForFunction(k => !!window.__GAMEPLAY_EXPLORER_PAGE__.sides[k]?.oracles, side, { timeout: 30000 });
  // The app inside the frame must be signed in as the person selected (a wrong identity would make every judgement wrong).
  const identity = async () => { await p.waitForTimeout(1500); const v = (await page()).ui.viewerId; let user; /* a frame reload can interrupt the probe: retry */
    for (let i = 0; i < 4 && !user; i++) { user = await p.frameLocator('#device-a iframe').locator('body').evaluate(() => fetch('/api/me/home').then(r => r.json()).then(j => j.user?.username || j.user?.name)).catch(() => null); if (!user) await p.waitForTimeout(1500); } assert.match(String(user), new RegExp('^' + v + '_ztgb'), 'frame signed in as ' + user + ', viewer is ' + v); };
  const shot = name => p.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
  try {
    await p.goto(base + '/__atlas/explorer'); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__?.ready, {}, { timeout: 20000 });
    await step('empty state offers the example', async () => { assert(await p.locator('#empty').isVisible()); await shot('01-empty'); });
    await step('the example opens on real routes with every region filled', async () => {
      await p.locator('#empty-example').click(); await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const s = (await page()).a.state; assert(s.live, 'live tier'); assert.equal(await p.locator('#people .person').count(), 2); assert.equal(await p.locator('#episodes .ep').count(), 5);
      assert.match(await p.locator('#case-title').innerText(), /Three games/); await shot('02-opened');
    });
    await step('viewing as Bo opens the app as Bo, behind', async () => {
      await p.locator('[data-viewer="bo"]').click(); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.ui.viewerId === 'bo'); await checked();
      assert.match(await p.locator('[data-viewer="bo"]').innerText(), /1 behind/); await identity();
    });
    await step('Air it, then final results: episode 3 shows who went home', async () => {
      await p.waitForFunction(() => !document.querySelector('#stage.busy'), {}, { timeout: 20000 });
      await p.locator('#episodes [data-air]').click();
      await p.waitForFunction(() => { const s = window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state, e = s.events.find(x => x.number === 3); return Date.parse(s.clock) >= Date.parse(e.airAt); }, {}, { timeout: 20000 })
        .catch(async e => { throw Error('the clock did not move: ' + (await p.locator('#error').innerText().catch(() => '')) + ' / ' + e.message.slice(0, 80)); });
      await p.locator('#episodes [data-publish="final"]').first().waitFor({ timeout: 20000 });
      await p.locator('#episodes [data-publish="final"]').first().click(); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.events.find(e => e.number === 3).resultStatus === 'final', {}, { timeout: 20000 });
      await p.locator('#episodes .ep').nth(2).filter({ hasText: 'went home' }).waitFor({ timeout: 15000 }); await identity(); await shot('03-published');
    });
    await step("Bo's reveal plays the real reveal and moves only Bo", async () => {
      const before = (await page()).a.state.people.find(x => x.id === 'ann').seen;
      await p.locator('[data-reveal="bo"]').click(); await p.frameLocator('#device-a iframe').locator('[data-beat],[data-stage]').first().waitFor({ timeout: 30000 });
      // Poll the server's state: the page's own copy refreshes on its schedule (waiting on it made this step flaky; the server
      // had Bo at 2 when it timed out).
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      let boSeen = null;
      for (let t = 0; t < 30 && boSeen !== 2; t++) { boSeen = (await serverState()).people.find(x => x.id === 'bo').seen; if (boSeen !== 2) await p.waitForTimeout(1000); }
      assert.equal(boSeen, 2, "Bo's reveal reached the runtime");
      assert.equal((await serverState()).people.find(x => x.id === 'ann').seen, before); await shot('04-reveal');
    });
    await step('a game page opens from Games…', async () => { await p.locator('#game').selectOption('lineup'); await p.frameLocator('#device-a iframe').locator('[data-game-page]').waitFor({ timeout: 30000 }); await checked(); });
    await step('the route checks find no spoilers and matching standings', async () => {
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 60000 }); await shot('05-checks');
    });
    if (B) await step('compare opens the same case on ' + B + ', evidence folds away, then back', async () => {
      await p.locator('#app-b').selectOption(B).catch(() => {}); await p.locator('#compare').click(); await p.locator('#device-b iframe').waitFor({ timeout: 40000 });
      assert.equal(await p.locator('#ev-body').isVisible(), false, 'evidence should fold in compare'); assert(await p.locator('#same').isVisible()); await shot('06-compare');
      await p.locator('#compare').click(); await p.waitForFunction(() => !window.__GAMEPLAY_EXPLORER_PAGE__.sides.b, {}, { timeout: 20000 });
    });
    await step('a recipe opens through the panel: a Survival Pool with a friend behind', async () => {
      await p.locator('#open').click(); await p.locator('#open-recipe').click(); await p.locator('#recipe').waitFor({ state: 'visible' });
      await p.locator('#r-game').selectOption('pool'); await p.locator('[data-preset="friend-behind"]').click(); await p.locator('#r-game').selectOption('pool'); await shot('05b-recipe');
      await p.locator('#recipe button[type="submit"]').click(); await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      assert.match(await p.locator('#case-title').innerText(), /Survival Pool/); assert.match(await p.locator('#people').innerText(), /behind/);
    });
    await step('side bets: posted in the explorer, guessed in the real app, graded by the commissioner, server agrees', async () => {
      await p.locator('#open').click(); await p.locator('#open-recipe').click(); await p.locator('#recipe').waitFor({ state: 'visible' });
      await p.locator('#r-game').selectOption('lineup'); await p.locator('#recipe button[type="submit"]').click(); await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      assert(await p.locator('#bets-section').isVisible(), 'Weekly Lineup has side bets on');
      await p.locator('#bet-label').fill('Will anyone cry?'); await p.locator('#bet-post').click();
      await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.bets.length === 1, {}, { timeout: 20000 });
      // Guess in the app: Your moves → Predictions (Quick action opens the moves sheet from the game's strip).
      await p.locator('#game').selectOption('lineup'); const app = p.frameLocator('#device-a iframe'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 });
      await p.locator('#device-a').scrollIntoViewIfNeeded(); await app.locator('[data-game-strip] button').first().click(); const dialog = app.getByRole('dialog'); await dialog.first().waitFor({ timeout: 30000 });
      await p.locator('#device-a').scrollIntoViewIfNeeded(); await dialog.locator('button, [role="tab"]', { hasText: 'Predictions' }).first().click();
      const chip = dialog.locator('[data-guess-chip="Yes"]'), box = dialog.locator('input[data-guess]');
      if (await chip.count()) await chip.first().click(); else await box.first().fill('Yes');
      const before = (await page()).a.state.trace.length; await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await p.waitForFunction(n => { const s = window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state; return s.trace.length > n && s.bets[0]?.predictions.length === 1; }, before, { timeout: 25000 }).catch(async () => { await new Promise(r => setTimeout(r, 2500)); });
      await p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()).then(s => { window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state = s; }));
      const st = (await page()).a.state, last = st.trace.at(-1);
      assert.equal(st.bets[0].predictions.length, 1, 'the guess reached the runtime: ' + JSON.stringify(st.trace.slice(-2)));
      assert.equal(last.origin, 'bench-frame-live'); assert.equal(last.type, 'guess'); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      await shot('05c-bet-guessed');
      // Air it, final results, then mark the guess right as the commissioner.
      await p.keyboard.press('Escape'); await p.locator('#episodes [data-air]').click();
      await p.locator('#episodes [data-publish="final"]').first().waitFor({ timeout: 20000 }); await p.locator('#episodes [data-publish="final"]').first().click();
      await p.locator('#bets [data-grade="true"]').first().waitFor({ timeout: 20000 }); await p.locator('#bets [data-grade="true"]').first().click();
      await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.bets[0].predictions[0].correct === true, {}, { timeout: 20000 });
      await shot('05d-bet-graded');
    });
    await step('season-long questions: "Who wins?" answered on the real game page (filed as episode 0), locked and settled by the finale', async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(seasonFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      await p.locator('#game').selectOption('questions'); const app = p.frameLocator('#device-a iframe'), q = app.locator('[data-question="winner"]');
      await q.waitFor({ timeout: 30000 }); assert.equal(await q.getAttribute('data-question-status'), 'open');
      await p.locator('#device-a').scrollIntoViewIfNeeded(); const face = q.locator('[data-answer-face]').first(), named = await face.getAttribute('data-answer-face'); await face.click();
      const before = (await page()).a.state.trace.length; await app.getByRole('button', { name: /^Save/ }).first().click();
      await p.waitForFunction(n => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.trace.length > n, before, { timeout: 25000 }).catch(() => {});
      await p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()).then(s => { window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state = s; }));
      let st = (await page()).a.state; const last = st.trace.at(-1);
      assert.equal(last?.type, 'answer', 'the answer reached the runtime: ' + JSON.stringify(st.trace.slice(-2))); assert.equal(last.origin, 'bench-frame-live'); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      await shot('05e-season-answered');
      // The finale: Air it (the question locks), final results (a winner; the season ends), Ann's reveal settles it for her.
      await p.waitForFunction(() => !document.querySelector('#stage.busy'), {}, { timeout: 20000 }); await p.locator('#episodes [data-air]').click();
      await p.locator('#episodes [data-publish="final"]').first().waitFor({ timeout: 20000 }); await p.locator('#episodes [data-publish="final"]').first().click();
      await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.events.at(-1).resultStatus === 'final', {}, { timeout: 20000 });
      await p.locator('[data-reveal="ann"]').click(); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.people.find(x => x.id === 'ann').seen === 3, {}, { timeout: 20000 });
      await p.locator('#game').selectOption('questions'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 });
      st = (await page()).a.state; assert.equal(st.events.length, 3, 'a season with a winner adds no episode');
      // The real question sheet, as Ann reads it: closed, settled, her answer right or wrong (the app reads the same route).
      const sheet = await app.locator('body').evaluate(async () => { const [, season, league] = location.pathname.match(/([0-9a-f-]{36}).*?([0-9a-f-]{36})/) || []; return fetch('/api/seasons/' + season + '/answers?league=' + league).then(r => r.json()); });
      const w = sheet.questions.find(x => x.id === 'winner'), ann = w.people.find(x => x.you);
      assert.equal(w.status, 'closed'); assert.equal(JSON.stringify(ann?.answer), JSON.stringify(named), 'her answer as saved'); assert.notEqual(w.verdict?.state ?? 'waiting', 'waiting', 'settled for Ann: ' + JSON.stringify(w.verdict));
      await shot('05f-season-settled'); await app.locator('[data-door-you]').click().catch(() => {}); await p.waitForTimeout(1500); await shot('05g-season-your-sheet');
    });
    await step('head to head: the real game page shows your record and last matchup; played through the playoff final, the routes agree', async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(h2hFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe');
      await p.locator('#game').selectOption('h2h'); await app.locator('[data-game-main="matchup"]').waitFor({ timeout: 30000 });
      const text = await app.locator('[data-game-page]').innerText();
      // Her record as the runtime projects the same definition, headlessly, is the one the season grid shows.
      const local = R.open(JSON.parse(fs.readFileSync(h2hFile, 'utf8'))), rec = local.project('h2h', 'ann').game.matchups.record; local.dispose();
      assert.ok(text.includes(rec.wins + '–' + rec.losses), 'record ' + rec.wins + '–' + rec.losses + ' on the page: ' + text.slice(0, 1500).replace(/\s+/g, ' '));
      await shot('05h-h2h-week');
      // Episode 4 (the regular season's last), then 5 (the final; the season ends with a winner); Ann watches both.
      for (const n of [4, 5]) {
        await p.waitForFunction(() => !document.querySelector('#stage.busy'), {}, { timeout: 20000 }); await p.locator('#episodes [data-air]').click();
        await p.locator('#episodes [data-publish="final"]').first().waitFor({ timeout: 20000 }); await p.locator('#episodes [data-publish="final"]').first().click();
        await p.waitForFunction(k => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.events.find(e => e.number === k).resultStatus === 'final', n, { timeout: 20000 });
        await p.locator('[data-reveal="ann"]').click(); await p.waitForFunction(k => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.people.find(x => x.id === 'ann').seen === k, n, { timeout: 30000 });
      }
      await p.locator('#game').selectOption('h2h'); await app.locator('[data-game-main="matchup"]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000); await shot('05i-h2h-final');
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("weeks won: the real game page's count is the runtime's", async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(weeksFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('weeks'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 });
      const local = R.open(JSON.parse(fs.readFileSync(weeksFile, 'utf8'))), won = local.project('weeks', 'ann').game.weeksWon; local.dispose();
      const main = await app.locator('[data-game-page]').getAttribute('data-game-main'), text = (await app.locator('[data-game-page]').innerText()).replace(/\s+/g, ' ');
      assert.equal(main, 'week'); assert.match(text, /weeks won/i, 'the weeks-won block: ' + text.slice(0, 800));
      await shot('05j-weeks'); assert.ok(won && Number.isInteger(won.ann), 'runtime weeks won: ' + JSON.stringify(won)); assert.match(text, new RegExp('\\b' + won.ann + ' weeks? won', 'i'), "Ann's count is the runtime's (" + won.ann + ')');
    });
    await step('only some moments count, as hits: the game page says so, How it works spells it out, standings agree', async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(onlyFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('only'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 });
      const text = (await app.locator('[data-game-page]').innerText()).replace(/\s+/g, ' ');
      assert.match(text, /only 2 moments count/i, 'the summary line: ' + text.slice(0, 600));
      const how = await app.locator('body').evaluate(async () => { const [, season] = location.pathname.match(/([0-9a-f-]{36})/) || []; const couch = (await fetch('/api/me/home').then(r => r.json())).couches?.[0]?.id; return fetch('/api/seasons/' + season + '/how-it-works?couch=' + couch).then(r => r.text()); });
      fs.writeFileSync(path.join(out, 'only-hits-how-it-works.json'), how);
      // Known gap (plan, "Designs needed" item 4): How it works' "What scores" lists every moment at its rulebook points for this
      // game, not "Only two moments count … a hit, worth 1". Reported, not failed, until the design round fixes it.
      if (!/Only two moments count/.test(how)) console.log("NOTE How it works doesn't say only two moments count, as hits (Designs needed item 4); see only-hits-how-it-works.json");
      await shot('05k-only-hits'); await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("co-op lives: 'Who goes home?' answered on the real game page; after the episode its lives are the runtime's", async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(coopFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'), q = app.locator('[data-question="boot"]'); await p.locator('#game').selectOption('coop'); await q.waitFor({ timeout: 30000 });
      await p.locator('#device-a').scrollIntoViewIfNeeded(); await q.locator('[data-answer-face]').first().click();
      const before = (await page()).a.state.trace.length; await app.getByRole('button', { name: /^Save/ }).first().click();
      await p.waitForFunction(n => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.trace.length > n, before, { timeout: 25000 }).catch(() => {});
      let st = await p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      assert.equal(st.trace.at(-1)?.type, 'answer', 'the answer reached the runtime'); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      await p.waitForFunction(() => !document.querySelector('#stage.busy'), {}, { timeout: 20000 }); await p.locator('#episodes [data-air]').click();
      await p.locator('#episodes [data-publish="final"]').first().waitFor({ timeout: 20000 }); await p.locator('#episodes [data-publish="final"]').first().click();
      await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.events.find(e => e.number === 2).resultStatus === 'final', {}, { timeout: 20000 });
      await p.locator('[data-reveal="ann"]').click(); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.people.find(x => x.id === 'ann').seen === 2, {}, { timeout: 30000 });
      await p.locator('#game').selectOption('coop'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(800);
      const local = R.resume(JSON.parse(await p.evaluate(() => fetch('/__atlas/bench/runtime/export?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.text()))).execution), lives = local.project('coop', 'ann').game.coop.lives; local.dispose();
      // Where (if anywhere) the page says how many lives are left: its text or its accessible labels (the hearts). A NOTE, not a
      // failure, while it says it nowhere (Designs needed item 5).
      const seenOn = await app.locator('[data-game-page]').evaluate(el => ({ text: el.innerText.replace(/\s+/g, ' '), labels: [...el.querySelectorAll('[aria-label]')].map(x => x.getAttribute('aria-label')).filter(l => /li(fe|ves)/i.test(l)) }));
      fs.writeFileSync(path.join(out, 'coop-page.json'), JSON.stringify({ lives, ...seenOn }, null, 2));
      const said = new RegExp('\\b' + lives + ' (of \\d+ )?(lives|life) left', 'i');
      if (!said.test(seenOn.text) && !seenOn.labels.some(l => said.test(l))) console.log('NOTE the co-op page never says ' + lives + ' left (Designs needed item 5); see coop-page.json');
      await shot('05l-coop-lives'); await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step('shared points: the real sheet states each share rule; an answer saved there agrees; settled after the episode', async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(shareFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('share'); await app.locator('[data-question="boot"]').waitFor({ timeout: 30000 });
      assert.match(await app.locator('[data-question="boot"] [data-answer-riders]').innerText(), /Split between everyone who's right/);
      assert.match(await app.locator('[data-question="idol"] [data-answer-riders]').innerText(), /only if you're the only one right/);
      await p.locator('#device-a').scrollIntoViewIfNeeded(); await app.locator('[data-question="boot"] [data-answer-face]').first().click();
      const before = (await page()).a.state.trace.length; await app.getByRole('button', { name: /^Save/ }).first().click();
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      let st; for (let t = 0; t < 25; t++) { st = await serverState(); if (st.trace.length > before) break; await p.waitForTimeout(1000); }
      assert.equal(st.trace.at(-1)?.type, 'answer', 'the answer reached the runtime'); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      await shot('05m-share-open');
      await p.waitForFunction(() => !document.querySelector('#stage.busy'), {}, { timeout: 20000 }); await p.locator('#episodes [data-air]').click();
      await p.locator('#episodes [data-publish="final"]').first().waitFor({ timeout: 20000 }); await p.locator('#episodes [data-publish="final"]').first().click();
      for (let t = 0; t < 25 && (await serverState()).events.find(e => e.number === 2).resultStatus !== 'final'; t++) await p.waitForTimeout(1000);
      await p.locator('[data-reveal="ann"]').click(); for (let t = 0; t < 30 && (await serverState()).people.find(x => x.id === 'ann').seen !== 2; t++) await p.waitForTimeout(1000);
      await p.locator('#game').selectOption('share'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(800); await shot('05n-share-settled');
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step('a draft out of a hat: the real game page reads the drawn teams; the route checks agree (nothing dealt again)', async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(drawFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('drawn'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 });
      await p.waitForTimeout(800); await shot('05o-drawn');
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step('stakes: the real sheet offers the bank as the server holds it; a stake saved there is the runtime\'s; the routes agree', async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(stakeFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'), q = app.locator('[data-question="boot"]'); await p.locator('#game').selectOption('stakes'); await q.waitFor({ timeout: 30000 });
      assert.match(await q.locator('[data-answer-stake]').innerText(), /Answer first|Up to 10/, 'the bank of 10 is the most');
      await p.locator('#device-a').scrollIntoViewIfNeeded(); await q.locator('[data-answer-face]').first().click();
      for (let i = 0; i < 3; i++) await q.getByRole('button', { name: 'Stake more' }).click();
      assert.match(await q.locator('[data-answer-stake]').innerText(), /Up to 10/);
      await q.locator('[data-answer-stake]').scrollIntoViewIfNeeded(); await shot('05p-stakes');
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      const before = (await serverState()).trace.length; await app.getByRole('button', { name: /^Save/ }).first().click();
      let st; for (let t = 0; t < 25; t++) { st = await serverState(); if (st.trace.length > before) break; await p.waitForTimeout(1000); }
      assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      const run = JSON.parse(await p.evaluate(() => fetch('/__atlas/bench/runtime/export?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.text()))).execution;
      const saved = run.trace.filter(t => t.action.type === 'answer' && t.action.question === 'boot').at(-1);
      assert.equal(saved?.status, 'accepted'); assert.equal(saved.action.answer.stake, 3, 'the stake of 3 reached the runtime: ' + JSON.stringify(saved?.action));
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step('settled by the couch: answered on the real sheet; server and runtime agree; its rider wording recorded', async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(playersFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'), q = app.locator('[data-question="most"]'); await p.locator('#game').selectOption('room'); await q.waitFor({ timeout: 30000 });
      const rider = await q.locator('[data-answer-riders]').innerText().catch(() => ''); fs.writeFileSync(path.join(out, 'players-settle-rider.txt'), rider);
      // Known gap (Designs needed item 9): it says the couch settles "what happened"; it's what most of you answered to "Who goes home?".
      if (/what most of you say happened/i.test(rider)) console.log('NOTE the couch-settled rider says "what happened" (Designs needed item 9)');
      await p.locator('#device-a').scrollIntoViewIfNeeded(); await q.locator('[data-answer-face]').first().click(); await shot('05q-players');
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      const before = (await serverState()).trace.length; await app.getByRole('button', { name: /^Save/ }).first().click();
      let st; for (let t = 0; t < 25; t++) { st = await serverState(); if (st.trace.length > before) break; await p.waitForTimeout(1000); }
      assert.equal(st.trace.at(-1)?.type, 'answer'); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step('a cut: viewing as the one cut, what the real page offers is recorded; the route checks agree', async () => {
      const local = R.open(JSON.parse(fs.readFileSync(cutFile, 'utf8'))), S = require(path.join(root, 'src/lib/game/state-logic'));
      const outs = [...S.KnockoutLogic.outs(local.snapshot().games.cut.state).keys()]; local.dispose();
      assert.ok(outs.length >= 1, 'someone is cut after episode 1');
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(cutFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      await p.locator('[data-viewer="' + outs[0] + '"]').click(); await p.waitForFunction(v => window.__GAMEPLAY_EXPLORER_PAGE__.ui.viewerId === v, outs[0]); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('cut'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const seen = await app.locator('[data-game-page]').evaluate(el => ({ text: el.innerText.replace(/\s+/g, ' ').slice(0, 1500), strip: [...el.querySelectorAll('[data-game-strip]')].map(x => x.innerText.replace(/\s+/g, ' ')) }));
      fs.writeFileSync(path.join(out, 'cut-page.json'), JSON.stringify({ out: outs[0], ...seen }, null, 2)); await shot('05r-cut');
      // Known gap (Designs needed item 10): the game view still lists the cut player's carried lineup as open.
      if (seen.strip.some(x => /lineup/i.test(x))) console.log('NOTE the cut player is offered a lineup (Designs needed item 10); see cut-page.json');
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step('a game from the merge: waits on the real page; once the merge is confirmed it plays from the next open episode; routes agree', async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(phaseFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'), text = () => app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 900));
      await p.locator('#game').selectOption('merge'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(800);
      const waiting = await text(); await shot('05s-merge-waiting');
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      await p.waitForFunction(() => !document.querySelector('#stage.busy'), {}, { timeout: 20000 }); await p.locator('#episodes [data-air]').click();
      await p.locator('#episodes [data-publish="final"]').first().waitFor({ timeout: 20000 }); await p.locator('#episodes [data-publish="final"]').first().click();
      for (let t = 0; t < 25 && (await serverState()).events.find(e => e.number === 3).resultStatus !== 'final'; t++) await p.waitForTimeout(1000);
      await p.locator('[data-reveal="ann"]').click(); for (let t = 0; t < 30 && (await serverState()).people.find(x => x.id === 'ann').seen !== 3; t++) await p.waitForTimeout(1000);
      await p.locator('#game').selectOption('merge'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(800);
      const started = await text(); await shot('05t-merge-started');
      fs.writeFileSync(path.join(out, 'merge-page.json'), JSON.stringify({ waiting, started }, null, 2));
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("bounties: the real page and routes show what each seat took or lost, from who voted for whom in the season's research", async () => {
      const local = R.open(JSON.parse(fs.readFileSync(bountyFile, 'utf8'))), want = local.project('bounty', 'ann').game.twists.bounty; local.dispose();
      assert.ok(Object.values(want).some(Boolean), 'the definition moves points');
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(bountyFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('bounty'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const seen = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 1500));
      fs.writeFileSync(path.join(out, 'bounty-page.json'), JSON.stringify({ want, seen }, null, 2)); await shot('05u-bounty');
      // The page's own words for it (game-page model: "Bounties" badge, "+N from bounties" on a row): a NOTE when they don't show.
      if (!/bount/i.test(seen)) console.log('NOTE the bounty game page never says bounties moved points (Designs needed item 12); see bounty-page.json');
      // The route checks compare each seat's bounty with the server's (api-checks bounty-disagree): the server read the research rows.
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("teams of players: the real page shows the drawn teams as the server kept them; the routes agree", async () => {
      const local = R.open(JSON.parse(fs.readFileSync(teamsFile, 'utf8'))), want = local.project('teams', 'ann').game.teams; local.dispose();
      assert.equal(want.set, true, 'kept: the game has started');
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(teamsFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('teams'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const seen = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2000));
      fs.writeFileSync(path.join(out, 'teams-page.json'), JSON.stringify({ want, seen }, null, 2)); await shot('05v-teams');
      if (!/team/i.test(seen.replace(/WEEKLY LINEUP|lineup/gi, ''))) console.log('NOTE the teams game page never says you play in teams (Designs needed item 13); see teams-page.json');
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step('parlays: episode 1 paid Ann both legs doubled; the real sheet and page are recorded; an answer saved there agrees; the routes agree', async () => {
      const local = R.open(JSON.parse(fs.readFileSync(parlayFile, 'utf8'))), want = local.project('parlay', 'ann'); local.dispose();
      assert.deepEqual(want.earned['boot|1'], { ann: 4, bo: 2 }, 'Ann right on both: the boot 2 x 2; Bo right on the boot alone: 2');
      assert.deepEqual(want.earned['happens|1'], { ann: 2 }, 'Ann right: 1 x 2; Bo wrong earns nothing (a seat with nothing is left out)');
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(parlayFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('parlay'); await app.locator('[data-question="boot"]').waitFor({ timeout: 30000 }); await p.waitForTimeout(800);
      const seen = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500));
      const riders = await app.locator('[data-question="boot"]').evaluate(el => el.innerText.replace(/\s+/g, ' '));
      fs.writeFileSync(path.join(out, 'parlay-page.json'), JSON.stringify({ table: want.game.table.map(r => [r.playerId, r.total]), seen, riders }, null, 2)); await shot('05w-parlay');
      // The summary says "Parlay pays double"; the questions themselves (their riders) should say they're legs of it.
      if (!/parlay|both right|every leg|all right/i.test(riders)) console.log("NOTE the parlay's questions never say they're tied together or what both right pays (Designs needed item 14); see parlay-page.json");
      await p.locator('#device-a').scrollIntoViewIfNeeded(); await app.locator('[data-question="boot"] [data-answer-face]').first().click();
      const before = (await page()).a.state.trace.length; await app.getByRole('button', { name: /^Save/ }).first().click();
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      let st; for (let t = 0; t < 25; t++) { st = await serverState(); if (st.trace.length > before) break; await p.waitForTimeout(1000); }
      assert.equal(st.trace.at(-1)?.type, 'answer', 'the answer reached the runtime'); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step('multipliers: episode 1 doubled on the real page; the finale aired and published there counts triple; a twin without times agrees; the routes agree', async () => {
      const local = R.open(JSON.parse(fs.readFileSync(timesFile, 'utf8'))), twin = R.open(timesDef(null));
      const doubled = gridOf(local, 'ann'), plain = gridOf(twin, 'ann'); local.dispose(); twin.dispose();
      for (const seat of ['ann', 'bo']) { assert.equal(doubled[seat][1], plain[seat][1] * 2, seat + "'s episode 1 doubled"); assert.equal(doubled[seat][2], plain[seat][2], seat + "'s episode 2 as it is"); }
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(timesFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('times'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const before = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500)); await shot('05x-multipliers');
      // The finale: Air it, final results (a winner), Ann's reveal.
      await p.waitForFunction(() => !document.querySelector('#stage.busy'), {}, { timeout: 20000 }); await p.locator('#episodes [data-air]').click();
      await p.locator('#episodes [data-publish="final"]').first().waitFor({ timeout: 20000 }); await p.locator('#episodes [data-publish="final"]').first().click();
      await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.events.at(-1).resultStatus === 'final', {}, { timeout: 20000 });
      await p.locator('[data-reveal="ann"]').click(); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.people.find(x => x.id === 'ann').seen === 3, {}, { timeout: 20000 });
      await p.locator('#game').selectOption('times'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const after = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500)); await shot('05y-multipliers-finale');
      // The run as the page played it, resumed here, against the same actions on the twin without times.
      // (The page's export wraps the runtime's bundle beside its source fingerprint, as the export step reads it.)
      const saved = await p.evaluate(() => fetch('/__atlas/bench/runtime/export?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      const { sourceFingerprint, ...exported } = saved.execution || saved;
      const ran = R.resume(exported), same = R.open(timesDef(null));
      try {
        for (const t of exported.trace) assert.equal(same.apply(t.action, 'replay').status, t.status, 'the twin takes ' + t.action.type + ' the same way');
        const x = gridOf(ran, 'ann'), y = gridOf(same, 'ann');
        for (const seat of ['ann', 'bo']) for (const n of [1, 2, 3]) assert.equal(x[seat][n], y[seat][n] * ({ 1: 2, 3: 3 }[n] ?? 1), `${seat} episode ${n}: ${x[seat][n]} against ${y[seat][n]}`);
        fs.writeFileSync(path.join(out, 'multipliers-page.json'), JSON.stringify({ grid: x, twin: y, before, after }, null, 2));
      } finally { ran.dispose(); same.dispose(); }
      // The summary names episode 1's window; the finale's should be named too.
      if (!/finale[^.]{0,30}(triple|[×x]\s?3)/i.test(before + ' ' + after)) console.log("NOTE the multipliers game page names episode 1's double but never the finale's triple (Designs needed item 15); see multipliers-page.json");
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("rollovers: episode 3's \"Who goes home?\" is worth 9 (two windows carried); the real sheet agrees and is recorded; an answer saved there agrees; the routes agree", async () => {
      const local = R.open(JSON.parse(fs.readFileSync(rollFile, 'utf8'))), want = local.project('roll', 'ann'); local.dispose();
      assert.deepEqual([want.worth['boot|1'], want.worth['boot|2'], want.worth['boot|3']], [3, 6, 9], 'nobody right, nobody answered, then the open window');
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(rollFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('roll'); await app.locator('[data-question="boot"]').waitFor({ timeout: 30000 }); await p.waitForTimeout(800);
      // The real question sheet, as Ann reads it: the open window's jackpot.
      const sheet = await app.locator('body').evaluate(async () => { const [, season, league] = location.pathname.match(/([0-9a-f-]{36}).*?([0-9a-f-]{36})/) || []; return fetch('/api/seasons/' + season + '/answers?league=' + league).then(r => r.json()); });
      const q = sheet.questions.find(x => x.id === 'boot');
      assert.equal(q.episode, 3); assert.equal(q.jackpot, 6, "the sheet's jackpot: 6 carried onto its 3");
      const seen = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500));
      const riders = await app.locator('[data-question="boot"]').evaluate(el => el.innerText.replace(/\s+/g, ' '));
      fs.writeFileSync(path.join(out, 'rollover-page.json'), JSON.stringify({ worth: want.worth, sheet: { jackpot: q.jackpot, points: q.points }, seen, riders }, null, 2)); await shot('05z-rollover');
      if (!/\b9\b|jackpot|carr|roll/i.test(riders)) console.log("NOTE the rolling question never says it's worth 9 now or that it rolls over (Designs needed item 16); see rollover-page.json");
      await p.locator('#device-a').scrollIntoViewIfNeeded(); await app.locator('[data-question="boot"] [data-answer-face]').first().click();
      const before = (await page()).a.state.trace.length; await app.getByRole('button', { name: /^Save/ }).first().click();
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      let st; for (let t = 0; t < 25; t++) { st = await serverState(); if (st.trace.length > before) break; await p.waitForTimeout(1000); }
      assert.equal(st.trace.at(-1)?.type, 'answer', 'the answer reached the runtime'); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("whole-game moment questions: answered before the start; first immunity settled in the history; the rest settled by the finale published on the page; the sheet and routes agree", async () => {
      const local = R.open(JSON.parse(fs.readFileSync(onceFile, 'utf8'))), want = local.project('whole', 'ann'); local.dispose();
      const state = id => want.decided.filter(d => d.question === id).map(d => d.verdict?.state);
      assert.deepEqual(state('firstImmunity'), ['known', 'known'], 'the first immunity is in the history'); assert.deepEqual(state('rewards'), ['waiting', 'waiting'], 'how many waits for the end');
      assert.ok(want.decided.some(d => d.playerId === 'ann' && d.question === 'firstImmunity' && d.points === 3), "Ann's first-immunity pick paid");
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(onceFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('whole'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const before = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500)); await shot('05za-whole-game');
      // The finale: Air it, final results (a winner; the season ends), Ann's reveal.
      await p.waitForFunction(() => !document.querySelector('#stage.busy'), {}, { timeout: 20000 }); await p.locator('#episodes [data-air]').click();
      await p.locator('#episodes [data-publish="final"]').first().waitFor({ timeout: 20000 }); await p.locator('#episodes [data-publish="final"]').first().click();
      await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.events.at(-1).resultStatus === 'final', {}, { timeout: 20000 });
      await p.locator('[data-reveal="ann"]').click(); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.people.find(x => x.id === 'ann').seen === 4, {}, { timeout: 20000 });
      await p.locator('#game').selectOption('whole'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const after = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500)); await shot('05zb-whole-game-settled');
      // The real question sheet, as Ann reads it now: every question settled (known, or void when it never happened).
      const sheet = await app.locator('body').evaluate(async () => { const [, season, league] = location.pathname.match(/([0-9a-f-]{36}).*?([0-9a-f-]{36})/) || []; return fetch('/api/seasons/' + season + '/answers?league=' + league).then(r => r.json()); });
      const settled = Object.fromEntries((sheet.questions || []).map(q => [q.id, [q.status, q.verdict?.state ?? null, (q.people || []).map(x => [x.playerId, x.earned ?? null])]]));
      for (const id of ['idols', 'firstImmunity', 'exile', 'rewards']) assert.notEqual(settled[id]?.[1] ?? 'waiting', 'waiting', id + ' settled after the finale: ' + JSON.stringify(settled[id]));
      fs.writeFileSync(path.join(out, 'whole-game-page.json'), JSON.stringify({ settled, before, after }, null, 2));
      // (How it plays names the questions as rules; above it is where how they settled would show.)
      if (!/Who finds an idol|How many reward wins/i.test(after.split(/HOW IT PLAYS/i)[0])) console.log("NOTE the finished game's page never shows how the whole-game questions settled: 9 points, every square 0 (Designs needed items 2 and 17); see whole-game-page.json");
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("Weekly Calls: Ann's right call on episode 1 counts; she calls episode 2 on the real Call it sheet; the runtime replays it; the routes agree", async () => {
      const local = R.open(JSON.parse(fs.readFileSync(callsFile, 'utf8'))), want = local.project('calls', 'ann'); local.dispose();
      assert.deepEqual(Object.fromEntries(want.game.table.map(r => [r.playerId, r.total])), { ann: 1, bo: 0 }, "Ann's boot call right, Bo's wrong");
      assert.equal(want.calls[2].status, 'open');
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(callsFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('calls'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const seen = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500)); await shot('05zc-weekly-calls');
      // The game's strip opens Call it for the next episode.
      await p.locator('#device-a').scrollIntoViewIfNeeded(); await app.locator('[data-game-strip] button, [data-game-strip] a').first().click();
      const sheet = app.locator('[data-call-sheet="2"][data-call-status="open"]'); await sheet.waitFor({ timeout: 20000 });
      const asked = await sheet.evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 1500)); await shot('05zd-call-it');
      await sheet.locator('[data-call-q="out"] [data-call-option]').first().click(); await sheet.locator('[data-call-q^="m:"] [data-call-option]').first().click();
      const before = (await page()).a.state.trace.length; await app.locator('[data-call-save]').click();
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      let st; for (let t = 0; t < 25; t++) { st = await serverState(); if (st.trace.length > before) break; await p.waitForTimeout(1000); }
      const calls = st.trace.slice(before);
      assert.ok(calls.length >= 2 && calls.every(t => t.type === 'call' && t.status === 'accepted'), 'both calls reached the runtime: ' + JSON.stringify(calls));
      assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      fs.writeFileSync(path.join(out, 'weekly-calls-page.json'), JSON.stringify({ table: want.game.table.map(r => [r.playerId, r.total]), seen, asked }, null, 2));
      // A Survivor season's calls are settled by its results; the couch settles only a talk show's.
      if (/two of you agreeing settles a call/i.test(seen)) console.log("NOTE How it plays tells a results-settled show's players the couch settles their calls (Designs needed item 18); see weekly-calls-page.json");
      await p.keyboard.press('Escape'); await p.waitForTimeout(500);
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step('confidence picks: Ann ranked the boot second (2); she ranks three for episode 2 on the real sheet; the runtime replays it; the routes agree', async () => {
      const local = R.open(JSON.parse(fs.readFileSync(sureFile, 'utf8'))), want = local.project('sure', 'ann'); local.dispose();
      assert.deepEqual(Object.fromEntries(want.game.table.map(r => [r.playerId, r.total])), { ann: 2, bo: 0 }, 'the boot ranked second: weight 2');
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(sureFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('sure'); await app.locator('[data-question="sure"]').waitFor({ timeout: 30000 }); await p.waitForTimeout(800);
      const seen = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500));
      await p.locator('#device-a').scrollIntoViewIfNeeded(); const faces = app.locator('[data-question="sure"] [data-answer-face]');
      for (const n of [0, 1, 2]) { await faces.nth(n).click(); await p.waitForTimeout(150); }
      const asked = await app.locator('[data-question="sure"]').evaluate(el => el.innerText.replace(/\s+/g, ' ')); await shot('05ze-confidence');
      const before = (await page()).a.state.trace.length; await app.getByRole('button', { name: /^Save/ }).first().click();
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      let st; for (let t = 0; t < 25; t++) { st = await serverState(); if (st.trace.length > before) break; await p.waitForTimeout(1000); }
      assert.equal(st.trace.at(-1)?.type, 'answer', 'the ranking reached the runtime'); assert.equal(st.trace.at(-1)?.status, 'accepted'); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      fs.writeFileSync(path.join(out, 'confidence-page.json'), JSON.stringify({ table: want.game.table.map(r => [r.playerId, r.total]), seen, asked }, null, 2));
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("the weekly card: the page is recorded (does it name this week's card?); Ann picks on the real moves sheet; the runtime replays it; the routes agree", async () => {
      const Spec = require(path.join(root, 'src/lib/game/game-spec')), F = require(path.join(root, 'src/lib/game/formats')).formatFor('survivor');
      const lines = Spec.cardLines(Spec.cardOf(Spec.fullSpec(cardSpec)), 2, null), labels = lines.map(id => F.events.find(e => e.id === id)?.label || id);
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(cardFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('card'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const seen = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 3000)); await shot('05zf-weekly-card');
      await p.locator('#device-a').scrollIntoViewIfNeeded(); await app.locator('[data-game-strip] button, [data-game-strip] a').first().click();
      await app.locator('[data-pick]').first().waitFor({ timeout: 20000 });
      const sheet = await app.locator('[role="dialog"]').first().evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 1500)).catch(() => ''); await shot('05zg-weekly-card-pick');
      await app.locator('[data-pick]').first().click();
      const before = (await page()).a.state.trace.length; await app.getByRole('button', { name: /^Save$/ }).first().click();
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      let st; for (let t = 0; t < 25; t++) { st = await serverState(); if (st.trace.length > before) break; await p.waitForTimeout(1000); }
      assert.equal(st.trace.at(-1)?.type, 'pick', 'the pick reached the runtime'); assert.equal(st.trace.at(-1)?.status, 'accepted'); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      fs.writeFileSync(path.join(out, 'weekly-card-page.json'), JSON.stringify({ lines, labels, seen, sheet }, null, 2));
      if (!labels.some(l => (seen + ' ' + sheet).toLowerCase().includes(l.toLowerCase()))) console.log("NOTE neither the game page nor the pick sheet names this week's card (Designs needed item 20); see weekly-card-page.json");
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("beat the bot: Ann's boot call matched the bot's (nothing) and her moment call beat it (1); the page is recorded; an answer saved there agrees; the routes agree", async () => {
      const local = R.open(JSON.parse(fs.readFileSync(beatFile, 'utf8'))), want = local.project('beat', 'ann'); local.dispose();
      assert.deepEqual(Object.fromEntries(want.decided.filter(d => d.playerId === 'ann').map(d => [d.question, d.points])), { boot: 0, happens: 1 });
      assert.equal(want.game.bot.called, 2);
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(beatFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('beat'); await app.locator('[data-question="boot"]').waitFor({ timeout: 30000 }); await p.waitForTimeout(800);
      const seen = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 3000)); await shot('05zh-beat-the-bot');
      const riders = await app.locator('[data-question="boot"]').evaluate(el => el.innerText.replace(/\s+/g, ' '));
      await p.locator('#device-a').scrollIntoViewIfNeeded(); await app.locator('[data-question="boot"] [data-answer-face]').first().click();
      const before = (await page()).a.state.trace.length; await app.getByRole('button', { name: /^Save/ }).first().click();
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      let st; for (let t = 0; t < 25; t++) { st = await serverState(); if (st.trace.length > before) break; await p.waitForTimeout(1000); }
      assert.equal(st.trace.at(-1)?.type, 'answer', 'the answer reached the runtime'); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      fs.writeFileSync(path.join(out, 'beat-the-bot-page.json'), JSON.stringify({ bot: want.game.bot, seen, riders }, null, 2));
      if (!/bot/i.test(seen)) console.log("NOTE the game page never mentions the bot (Designs needed item 21); see beat-the-bot-page.json");
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step('Outlast in reverse: the real page is recorded (does it say the earlier yours go home, the more you score?); the routes agree', async () => {
      const local = R.open(JSON.parse(fs.readFileSync(reverseFile, 'utf8'))), want = local.project('reverse', 'ann').game.table.map(r => [r.playerId, r.total, r.team.length]); local.dispose();
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(reverseFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('reverse'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const seen = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 3000)); await shot('05zi-outlast-reverse');
      fs.writeFileSync(path.join(out, 'outlast-reverse-page.json'), JSON.stringify({ table: want, seen }, null, 2));
      if (!/earlier|first to go|go home first|reverse/i.test(seen)) console.log("NOTE the reverse Outlast page never says the earlier yours go home, the more you score (Designs needed item 22); see outlast-reverse-page.json");
      if (/Fewest points wins/i.test(seen)) console.log('NOTE the reverse page says "Fewest points wins" while the most points rank first (BACKLOG 51); see outlast-reverse-page.json');
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("the top scorer's twist: the chooser's real page is recorded (is the choice offered anywhere?); the routes agree", async () => {
      const local = R.open(JSON.parse(fs.readFileSync(twistFile, 'utf8'))), views = Object.fromEntries(['ann', 'bo'].map(p => [p, local.project('twist', p).twist])); local.dispose();
      const chooser = ['ann', 'bo'].find(p => views[p].next?.youChoose);
      assert.ok(chooser, 'episode 1 has a top scorer who chooses episode 2: ' + JSON.stringify(views));
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(twistFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      await p.locator('[data-viewer="' + chooser + '"]').click(); await p.waitForFunction(v => window.__GAMEPLAY_EXPLORER_PAGE__.ui.viewerId === v, chooser); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('twist'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const seen = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 3000)); await shot('05zj-top-scorer-twist');
      fs.writeFileSync(path.join(out, 'top-scorer-twist-page.json'), JSON.stringify({ chooser, next: views[chooser].next, seen }, null, 2));
      if (!/double points|half points|choose/i.test(seen)) console.log("NOTE the chooser's page never offers the twist to choose, nor names it (Designs needed item 23); see top-scorer-twist-page.json");
      // The chooser picks double points on the real page and saves: the runtime replays it, and the server kept the same choice.
      await p.locator('#device-a').scrollIntoViewIfNeeded(); await app.locator('[data-twist-option="double"]').click(); await shot('05zk-twist-picked');
      const before = (await page()).a.state.trace.length; await app.locator('[data-twist-save]').click();
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      let st; for (let t = 0; t < 25; t++) { st = await serverState(); if (st.trace.length > before) break; await p.waitForTimeout(1000); }
      assert.equal(st.trace.at(-1)?.type, 'twist', 'the choice reached the runtime'); assert.equal(st.trace.at(-1)?.status, 'accepted', st.trace.at(-1)?.message); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      // Air episode 2 (past the close: the twist is filed and stamped), then the page as the chooser and as the other seat.
      await p.waitForFunction(() => !document.querySelector('#stage.busy'), {}, { timeout: 20000 }); await p.locator('#episodes [data-air]').click();
      await p.waitForTimeout(2500); await p.locator('#game').selectOption('twist'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const filed = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500)); await shot('05zl-twist-filed');
      const other = chooser === 'ann' ? 'bo' : 'ann';
      await p.locator('[data-viewer="' + other + '"]').click(); await p.waitForFunction(v => window.__GAMEPLAY_EXPLORER_PAGE__.ui.viewerId === v, other); await checked();
      await p.locator('#game').selectOption('twist'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const others = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500)); await shot('05zm-twist-other-seat');
      fs.writeFileSync(path.join(out, 'top-scorer-twist-page.json'), JSON.stringify({ chooser, next: views[chooser].next, seen, filed, others }, null, 2));
      if (!/double|×s?2 EP 2/i.test(others)) console.log("NOTE the other seat's page never says episode 2 plays double points (Designs needed item 23); see top-scorer-twist-page.json");
      if (!/chose|picked by|Ann/i.test(others.split(/THE SEASON/i)[0])) console.log("NOTE the twist shows as a chip (×2 EP 2) but nobody is told who chose it (Designs needed item 23, small); see top-scorer-twist-page.json");
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step('a captain: the real page and lineup sheet are recorded (can a captain be named?); a lineup saved there agrees; the routes agree', async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(captainFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('captain'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const seen = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 3000)); await shot('05zn-captain');
      await p.locator('#device-a').scrollIntoViewIfNeeded(); await app.locator('[data-game-strip] button, [data-game-strip] a').first().click();
      await app.locator('[data-starter]').first().waitFor({ timeout: 20000 });
      const sheet = await app.locator('[role="dialog"]').first().evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 1500)).catch(() => ''); await shot('05zo-captain-lineup');
      fs.writeFileSync(path.join(out, 'captain-page.json'), JSON.stringify({ seen, sheet }, null, 2));
      // Change the lineup (a starter off: one of two is a lineup), so there's something to save. (The bench one went home in episode 1.)
      await app.locator('[data-starter][aria-pressed="true"]').first().click();
      const before = (await page()).a.state.trace.length; await app.getByRole('button', { name: /^Save$/ }).first().click();
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      let st; for (let t = 0; t < 25; t++) { st = await serverState(); if (st.trace.length > before) break; await p.waitForTimeout(1000); }
      assert.equal(st.trace.at(-1)?.type, 'lineup', 'the lineup reached the runtime'); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      fs.writeFileSync(path.join(out, 'captain-page.json'), JSON.stringify({ seen, sheet }, null, 2));
      if (!/captain/i.test(sheet)) console.log("NOTE the lineup sheet offers no way to name a captain (Designs needed item 24); see captain-page.json");
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("secret roles: the holder's and another seat's real pages are recorded (is the holder told? does anything leak?); the routes agree", async () => {
      const local = R.open(JSON.parse(fs.readFileSync(rolesFile, 'utf8'))), deal = local.snapshot().stores.roles.roles; local.dispose();
      assert.ok(deal && deal.holders.length === 1, 'dealt once the game started: ' + JSON.stringify(deal));
      const holder = deal.holders[0], other = ['ann', 'bo', 'cy'].find(p => p !== holder);
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(rolesFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'), pageAs = async who => { await p.locator('[data-viewer="' + who + '"]').click(); await p.waitForFunction(v => window.__GAMEPLAY_EXPLORER_PAGE__.ui.viewerId === v, who); await checked();
        await p.locator('#game').selectOption('roles'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000); return app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500)); };
      const asHolder = await pageAs(holder); await shot('05zp-roles-holder');
      const asOther = await pageAs(other); await shot('05zq-roles-other');
      fs.writeFileSync(path.join(out, 'secret-roles-page.json'), JSON.stringify({ holder, other, asHolder, asOther }, null, 2));
      if (!/traitor/i.test(asHolder)) console.log("NOTE the holder's page never tells them they're the Traitor (Designs needed item 25); see secret-roles-page.json");
      const holderName = { ann: 'Ann', bo: 'Bo', cy: 'Cy' }[holder];
      assert.ok(!new RegExp(holderName + '[^.]{0,40}traitor|traitor[^.]{0,40}' + holderName, 'i').test(asOther), "another seat's page names the Traitor before the reveal");
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step('a draft spread across tribes: the real page is recorded (does the team show its tribes?); the routes agree', async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(acrossFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      await p.locator('[data-viewer="ann"]').click(); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.ui.viewerId === 'ann'); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('across'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const seen = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500)); await shot('05zr-spread-draft');
      fs.writeFileSync(path.join(out, 'spread-draft-page.json'), JSON.stringify({ seen }, null, 2));
      if (!/luvu|gata|yase|tribe/i.test(seen)) console.log("NOTE the spread draft's page never mentions tribes (Designs needed item 25); see spread-draft-page.json");
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("a survival pool's mulligans and buyback: the real pages are recorded (is the buyback and its cost told? mulligans left?); the routes agree", async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(poolFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      await p.locator('[data-viewer="ann"]').click(); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.ui.viewerId === 'ann'); await checked();
      const app = p.frameLocator('#device-a iframe'), pageOf = async g => { await p.locator('#game').selectOption(g); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000); return app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500)); };
      const bought = await pageOf('buyback'); await shot('05zs-pool-buyback');
      const forgiven = await pageOf('mulligan'); await shot('05zt-pool-mulligan');
      fs.writeFileSync(path.join(out, 'pool-riders-page.json'), JSON.stringify({ bought, forgiven }, null, 2));
      // BACKLOG 53 (fixed): the mulligans left were counted backwards (one left shown once it was used).
      assert.ok(!/1 mulligan left/i.test(forgiven), 'the used mulligan still shows as left');
      // (The "Buy back in" badge names the rule; it isn't the fact that Ann did.)
      if (!/bought back|-3\b|−3|3 points off/i.test(bought)) console.log("NOTE the pool's page never says Ann bought back in or what it cost (Designs needed item 26); see pool-riders-page.json");
      if (!/forgiven/i.test(forgiven.split(/HOW IT PLAYS/i)[0]) || !/mulligans? left/i.test(forgiven)) console.log("NOTE the pool's page shows a forgiven pick as plain wrong and never says how many mulligans are left (Designs needed item 26); see pool-riders-page.json");
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("a pool's second pick: the real page and pick sheet are recorded (can a second pick be made?); a pick saved there agrees; the routes agree", async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(secondFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      await p.locator('[data-viewer="ann"]').click(); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.ui.viewerId === 'ann'); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('second'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const seen = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500)); await shot('05zu-second-pick');
      await p.locator('#device-a').scrollIntoViewIfNeeded(); await app.locator('[data-game-strip] button, [data-game-strip] a').first().click();
      await app.locator('[data-pick]').first().waitFor({ timeout: 20000 });
      const sheet = await app.locator('[role="dialog"]').first().evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 1500)).catch(() => ''); await shot('05zv-second-pick-sheet');
      await app.locator('[data-pick]').first().click();
      const before = (await page()).a.state.trace.length; await app.getByRole('button', { name: /^Save$/ }).first().click();
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      let st; for (let t = 0; t < 25; t++) { st = await serverState(); if (st.trace.length > before) break; await p.waitForTimeout(1000); }
      assert.equal(st.trace.at(-1)?.type, 'pick', 'the pick reached the runtime'); assert.equal(st.trace.at(-1)?.status, 'accepted'); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      fs.writeFileSync(path.join(out, 'second-pick-page.json'), JSON.stringify({ seen, sheet }, null, 2));
      if (!/second/i.test(sheet)) console.log("NOTE the pick sheet offers no second pick (Designs needed item 27); see second-pick-page.json");
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("group slots: the real page and lineup sheet are recorded (can a pair be picked into the slot?); the routes agree", async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(groupsFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      await p.locator('[data-viewer="ann"]').click(); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.ui.viewerId === 'ann'); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('groups'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const seen = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500)); await shot('05zw-group-slots');
      await p.locator('#device-a').scrollIntoViewIfNeeded(); await app.locator('[data-game-strip] button, [data-game-strip] a').first().click();
      await app.locator('[data-starter]').first().waitFor({ timeout: 20000 });
      const sheet = await app.locator('[role="dialog"]').first().evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 1500)).catch(() => ''); await shot('05zx-group-slots-lineup');
      fs.writeFileSync(path.join(out, 'group-slots-page.json'), JSON.stringify({ seen, sheet }, null, 2));
      // (The sheet's "Open slot" is an empty lineup place, not the group slot.)
      if (!/pair|group|tribe slot|&/i.test(sheet)) console.log("NOTE the lineup sheet offers no way to fill the group slot (Designs needed item 28); see group-slots-page.json");
      await app.getByRole('button', { name: /close|done|cancel/i }).first().click().catch(() => p.keyboard.press('Escape'));
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("a pool that never repeats: Ann's skipped night is recorded on the real page (is it told apart from a miss?); the routes agree", async () => {
      const local = R.open(JSON.parse(fs.readFileSync(skipFile, 'utf8'))), night4 = local.project('skip', 'ann').game.table.find(r => r.playerId === 'ann').picks.find(x => x.episode === 4); local.dispose();
      assert.deepEqual(night4, { episode: 4, castawayId: null, correct: null }, 'the definition skips her night 4');
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(skipFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      await p.locator('[data-viewer="ann"]').click(); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.ui.viewerId === 'ann'); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('skip'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const seen = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500)); await shot('05zy-skip-pool');
      fs.writeFileSync(path.join(out, 'skip-pool-page.json'), JSON.stringify({ seen }, null, 2));
      if (!/skip/i.test(seen.split(/HOW IT PLAYS/i)[0])) console.log("NOTE the pool's page never says Ann's night 4 was skipped (Designs needed item 29); see skip-pool-page.json");
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("an auction: Ann's real page is recorded (does her team show what each castaway cost, and that two were filled?); the routes agree", async () => {
      const local = R.open(JSON.parse(fs.readFileSync(auctionFile, 'utf8'))), log = local.snapshot().games.auction.state.draftLog.filter(x => x.playerId === 'ann'); local.dispose();
      assert.ok(log.length === 3 && log.some(x => !x.filled), 'Ann won one and was filled: ' + JSON.stringify(log.map(x => [x.price, !!x.filled])));
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(auctionFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      await p.locator('[data-viewer="ann"]').click(); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.ui.viewerId === 'ann'); await checked();
      const app = p.frameLocator('#device-a iframe'); await p.locator('#game').selectOption('auction'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1000);
      const seen = await app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500)); await shot('05zz-auction');
      fs.writeFileSync(path.join(out, 'auction-page.json'), JSON.stringify({ log, seen }, null, 2));
      const won = log.find(x => !x.filled);
      // (Not the price as a bare number: the page's points share it.)
      if (!/\$\s?\d|paid|spent|price|filled/i.test(seen.split(/HOW IT PLAYS/i)[0])) console.log("NOTE the auction's page never shows what Ann paid (" + won.price + ') or that two were filled at the lowest price (Designs needed item 30); see auction-page.json');
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("mid-season waivers: Ann replaces her loss in free agency on the real waivers screen; the runtime replays it; the routes agree", async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(waiversFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      await p.locator('[data-viewer="ann"]').click(); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.ui.viewerId === 'ann'); await checked();
      await p.locator('#game').selectOption('waivers');
      const app = p.frameLocator('#device-a iframe'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 });
      // The waivers screen: the show's own page, /show/<season>/waivers.
      const frame = await (await p.locator('#device-a iframe').elementHandle()).contentFrame(); await frame.evaluate(() => { location.assign(location.pathname.replace(/(\/show\/[^/]+)\/.*$/, '$1/waivers') + location.search); });
      await app.locator('[data-wv-week]').first().waitFor({ timeout: 30000 }); await p.waitForTimeout(800);
      const seen = await app.locator('body').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 3000)).catch(() => ''); await shot('05zz2-waivers');
      // (Does the screen say a replacement scores half here, the game's own rule?)
      if (!/half|50%|½/i.test(seen)) console.log("NOTE the waivers screen never says a replacement scores half in this game (Designs needed item 31); see waivers-page.json");
      await app.locator('[data-wv-fa]').first().click();
      await app.locator('[data-fa-add]').first().waitFor({ timeout: 20000 }); await shot('05zz3-waivers-free-agency');
      const before = (await page()).a.state.trace.length;
      await app.locator('[data-fa-add]').first().click(); await app.locator('[data-fa-drop]').first().waitFor({ timeout: 20000 }); await app.locator('[data-fa-drop]').first().click();
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      let st; for (let i = 0; i < 25; i++) { st = await serverState(); if (st.trace.length > before) break; await p.waitForTimeout(1000); }
      assert.equal(st.trace.at(-1)?.type, 'freeAgency', 'the move reached the runtime'); assert.equal(st.trace.at(-1)?.status, 'accepted', JSON.stringify(st.trace.at(-1)));
      assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      fs.writeFileSync(path.join(out, 'waivers-page.json'), JSON.stringify({ seen }, null, 2));
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("the commissioner's waiver window: Ann opens one on a game with no waivers, picks for Bo, runs it now, takes the run back and turns the window off, on the real Backstage screen; the runtime replays each write; the routes agree", async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(handWindowFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      await p.locator('[data-viewer="ann"]').click(); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.ui.viewerId === 'ann'); await checked();
      await p.locator('#game').selectOption('byhand');
      const app = p.frameLocator('#device-a iframe'); await app.locator('[data-game-page]').waitFor({ timeout: 30000 });
      // (An hour on first: a generated case's clock sits exactly a day before the next episode, the moment a week's claims run, so a
      // window opened there runs in the same write in the runtime while the server, a moment later by its own clock, leaves it open.
      // The cliff itself is BACKLOG 58.)
      const moved = await p.evaluate(async () => { const s = window.__GAMEPLAY_EXPLORER_PAGE__.sides.a, r = await fetch('/__atlas/bench/runtime/apply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: s.id, action: { type: 'clock', at: new Date(Date.parse(s.state.clock) + 3600000).toISOString() } }) }); return (await r.json()).result?.status; });
      assert.equal(moved, 'accepted', 'the clock moved an hour on');
      const text = () => app.locator('body').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 3000)).catch(() => '');
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      // Backstage › Waivers: the show's own page, /show/<season>/backstage/waivers. The explorer page looks at the run every 2.5 s
      // and loads the game's page again whenever it has moved on, so each write is followed by going back there, once it has.
      const backstage = async plate => {
        const rev = (await serverState()).revision;
        await p.waitForFunction(r => window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.state.revision === r, rev, { timeout: 30000 }); await p.waitForTimeout(400);
        await app.locator('[data-game-page]').waitFor({ timeout: 30000 });
        const frame = await (await p.locator('#device-a iframe').elementHandle()).contentFrame(); await frame.evaluate(() => { location.assign(location.pathname.replace(/(\/show\/[^/]+)\/.*$/, '$1/backstage/waivers') + location.search); });
        await app.locator('[data-bs-plate="' + plate + '"]').waitFor({ timeout: 30000 }); await p.waitForTimeout(600);
      };
      // Each write on the screen reaches the runtime as its action, taken, with the server and the runtime agreeing after it.
      const did = async (type, tap) => {
        const before = (await serverState()).trace.length; await tap();
        let st; for (let i = 0; i < 30; i++) { st = await serverState(); if (st.trace.length > before) break; await p.waitForTimeout(1000); }
        assert.equal(st.trace.at(-1)?.type, type, 'the ' + type + ' reached the runtime: ' + JSON.stringify(st.live.comparisons.at(-1))); assert.equal(st.trace.at(-1)?.status, 'accepted', JSON.stringify(st.trace.at(-1)));
        assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      };
      const seen = {};
      await backstage('none'); seen.closed = await text(); await shot('05zz4-backstage-waivers-closed');
      // Open a window: replace who's out and one swap each.
      await app.locator('[data-bs-open]').click(); await app.locator('[data-bs-window] [data-preset="one"]').click(); await shot('05zz5-backstage-open-window');
      await did('waiverWindow', () => app.locator('[data-bs-open-go]').click());
      await backstage('open'); seen.open = await text(); await shot('05zz6-backstage-window-open');
      // Pick for Bo: one spot of his, sent for him (his week read first: a POST that writes nothing).
      await app.locator('[data-claim-for-open="Bo"]').click(); await app.locator('[data-claim-for] [data-claim-spot]').first().waitFor({ timeout: 20000 });
      await app.locator('[data-claim-for] [data-claim-spot]').first().click(); await app.locator('[data-claim-for] [data-claim-add]').first().click(); seen.pickFor = await text(); await shot('05zz7-backstage-pick-for');
      await did('claim', () => app.locator('[data-claim-send]').click());
      await backstage('open'); await app.locator('[data-claim="Bo"]', { hasText: 'Picks in' }).waitFor({ timeout: 20000 });
      // Run now: the preview first (another read by POST), then the run.
      await app.locator('[data-bs-run]').click(); await app.locator('[data-guard-confirm]:not([disabled])').waitFor({ timeout: 20000 }); seen.guard = await text(); await shot('05zz8-backstage-run-guard');
      await did('waiverRun', () => app.locator('[data-guard-confirm]').click());
      await backstage('processed'); seen.ran = await text(); await shot('05zz9-backstage-ran');
      // Undo, from Last run (the run's line in Recent changes): everyone back, the week open again and held.
      await did('waiverUndo', () => app.locator('[data-bs-undo-run]').click());
      await backstage('open'); seen.undone = await text(); await shot('05zza-backstage-undone');
      // Turn off: with no waivers of its own, the week is over on the spot.
      await did('waiverWindow', () => app.locator('[data-bs-off]').click());
      await backstage('none'); seen.off = await text(); await shot('05zzb-backstage-off');
      fs.writeFileSync(path.join(out, 'backstage-waivers-page.json'), JSON.stringify(seen, null, 2));
      // (What the screen says once a window is turned off: can another be opened for this episode? The engine says no.)
      if (/Open a waiver window/i.test(seen.off)) console.log('NOTE after a window is turned off the screen offers "Open a waiver window" again, which the server refuses for this episode (Designs needed item 32); see backstage-waivers-page.json');
      if (!/held|hold|won.t run|until you run/i.test(seen.undone)) console.log("NOTE after an undo nothing says the week is held until it's run by hand or the next episode airs (Designs needed item 32); see backstage-waivers-page.json");
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step("stages: the game's real page is the overall with each stage under it; the Merged stage waits, then is drafted as Episode 3's results come in; Ann sets its first lineup on the real sheet; what Bo, behind, is shown is recorded; the routes agree", async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(stagesFile);
      await p.locator('#device-a iframe').waitFor({ timeout: 40000 }); await checked();
      const app = p.frameLocator('#device-a iframe'), text = () => app.locator('[data-game-page]').evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 2500));
      const serverState = () => p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()));
      const show = async game => { await p.locator('#game').selectOption(game); await app.locator('[data-game-page]').waitFor({ timeout: 30000 }); await p.waitForTimeout(1200); };
      const seen = {};
      // The game itself: its table is the overall; its stages are games of their own under it.
      await show('stages'); seen.game = await text(); seen.stageLinks = await app.locator('[data-game-stages]').evaluate(el => el.innerText.replace(/\s+/g, ' ')).catch(() => null); await shot('05zzc-stages-game');
      await show('stages~before'); seen.first = await text(); await shot('05zzd-stage-first');
      // (Read twice: the page's move plate has been seen to change after its first paint.)
      await show('stages~after'); seen.waiting = await text(); await p.waitForTimeout(5000); seen.waitingLater = await text(); await shot('05zze-stage-waiting');
      // Episode 3 airs and its results come in: the merge is confirmed, the first stage ends, the Merged stage's draft is made.
      await p.waitForFunction(() => !document.querySelector('#stage.busy'), {}, { timeout: 20000 }); await p.locator('#episodes [data-air]').click();
      await p.locator('#episodes [data-publish="final"]').first().waitFor({ timeout: 20000 }); await p.locator('#episodes [data-publish="final"]').first().click();
      for (let t = 0; t < 25 && (await serverState()).events.find(e => e.number === 3).resultStatus !== 'final'; t++) await p.waitForTimeout(1000);
      // Bo, still on Episode 1, before anything is revealed to him: what the Merged stage's page shows (BACKLOG 61).
      await p.locator('[data-viewer="bo"]').click(); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.ui.viewerId === 'bo'); await checked();
      await show('stages~after'); seen.behind = await text(); await shot('05zzf-stage-behind');
      await show('stages'); seen.behindGame = await text();
      await p.locator('[data-viewer="ann"]').click(); await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__.ui.viewerId === 'ann'); await checked();
      await p.locator('[data-reveal="ann"]').click(); for (let t = 0; t < 30 && (await serverState()).people.find(x => x.id === 'ann').seen !== 3; t++) await p.waitForTimeout(1000);
      await show('stages~before'); seen.firstOver = await text();
      await show('stages~after'); seen.drafted = await text(); await shot('05zzg-stage-drafted');
      // Ann's first lineup in the Merged stage, on the real sheet (a new stage has nobody starting yet: two of her three are started).
      await p.locator('#device-a').scrollIntoViewIfNeeded(); await app.locator('[data-game-strip] button, [data-game-strip] a').first().click();
      await app.locator('[data-starter]').first().waitFor({ timeout: 20000 });
      seen.sheet = await app.locator('[role="dialog"]').first().evaluate(el => el.innerText.replace(/\s+/g, ' ').slice(0, 1500)).catch(() => ''); await shot('05zzh-stage-lineup');
      await app.locator('[data-starter]').nth(0).click(); await app.locator('[data-starter]').nth(1).click(); await shot('05zzh2-stage-lineup-chosen');
      const before = (await page()).a.state.trace.length; await app.getByRole('button', { name: /^Save$/ }).first().click();
      let st; for (let t = 0; t < 25; t++) { st = await serverState(); if (st.trace.length > before) break; await p.waitForTimeout(1000); }
      assert.equal(st.trace.at(-1)?.type, 'lineup', 'the lineup reached the runtime'); assert.ok((st.live.comparisons.at(-1)?.path || '').endsWith('/episodes/show-event-4/lineups/ann'), 'as an Episode 4 lineup, which only the Merged stage takes (the first stage ended with 3)'); assert.equal(st.trace.at(-1)?.status, 'accepted'); assert.equal(st.live.mismatches, 0, JSON.stringify(st.live.comparisons.at(-1)));
      await show('stages'); seen.gameAfter = await text(); await shot('05zzi-stages-game-after');
      fs.writeFileSync(path.join(out, 'stages-page.json'), JSON.stringify(seen, null, 2));
      assert.match(seen.waiting + seen.waitingLater, /starts when merged starts|draft · not started yet/i, 'the Merged stage says it waits (for the merge, or for its draft)');
      if (/draft · not started yet/i.test(seen.waiting + seen.waitingLater)) console.log("NOTE before the merge, the Merged stage's page shows a 'Draft · Not started yet · Pick in private, reveal together' plate" + " (its hero says 'Starts when Merged starts · Nothing to do yet' until the draft's own read arrives: your-move.ts shows any draft that isn't done)" + ": a draft the server refuses to start until the merge is known (Designs needed item 33); see stages-page.json");
      assert.match(seen.drafted, /set your episode 4 lineup/i, 'drafted, the Merged stage asks for its Episode 4 lineup');
      assert.match(seen.firstOver, /final/i, 'the first stage is over'); assert.match(seen.gameAfter, /DONE BEFORE THE MERGE NOW MERGED/i, 'the game names its stages, the first done and the Merged one on now');
      // Recorded gaps (Designs needed item 33): the game's page and its stages; what someone behind is shown.
      if (!/before the merge/i.test(seen.stageLinks || '') || !/merged/i.test(seen.stageLinks || '')) console.log("NOTE the game's page doesn't name its stages (Designs needed item 33); see stages-page.json");
      if (/EP 4|Episode 4/i.test(seen.behind)) console.log('NOTE Bo, who has seen only Episode 1, is shown the Merged stage as starting with Episode 4 (so the merge came in 3), a lineup to set for it behind "Reveal Episode 2 first": BACKLOG 61, Designs needed item 33; see stages-page.json');
      if (/ALL SET/i.test(seen.game) && /set your episode 3 lineup/i.test(seen.first)) console.log("NOTE the game's own page says 'All set · Nothing to do before Ep 3' while its first stage asks for an Episode 3 lineup (Designs needed item 33); see stages-page.json");
      if (/last week.s stands in|last lineup carries over/i.test(seen.drafted + seen.sheet)) console.log("NOTE a new stage's first lineup says last week's stands in, when it has no last week (Designs needed items 11 and 33)");
      await p.locator('#route-check').click(); await p.locator('#panel-checks .card', { hasText: 'No spoilers, standings match' }).waitFor({ timeout: 90000 });
    });
    await step('export replays headlessly to the same state', async () => {
      // The server's hash (the page's own copy can lag the run), and the export's own: the replay must reach both.
      const hash = (await p.evaluate(() => fetch('/__atlas/bench/runtime/state?id=' + window.__GAMEPLAY_EXPLORER_PAGE__.sides.a.id).then(r => r.json()))).hash;
      const [download] = await Promise.all([p.waitForEvent('download'), p.locator('#export').click()]), file = path.join(out, 'exported.json'); await download.saveAs(file);
      const saved = JSON.parse(fs.readFileSync(file, 'utf8')), r = R.execute(saved); assert.equal(r.status, 'executed', r.message);
      assert.equal(r.execution.stateHash, (saved.execution || saved).stateHash, 'the replay reaches the exported state'); assert.equal(r.execution.stateHash, hash, "the replay reaches the server's state");
    });
    await step('phone layout: preview first, nothing scrolls sideways', async () => {
      await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
      const [mainY, peopleY] = await Promise.all([p.locator('main').boundingBox(), p.locator('#people').boundingBox()]); assert(mainY.y < peopleY.y, 'preview should come before the situation');
      await shot('07-phone'); await p.setViewportSize({ width: 1440, height: 1000 });
    });
    await step("a definition that can't run shows why and closes the screens", async () => {
      await p.locator('#open').click(); await p.locator('#open-file').click(); await p.locator('#file').setInputFiles(blockedFile);
      await p.locator('#gap').waitFor({ state: 'visible', timeout: 20000 }); assert.equal(await p.locator('#device-a').count(), 0); await shot('08-blocked');
    });
  } finally {
    const report = { ok: steps.every(s => s.ok), steps, errors: b.errors };
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ok: report.ok, passed: steps.filter(s => s.ok).length, failed: steps.filter(s => !s.ok).map(s => s.name), errors: b.errors.slice(0, 6) }));
    if (!report.ok) process.exitCode = 1;
    await b.close();
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
