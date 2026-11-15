// A sports definition for the explorer (tools/gameplay-bench/explorer/runtime-sports.cjs): one game of a league's, as the app's
// own defaults make it, on a generated world of that league, three people, Ann a game behind. No production account or data.
//   options: league ('football/nfl'), game (the bench's id for one of the league's games: 'short' a team of three, 'bestBall',
//   'season' its head-to-head season with lineups; or a spec), seed, timing, completed (events with a box score), events, and
//   each person's mark (ann, bo, cy: the last game they've watched); hides (['ann']: who has "Sports scores too" on, so a live
//   game goes by their mark; a sport's results otherwise show straight away to anyone not playing only at their own pace).
//   A schedule of your own: schedule (each game's start, an ISO instant, in order; the first `completed` have box scores) with
//   clock (the scenario's now). closes ('start', 'daily', 'weekly': when lineups lock) and from (the game's first episode)
//   change the game's spec ('game': at each game's start, a slate's).
//   pool: 'real' (the league's real-size pool, its positions in the league's shares: runtime-sports.cjs REAL) or a number (that
//   many, dealt the default lineup's slots in turn as before; with athletes: 'real', in the league's shares); left out, the teams' and four.
//   A slate (a week of several games): slate (games a week, 2 to 6: twice as many teams, each athlete on one), its weeks seven days
//   apart unless a schedule is given (each week's first game at its event's time; the rest a day and three hours apart).
// Which league takes which game: node scripts/dev-test/profile-blockers.js, or the list in docs/GAMEPLAY-EXPLORER.md (sports).
const D = require('../../../tools/gameplay-bench/explorer/document.cjs');
const Sports = require('../../../tools/gameplay-bench/explorer/runtime-sports.cjs');
const Bench = require('../../../tools/gameplay-bench/sports.cjs');
const G = require('../../../src/lib/game/game-spec');
module.exports = function sportsProof(options = {}) {
  const league = options.league || 'football/nfl', completed = options.completed ?? 2;
  const base = typeof options.game === 'object' ? options.game : Bench.resolve(league, options.game || 'short').row.spec;
  const spec = { ...base, ...(options.closes ? { closes: options.closes } : {}), ...(options.from ? { span: { ...(base.span || {}), from: options.from, to: base.span?.to ?? null } } : {}) };
  const each = G.fullSpec(spec).get?.each || 1;
  const clock = options.clock || '2099-01-10T12:00:00.000Z', WEEK = 7 * 864e5, count = options.events ?? (options.schedule?.length || completed + 2);
  // (A slate's weeks: the last played a week before the clock's, the next a day after it.)
  const schedule = options.schedule || (options.slate ? Array.from({ length: count }, (_, i) => new Date(Date.parse(clock) + (i < completed ? -(completed - i) * WEEK : (i - completed) * WEEK + 864e5)).toISOString()) : []);
  const events = schedule.map((airAt, i) => ({ id: 'sport-event-' + (i + 1), contextId: 'sport', number: i + 1, title: 'Synthetic game ' + (i + 1), airAt, resultStatus: i < completed ? 'final' : 'unavailable' }));
  return D.create({
    seed: options.seed ?? 42,
    world: { contexts: [{ ...Sports.contextFor(league, { couch: 3, pool: options.pool ?? 3 * each + 4, ...(options.athletes ? { athletes: options.athletes } : {}) }), ...(options.slate ? { slate: { games: options.slate } } : {}) }], people: [{ id: 'ann', name: 'Ann' }, { id: 'bo', name: 'Bo' }, { id: 'cy', name: 'Cy' }].map(p => ((options.hides || []).includes(p.id) ? { ...p, hidesScores: true } : p)), ...(events.length ? { events } : {}) },
    games: [{ id: 'g', contextId: 'sport', timing: options.timing || 'own-pace', spec }],
    situation: {
      clock,
      marks: [['ann', options.ann ?? Math.max(0, completed - 1)], ['bo', options.bo ?? completed], ['cy', options.cy ?? completed]].map(([personId, through]) => ({ personId, contextId: 'sport', through })),
    },
    content: { completedEvents: completed, eventCount: count },
  });
};
