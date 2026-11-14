// Deterministic case generation for headless campaigns (plan Chunk 4A, engine/state tier).
// A case is a pure function of (manifest generator config, manifest seed, case index): worker order, crashes or
// resumes never shift another case's values. Definitions stay inside the runtime's supported profile
// (core-post-acquisition-v1); anything else would be a generator defect, reported as such.
const J = require('../explorer/json.cjs'), D = require('../explorer/document.cjs');
const VERSION = 'proof-family-46'; // 46: a game in stages on some cases (two Weekly Lineups or Outlasts split at the merge or at an episode, sometimes three stages; made live), from a stream of its own; the walk plays each stage as its own game, and airs and publishes more often while a stage waits for its draft // 45: what whoever runs a game does with its waivers in the walk (opens, changes and turns off windows, on games with no waivers too; runs a week now; takes a run back; claims a spot for someone), and claims in a window opened by hand // 44: mid-season waivers on some Outlast games and lineup drafts (half those Outlast games scoring replacements at half); the walk claims and moves in free agency // 43: auctions (sealed bids settled at setup, a budget) on some Outlast games // 42: some survival pools skip a night you've picked everyone still in // 41: group slots on some lineups, on a world that forms pairs; the walk fills slots // 40: a pool's second pick on some streak pools, made in the walk; nights two go home // 39: mulligans and buybacks on some survival pools; a streak pool with mulligans alone // 38: drafts spread across tribes (get.across) on some lineups and Outlast games, on a world with two or three tribes // 37: secret roles on some lineups ranked by total and some Outlast games // 36: a captain (x2 or x3) on some lineups, named with the walk's lineups // 35: the top scorer's twist (double or half points) on some lineups and pick games; the chooser chooses // 34: Outlast (a draft scored by place, every holding counted), half of them in reverse // 33: answers and bot calls on beat questions over the episodes already played // 32: beat the bot on some plain per-episode questions; the bot calls open windows // 31: results sometimes give a picked castaway one of that week's card moments // 30: a weekly card (drawn in turn from the spec's list; only its moments count, a hit once each pick) on some pick games // 29: confidence picks (rank who goes home, surest first) on some games of questions; the boot sometimes follows a surest pick // 28: Weekly Calls on some cases; the walk makes calls; results follow called boots and moments called yes // 27: pre-start picks for who wins immunity first and who finds an idol follow the history half the time; walk results sometimes give an idol to a pre-start pick // 26: whole-game moment questions (who, first, happened, how many; asked once, locked at the start) answered before the start // 25: an episode's results never list one moment twice for one person (the season's decisions keep one row each) // 24: rollovers on some per-episode questions (not shared, staked or a parlay's leg), sometimes worth 3 // 23: a moment someone said yes to often happens, so yes/no legs are right and parlays pay // 22: in a case with a parlay, some steps answer an open leg (finishing a part-answered window first), so parlays pay // 21: multipliers (score.times: episode 1's or the first walked one's, the finale's, or both) on some drafts and pick games // 20: walks often answer a parlay's other legs in a window one is answered in, so parlays pay // 19: parlays (two or three per-episode questions, every one right multiplies their points) on some games of questions // 18: teams of players (drawn, two teams, mean or sum) on some games of 3+ people // 17: bounties on some lineups (who voted for whom with each vote-out, sometimes miscounted) // 16: the merge (a phase start), games from or until it, "When does the merge start?" // 15: races to N points and cuts (the lowest out every N episodes) // 14: questions the couch settles (what most, or fewest, of you say) // 13: wagers (a number or any of your points, even or pool odds) and banks // 12: drafts dealt out of a hat (draw, exclusive or shared) // 11: shared points (split pot, only one right), a who-did-it moment question, results that often follow the answers // 10: lives (last one standing, co-op) on questions games, survival pools with lives // 9: only some moments count (a list) and hits counted (every, pick, objective) // 8: ranking by weeks won (ties all, split or none) // 7: head to head (odd one out, quiet nights, playoffs) on a share of games // 6: season-long questions (who wins, the final three) and the finale's results // 5: side bets on some lineup games, with post/guess/unguess/grade steps // 4: the 'shared' first-name content profile
const _v3 = 'proof-family-3'; // 2: results never release the last event (world rule); 3: the clock passes an airing before its results
const QUESTIONS = require('../../../tests/fixtures/gameplay-explorer/questions-input.json');
const { outcome, voteFacts, bounties } = require('../explorer/runtime-data.cjs'), SURVIVOR = require('../../../src/lib/game/formats').formatFor('survivor');
// Season-long questions as the game wizard writes them (asked once, locked at the finale, settled by its results).
const SEASON_LONG = [
  { id: 'winner', ask: 'Who wins?', answer: 'person', points: 3, settle: { by: 'results', take: 'winner' }, asked: 'once', closes: 'finale', pick: 1, from: 'cast' },
  { id: 'top3', ask: 'Who makes the final three?', answer: 'person', points: 1, settle: { by: 'results', take: 'top', place: 3 }, asked: 'once', closes: 'finale', pick: 3, from: 'cast' },
];

// Whole-game moment questions (asked once, locked at the game's start, settled by the season's moments): who, who first, whether at
// all, how many. Survivor's own moments, each one generated history and walks produce.
const MOMENT_ONCE = [
  { id: 'idols', ask: 'Who finds an idol this season?', answer: 'person', points: 2, pick: 1, asked: 'once', closes: 'start', settle: { by: 'moment', moment: 'idolFound', take: 'who' }, from: 'cast' },
  { id: 'firstImmunity', ask: 'Who wins individual immunity first?', answer: 'person', points: 3, pick: 1, asked: 'once', closes: 'start', settle: { by: 'moment', moment: 'individualImmunity', take: 'first' }, from: 'cast' },
  { id: 'exile', ask: 'Will anyone go to Exile?', answer: 'yesNo', points: 1, asked: 'once', closes: 'start', settle: { by: 'moment', moment: 'wentToExile', take: 'happened' } },
  { id: 'rewards', ask: 'How many reward wins this season?', answer: 'number', points: 3, asked: 'once', closes: 'start', settle: { by: 'moment', moment: 'rewardWin', take: 'count' } },
];

// Confidence picks: rank who goes home, surest first (each right one its points times its weight: the first `pick`, the last 1).
const SURE = { id: 'sure', ask: 'Rank who goes home, surest first', answer: 'confidence', points: 1, asked: 'each', settle: { by: 'results', take: 'out' }, closes: 'start' };

// A small seeded PRNG (mulberry32) from a digest, so values depend only on the case's own seed.
function rng(seed) {
  let a = parseInt(J.digest(seed).slice(0, 8), 16) >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), pick: list => list[Math.floor(next() * list.length)], chance: p => next() < p };
}
const caseSeed = (manifest, index) => J.digest([manifest.id, manifest.seed, manifest.generator, index]);
const caseId = (manifest, index) => 'case-' + J.digest([manifest.id, manifest.generator, caseSeed(manifest, index)]).slice(0, 16);

