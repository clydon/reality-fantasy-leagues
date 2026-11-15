// The first redesign page's situations (docs/GAME-PAGE-SITUATIONS.md; the design round's packet, docs/DESIGN-ROUND-PACKET.md):
// the game page, piloted on head to head (a Survivor Weekly Lineup, draft 3 start 2, a two-seat playoff) and its sports twin (the
// NFL's own season game: head to head, a weekly lock), each situation the fresh-start brief asks a redesign to show (who is
// behind, moves due or set, a week in progress, results in, reveals, sports and shows).
//
// Each is a v2 definition and the runtime actions that bring it there (`steps`), played by the same runtime the explorer page and
// the CLI run: never a hand-shaped state. `build(id)` plays them once (so a step that stops being accepted fails here, loudly) and
// returns { kind: 'gameplay-situation', id, label, page, input, steps, viewerId, gameId, shows }; the explorer page's Open menu ›
// A first-page situation opens it on the game's own page (Full game) as its viewer. `shows` is what the redesign must show in it,
// in words; tests/gameplay-situations.test.js holds each situation to its own claims on the projection.
//
// Add a situation: a builder below (a definition, then steps from the session as it stands), a line in LIST, and its claims in
// the test. Results come from the bench's own publish (publish.cjs), so a situation's results are the Publish button's.
const D = require('./document.cjs'), R = require('./runtime.cjs'), { resultsData } = require('./publish.cjs'), Dress = require('./dress.cjs');
// The dress the situation being built wears (build's `dress`: 'real' for a real season's people, dress.cjs), else the generated.
let DRESS = null;
const dressed = doc => (DRESS ? Dress.apply(doc, DRESS).definition : doc);
const CONTEXT = require('../../../tests/fixtures/gameplay-explorer/questions-input.json').context; // the Survivor context
const sportsProof = require('../../../tests/fixtures/gameplay-explorer/sports-proof.cjs');
const CLOCK = '2099-01-10T12:00:00.000Z', HOUR = 3600000;
const H2H = { get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'matchups', playoffs: { teams: 2 } } };
// The pilot with an exclusive draft and waivers (2026-11-14): drafted in a snake, nobody's castaway on two teams (12 of 18 drafted,
// six free agents), and waivers every episode: a loss replaced, one swap a week, claims run 24 hours before the next airing, free
// agency after, anything nobody claimed filled when the week closes.
const WAIVERS = { feel: 'balanced', replace: 'always', short: null, windows: { schedule: 'everyEpisode', every: 3, swaps: 1 }, order: 'rolling', hours: 24, freeAgency: true, autoFill: true };
const H2H_X = { ...H2H, get: { by: 'draft', each: 3, own: 'exclusive', order: 'snake' }, extras: { waivers: WAIVERS } };
// Its sports twin's: nobody goes home in a sport, so no replacements; two swaps a week (a free agent for one of yours).
const NFL_WAIVERS = { ...WAIVERS, replace: 'never', windows: { schedule: 'everyEpisode', every: 3, swaps: 2 } };
// The staged pilot (2026-11-14): the same head to head in two stages split at the merge, each a game of its own with its own private
// draft (the second from who's still in), the overall by points; the playoff of two in the merged stage only (a stage that ends at
// the merge learns its end only from the merge's results: a playoff there is placed after its final was played as an ordinary
// week, BACKLOG 82). Made live: the engine lab, the one door for stages, makes one so.
const STAGED = { stages: [{ id: 'before', name: 'Before the merge', game: { ...H2H, rank: { by: 'matchups' }, span: { from: 1, to: { phase: 'merged' } } } }, { id: 'merged', name: 'Merged', game: { ...H2H, span: { from: { phase: 'merged' } } } }], overall: { by: 'points' } };

/** The show's definition: four people, head to head, `completed` episodes in (of `count`), each person's mark (default caught up);
 *  `phaseStarts` (the merge's episode) for a game in stages. */
