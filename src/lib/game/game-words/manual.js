// The engine's manual for the Start-a-game GPT (docs/PLAN-start-a-game-gpt.md step G1, "The ask"): what a game can be, as the
// bot reads it. Generated from the spec's VOCAB (game-spec schema.js), never written as a whole by hand: each VOCAB key and value
// has its words here (WORDS), and the manual lists only what VOCAB says plays now, the rest as "can't yet". A unit test keeps
// WORDS and VOCAB the same shape (tests/game-words.test.js), so a value an engine step adds fails the test until it has words:
// every step teaches the bot. The examples are the capability tracker's own requests (tests/fixtures/engine-capabilities.json),
// each one that plays on this page's show, words to spec, and a few it can't do yet, so the examples always play. Pure, plain
// CommonJS like game-spec.
//
//   manualFor(ctx, { kind, examples, limit }) -> the manual's text
//   WORDS                                     -> each VOCAB key's words: { what, values: { value: words }, sport?: [values] }
//   FIELDS                                    -> the spec's other fields' words (numbers, lists, switches), each shown with a
//                                                request of the tracker that plays on the page and uses it
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose, see ../game-spec/schema.js */
const schema = require('../game-spec/schema.js');
const { describeSpec } = require('../game-spec/describe.js');
/* eslint-enable @typescript-eslint/no-require-imports */

const { VOCAB, PRESETS, PRESET_LABELS, SETTLES_FOR, specProblems, specWaitsFor } = schema;

