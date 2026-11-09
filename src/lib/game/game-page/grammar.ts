// A game's own page, generated from its spec (docs/PLAN-start-a-game-gpt.md, U0's Round 2 and U1; ported from the U0 mocks'
// grammar.js): the grammar, as data. Every value of every dial in the engine's vocabulary (game-spec schema.js VOCAB) says where it
// shows on a game's page and in its quick actions, in seven kinds of place and only these:
//   main     the game's main block, one per game, picked by what the game is about (mainOf, below)
//   move     something a player does that isn't answering a question (a lineup, a pick, a draft turn, a bid...)
//   control  how one kind of question is answered (one frame for every kind: the words, the control, the lock, the state)
//   rider    an extra on an answer, always in the same place under its control (a stake, double or nothing, a rank...)
//   badge    a mark on a face or a holding (a captain, a bounty, a secret role, lives...)
//   table    the table's kind, or a column or line in it
//   event    something on an episode (x2 tonight, the cut, the draw, a twist chosen, the merge's change)
// plus `lock` (when a move or question closes) and `line`: a rule in How it plays (describe.js says every piece; a value that needs
// nothing more says only that). A twist never gets a section of its own: it lands in one of these places. A value missing here is
// a hole (tests/game-page.test.js). Pure.

export type PlaceKind = "main" | "move" | "control" | "rider" | "badge" | "table" | "event" | "lock" | "line";
export type Place = [PlaceKind] | [PlaceKind, string];

