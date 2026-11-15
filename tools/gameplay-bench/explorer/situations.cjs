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
const D = require('./document.cjs'), R = require('./runtime.cjs'), { resultsData } = require('./publish.cjs');
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
  return D.create({
    seed: o.seed ?? 42,
    world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...CONTEXT, couch: people.length, pool: 18 }, ...(o.phaseStarts ? { phaseStarts: o.phaseStarts } : {}) }], people },
    games: [{ id: 'h2h', name: o.name || 'Weekly Lineup', contextId: 'show', spec: o.spec || H2H, timing: o.timing || 'own-pace' }],
    situation: { clock: CLOCK, viewerId: 'ann', marks: people.map(p => ({ personId: p.id, contextId: 'show', through: (o.marks || {})[p.id] ?? completed })) },
    content: { labels: o.labels === 'long' ? 'long' : 'normal', completedEvents: completed, eventCount: count },
  });
}
/** The NFL's own season game (head to head, a weekly lock), three people (Ann, Bo, Cy) at marks of their own; `hides`: who hides
 *  sports scores. A game a week, Thursday night (Eastern), two played: the clock is Saturday, so the next game is next week's and
 *  its lineup is open (the default schedule's games a day apart would share one week, locked since its first). */
const NFL_WEEKS = Array.from({ length: 6 }, (_, i) => new Date(Date.parse(CLOCK) - 36 * HOUR + (i - 1) * 7 * 24 * HOUR).toISOString());
function nflDefinition(o = {}) {
  const doc = sportsProof({ league: 'football/nfl', game: 'season', timing: 'live-only', completed: 2, schedule: NFL_WEEKS, clock: CLOCK, ...o });
  return D.create({ ...doc, situation: { ...doc.situation, viewerId: 'ann' } });
}
/** The NBA on a slate (three games a week), a lineup of two from four locking at each game's start, live, everyone caught up. */
function nbaWeekDefinition() {
  const nba = require('../sports.cjs').resolve('basketball/nba', 'short').row.spec;
  const spec = { ...nba, get: { by: 'draft', each: 4, order: 'snake', own: 'exclusive' }, count: { start: 2 }, closes: 'game' };
  const doc = sportsProof({ league: 'basketball/nba', game: spec, slate: 3, completed: 1, events: 3, timing: 'live-only', ann: 1, bo: 1, cy: 1 });
  return D.create({ ...doc, situation: { ...doc.situation, viewerId: 'ann' } });
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

/** The situations, without their definitions: { id, page, label, shows }. */
const list = () => LIST.map(({ id, page, label, shows }) => ({ id, page, label, shows }));
/** A situation ready for the explorer page: its definition, its steps (played once here), its viewer and game. */
function build(id) {
  const x = LIST.find(y => y.id === id);
  if (!x) throw Error('Unknown situation: ' + id + ' (one of ' + LIST.map(y => y.id).join(', ') + ')');
  const { input, steps } = x.build();
  return { kind: 'gameplay-situation', id, label: x.label, page: x.page, shows: x.shows, input, steps, viewerId: input.situation.viewerId || null, gameId: input.games[0].id };
}
module.exports = { list, build, showDefinition, nflDefinition, nbaWeekDefinition };