// Each VOCAB key's words: what the field is, and each value in a few words. `sport`: values that play only on a sport's page
// (left out of a show's manual), `show`: only on a show's page.
const WORDS = {
  'get.by': {
    what: 'how each of you gets what you play with',
    values: {
      draft: 'a team of people drafted for the game (get.each, get.order, get.own)',
      pick: 'people picked fresh each episode (get.each 1 to 8; a pool picks 1)',
      card: 'a new bingo card each episode (score.by lines)',
      none: 'nothing held: you answer questions (score.by answers, the questions in ask)',
      squares: "a grid of a team game's two scores' last digits (score.by squares)",
    },
    sport: ['squares'],
  },
  'get.order': {
    what: 'how a draft runs',
    values: {
      snake: 'turns, for people nobody else can have (own exclusive)',
      blind: 'everyone picks in private, revealed at once (own shared)',
      draw: 'names out of a hat, dealt at random',
      auction: 'sealed bids from a budget (own exclusive; get.budget { total, floor })',
    },
  },
  'get.own': {
    what: 'whether two of you can hold the same person',
    values: { exclusive: "one team's each (only when the cast covers every pick)", shared: 'anyone can have the same person' },
  },
  'get.repeat': {
    what: 'who a pick can name again',
    values: {
      cycle: "nobody again until you've used everyone still in (a pool's default)",
      never: 'nobody twice in the game (get.fallback for when everyone is used)',
      any: 'anyone still in, every episode',
    },
  },
  'get.fallback': { what: "a never-repeat pick's night with nobody left to pick", values: { miss: 'a missed pick', skip: 'nothing counts that night' } },
  count: {
    what: 'what of yours counts each episode',
    values: {
      start: '{ start: n }: the n you start each episode (a lineup; the rest sit on the bench)',
      all: '{ all: true }: your whole team (an Outlast)',
      pick: '{ pick: true }: your pick',
      best: '{ best: n }: your best n each episode, worked out for you (best ball)',
    },
  },
  'score.by': {
    what: 'how what counts earns points',
    values: {
      moments: "what your people do each episode, by the show's moments and points (score.points { momentId: points } over the rulebook's)",
      place: 'how long each of yours lasts: 1, plus 1 for every boot they outlast (an Outlast; count all)',
      survive: 'a pick that stays in (a pool; score.points a right pick, lives, mulligans, buyback)',
      lines: 'bingo lines (score.points a line)',
      answers: "right answers to the game's questions (ask)",
      stages: 'a game in stages: its stages\' tables (stages, overall)',
      stats: "a sport's stat keys (score.points { statKey: points })",
      squares: "each pay's points to whoever holds the square of the two scores' last digits",
    },
    sport: ['stats', 'squares'],
  },
  'score.means': { what: "what a pool's right pick means", values: { staysIn: 'the person stays in that episode', scores: 'the player scores (a sport)' }, sport: ['scores'] },
  'rank.by': {
    what: 'how the table is ordered and who wins',
    values: {
      total: 'the most points',
      streak: "the longest run of right picks (a pool's default)",
      standing: 'last one standing (a pool with lives; a draft or questions with cuts or lives)',
      worth: 'cash plus your team at today\'s prices (a stock market)',
      coop: 'everyone wins or loses together against the show (questions with score.lives)',
      matchups: 'head to head each episode, the standings by wins (rank.playoffs { teams })',
      weeks: 'weeks won: each episode whoever adds the most points wins it',
      categories: "a sport's categories, head to head",
      roto: "a sport's categories, each ranking everyone",
    },
    sport: ['categories', 'roto'],
  },
  'rank.ties': { what: 'a week two or more top (weeks won)', values: { all: 'each of them wins it', split: 'they share one', none: 'nobody does' } },
  'score.hits': {
    what: 'moments counted as objectives hit, a point each (with score.only)',
    values: { every: 'every time one happens', pick: 'each objective once for each of yours that hit it', objective: 'each objective once for you' },
  },
  'card.from': {
    what: "where a new card each week comes from (card: { from, each, of })",
    values: {
      moments: "the show's moments in turn, from the list in card.of",
      bot: 'chosen from them by our bot before each episode',
      host: 'chosen by a host, a different one of you each episode',
    },
  },
  'card.fallback': { what: "a card nobody chose in time", values: { spec: "the spec's own list", void: "that episode's card doesn't count" } },
  closes: {
    what: 'when moves lock',
    values: { start: 'as each episode starts', daily: "at the day's first game", weekly: "at the week's first game", game: "each holding at its own game's start" },
    sport: ['daily', 'weekly', 'game'],
  },
  'pool.where': { what: 'who can be picked (pool: { of: "cast", where })', values: { stillIn: 'nobody gone before the game starts', teams: "a sport's teams", group: 'one group of the show' }, sport: ['teams'] },
  'ask.answer': {
    what: "how a question is answered (each question: { id, ask, answer, points, asked, settle })",
    values: {
      person: 'someone (pick: how many, each right one scores; from: cast or team)',
      group: 'a tribe, team or couple',
      yesNo: 'yes or no',
      number: 'a number: the closest wins',
      overUnder: 'over or under a line (line)',
      choice: 'one of the options (options: 2 to 12)',
      calls: "the show's two calls each episode (Weekly Calls)",
      order: 'an order (pick 2 to 24; within: places still scoring)',
      confidence: 'a ranking, surest first',
      chips: 'chips spread over people (chips)',
      split: 'a vote split ("5-2-1")',
      pairs: 'for each pair, who outlasts whom (pairs)',
      side: "one of a team game's two sides",
      bracket: "a draw's winners round by round",
      trivia: "the round's trivia questions about the episode before (settle trivia)",
      ticket: 'a ticket: the questions you put on it and a stake (settle legs)',
    },
    sport: ['side', 'bracket'],
  },
  'ask.settle': {
    what: 'what data settles a question (settle: { by, take })',
    values: {
      results: 'who went home or won (take: out, stays, winner, placed, top, order, split, outlast)',
      moment: 'a moment research answers (moment: its id; take: happened, count, who, most, first, order)',
      role: 'a secret role (role; take: who, end, count)',
      phase: 'a phase of the season (phase: its id; take: starts, happened)',
      points: "each person's points by the game's rules (take: most, order)",
      calls: "the show's calls (Weekly Calls)",
      trivia: "the episode's trivia key",
      fact: 'an episode fact research answers (take: who; fact: titleQuote, who says the title)',
      players: 'the players\' own answers (take: majority or minority)',
      legs: "a ticket's legs (of: the question ids)",
      outside: 'a number from an outside source',
      final: "a sport's game at its final (take: winner, total, margin)",
      stat: "a stat in a sport's game (stat; take: most, least, value)",
    },
    sport: ['final', 'stat'],
  },
  'ask.settle.source': { what: "an outside number's source", values: { tvmaze: "TVmaze's episode rating" } },
  'ask.settle.tie': { what: 'a tie at the majority', values: { none: "nobody's right", all: 'everyone tied is right' } },
  'ask.beat.by': { what: 'an opponent a right answer has to beat (beat: { by })', values: { bot: "our bot's own call, hidden until the lock: a right answer scores only where the bot's isn't right" } },
  'ask.beat.none': { what: 'a window the bot made no call for', values: { plays: 'plays as usual', void: "doesn't count" } },
  'ask.asked': {
    what: 'when a question is asked',
    values: { once: 'once, for the game (the default)', each: 'before every episode it plays', every: 'each run of `every` episodes (2 to 10)', phase: 'once a phase of the season' },
  },
  'ask.closes': { what: 'when a question asked once locks', values: { start: "when its window's first episode starts", finale: "open until the season's last episode (who wins, the final few)" } },
  'ask.from': { what: 'who a person answer names', values: { cast: 'anyone still in', team: 'someone from your own team (a draft\'s own question)' } },
  'ask.each': { what: 'one question about each (each)', values: { person: 'each person still in, answered for each', game: "each game of the episode (a sport)" }, sport: ['game'] },
  'ask.share': { what: "how a question's points are shared", values: { split: 'a pot each window, split between everyone right', only: 'scores only when nobody else has it' } },
  'ask.odds': { what: "a stake's odds", values: { even: 'even money', pool: "the pool's: everyone's stakes, shared by those right" } },
  'ask.shrink.per': { what: 'a call open to the finale worth less for each (shrink: { points, per })', values: { episode: 'episode already started when it was made', change: 'change made once the game started' } },
  'ask.fallback': {
    what: "a group question's episode whose groups aren't sure",
    values: { void: 'no points either way (the default)', 'carry-on': 'follow the people', 'next-stage': 'start the next stage (a stage with one after it)' },
  },
  'score.times': {
    what: 'when points multiply (score.times: [{ times, episode | from (to) | phase | finale }])',
    values: { episode: 'one episode', from: 'a run of episodes', phase: 'a phase', finale: 'the finale' },
  },
  'multiply.on': {
    what: 'what a multiplier is keyed on',
    values: {
      captain: 'a captain: one starter named each episode (score.captain { times })',
      when: 'when it happens (score.times)',
      joined: 'how a holding joined your team (score.multiply)',
      legs: "a parlay's legs, all right (score.parlays [{ of, times }])",
      rank: "a confidence ranking's place",
      streak: "a pool's streak",
      picked: 'when a holding was picked',
    },
  },
  'score.multiply.joined': {
    what: 'how a holding joined (score.multiply: [{ joined, times, per?, then? }])',
    values: { draft: 'drafted', pickup: 'any mid-season move', replacement: 'a pickup for someone gone home', swap: 'a pickup for someone still in' },
  },
  'score.multiply.per': { what: 'the Nth such move counted', values: { team: 'per team (the default)', slot: 'along the roster spot it fills' } },
  'score.multiply.then': { what: "past a multiplier list's end", values: { repeat: 'the last again', ratio: 'on by its last step (0.5, 0.25, 0.125)' } },
  'score.bounty.on': { what: 'a bounty on a draft (score.bounty: { points })', values: { votedOut: "one of your people votes out someone else's: you take the points from them" }, show: ['votedOut'] },
  'score.roles.on': {
    what: 'secret roles among the players (score.roles: { count, name, points, on })',
    values: { out: "a role scores each time someone another seat holds goes home", votedOut: '... is voted out' },
  },
  'score.roles.deal': { what: 'how the roles are dealt', values: { random: 'at random once the game starts' } },
  'score.roles.reveal': { what: 'when the roles are revealed', values: { end: "at the game's end (or an episode's number)" } },
  'score.twist.who': {
    what: "the top scorer's twist (score.twist: { of: [{ id, name, times, moment? }] }): who chooses the next episode's twist",
    values: { top: "the episode's top scorer", bottom: 'its lowest' },
  },
  'score.twist.by': { what: 'top by what', values: { episode: "that episode's points", total: 'the standings through it' } },
  'score.twist.tie': { what: 'a tie for the twist', values: { total: 'broken by the standings', none: 'nobody chooses' } },
  'get.groups.own': { what: "group slots' ownership (get.groups: { slots: 1 or 2 }: a slot for a pair or team the show forms)", values: { shared: 'shared (the default)', exclusive: 'exclusive' } },
  'extras.waivers.own': { what: "a waiver move's ownership (extras.waivers.own: { replace, swap })", values: { exclusive: 'only someone on nobody\'s team', shared: "anyone still in, even on another team" } },
  'get.groups.fallback': { what: "a group slot's episode whose groups aren't sure", values: { void: 'no points (the default)', 'carry-on': 'follow the people', 'next-stage': 'start the next stage' } },
  'get.groups.points': { what: 'what a group slot scores', values: { mean: "its members' mean (the default)", sum: 'their sum' } },
  'get.second.fallback': { what: "a pool's second pick (get.second) on a night only one goes", values: { void: "doesn't count", counts: 'counts' } },
  'get.across.of': { what: 'a draft spread across (get.across: { of, then })', values: { group: "the show's groups: one from each tribe", gender: 'a guy and a girl' } },
  'get.across.then': { what: 'a drafted person whose group ends', values: { keep: 'stays yours' } },
  'get.budget.gone': { what: "a salary cap's price for someone gone home (get.budget: { total, floor, ceiling })", values: { zero: 'nothing', last: 'their last price' } },
  'get.budget.fallback': { what: "an auction's team the bids didn't fill", values: { fill: 'filled at the floor', short: 'left short' } },
  'get.budget.left': { what: "a draft's money left over", values: { cash: 'cash to trade with (a stock market: get.budget.trade { fee })', lost: 'lost', bids: 'bids on waivers' } },
  'get.keep.cost': { what: "keepers from the couch's last game (get.keep: { each, from })", values: { place: 'a place on the team', round: "one of a snake's earliest rounds", price: 'their price' } },
  'get.keep.fallback': { what: 'keepers nobody named', values: { best: "their best who are back", none: 'nobody' } },
  'rank.cut.at': {
    what: 'players knocked out (rank.cut: [{ at, out }], rank.by standing)',
    values: { every: '{ every: n }: every n episodes, the lowest over them (the guillotine)', episode: '{ episode: n }: after that episode, by the total', phase: '{ phase }: before a phase' },
  },
  'rank.cut.tie': { what: 'a tie at the cut line', values: { keep: 'nobody tied there goes', all: 'all of them go' } },
  'rank.cut.quiet': { what: 'a night nobody goes home, at a cut', values: { cut: 'cut anyway', skip: 'skip it' } },
  'rank.oneLeft': { what: 'when one player is left', values: { ends: 'the game ends', plays: 'it plays on' } },
  'rank.allOut': { what: 'a night everyone left goes out', values: { points: 'all out, ranked by points', share: 'they share the win', back: 'all back in' } },
  'score.saves': { what: "co-op's night saved by (score.lives: the couch's lives together)", values: { one: 'one right answer among you', most: 'most of those who answered', all: 'all of you' } },
  'rank.odd': { what: 'head to head with an odd number', values: { median: 'the one left out plays the median', bye: 'sits out' } },
  'rank.quiet': { what: 'a head-to-head night nobody scores', values: { skip: 'skipped', tie: 'a tie' } },
  'rank.teams.made': { what: 'teams of players (rank.teams: { of: 2 to 6 })', values: { draw: 'drawn at random', choose: 'chosen' } },
  'rank.teams.score': { what: "a team's points", values: { sum: "its members' sum", mean: 'their mean' } },
  'rank.teams.unplaced': { what: 'someone on no team', values: { smallest: 'goes onto the smallest', none: 'stays on none' } },
  'rank.handicap.who': { what: 'a handicap (rank.handicap: { points })', values: { new: 'points each episode for newcomers' } },
  'rank.handicap.newTo': { what: 'new to what', values: { couch: 'the couch', show: 'the show' } },
  'overall.by': { what: "how a game in stages' tables add up (overall: { by })", values: { points: "each stage's total added up", places: 'points for where you finish each stage (places)', wins: 'stages won' } },
  'extras.draft.opens': { what: "a later stage's draft", values: { any: 'opens any time', start: 'opens once its start is known, drafting from who\'s still in' } },
  'on.change': {
    what: 'a stage a format change starts (a stage\'s on: { change: [kinds], again })',
    values: {
      'teams-formed': 'teams formed',
      'pairs-formed': 'pairs formed',
      'split-into-individuals': 'split into individuals',
      merge: 'the merge',
      swap: 'a swap',
      newcomer: 'a newcomer',
      'new-phase': 'a new phase',
      'swap-all': 'a swap that leaves no group as it was',
    },
    show: ['teams-formed', 'pairs-formed', 'split-into-individuals', 'merge', 'swap', 'newcomer', 'new-phase', 'swap-all'],
  },
  'extras.changes.ok': { what: 'how a format change is taken (extras.changes: { ok })', values: { auto: 'by itself, with an undo', maker: "once the maker says so", vote: 'once the players vote for it' } },
  'extras.changes.unanswered': { what: 'a change nobody answered by the lock', values: { start: 'the stage starts', 'carry-on': 'the game carries on' } },
};