const L: Place[] = [['line']];
export const GRAMMAR: Record<string, Record<string, Place[]>> = {
  'get.by': { draft: [['main', 'team'], ['move', 'draft']], pick: [['main', 'ladder'], ['move', 'pick']], card: [['main', 'card'], ['move', 'tick']], none: [['main', 'ballot']], squares: [['main', 'board'], ['move', 'squares']] },
  'get.order': { snake: [['move', 'draft']], blind: [['move', 'blind']], draw: [['event', 'draw']], auction: [['move', 'auction'], ['table', 'budget']] },
  'get.own': { exclusive: [['badge', 'taken']], shared: L },
  'get.repeat': { cycle: L, never: [['badge', 'used']], any: L },
  'get.fallback': { miss: L, skip: L },
  count: { start: [['move', 'lineup']], all: L, pick: L, best: [['badge', 'counted']] },
  'score.by': { moments: [['table', 'points']], place: [['table', 'points']], survive: [['table', 'points']], lines: [['main', 'card']], answers: [['table', 'points']], stages: [['main', 'stages']], stats: [['table', 'points']], squares: [['main', 'board']] },
  'score.means': { staysIn: [['main', 'ladder']], scores: [['main', 'picks']] },
  'rank.by': { total: [['table', 'points']], streak: [['table', 'streak']], standing: [['table', 'stillIn']], worth: [['main', 'worth'], ['table', 'worth']], coop: [['main', 'together'], ['table', 'shared']], matchups: [['main', 'matchup'], ['table', 'wl']], weeks: [['main', 'week'], ['table', 'weeks']], categories: [['main', 'categories'], ['table', 'wl']], roto: [['main', 'categories'], ['table', 'roto']] },
  'rank.ties': { all: L, split: L, none: L },
  'score.hits': { every: L, pick: L, objective: [['main', 'objectives']] },
  'card.from': { moments: L, bot: L, host: [['move', 'host']] },
  'card.fallback': { spec: L, void: L },
  closes: { start: [['lock', 'start']], daily: [['lock', 'daily']], weekly: [['lock', 'weekly']], game: [['lock', 'game']] },
  'pool.where': { stillIn: L, teams: [['control', 'filter']], positions: [['control', 'filter']], group: [['control', 'filter']] },
  'ask.answer': { person: [['control', 'person']], group: [['control', 'group']], yesNo: [['control', 'yesNo']], number: [['control', 'number']], overUnder: [['control', 'overUnder']], choice: [['control', 'choice']], calls: [['control', 'calls']], order: [['control', 'order']], confidence: [['control', 'confidence'], ['rider', 'rank']], chips: [['control', 'chips']], split: [['control', 'split']], pairs: [['control', 'pairs']], side: [['control', 'side']], bracket: [['control', 'bracket']], trivia: [['control', 'trivia']], ticket: [['control', 'ticket'], ['rider', 'legs']] },
  'ask.settle': { results: L, moment: L, role: L, phase: L, points: L, calls: L, trivia: L, fact: L, players: [['rider', 'majority']], legs: [['rider', 'legs']], outside: L, final: L, stat: L },
  'ask.settle.source': { tvmaze: L },
  'ask.settle.tie': { none: L, all: L },
  'ask.beat.by': { bot: [['rider', 'beat']] },
  'ask.beat.none': { plays: L, void: L },
  'ask.asked': { once: [['control', 'section']], each: [['control', 'section']], every: [['control', 'section']], phase: [['control', 'section']] },
  'ask.closes': { start: [['lock', 'start']], finale: [['lock', 'finale']] },
  'ask.from': { cast: L, team: [['control', 'fromTeam']] },
  'ask.each': { person: [['control', 'eachPerson']], game: [['main', 'slate'], ['control', 'eachGame']] },
  'ask.share': { split: [['rider', 'share']], only: [['rider', 'share']] },
  'ask.odds': { even: [['rider', 'stake']], pool: [['rider', 'stake']] },
  'ask.shrink.per': { episode: [['rider', 'shrink']], change: [['rider', 'shrink']] },
  'ask.fallback': { void: L, 'carry-on': L, 'next-stage': L },
  'score.times': { episode: [['event', 'times']], from: [['event', 'times']], phase: [['event', 'times']], finale: [['event', 'times']] },
  'multiply.on': { captain: [['badge', 'captain'], ['move', 'captain']], when: [['event', 'times']], joined: [['badge', 'times']], legs: [['rider', 'legs']], rank: [['rider', 'rank']], streak: [['badge', 'times']], picked: [['badge', 'times']] },
  'score.multiply.joined': { draft: [['badge', 'times']], pickup: [['badge', 'times']], replacement: [['badge', 'times']], swap: [['badge', 'times']] },
  'score.multiply.per': { team: L, slot: L },
  'score.multiply.then': { repeat: L, ratio: L },
  'score.bounty.on': { votedOut: [['badge', 'bounty'], ['event', 'bounty']] },
  'score.roles.on': { out: [['badge', 'role']], votedOut: [['badge', 'role']] },
  'score.roles.deal': { random: [['event', 'roles']] },
  'score.roles.reveal': { end: [['event', 'roles']] },
  'score.twist.who': { top: [['move', 'twist'], ['event', 'twist']], bottom: [['move', 'twist'], ['event', 'twist']] },
  'score.twist.by': { episode: L, total: L },
  'score.twist.tie': { total: L, none: L },
  'get.groups.own': { shared: [['badge', 'group']], exclusive: [['badge', 'group'], ['badge', 'taken']] },
  'extras.waivers.own': { exclusive: [['move', 'waivers']], shared: [['move', 'waivers']] },
  'get.groups.fallback': { void: L, 'carry-on': L, 'next-stage': L },
  'get.groups.points': { mean: L, sum: L },
  'get.second.fallback': { void: L, counts: L },
  'get.across.of': { group: [['move', 'spread']], gender: [['move', 'spread']] },
  'get.across.then': { keep: L },
  'get.budget.gone': { zero: L, last: L },
  'get.budget.fallback': { fill: L, short: L },
  'get.budget.left': { cash: [['table', 'budget']], lost: L, bids: L },
  'get.keep.cost': { place: [['move', 'keepers']], round: [['move', 'keepers']], price: [['move', 'keepers']] },
  'get.keep.fallback': { best: L, none: L },
  'rank.cut.at': { every: [['table', 'cut'], ['event', 'cut']], episode: [['table', 'cut'], ['event', 'cut']], phase: [['table', 'cut'], ['event', 'cut']] },
  'rank.cut.tie': { keep: L, all: L },
  'rank.cut.quiet': { cut: L, skip: L },
  'rank.oneLeft': { ends: L, plays: L },
  'rank.allOut': { points: L, share: L, back: L },
  'score.saves': { one: [['badge', 'saves']], most: [['badge', 'saves']], all: [['badge', 'saves']] },
  'rank.odd': { median: [['main', 'matchup']], bye: [['main', 'matchup']] },
  'rank.quiet': { skip: L, tie: L },
  'rank.teams.made': { draw: [['event', 'teams'], ['table', 'teams']], choose: [['move', 'teams'], ['table', 'teams']] },
  'rank.teams.score': { sum: L, mean: L },
  'rank.teams.unplaced': { smallest: L, none: L },
  'rank.handicap.who': { new: [['table', 'handicap']] },
  'rank.handicap.newTo': { couch: L, show: L },
  'overall.by': { points: [['main', 'stages'], ['table', 'overall']], places: [['main', 'stages'], ['table', 'overall']], wins: [['main', 'stages'], ['table', 'overall']] },
  'extras.draft.opens': { any: [['move', 'draft']], start: [['move', 'draft']] },
  'on.change': { 'teams-formed': [['event', 'change']], 'pairs-formed': [['event', 'change']], 'split-into-individuals': [['event', 'change']], merge: [['event', 'change']], swap: [['event', 'change']], newcomer: [['event', 'change']], 'new-phase': [['event', 'change']], 'swap-all': [['event', 'change']] },
  'extras.changes.ok': { auto: L, maker: [['move', 'change']], vote: [['move', 'vote']] },
  'extras.changes.unanswered': { start: L, 'carry-on': L },
};

