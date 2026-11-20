// Explicitly bounded first runtime profile. Unknown mechanics remain gaps, even if the engine accepts them.
const G = require('../../../src/lib/game/game-spec'), F = require('../../../src/lib/game/formats');
const J = require('./json.cjs');
const active = value => value !== null && value !== undefined && value !== false && !(Array.isArray(value) && !value.length) && !(J.object(value) && !Object.keys(value).length);
const defaults = G.fullSpec({ preset: 'weekly-lineup' }).extras;
function inspect(document) {
  const gaps = [], notes = [];
  const add = (gameId, path, reason) => gaps.push({ gameId, path, reason });
  const knownContent = ['labels', 'images', 'completedEvents', 'eventCount'];
  for (const key of Object.keys(document.content)) if (!knownContent.includes(key)) add(null, '/content/' + J.pointer(key), 'Content profile adapter not implemented');
  if (!['normal', 'long', 'unbroken', 'shared'].includes(document.content.labels || 'normal')) add(null, '/content/labels', 'Unknown label profile');
  if (!['real', 'missing'].includes(document.content.images || 'real')) add(null, '/content/images', 'Unknown image profile');
  if (Object.keys(document.transport).length) add(null, '/transport', 'Transport fault injection is not connected yet');
  if (!['unspecified', 'due', 'saved', 'locked', 'catchup'].includes(document.situation.lifecycle)) add(null, '/situation/lifecycle', 'Lifecycle adapter not connected');
  for (const key of Object.keys(document.setup.stores)) if (!['answers', 'calls', 'bot'].includes(key)) add(null, '/setup/stores/' + J.pointer(key), 'External store adapter not implemented');
  if (document.world.media.length) add(null, '/world/media', 'Media binding adapter not implemented');
  if (document.history.snapshotAt === 'head' && document.history.entries.length) add(null, '/history', 'Head history requires snapshot reconciliation; setup histories can be replayed');
  if (document.history.checkpoints.length) add(null, '/history/checkpoints', 'Resume named checkpoints from an execution bundle, not an unverified scenario history');
  for (const [i, event] of document.world.events.entries()) if (['postponed', 'cancelled'].includes(event.resultStatus)) add(null, '/world/events/' + i, 'Schedule disruption adapter not implemented');
  document.games.forEach((game, i) => {
    // A stage's own game (stages.cjs: derived from its parent's spec) reports its gaps at its stage in the parent's spec.
    const parentIndex = game.stageOf !== undefined ? document.games.findIndex(g => g.id === game.stageOf) : -1, stageIndex = parentIndex < 0 ? -1 : (G.fullSpec(document.games[parentIndex].spec).stages || []).findIndex(st => st.id === game.stageKey);
    const p = stageIndex >= 0 ? '/games/' + parentIndex + '/spec/stages/' + stageIndex + '/game' : '/games/' + i + '/spec', spec = G.fullSpec(game.spec), context = document.world.contexts.find(c => c.id === game.contextId);
    const snapshot = document.setup.gameStates[game.id];
    // V1 stores contain effective settings that can differ from the exported recipe. Preserve them
    // in the legacy pilot; never silently reconcile them into a newly generated shared world.
    if (snapshot) { add(game.id, '/setup/gameStates/' + J.pointer(game.id), 'Head snapshot reconciliation is not connected; the existing v1 pilot remains available'); return; }
    if (Object.keys(game.contextOverrides).length) add(game.id, '/games/' + i + '/contextOverrides', 'Per-game context overrides need shared-fact reconciliation');
    // A game in stages (core-runtime-27, stages.cjs): each stage a game of its own beside it (checked below as any game, and as a
    // stage), its table the overall by points from their tables. Stages that start at an episode or a phase on its own season; made
    // live, as the engine lab (its only door) makes one.
    if (spec.stages) {
      if (game.timing !== 'live-only') add(game.id, '/games/' + i + '/timing', 'A game in stages is made live (the engine lab is its only door): own pace in stages has no product path yet');
      spec.stages.forEach((st, k) => {
        const at = p + '/stages/' + k;
        if (G.stageOn(st)) add(game.id, at + '/on', 'A stage a format change starts needs the format timeline and its copies (change-stages.ts)');
        if (G.stageSide(st)) add(game.id, at + '/side', 'A side stage needs the format timeline and its copies');
        if (G.stageAlongside(st)) add(game.id, at + '/alongside', "A stage alongside the game's own (bingo with trivia) needs its own stores");
        if (G.stageSeason(st)) add(game.id, at + '/season', 'A stage on another season needs a second world context bound to it');
      });
      if (J.canonical(spec.overall) !== J.canonical({ by: 'points' })) add(game.id, p + '/overall', 'Only an overall by points is connected (by places or stages won needs its own proof)');
      for (const [key, value] of Object.entries(spec.extras || {})) if (active(value)) add(game.id, p + '/extras/' + J.pointer(key), 'Nondefault modifier needs an explicit adapter');
      return;
    }
    // A stage's own game: a plain Weekly Lineup or Outlast (the specimens' shapes), each side of an episode or a phase, drafted in a
    // snake or in private, its waivers a window opened by hand at most (replace 'never', a manual schedule). A rider on a stage (a
    // bounty, a captain, a hat, an auction, waivers after every loss...) plays as it does alone, but needs its own proof before it's
    // called connected. Head to head on a Weekly Lineup's stage (core-runtime-42: the design round's staged pilot, no specimen has
    // one) is: each stage's own schedule, record and playoffs, inside its own span, its odd one out and quiet nights as alone; best
    // ball or Outlast head to head on a stage is still a gap.
    if (stageIndex >= 0) {
      const plain = { get: ['by', 'each', 'own', 'order'], count: ['start', 'best', 'all'], score: ['by', 'points'], rank: ['by', 'odd', 'quiet', 'playoffs'] };
      const w = spec.extras?.waivers, byHand = !active(w) || (J.object(w) && w.replace === 'never' && w.windows?.schedule === 'manual');
      const h2h = spec.rank?.by === 'matchups' && J.object(spec.count) && spec.count.start !== undefined && spec.score?.by === 'moments';
      if (spec.rank?.by === 'matchups' && !h2h) add(game.id, p + '/rank/by', 'Head to head on a stage is connected for a Weekly Lineup (start N, scored by moments); best ball or Outlast head to head on a stage needs its own proof');
      else
      if (spec.get?.by !== 'draft' || !['snake', 'blind'].includes(spec.get?.order) || !byHand || !['moments', 'place'].includes(spec.score?.by) || !(spec.rank?.by === 'total' || h2h) || (spec.rank?.by === 'total' && ['odd', 'quiet', 'playoffs'].some(k => active(spec.rank[k]))) || (spec.ask || []).length || Object.entries(plain).some(([section, keys]) => Object.entries(spec[section] || {}).some(([k, v]) => !keys.includes(k) && active(v))) || Object.entries(spec.extras || {}).some(([k, v]) => active(v) && !['bets', 'waivers', 'draft', 'hideStarters'].includes(k)))
        add(game.id, p, "Only a plain Weekly Lineup or Outlast is connected as a stage (the specimens' shapes); a rider on a stage needs its own proof");
    }
    if (!['draft', 'pick', 'none'].includes(spec.get?.by)) add(game.id, p + '/get/by', 'Acquisition adapter not implemented');
    // A sport context (runtime-sports.cjs, core-runtime-30): its results are box scores, so only a game scored by its stats plays
    // on one, and such a game only there. First slice: a drafted team, plain points for each stat (no points by position, place or
    // a match's format; no categories), ranked by total. Its lock at the start is the check below.
    const sport = context.kind === 'sport', stats = spec.score?.by === 'stats';
    if (stats && !sport) add(game.id, p + '/score/by', "A game scored by a sport's stats needs a sport context (kind 'sport': runtime-sports.cjs)");
    else if (sport && !stats) add(game.id, p + '/score/by', "Only a game scored by the sport's stats is connected on a sport context");
    else if (!stats && !['moments', 'survive', 'place', 'answers'].includes(spec.score?.by)) add(game.id, p + '/score/by', 'Generated result adapter not implemented for this scoring basis');
    if (sport && stats) {
      if (spec.get?.by !== 'draft') add(game.id, p + '/get/by', "Only a drafted team is connected for a game scored by a sport's stats");
      // (Categories, the third slice: score.categories, a list of the sport's stats, ranked head to head by each category, by most
      // categories, 'matchups', or across everyone, 'roto'. A total needs points; categories need none.)
      const cats = Array.isArray(spec.score?.categories) && spec.score.categories.length > 0;
      if (!(cats ? ['categories', 'matchups', 'roto'] : ['total', 'matchups']).includes(spec.rank?.by)) add(game.id, p + '/rank/by', cats ? "A game of a sport's categories is ranked by each category ('categories'), by most of them ('matchups') or across everyone ('roto')" : "Only a game scored by a sport's stats ranked by total or head to head is connected");
      if (spec.score?.categories !== undefined && !cats) add(game.id, p + '/score/categories', "A sport's categories are a list of its stats");
      // (Points by place, core-runtime-36: a place's points by place or range, golf's and racing's POS, F1's SPR and QUAL; a field's
      // results carry its standings. A place is a field's: on a team sport or a card there is none to score.)
      // (Points by position, core-runtime-37: a stat's points by the holder's position group, FPL's; every sport's athletes have one.)
      // (Points by a match's format, core-runtime-38: a card's matches, each scored at its best of: tennis's.)
      if (spec.score?.byFormat !== undefined && context.engine?.shape !== 'card') add(game.id, p + '/score/byFormat', "Points by a match's format need a card's matches (tennis)");
      if (spec.score?.byPlace !== undefined && context.engine?.shape !== 'field') add(game.id, p + '/score/byPlace', "Points by place need a field's standings (golf, racing)");
      if ((spec.ask || []).length) add(game.id, p + '/ask', "A sport's questions (settled by a game's final or a stat) are not connected");
      if (typeof context.key !== 'string' || !context.key) add(game.id, '/world/contexts/' + document.world.contexts.indexOf(context) + '/key', "A sport context names its league (key: 'football/nfl')");
    }
    // Only some moments count (score.only, a fixed list) and hits counted (score.hits): each moment's worth on every read
    // (Spec.momentWorth), nothing kept. The weekly card (spec.card, drawn in turn from the spec's own list: Spec.cardLines, pure)
    // and only its moments counting each week (only: 'card', Spec.onlyAt). A card the bot chooses or a host writes needs their choice.
    // (A card the bot chooses or a host writes, on a world whose results carry the server's own facts, a live preview's: its choice
    // made up from the card's own list each episode, stamped as the server stamps it: runtime.cjs stampAllCards, core-runtime-45.)
    const drawnCard = !!spec.card && (G.cardOf(spec)?.from === 'moments' || (!!context.bank && G.chosenCard(G.cardOf(spec)) && Array.isArray(G.cardOf(spec)?.of)));
    if (spec.card && !drawnCard) add(game.id, p + '/card', "Only a card drawn from the spec's own list is connected; one the bot chooses or a host writes needs their choice");
    if (spec.score?.only !== undefined && !Array.isArray(spec.score.only) && !(spec.score.only === 'card' && drawnCard)) add(game.id, p + '/score/only', "Only a fixed list of moments, or a drawn card's, is connected");
    // A race to N and cuts (the guillotine): KnockoutLogic and the answer walk work them out on every read; moves after someone's out
    // or the game ended are refused by the production setters (validateLineup's moveProblem) and the answer action's limits.
    // Weeks won (WeekLogic) is worked out on every read from the same series and seats as head to head: nothing kept to settle.
    // Lives (score.lives, livesOn) and co-op (rank.by 'coop', score.saves): the answer walk works them out on every read; answers
    // after you're out or the game ended are refused as the server refuses them.
    if (!['total', 'streak', 'standing', 'matchups', 'weeks', 'coop'].includes(spec.rank?.by) && !(sport && stats && ['categories', 'roto'].includes(spec.rank?.by))) add(game.id, p + '/rank/by', 'Ranking fixture adapter not implemented');
    // Head to head: its odd one out, quiet nights and playoffs placed by the season's length or a fixed episode (settleWrite).
    if (spec.rank?.playoffs && Object.keys(spec.rank.playoffs).some(k => !['teams', 'from'].includes(k))) add(game.id, p + '/rank/playoffs', 'Playoff rider needs an explicit adapter');
    const allowed = {
      span: ['from', 'to'], pool: ['of', 'where'], get: ['by', 'each', 'own', 'order', 'repeat', 'fallback', 'across', 'second', 'groups', 'budget'],
      // Parlays (score.parlays: every leg right in a window multiplies their points): graded on every read (AnswerLogic.grade).
      // A survival pool's buyback and mulligans (score.buyback, score.mulligans): automatic, the pool's walk on every read.
      // Secret roles (score.roles): dealt from a seed of the game's id once due, stamped as secret-roles.ts stamps them.
      // A captain (score.captain): one of your starters named with the lineup, whose points multiply (captainId on the lineup action).
      // The top scorer's twist (score.twist): its choices per episode, the twist action, stamped as twists.ts stamps them.
      // Outlast in reverse (score.reverse: each holding worth the cast's size + 1 less its place): EliminationOrderScoringStrategy.
      // Multipliers (score.times: an episode's or the finale's points times N): ActiveRosterLogic.timesFor on every read.
      count: ['start', 'best', 'all', 'pick', 'slots'], score: ['by', 'points', 'means', 'only', 'hits', 'lives', 'livesOn', 'saves', 'bank', 'bounty', 'parlays', 'times', 'reverse', 'twist', 'captain', 'roles', 'buyback', 'mulligans', 'multiply', ...(sport && stats ? ['categories', 'byPlace', 'byPosition', 'byFormat'] : [])], rank: ['by', 'odd', 'quiet', 'playoffs', 'ties', 'race', 'cut', 'teams'],
    };
    // A pool's second pick (get.second): the pick action's second: true; it counts on a night two or more go home (or every night: counts).
    // A draft spread across the cast's groups (get.across, of 'group'): the generated draft spread as SpreadLogic requires, on a world
    // with tribes (context.tribes). The spread at draft time is the draft room's (the runtime starts after the draft); pickups need waivers.
    // Group slots (get.groups): on a world whose show forms pairs (context.pairs), the slots settled from them as the server does.
    if (spec.get?.groups && !context.pairs) add(game.id, p + '/get/groups', 'Group slots need a world whose show forms pairs (context.pairs)');
    if (spec.get?.across && (spec.get.across.of !== 'group' || !context.tribes)) add(game.id, p + '/get/across', spec.get.across.of !== 'group' ? 'Only a spread across groups is connected' : 'A draft spread across tribes needs a world with tribes (context.tribes)');
    // Only an episode's window and the finale's are connected (every specimen's); a run of episodes or a phase need their own case.
    if (Array.isArray(spec.score?.times) && spec.score.times.some(w => !J.object(w) || Object.keys(w).some(k => !['times', 'episode', 'finale'].includes(k)))) add(game.id, p + '/score/times', 'Only an episode window or the finale is connected; a run of episodes or a phase needs its own adapter');
    {
      for (const [section, keys] of Object.entries(allowed)) for (const [key, value] of Object.entries(spec[section] || {})) if (!keys.includes(key) && active(value)) add(game.id, p + '/' + section + '/' + J.pointer(key), 'Mechanic needs an explicit fixture adapter');
      for (const key of Object.keys(spec)) if (!['spec', 'preset', 'span', 'pool', 'get', 'count', 'score', 'rank', 'ask', 'closes', 'extras', 'card'].includes(key) && active(spec[key])) add(game.id, p + '/' + J.pointer(key), 'Unconsumed spec feature');
      // Spans from or to a phase ({ phase }): placed from the world's phase starts as the server settles them (runtime-data.cjs settlePhasesIn).
      for (const end of ['from', 'to']) if (J.object(spec.span[end]) && (Object.keys(spec.span[end]).some(k => k !== 'phase') || !(context.engine.phases || []).some((x, i) => i > 0 && x.id === spec.span[end].phase))) add(game.id, p + '/span/' + end, "Only a span from or to one of the context's later phases is connected");
      // (A sport's game scored by stats also locks by the day or the week: runtime-sports.cjs lockTimes, core-runtime-34.)
      // (And at each game's start, core-runtime-39: a slate's lineup, each holding locking with its own team's game: closes 'game'.)
      const slateWorld = sport && context.slate !== undefined;
      if (spec.closes !== 'start' && !(sport && stats && ['daily', 'weekly'].includes(spec.closes)) && !(sport && stats && spec.closes === 'game' && slateWorld)) add(game.id, p + '/closes', spec.closes === 'game' && sport && stats ? "A lock at each game's start needs a week of several games: a slate (context.slate)" : "Only start-based locks are connected in this runtime profile (and a sport's by the day, the week or each game's start)");
      if (spec.pool?.where && Object.keys(spec.pool.where).some(k => k !== 'stillIn')) add(game.id, p + '/pool/where', 'Pool filter requires an eligibility fixture adapter');
      // The runtime starts after the draft; a draw is recorded as drawn (runtime-data.cjs).
      // An auction (order 'auction'): its sealed bids generated and settled at setup (runtime-data.cjs settleAuctionIn), its budget the
      // auction's own (total, the lowest price, fill or short); a salary cap or a stock market (prices from the data, trading) is another.
      if (spec.get?.order && !['blind', 'snake', 'draw', 'auction'].includes(spec.get.order)) add(game.id, p + '/get/order', 'Acquisition method requires its own setup adapter');
      if (spec.get?.budget && (spec.get.order !== 'auction' || Object.keys(spec.get.budget).some(k => !['total', 'floor', 'fallback'].includes(k)))) add(game.id, p + '/get/budget', 'Only an auction\'s budget (total, floor, fallback) is connected; a salary cap or a stock market needs prices from the data');
      for (const [key, value] of Object.entries(spec.extras || {})) {
        if (!active(value)) continue;
        if (key === 'hideStarters') continue;
        if (key === 'bets' && J.object(value) && Object.keys(value).every(k => k === 'points')) continue; // side bets: bet, guess, unguess, grade actions (runtime sideBet)
        // Mid-season waivers: claims and free agency (the claim and freeAgency actions), the waiver clock synced on every action as the
        // server syncs it (runtime-waivers.cjs), and what whoever runs the game does (waiverWindow, waiverRun, waiverUndo, a claim sent for
        // someone): a manual window opens when they open it. Changing how waivers work mid-game (Backstage's feel and Fine-tune) isn't an
        // action.
        if (key === 'waivers') continue;
        if (['waivers', 'draft'].includes(key) && J.canonical(value) === J.canonical(defaults[key])) continue;
        // A stage's draft that opens at its start (the draft room's opens 'start', a later stage's by default): a snake or a private
        // draft, made as it opens from who's still in (stages.cjs draftAtStart).
        if (key === 'draft' && stageIndex >= 0 && J.object(value) && value.opens === 'start' && ['snake', 'blind'].includes(spec.get?.order) && J.canonical(Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'opens'))) === J.canonical(defaults.draft)) continue;
        add(game.id, p + '/extras/' + J.pointer(key), 'Nondefault modifier needs an explicit adapter');
      }
    }
    // Teams of players drawn at random (rank.teams, made 'draw'): seeded from the game's id and kept once the game starts, as the
    // server keeps them on every write (runtime-data.cjs settleWrite). Teams each seat chooses need a choice action (the player-teams route).
    if (spec.rank?.teams !== undefined && (G.teamParts?.(spec) || null)?.made !== 'draw') add(game.id, p + '/rank/teams', 'Only teams drawn at random are connected; chosen teams need the choice action');
    // A bounty (score.bounty): points that move between seats when one of yours votes out one of theirs, read from who voted for
    // whom (the world's votes, as research's answer: runtime-data.cjs researchOf), stamped as the server stamps it on every read.
    if (spec.score?.bounty !== undefined && !G.bountyOf(spec)) add(game.id, p + '/score/bounty', 'A bounty needs a draft scored by moments or place');
    if (!context.format || !F.isBuiltInFormat(context.format.id) || Object.keys(context.format).some(k => k !== 'id')) add(game.id, '/world/contexts/' + document.world.contexts.indexOf(context) + '/format', 'Provide an explicit built-in format; custom rulebook generation is not connected');
    // A pool that never repeats skips a night you've picked everyone still in (get.fallback 'skip'): automatic, the pool's walk.
    if (spec.get?.fallback && spec.get.fallback !== 'miss' && !(spec.get.fallback === 'skip' && spec.get.by === 'pick' && spec.get.repeat === 'never')) add(game.id, p + '/get/fallback', 'Fallback acquisition fixture adapter not implemented');
    // Weekly Calls (the show's calls, its one question: runtime-calls.cjs): a person's calls on the context, settled by the season's
    // results. A talk show's (settled by the couch's says) isn't connected.
    const weeklyCalls = G.callsAsk(spec.ask);
    if (weeklyCalls && context.format && F.isBuiltInFormat(context.format.id) && require('../../../src/lib/game/formats/blocks/index.js').rulebookFor(context.format.id).blocks.kind === 'talk') add(game.id, p + '/ask/0', "A talk show's calls (settled by the couch's says) are not connected");
    if (!weeklyCalls) for (const [index, q] of (spec.ask || []).entries()) {
      const at = p + '/ask/' + index;
      // Per-episode cast/yes-no questions locking at the start, and (season-long) person questions asked once for the whole
      // game, locking at its start or at the finale and settled by the season's results: who wins, who makes the final N.
      const seasonLong = q.asked === 'once' && q.answer === 'person' && ['start', 'finale'].includes(q.closes) && q.settle?.by === 'results' && ['winner', 'top'].includes(q.settle?.take);
      // When a phase starts ("When does the merge start?"): a number, asked once, settled by the phase's start.
      const phaseStart = q.asked === 'once' && q.answer === 'number' && q.settle?.by === 'phase' && q.settle?.take === 'starts';
      // A moment over the whole game, asked once and locked at its start: who it happens to (a person), whether it happens at all
      // (yes/no), who it happens to first (a person), how many times (a number). Settled from the results' moments, as each episode's.
      // Confidence picks (who goes home, ranked surest first: each right one scores its points times its weight), each episode.
      const confidence = q.answer === 'confidence' && q.asked === 'each' && q.closes === 'start' && q.settle?.by === 'results' && q.settle?.take === 'out';
      const momentOnce = q.asked === 'once' && q.closes === 'start' && q.settle?.by === 'moment' && ({ who: 'person', first: 'person', happened: 'yesNo', count: 'number' })[q.settle?.take] === q.answer;
      // A live preview's (core-runtime-45, 2026-11-20): the boot order (a ranked order of the cast, settled by where they finished,
      // within N places), who outlasts whom (pairs from who was in at the start), the jury's vote split, over or under a line on a
      // moment's count, who a moment happens to most, a choice; each the server's answer kinds, checked and graded as answers.ts
      // and the grader do. And, on a world whose results carry the server's own facts (context.bank: the trivia round written after
      // each episode, research's episode facts), a trivia round and who says the title quote.
      const bank = !!context.bank;
      const preview = (['order', 'pairs', 'split'].includes(q.answer) && q.settle?.by === 'results' && ({ order: 'order', pairs: 'outlast', split: 'split' })[q.answer] === q.settle?.take)
        || (q.answer === 'overUnder' && q.settle?.by === 'moment' && q.settle?.take === 'count' && typeof q.line === 'number')
        || (q.answer === 'person' && q.settle?.by === 'moment' && q.settle?.take === 'most')
        || (q.answer === 'person' && q.settle?.by === 'results' && ['winner', 'out', 'top'].includes(q.settle?.take))
        || (q.answer === 'choice' && Array.isArray(q.options))
        || (q.answer === 'ticket' && q.settle?.by === 'legs' && !!G.ticketOf(q))
        || (drawnCard && q.card === true && ['yesNo', 'person'].includes(q.answer) && q.settle?.by === 'moment')
        || (bank && G.isTrivia(q))
        || (bank && q.answer === 'person' && q.settle?.by === 'fact');
      if (!seasonLong && !phaseStart && !momentOnce && !confidence && !preview && (!['person', 'yesNo'].includes(q.answer) || q.asked !== 'each' || q.closes !== 'start')) add(game.id, at, 'Only per-event cast/yes-no questions, season-long winner/final-N, phase-start, whole-game moment and confidence questions are connected');
      if (q.from !== undefined && q.from !== 'cast') add(game.id, at + '/from', 'Only questions about the cast are connected');
      // share (A9): a pot split between everyone right, or only the only one right scores; graded on every read.
      // wager (A8/A9/C6): stake up to a number, or any of your points ('total'), at even odds or the pool's; held as the server holds it.
      // rollover (A9): a window nobody earns anything on carries its points (and what it carried) into the next; graded on every read.
      // beat (A14 part 2): played against the bot's own call per window (its calls in the bot store; the botCall action), a person or
      // yes/no question asked each episode, its fallback with no call 'plays' or 'void'; never beside a share, stake or rollover.
      // (within: an order's places off that still score; line: over/under's; pairs: how many pairs; shrink: a seal's points falling
      // each episode it's left open; options: a choice's. The grader reads each; nothing kept.)
      const keys = ['id', 'ask', 'answer', 'points', 'asked', 'closes', 'pick', 'from', 'settle', 'share', 'wager', 'odds', 'rollover', 'beat', 'within', 'line', 'pairs', 'shrink', 'options', ...(drawnCard ? ['card'] : [])];
      if (q.beat !== undefined && !(q.beat?.by === 'bot' && ['plays', 'void', undefined].includes(q.beat.none) && ['person', 'yesNo'].includes(q.answer) && q.asked === 'each' && q.share === undefined && q.wager === undefined && !q.rollover)) add(game.id, at + '/beat', 'Only a person or yes/no question asked each episode is connected against the bot');
      if (q.share !== undefined && !['split', 'only'].includes(q.share)) add(game.id, at + '/share', 'Unknown share rule');
      for (const [key, value] of Object.entries(q)) if (!keys.includes(key) && active(value)) add(game.id, at + '/' + J.pointer(key), 'Question rider needs an explicit adapter');
      // players (A14 part 1): settled by the couch's own answers (the majority or minority, of its own or another question's).
      if (!['results', 'moment', 'players', 'phase', 'legs', ...(bank ? ['trivia', 'fact'] : [])].includes(q.settle?.by)) add(game.id, at + '/settle', 'Question fact provider is not connected');
      for (const key of Object.keys(q.settle || {})) if (!['by', 'take', 'moment', 'place', 'of', 'tie', 'phase', ...(bank ? ['fact'] : [])].includes(key)) add(game.id, at + '/settle/' + J.pointer(key), 'Settlement modifier needs an adapter');
    }
  });
  return { status: gaps.length ? 'blocked' : 'supported-profile', gaps, notes, profile: 'core-post-acquisition-v1' };
}
module.exports = { inspect };