/** The definition for case `index`: 1-3 games from the proof family, 2-4 people, varied marks, timing and content. */
function definition(manifest, index) {
  const r = rng([caseSeed(manifest, index), 'definition']);
  const peopleCount = r.int(2, 4), completed = r.int(1, 3), eventCount = completed + r.int(2, 3);
  const people = Array.from({ length: peopleCount }, (_, i) => ({ id: 'p' + (i + 1), name: ['Ann', 'Bo', 'Cy', 'Di'][i] }));
  const kinds = ['lineup', 'picks', 'questions'].filter(() => r.chance(0.7));
  if (!kinds.length) kinds.push(r.pick(['lineup', 'picks', 'questions']));
  // Outlast on some (proof-family-34): a draft scored by place (1 plus every boot outlasted), every holding counted; half in reverse
  // (the cast's size + 1 less that: the earlier yours go home, the more you score).
  if (r.chance(0.3)) kinds.push('outlast');
  // Weekly Calls on some (proof-family-28): the show's calls, a person's on the context, whichever game counts them.
  const weekly = r.chance(0.25) ? [{ id: 'calls', contextId: 'show', timing: r.chance(0.8) ? 'own-pace' : 'live-only', spec: { preset: 'weekly-calls' } }] : [];
  // Head to head on a share of games: how an odd one out and a quiet night count, and (sometimes) playoffs at the season's end.
  const h2h = () => r.chance(0.25) ? { rank: { by: 'weeks', ties: r.pick(['all', 'split', 'none']) } } : r.chance(0.35) ? { rank: { by: 'matchups', odd: r.pick(['median', 'bye']), quiet: r.pick(['skip', 'tie']), ...(r.chance(0.5) ? { playoffs: { teams: peopleCount >= 4 && r.chance(0.5) ? 4 : 2 } } : {}) } } : {};
  // Scored by moments: sometimes only a few of them count, sometimes hits are counted (worth 1 each) instead of points.
  const MOMENTS = QUESTIONS.context.moments.filter(m => !m.auto && !m.off).map(m => m.id);
  const counting = () => ({ ...(r.chance(0.4) ? { only: shuffled(r, MOMENTS).slice(0, r.int(2, 4)) } : {}), ...(r.chance(0.4) ? { hits: r.pick(['every', 'pick', 'objective']) } : {}) });
  // Multipliers (score.times) on some games scored by moments: an episode's points (episode 1's, the specimens', or the first one
  // walked) and/or the finale's, times 2 or 3. Never beside a race or a cut: points decide who's out there, so the paired check's
  // twin without times could play a different game.
  const timed = rank => {
    if (rank?.race || rank?.cut || !r.chance(0.3)) return {};
    const which = r.pick(['episode', 'finale', 'both']);
    return { times: [...(which !== 'finale' ? [{ times: r.pick([2, 3]), episode: r.chance(0.7) ? 1 : completed + 1 }] : []), ...(which !== 'episode' ? [{ times: r.pick([2, 3]), finale: true }] : [])] };
  };
  // A weekly card on some pick games (proof-family-30, every specimen's shape): drawn in turn from a list of the show's moments,
  // only its moments counting that week, each a hit once for each pick. Else the moments as before (some only, hits, multipliers).
  const weekCard = () => { if (!r.chance(0.35)) return { score: twisted({ by: 'moments', ...counting(), ...timed(null) }, null) }; const of = shuffled(r, MOMENTS).slice(0, r.int(5, 10)); return { count: { pick: true }, score: { by: 'moments', only: 'card', hits: 'pick' }, card: { from: 'moments', each: r.int(2, Math.min(5, of.length)), of } }; };
  // The top scorer's twist on some games scored by moments (proof-family-35): after each episode its top scorer chooses double or half
  // points for the next. Never beside a race or cut (points decide who's out: the paired twin could play a different game), nor hits
  // counted once each (the twin without it would take the plain path BACKLOG 49 miscounts).
  // A captain on some lineups (proof-family-36): one of your starters, named with the lineup, whose points multiply. Not with hits
  // counted once each (the paired twin without it would take the plain path BACKLOG 49 miscounts).
  const captained = score => !['pick', 'objective'].includes(score.hits) && r.chance(0.3) ? { ...score, captain: { times: r.pick([2, 3]) } } : score;
  // Secret roles (proof-family-37): one or two seats dealt a role once the game starts, scoring when a castaway someone without it held
  // goes home (any way, or a vote), counted from the reveal (the game's end). Only beside a plain total (the engine refuses a race, a cut
  // and head to head beside it), and never in teams.
  const roled = (score, rank) => !rank && peopleCount >= 3 && r.chance(0.5) ? { ...score, roles: { count: r.int(1, 2), points: r.pick([1, 2]), on: r.pick(['out', 'votedOut']) } } : score;
  const TWISTS = [{ id: 'double', name: 'Double points', times: 2 }, { id: 'half', name: 'Half points', times: 0.5 }];
  const twisted = (score, rank) => !rank?.race && !rank?.cut && !['pick', 'objective'].includes(score.hits) && r.chance(0.25) ? { ...score, twist: { of: TWISTS } } : score;
  // A draft spread across the cast's tribes on some (proof-family-38, every specimen's shape: of group, then keep); the world then has
  // two or three tribes (drawn only when a game spreads, so other cases are unchanged).
  const across = () => r.chance(0.3) ? { across: { of: 'group', then: 'keep' } } : {};
  // Group slots on some lineups (proof-family-41: one or two, shared or exclusive, a swap or not, mean or sum); the world then forms
  // pairs, re-paired every one to three episodes (drawn only when a game has slots).
  const grouped = () => r.chance(0.3) ? { groups: { slots: r.int(1, 2), own: r.pick(['shared', 'exclusive']), swap: r.chance(0.3), fallback: r.pick(['void', 'carry-on']), points: r.pick(['mean', 'sum']) } } : {};
  // A lineup ranked by a cut (the lowest out every N episodes: last one standing) or a race to N points, else head to head and the rest.
  const knock = () => r.chance(0.15) ? { rank: { by: 'standing', cut: [{ at: { every: r.int(1, 3) }, out: 1, tie: 'keep', quiet: 'cut' }] } } : r.chance(0.12) ? { rank: { by: 'total', race: { to: r.pick([3, 5, 8]) } } } : h2h();
  // A phase-bound span: from the merge, or until it (the world's merge start, when it has one).
  const merged = r.chance(0.5) ? r.int(2, eventCount - 1) : null, phased = () => r.chance(0.2) ? { span: r.chance(0.5) ? { from: { phase: 'merged' } } : { to: { phase: 'merged' } } } : {};
  // Teams of players (drawn at random, two of them, their members' mean or sum) on some games of three or more: ranked by points,
  // head to head or weeks won, or a draft's race or cut (the engine's rule: a game of questions' lives or race, and a pool's streak,
  // are each of you's own; playoffs for more than the two teams there are).
  const teamed = game => !game.spec.score?.roles && peopleCount >= 3 && (['total', 'matchups', 'weeks'].includes(game.spec.rank?.by) || game.spec.get?.by === 'draft') && !(game.spec.score?.by === 'answers' && game.spec.rank?.race) && game.spec.score?.by !== 'survive' && !((game.spec.rank?.playoffs?.teams ?? 0) > 2) && r.chance(0.2) ? { ...game, spec: { ...game.spec, rank: { ...game.spec.rank, teams: { of: 2, ...(r.chance(0.5) ? { score: 'sum' } : {}) } } } } : game;
  // (Group slots score every hit their people have: hits counted once each don't go beside them, the engine's rule.)
  // Mid-season waivers on some Outlast games and lineup drafts (proof-family-44, the specimens' shape varied: every loss replaced or only
  // when short, manual windows or every episode with a swap or none, auto-fill or not, replacements per holder shared or not); half of
  // those Outlast games score a replacement at half (score.multiply, a replacement's, the specimens' rule).
  const waived = game => {
    if (!(game.id === 'outlast' || game.id === 'lineup') || game.spec.get?.by !== 'draft' || !r.chance(0.35)) return game;
    const w = { feel: 'balanced', replace: game.id === 'lineup' ? r.pick(['always', 'always', 'whenShort']) : 'always', // (only a lineup is ever short)
      short: null, windows: r.chance(0.6) ? { schedule: 'manual', every: 3, swaps: 0 } : { schedule: 'everyEpisode', every: 3, swaps: r.int(0, 1) }, order: 'rolling', hours: 24, freeAgency: true, autoFill: r.chance(0.7), ...(r.chance(0.5) ? { own: { replace: 'shared' } } : {}) };
    // (Outlast with shared teams can't: nobody's castaways ever come free. It drafts exclusive, in a snake, as the specimens do. Nor a
    // replacement's multiplier in reverse, where nobody earns while they hold someone.)
    const get = game.id === 'outlast' && game.spec.get.own === 'shared' ? { by: 'draft', each: Math.min(game.spec.get.each, Math.floor(10 / peopleCount)), own: 'exclusive', order: 'snake' } : game.spec.get;
    const half = game.id === 'outlast' && game.spec.score.by === 'place' && !game.spec.score.reverse && !game.spec.score.multiply && r.chance(0.5) ? { multiply: [{ joined: 'replacement', times: r.pick([[0.5], [0.5, 0.25]]) }] } : {};
    return { ...game, spec: { ...game.spec, get, score: { ...game.spec.score, ...half }, extras: { ...(game.spec.extras || {}), waivers: w } } };
  };
  const slotsHit = game => game.spec.get?.groups && ['pick', 'objective'].includes(game.spec.score?.hits) ? { ...game, spec: { ...game.spec, score: Object.fromEntries(Object.entries(game.spec.score).filter(([k]) => k !== 'hits')) } } : game;
  const games = [...weekly, ...kinds.map(kind => waived(slotsHit(teamed((() => {
    const timing = r.chance(0.8) ? 'own-pace' : 'live-only';
    // An auction on some (proof-family-43, the specimens' shape: exclusive (everyone's places within the smallest cast, 10), a budget of 100 or 50, the lowest price 1 or 2, fill or short).
    if (kind === 'outlast') return { id: 'outlast', contextId: 'show', timing, spec: { get: r.chance(0.35) ? { by: 'draft', each: r.int(2, Math.max(2, Math.min(4, Math.floor(10 / peopleCount)))), own: 'exclusive', order: 'auction', budget: { total: r.pick([100, 50]), floor: r.int(1, 2), fallback: r.pick(['fill', 'short']) } } : { by: 'draft', each: r.int(2, 4), own: 'shared', order: 'blind', ...across() }, count: { all: true }, score: roled({ by: 'place', ...(r.chance(0.5) ? { reverse: true } : {}) }, null), rank: { by: 'total' } } };
    if (kind === 'lineup') {
      // A bounty on some (never beside a cut: the schema's rule): points from whoever's starter one of yours votes out.
      const each = r.int(3, 5), hat = r.chance(0.3), ranked = knock(), bounty = !ranked.rank?.cut && r.chance(0.3) ? { bounty: { points: r.pick([1, 2, 3]) } } : {};
      return { id: 'lineup', contextId: 'show', timing, spec: { ...phased(), get: { ...(hat ? { by: 'draft', each, own: peopleCount * each <= 10 && r.chance(0.5) ? 'exclusive' : 'shared', order: 'draw' } : { by: 'draft', each, own: 'shared', order: 'blind' }), ...across(), ...grouped() }, count: { start: r.int(1, each - 1) }, score: roled(captained(twisted({ by: 'moments', ...counting(), ...bounty, ...timed(ranked.rank) }, ranked.rank)), ranked.rank), rank: { by: 'total' }, ...(r.chance(0.5) ? { extras: { bets: { points: r.int(1, 3) } } } : {}), ...ranked } };
    }
    if (kind === 'picks' && r.chance(0.4)) {
      // Family 39: a pool's mulligans (the first wrong picks forgiven) and buyback (back in with one life, for a cost, until an episode
      // or any time); a streak pool (no lives) with mulligans alone, as the specimens have it.
      // Family 42: 40% skip a night you've picked everyone still in (get.fallback 'skip'), else it's a miss; a case with one has a
      // cast of six to eight (unless a draft is exclusive), so someone can run out of people to pick.
      // Family 40: a streak pool's second pick (get.second: void on a night only one goes home, or counts every night) instead of or beside
      // its mulligans, as the specimens have them.
      const skip = r.chance(0.4), streak = r.chance(0.5), second = streak && r.chance(0.7) ? { fallback: r.pick(['void', 'counts']) } : null, mulligans = (streak && (!second || r.chance(0.3))) || (!streak && r.chance(0.35)) ? r.int(1, 2) : 0, buyback = !streak && r.chance(0.4) ? { times: r.int(1, 2), before: r.chance(0.3) ? { episode: r.int(2, 4) } : null, cost: r.pick([0, 3]) } : null;
      return { id: 'picks', contextId: 'show', timing, spec: { get: { by: 'pick', each: 1, repeat: 'never', ...(second ? { second } : {}), ...(skip ? { fallback: 'skip' } : {}) }, score: { by: 'survive', ...(streak ? {} : { lives: r.int(1, 3) }), ...(mulligans ? { mulligans } : {}), ...(buyback ? { buyback } : {}) }, rank: { by: streak ? 'streak' : 'standing' } } };
    }
    if (kind === 'picks') return { id: 'picks', contextId: 'show', timing, spec: { ...(r.chance(0.15) ? { span: { to: { phase: 'merged' } } } : {}), get: { by: 'pick', each: r.int(1, 3), repeat: r.pick(['never', 'any']) }, ...weekCard(), rank: { by: 'total' }, ...h2h() } };
    // Per-episode questions: sometimes a who-did-it moment question, and their points shared (split pot) or only for the only one right.
    const base = [...QUESTIONS.spec.ask, ...(r.chance(0.3) ? [{ id: 'most', ask: 'Who will most of you say goes home?', answer: 'person', points: 2, asked: 'each', settle: { by: 'players', take: r.pick(['majority', 'minority']), of: 'boot', tie: r.pick(['none', 'all']) } }] : []), ...(r.chance(0.4) ? [{ id: 'idol', ask: 'Who finds an idol?', answer: 'person', points: 2, asked: 'each', settle: { by: 'moment', moment: 'idolFound', take: 'who' } }] : [])]
      .map(q => r.chance(0.35) ? { ...q, share: r.pick(['split', 'only']) } : q)
      // Stakes on a yes/no or one person: up to a number, or any of your points ('total'); even odds or the pool's.
      .map(q => q.asked === 'each' && r.chance(0.35) ? { ...q, wager: r.pick([3, 5, 10, 'total']), ...(r.chance(0.3) ? { odds: 'pool' } : {}) } : q)
      // Rollovers (proof-family-24) on some plain per-episode questions: a window nobody earns on carries its points into the next.
      .map(q => q.asked === 'each' && q.share === undefined && q.wager === undefined && r.chance(0.3) ? { ...q, rollover: true, ...(r.chance(0.5) ? { points: 3 } : {}) } : q)
      // Beat the bot (proof-family-32) on some plain per-episode person or yes/no questions settled by the results or a moment: a right
      // answer scores only where the bot's call isn't right; with no call the window plays, or is void.
      .map(q => q.asked === 'each' && q.share === undefined && q.wager === undefined && !q.rollover && ['person', 'yesNo'].includes(q.answer) && ['results', 'moment'].includes(q.settle?.by) && r.chance(0.3) ? { ...q, beat: { by: 'bot', none: r.pick(['plays', 'plays', 'void']) } } : q);
    // A parlay on some: two or three of its per-episode questions (never a split pot: the schema's rule), every one right in a window
    // multiplying their points by 2 or 3.
    const legs = base.filter(q => q.share !== 'split' && !q.rollover && !q.beat).map(q => q.id), parlays = legs.length >= 2 && r.chance(0.35) ? { parlays: [{ of: shuffled(r, legs).slice(0, r.int(2, Math.min(3, legs.length))), times: r.pick([2, 3]) }] } : {};
    const asked = { ...QUESTIONS.spec, score: { ...QUESTIONS.spec.score, ...parlays }, ask: [...base, ...(r.chance(0.25) ? [{ ...SURE, pick: r.int(2, 4) }] : []), ...(r.chance(0.35) ? shuffled(r, MOMENT_ONCE).slice(0, r.int(1, 2)).map(q => q.id === 'idols' ? { ...q, pick: r.int(1, 2) } : q) : []), ...(r.chance(0.6) ? SEASON_LONG : []), ...(r.chance(0.3) ? [{ id: 'merge', ask: 'When does the merge start?', answer: 'number', points: 2, asked: 'once', closes: 'start', settle: { by: 'phase', phase: 'merged', take: 'starts' } }] : [])] };
    // Lives: a wrong answer (or none) costs one; at none you're out (standing), or the couch shares them (co-op).
    if (r.chance(0.35)) { const coop = r.chance(0.4); return { id: 'questions', contextId: 'show', timing, spec: { ...asked, score: { ...asked.score, lives: r.int(1, 3), ...(r.chance(0.5) ? { livesOn: ['boot'] } : {}), ...(coop && r.chance(0.5) ? { saves: r.pick(['one', 'most', 'all']) } : {}) }, rank: { by: coop ? 'coop' : 'standing' } } }; }
    // A bank to stake from (ranked by the total: never beside head to head or weeks won).
    if (asked.ask.some(q => q.wager !== undefined) && r.chance(0.4)) return { id: 'questions', contextId: 'show', timing, spec: { ...asked, score: { ...asked.score, bank: { start: r.int(5, 20) } }, rank: { by: 'total' } } };
    if (r.chance(0.15)) return { id: 'questions', contextId: 'show', timing, spec: { ...asked, rank: { by: 'total', race: { to: r.pick([2, 4, 6]) } } } };
    return { id: 'questions', contextId: 'show', timing, spec: { ...asked, ...h2h() } };
  })()))))];
  const args = {
    seed: r.int(1, 999999),
    world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...QUESTIONS.context, couch: peopleCount, pool: games.some(g => g.spec.get?.fallback === 'skip') && !games.some(g => g.spec.get?.own === 'exclusive' || g.spec.get?.groups?.own === 'exclusive') ? r.int(6, 8) : r.int(10, 18) }, ...(merged ? { phaseStarts: { merged } } : {}), ...(games.some(g => g.spec.get?.across) ? { tribes: r.int(2, 3) } : {}), ...(games.some(g => g.spec.get?.groups) ? { pairs: { every: r.int(1, 3) } } : {}) }], people },
    games,
    situation: { clock: '2099-01-10T12:00:00.000Z', marks: people.map(p => ({ personId: p.id, contextId: 'show', through: r.int(0, completed) })) },
    content: { labels: r.pick(['normal', 'normal', 'long', 'unbroken', 'shared']), completedEvents: completed, eventCount },
  };
  // A game in stages on three cases in ten (proof-family-46, the specimens' shapes: two Weekly Lineups or two Outlasts, each a game of
  // its own with its own draft, the overall by points), from a stream of its own so every other game in the case is as it was.
  // Split at the merge (the world gets one when it has none, most times: without one the second stage never starts) or at an
  // episode (sometimes twice: three stages). Made live, as the engine lab (its only door) makes one. Each stage a draft of its own:
  // a Weekly Lineup's private draft (start N or the best N of them), or an Outlast in a snake (exclusive, while everyone's places fit
  // the cast: a later stage's that no longer fit among who's still in is played shared) or a private draft; side bets and a
  // window-by-hand's waivers as the specimens have them (never on a shared Outlast: nobody's castaways ever come free).
  const rs = rng([caseSeed(manifest, index), 'stages']);
  if (rs.chance(0.3)) {
    const context = args.world.contexts[0], pool = context.engine.pool, lineupKind = rs.chance(0.6), fits = Math.floor(pool / peopleCount);
    const waivers = { feel: 'balanced', replace: 'never', short: null, windows: { schedule: 'manual', every: 3, swaps: 0 }, order: 'rolling', hours: 24, freeAgency: true, autoFill: true };
    const snake = !lineupKind && fits >= 2 && rs.chance(0.5), bets = rs.chance(0.6), waived = rs.chance(0.5);
    const stageGame = () => {
      const extras = (own) => { const x = { ...(bets ? { bets: { points: 1 } } : {}), ...(waived && (lineupKind || own === 'exclusive') ? { waivers } : {}) }; return Object.keys(x).length ? { extras: x } : {}; };
      if (lineupKind) { const each = rs.int(3, Math.max(3, Math.min(6, pool - 2))), n = rs.int(2, Math.min(3, each - 1)); return { preset: 'weekly-lineup', get: { by: 'draft', each, own: 'shared', order: 'blind' }, count: rs.chance(0.6) ? { start: n } : { best: n }, score: { by: 'moments' }, rank: { by: 'total' }, ...extras('shared') }; }
      if (snake) return { preset: 'outlast', get: { by: 'draft', each: rs.int(2, Math.min(3, fits)), own: 'exclusive', order: 'snake' }, count: { all: true }, score: { by: 'place' }, rank: { by: 'total' }, ...extras('exclusive') };
      return { preset: 'outlast', get: { by: 'draft', each: rs.int(2, 4), own: 'shared', order: 'blind' }, count: { all: true }, score: { by: 'place' }, rank: { by: 'total' }, ...extras('shared') };
    };
    // The same game each side (the specimens'), or sometimes each stage's own size.
    const one = stageGame(), gameOf = () => rs.chance(0.3) ? stageGame() : one;
    let stages;
    if (rs.chance(0.65)) {
      if (!context.phaseStarts && rs.chance(0.85)) context.phaseStarts = { merged: rs.int(2, eventCount - 1) };
      stages = [{ id: 'before', name: 'Before the merge', game: { ...gameOf(), span: { from: 1, to: { phase: 'merged' } } } }, { id: 'after', name: 'Merged', game: { ...gameOf(), span: { from: { phase: 'merged' } } } }];
    } else {
      const three = eventCount >= 4 && rs.chance(0.3), a = rs.int(1, eventCount - (three ? 2 : 1)), b = three ? rs.int(a + 1, eventCount - 1) : null;
      stages = [{ id: 'first', name: 'First leg', game: { ...gameOf(), span: { from: 1, to: a } } }, { id: 'second', name: 'Second leg', game: { ...gameOf(), span: { from: a + 1, ...(three ? { to: b } : {}) } } }, ...(three ? [{ id: 'third', name: 'Third leg', game: { ...gameOf(), span: { from: b + 1 } } }] : [])];
    }
    args.games = [...args.games, { id: 'stages', name: 'Stages', contextId: 'show', timing: 'live-only', spec: { stages, overall: { by: 'points' } } }];
  }
  // Whole-game moment questions are answered before the game starts (episode 0, as setup: the game is under way by the case's
  // start), each person each question four times in five. A stream of its own, so nothing else shifts.
  const once = (games.find(g => g.id === 'questions')?.spec.ask || []).filter(q => MOMENT_ONCE.some(m => m.id === q.id)), ra = rng([caseSeed(manifest, index), 'once-answers']);
  const cast = Array.from({ length: args.world.contexts[0].engine.pool }, (_, i) => 'show-participant-' + (i + 1));
  // Half the person picks follow the generated history (proof-family-27: who won immunity first, who found an idol), read from a
  // probe of the same world, so right picks happen; the rest are anyone.
  let known = {};
  if (once.some(q => q.answer === 'person')) {
    const probe = require('../explorer/runtime.cjs').open(D.create(args)), w = probe.snapshot().contexts.show; probe.dispose();
    const hits = type => w.events.flatMap(e => (w.facts.find(f => f.eventId === e.id)?.data.scoringEvents || []).filter(m => m.type === type).map(m => ({ n: e.number, id: m.castawayId })));
    const imm = hits('individualImmunity'), firstN = imm.length ? Math.min(...imm.map(h => h.n)) : null;
    known = { firstImmunity: imm.filter(h => h.n === firstN).map(h => h.id), idols: [...new Set(hits('idolFound').map(h => h.id))] };
  }
  const person = q => { const good = known[q.id] || [], one = () => good.length && ra.chance(0.5) ? ra.pick(good) : ra.pick(cast); if (q.pick <= 1) return one(); const first = one(); return [first, ...shuffled(ra, cast.filter(id => id !== first)).slice(0, q.pick - 1)]; };
  const rows = once.flatMap(q => people.filter(() => ra.chance(0.8)).map(p => ({ playerId: p.id, episode: 0, question: q.id, answer: q.answer === 'person' ? person(q) : q.answer === 'yesNo' ? ra.pick(['yes', 'no']) : ra.int(0, 5) })));
  // Beat the bot over the episodes already played (proof-family-33): each person answered its questions seven times in ten and the
  // bot called three times in four, each right about two in five (read from a probe of the same world), so settled windows with a
  // call, without one, blocked and scored all happen. A stream of its own.
  const beats = (games.find(g => g.id === 'questions')?.spec.ask || []).filter(q => q.beat), botRows = [];
  if (beats.length) {
    const probe = require('../explorer/runtime.cjs').open(D.create(args)), w = probe.snapshot().contexts.show; probe.dispose();
    const rb = rng([caseSeed(manifest, index), 'beat-history']), out = new Set();
    for (const e of w.events.filter(e => e.number <= completed)) {
      const data = w.facts.find(f => f.eventId === e.id)?.data || { events: [], scoringEvents: [] }, still = w.participants.map(p => p.id).filter(id => !out.has(id));
      for (const q of beats) {
        const right = q.answer === 'yesNo' ? [(data.scoringEvents || []).some(m => m.type === q.settle.moment) ? 'yes' : 'no']
          : q.settle.by === 'results' ? (data.events || []).map(x => x.castawayId).filter(id => still.includes(id)) : [...new Set((data.scoringEvents || []).filter(m => m.type === q.settle.moment).map(m => m.castawayId))].filter(id => still.includes(id));
        const say = () => right.length && rb.chance(0.4) ? rb.pick(right) : q.answer === 'yesNo' ? rb.pick(['yes', 'no']) : rb.pick(still);
        for (const p of people) if (rb.chance(0.7)) rows.push({ playerId: p.id, episode: e.number, question: q.id, answer: say() });
        if (rb.chance(0.75)) botRows.push({ question: q.id, episode: e.number, answer: say() });
      }
      for (const x of data.events || []) out.add(x.castawayId);
    }
  }
  const stores = { ...(rows.length ? { answers: { questions: rows } } : {}), ...(botRows.length ? { bot: { questions: botRows } } : {}) };
  return D.create({ ...args, ...(Object.keys(stores).length ? { setup: { stores } } : {}) });
}