/** The twists (roll.js, the wizard's chips): where each lands. None has a section of its own. */
export const TWISTS: Record<string, Place[]> = {
  captain: [['badge', 'captain'], ['move', 'captain']], 'finale-double': [['event', 'times']], 'first-double': [['event', 'times']],
  reverse: [['table', 'reverse']], draw: [['event', 'draw']], auction: [['move', 'auction'], ['table', 'budget']],
  'finale-picks': [['control', 'person'], ['control', 'section']], 'boot-call': [['control', 'person']], bounty: [['badge', 'bounty'], ['event', 'bounty']],
  roles: [['badge', 'role'], ['event', 'roles']], 'top-twist': [['move', 'twist'], ['event', 'twist']], only: [['line']],
  objectives: [['main', 'objectives']], 'group-slot': [['badge', 'group']], spread: [['move', 'spread']], replacements: [['badge', 'times']],
  mulligan: [['badge', 'saves'], ['move', 'mulligan']], 'second-pick': [['move', 'second']], 'never-twice': [['badge', 'used']],
  buyback: [['move', 'buyback']], 'split-pot': [['rider', 'share']], 'only-right': [['rider', 'share']], rollover: [['rider', 'rollover'], ['event', 'rollover']],
  'double-or-nothing': [['rider', 'double']], bank: [['rider', 'stake'], ['table', 'bank']], parlay: [['control', 'ticket'], ['rider', 'legs']],
  'beat-bot': [['rider', 'beat']], majority: [['rider', 'majority']], teams: [['table', 'teams']], redraft: [['event', 'redraft'], ['move', 'draft']],
  'trivia-too': [['control', 'trivia']],
};


/** The game's main blocks. */
export type MainBlock =
  | "together" | "race" | "matchup" | "categories" | "worth" | "week" | "board" | "card" | "objectives" | "team" | "picks" | "ladder" | "slate" | "ballot" | "stages";

type SpecLike = Record<string, unknown> & { rank?: { by?: string; race?: unknown }; get?: { by?: string }; score?: { by?: string; hits?: string }; ask?: unknown; stages?: unknown };

/** The questions a spec asks, its stages' too. */
export function asksOf(spec: SpecLike): Record<string, unknown>[] {
  const own = Array.isArray(spec.ask) ? (spec.ask as Record<string, unknown>[]) : [];
  const staged = Array.isArray(spec.stages) ? (spec.stages as Record<string, unknown>[]).flatMap((s) => (Array.isArray(s.ask) ? (s.ask as Record<string, unknown>[]) : [])) : [];
  return own.concat(staged);
}

/** The game's main block: what it's about. How you win comes first when it's the game's heart (co-op, a race, head to head,
 *  categories, worth, weeks won), then what you hold (squares, a card, objectives, a team, picks scored by what they do, a pick
 *  that keeps you in), else the questions: one per game of a slate, or a ballot. */
export function mainOf(spec: SpecLike): MainBlock {
  const r = spec.rank?.by ?? "total";
  const g = spec.get?.by ?? "none";
  if (r === "coop") return "together";
  if (spec.rank?.race) return "race";
  if (r === "matchups") return "matchup";
  if (r === "categories" || r === "roto") return "categories";
  if (r === "worth") return "worth";
  if (r === "weeks") return "week";
  if (g === "squares") return "board";
  if (g === "card") return "card";
  if (spec.score?.hits === "objective") return "objectives";
  if (g === "draft") return "team";
  if (g === "pick") return spec.score?.by === "moments" ? "picks" : "ladder";
  if (asksOf(spec).some((q) => q.each === "game" || q.answer === "side")) return "slate";
  return "ballot";
}

/** Every dial value, and its places; a value without one is a hole. */
export function vocabCoverage(vocab: Record<string, Record<string, unknown>>): { rows: { dial: string; value: string; later: boolean; places: Place[] }[]; holes: string[] } {
  const rows: { dial: string; value: string; later: boolean; places: Place[] }[] = [];
  const holes: string[] = [];
  for (const [dial, vals] of Object.entries(vocab))
    for (const v of Object.keys(vals)) {
      const places = GRAMMAR[dial]?.[v];
      if (!places) holes.push(`${dial}=${v}`);
      else rows.push({ dial, value: v, later: vals[v] !== "now", places });
    }
  return { rows, holes };
}