function showDefinition(o = {}) {
  const completed = o.completed ?? 3, count = o.count ?? 7, people = (o.people || ['Ann', 'Bo', 'Cy', 'Di']).map((name, i) => ({ id: ['ann', 'bo', 'cy', 'di'][i], name: o.labels === 'long' ? name + ' de la Cruz Montgomery-Wellington' : name }));
  return dressed(D.create({
    seed: o.seed ?? 42,
    world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...CONTEXT, couch: people.length, pool: 18 }, ...(o.phaseStarts ? { phaseStarts: o.phaseStarts } : {}) }], people },
    games: [{ id: 'h2h', name: o.name || 'Weekly Lineup', contextId: 'show', spec: o.spec || H2H, timing: o.timing || 'own-pace' }],
    situation: { clock: CLOCK, viewerId: 'ann', marks: people.map(p => ({ personId: p.id, contextId: 'show', through: (o.marks || {})[p.id] ?? completed })) },
    content: { labels: o.labels === 'long' ? 'long' : 'normal', completedEvents: completed, eventCount: count },
  }));
}
/** The NFL's own season game (head to head, a weekly lock), three people (Ann, Bo, Cy) at marks of their own; `hides`: who hides
 *  sports scores. A game a week, Thursday night (Eastern), two played: the clock is Saturday, so the next game is next week's and
 *  its lineup is open (the default schedule's games a day apart would share one week, locked since its first). */
const NFL_WEEKS = Array.from({ length: 6 }, (_, i) => new Date(Date.parse(CLOCK) - 36 * HOUR + (i - 1) * 7 * 24 * HOUR).toISOString());
function nflDefinition(o = {}) {
  const doc = sportsProof({ league: 'football/nfl', game: 'season', timing: 'live-only', completed: 2, schedule: NFL_WEEKS, clock: CLOCK, ...o });
  return dressed(D.create({ ...doc, situation: { ...doc.situation, viewerId: 'ann' } }));
}
/** The NBA on a slate (three games a week), a lineup of two from four locking at each game's start, live, everyone caught up. */
function nbaWeekDefinition() {
  const nba = require('../sports.cjs').resolve('basketball/nba', 'short').row.spec;
  const spec = { ...nba, get: { by: 'draft', each: 4, order: 'snake', own: 'exclusive' }, count: { start: 2 }, closes: 'game' };
  const doc = sportsProof({ league: 'basketball/nba', game: spec, slate: 3, completed: 1, events: 3, timing: 'live-only', ann: 1, bo: 1, cy: 1 });
  return dressed(D.create({ ...doc, situation: { ...doc.situation, viewerId: 'ann' } }));
}
/** Play `steps(s)` (a function of the open session returning the next action, or null to stop) and keep each accepted action. */
function play(input, next) {
  const s = R.open(input), steps = [];
  try {
    for (let i = 0; i < 80; i++) {
      const a = next(s, steps.length);
      if (!a) break;
      const r = s.apply(a);
      if (r.status !== 'accepted') throw Error('A situation step was refused: ' + JSON.stringify(a).slice(0, 160) + ' (' + r.message + ')');
      steps.push(a);
    }
    return steps;
  } finally { s.dispose(); }
}
// The actions a situation is built from.
const clockTo = ms => ({ type: 'clock', at: new Date(ms).toISOString() });
const lineupOf = (s, gameId, personId, k = 0) => { const l = s.project(gameId, personId).game.lineup; return l && { type: 'lineup', gameId, personId, eventId: l.epId, ids: l.roster.slice(k, k + l.need) }; };
const publish = (s, contextId, n, status = 'final') => { const snap = s.snapshot(), e = snap.contexts[contextId].events.find(x => x.number === n); return { type: 'results', contextId, eventId: e.id, source: 'provider-fixture', resultStatus: status, data: resultsData(snap, s.export().input, contextId, e.id, status) }; };
const airOf = (s, contextId, n) => Date.parse(s.snapshot().contexts[contextId].events.find(x => x.number === n).airAt);
const reveal = (contextId, personId) => ({ type: 'reveal', contextId, personId });
/** A queue of actions, some worked out from the session when their turn comes (a function of it; one that works out to nothing,
 *  null, is skipped: a stage with no lineup open, say). */
const queue = list => { let k = 0; return s => { while (k < list.length) { const x = list[k++], a = typeof x === 'function' ? x(s) : x; if (a) return a; } return null; }; };
/** Every seat's lineup set for the open episode (a different pair each), then `more`. */
const everyoneSets = (gameId, people, more = []) => [...people.map((p, k) => s => lineupOf(s, gameId, p, k % 2)), ...more];
/** Episode n aired an hour ago, its results published (final or early) and revealed by `who`. */
const played = (contextId, n, who = [], status = 'final') => [s => clockTo(Math.max(Date.parse(s.snapshot().clock), airOf(s, contextId, n) + HOUR)), s => publish(s, contextId, n, status), ...who.map(p => reveal(contextId, p))];
const ALL = ['ann', 'bo', 'cy', 'di'];
/** A sports lineup as a person would set it: the league's default slots filled by position from their roster (a quarterback, two
 *  backs, two receivers...), skipping `skip` of each position's best first, the rest from whoever is left. */