// The spec's other fields (numbers, lists and switches, which VOCAB doesn't list), each in a few words. A unit test keeps each
// one honest: some request of the tracker that plays uses it, so its words can't outlive the field; the manual shows each with
// the shortest such request that plays on the page (fieldExamples).
const FIELDS = {
  'get.each': 'how many each of you drafts or picks',
  'get.budget': '{ total, floor, ceiling }: a budget to bid with (auction) or a salary cap; add trade: { fee } for buying and selling each week (a stock market)',
  'get.keep': "{ each, from }: keepers from the couch's game on an earlier season (from: its league id)",
  'get.groups': '{ slots: 1 or 2 }: roster slots for a pair or team the show forms, beside a draft scored by moments',
  'get.second': "{}: a pool's second pick, counted on a night two go home",
  'get.across': "{ of: 'group' }: drafted across the show's groups, one from each",
  'count.start': 'the n you start each episode',
  'count.best': 'your best n each episode, worked out for you',
  'score.points': "moments: { momentId: points } over the rulebook's own (negative takes points away; null is the rulebook's own); lines and a pool: the points a line or a right pick",
  'score.only': "a list of the show's moment ids: only they count",
  'score.captain': '{ times }: one starter named each episode scores that many times (a lineup)',
  'score.times': '[{ times, episode | from (to) | phase | finale: true }]: when points multiply (half is 0.5)',
  'score.multiply': "[{ joined, times }]: how a holding joined multiplies what it earns while it's yours; times a number (not 1) or, for a pickup, a replacement or a swap, a list for the first, the second and so on ([0.5, 0.25])",
  'score.reverse': 'true: an Outlast in reverse, the earlier they go home the more',
  'score.lives': "a pool or a game of questions: lives (a wrong pick or answer costs one; at none you're out; rank standing); with rank coop, the couch's lives together",
  'score.mulligans': 'a pool: your first wrong picks forgiven',
  'score.buyback': "a pool: { times, before: { phase } }: back in after you're out",
  'score.parlays': '[{ of: [question ids], times }]: every leg right multiplies their points',
  'score.bank': '{ start }: units everyone starts with, every stake drawn from it',
  'score.bounty': "{ points }: a draft's bounty when one of yours votes out someone else's",
  'score.roles': '{ count, points, on }: secret roles dealt to some of you',
  'score.twist': "{ of: [{ id, name, times }] }: each episode's top scorer chooses the next episode's twist",
  'ask.pick': 'how many people or groups an answer names (each right one scores)',
  'ask.options': 'a choice\'s options (2 to 12; a count\'s are numbers or ranges, "0", "1", "2+")',
  'ask.line': "an over/under's line",
  'ask.within': 'an order: how many places off still scores',
  'ask.chips': 'chips to spread over people',
  'ask.pairs': 'how many pairs (who outlasts whom), drawn at the start',
  'ask.every': "asked 'every': its run of episodes (2 to 10)",
  'ask.each': "'person': one question about each person still in, answered for each",
  'ask.rollover': 'true: a window nobody gets carries its points into the next',
  'ask.share': 'split: a pot split between everyone right; only: scores only when nobody else has it',
  'ask.shrink': "{ points, per }: a call open to the finale worth less the later it's made",
  'ask.wager': 'a stake: up to n of your points (or "total") on your answer; right wins it, wrong loses it',
  'ask.beat': "{ by: 'bot' }: a right answer scores only where our bot's call isn't right",
  'ask.card': "true: a question on each line of this week's card",
  'ask.settle.place': 'where they finish, for placed or top',
  'rank.race': '{ to }: the first to that many points wins, and the game ends there',
  'rank.cut': '[{ at, out }]: players knocked out (rank by standing); out a number or "half"; in an exclusive draft a cut player\'s people go back in the pool',
  'rank.oneLeft': "'ends' or 'plays': when one player is left",
  'rank.teams': '{ of: 2 to 6 }: the couch in teams that score together',
  'rank.handicap': '{ points }: points each episode for newcomers',
  stages: "[{ id, name, game, on?, side?, alongside?, season? }]: 2 to 6 games one after another (each starts where the one before ends: its game's span), with overall: { by }",
  'stages.on': '{ change: [kinds], again }: a stage a format change starts (again: a new copy at every such change)',
  'stages.side': '{ held }: a side game for each grouping that has held that many episodes',
  'stages.alongside': 'true: plays at the same time as the stages before it (two ways of scoring at once)',
  'stages.season': "{ show, number }: a stage on another show's season",
  card: "{ from, each, of }: a new card each episode: each lines, drawn from of (the show's moment ids)",
  'extras.waivers': "replacements and swaps mid-season: { replace: 'always' | 'never', windows: { schedule, every, swaps }, own: { replace, swap } }",
  'extras.seats': '{ people }: up to that many of you share one team',
  'extras.lateLock': '{ hours }: someone who watches later locks that many hours after the episode airs',
};

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Every field a spec names, as a field (indices and a stage's game taken out): "stages[1].game.ask[0].rollover" -> "ask.rollover". */
function fieldsOf(spec, path = '', out = new Set()) {
  const field = (p) => p.replace(/\[\d+\]/g, '').replace(/^(stages\.game\.)+/, '');
  if (Array.isArray(spec)) spec.forEach((x) => fieldsOf(x, path, out));
  else if (isObj(spec))
    for (const [k, v] of Object.entries(spec)) {
      const p = path ? `${path}.${k}` : k;
      out.add(field(p));
      // A points map's keys are moments, not fields.
      if (!/(^|\.)points$/.test(field(p))) fieldsOf(v, p, out);
    }
  return out;
}

/** The longest spec a field's example may have, in characters. */
const MAX_FIELD_EXAMPLE = 320;

/** For each field, the shortest request of the tracker that plays on this page and uses it (the page's own show first). */
function fieldExamples(ctx, rows, { show } = {}) {
  const out = new Map();
  const own = (r) => (show && r.page && r.page.show === show ? 0 : 1);
  const sorted = (rows || []).filter((r) => r && r.words && r.spec).slice().sort((a, b) => own(a) - own(b) || JSON.stringify(a.spec).length - JSON.stringify(b.spec).length);
  for (const r of sorted) {
    const fields = fieldsOf(r.spec);
    const wanted = Object.keys(FIELDS).filter((f) => fields.has(f) && !out.has(f));
    // A short one only: the manual stays a short read (a field with no short example is shown in words alone).
    if (!wanted.length || JSON.stringify(r.spec).length > MAX_FIELD_EXAMPLE || specProblems(r.spec, ctx || null).length || specWaitsFor(r.spec).length) continue;
    for (const f of wanted) out.set(f, { words: r.words, spec: r.spec });
  }
  return out;
}

/** A tracker row's page: a sport's or a show's. */
const kindOfPage = (page) => (page && page.sport ? 'sport' : 'show');

/** Whether a value plays on this page: VOCAB says now, and it isn't the other kind of page's. */
function plays(key, value, kind) {
  if (VOCAB[key][value] !== 'now') return false;
  const w = WORDS[key] || {};
  if (kind !== 'sport' && (w.sport || []).includes(value)) return false;
  if (kind === 'sport' && (w.show || []).includes(value)) return false;
  return true;
}

/** A spec as one line of JSON, its empty parts left out. */
const oneLine = (spec) => JSON.stringify(spec);

/** Which pieces a spec uses, for picking examples that differ: its get, score and rank, its questions' answers and settles,
 *  its stages and the extras it names. */
function signature(spec) {
  const s = isObj(spec) ? spec : {};
  const parts = [];
  if (Array.isArray(s.stages)) parts.push('stages', ...s.stages.map((st) => signature(st && st.game)));
  if (s.preset) parts.push(`preset:${s.preset}`);
  for (const k of ['get', 'score', 'rank', 'count']) if (isObj(s[k])) parts.push(...Object.keys(s[k]).map((f) => `${k}.${f}${typeof s[k][f] === 'string' ? `:${s[k][f]}` : ''}`));
  for (const q of Array.isArray(s.ask) ? s.ask : []) if (isObj(q)) parts.push(`ask:${q.answer}:${q.settle && q.settle.by}:${q.asked || 'once'}`);
  if (isObj(s.extras)) parts.push(...Object.keys(s.extras).map((k) => `extras.${k}`));
  if (isObj(s.card)) parts.push('card');
  return [...new Set(parts)].sort().join(' ');
}

/**
 * The tracker's requests that play on this page (their spec passes specProblems with this ctx and nothing waits), one for each
 * different set of pieces, the page's own show first, then the shortest: { words, spec, sentence }. And a few it can't do yet
 * (a step that isn't built, nobody plans it): { words, why }.
 */
function examplesFor(ctx, rows, { limit = 24, cant = 6, show, kind = 'show', skip = new Set() } = {}) {
  const seen = new Set();
  const playing = [];
  const waiting = [];
  const own = (r) => (show && r.page && r.page.show === show ? 0 : 1);
  const sorted = (rows || []).filter((r) => r && r.words).slice().sort((a, b) => own(a) - own(b) || oneLine(a.spec || {}).length - oneLine(b.spec || {}).length);
  for (const r of sorted) {
    if (skip.has(r.words)) continue;
    if (r.spec && !specProblems(r.spec, ctx || null).length && !specWaitsFor(r.spec).length) {
      const sig = signature(r.spec);
      if (seen.has(sig) || playing.length >= limit) continue;
      seen.add(sig);
      let sentence = '';
      try {
        sentence = describeSpec(r.spec, ctx || null).sentence;
      } catch {
        sentence = '';
      }
      playing.push({ words: r.words, spec: r.spec, sentence });
    } else if (!r.spec && !r.gpt && (r.step || r.planned === false) && r.note && waiting.length < cant && kindOfPage(r.page) === kind) {
      // A row with a spec that doesn't play here is another page's game, not a can't-yet; G1's own rows are a moment the show
      // doesn't have, which this step answers with the new-moment path.
      const why = r.planned === false ? `not planned: ${r.note}` : r.step === 'G1' ? `a moment the show doesn't have (newMoment): ${r.note}` : `comes later (${r.step}): ${r.note}`;
      waiting.push({ words: r.words, why });
    }
  }
  return { playing, waiting };
}

/** "A Survivor 51 game ...": a preset whole, in the engine's words, and its spec's main parts. */
function presetLines(ctx) {
  return Object.keys(PRESETS).map((id) => {
    let sentence = '';
    try {
      sentence = describeSpec({ preset: id }, ctx || null).sentence;
    } catch {
      sentence = '';
    }
    const p = PRESETS[id];
    const main = Object.fromEntries(['get', 'count', 'score', 'rank', 'ask'].filter((k) => p[k] !== undefined && !(Array.isArray(p[k]) && !p[k].length)).map((k) => [k, p[k]]));
    return `- "${id}" (${PRESET_LABELS[id]}): ${sentence} ${oneLine(main)}`;
  });
}

/** Which answer each settle can grade, from the schema's own SETTLES_FOR: "person: results out|stays|winner ...". */
function settleLines(kind) {
  return Object.entries(SETTLES_FOR)
    .filter(([answer]) => plays('ask.answer', answer, kind))
    .map(([answer, list]) => {
      // null: anything settles it (a choice's options are matched to the verdict).
      if (!Array.isArray(list)) return `- ${answer}: any settle (its options matched to the verdict)`;
      const by = {};
      for (const pair of list) {
        const [s, take] = pair.split(':');
        if (!plays('ask.settle', s, kind)) continue;
        (by[s] = by[s] || []).push(take);
      }
      const said = Object.entries(by).map(([s, takes]) => `${s} ${takes.join('|')}`);
      return said.length ? `- ${answer}: ${said.join('; ')}` : null;
    })
    .filter(Boolean);
}

/**
 * The manual, as the bot reads it. `kind`: 'show' (the default) or 'sport', which values play; `examples`: the tracker's rows
 * (capabilities.js rowsOf), its requests become the examples; `show`: the page's show, whose own requests come first.
 */
function manualFor(ctx, { kind = 'show', examples = [], limit = 16, show = null } = {}) {
  const lines = [];
  lines.push('THE ENGINE\'S MANUAL: what a game can be. Only these parts and values play; anything else goes under cantYet.');
  lines.push(
    'A game is a spec: { "spec": 1, "preset", "span", "pool", "get", "count", "score", "rank", "ask", "closes", "extras", "stages", "overall", "card" }. ' +
      'Leave out every part their words don\'t decide: a preset fills in the rest, and our defaults fill what no preset does.'
  );
  lines.push('');
  lines.push('PRESETS (whole games; start from one when the words fit it, then change only what they said):');
  lines.push(...presetLines(ctx));
  lines.push('');
  lines.push('SPAN: "span": { "from": an episode number or { "phase": id }, "to": an episode number, null for the season\'s end, or { "phase": id } it ends before }. Left out: from the next episode to air to the season\'s end.');
  lines.push('');
  lines.push('PARTS AND THEIR VALUES (field: what it is. value = what it does):');
  const later = [];
  for (const key of Object.keys(VOCAB)) {
    const w = WORDS[key];
    const values = Object.keys(VOCAB[key]);
    const now = values.filter((v) => plays(key, v, kind));
    for (const v of values) if (VOCAB[key][v] !== 'now') later.push(`${key} ${v} (${w.values[v]})`);
    if (!now.length) continue;
    lines.push(`- ${key}: ${w.what}. ${now.map((v) => `${v} = ${w.values[v]}`).join('; ')}`);
  }
  lines.push('');
  lines.push('QUESTIONS (ask): each { "id", "ask": the question, "answer", "points", "asked", "settle": { "by", "take", ... } }. Which settle can grade each answer:');
  lines.push(...settleLines(kind));
  if (later.length) {
    lines.push('');
    lines.push("CAN'T YET (never in a game; say so under cantYet): " + later.join('; ') + '.');
  }
  const fieldLines = fieldExamples(ctx, examples, { show });
  lines.push('');
  lines.push('FIELDS (numbers, lists and switches; each with a request that plays on this page, where there is one):');
  for (const [field, words] of Object.entries(FIELDS)) {
    const e = fieldLines.get(field);
    lines.push(`- ${field}: ${words}${e ? `. e.g. "${e.words}" -> ${oneLine(e.spec)}` : ''}`);
  }
  const ex = examplesFor(ctx, examples, { limit, show, kind, skip: new Set([...fieldLines.values()].map((e) => e.words)) });
  if (ex.playing.length) {
    lines.push('');
    lines.push('EXAMPLES THAT PLAY ON THIS PAGE (their words -> the game, and how we say it):');
    for (const e of ex.playing) lines.push(`- "${e.words}" -> ${oneLine(e.spec)}${e.sentence ? ` (${e.sentence})` : ''}`);
  }
  if (ex.waiting.length) {
    lines.push('');
    lines.push("EXAMPLES IT CAN'T DO YET (cantYet, with the nearest that plays if there is one):");
    for (const e of ex.waiting) lines.push(`- "${e.words}": ${e.why}`);
  }
  return lines.join('\n');
}

module.exports = { WORDS, FIELDS, manualFor, examplesFor, fieldExamples, fieldsOf, signature, plays };