/**
 * The next action for a step, chosen from the runtime's own projections (so most are plausible) with a share of
 * deliberately invalid ones. `view(gameId, personId)` is session.project; `snap` is session.snapshot().
 */
function nextAction(r, snap, document, project) {
  const world = snap.contexts.show, who = r.pick(snap.people.map(p => p.id));
  // A parlay's legs (proof-family-22): the couch answers them before the episode airs, so every leg answered (and a parlay paid)
  // happens. A leg of a window someone has part-answered first, else any open leg. Only cases with a parlay draw these numbers.
  // (proof-family-29: a confidence ranking is a focus question too, so rankings get answered before they lock.)
  const focusOf = g => new Set([...(g.spec.score?.parlays || []).flatMap(p => p.of), ...(g.spec.ask || []).filter(q => q.answer === 'confidence' || q.beat).map(q => q.id)]); // (and a question against the bot, proof-family-32)
  const parlayed = document.games.filter(g => focusOf(g).size);
  if (parlayed.length && r.chance(0.35)) {
    const g = r.pick(parlayed), legs = focusOf(g), views = snap.people.map(p => [p.id, project(g.id, p.id)]);
    const open = v => v.questions.filter(q => !q.closed && legs.has(q.id) && q.mine == null);
    const part = views.map(([p, v]) => [p, open(v).filter(q => v.questions.some(o => o.id !== q.id && legs.has(o.id) && o.episode === q.episode && o.mine != null))]).filter(([, x]) => x.length);
    const any = views.map(([p, v]) => [p, open(v)]).filter(([, x]) => x.length), choice = part.length ? r.pick(part) : any.length ? r.pick(any) : null;
    if (choice) { const [p, list] = choice, q = r.pick(list); return { type: 'answer', gameId: g.id, personId: p, question: q.id, episode: q.episode, answer: wagered(r, q, q.pick > 1 ? options(r, q) : r.pick(q.options.map(o => o.id ?? o)), false) }; }
  }
  // What whoever runs a game does with its waivers (proof-family-45), on any game that could have them (a draft's: most have none, and a
  // window opened by hand is the only waivers they ever see): with no week running, open a window (sometimes more swaps than a team has,
  // or one with nothing to claim: invalid); with one open, run it now, change or turn off its window, or send one spot of someone's
  // claim for them; after a run, take it back (sometimes naming another week: refused). Mostly whoever runs the game (its first seat),
  // sometimes someone else (refused).
  {
    const S = require('../../../src/lib/game/state-logic'), W = S.WaiverLogic, runnable = document.games.filter(g => W.supported(snap.games[g.id].state));
    if (runnable.length && r.chance(0.14)) {
      const g = r.pick(runnable), st = snap.games[g.id].state, period = W.current(st), by = r.chance(0.9) ? st.players[0].id : r.pick(st.players).id, size = S.rosterSize(st);
      const window = () => ({ type: 'waiverWindow', gameId: g.id, personId: by, swaps: r.chance(0.08) ? size + 1 : r.int(0, Math.min(2, size)), ...(r.chance(0.5) ? { replace: r.chance(0.8) } : {}) });
      // (Mostly when one can open: an episode with results, no week for it yet, the season still on.)
      if (!period) { const last = S.SpoilerLogic.latestWithResults(st), prev = W.periods(st).at(-1); if ((last > 0 && !(prev && prev.episode >= last) && !S.MidSeasonLogic.seasonOver(st)) || r.chance(0.1)) return window(); }
      else if (period.phase === 'processed') { if (r.chance(0.7)) return { type: 'waiverUndo', gameId: g.id, personId: by, ...(r.chance(0.5) ? { periodId: r.chance(0.85) ? period.id : 'wv-another-week' } : {}) }; }
      else {
        // (A window with claims in it is often cut back to no swaps or turned off, so claims get trimmed.)
        if (period.swaps > 0 && period.claimsIn.length && r.chance(0.4)) return { type: 'waiverWindow', gameId: g.id, personId: by, swaps: r.chance(0.3) ? null : 0, replace: true };
        // (A run mostly once a claim is in, so runs move people; a claim for someone mostly once the sender has revealed the week's
        // episode, for a spot that can be claimed: a loss to replace, or a swap where the window has one.)
        const roll = r.int(0, 9), seen = snap.contexts[g.contextId].marks.find(m => m.personId === by)?.through ?? 0;
        if (roll < 4 && (period.claimsIn.length || r.chance(0.3))) return { type: 'waiverRun', gameId: g.id, personId: by };
        if (roll < 6) return r.chance(0.4) ? { type: 'waiverWindow', gameId: g.id, personId: by, swaps: null } : window();
        const whom = r.pick(W.rotation(st).concat(r.chance(0.05) ? ['nobody'] : [])) || 'nobody', mine = st.castaways.filter(c => c.ownerIds.includes(whom)), free = S.MidSeasonLogic.availableFor(st, st.players.some(p => p.id === whom) ? whom : st.players[0].id, 'replace').map(c => c.id);
        const drop = W.replacementsOwed(st, whom, period).lossIds[0] || (period.swaps > 0 ? mine.filter(c => c.status === 'active').map(c => c.id)[0] : null) || (r.chance(0.1) ? mine[0]?.id : null);
        if (drop && free.length && (seen >= period.episode || r.chance(0.15))) return { type: 'claim', gameId: g.id, personId: by, forId: whom, spot: { dropId: drop, addIds: shuffled(r, free).slice(0, r.int(1, 2)) } };
      }
    }
  }
  // Waivers (proof-family-44): in a week still open, someone owed a replacement (or allowed a swap) claims, ranked, a free agent for each
  // loss (sometimes someone on a team: invalid); after it processes, a free-agency move (a loss replaced, or a swap).
  // (proof-family-45: and in a window whoever runs a game opened by hand on one with no waivers of its own.)
  const waivering = document.games.filter(g => g.spec.extras?.waivers || snap.games[g.id].state.midSeason?.waivers?.periods?.some(p => p.phase !== 'closed'));
  // (A window opened by hand is a focus while it's open: people claim in it before it's run, swaps mostly.)
  const byHand = waivering.filter(g => snap.games[g.id].state.midSeason?.waivers?.periods?.some(p => p.phase === 'open' && p.openedBy === 'commissioner'));
  if (waivering.length && r.chance(byHand.length ? 0.6 : 0.35)) {
    const S = require('../../../src/lib/game/state-logic'), W = S.WaiverLogic, g = r.pick(byHand.length ? byHand : waivering), st = snap.games[g.id].state, period = W.current(st);
    if (period) {
      // (Mostly someone who has revealed the week's episode: before that, a claim is refused, as the route refuses it.)
      const ready = st.players.filter(p => (snap.contexts[g.contextId].marks.find(x => x.personId === p.id)?.through ?? 0) >= period.episode);
      const who = (ready.length && r.chance(0.85) ? r.pick(ready) : r.pick(st.players)).id, free = S.MidSeasonLogic.availableFor(st, who, 'replace').map(c => c.id), mine = st.castaways.filter(c => S.ownerListOf ? S.ownerListOf(c).includes(who) : c.ownerIds.includes(who));
      const owed = W.replacementsOwed(st, who, period), stillIn = mine.filter(c => c.status === 'active').map(c => c.id), taken = st.castaways.filter(c => c.ownerIds.length && !c.ownerIds.includes(who)).map(c => c.id);
      if (period.phase === 'open' && free.length) {
        const drops = [...owed.lossIds, ...(period.swaps > 0 && stillIn.length && r.chance(period.openedBy === 'commissioner' ? 0.85 : 0.4) ? [r.pick(stillIn)] : [])];
        const pairs = drops.flatMap(d => [...free].sort(() => r.int(-1, 1)).slice(0, r.int(1, 2)).map(a => ({ addId: a, dropId: d })));
        if (r.chance(0.12) && taken.length) pairs.push({ addId: r.pick(taken), dropId: drops[0] || r.pick(mine.map(c => c.id).concat('x')) });
        if (pairs.length || r.chance(0.2)) return { type: 'claim', gameId: g.id, personId: who, pairs };
      }
      if (period.phase === 'processed' && free.length && r.chance(0.6)) {
        const drop = owed.lossIds[0] || (stillIn.length ? r.pick(stillIn) : null);
        if (drop) return { type: 'freeAgency', gameId: g.id, personId: who, addId: r.chance(0.1) && taken.length ? r.pick(taken) : r.pick(free), dropId: drop };
      }
    }
  }
  // Group slots (proof-family-41): someone with groups on offer fills a slot that's empty or dropped (or any, with a swap), sometimes
  // emptying one or naming a group not on offer (invalid).
  const slotted = document.games.filter(g => g.spec.get?.groups);
  if (slotted.length && r.chance(0.5)) {
    const g = r.pick(slotted), open = snap.people.map(p => [p.id, project(g.id, p.id).game.twists]).filter(([, x]) => x?.offered?.groups?.length && x.slots?.length);
    const want = open.filter(([, x]) => g.spec.get.groups.swap || x.slots.some(s => s.status === 'empty' || s.status === 'dropped'));
    if (want.length) {
      const [p, x] = r.pick(want), s = r.pick(g.spec.get.groups.swap ? x.slots : x.slots.filter(s => s.status === 'empty' || s.status === 'dropped')), bad = r.chance(0.15);
      return { type: 'groupSlot', gameId: g.id, personId: p, eventId: x.offered.epId, slot: bad && r.chance(0.5) ? 2 : s.slot, groupId: bad ? 'not-a-group' : r.chance(0.1) ? null : r.pick(x.offered.groups).id };
    }
  }
  // A pool's second pick (proof-family-40): someone with an open pick makes their first, then their second beside it, so seconds are made.
  // (And a pool that skips a night you've used everyone still in, proof-family-42: people pick most nights, so some run out.)
  const seconded = document.games.filter(g => g.spec.get?.second || g.spec.get?.fallback === 'skip');
  if (seconded.length && r.chance(0.35)) {
    const g = r.pick(seconded), st = snap.games[g.id].state, open = snap.people.map(p => [p.id, project(g.id, p.id).game.pick]).filter(([, k]) => k && k.open !== false && (k.available || []).length > (g.spec.get.second ? 1 : 0));
    const fresh = open.filter(([p, k]) => !k.pick || (g.spec.get.second && !st.episodes.find(e => e.id === k.epId)?.picks?.find(x => x.playerId === p)?.second));
    if (fresh.length) { const [p, k] = r.pick(fresh); return k.pick ? { type: 'pick', gameId: g.id, personId: p, eventId: k.epId, ids: [r.pick(k.available.filter(id => id !== k.pick))], second: true } : { type: 'pick', gameId: g.id, personId: p, eventId: k.epId, ids: [r.pick(k.available)] }; }
  }
  // Weekly Calls (proof-family-28): someone calls an episode open to them (the next to air, or theirs at their own pace), one of its
  // two questions; 15% are invalid (someone not offered, or an episode that isn't open). Only a case with calls draws these.
  // Beat the bot (proof-family-32): the bot calls a window still open (its own call, from the options anyone could pick then).
  const versus = document.games.filter(g => (g.spec.ask || []).some(q => q.beat));
  if (versus.length && r.chance(0.25)) {
    const g = r.pick(versus), beats = new Set(g.spec.ask.filter(q => q.beat).map(q => q.id));
    const open = snap.people.flatMap(p => project(g.id, p.id).questions.filter(q => beats.has(q.id) && !q.closed));
    if (open.length) { const q = r.pick(open); return { type: 'botCall', gameId: g.id, question: q.id, episode: q.episode, answer: r.pick(q.options.map(o => o.id ?? o)) }; }
  }
  // The top scorer's twist (proof-family-35): whoever chooses the open episode's twist chooses one; sometimes someone else tries.
  const twisting = document.games.filter(g => g.spec.score?.twist);
  // (A chooser who hasn't chosen yet is a focus: their window closes 12 hours before the episode airs, which clock steps soon pass.)
  const waiting = twisting.some(g => snap.people.some(p => { const v = project(g.id, p.id).twist; return v?.next?.youChoose && !v.next.choice; }));
  if (twisting.length && r.chance(waiting ? 0.6 : 0.25)) {
    const g = r.pick(twisting), views = snap.people.map(p => [p.id, project(g.id, p.id).twist]).filter(([, v]) => v?.next);
    if (views.length) { const chooser = views.find(([, v]) => v.next.youChoose), [p] = chooser && !r.chance(0.15) ? chooser : r.pick(views); return { type: 'twist', gameId: g.id, personId: p, twist: r.pick(g.spec.score.twist.of).id }; }
  }
  const calling = document.games.find(g => g.spec.preset === 'weekly-calls');
  if (calling && r.chance(0.3)) {
    const p = r.pick(snap.people.map(x => x.id)), open = Object.values(project(calling.id, p).calls || {}).find(c => c && !c.refused && c.status === 'open' && c.questions.length);
    if (open) {
      const q = r.pick(open.questions), bad = r.chance(0.15);
      return { type: 'call', contextId: 'show', personId: p, episode: bad && r.chance(0.5) ? open.episode + 1 : open.episode, question: q.key, answer: bad ? 'nobody' : r.pick(q.options).key };
    }
  }
  // A stage's lineups (proof-family-46): a game in stages is made live, so someone behind has results to reveal before a stage takes
  // their lineup. Three steps in ten in a case with one: someone with a lineup open in a stage and nothing to reveal sets it (not yet
  // set, first; sometimes a starter too many: invalid); else someone a stage is waiting on reveals. Only such a case draws these.
  const staging = document.games.filter(g => g.stageOf !== undefined && g.spec.count?.start);
  if (staging.length && r.chance(0.3)) {
    const open = staging.flatMap(g => snap.people.map(p => ({ g, p: p.id, v: project(g.id, p.id).game }))).filter(x => x.v.lineup && !x.v.lineup.locked);
    const ready = open.filter(x => !x.v.revealFirst), fresh = ready.filter(x => !x.v.lineup.set), late = open.filter(x => x.v.revealFirst);
    if (ready.length && (fresh.length || r.chance(0.5))) {
      const x = r.pick(fresh.length ? fresh : ready), l = x.v.lineup, ids = shuffled(r, l.roster || []);
      return { type: 'lineup', gameId: x.g.id, personId: x.p, eventId: l.epId, ids: ids.slice(0, r.chance(0.1) ? l.slots + 1 : l.slots) };
    }
    if (late.length) return { type: 'reveal', contextId: 'show', personId: r.pick(late).p };
  }
  // (proof-family-46) While a later stage of a game in stages still waits for its draft, the walk airs and publishes more often, so
  // the merge (or the episode a stage ends with) comes and the stage after it is played. Only a case with one draws the extra number.
  const waitingStage = document.games.some(g => g.stageOf !== undefined && g.spec.extras?.draft?.opens === 'start' && !snap.games[g.id].state.castaways.some(c => c.ownerIds.length));
  const roll = waitingStage && r.chance(0.3) ? 0.15 + r.next() * 0.2 : r.next();
  if (roll < 0.15) return { type: 'reveal', contextId: 'show', personId: who };
  if (roll < 0.25) { const next = world.events.find(e => !['partial', 'final', 'corrected'].includes(e.resultStatus)); if (next) { const t = Date.parse(next.airAt) + 3600000; if (t > Date.parse(snap.clock)) return { type: 'clock', at: new Date(t).toISOString() }; } }
  if (roll < 0.35) {
    const unreleased = world.events.filter(e => !['partial', 'final', 'corrected'].includes(e.resultStatus)), next = unreleased[0];
    if (next && next.airAt && Date.parse(next.airAt) > Date.parse(snap.clock)) return { type: 'clock', at: new Date(Date.parse(next.airAt) + 3600000).toISOString() };
    if (next) {
      const gone = new Set(world.facts.flatMap(f => (f.data.events || []).map(e => e.castawayId))), still = world.participants.filter(p => !gone.has(p.id));
      // With a bounty in the case, who voted for whom at each vote-out (research's, runtime-data.cjs voteFacts).
      const voted = (events) => { const votes = bounties(document) ? voteFacts(SURVIVOR, still.map(p => p.id), events, () => r.int(0, 1e6)) : undefined; return votes ? { votes } : {}; };
      if (still.length > 2 && unreleased.length === 1) { const events = outcome(SURVIVOR, still.map(p => p.id), () => r.int(0, 1e6), true); return { type: 'results', contextId: 'show', eventId: next.id, source: 'provider-fixture', resultStatus: 'final', data: { events, scoringEvents: [], ...voted(events) } }; }
      // Results that often follow the couch's answers (the boot someone guessed, the idol finder someone named), so right answers,
      // shared pots and sole winners happen; otherwise anyone still in.
      const said = id => Object.values(snap.stores.answers || {}).flat().filter(x => x.question === id && x.episode === next.number && typeof x.answer === 'string' && still.some(p => p.id === x.answer)).map(x => x.answer);
      // (And who someone called to go home: proof-family-28's calls, the boot's guesses beside the answers'.)
      const calledOut = (snap.stores.calls?.show || []).filter(c => c.episode === next.number && c.question === 'out' && still.some(p => p.id === c.answer)).map(c => c.answer), guessed = [...said('boot'), ...calledOut, ...Object.values(snap.stores.answers || {}).flat().filter(x => x.question === 'sure' && x.episode === next.number && Array.isArray(x.answer) && still.some(p => p.id === x.answer[0])).map(x => x.answer[0])];
      // In a case with a pool that skips (proof-family-42), usually someone the first seat hasn't picked goes home, so they run out.
      const skipper = document.games.find(g => g.spec.get?.fallback === 'skip'), usedBy = skipper ? new Set(snap.games[skipper.id].state.episodes.flatMap(e => (e.picks || []).filter(x => x.playerId === snap.people[0].id).map(x => x.castawayId))) : null, unused = usedBy ? still.filter(p => !usedBy.has(p.id)) : [];
      const boot = unused.length && r.chance(0.7) ? r.pick(unused).id : guessed.length && r.chance(0.6) ? r.pick(guessed) : r.pick(still).id, idol = said('idol').length && r.chance(0.5) ? [{ id: 'i-' + next.number + '-' + r.int(1, 1e6), type: 'idolFound', castawayId: r.pick(said('idol')) }] : [];
      // A moment someone said yes to (a yes/no question on whether it happens) often happens (proof-family-23), so a yes can be right
      // and parlays pay. Only an episode with a yes draws these numbers.
      const yes = [...new Set([...(snap.stores.calls?.show || []).filter(c => c.episode === next.number && c.question.startsWith('m:') && c.answer === 'yes').map(c => c.question.slice(2)), ...document.games.flatMap(g => (g.spec.ask || []).filter(q => q.answer === 'yesNo' && q.settle?.by === 'moment' && q.settle.take === 'happened' && (snap.stores.answers?.[g.id] || []).some(x => x.question === q.id && x.episode === next.number && x.answer === 'yes')).map(q => q.settle.moment))])];
      const happened = yes.filter(() => r.chance(0.5)).map(type => ({ id: 'h-' + next.number + '-' + r.int(1, 1e6), type, castawayId: r.pick(still).id }));
      // An idol to someone the couch picked before the start (proof-family-27), sometimes. Only a case with such picks draws these.
      const picked = Object.values(snap.stores.answers || {}).flat().filter(x => x.question === 'idols' && x.episode === 0).flatMap(x => [x.answer].flat()).filter(id => still.some(p => p.id === id));
      // One of that week's card moments for someone picked (proof-family-31), half the time. Only a case with a card draws these.
      for (const g of document.games.filter(g => g.spec.card)) {
        const Spec = require('../../../src/lib/game/game-spec'), S = require('../../../src/lib/game/state-logic'), st = snap.games[g.id].state, ep = st.episodes.find(e => e.number === next.number);
        const chosen = ep ? [...new Set(st.players.flatMap(p => S.PickEmLogic.picked(S.pickEmPickFor(st, ep.id, p.id))))].filter(id => still.some(p => p.id === id)) : [];
        if (chosen.length && r.chance(0.5)) happened.push({ id: 'c-' + next.number + '-' + r.int(1, 1e6), type: r.pick(Spec.cardLines(Spec.cardOf(Spec.fullSpec(g.spec)), next.number, null)), castawayId: r.pick(chosen) });
      }
      // An episode with a twist (proof-family-35): one of someone's starters or picks has a moment in it, so the twist changes points.
      for (const g of document.games.filter(g => g.spec.score?.twist)) {
        const S = require('../../../src/lib/game/state-logic'), st = snap.games[g.id].state, ep = st.episodes.find(e => e.number === next.number);
        if (!ep?.twist?.id) continue;
        const held = [...new Set(st.players.flatMap(p => g.spec.get.by === 'pick' ? S.PickEmLogic.picked(S.pickEmPickFor(st, ep.id, p.id)) : S.ActiveRosterLogic.lineupFor(st, ep.id, p.id)))].filter(id => still.some(x => x.id === id));
        if (held.length) happened.push({ id: 't-' + next.number + '-' + r.int(1, 1e6), type: r.pick(['individualImmunity', 'rewardWin', 'idolFound']), castawayId: r.pick(held) });
      }
      // A slot's pair (proof-family-41): one of its people has a moment that counts in its game, so slots score.
      for (const g of document.games.filter(g => g.spec.get?.groups)) {
        const st = snap.games[g.id].state, people = [...new Set(st.episodes.filter(e => e.number <= next.number).flatMap(e => Object.values(e.groupSlots || {}).flatMap(p => Object.values(p).filter(Boolean).flatMap(x => x.members))))].filter(id => still.some(x => x.id === id));
        const types = Array.isArray(g.spec.score.only) ? g.spec.score.only : ['individualImmunity', 'rewardWin', 'idolFound'];
        if (people.length && r.chance(0.6)) happened.push({ id: 'g-' + next.number + '-' + r.int(1, 1e6), type: r.pick(types), castawayId: r.pick(people) });
      }
      if (picked.length && r.chance(0.3)) happened.push({ id: 'f-' + next.number + '-' + r.int(1, 1e6), type: 'idolFound', castawayId: r.pick(picked) });
      // A night two go home (proof-family-40), sometimes, in a case with a pool's second pick (the night it counts).
      const out = [{ castawayId: boot, method: 'Voted Out' }], also = still.filter(p => p.id !== boot);
      if (document.games.some(g => g.spec.get?.second) && still.length > 4 && r.chance(0.5)) out.push({ castawayId: r.pick(also).id, method: 'Voted Out' });
      if (still.length > 2 && unreleased.length >= 2) return { type: 'results', contextId: 'show', eventId: next.id, source: 'provider-fixture', resultStatus: r.pick(['partial', 'final']), data: { events: out, scoringEvents: [{ id: 'm-' + next.number + '-' + r.int(1, 1e6), type: r.pick(['rewardWin', 'individualImmunity', 'satOut']), castawayId: r.pick(still).id }, ...idol, ...happened].filter(once()), ...voted(out) } };
    }
  }
  // Side bets, where a game has them on: post one, guess (unique words, so the privacy check can find them), take a guess
  // back, or grade as the commissioner (or, invalidly, as someone else).
  const betting = document.games.filter(g => g.spec.extras?.bets);
  if (betting.length && roll < 0.55) {
    const g = r.pick(betting), st = snap.games[g.id].state, now = Date.parse(snap.clock), open = e => !(e.airsAt && Date.parse(e.airsAt) <= now) && !(e.events || []).length && !(e.scoringEvents || []).length;
    const bets = st.episodes.flatMap(e => (e.bets || []).map(b => ({ e, b })));
    const pick = r.next();
    if (pick < 0.3 || !bets.length) { const e = st.episodes.find(open) || r.pick(st.episodes); return { type: 'bet', gameId: g.id, personId: who, eventId: e.id, label: 'Will something happen? ' + r.int(1, 99999), points: r.int(1, 3) }; }
    const { e, b } = r.pick(bets);
    if (pick < 0.7) return { type: 'guess', gameId: g.id, personId: who, eventId: e.id, betId: b.id, guess: 'guess-' + r.int(100000, 999999) };
    const q = (b.predictions || [])[0];
    if (!q) return { type: 'guess', gameId: g.id, personId: who, eventId: e.id, betId: b.id, guess: 'guess-' + r.int(100000, 999999) };
    if (pick < 0.8) return { type: 'unguess', gameId: g.id, personId: q.playerId, eventId: e.id, betId: b.id, predId: q.id };
    return { type: 'grade', gameId: g.id, personId: r.chance(0.8) ? st.players[0].id : who, eventId: e.id, betId: b.id, predId: q.id, value: r.pick([true, false, null]) };
  }
  // (A game in stages itself takes no move: its stages, games of their own in the definition, do.)
  const playable = document.games.some(g => g.stageOf !== undefined) ? document.games.filter(g => !g.spec.stages) : document.games;
  const game = r.pick(playable), view = project(game.id, who), invalid = r.chance(0.2);
  if (view.game.lineup) {
    const l = view.game.lineup, ids = (l.roster || []).slice(); for (let i = ids.length - 1; i > 0; i--) { const j = r.int(0, i); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const chosen = invalid ? (r.chance(0.5) ? ids.slice(0, l.slots + 1) : ['missing-participant']) : ids.slice(0, l.slots);
    // With a captain (proof-family-36): one of the starters most of the time, sometimes none, and (invalid) someone on the bench.
    const captain = game.spec.score?.captain ? { captainId: invalid && r.chance(0.5) ? (ids[l.slots] ?? null) : r.chance(0.8) ? r.pick(chosen) : null } : {};
    return { type: 'lineup', gameId: game.id, personId: who, eventId: l.epId, ids: chosen, ...captain };
  }
  if (view.game.pick) {
    const pk = view.game.pick, avail = (pk.available || []).slice(), each = view.game.pick.of || 1;
    // A pool's second pick (proof-family-40), beside a first already made, half the time; invalid: the first's own castaway.
    if (game.spec.get?.second && pk.pick && r.chance(0.5)) { const other = avail.filter(id => id !== pk.pick); if (other.length) return { type: 'pick', gameId: game.id, personId: who, eventId: pk.epId, ids: [invalid ? pk.pick : r.pick(other)], second: true }; }
    return { type: 'pick', gameId: game.id, personId: who, eventId: pk.epId, ids: invalid ? [avail[0], avail[0]].filter(Boolean) : avail.slice(0, Math.max(1, Math.min(each, r.int(1, 3)))) };
  }
  const open = view.questions.filter(q => !q.closed);
  if (open.length) { const q = r.pick(open); return { type: 'answer', gameId: game.id, personId: who, question: q.id, episode: invalid ? q.episode + 1 : q.episode, answer: wagered(r, q, invalid ? 'maybe' : q.pick > 1 ? options(r, q) : r.pick(q.options.map(o => o.id ?? o)), invalid) }; }
  return { type: 'reveal', contextId: 'show', personId: who };
}
// With a wager, { answer, stake }: 0 to what the sheet allows (stakeMost, else the wager); invalid sometimes stakes one more.
function wagered(r, q, answer, invalid) { if (q.wager === null || q.wager === undefined) return answer; const cap = q.stakeMost ?? (typeof q.wager === 'number' ? q.wager : 0); return { answer, stake: invalid && r.chance(0.5) ? cap + 1 : r.int(0, cap) }; }
// One moment for one person once an episode (the season_decisions identity: a repeat is a count, not a second row). Draws nothing.
function once() { const seen = new Set(); return m => { const k = m.type + '|' + m.castawayId; if (seen.has(k)) return false; seen.add(k); return true; }; }
// A seeded Fisher-Yates shuffle (a random sort comparator isn't stable across engines).
function shuffled(r, list) { const ids = list.slice(); for (let i = ids.length - 1; i > 0; i--) { const j = r.int(0, i); [ids[i], ids[j]] = [ids[j], ids[i]]; } return ids; }
// `q.pick` distinct cast members, for a question that takes several (the final three).
function options(r, q) { const ids = q.options.map(o => o.id); for (let i = ids.length - 1; i > 0; i--) { const j = r.int(0, i); [ids[i], ids[j]] = [ids[j], ids[i]]; } return ids.slice(0, q.pick); }
module.exports = { VERSION, rng, caseSeed, caseId, definition, nextAction };