function slotLineup(s, gameId, personId, skip = 0) {
  const l = s.project(gameId, personId).game.lineup;
  if (!l) return null;
  const Sports = require('./runtime-sports.cjs'), w = Object.values(s.snapshot().contexts).find(x => x.context.kind === 'sport'), c = Sports.league(w.context);
  const role = id => w.participants.find(p => p.id === id)?.role, group = id => c.sport.position(role(id))?.group;
  const left = [...l.roster.slice(skip), ...l.roster.slice(0, skip)], ids = [];
  for (const slot of c.defaults.slots.lineup) for (let n = 0; n < slot.n; n++) { const i = left.findIndex(id => slot.takes.includes(role(id)) || slot.takes.includes(group(id))); if (i >= 0) ids.push(left.splice(i, 1)[0]); }
  return { type: 'lineup', gameId, personId, eventId: l.epId, ids: [...ids, ...left].slice(0, l.need) };
}
/** Who's on nobody's team in a game now, still in (the free agents), in the cast's order. */
const freeIn = (s, gameId) => s.snapshot().games[gameId].state.castaways.filter(c => !c.ownerIds.length && c.status === 'active').map(c => c.id);
const teamOf = (s, gameId, personId) => s.snapshot().games[gameId].state.castaways.filter(c => c.ownerIds.includes(personId));
/** One spot of a waiver claim, as the app sends it: drop `dropId` (a loss, or someone still in for a swap), add the first of `addIds` you get. */
const claimSpot = (gameId, personId, dropId, addIds) => ({ type: 'claim', gameId, personId, spot: { dropId, addIds } });
/** The open waiver week's process time (the week after the latest results), as the engine set it. */
const processAt = (s, gameId) => Date.parse((s.snapshot().games[gameId].state.midSeason?.waivers?.periods || []).find(p => p.phase === 'open').processAt);
/** The show pilot with an exclusive draft and waivers, Episode 4 in and everyone caught up: a waiver week open, and Bo's swap in
 *  (his last castaway for the first free agent). */
const waiversOpen = () => [...everyoneSets('h2h', ALL, played('show', 4, ALL)),
  s => { const mine = teamOf(s, 'h2h', 'bo').filter(c => c.status === 'active'); return claimSpot('h2h', 'bo', mine[mine.length - 1].id, freeIn(s, 'h2h').slice(0, 1)); }];
/** And Ann's claim: her loss replaced by the first two free agents, ranked (the first is the one Bo wants too). The week waits for
 *  its time, live or at its own pace: at its own pace it runs early only once nobody could still use a swap (BACKLOG 83, decided
 *  2026-11-14: WaiverLogic.runsEarly), and Cy and Di could. */
const claimsIn = () => [...waiversOpen(),
  s => { const lost = teamOf(s, 'h2h', 'ann').find(c => c.status !== 'active'); return claimSpot('h2h', 'ann', lost.id, freeIn(s, 'h2h').slice(0, 2)); }];
/** Side bets (the design round's step 2: posting, calling, settling). Bo posts one on Episode 4 before it airs and three call it;
 *  Episode 4 is played and everyone's watched, its calls waiting for whoever runs the game (Ann, the first seat) to settle them;
 *  then Di posts one on Episode 5 that Bo and Di have called and Ann hasn't. The engine's ids are random, so each is the action's
 *  own (the runtime keeps an action's id). */
const epIdOf = (s, n) => s.snapshot().games.h2h.state.episodes.find(e => e.number === n).id;
const sideBets = () => [
  ...everyoneSets('h2h', ALL),
  { type: 'bet', id: 'bet-idol', gameId: 'h2h', personId: 'bo', eventId: 'upcoming', label: 'Will an idol be played?', points: 2 },
  ...[['ann', 'Yes'], ['bo', 'No'], ['cy', 'Yes']].map(([p, guess]) => s => ({ type: 'guess', id: 'pred-idol-' + p, gameId: 'h2h', personId: p, eventId: epIdOf(s, 4), betId: 'bet-idol', guess })),
  ...played('show', 4, ALL),
  { type: 'bet', id: 'bet-home', gameId: 'h2h', personId: 'di', eventId: 'upcoming', label: 'Who goes home?', points: 3 },
  ...[['bo', 'Quinn'], ['di', 'Rowan']].map(([p, guess]) => s => ({ type: 'guess', id: 'pred-home-' + p, gameId: 'h2h', personId: p, eventId: epIdOf(s, 5), betId: 'bet-home', guess })),
];
/** The staged pilot: four people, the merge at Episode 4, three in; made live, everyone caught up. */
const stagedDefinition = () => showDefinition({ spec: STAGED, timing: 'live-only', phaseStarts: { merged: 4 }, count: 8 });
/** Every seat's lineup in every stage open for episode n (a different pair each). */
const stagesSet = n => ALL.flatMap((p, k) => ['h2h~before', 'h2h~merged'].map(id => s => { const l = s.project(id, p).game.lineup; return l && !l.locked && l.episode === n ? lineupOf(s, id, p, k % 2) : null; }));

const LIST = [
  // ---- the show: head to head on a Weekly Lineup ----
  { id: 'show-due', page: 'show', label: 'Your lineup is due · everyone caught up', shows: "This week's opponent (who you play, their record), your record and last result, the lineup to set and by when.",
    build: () => { const input = showDefinition(); return { input, steps: play(input, queue(everyoneSets('h2h', ['bo', 'cy', 'di']))) }; } },
  { id: 'show-set', page: 'show', label: 'Your lineup is set · waiting for the episode', shows: 'All set for the next episode: your starters against your opponent\'s (theirs hidden until it locks), nothing to do.',
    build: () => { const input = showDefinition(); return { input, steps: play(input, queue(everyoneSets('h2h', ALL))) }; } },
  { id: 'show-locked', page: 'show', label: 'Locked · the episode aired, no results yet (live only)', shows: "The episode has started: lineups locked, both lineups shown, results to come. A live-only game, so nothing stays open.",
    build: () => { const input = showDefinition({ timing: 'live-only' }); return { input, steps: play(input, queue(everyoneSets('h2h', ALL, [s => clockTo(airOf(s, 'show', 4) + HOUR)]))) }; } },
  { id: 'show-early', page: 'show', label: 'Early results in · a week in progress', shows: 'Early results: what they say so far, marked provisional, and what the final results could still change.',
    build: () => { const input = showDefinition(); return { input, steps: play(input, queue(everyoneSets('h2h', ALL, played('show', 4, [], 'partial')))) }; } },
  { id: 'show-results', page: 'show', label: 'Results in · you\'ve watched (a win or a loss)', shows: "Last week's matchup decided (who won, by what, which starters scored), the record and standings moved, next week's opponent.",
    build: () => { const input = showDefinition(); return { input, steps: play(input, queue(everyoneSets('h2h', ALL, played('show', 4, ALL)))) }; } },
  { id: 'show-behind', page: 'show', label: 'You\'re two episodes behind · the others have watched', shows: "Nothing past your mark (no result, record or standings move of episodes 4 and 5); what's waiting for you and the way to reveal; your moves for the episode you're on.",
    build: () => { const input = showDefinition(); return { input, steps: play(input, queue(everyoneSets('h2h', ALL, [...played('show', 4, ['bo', 'cy', 'di']), ...everyoneSets('h2h', ['bo', 'cy', 'di']), ...played('show', 5, ['bo', 'cy', 'di'])]))) }; } },
  { id: 'show-friend-behind', page: 'show', label: 'Your opponent is behind · you\'re caught up', shows: "Your result against someone who hasn't watched: what you may see of their side, and that they haven't seen it yet.",
    build: () => {
      const input = showDefinition(), s = R.open(input), them = s.project('h2h', 'ann').game.matchups.next.opponent; s.dispose();
      return { input, steps: play(input, queue(everyoneSets('h2h', ALL, played('show', 4, ALL.filter(p => p !== them))))) };
    } },
  { id: 'show-quiet', page: 'show', label: 'A quiet night · nobody scored', shows: 'A week that counts for nobody, said as such (not dashes): why, and that the record is unchanged.',
    build: () => { const input = showDefinition(); return { input, steps: play(input, queue(everyoneSets('h2h', ALL, [s => clockTo(airOf(s, 'show', 4) + HOUR), s => ({ type: 'results', contextId: 'show', eventId: s.snapshot().contexts.show.events[3].id, source: 'provider-fixture', resultStatus: 'final', data: { events: [], scoringEvents: [], noExit: true } }), ...ALL.map(p => reveal('show', p))]))) }; } },
  { id: 'show-playoffs', page: 'show', label: 'The playoffs · the final is next', shows: 'The bracket: who made it (seeds), the final to come and who is in it, and those out of the playoffs said as such (not OUT).',
    build: () => { const input = showDefinition(); return { input, steps: play(input, queue([4, 5, 6].flatMap(n => everyoneSets('h2h', ALL, played('show', n, ALL))))) }; } },
  { id: 'show-champion', page: 'show', label: 'The season is over · a champion', shows: 'The champion named, the final, final standings with why a champion outranks a better record, the season in review.',
    build: () => { const input = showDefinition(); return { input, steps: play(input, queue([4, 5, 6, 7].flatMap(n => everyoneSets('h2h', ALL, played('show', n, ALL))))) }; } },
  { id: 'show-long-names', page: 'show', label: 'Long names · results in', shows: 'Long names in the opponent line, the table and the grid: nothing cut that matters, nothing scrolling sideways.',
    build: () => { const input = showDefinition({ labels: 'long' }); return { input, steps: play(input, queue(everyoneSets('h2h', ALL, played('show', 4, ALL)))) }; } },
  { id: 'show-side-bets', page: 'show', label: 'Side bets · one to settle, one open to call', shows: "Side bets on the game's page: last episode's bet with everyone's calls, waiting for whoever runs the game to settle it; this week's bet open to call (two in, yours not), and posting a new one.",
    build: () => { const input = showDefinition({ spec: { ...H2H, extras: { bets: { points: 2 } } } }); return { input, steps: play(input, queue(sideBets())) }; } },
  { id: 'show-solo', page: 'show', label: 'Solo · one person, a points lineup', shows: "Playing alone: personal progress and the season's points, no \"1st of 1\" and no opponent.",
    build: () => { const input = showDefinition({ people: ['Ann'], spec: { ...H2H, rank: { by: 'total' } }, name: 'Weekly Lineup (solo)' }); return { input, steps: play(input, queue(everyoneSets('h2h', ['ann']))) }; } },
  // ---- the pilot with an exclusive draft and waivers (2026-11-14) ----
  { id: 'xw-waivers-open', page: 'show', label: 'Exclusive draft and waivers · a loss to replace, the week open', shows: "A waiver week open after the episode: who you lost and that you're owed a replacement, your one swap, the free agents, that someone else has a claim in (not what it is), when claims run and that anything unclaimed is filled when the week closes; this week's opponent beside it.",
    build: () => { const input = showDefinition({ spec: H2H_X }); return { input, steps: play(input, queue(waiversOpen())) }; } },
  { id: 'xw-claims-in', page: 'show', label: 'Exclusive draft and waivers (live) · claims in, waiting for them to run', shows: "Your claim in (ranked: the first you get), that someone else has one in too, when the week runs (the night before the episode) and what happens after.",
    build: () => { const input = showDefinition({ spec: H2H_X, timing: 'live-only' }); return { input, steps: play(input, queue(claimsIn())) }; } },
  { id: 'xw-waivers-run', page: 'show', label: 'Exclusive draft and waivers · the week ran at its time (own pace)', shows: "What the week gave you (the claim you won or lost, and to whom), your team now, free agency open until the next episode, and the lineup due with this week's opponent. At its own pace a week with swaps waits for its time (nobody loses a swap to someone else's timing), so say when it ran.",
    build: () => { const input = showDefinition({ spec: H2H_X }); return { input, steps: play(input, queue([...claimsIn(), s => ({ type: 'clock', at: new Date(processAt(s, 'h2h') + 60000).toISOString() })])) }; } },
  // ---- the sports twin: the NFL's own season game ----
  { id: 'nfl-due', page: 'sport', label: 'NFL · your lineup is due', shows: "This week's opponent, the lineup by position with each player's game and kickoff, the lock (the week's first game), your record.",
    build: () => { const input = nflDefinition({ ann: 2, bo: 2, cy: 2 }); return { input, steps: [] }; } },
  { id: 'nfl-results-told', page: 'sport', label: 'NFL · results in, Ann a game behind but told (sports are live)', shows: 'A live sports game: Ann sees results though she has not marked the game watched (the default); each starter\'s line and what it paid.',
    build: () => { const input = nflDefinition({ ann: 1, bo: 2, cy: 2 }); return { input, steps: [] }; } },
  { id: 'nfl-hides-behind', page: 'sport', label: 'NFL · Ann hides sports scores, a game behind', shows: "Nothing past her mark, and that the others can already see the game she hasn't watched.",
    build: () => { const input = nflDefinition({ ann: 1, bo: 2, cy: 2, hides: ['ann'] }); return { input, steps: [] }; } },
  { id: 'nfl-cancelled', page: 'sport', label: 'NFL · last week\'s game cancelled', shows: 'A cancelled game named as such: a week that counts for nobody, the next lineup open.',
    build: () => { const input = nflDefinition({ ann: 2, bo: 2, cy: 2 }); return { input, steps: play(input, queue([s => ({ type: 'calledOff', contextId: 'sport', eventId: s.snapshot().contexts.sport.events[2].id, called: 'cancelled' })])) }; } },
  { id: 'nfl-real-pool-due', page: 'sport', label: 'NFL · a real-size pool (344 players), your lineup due', shows: "The lineup by position from a fifteen-man roster drawn from a league's own pool (quarterbacks, backs, receivers, ends, kickers, defenses): who starts where, the bench, each player's line, the lock; the opponent's lineup set.",
    build: () => { const input = nflDefinition({ ann: 2, bo: 2, cy: 2, pool: 'real' }); return { input, steps: play(input, queue([s => slotLineup(s, 'g', 'bo'), s => slotLineup(s, 'g', 'cy', 1)])) }; } },
  { id: 'nfl-waivers-open', page: 'sport', label: 'NFL · waivers open on a real-size pool, two swaps a week', shows: "Waivers after the week's game: some 300 free agents to find a player in (search, position, recent lines), two swaps, when claims run; Bo has a claim in; the lineup due beside it.",
    build: () => {
      const input = nflDefinition({ ann: 2, bo: 2, cy: 2, pool: 'real', game: { ...require('../sports.cjs').resolve('football/nfl', 'season').row.spec, extras: { waivers: NFL_WAIVERS } } });
      return { input, steps: play(input, queue([s => { const mine = teamOf(s, 'g', 'bo'), free = freeIn(s, 'g'); return claimSpot('g', 'bo', mine[mine.length - 1].id, free.slice(0, 2)); }])) };
    } },
  { id: 'nba-week-in-progress', page: 'sport', label: 'NBA · a week of three games in progress, locking game by game', shows: "The week laid out: each of your players' game (done, on, to come), who's locked now, what's final so far marked provisional (it counts when the week's last game is in).",
    build: () => {
      const input = nbaWeekDefinition();
      return { input, steps: play(input, queue([s => { const w = s.snapshot().contexts.sport, g = require('./runtime-sports.cjs').gamesOf(w.context, w.events[1]); return clockTo(Date.parse(g[1].airAt) + HOUR); },
        s => { const snap = s.snapshot(), w = snap.contexts.sport, week = w.events[1], g = require('./runtime-sports.cjs').gamesOf(w.context, week), d = resultsData(snap, s.export().input, 'sport', week.id, 'final'); return { type: 'results', contextId: 'sport', eventId: week.id, source: 'provider-fixture', resultStatus: 'partial', data: { ...d, games: { [g[0].id]: d.games[g[0].id] } } }; }])) };
    } },
  // ---- the staged pilot: the same head to head, before the merge and after (2026-11-14) ----
  { id: 'staged-before-merge', page: 'show', label: 'In stages · before the merge, your lineup due', shows: "A game in two stages: this stage's opponent and record, the lineup due, that the merged stage (a new draft and a fresh record) comes when the merge does, and what the overall counts.",
    build: () => { const input = stagedDefinition(); return { input, steps: play(input, queue(stagesSet(4).slice(2))) }; } },
  { id: 'staged-merged', page: 'show', label: 'In stages · the merge: the first stage final, a new draft, your first matchup due', shows: "The first stage over (its final record and table), the merged stage drafted from who's still in, its first opponent and a record back at 0-0, the playoff ahead, and the overall so far.",
    build: () => { const input = stagedDefinition(); return { input, steps: play(input, queue([...stagesSet(4), ...played('show', 4, ALL), ...stagesSet(5).slice(2)])) }; } },
  { id: 'staged-champion', page: 'show', label: "In stages · the season over: the merged stage's champion and the overall", shows: "The merged stage's champion (its playoff final), the first stage's table, the overall (what it adds up, and that it can disagree with who won the stages), the season in review.",
    build: () => { const input = stagedDefinition(); return { input, steps: play(input, queue([4, 5, 6, 7, 8].flatMap(n => [...stagesSet(n), ...played('show', n, ALL)]))) }; } },
];

// ---- A real game (the user, 2026-11-15: "We could do the Patriots Lions game going on now") ----
// One real NFL game as a head to head of two: Ann and Bo draft fifteen each from both teams' real rosters (best first, by what
// they did in the recorded season), start nine by position, and the game is scored by its real box score as the app reads it
// (scripts/dev-test/espn-final.js: src/lib/sports/final.ts storedGame, what finals.ts keeps). Its people, headshots, kickoff and
// numbers are real; only the two players and their draft are the bench's. Needs the ignored recordings (espn-snapshot.js for the
// rosters and the schedule, espn-final.js for the final), so these sit outside LIST (the situations test holds LIST to its claims
// on any checkout): `real()` lists them only where their recordings are. Which game: REAL_GAME's teams and week (its final once
// it's in), else, for the scored one, the newest recorded final.
const REAL_GAME = { league: 'football/nfl', teams: ['NE', 'DET'], week: 10 };
const ESPN_DIR = require('path').resolve(__dirname, '../../../.ui-atlas/fixtures/espn');
function realGame({ final: needFinal } = {}) {
  const fs = require('fs'), path = require('path'), Roster = require('./sports-roster.cjs');
  let snap;
  try { snap = Roster.load(REAL_GAME.league); } catch { return null; }
  const abbr = Object.fromEntries(snap.teams.map(t => [t.id, t.abbreviation])), short = Object.fromEntries(snap.teams.map(t => [t.id, t.short || t.name]));
  const finals = fs.existsSync(ESPN_DIR) ? fs.readdirSync(ESPN_DIR).filter(f => f.startsWith('final-')).map(f => JSON.parse(fs.readFileSync(path.join(ESPN_DIR, f), 'utf8'))).filter(f => f.league === REAL_GAME.league) : [];
  const wanted = snap.events.find(e => e.week === REAL_GAME.week && REAL_GAME.teams.every(t => [abbr[e.home], abbr[e.away]].includes(t)));
  const finalOf = e => finals.find(f => f.event === e?.id && f.final) || null;
  let event = wanted, fin = finalOf(wanted);
  if (needFinal && !fin) {
    fin = finals.filter(f => f.final).sort((x, y) => String(y.recordedAt).localeCompare(String(x.recordedAt)))[0] || null;
    event = fin && snap.events.find(e => e.id === fin.event);
  }
  if (!event || (needFinal && !fin)) return null;
  const teams = [event.away, event.home];
  // Everyone the recording has at a fantasy position (its whole pool: each role's share is all of them), on the game's two teams.
  const all = { DEF: snap.teams.length };
  for (const t of snap.teams) for (const p of t.roster) { const r = Roster.ROLE[p.abbr]; if (r && p.status !== 'practice-squad') all[r] = (all[r] || 0) + 1; }
  const everyone = Roster.pool(snap, { shares: all }).athletes.filter(a => teams.includes(a.team));
  everyone.sort((x, y) => y.value - x.value);
  // The bench deals an exclusive draft in the cast's order (Ann the first fifteen, Bo the next), so the cast is put in the order a
  // snake draft of two would take them: each pick the best left, while a starting slot is open a player for one of them.
  const Sports = require('./runtime-sports.cjs'), slots = Sports.league(Sports.contextFor(REAL_GAME.league, { couch: 2, pool: 40 })).defaults.slots.lineup;
  const left = [...everyone], teamsOf = [[], []];
  const open = t => slots.flatMap(sl => Array(sl.n).fill(sl.takes)).filter((takes, i, all) => teamsOf[t].filter(a => takes.includes(a.role)).length < all.slice(0, i + 1).filter(x => x === takes).length);
  for (let k = 0; k < 30 && left.length; k++) {
    const t = Math.floor(k / 2) % 2 === 0 ? k % 2 : 1 - (k % 2), need = open(t);
    const i = need.length ? left.findIndex(a => need.some(takes => takes.includes(a.role))) : 0;
    teamsOf[t].push(left.splice(i < 0 ? 0 : i, 1)[0]);
  }
  everyone.splice(0, everyone.length, ...teamsOf[0], ...teamsOf[1], ...left);
  const idOf = a => 'rg-' + String(a.id).replace(/[^A-Za-z0-9]/g, '-');
  const participants = everyone.map(a => ({ id: idOf(a), contextId: 'sport', name: a.name, photoUrl: a.headshot || null, role: a.role, team: abbr[a.team] }));
  const name = short[event.away] + ' vs ' + short[event.home];
  return { event, fin, participants, name, byEspn: Object.fromEntries(everyone.map(a => [String(a.id), idOf(a)])) };
}
function realGameDefinition(g) {
  const Sports = require('./runtime-sports.cjs'), season = require('../sports.cjs').resolve(REAL_GAME.league, 'season').row.spec;
  const at = new Date(g.event.at).toISOString();
  return D.create({
    seed: 42,
    world: {
      contexts: [{ ...Sports.contextFor(REAL_GAME.league, { couch: 2, pool: g.participants.length }), dress: { name: 'NFL', seasonName: 'Week ' + g.event.week, art: { generated: 'football' } } }],
      people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }],
      participants: g.participants,
      events: [{ id: 'sport-event-1', contextId: 'sport', number: 1, title: g.name, airAt: at, resultStatus: 'unavailable' }],
    },
    games: [{ id: 'g', name: g.name, contextId: 'sport', timing: 'live-only', spec: { ...season, span: { from: 1, to: 1 } } }],
    situation: { clock: new Date(Date.parse(at) - 90 * 60000).toISOString(), viewerId: 'ann', marks: [{ personId: 'ann', contextId: 'sport', through: 0 }, { personId: 'bo', contextId: 'sport', through: 0 }] },
    content: { completedEvents: 0, eventCount: 1 },
  });
}
const REAL = [
  { id: 'real-nfl-game-due', page: 'sport', final: false, label: g => 'A real game · ' + g.name + ': your lineup due before kickoff',
    shows: "A real NFL game as a head to head of two: both rosters' real players and headshots, drafted, Bo's lineup set, yours due before kickoff.",
    build: g => { const input = realGameDefinition(g); return { input, steps: play(input, queue([s => slotLineup(s, 'g', 'bo')])) }; } },
  { id: 'real-nfl-game-final', page: 'sport', final: true, label: g => 'A real game · ' + g.name + ': scored by its real box score',
    shows: 'The same head to head after the final whistle: both lineups set before kickoff, every point from the real box score as the app reads it.',
    build: g => {
      const input = realGameDefinition(g), lines = {};
      for (const [id, line] of Object.entries(g.fin.stored.lines)) if (g.byEspn[id]) lines[g.byEspn[id]] = line;
      const end = Date.parse(input.world.events[0].airAt) + 4 * HOUR;
      return { input, steps: play(input, queue([s => slotLineup(s, 'g', 'bo'), s => slotLineup(s, 'g', 'ann'), clockTo(end), { type: 'results', contextId: 'sport', eventId: 'sport-event-1', source: 'provider-fixture', resultStatus: 'final', data: { events: [], scoringEvents: [], lines } }])) };
    } },
];
/** The real-game situations whose recordings are on this machine: { id, page, label, shows }. */
const real = () => REAL.map(x => ({ x, g: realGame({ final: x.final }) })).filter(({ g }) => g).map(({ x, g }) => ({ id: x.id, page: x.page, label: x.label(g), shows: x.shows }));

/** The situations, without their definitions: { id, page, label, shows }. */
const list = () => LIST.map(({ id, page, label, shows }) => ({ id, page, label, shows }));
/** A situation ready for the explorer page: its definition, its steps (played once here), its viewer and game. `dress`: 'real' puts
 *  a real season's people in it where a recording exists (dress.cjs; the label says so), else it's the generated world. */
function build(id, { dress = null } = {}) {
  const r = REAL.find(y => y.id === id);
  if (r) {
    const g = realGame({ final: r.final });
    if (!g) throw Error('A real game needs its recordings: node scripts/dev-test/espn-snapshot.js record, then espn-final.js --teams=' + REAL_GAME.teams.join(',') + ' once it is over');
    const { input, steps } = r.build(g);
    return { kind: 'gameplay-situation', id, label: r.label(g), page: r.page, shows: r.shows, input, steps, viewerId: 'ann', gameId: 'g', dress: 'real' };
  }
  const x = LIST.find(y => y.id === id);
  if (!x) throw Error('Unknown situation: ' + id + ' (one of ' + LIST.map(y => y.id).join(', ') + ')');
  DRESS = dress || null;
  try {
    const { input, steps } = x.build();
    const real = !!dress && input.world.contexts.some(c => c.dress);
    return { kind: 'gameplay-situation', id, label: x.label + (real ? ' · real people' : ''), page: x.page, shows: x.shows, input, steps, viewerId: input.situation.viewerId || null, gameId: input.games[0].id, dress: real ? dress : null };
  } finally { DRESS = null; }
}
module.exports = { list, real, build, showDefinition, nflDefinition, nbaWeekDefinition };
