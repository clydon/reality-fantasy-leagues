// The game spec's schema (docs/PLAN-start-a-game-gpt.md, "The game spec", step A1): what a game *is*, as data. One schema
// for shows and sports. What can happen on the show (the rulebook's moments) or in the sport (the Sport classes of
// docs/PLAN-sports-live.md, on the `sports` branch) it only refers to, by id or stat key.
//
//   { spec: 1, preset, span, pool, get, count, score, rank, ask, closes, extras }
//
//   preset   the preset it started from (its name, Run it back), or null
//   span     { from, to }: episodes of the season; to null = the season's end. from is an episode number, or a phase of
//            the season's rulebook (A3): { phase } while the game waits for it to start, { phase, at } once data says
//            where it does (at: the episode it plays from). The phase stays: its words, Game settings, Run it back
//   pool     { of: 'cast', where }: who can be picked. where { stillIn: true } (today: nobody gone before the start);
//            sports: { teams: [ids] }; later: { group: id }
//   get      how you get yours. { by: 'draft', each, order: snake | blind, own: exclusive | shared, groups? } (the order follows
//            the ownership today: exclusive drafts snake, shared drafts blind. A10 part 1's groups: { slots: 1 | 2, own:
//            shared | exclusive, swap, fallback: void | carry-on, points: mean | sum }, group slots beside a draft scored by
//            moments: a slot holds a pair or a team the show forms, picked after the episode that showed it, riding with it
//            while it lasts and dropping when it changes, GroupSlotLogic in state-logic.js. A10 part 3: order 'draw', names out of
//            a hat: nobody picks, the engine deals each team `each` at random when the draft starts, seeded and recorded, exclusive
//            (nobody shares) or shared (each team drawn on its own), DrawLogic; across: { of: group | gender, then: keep }, a
//            draft spread across the cast's groups as the data has them when it drafts (one from each tribe: no more than
//            ceil(each / groups) from one, and at least floor(each / groups) from each while it has someone to take; a show not
//            divided then drafts plainly, and the spread never blocks a draft: SpreadLogic), each castaway yours wherever they
//            go after it (then: keep, the fallback for a swap or the merge). A10 part 4: keep { each, from, cost, fallback },
//            keepers across seasons: a game that continues `from` (the couch's game on an earlier season of the show, a league
//            id), each person keeping up to `each` of their team there who are on this season's cast as the data records it
//            (named before the draft; someone not back can't be kept, and their place goes to the draft), kept before the
//            draft and the draft filling the rest, whatever its kind; cost place (a place on the team, nothing else: a snake
//            passes over a full team, so your last rounds go) | round (a snake's earliest rounds: you sit out one for each)
//            | price (their price at the draft, from a budget the data prices: a salary cap or a stock market); fallback best
//            (someone who names nobody keeps their best who are back) | none: KeeperLogic) | { by: 'pick', each: 1, repeat: 'cycle',
//            second? } (one an episode, nobody again until everyone still in is used, never twice running. A10 part 2's second:
//            { fallback: void | counts }, a second pick beside the first, open every episode, that counts on a night two or more
//            go home: nothing at a lock says a night is a double, only its results do; on a night only one goes, void (no
//            points either way) or counts (scored like the first)) | { by: 'card' }
//            (bingo) | { by: 'none' }; sports: { by: 'squares' }
//   count    what of yours counts each episode: { start: n } (your lineup) | { all: true } | { pick: true } | { best: n }
//            (A9 part 2: best ball, your best n each episode, no lineups; shows and sports) | null (nothing held)
//   score    { by: 'moments', points, captain?, times? } (points: moment id -> points over the rulebook's own; null = its
//            own. A9 part 2: captain { times }, a lineup's captain, one of your starters you name each episode, whose points
//            multiply; times [{ times, episode | from (to) | phase | finale }], an episode, a run of them, a phase of the
//            season or its finale whose points multiply: "double in the finale", "the first three count triple")
//            | { by: 'place', reverse? } (Outlast: 1, plus 1 for every boot outlasted; A9 part 2's reverse: true, the
//            earlier they go home the more, 1 plus 1 for everyone who outlasts them) | { by: 'survive', means: staysIn | scores,
//            points, lives?, buyback?, mulligans? } (Survival Pool. A10 part 2: lives n, a wrong pick (or none) costs one and at
//            none you're out, no more picks; buyback { times, before: { phase } | { episode } | null, cost }, someone out in an
//            episode before then is back in from the next with one life, `cost` points off their total, `times` in a game;
//            mulligans n, your first n wrong picks forgiven: no life lost, the streak carries on) | { by: 'lines', points? }
//            (bingo: each line `points`, 1 when it's left out: A9)
//            | { by: 'answers', parlays? } (only the ask's questions: Weekly Calls, a game of questions. A9's parlays:
//            [{ of: [question ids], times }], someone right on every one of them in the same window has their points on
//            them multiplied: "who goes home AND who wins immunity, triple if both"); sports: { by: 'stats', points: { HR:
//            5 } } (the Sport's stat keys)
//   rank     { by: 'total' } | { by: 'streak' } (longest, ties to the total) | { by: 'standing' } (A10 part 2, a pool with lives:
//            last one standing, whoever's still in first, then whoever went out last; ties to the total, then lives left)
//            | { by: 'worth' } (A10 part 3c, a stock market: cash plus the team at today's prices; ties to the total);
//            sports: matchups | categories | roto. A11 part 1, beside a draft (Outlast, a lineup, best ball): race { to }, the
//            first to `to` points wins, and the game ends after the episode someone reached it (the most points then wins; a
//            season that ends first is won on the most points); cut [{ at, out, tie, quiet }], players knocked out, ranked last
//            one standing (by 'standing': whoever's still in by their points, then whoever went out last), the game ending once
//            one is left: at { every: n } (every n episodes of the game, the lowest by their points over those n: the
//            guillotine; ties to the total) | { episode: n } | { phase: id } (the bottom by their total, after that episode or
//            the episode before the phase starts); out n (how many go) | 'half' (the bottom half, rounded down); tie keep
//            (nobody tied at the line goes) | all (everyone tied at it goes, never everyone left); quiet cut (a night nobody
//            goes home is cut like any other) | skip (no cut that night). A knocked-out player scores nothing after their
//            last episode in, makes no more moves, and in an exclusive draft their castaways are back in the pool. Only final
//            results move either (an episode with its early results waits): KnockoutLogic in state-logic.js
//   ask      questions answered before their lock, each settled by data (A4: the question below). Beside a draft, its
//            finale predictions (finaleQuestions); a game scored by answers, its own (Weekly Calls': the show's calls,
//            CALLS)
//   closes   'start': moves lock at each episode's start (today's airtime lock); sports: 'daily' | 'weekly'
//   extras   the details nobody asked about, recommended and out of sight (EXTRAS below)
//
// Who builds each value is in VOCAB: 'now' the engine plays it today (after A2, through the spec; a phase start since A3;
// questions since A4), 'sports' the sports branch, 'later' no step yet. specProblems says what's wrong with a spec, specWaitsFor what
// it needs that isn't built. Pure, plain CommonJS like formats/, so state-logic.js can read it (A2).

const SPEC_VERSION = 1;

/** Who builds each value. A value not listed isn't one. */
const VOCAB = {
  'get.by': { draft: 'now', pick: 'now', card: 'now', none: 'now', squares: 'sports' },
  'get.order': { snake: 'now', blind: 'now', draw: 'now', auction: 'now' },
  'get.own': { exclusive: 'now', shared: 'now' },
  'get.repeat': { cycle: 'now' },
  count: { start: 'now', all: 'now', pick: 'now', best: 'now' },
  'score.by': { moments: 'now', place: 'now', survive: 'now', lines: 'now', answers: 'now', stats: 'sports' },
  'score.means': { staysIn: 'now', scores: 'now' },
  'rank.by': { total: 'now', streak: 'now', standing: 'now', worth: 'now', matchups: 'sports', categories: 'sports', roto: 'sports' },
  closes: { start: 'now', daily: 'sports', weekly: 'sports' },
  'pool.where': { stillIn: 'now', teams: 'sports', group: 'later' },
  'ask.answer': {
    person: 'now', group: 'now', yesNo: 'now', number: 'now', overUnder: 'now', choice: 'now', calls: 'now',
    order: 'now', confidence: 'now', chips: 'now', split: 'now', pairs: 'now', side: 'sports',
  },
  'ask.settle': { results: 'now', moment: 'now', role: 'now', phase: 'now', points: 'now', calls: 'now', final: 'sports', stat: 'sports' },
  'ask.asked': { once: 'now', each: 'now', every: 'now', phase: 'now' },
  'ask.closes': { start: 'now', finale: 'now' },
  'ask.from': { cast: 'now', team: 'now' },
  'ask.each': { person: 'now' },
  // A9: how a right answer's points are shared, and what makes them shrink.
  'ask.share': { split: 'now', only: 'now' },
  'ask.shrink.per': { episode: 'now', change: 'now' },
  // F3 part 2: what a group question asked each episode does when its groups (a season played in pairs, read from the format's
  // state over time) aren't sure at the lock or as played: void that episode's question, no points either way, or follow the
  // people (a group graded by who was in it as offered). A12 adds starting the game's next stage.
  'ask.fallback': { void: 'now', 'carry-on': 'now', 'next-stage': 'later' },
  // A9 part 2: when a draft's points multiply (score.times): an episode, a run of them, a phase of the season, its finale.
  'score.times': { episode: 'now', from: 'now', phase: 'now', finale: 'now' },
  // A10 part 1: group slots (get.groups), a draft's +1 or +2 slot that holds a pair or a team the show forms, read from the
  // format's state over time: whether two people can hold the same group, what a slot does when the groups at its lock or as
  // the episode was played aren't sure (void that episode for the slot, or follow the people), and how a group's points are
  // its members' (their mean: the slot scores like one more person; or their sum).
  'get.groups.own': { shared: 'now', exclusive: 'now' },
  'get.groups.fallback': { void: 'now', 'carry-on': 'now', 'next-stage': 'later' },
  'get.groups.points': { mean: 'now', sum: 'now' },
  // A10 part 2: what a pool's second pick does on a night only one goes home (void: no points either way; counts: scored like
  // the first, so two picks every episode).
  'get.second.fallback': { void: 'now', counts: 'now' },
  // A10 part 3: a draft spread across the cast's groups (get.across): which groups (the tribes or teams the data has them on
  // when it drafts; a guy and a girl needs data that says who is which, and no show's records it: settleProblems refuses it),
  // and what a drafted castaway does when they change group or the groups end (a swap, the merge): keep, still yours.
  'get.across.of': { group: 'now', gender: 'later' },
  'get.across.then': { keep: 'now' },
  // A10 part 3b: a draft's prices (get.budget). What a castaway costs is what you bid (an auction: get.order 'auction'), or their
  // price from the data (a salary cap: any other draft), each castaway's points so far by the game's own rules. What someone gone
  // home counts for against a cap (nothing, or the price they went home at), and what an auction does for a team its bids didn't
  // fill (fill it from what's left at the lowest price, or leave it short).
  'get.budget.gone': { zero: 'now', last: 'now' },
  'get.budget.fallback': { fill: 'now', short: 'now' },
  // A10 part 3c: buying and selling each week (get.budget.trade: a stock market, on part 3b's prices). What a draft's money left
  // over does (an auction's, or a cap's): cash to trade with, lost (trading is a sale to buy), or a budget to bid on free agents
  // with on waivers (blind bidding: no step yet).
  'get.budget.left': { cash: 'now', lost: 'now', bids: 'later' },
  // A10 part 4: keepers across seasons (get.keep: a game that continues last season's). What a keeper costs (a place on your
  // team and nothing else; one of a snake's earliest rounds; their price at the draft, from a budget priced by the data), and
  // what happens for someone who names nobody by the draft (they keep their best who are back, or nobody).
  'get.keep.cost': { place: 'now', round: 'now', price: 'now' },
  'get.keep.fallback': { best: 'now', none: 'now' },
  // A11 part 1: players knocked out of a draft (rank.cut): when (every n episodes, by the points over them: the guillotine; after
  // an episode, or before a phase of the season starts, by the total), what a tie at the line does (nobody at it goes, or all
  // of them, never everyone left), and what a night nobody goes home does (cut like any other, or skipped).
  'rank.cut.at': { every: 'now', episode: 'now', phase: 'now' },
  'rank.cut.tie': { keep: 'now', all: 'now' },
  'rank.cut.quiet': { cut: 'now', skip: 'now' },
};

// A question in `ask` (A4; A6 added who a moment happened to, groups, roles and questions about each person):
//   { id, ask: 'Who goes home?', answer, points, settle, asked, closes, pick?, from?, line?, options?, each? }
//   id      its key, for its answers (game_answers.question): letters, digits, '.', '_' or '-', up to 40
//   answer  person (`pick` of them, each right one scores; `from` the cast still in, or a draft's own team) | group (a
//           tribe, a team: `pick` of them, from the groups someone still in is on) | yesNo | number (the closest wins,
//           ties all) | overUnder (with line: a number, or null for the wizard to ask) | choice (with options) | calls
//           (the show's two calls each episode, Call it's: CALLS); sports: side. A8:
//             order       `pick` people in order (the boot order, a leaderboard): its points for each in their right place, or
//                         within `within` places of it
//             confidence  `pick` people, most sure first: each right one scores its points times its weight (the first
//                         `pick`, the last 1: "you score your confidence on whoever goes")
//             chips       `chips` spread over people, { castawayId: chips }: each chip on a right one scores its points
//             split       a vote split, numbers ("5-2-1"): right when it's the split exactly
//             pairs       `pairs` pairs drawn from who's in at the game's start (the same every time), { "a|b" (the pair's
//                         ids, sorted): castawayId }: who outlasts whom, its points for each pair right
//   wager   (A8) a yes or no, a choice, an over/under, or one person or group: stake up to `wager` of your points on it,
//           { answer, stake }: right, its points and the stake; wrong, the stake lost. A9: 'total', any of your points (the
//           game's, as they stand for you when you answer: "bet any of your points, double or nothing")
//   A9, how its points combine (a wager plays alone: none of these go with one):
//   share   split: its points are a pot for each window, split between everyone right (by what each would have earned: a
//           right pick each), so rarer right calls win more | only: a right answer scores only when nobody else's does
//   rollover  true (asked each, every N or by phase): a window nobody earns anything on (nobody right, or it didn't count)
//           carries its points, and whatever it carried, into the next
//   shrink  { points, per: episode | change } (asked once, closing at the finale: the only questions open once the game is on):
//           an answer's points shrink by `points` for each of the game's episodes that had started when it was made (the
//           earlier you call it, the more it's worth: A15's "a call pinned to when you made it", on the episode clock), or
//           for each change made once the game started, a first answer made then counting as one ("seal a winner pick
//           before the premiere; every change costs a point"); never below 0. The answers carry when (game_answers.late,
//           changes: migration 0201)
//   points  a right answer's (a right pick's; asked of each person, each right answer's), 0 to MAX_QUESTION_POINTS
//   asked   once (for the game) | each (every episode it plays, each its own answer) | every (A7: once for each run of
//           `every` episodes from the game's first, about that run) | phase (A7: once for each phase of the season the game
//           plays, about the phase: the game's first, then each later one from the first episode still open once data says
//           where it starts). An answer is for its window: the episode it opens at (game_answers.episode)
//   over    (A7) asked each, about that episode and the next over - 1: a rolling window ("within the next 3 episodes")
//   every   (A7) asked every: how many episodes each run is, 2 to MAX_WINDOW
//   closes  start: when its window's first episode starts (asked each, every or by phase), or the game's first does (asked
//           once) | finale: when the season's last episode starts (asked once). Never once data has settled it. The lock is
//           the engine's closedForPlay, so whoever runs the game can keep an episode open past its start or lock it early;
//           a game with a late lock (extras.lateLock) keeps it open for someone who hasn't seen the episode (A7)
//   fallback  (F3 part 2) a group answer asked each episode, on a season played in groups the league doesn't hold (pairs:
//           read from the format's state over time, format-timeline.js groupFacts): what it does when the groups at the lock,
//           or as the episode was played, aren't sure. void (the default, the safe one; the default is the user's to set):
//           that episode's question doesn't count, no points either way | carry-on: follow the people, a group graded by
//           who was in it as offered | next-stage (A12). A group offered that didn't play the episode as offered (re-drawn
//           at its start) is void for whoever picked it, whatever the fallback but carry-on
//   each    'person': one question about each person still in when it closes, an answer for each ("each couple's
//           score"), still one question of the 12: a yes or no, a number, an over/under or a choice, settled for each
//           person by their own moment (happened, count) or whether they go home (out) or stay (stays)
//   settle  shows:
//             { by: 'results', take: winner | out | placed | top | stays, place? } out: who goes home in the episode (a
//               group answer: the groups they were on); asked once, the first to go in the game; over a window (A7),
//               anyone who went home in it; stays: who doesn't (an episode's: asked each); winner, placed and top are the
//               season's: asked once, in a game that runs to the season's end; placed: who finished `place`th, top: in
//               the top `place`
//             { by: 'moment', moment: id, take: happened | count | who | most | first } in the episode (asked once, over
//               the game; over a window, A7): whether it happened, how many times (a per-unit moment's units: a couple's
//               judges' points), who it happened to (a group answer: the groups they were on then), who it happened to
//               most (ties all), or first (A7: who it happened to in the first episode it did; a number, which episode)
//             { by: 'phase', phase: id, take: starts | happened } (A7) a phase of the season (not its first): the episode
//               it starts (a number, asked once), or whether it starts in the episode or window
//             { by: 'role', role: name, take: who | end | count } a secret role (The Traitors): who held it (in the
//               episode, or ever in the game), who held it among those still in at its end (after the episode; asked
//               once, those in at the game's last episode), and how many of them
//             A8: { by: 'results', take: order | split | outlast } the order they went home (the boot order, over the
//               window), the season's jury vote split (the finalists' votes), who outlasted whom (pairs); { by: 'moment',
//               take: order } everyone by how many times it happened to them (a leaderboard: a couple's judges' points);
//               { by: 'points', take: most | order } each person's points in it by the game's rules (their moments at the
//               rulebook's points): who scored most, the leaderboard
//             { by: 'calls' } (Call it's)
//           sports: { by: 'final', take: winner | total | margin } | { by: 'stat', stat, take: most | least | value }
const TAKES = {
  results: ['winner', 'out', 'placed', 'top', 'stays', 'order', 'split', 'outlast'],
  moment: ['happened', 'count', 'who', 'most', 'first', 'order'],
  role: ['who', 'end', 'count'],
  phase: ['starts', 'happened'],
  points: ['most', 'order'],
  calls: [],
  final: ['winner', 'total', 'margin'],
  stat: ['most', 'least', 'value'],
};
/** The settles that are the season's (known at its end): asked once, in a game that runs to the season's end. */
const SEASON_TAKES = ['results:winner', 'results:placed', 'results:top', 'results:split'];
/** The settles each kind of answer can be graded by ('by:take'). A choice is matched to whatever settles it: a count's (and
 *  an episode's) range, a yes or no, or names. */
const NUMBERS = ['moment:count', 'role:count', 'phase:starts', 'final:total', 'final:margin', 'stat:value'];
/** Who's right, as people (A8's confidence and chips are graded by any of them). */
const PEOPLE = ['results:winner', 'results:out', 'results:placed', 'results:top', 'results:stays', 'moment:who', 'moment:most', 'moment:first', 'role:who', 'role:end', 'points:most'];
const SETTLES_FOR = {
  person: [...PEOPLE, 'stat:most', 'stat:least'],
  group: ['results:out', 'moment:who'],
  order: ['results:order', 'moment:order', 'points:order'],
  confidence: PEOPLE,
  chips: PEOPLE,
  split: ['results:split'],
  pairs: ['results:outlast'],
  side: ['final:winner'],
  yesNo: ['moment:happened', 'phase:happened'],
  // A number is a count, or an episode (which one a phase starts in, or a moment first happens in).
  number: [...NUMBERS, 'moment:first'],
  overUnder: [...NUMBERS, 'moment:first'],
  choice: null,
  calls: ['calls:'],
};
/** A window's most episodes (asked every N; over N). */
const MAX_WINDOW = 10;
/** A late lock's hours past the air time (extras.lateLock, A7). */
const LATE_HOURS = [12, 24, 48, 72];
/** Whether a question is about a run of episodes (A7): asked every N, by phase, or each over N. */
const windowed = (q) => isObj(q) && (q.asked === 'every' || q.asked === 'phase' || (q.asked === 'each' && isInt(q.over, 2)));
/** A question about each person (A6), by its answer: what settles it for each of them, from their own moment (whether it
 *  happened to them, how many times) or whether they went home or stayed. */
const EACH_SETTLES_FOR = {
  yesNo: ['moment:happened', 'results:out', 'results:stays'],
  number: ['moment:count'],
  overUnder: ['moment:count'],
  choice: ['moment:happened', 'moment:count', 'results:out', 'results:stays'],
};
/** The answers that name someone (a person) or something (a group), `pick` of them. */
const NAMES = ['person', 'group'];
/** The answers that rank people (A8), `pick` of them, up to MAX_ORDER (a whole cast's boot order). */
const RANKS = ['order', 'confidence'];
const MAX_ORDER = 24;
/** A8: an order's most places off that still score; most chips to spread; most pairs. */
const MAX_WITHIN = 5;
const MAX_CHIPS = 100;
const MAX_PAIRS = 12;
/** A8: the answers a wager goes on (one answer, right or wrong). */
const WAGERS = ['person', 'group', 'yesNo', 'choice', 'overUnder'];
/** A9: a wager of any of your points ('total'); how a right answer's points are shared; what a shrink counts. */
const WAGER_TOTAL = 'total';
const SHARES = ['split', 'only'];
const SHRINK_PER = ['episode', 'change'];
/** A9: a parlay's legs (2 to MAX_LEGS, each one answer that's right or wrong) and its most multiplier; most parlays. */
const LEGS = ['person', 'group', 'yesNo', 'choice', 'number', 'overUnder'];
const MAX_LEGS = 4;
const MAX_TIMES = 10;
const MAX_PARLAYS = 6;
/** A9 part 2: the most windows a draft's points multiply in (score.times), and what each one says when it is. */
const MAX_WHEN = 8;
const WHEN = ['episode', 'from', 'phase', 'finale'];
/** A10 part 1: a draft's most group slots (the user's "+1 or +2"), and a slot's defaults when the spec leaves them out (the
 *  user's to set: the plan's Noticed for A10). */
const MAX_GROUP_SLOTS = 2;
const GROUP_SLOTS = { slots: 1, own: 'shared', swap: false, fallback: 'void', points: 'mean' };
/** A10 part 2: a pool's most lives, buybacks, mulligans and a buyback's most cost; a buyback's and a second pick's defaults when
 *  the spec leaves them out (the user's to set: the plan's Noticed for A10 part 2). A buyback's cost left out is one right
 *  pick's points (score.points, up to MAX_BUYBACK_COST): fullSpec fills it. */
const MAX_LIVES = 5;
const MAX_BUYBACKS = 3;
const MAX_MULLIGANS = 3;
const MAX_BUYBACK_COST = 20;
const BUYBACK = { times: 1, before: null };
const SECOND_PICK = { fallback: 'void' };
/** A10 part 3: a spread draft's defaults when the spec leaves them out, and a draw's ownership (names out of a hat: each one
 *  different; the exclusive-or-shared count makes it shared where the pool doesn't cover it). The user's to set (Noticed). */
const DRAFT_ACROSS = { then: 'keep' };
const DRAW_OWN = 'exclusive';
/** A10 part 3b: a budget's most, and its defaults when the spec leaves them out (the user's to set: Noticed): everyone's 100 (the
 *  user's "everyone gets $100"), the lowest price or bid 1; a salary cap counts someone gone home as nothing; an auction fills a
 *  team its bids didn't from what's left at the lowest price. A cap's ceiling left out is ceilingFor's. A sealed bid sheet holds
 *  up to MAX_BIDS bids. */
const MAX_BUDGET = 1000;
const BUDGET = { total: 100, floor: 1 };
const CAP = { gone: 'zero' };
const AUCTION = { fallback: 'fill' };
const MAX_BIDS = 40;

/**
 * A salary cap's highest price when the spec leaves it out: the one that makes the middle price (what everyone costs before
 * anyone's scored: halfway between the lowest and the highest) the most a team of `each` can average within its budget, so an
 * average team fits and the cap bites once the data spreads the prices. Between the lowest price and the budget. Pure.
 */
function ceilingFor(total, each, floor) {
  if (!isInt(total, 1) || !isInt(each, 1) || !isInt(floor, 0)) return null;
  return Math.min(total, Math.max(floor, 2 * Math.floor(total / each) - floor));
}

/**
 * A draft's prices (A10 part 3b), as the engine plays them (state-logic.js PriceLogic, BudgetLogic, AuctionLogic, MarketLogic) and
 * the words say them, read the one way from a whole spec: { auction (true: what a castaway costs at the draft is a bid; false:
 * their price from the data, a salary cap), total (everyone's), floor (the lowest price or bid), ceiling and gone (a cap's, and a
 * market's after an auction: its prices from the data), fallback (an auction's), trade ({ fee }: part 3c's stock market, buying
 * and selling each week at the data's prices; absent without it), left (what the draft's money left over does: a market's, or one
 * said) }, or null for a draft without them.
 */
function budgetParts(s) {
  const g = isObj(s) && isObj(s.get) ? s.get : null;
  if (!g || g.by !== 'draft' || !isObj(g.budget)) return null;
  const b = g.budget;
  const auction = g.order === 'auction';
  const total = isInt(b.total, 1) ? b.total : BUDGET.total;
  const floor = isInt(b.floor, 0) ? b.floor : BUDGET.floor;
  const out = { auction, total, floor };
  const trade = isObj(b.trade) ? { fee: isInt(b.trade.fee, 0) ? b.trade.fee : TRADE.fee } : null;
  if (auction) out.fallback = own(VOCAB['get.budget.fallback'], b.fallback) ? b.fallback : AUCTION.fallback;
  if (!auction || trade) {
    out.ceiling = isInt(b.ceiling, 0) ? b.ceiling : ceilingFor(total, g.each, floor);
    out.gone = own(VOCAB['get.budget.gone'], b.gone) ? b.gone : CAP.gone;
  }
  if (trade) out.trade = trade;
  const left = own(VOCAB['get.budget.left'], b.left) ? b.left : trade ? MARKET_LEFT : null;
  if (left) out.left = left;
  return out;
}
/** A stock market (A10 part 3c): a draft with a budget that trades. */
const marketOf = (s) => !!(isObj(s) && isObj(s.get) && s.get.by === 'draft' && isObj(s.get.budget) && isObj(s.get.budget.trade));

/** A10 part 4: keepers' defaults when the spec leaves them out (the user's to set: Noticed). One keeper each; someone who names
 *  nobody by the draft keeps their best who are back. What a keeper costs: their price where the draft is a stock market's (its
 *  cash), else a place on the team. */
const KEEP = { each: 1, fallback: 'best' };
const keepCostFor = (s) => (marketOf(s) ? 'price' : 'place');
/**
 * Keepers across seasons (A10 part 4: get.keep), as the engine plays them (state-logic.js KeeperLogic) and the words say them,
 * read the one way from a whole spec: { each, from, cost, fallback }, what it leaves out its defaults, or null for a game
 * without them.
 */
function keepParts(s) {
  const g = isObj(s) && isObj(s.get) ? s.get : null;
  if (!g || g.by !== 'draft' || !isObj(g.keep)) return null;
  const k = g.keep;
  return {
    each: isInt(k.each, 1) ? k.each : KEEP.each,
    from: typeof k.from === 'string' ? k.from : null,
    cost: own(VOCAB['get.keep.cost'], k.cost) ? k.cost : keepCostFor(s),
    fallback: own(VOCAB['get.keep.fallback'], k.fallback) ? k.fallback : KEEP.fallback,
  };
}

/**
 * A spread draft's bounds (A10 part 3: get.across) for a team of `each` over `groups` groups: no more than `most` from one,
 * at least `least` from each (while it has someone to take). Null when the show isn't divided (fewer than two groups): a
 * plain draft. Pure: SpreadLogic in state-logic.js plays it, the words and the count read it.
 */
function spreadBounds(each, groups) {
  if (!isInt(each, 1) || !isInt(groups, 2)) return null;
  return { least: Math.floor(each / groups), most: Math.ceil(each / groups) };
}

/**
 * Whether a pool covers every pick of an exclusive draft (the 9:10 PM decision, Decisions: "Exclusive or shared"): `people`
 * each taking `each` from `pool`, nobody sharing. Counted where the game drafts, and again wherever the pool shrinks (a later
 * stage's draft, a side draft, group slots among a handful of pairs: GroupSlotLogic counts each opening). Pure.
 */
function covers({ pool, people, each }) {
  return isInt(pool, 0) && isInt(people, 0) && isInt(each, 0) && people * each <= pool;
}

/**
 * The teams the exclusive count counts (A10 part 4b), from specProblems' ctx: `ctx.teams` when it's given (a team two people
 * share is one team: teams, not people), else `ctx.couch` (everyone their own team, the most there can be: fail closed). As
 * { n, said } ("7 of you", "6 teams"), or null when neither is a count.
 */
function teamsOf(ctx) {
  const c = isObj(ctx) ? ctx : {};
  if (isInt(c.teams, 1)) return { n: c.teams, said: c.teams === c.couch ? `${c.teams} of you` : `${c.teams} ${c.teams === 1 ? 'team' : 'teams'}` };
  return isInt(c.couch, 1) ? { n: c.couch, said: `${c.couch} of you` } : null;
}
const MAX_QUESTIONS = 12;
const MAX_PICK = 10;
const MAX_QUESTION_POINTS = 100;
const MAX_OPTIONS = 12;
const QUESTION_ID = /^[A-Za-z0-9][\w.-]{0,39}$/;

// The settings' own vocabularies, as state-logic.js reads them (WaiverLogic, the draft timer, side bets).
const REPLACE_RULES = ['always', 'whenShort', 'windows', 'never'];
const WINDOW_SCHEDULES = ['everyEpisode', 'every', 'manual'];
const WAIVER_FEELS = ['casual', 'balanced', 'competitive'];
const WAIVER_ORDERS = ['rolling', 'leastPoints', 'mostPoints'];
const WAIVER_HOURS = [12, 24, 48];
const DRAFT_TIMERS = [0, 60, 120];
const MAX_BET_POINTS = 3;
const JOINS = ['open', 'ask', 'locked'];

// The extras: { waivers, bets, calls, draft, join, hideStarters, lockedDown }
//   waivers       a draft's mid-season moves, or null (no waivers: shared Outlast, no draft):
//                 { feel, replace, short, windows: { schedule, every, swaps }, order, hours, freeAgency, autoFill }
//                 (replaceRule, replenishAt, waiverWindows, replenishOrderBy, waiverProcessHours, ...: WaiverLogic)
//   bets          side bets ("Predictions", graded by whoever runs the game): { points } (each new one's), or null. Only
//                 beside a draft, the games that score them (A4: a pool, Weekly Calls and Weekly Bingo never did)
//   calls         a Survival Pool's weekly Who goes home? call beside the pick (the public pool): counted, not ranked
//   draft         a draft's room: { at: ISO | null, timer: 0 | 60 | 120 (seconds a pick), away: wait | queue }
//   join          who can join: open (anyone on the couch) | ask | locked (nobody new) | null (recommended: open where
//                 castaways can be on several teams, else ask)
//   hideStarters  a lineup's starters stay hidden until the lock
//   lockedDown    Lock it down: nobody new joins and the rules don't change for the season
//   lateLock      (A7) a game of questions' late lock: { hours: 12 | 24 | 48 | 72 }, or null. Someone who hasn't seen an
//                 episode can still answer its questions after it starts, until they've seen it, up to that many hours past
//                 its air time; everyone else's answers stay hidden from them until then
//   seats         (A10 part 4b) a team two people share: { people: 2 to MAX_SEAT_PEOPLE }, how many accounts can hold one seat
//                 (a second joins by an invite to that seat, while it has room). Left out (or null): one a seat, as every game
//                 today; fullSpec leaves it out then, so no stored spec changes. Not beside Weekly Calls or Weekly Bingo, or a
//                 pool's weekly call: those are each person's own (a call, a card), so a seat has nothing to share

/** Waivers off: a draft as Start a game makes one today (nothing replaced, windows only when opened). */
const NO_WAIVERS = {
  feel: 'balanced',
  replace: 'never',
  short: null,
  windows: { schedule: 'manual', every: 3, swaps: 0 },
  order: 'rolling',
  hours: 24,
  freeAgency: true,
  autoFill: true,
};
/** A10 part 3c: a stock market's defaults when the spec leaves them out (the user's to set: Noticed). A trade costs nothing; a
 *  draft's money left over is cash to trade with. Its trades are its waivers' moves, so a market whose spec leaves its waivers out
 *  gets marketWaivers: a window after every episode, its whole team tradeable in each (a swap sells one still in), and someone gone
 *  home sold and replaced whenever (replace 'always'); the rest as waivers off. */
const TRADE = { fee: 0 };
const MARKET_LEFT = 'cash';
const marketWaivers = (each) => ({ ...NO_WAIVERS, replace: 'always', windows: { schedule: 'everyEpisode', every: 3, swaps: isInt(each, 1) ? each : 1 } });
const DRAFT_ROOM = { at: null, timer: 0, away: 'wait' };
const BETS = { points: 1 };
/** A10 part 4b: a seat two people share. Its default when the spec says `seats: {}` (the user's to set: Noticed), and the most
 *  accounts one seat holds. */
const SEATS = { people: 2 };
const MAX_SEAT_PEOPLE = 4;
// A11 part 1: a race's finish line (rank.race.to), and players knocked out (rank.cut): up to MAX_CUTS of them, each sending
// 1 to MAX_CUT_OUT (or half); what a cut leaves out are the defaults (CUT: one goes, a tie at the line keeps them all, a night
// nobody goes home cuts like any other). The defaults are the user's to set (A11 part 1's Noticed).
const MAX_RACE = 1000;
const MAX_CUTS = 4;
const MAX_CUT_OUT = 20;
const CUT = { out: 1, tie: 'keep', quiet: 'cut' };
const CUT_AT = ['every', 'episode', 'phase'];
/** A draft's race and cuts (A11 part 1), read the one way from a whole spec: { race: { to } | null, cuts: [...] }, or null for a
 *  game with neither (every game before it). */
function knockoutParts(s) {
  if (!isObj(s) || !isObj(s.get) || s.get.by !== 'draft' || !isObj(s.rank)) return null;
  const race = isObj(s.rank.race) && isInt(s.rank.race.to, 1) ? { to: s.rank.race.to } : null;
  const cuts = Array.isArray(s.rank.cut) ? s.rank.cut.filter((c) => isObj(c) && isObj(c.at)).map((c) => ({ ...CUT, ...c })) : [];
  return race || cuts.length ? { race, cuts } : null;
}
/** How many accounts can hold one of a whole spec's seats (extras.seats): 1 unless it shares them. */
const seatPeople = (s) => (isObj(s) && isObj(s.extras) && isObj(s.extras.seats) && isInt(s.extras.seats.people, 2) ? s.extras.seats.people : 1);

const extrasOf = (o) => ({ waivers: null, bets: null, calls: false, draft: null, join: null, hideStarters: false, lockedDown: false, lateLock: null, ...o });

// The ask presets (A4: "Weekly Calls and finale predictions become presets of ask").
//
// CALLS, Weekly Calls' one question: the show's two calls each episode (calls.ts callQuestions: who goes home, where someone
// does every episode, and a yes or no on one of the show's moments, round its callable ones; a talk show's two moments). Its
// answers are Call it's, a person's whichever couch they're on (episode_calls), so a call is made once for every game that
// counts it; settled by the season's results, or a talk show's by the couch (its word: a league's own only, never the GPT's).
const CALLS = { id: 'calls', ask: 'Two calls before each episode', answer: 'calls', points: 1, settle: { by: 'calls' }, asked: 'each', closes: 'start' };
/**
 * A draft's finale predictions as two questions: name the final three (any order, each right one scores its points) and
 * the winner, from the cast still in or only your own team (`from`: any | own, as the settings say it). Asked once, until
 * the season's last episode starts; settled by the results (the winner's exit, the order everyone finished in). Their
 * answers stay in the league's state (state.finalePredictions), where classic's finale panel writes them.
 */
function finaleQuestions(f) {
  const from = f && f.from === 'own' ? 'team' : 'cast';
  const pts = (v) => (isNum(v) ? v : 0);
  return [
    { id: 'top3', ask: 'Who makes the final three?', answer: 'person', points: pts(f && f.top3), settle: { by: 'results', take: 'top', place: 3 }, asked: 'once', closes: 'finale', pick: 3, from },
    { id: 'winner', ask: 'Who wins?', answer: 'person', points: pts(f && f.winner), settle: { by: 'results', take: 'winner' }, asked: 'once', closes: 'finale', pick: 1, from },
  ];
}
/** The finale predictions an ask is ({ top3, winner, from: any | own }, their points), or null when it isn't exactly them. */
function finaleOf(ask) {
  if (!Array.isArray(ask) || ask.length !== 2) return null;
  const top3 = ask.find((q) => isObj(q) && q.id === 'top3');
  const winner = ask.find((q) => isObj(q) && q.id === 'winner');
  if (!top3 || !winner || !isNum(top3.points) || !isNum(winner.points)) return null;
  const f = { top3: top3.points, winner: winner.points, from: top3.from === 'team' ? 'own' : 'any' };
  const want = finaleQuestions(f);
  return sameValue(ask, want) ? f : null;
}
/** Weekly Calls' question (the show's calls). */
const isCalls = (q) => isObj(q) && q.answer === 'calls';
/** An ask that's exactly the show's calls (Weekly Calls). */
const callsAsk = (ask) => Array.isArray(ask) && ask.length === 1 && sameValue(ask[0], CALLS);

/** A question with what it leaves out filled in: asked once, closing at the start; a person answer one pick from the cast, a
 *  group answer one group. */
function fullQuestion(q) {
  if (!isObj(q)) return q;
  const out = { ...q };
  if (out.asked === undefined) out.asked = 'once';
  if (out.closes === undefined) out.closes = 'start';
  if (NAMES.includes(out.answer) && out.pick === undefined) out.pick = 1;
  if (out.answer === 'person' && out.from === undefined) out.from = 'cast';
  return out;
}

/** A choice option as a range a count falls in: "2" (exactly), "3+" (3 or more), "0-1" (0 to 1); else null. */
function optionRange(o) {
  const t = String(o).trim();
  let m = /^(\d+)$/.exec(t);
  if (m) return { min: +m[1], max: +m[1] };
  m = /^(\d+)\s*\+$/.exec(t);
  if (m) return { min: +m[1], max: Infinity };
  m = /^(\d+)\s*[-\u2013]\s*(\d+)$/.exec(t);
  if (m && +m[1] <= +m[2]) return { min: +m[1], max: +m[2] };
  return null;
}
/** A yes-or-no answer, as it's stored. */
const YES_NO = ['yes', 'no'];

/**
 * Today's five games, as Start a game makes them (StateLogic.defaultState, then makeLeague's type): each a spec with
 * defaults. Outlast = draft, all count, place, total. Weekly Lineup = draft, start n, moments, total. Survival Pool = pick,
 * the pick counts, survive, streak. Weekly Calls = no draft, calls. Weekly Bingo = a card, lines.
 */
const PRESETS = {
  outlast: {
    spec: SPEC_VERSION, preset: 'outlast', span: { from: 1, to: null }, pool: { of: 'cast', where: { stillIn: true } },
    get: { by: 'draft', each: 3, order: 'snake', own: 'exclusive' }, count: { all: true }, score: { by: 'place' },
    rank: { by: 'total' }, ask: [], closes: 'start',
    extras: extrasOf({ waivers: NO_WAIVERS, bets: BETS, draft: DRAFT_ROOM }),
  },
  'weekly-lineup': {
    spec: SPEC_VERSION, preset: 'weekly-lineup', span: { from: 1, to: null }, pool: { of: 'cast', where: { stillIn: true } },
    get: { by: 'draft', each: 5, order: 'blind', own: 'shared' }, count: { start: 3 }, score: { by: 'moments', points: null },
    rank: { by: 'total' }, ask: [], closes: 'start',
    extras: extrasOf({ waivers: NO_WAIVERS, bets: BETS, draft: DRAFT_ROOM }),
  },
  'survival-pool': {
    spec: SPEC_VERSION, preset: 'survival-pool', span: { from: 1, to: null }, pool: { of: 'cast', where: { stillIn: true } },
    get: { by: 'pick', each: 1, repeat: 'cycle' }, count: { pick: true }, score: { by: 'survive', means: 'staysIn', points: 1 },
    rank: { by: 'streak' }, ask: [], closes: 'start',
    extras: extrasOf({}),
  },
  'weekly-calls': {
    spec: SPEC_VERSION, preset: 'weekly-calls', span: { from: 1, to: null }, pool: { of: 'cast', where: { stillIn: true } },
    get: { by: 'none' }, count: null, score: { by: 'answers' }, rank: { by: 'total' }, ask: [CALLS], closes: 'start',
    extras: extrasOf({}),
  },
  'weekly-bingo': {
    spec: SPEC_VERSION, preset: 'weekly-bingo', span: { from: 1, to: null }, pool: { of: 'cast', where: { stillIn: true } },
    get: { by: 'card' }, count: null, score: { by: 'lines' }, rank: { by: 'total' }, ask: [], closes: 'start',
    extras: extrasOf({}),
  },
};

// Shared by every caller (and NO_WAIVERS and DRAFT_ROOM by every preset), so nobody can change them in place: fullSpec
// hands out copies.
const deepFreeze = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
};
deepFreeze(PRESETS);

/** The league type (settings.leagueTypeId) each preset plays as, and back. */
const PRESET_TYPES = { outlast: 'classic-draft', 'weekly-lineup': 'active-roster', 'survival-pool': 'pickem', 'weekly-calls': 'weekly-calls', 'weekly-bingo': 'weekly-bingo' };
const TYPE_PRESETS = Object.fromEntries(Object.entries(PRESET_TYPES).map(([p, t]) => [t, p]));
/** What people call each one (rulebook-schema.js GAME_LABELS). */
const PRESET_LABELS = { outlast: 'Outlast', 'weekly-lineup': 'Weekly Lineup', 'survival-pool': 'Survival Pool', 'weekly-calls': 'Weekly Calls', 'weekly-bingo': 'Weekly Bingo' };

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v, min) => Number.isInteger(v) && v >= (min === undefined ? 0 : min);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
/** obj[key] when it's obj's own (never Object.prototype's: a preset called "constructor" is no preset). */
const own = (obj, key) => (typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined);
/** The preset a spec names, or null. */
const presetOf = (s) => (isObj(s) && own(PRESETS, s.preset)) || null;
/** The one key of a `count` ({ start: 3 } -> 'start'), or null. */
const countKind = (c) => (isObj(c) ? Object.keys(c).find((k) => own(VOCAB.count, k)) || null : null);
/** Two values the same, whatever order their keys are in. */
function sameValue(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  if (!isObj(a) || !isObj(b)) return false;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && sameValue(a[k], b[k]));
}

// The one set of size limits, for every write (Game settings, classic's setup, Start a game, the GPT): an Outlast team of 1
// to 10; a lineup of 1 to 8 starters and a bench of up to 6, so a team of up to 14 (once it's drafted, starters can move to
// the bench). A league's own that's already bigger keeps its size, and can come down (specProblems' opts.was).
const MAX_TEAM = 10;
const MAX_STARTERS = 8;
const MAX_BENCH = 6;
const MAX_LINEUP_TEAM = MAX_STARTERS + MAX_BENCH;

/** The order a draft's ownership makes today, and back: exclusive drafts snake, shared drafts blind. */
const ORDER_OF = { exclusive: 'snake', shared: 'blind' };
const OWN_OF = { snake: 'exclusive', blind: 'shared' };

/** The defaults of a spec with no preset, for the parts that don't depend on its mechanics (fullSpec fills those). */
const DEFAULTS = {
  span: { from: 1, to: null },
  pool: { of: 'cast', where: { stillIn: true } },
  get: { by: 'none' },
  ask: [],
  closes: 'start',
};

/** Waivers fit a draft whose castaways can come free: not a shared Outlast (WaiverLogic.supported). */
function waiversFit(spec) {
  const get = (spec && spec.get) || {};
  return get.by === 'draft' && !(spec.score && spec.score.by === 'place' && get.own === 'shared');
}
/** Finale predictions go with a draft (supportsFinalePredictions: Outlast and Weekly Lineup). */
const finaleFits = (spec) => !!(spec && spec.get && spec.get.by === 'draft');
/** Side bets go with a draft: Outlast's and Weekly Lineup's scoring are the only ones that count them (state-logic.js
 *  addSideLayers). */
const betsFit = (spec) => !!(spec && spec.get && spec.get.by === 'draft');

/**
 * The spec with everything it leaves out filled in: the preset's (when it fits what the spec says) or the defaults for its
 * mechanics. Required parts with no default (score, a draft's size) stay as they are, for specProblems to report. Never
 * changes what the spec does say, and never mutates it.
 */
function fullSpec(spec) {
  const s = isObj(spec) ? clone(spec) : {};
  const p = presetOf(s);
  if (s.spec === undefined) s.spec = SPEC_VERSION;
  if (s.preset === undefined) s.preset = null;
  // The preset's parts while the spec still gets its castaways the preset's way; a spec that changed that (a pick on a
  // Weekly Lineup) has its own game, so only the parts that don't depend on it (span, pool, ...) come from the preset.
  if (s.get === undefined) s.get = p ? clone(p.get) : clone(DEFAULTS.get);
  const fits = !!p && isObj(s.get) && s.get.by === p.get.by;
  for (const k of ['span', 'pool', 'ask', 'closes']) if (s[k] === undefined) s[k] = clone(p ? p[k] : DEFAULTS[k]);
  for (const k of ['count', 'score', 'rank']) if (s[k] === undefined && fits) s[k] = clone(p[k]);
  // A part that says some of itself takes the rest from the preset's, when it's the same kind ("draft 6 each" on a Weekly
  // Lineup is still its shared, blind draft).
  if (p) {
    for (const k of ['span', 'pool', 'get', 'score']) {
      const mine = s[k];
      const theirs = p[k];
      if (!isObj(mine) || !isObj(theirs) || mine.by !== theirs.by) continue;
      // A draft's order and ownership go together: one said is the pair, so only take both.
      const skip = k === 'get' && (mine.own !== undefined || mine.order !== undefined) ? ['own', 'order'] : [];
      for (const f of Object.keys(theirs)) if (mine[f] === undefined && !skip.includes(f)) mine[f] = clone(theirs[f]);
    }
  }
  if (isObj(s.span)) {
    if (s.span.from === undefined) s.span.from = 1;
    if (s.span.to === undefined) s.span.to = null;
  }
  if (isObj(s.pool) && s.pool.where === undefined) s.pool.where = null;
  if (Array.isArray(s.ask)) s.ask = s.ask.map(fullQuestion);
  const by = isObj(s.get) ? s.get.by : undefined;
  if (by === 'draft') {
    // A10 part 3: a draw is either ownership; said alone, nobody shares (DRAW_OWN). Part 3b: an auction is for castaways nobody
    // else can have.
    if (!s.get.own && s.get.order === 'draw') s.get.own = DRAW_OWN;
    if (!s.get.own && s.get.order === 'auction') s.get.own = 'exclusive';
    if (!s.get.own && s.get.order) s.get.own = own(OWN_OF, s.get.order);
    if (!s.get.order && s.get.own) s.get.order = own(ORDER_OF, s.get.own);
    if (!s.get.own && !s.get.order) Object.assign(s.get, { order: 'snake', own: 'exclusive' });
    // A10 part 1: group slots say what they leave out as the defaults (GROUP_SLOTS).
    if (isObj(s.get.groups)) for (const [k, v] of Object.entries(GROUP_SLOTS)) if (s.get.groups[k] === undefined) s.get.groups[k] = v;
    // A10 part 3: a spread draft says what it leaves out as the defaults (DRAFT_ACROSS).
    if (isObj(s.get.across)) for (const [k, v] of Object.entries(DRAFT_ACROSS)) if (s.get.across[k] === undefined) s.get.across[k] = v;
    // A10 part 3b: an auction always has a budget; a budget says what it leaves out as the defaults (BUDGET, and an auction's
    // AUCTION or a salary cap's CAP and ceiling).
    if (s.get.order === 'auction' && s.get.budget === undefined) s.get.budget = {};
    if (isObj(s.get.budget)) {
      const b = s.get.budget;
      const auction = s.get.order === 'auction';
      // Part 3c: a market's trading says what it leaves out as the defaults (TRADE), and its money left over is cash; after an
      // auction its prices come from the data, as a cap's do (CAP and the ceiling).
      const trade = isObj(b.trade);
      if (trade) {
        for (const [k, v] of Object.entries(TRADE)) if (b.trade[k] === undefined) b.trade[k] = v;
        if (b.left === undefined) b.left = MARKET_LEFT;
      }
      for (const [k, v] of Object.entries({ ...BUDGET, ...(auction ? AUCTION : {}), ...(!auction || trade ? CAP : {}) })) if (b[k] === undefined) b[k] = v;
      if ((!auction || trade) && b.ceiling === undefined) {
        const c = ceilingFor(b.total, s.get.each, b.floor);
        if (c !== null) b.ceiling = c;
      }
    }
    // A10 part 4: keepers say what they leave out as the defaults (KEEP, and what a keeper costs: keepCostFor).
    if (isObj(s.get.keep)) {
      const k = s.get.keep;
      for (const [f, v] of Object.entries(KEEP)) if (k[f] === undefined) k[f] = v;
      if (k.cost === undefined) k.cost = keepCostFor(s);
    }
  }
  if (by === 'pick') {
    if (s.get.each === undefined) s.get.each = 1;
    if (s.get.repeat === undefined) s.get.repeat = 'cycle';
    // A10 part 2: a second pick says what it leaves out as the defaults (SECOND_PICK).
    if (isObj(s.get.second)) for (const [k, v] of Object.entries(SECOND_PICK)) if (s.get.second[k] === undefined) s.get.second[k] = v;
  }
  // The mechanics' own: a pick counts the pick; nothing held counts nothing; a draft says what counts (no default).
  if (s.count === undefined) s.count = by === 'pick' ? { pick: true } : null;
  if (isObj(s.score) && s.score.by === 'moments' && s.score.points === undefined) s.score.points = null;
  if (isObj(s.score) && s.score.by === 'survive') {
    if (s.score.means === undefined) s.score.means = 'staysIn';
    if (s.score.points === undefined) s.score.points = 1;
    // A10 part 2: a buyback's defaults (BUYBACK), its cost one right pick's points.
    const b = s.score.buyback;
    if (isObj(b)) {
      for (const [k, v] of Object.entries(BUYBACK)) if (b[k] === undefined) b[k] = v;
      if (b.cost === undefined) b.cost = isNum(s.score.points) ? Math.min(Math.max(s.score.points, 0), MAX_BUYBACK_COST) : 1;
    }
  }
  if (s.rank === undefined) s.rank = { by: isObj(s.score) && s.score.by === 'survive' ? 'streak' : 'total' };
  // A11 part 1: a rank that says only its race or its cuts takes its order from them (cuts rank last one standing) or from the
  // game's; each cut says what it leaves out as the defaults (CUT).
  if (isObj(s.rank)) {
    if (s.rank.by === undefined) {
      s.rank.by = Array.isArray(s.rank.cut) && s.rank.cut.length ? 'standing' : fits ? p.rank.by : isObj(s.score) && s.score.by === 'survive' ? 'streak' : 'total';
    }
    if (Array.isArray(s.rank.cut)) s.rank.cut.forEach((c) => { if (isObj(c)) for (const [k, v] of Object.entries(CUT)) if (c[k] === undefined) c[k] = v; });
  }
  const e = isObj(s.extras) ? s.extras : {};
  // Waivers and the draft room follow the mechanics (a preset's are the same where they fit). The rest are the preset's
  // while the spec still gets its castaways the preset's way, else off: a game with no preset starts with no side bets.
  const pe = fits ? p.extras : null;
  const dflt = {
    // A10 part 3c: a stock market trades on its waivers (marketWaivers).
    waivers: waiversFit(s) ? (marketOf(s) ? marketWaivers(s.get.each) : NO_WAIVERS) : null,
    bets: pe ? pe.bets : null,
    calls: pe ? pe.calls : false,
    draft: isObj(s.get) && s.get.by === 'draft' ? DRAFT_ROOM : null,
    join: pe ? pe.join : null,
    hideStarters: pe ? pe.hideStarters : false,
    lockedDown: pe ? pe.lockedDown : false,
    lateLock: pe ? pe.lateLock : null,
  };
  s.extras = {};
  for (const k of Object.keys(dflt)) s.extras[k] = e[k] !== undefined ? e[k] : clone(dflt[k]);
  for (const k of Object.keys(e)) if (!(k in s.extras)) s.extras[k] = e[k];
  // A10 part 4b: a shared seat says what it leaves out as the default (SEATS); null is one a seat, said by leaving it out.
  if (s.extras.seats === null) delete s.extras.seats;
  else if (isObj(s.extras.seats)) for (const [k, v] of Object.entries(SEATS)) if (s.extras.seats[k] === undefined) s.extras.seats[k] = v;
  return s;
}

/**
 * The league type today's engine plays this spec as (settings.leagueTypeId), or null when no game plays it yet. Only the
 * mechanics decide, never the preset's name: a spec the GPT writes plays the game its parts make.
 */
function typeOf(spec) {
  return playsAs(fullSpec(spec));
}
/** typeOf on a spec that's already whole (fullSpec's, specOf's, a stored settings.game), without copying it: the engine's
 *  getLeagueType asks this on nearly every read. */
function playsAs(s) {
  if (!isObj(s)) return null;
  const by = (k) => (isObj(s[k]) ? s[k].by : undefined);
  const count = countKind(s.count);
  if (!plainParts(s)) return null;
  const none = s.ask.length === 0;
  // A10 part 3: a draw deals either ownership's teams (DrawLogic), so it plays the game a snake or blind draft would; part 3b: an
  // auction (AuctionLogic) an exclusive draft's.
  const drafted = by('get') === 'draft' && (own(ORDER_OF, s.get.own) === s.get.order || (s.get.order === 'draw' && own(ORDER_OF, s.get.own) !== undefined) || (s.get.order === 'auction' && s.get.own === 'exclusive'));
  if (drafted && (none || finaleOf(s.ask))) {
    // A11 part 1: a draft that knocks players out ranks last one standing (its race and cuts are KnockoutLogic's).
    const ranks = by('rank') === 'total' || (by('rank') === 'standing' && Array.isArray(s.rank.cut) && s.rank.cut.length > 0);
    if (count === 'all' && by('score') === 'place' && ranks) return 'classic-draft';
    // Best ball (A9 part 2) is Weekly Lineup's game with no lineups: its best n count (state-logic.js's best ball variant).
    // A10 part 3c: a stock market can rank by worth.
    if ((count === 'start' || count === 'best') && by('score') === 'moments' && (ranks || (by('rank') === 'worth' && marketOf(s)))) return 'active-roster';
  }
  // A10 part 2: a pool with lives can rank by who's still standing.
  if (by('get') === 'pick' && s.get.each === 1 && s.get.repeat === 'cycle' && count === 'pick' && by('score') === 'survive' && (by('rank') === 'streak' || by('rank') === 'standing') && none) {
    return 'pickem';
  }
  if (by('get') === 'none' && !count && by('score') === 'answers' && by('rank') === 'total') {
    if (callsAsk(s.ask)) return 'weekly-calls';
    if (!none && s.ask.length <= MAX_QUESTIONS && s.ask.every(playable)) return 'questions';
  }
  if (by('get') === 'card' && !count && by('score') === 'lines' && by('rank') === 'total' && none) return 'weekly-bingo';
  return null;
}
/** The parts every game today shares: a span (from an episode, or a phase), the cast still in, a list of questions (each
 *  game says which it plays), moves locking at the start. */
function plainParts(s) {
  const where = s.pool && s.pool.where;
  return (
    isObj(s.span) && (isInt(s.span.from, 1) || phaseFrom(s.span.from)) &&
    isObj(s.pool) && s.pool.of === 'cast' && (where === null || (isObj(where) && where.stillIn === true && Object.keys(where).length === 1)) &&
    Array.isArray(s.ask) &&
    s.closes === 'start'
  );
}
/** A question a game of questions plays today: a show's (graded from its results or its moments), its line set when it's an
 *  over/under, nobody's own team to pick from (there are no teams). Its shape is specProblems'. */
function playable(q) {
  if (!isObj(q) || isCalls(q) || !isObj(q.settle)) return false;
  if (own(VOCAB['ask.answer'], q.answer) !== 'now' || own(VOCAB['ask.settle'], q.settle.by) !== 'now') return false;
  if (q.answer === 'overUnder' && !isNum(q.line)) return false;
  if (q.fallback !== undefined && own(VOCAB['ask.fallback'], q.fallback) !== 'now') return false;
  return !(q.answer === 'person' && q.from === 'team');
}

/** A start at a phase, well formed: { phase: an id, at?: the episode it plays from }. */
const phaseFrom = (f) => isObj(f) && typeof f.phase === 'string' && !!f.phase && (f.at === undefined || isInt(f.at, 1));
/**
 * The episode a span plays from: its number, a phase start's `at` once it's settled, or null while it waits for its phase
 * (or isn't a span).
 */
function spanStart(span) {
  const f = isObj(span) ? span.from : undefined;
  if (isInt(f, 1)) return f;
  return isObj(f) && isInt(f.at, 1) ? f.at : null;
}
/** The phase a span starts at (its id), or null for one that starts at an episode. */
const spanPhase = (span) => (isObj(span) && isObj(span.from) && typeof span.from.phase === 'string' && span.from.phase ? span.from.phase : null);

/**
 * A pool's lives, buyback, mulligans and second pick (A10 part 2), as the engine plays them (state-logic.js PickEmLogic.parts)
 * and the words say them (describe.js), read the one way from a spec: { lives (null: none, nobody's out), mulligans (0: none),
 * buyback ({ times, before, cost }, only with lives; what it leaves out its defaults), second ({ fallback }), standing (last
 * one standing) }, or null for a pool with none of them (today's) or a game that isn't a pool.
 */
function poolParts(s) {
  if (!isObj(s) || !isObj(s.get) || !isObj(s.score) || s.get.by !== 'pick' || s.score.by !== 'survive') return null;
  const sc = s.score;
  const lives = isInt(sc.lives, 1) ? sc.lives : null;
  const mulligans = isInt(sc.mulligans, 1) ? sc.mulligans : 0;
  const second = isObj(s.get.second) ? { fallback: own(VOCAB['get.second.fallback'], s.get.second.fallback) ? s.get.second.fallback : SECOND_PICK.fallback } : null;
  if (lives === null && !mulligans && !second) return null;
  let buyback = null;
  if (lives !== null && isObj(sc.buyback)) {
    const b = sc.buyback;
    const points = isNum(sc.points) ? Math.min(Math.max(sc.points, 0), MAX_BUYBACK_COST) : 1;
    buyback = { times: isInt(b.times, 1) ? b.times : BUYBACK.times, before: isObj(b.before) ? b.before : null, cost: isNum(b.cost) && b.cost >= 0 ? b.cost : points };
  }
  return { lives, mulligans, buyback, second, standing: isObj(s.rank) && s.rank.by === 'standing' };
}

/**
 * The flags state-logic.js's league types carry (hasRoster, supportsReplenish, ...), worked out from a whole spec: a team
 * is a draft, a lineup a draft that starts some of it, a weekly pick a pick; calls and bingo by how it scores; waivers
 * where a draft's castaways can come free (not a shared Outlast), finale predictions with a draft.
 */
function flagsOf(s) {
  const get = isObj(s && s.get) ? s.get : {};
  const score = isObj(s && s.score) ? s.score : {};
  const waivers = waiversFit(s);
  return {
    hasRoster: get.by === 'draft',
    hasActiveRoster: get.by === 'draft' && countKind(s.count) === 'start',
    // A9 part 2: best ball, a draft whose best n count each episode (no lineups to set).
    hasBestBall: get.by === 'draft' && countKind(s.count) === 'best',
    // A10 part 1: group slots beside the draft.
    hasGroupSlots: get.by === 'draft' && isObj(get.groups),
    // A10 part 4: keepers from last season's game.
    hasKeepers: get.by === 'draft' && isObj(get.keep),
    // A11 part 1: a draft's race (first to N ends it) and players knocked out.
    hasRace: !!(knockoutParts(s) && knockoutParts(s).race),
    hasCuts: !!(knockoutParts(s) && knockoutParts(s).cuts.length),
    hasWeeklyPicks: get.by === 'pick',
    hasCalls: score.by === 'answers' && callsAsk(s && s.ask),
    // A game of questions (A4): scored by its answers, not the show's calls.
    hasQuestions: score.by === 'answers' && !callsAsk(s && s.ask),
    hasBingo: score.by === 'lines',
    supportsReplenish: waivers,
    supportsTrade: waivers,
    supportsFinalePredictions: finaleFits(s),
  };
}

/** A whole spec's sizes: the team, the starters and the bench, and how many of a best ball's count (0 where there are none). */
function sizesOf(s) {
  const each = isObj(s && s.get) && s.get.by === 'draft' && isInt(s.get.each, 1) ? s.get.each : 0;
  const start = countKind(s && s.count) === 'start' && isInt(s.count.start, 1) ? s.count.start : 0;
  const best = countKind(s && s.count) === 'best' && isInt(s.count.best, 1) ? s.count.best : 0;
  return { each, start, bench: start ? Math.max(0, each - start) : 0, best };
}

/**
 * What's wrong with a spec, as [{ at, problem }] (empty: nothing). Always its shape; with `ctx`, the data-can-settle rule
 * too: everything it scores or asks has to be something our data settles.
 *
 *   ctx.moments  the show's moments ({ id, defaultPoints, answeredBy, auto }, rulebook-moments.js momentsFor): every
 *                moment that scores (the spec's points for it, else the rulebook's) must be one research answers
 *                (answeredBy 'research', or auto: known from other answers), never the couch's word; and a moment the
 *                spec gives points must be the show's. A moment at 0 scores nothing, so nothing needs to settle it.
 *   ctx.stats    the sport's stat keys ({ key }, the Sport's: the sports branch): a stat the spec scores or asks about
 *                must be one. Absent: there are none, so nothing settles a stat.
 *   ctx.results  false when the show's results don't say who goes home or wins (a series, a talk show)
 *   ctx.phases   the season's rulebook's phases, in order ([{ id }], its blocks' season.phases): a start at a phase must
 *                be one of them, and not the first (that's Episode 1)
 *   ctx.roles    the show's secret roles (its secretRole twists' roles: ['Traitor', 'Faithful']): a role settles only if
 *                it's one. Absent: there are none
 *   ctx.grouped  false when nobody on the show is in a group (its cast has no groups): no group answers
 *   ctx.jury     false when no jury decides the finale: no jury vote split (A8)
 *   ctx.games    (A10 part 4) the couch's games on the show's earlier seasons (ids, or { id }): keepers come from one of them
 *   ctx.pool     (A10 part 1) how many can be drafted where the game drafts (the cast still in then), and ctx.couch how many
 *                people are on its couch: an exclusive draft has to cover every pick (covers: the 9:10 PM decision), else it's
 *                shared, and the problem says why ("12 of you × 3 picks is more than 18 castaways"). Either left out: not
 *                counted. A pool that shrinks later (a stage's or a side draft, group slots) is counted where it drafts again
 *                (GroupSlotLogic counts each opening)
 *   ctx.teams    (A10 part 4b) how many teams the couch makes when some share one (extras.seats): counted in place of
 *                ctx.couch, a shared team once (teamsOf). Left out: ctx.couch, everyone their own
 *
 * opts.league: the spec is a league's own (every write to a league: RosterLogic.setGame), so what it already plays stays
 * as it is: a couch-answered moment of its rules (Make it ours) and points for moments its rules don't have
 * (defaultState's copy of the default format's points, on a league for another show, or a rulebook that changed its ids:
 * they score nothing). opts.was, with it: the spec it's changing from, so the size limits hold for what grows (a league
 * already bigger keeps its size); without it a league's own has no size limits. The GPT never passes opts.league. Without
 * ctx only the shape is checked.
 */
function specProblems(spec, ctx, opts) {
  const out = [];
  const add = (at, problem) => out.push({ at, problem });
  if (!isObj(spec)) return [{ at: '', problem: 'A game spec is an object' }];
  const s = fullSpec(spec);
  const one = (key, v) => own(VOCAB[key], v) !== undefined;
  if (s.spec !== SPEC_VERSION) add('spec', `Spec version ${SPEC_VERSION} is the only one`);
  if (s.preset !== null && !presetOf(s)) add('preset', `No preset is called "${s.preset}"`);

  // span
  if (!isObj(s.span)) add('span', 'The span says which episodes it plays');
  else {
    const from = s.span.from;
    if (isObj(from)) {
      if (typeof from.phase !== 'string' || !from.phase) add('span.from.phase', 'A start at a phase names the phase');
      if (from.at !== undefined && !isInt(from.at, 1)) add('span.from.at', "Where a phase start plays from is an episode number, 1 or later (left out while it's unknown)");
    } else if (!isInt(from, 1)) add('span.from', 'It starts at an episode number, 1 or later');
    const first = spanStart(s.span);
    if (s.span.to !== null && !(isInt(s.span.to, 1) && (first === null || s.span.to >= first))) add('span.to', 'It ends at an episode from its start on, or null for the season\'s end');
  }

  // pool
  if (!isObj(s.pool) || s.pool.of !== 'cast') add('pool.of', 'The pool is the cast');
  else if (s.pool.where !== null) {
    const w = s.pool.where;
    const keys = isObj(w) ? Object.keys(w) : [];
    if (keys.length !== 1 || !one('pool.where', keys[0])) add('pool.where', 'Who can be picked: { stillIn: true }, { teams: [...] } or { group: id }');
    else if (keys[0] === 'stillIn' && w.stillIn !== true) add('pool.where.stillIn', 'stillIn is true, or leave it out');
    else if (keys[0] === 'teams' && !(Array.isArray(w.teams) && w.teams.length && w.teams.every((t) => typeof t === 'string' && t))) add('pool.where.teams', 'The teams are a list of team ids');
    else if (keys[0] === 'group' && !(typeof w.group === 'string' && w.group)) add('pool.where.group', 'The group is an id');
  }

  // get and count
  const get = isObj(s.get) ? s.get : {};
  const count = countKind(s.count);
  if (!one('get.by', get.by)) add('get.by', 'How you get yours: draft, pick, card, none or squares');
  const league = !!(opts && opts.league);
  // The size limits: always for a new game; for a league's own, only a size that grows past them (opts.was: the spec it's
  // changing from), so one already bigger keeps its size and can come down. Without opts.was a league's own has none.
  const before = league && isObj(opts.was) ? sizesOf(fullSpec(opts.was)) : null;
  const over = (v, max, was) => v > max && (!league || (before !== null && v > was));
  if (get.by === 'draft') {
    const most = isObj(s.score) && s.score.by === 'place' ? MAX_TEAM : MAX_LINEUP_TEAM;
    const capped = !league || before !== null;
    if (!isInt(get.each, 1) || over(get.each, most, before && before.each)) add('get.each', capped ? `A draft is 1 to ${most} each` : 'A draft is 1 or more each');
    else if (count === 'start' && isInt(s.count.start, 1) && s.count.start <= get.each) {
      if (over(s.count.start, MAX_STARTERS, before && before.start)) add('count.start', `A lineup starts 1 to ${MAX_STARTERS}`);
      if (over(get.each - s.count.start, MAX_BENCH, before && before.bench)) add('get.each', `A lineup's bench is 0 to ${MAX_BENCH}`);
    } else if (count === 'best' && isInt(s.count.best, 1) && s.count.best <= get.each && over(s.count.best, MAX_STARTERS, before && before.best)) {
      add('count.best', `Best ball counts 1 to ${MAX_STARTERS}`);
    }
    if (!one('get.own', get.own)) add('get.own', 'A draft is exclusive or shared');
    if (!one('get.order', get.order)) add('get.order', 'A draft is snake, blind, a draw or an auction');
    // A draw (A10 part 3) goes with either ownership; an auction (part 3b) is for castaways nobody else can have; a draft people
    // pick in goes with its own.
    else if (get.order === 'auction' && one('get.own', get.own) && get.own !== 'exclusive') add('get.own', "An auction is for castaways nobody else can have: shared, what they cost comes from the data instead (a salary cap: a budget beside a blind draft)");
    else if (get.order !== 'draw' && get.order !== 'auction' && one('get.own', get.own) && ORDER_OF[get.own] !== get.order) add('get.order', `An ${get.own} draft is ${ORDER_OF[get.own]}: ${get.own === 'exclusive' ? 'everyone takes turns for castaways nobody else can have' : 'everyone picks in private, revealed at once'}`);
    if (!count) add('count', 'A draft says what counts: { start: n }, { all: true } or { best: n }');
    if (get.groups !== undefined) groupSlotProblems(get.groups, s).forEach(([at, p]) => add(`get.groups${at}`, p));
    if (get.across !== undefined) acrossProblems(get.across).forEach(([at, p]) => add(`get.across${at}`, p));
    if (get.budget !== undefined) budgetProblems(get.budget, s).forEach(([at, p]) => add(`get.budget${at}`, p));
    if (get.keep !== undefined) keepProblems(get.keep, s).forEach(([at, p]) => add(`get.keep${at}`, p));
  }
  if (get.by === 'pick') {
    if (get.each !== 1) add('get.each', 'A pick is one an episode');
    if (!one('get.repeat', get.repeat)) add('get.repeat', "A pick's repeats: cycle");
    if (count !== 'pick') add('count', 'A pick counts the pick: { pick: true }');
    if (get.second !== undefined) secondPickProblems(get.second, s).forEach(([at, p]) => add(`get.second${at}`, p));
  }
  if ((get.by === 'none' || get.by === 'card') && s.count !== null) add('count', 'Nothing is held, so nothing counts: count is null');
  if (s.count !== null) {
    const drafted = count === 'start' || count === 'all' || count === 'best';
    if (!count || Object.keys(s.count).length !== 1) add('count', 'count is one of { start: n }, { all: true }, { pick: true }, { best: n }');
    else if (drafted && get.by !== 'draft') add('count', `{ ${count} } counts a draft's`);
    else if (count === 'pick' && get.by !== 'pick') add('count', '{ pick } counts a pick');
    else if ((count === 'start' || count === 'best') && !(isInt(s.count[count], 1) && (!isInt(get.each, 1) || s.count[count] <= get.each))) add(`count.${count}`, `It counts 1 to the ${get.each || 'number'} drafted`);
    else if ((count === 'all' || count === 'pick') && s.count[count] !== true) add(`count.${count}`, `${count} is true`);
  }

  // score and rank
  const score = isObj(s.score) ? s.score : {};
  if (!one('score.by', score.by)) add('score.by', 'How it scores: moments, place, survive, lines, answers or stats');
  if (score.by === 'moments' && score.points !== null && !pointsMap(score.points)) add('score.points', 'Points are moment id to a number, or null for the rulebook\'s own');
  // A9 part 2: a lineup's captain, points that multiply by when, Outlast in reverse.
  if (score.by === 'moments' && score.captain !== undefined) {
    const c = score.captain;
    if (!(isObj(c) && isNum(c.times) && c.times > 1 && c.times <= MAX_TIMES)) add('score.captain', `A captain's points multiply by more than 1, up to ${MAX_TIMES}: { times: 2 }`);
    else if (count !== 'start') add('score.captain', 'A captain is one of your starters, named each episode: a lineup ({ start: n })');
  }
  if (score.by === 'moments' && score.times !== undefined) timesProblems(score.times, s, league).forEach(([at, p]) => add(`score.times${at}`, p));
  if (score.by === 'place' && score.reverse !== undefined && score.reverse !== true) add('score.reverse', 'reverse is true, or leave it out');
  if (score.by === 'stats' && !(pointsMap(score.points) && Object.keys(score.points).length)) add('score.points', 'Stats score as stat key to points');
  if (score.by === 'survive') {
    if (!one('score.means', score.means)) add('score.means', 'A pick survives by staying in (staysIn) or by scoring (scores)');
    if (!(isNum(score.points) && score.points >= 0)) add('score.points', 'A right pick is worth 0 or more');
    poolProblems(score, s, league).forEach(([at, p]) => add(`score${at}`, p));
  }
  // A9: points per bingo line (1 when it's left out).
  if (score.by === 'lines' && score.points !== undefined && !(isInt(score.points, 1) && score.points <= MAX_QUESTION_POINTS)) add('score.points', `A line is worth 1 to ${MAX_QUESTION_POINTS} points`);
  if (score.by === 'answers' && score.parlays !== undefined) parlayProblems(score.parlays, s).forEach(([at, p]) => add(`score.parlays${at}`, p));
  if ((score.by === 'moments' || score.by === 'stats') && !['draft', 'pick', 'squares'].includes(get.by)) add('score.by', `Scoring ${score.by} needs someone of yours: a draft or a pick`);
  if (score.by === 'place' && !(get.by === 'draft' && count === 'all')) add('score.by', 'Scoring by place counts everyone drafted: a draft, { all: true }');
  if (score.by === 'survive' && get.by !== 'pick') add('score.by', 'Surviving scores a pick');
  if (score.by === 'answers' && get.by !== 'none') add('score.by', 'A game scored by its answers has nothing to hold: get none');
  if (score.by === 'lines' && get.by !== 'card') add('score.by', 'Lines are a bingo card\'s: get card');
  if (score.by === 'answers' && !(Array.isArray(s.ask) && s.ask.length)) add('ask', 'A game scored by answers asks at least one question');
  const rank = isObj(s.rank) ? s.rank : {};
  if (!one('rank.by', rank.by)) add('rank.by', 'How it ranks: total, streak, standing, worth, matchups, categories or roto');
  if (rank.by === 'streak' && score.by !== 'survive') add('rank.by', 'A streak is a Survival Pool\'s');
  // A11 part 1: last one standing is also a draft's that knocks players out (rank.cut).
  const cutsSaid = Array.isArray(rank.cut) && rank.cut.length > 0;
  if (rank.by === 'standing' && !(score.by === 'survive' && score.lives !== undefined) && !(get.by === 'draft' && cutsSaid)) {
    add('rank.by', "Last one standing is a pool with lives (a wrong pick costs one, and at none you're out) or a draft that knocks players out");
  }
  if (rank.race !== undefined || rank.cut !== undefined) knockoutProblems(rank, s, league).forEach(([at, p]) => add(`rank${at}`, p));
  // A10 part 3c: worth is a stock market's: cash plus the team at today's prices.
  if (rank.by === 'worth' && !marketOf(s)) add('rank.by', "Ranking by worth is a stock market's (cash plus your team at today's prices): a budget that trades");
  if (!one('closes', s.closes)) add('closes', 'Moves close at the start, daily or weekly');

  // ask
  if (!Array.isArray(s.ask)) add('ask', 'ask is a list of questions');
  else {
    if (s.ask.length > MAX_QUESTIONS) add('ask', `A game asks at most ${MAX_QUESTIONS} questions`);
    const ids = new Set();
    s.ask.forEach((q, i) => questionProblems(q, `ask[${i}]`, s, ids, league).forEach(([at, p]) => add(at, p)));
  }

  // extras
  const e = s.extras;
  if (!isObj(e)) add('extras', 'extras is an object');
  else {
    if (e.waivers !== null) {
      if (!waiversFit(s)) add('extras.waivers', 'Waivers need a draft whose castaways can come free');
      else waiverProblems(e.waivers, s).forEach(([at, p]) => add(`extras.waivers${at}`, p));
    } else if (waiversFit(s)) {
      // null is "no waivers can happen here"; a draft with free agents says what it does, even if that's nothing.
      add('extras.waivers', "A draft whose castaways can come free has waivers: replace 'never' and manual windows with no swaps for none");
    }
    if (e.bets !== null) {
      if (!(isObj(e.bets) && isInt(e.bets.points, 1) && e.bets.points <= MAX_BET_POINTS)) add('extras.bets', `Side bets are { points: 1 to ${MAX_BET_POINTS} }, or null`);
      else if (!betsFit(s)) add('extras.bets', "Side bets go beside a draft: nothing else scores them");
    }
    if (typeof e.calls !== 'boolean') add('extras.calls', 'calls is true or false');
    else if (e.calls && get.by !== 'pick') add('extras.calls', 'The weekly call goes beside a pick');
    if (e.draft !== null) {
      if (get.by !== 'draft') add('extras.draft', 'Only a draft has a draft room');
      else if (!(isObj(e.draft) && (e.draft.at === null || isInstant(e.draft.at)) && DRAFT_TIMERS.includes(e.draft.timer) && (e.draft.away === 'wait' || e.draft.away === 'queue'))) {
        add('extras.draft', 'The draft room is { at: an ISO time with its zone, or null; timer: 0, 60 or 120; away: wait | queue }');
      }
    } else if (get.by === 'draft') add('extras.draft', 'A draft has a draft room');
    if (e.join !== null && !JOINS.includes(e.join)) add('extras.join', 'Who can join: open, ask, locked or null');
    else if (e.join === 'open' && get.by === 'draft' && get.own === 'exclusive') add('extras.join', "An exclusive draft can't be open: its castaways are one team's each, so newcomers ask");
    if (typeof e.hideStarters !== 'boolean') add('extras.hideStarters', 'hideStarters is true or false');
    else if (e.hideStarters && count !== 'start') add('extras.hideStarters', 'Only a lineup has starters to hide');
    if (typeof e.lockedDown !== 'boolean') add('extras.lockedDown', 'lockedDown is true or false');
    if (e.lateLock !== null) {
      if (!(isObj(e.lateLock) && LATE_HOURS.includes(e.lateLock.hours))) add('extras.lateLock', `A late lock is { hours: ${LATE_HOURS.join(', ')} }, or null`);
      else if (!(score.by === 'answers' && !callsAsk(s.ask))) add('extras.lateLock', "A late lock is for a game's own questions (Weekly Calls' calls are Call it's)");
    }
    // A10 part 4b: a team two people share. A call and a bingo card are each person's own (Call it's calls, made once for every
    // game that counts them; a card dealt to a person), so a seat in those games has nothing to share.
    if (e.seats !== undefined) {
      if (!(isObj(e.seats) && isInt(e.seats.people, 2) && e.seats.people <= MAX_SEAT_PEOPLE)) add('extras.seats', `A shared team is { people: 2 to ${MAX_SEAT_PEOPLE} }, or left out for one a team`);
      else if (score.by === 'lines' || callsAsk(s.ask) || e.calls === true) add('extras.seats', `${score.by === 'lines' ? 'A bingo card' : 'A call'} is each person's own, so two people can't share one: each plays their own`);
    }
  }

  unknownKeys(s).forEach((at) => add(at, `"${at.split('.').pop()}" isn't part of a game spec`));
  if (ctx) settleProblems(s, ctx, opts || {}).forEach(([at, p]) => add(at, p));
  return out;
}

/**
 * One question's problems, as [[at, problem]]: its shape, and what it says that the game it's in can't be (`s`, whole).
 * `ids` collects the ids seen, so two questions can't share one. `league`: it's a league's own (specProblems' opts.league),
 * which keeps what it already plays: finale predictions on a game with an end of its own (classic always let them be on;
 * they never settle there) and points past a new question's most. The data-can-settle rule is settleProblems'.
 */
function questionProblems(q, at, s, ids, league) {
  const out = [];
  const add = (where, p) => out.push([where ? `${at}.${where}` : at, p]);
  const one = (key, v) => own(VOCAB[key], v) !== undefined;
  if (!isObj(q)) return [[at, 'A question is an object']];
  if (typeof q.id !== 'string' || !q.id) add('id', 'A question has an id');
  else if (!QUESTION_ID.test(q.id)) add('id', "A question's id is letters, digits, '.', '_' or '-', up to 40");
  else if (ids.has(q.id)) add('id', `Two questions are "${q.id}"`);
  else ids.add(q.id);
  if (typeof q.ask !== 'string' || !q.ask.trim()) add('ask', 'A question asks something');
  else if (q.ask.length > 200) add('ask', 'A question is 200 characters at most');
  if (!one('ask.answer', q.answer)) add('answer', 'The answer is a person, group, side, yesNo, number, overUnder, choice, calls, order, confidence, chips, split or pairs');
  if (!(isNum(q.points) && q.points >= 0 && (league || q.points <= MAX_QUESTION_POINTS))) add('points', `A right answer is worth 0 to ${MAX_QUESTION_POINTS}`);
  if (!one('ask.asked', q.asked)) add('asked', 'A question is asked once, each episode, every few episodes, or once a phase');
  // A7's windows: every N episodes (asked every), over the next N (asked each).
  if (q.asked === 'every') {
    if (!(isInt(q.every, 2) && q.every <= MAX_WINDOW)) add('every', `Every 2 to ${MAX_WINDOW} episodes`);
  } else if (q.every !== undefined) add('every', 'Only a question asked every few episodes says how many');
  if (q.over !== undefined) {
    if (q.asked !== 'each') add('over', 'Only a question asked each episode looks over the next few');
    else if (!(isInt(q.over, 2) && q.over <= MAX_WINDOW)) add('over', `Over 2 to ${MAX_WINDOW} episodes`);
  }
  if (!one('ask.closes', q.closes)) add('closes', 'Its answers close at the start, or the finale');
  else if (q.closes === 'finale' && q.asked !== 'once') add('closes', 'Only a question asked once waits for the finale: one asked each episode closes as it starts');
  const st = isObj(q.settle) ? q.settle : {};
  let settled = false;
  if (!one('ask.settle', st.by)) add('settle', 'Data settles every question: results, moment, role, phase, points, calls, final or stat');
  else if (st.by === 'calls') {
    if (st.take !== undefined) add('settle.take', 'The calls settle themselves: no take');
    else settled = true;
  } else if (!TAKES[st.by].includes(st.take)) add('settle.take', `${st.by} takes ${TAKES[st.by].join(', ')}`);
  else settled = true;
  const how = `${st.by}:${st.by === 'calls' ? '' : st.take}`;
  // A question about each person is graded for each of them: their own answer kind and settle (below).
  const each = q.each !== undefined;
  if (settled && !each && one('ask.answer', q.answer) && SETTLES_FOR[q.answer] && !SETTLES_FOR[q.answer].includes(how)) {
    add('settle', `A ${q.answer} answer isn't graded by ${st.by}${st.by === 'calls' ? '' : ` ${st.take}`}`);
  }
  if (q.answer !== 'calls' && st.by === 'calls') add('answer', "Only the show's calls are settled as calls");
  if (st.by === 'moment' && (typeof st.moment !== 'string' || !st.moment)) add('settle.moment', 'Which moment settles it');
  if (st.moment !== undefined && st.by !== 'moment') add('settle.moment', 'Only a moment settles by a moment');
  if (st.by === 'role' && (typeof st.role !== 'string' || !st.role)) add('settle.role', 'Which role settles it');
  if (st.role !== undefined && st.by !== 'role') add('settle.role', 'Only a role settles by a role');
  if (st.by === 'phase' && (typeof st.phase !== 'string' || !st.phase)) add('settle.phase', 'Which phase settles it');
  if (st.phase !== undefined && st.by !== 'phase') add('settle.phase', 'Only a phase settles by a phase');
  // Where a phase starts is one episode for the whole game.
  if (how === 'phase:starts' && q.asked !== 'once') add('asked', 'Which episode a phase starts in is the game\'s: ask it once');
  if (st.by === 'stat' && (typeof st.stat !== 'string' || !st.stat)) add('settle.stat', 'Which stat settles it');
  if (st.by === 'results' && (st.take === 'placed' || st.take === 'top') && !isInt(st.place, 1)) add('settle.place', 'Which place: 1 or more');
  if (st.place !== undefined && !(st.by === 'results' && (st.take === 'placed' || st.take === 'top'))) add('settle.place', 'Only a place or a top settles by a place');
  // What the season's results say only at its end: asked once, in a game that runs to it.
  if (SEASON_TAKES.includes(how)) {
    const what = st.take === 'winner' ? 'Who wins' : st.take === 'split' ? "The jury's vote split" : 'Where they finish';
    if (q.asked !== 'once') add('asked', `${what} is the season's: ask it once`);
    if (!league && isObj(s.span) && s.span.to !== null) add('settle', "It's known at the season's end, so the game runs to it: no end of its own");
  }
  // Who stays is one episode's (over a game, everyone but the winner leaves by its end).
  if (how === 'results:stays' && (q.asked !== 'each' || windowed(q))) add('asked', 'Who stays is an episode\'s: ask it each episode');
  // One question about each person still in, an answer for each, settled for each by their own moment or exit.
  if (each) {
    const takes = own(EACH_SETTLES_FOR, q.answer);
    if (!one('ask.each', q.each)) add('each', "A question about each one is about each person: 'person'");
    else if (!takes) add('answer', 'Each person gets a yes or no, a number, an over/under or a choice');
    else if (settled && !takes.includes(how)) add('settle', `Each person's ${q.answer} is settled by ${takes.map((x) => x.replace(':', ' ')).join(', ')}`);
    if (q.closes !== 'start') add('closes', 'A question about each person closes as it starts');
  }
  // Only what the finale decides waits for it: anything else could be settled before then (an idol played this season, who
  // finished fifth), and answered once it's known.
  if (q.closes === 'finale' && q.asked === 'once') {
    if (!(how === 'results:winner' || how === 'results:top')) add('closes', 'Only who wins, or who makes the final few, waits for the finale');
    else if (!league && isObj(s.span) && s.span.to !== null) add('closes', 'Waiting for the finale needs a game that runs to it');
  }
  // The answer's own parts.
  if (NAMES.includes(q.answer)) {
    if (!(isInt(q.pick, 1) && q.pick <= MAX_PICK)) add('pick', `Name 1 to ${MAX_PICK}`);
  } else if (RANKS.includes(q.answer)) {
    if (!(isInt(q.pick, 2) && q.pick <= MAX_ORDER)) add('pick', `Rank 2 to ${MAX_ORDER}`);
  } else if (q.pick !== undefined) add('pick', 'Only a person or group answer, an order or a confidence ranking names a number of them');
  // A8's: an order's places off, chips to spread, pairs, a wager.
  if (q.within !== undefined) {
    if (q.answer !== 'order') add('within', 'Only an order scores within a few places');
    else if (!(isInt(q.within, 0) && q.within <= MAX_WITHIN)) add('within', `Within 0 to ${MAX_WITHIN} places`);
  }
  if (q.answer === 'chips') {
    if (!(isInt(q.chips, 2) && q.chips <= MAX_CHIPS)) add('chips', `Spread 2 to ${MAX_CHIPS} chips`);
  } else if (q.chips !== undefined) add('chips', 'Only a chips answer spreads chips');
  if (q.answer === 'pairs') {
    if (!(isInt(q.pairs, 1) && q.pairs <= MAX_PAIRS)) add('pairs', `1 to ${MAX_PAIRS} pairs`);
    if (q.asked !== 'once') add('asked', 'Who outlasts whom is over the game: ask it once');
  } else if (q.pairs !== undefined) add('pairs', 'Only a pairs answer has pairs');
  if (q.wager !== undefined) {
    if (!WAGERS.includes(q.answer) || each || (NAMES.includes(q.answer) && q.pick !== 1)) add('wager', 'A wager goes on one answer: a yes or no, a choice, an over/under, or one person or group');
    else if (!(q.wager === WAGER_TOTAL || (isInt(q.wager, 1) && q.wager <= MAX_QUESTION_POINTS))) add('wager', `Stake up to 1 to ${MAX_QUESTION_POINTS} points, or 'total': any of your points`);
    // A9: a wager plays alone (its stake is the answer's own: nothing to share, roll over or shrink).
    else if (q.share !== undefined || q.rollover !== undefined || q.shrink !== undefined) add('wager', "A wager plays alone: no share, rollover or shrink with it");
  }
  // A9: how its points combine.
  if (q.share !== undefined) {
    if (!SHARES.includes(q.share)) add('share', `Its points are shared: ${SHARES.join(' or ')}`);
    else if (q.answer === 'calls') add('share', "The show's calls are a point each");
  }
  if (q.rollover !== undefined) {
    if (q.rollover !== true) add('rollover', 'rollover is true, or leave it out');
    else if (q.asked === 'once') add('rollover', 'Rolling over needs a next one: ask it each episode, every few or once a phase');
    else if (q.answer === 'calls') add('rollover', "The show's calls are a point each");
  }
  if (q.shrink !== undefined) {
    const sh = q.shrink;
    if (!(isObj(sh) && SHRINK_PER.includes(sh.per) && isInt(sh.points, 1) && sh.points <= MAX_QUESTION_POINTS)) add('shrink', `Points shrink by 1 to ${MAX_QUESTION_POINTS} per episode or per change: { points, per: episode | change }`);
    else if (!(q.asked === 'once' && q.closes === 'finale')) add('shrink', "Only a call that stays open once the game is on shrinks: asked once, closing at the finale");
    else if (q.share !== undefined) add('shrink', 'A shrinking call is its own: no share with it');
  }
  // F3 part 2: a group question asked each episode about one episode reads its groups from the format's state over time on a
  // season played in groups the league doesn't hold (pairs); `fallback` says what it does when they aren't sure.
  if (q.fallback !== undefined) {
    if (!one('ask.fallback', q.fallback)) add('fallback', "When its groups aren't sure, it is void or follows the people: void, or carry-on");
    else if (q.answer !== 'group' || q.asked !== 'each' || q.over !== undefined) add('fallback', 'Only a group question asked about each episode has a fallback');
  }
  // Who outlasts whom and the boot order come from who went home; an order of the boot order asked each episode is one boot.
  if (how === 'results:order' && q.asked === 'each' && !windowed(q)) add('asked', 'The order they go home is over a run of episodes or the game');
  if (q.answer === 'person') {
    if (!one('ask.from', q.from)) add('from', 'Pick from the cast still in, or your own team');
    else if (q.from === 'team' && !(isObj(s.get) && s.get.by === 'draft')) add('from', 'Only a draft has teams to pick from');
  } else if (q.from !== undefined) add('from', 'Only a person answer picks from someone');
  if (q.answer === 'overUnder') {
    if (q.line !== null && q.line !== undefined && !isNum(q.line)) add('line', 'The line is a number, or null (or left out) for the wizard to ask');
  } else if (q.line !== undefined) add('line', "Only an over/under has a line");
  if (q.answer === 'choice') {
    const opts = q.options;
    // Matched to a yes or no (whether it happened; each person's going home or staying), a count's range, or names.
    const yesNo = how === 'moment:happened' || (each && (how === 'results:out' || how === 'results:stays'));
    if (!(Array.isArray(opts) && opts.length >= 2 && opts.length <= MAX_OPTIONS && opts.every((o) => typeof o === 'string' && o.trim() && o.length <= 80))) {
      add('options', `A choice has 2 to ${MAX_OPTIONS} options, each a few words`);
    } else if (new Set(opts.map((o) => o.trim().toLowerCase())).size !== opts.length) add('options', 'Two of its options are the same');
    else if (yesNo && !opts.every((o) => YES_NO.includes(o.trim().toLowerCase()))) add('options', 'Whether it happened is Yes or No');
    else if ((how === 'moment:count' || how === 'role:count') && !opts.every((o) => optionRange(o))) add('options', 'A count\'s options are numbers or ranges: "0", "1-2", "3+"');
  } else if (q.options !== undefined) add('options', 'Only a choice has options');
  // The show's calls: Weekly Calls' one question.
  if (q.answer === 'calls') {
    if (!(isObj(s.get) && s.get.by === 'none' && isObj(s.score) && s.score.by === 'answers' && s.ask.length === 1)) add('', "The show's calls are a game of their own: nothing held, scored by them alone");
    if (q.asked !== 'each') add('asked', 'The calls are made each episode');
    if (q.points !== 1) add('points', 'A right call is a point');
  }
  return out;
}

/** An instant with its time zone, as a draft's time is stored (toISOString): "2026-10-28T23:00:00.000Z". */
const isInstant = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(v) && !Number.isNaN(Date.parse(v));

// Every key a spec can have, so a misspelled one ("scoring", "sideBets") is reported, not quietly played as the default.
const KEYS = {
  top: ['spec', 'preset', 'span', 'pool', 'get', 'count', 'score', 'rank', 'ask', 'closes', 'extras'],
  span: ['from', 'to'],
  from: ['phase', 'at'],
  pool: ['of', 'where'],
  get: { draft: ['by', 'each', 'order', 'own', 'groups', 'across', 'budget', 'keep'], pick: ['by', 'each', 'repeat', 'second'], card: ['by'], none: ['by'], squares: ['by'] },
  groups: ['slots', 'own', 'swap', 'fallback', 'points'],
  keep: ['each', 'from', 'cost', 'fallback'],
  across: ['of', 'then'],
  budget: ['total', 'floor', 'ceiling', 'gone', 'fallback', 'trade', 'left'],
  trade: ['fee'],
  second: ['fallback'],
  score: { moments: ['by', 'points', 'captain', 'times'], place: ['by', 'reverse'], survive: ['by', 'means', 'points', 'lives', 'buyback', 'mulligans'], lines: ['by', 'points'], answers: ['by', 'parlays'], stats: ['by', 'points'] },
  buyback: ['times', 'before', 'cost'],
  before: ['phase', 'episode'],
  parlay: ['of', 'times'],
  captain: ['times'],
  when: ['times', 'episode', 'from', 'to', 'phase', 'finale'],
  shrink: ['points', 'per'],
  rank: ['by', 'race', 'cut'],
  race: ['to'],
  cut: ['at', 'out', 'tie', 'quiet'],
  cutAt: CUT_AT,
  extras: ['waivers', 'bets', 'calls', 'draft', 'join', 'hideStarters', 'lockedDown', 'lateLock', 'seats'],
  lateLock: ['hours'],
  seats: ['people'],
  waivers: ['feel', 'replace', 'short', 'windows', 'order', 'hours', 'freeAgency', 'autoFill'],
  windows: ['schedule', 'every', 'swaps'],
  draft: ['at', 'timer', 'away'],
  bets: ['points'],
  question: ['id', 'ask', 'answer', 'points', 'settle', 'asked', 'closes', 'pick', 'from', 'line', 'options', 'each', 'every', 'over', 'within', 'chips', 'pairs', 'wager', 'share', 'rollover', 'shrink', 'fallback'],
  settle: ['by', 'take', 'moment', 'role', 'phase', 'stat', 'place'],
};
/** The paths of keys a spec has that no game spec does. */
function unknownKeys(s) {
  const out = [];
  const check = (o, allowed, at) => {
    if (!isObj(o) || !allowed) return;
    for (const k of Object.keys(o)) if (!allowed.includes(k)) out.push(at ? `${at}.${k}` : k);
  };
  check(s, KEYS.top, '');
  check(s.span, KEYS.span, 'span');
  if (isObj(s.span)) check(s.span.from, KEYS.from, 'span.from');
  check(s.pool, KEYS.pool, 'pool');
  if (isObj(s.get)) {
    check(s.get, own(KEYS.get, s.get.by), 'get');
    if (s.get.by === 'draft') {
      check(s.get.groups, KEYS.groups, 'get.groups');
      check(s.get.across, KEYS.across, 'get.across');
      check(s.get.budget, KEYS.budget, 'get.budget');
      if (isObj(s.get.budget)) check(s.get.budget.trade, KEYS.trade, 'get.budget.trade');
      check(s.get.keep, KEYS.keep, 'get.keep');
    }
    if (s.get.by === 'pick') check(s.get.second, KEYS.second, 'get.second');
  }
  if (isObj(s.score)) {
    check(s.score, own(KEYS.score, s.score.by), 'score');
    if (Array.isArray(s.score.parlays)) s.score.parlays.forEach((p, i) => check(p, KEYS.parlay, `score.parlays[${i}]`));
    if (s.score.by === 'moments') {
      check(s.score.captain, KEYS.captain, 'score.captain');
      if (Array.isArray(s.score.times)) s.score.times.forEach((t, i) => check(t, KEYS.when, `score.times[${i}]`));
    }
    if (s.score.by === 'survive' && isObj(s.score.buyback)) {
      check(s.score.buyback, KEYS.buyback, 'score.buyback');
      check(s.score.buyback.before, KEYS.before, 'score.buyback.before');
    }
  }
  check(s.rank, KEYS.rank, 'rank');
  if (isObj(s.rank)) {
    check(s.rank.race, KEYS.race, 'rank.race');
    if (Array.isArray(s.rank.cut)) s.rank.cut.forEach((c, i) => {
      check(c, KEYS.cut, `rank.cut[${i}]`);
      if (isObj(c)) check(c.at, KEYS.cutAt, `rank.cut[${i}].at`);
    });
  }
  (Array.isArray(s.ask) ? s.ask : []).forEach((q, i) => {
    check(q, KEYS.question, `ask[${i}]`);
    if (isObj(q)) {
      check(q.settle, KEYS.settle, `ask[${i}].settle`);
      check(q.shrink, KEYS.shrink, `ask[${i}].shrink`);
    }
  });
  const e = s.extras;
  check(e, KEYS.extras, 'extras');
  if (isObj(e)) {
    for (const k of ['waivers', 'draft', 'bets', 'lateLock', 'seats']) check(e[k], KEYS[k], `extras.${k}`);
    if (isObj(e.waivers)) check(e.waivers.windows, KEYS.windows, 'extras.waivers.windows');
  }
  return out;
}

const pointsMap = (p) => isObj(p) && Object.values(p).every(isNum);

/**
 * A draft's group slots (A10 part 1: get.groups), as [[at, problem]]: { slots: 1 to MAX_GROUP_SLOTS, own: shared |
 * exclusive, swap: true | false (whether a slot's group can be changed while it lasts), fallback: void | carry-on (what a slot
 * does in an episode whose groups at the lock, or as played, aren't sure), points: mean | sum (a group's points: its members'
 * averaged, a slot scoring like one more person, or added up) }, beside a draft scored by moments (a lineup or best ball:
 * the moments its members earn are what a group scores). The groups themselves are the show's, read from the format's state
 * over time, so nothing here names one.
 */
function groupSlotProblems(g, s) {
  if (!isObj(g)) return [['', 'Group slots are { slots, own, swap, fallback, points }']];
  const out = [];
  const one = (key, v) => own(VOCAB[key], v) !== undefined;
  if (!(isInt(g.slots, 1) && g.slots <= MAX_GROUP_SLOTS)) out.push(['.slots', `A team has 1 to ${MAX_GROUP_SLOTS} group slots`]);
  if (!one('get.groups.own', g.own)) out.push(['.own', 'A group slot is shared (anyone can hold the same group) or exclusive']);
  if (typeof g.swap !== 'boolean') out.push(['.swap', 'swap is true or false: whether a slot can change its group while it lasts']);
  if (!one('get.groups.fallback', g.fallback)) out.push(['.fallback', "When its groups aren't sure, a slot is void for that episode or follows the people: void, or carry-on"]);
  if (!one('get.groups.points', g.points)) out.push(['.points', "A group's points are its members': their mean, or their sum"]);
  if (!(isObj(s.score) && s.score.by === 'moments')) out.push(['', 'A group scores what its members do: group slots go with a draft scored by moments']);
  return out;
}

/**
 * A draft spread across the cast's groups (A10 part 3: get.across), as [[at, problem]]: { of: group | gender (which groups:
 * the tribes or teams the data has people on when it drafts, or a guy and a girl), then: keep (a drafted castaway stays yours
 * when they change group, and when the groups end at the merge) }. Any draft: a snake, a blind draft or a draw, scored any way.
 * Which groups a show has is the data rule's (settleProblems).
 */
function acrossProblems(a) {
  if (!isObj(a)) return [['', 'A spread draft is { of, then }']];
  const out = [];
  if (own(VOCAB['get.across.of'], a.of) === undefined) out.push(['.of', "Spread across what: the show's groups (group), or a guy and a girl (gender)"]);
  if (own(VOCAB['get.across.then'], a.then) === undefined) out.push(['.then', 'After the draft a castaway stays yours wherever they go: keep']);
  return out;
}

/**
 * A draft's prices (A10 part 3b: get.budget), as [[at, problem]]: { total: 1 to MAX_BUDGET (everyone's), floor: 0 or more (the
 * lowest price, or bid), and an auction's fallback: fill | short, or a salary cap's ceiling (the highest price: from the lowest
 * to the budget) and gone: zero | last }. Everyone can afford a team at the lowest price (total at least floor × each). A salary
 * cap's prices are each castaway's points so far by the game's own rules, so it goes with a draft scored by moments (scored by
 * place, everyone still in has the same points, and nothing would cost more). Any draft order but an auction is a cap.
 * A10 part 3c: trade { fee: 0 to the budget } makes it a stock market (buying and selling each week at the data's prices, a cap's
 * or, after an auction, the same prices: so an auction that trades has a ceiling and gone too), scored by moments; left (what the
 * draft's money left over does): cash (to trade with) or lost, only where it trades, or bids (a budget to bid on waivers with:
 * no step yet, specWaitsFor).
 */
function budgetProblems(b, s) {
  if (!isObj(b)) return [['', 'A budget is { total, floor, ceiling, gone } (a salary cap) or { total, floor, fallback } (an auction), with trade to buy and sell each week']];
  const out = [];
  const auction = s.get.order === 'auction';
  const trade = b.trade !== undefined;
  const each = isInt(s.get.each, 1) ? s.get.each : null;
  if (!(isInt(b.total, 1) && b.total <= MAX_BUDGET)) out.push(['.total', `Everyone's budget is 1 to ${MAX_BUDGET}`]);
  if (!isInt(b.floor, 0)) out.push(['.floor', 'The lowest price is 0 or more']);
  else if (isInt(b.total, 1) && each !== null && b.floor * each > b.total) out.push(['.floor', `${each} at the lowest price, ${b.floor} each, is more than the budget: nobody could fill a team`]);
  if (auction) {
    if (!trade && b.ceiling !== undefined) out.push(['.ceiling', "An auction's prices are its bids: no highest price (a bid is up to what you can spend)"]);
    if (!trade && b.gone !== undefined) out.push(['.gone', "What someone gone home counts for is a salary cap's (an auction's prices are what was paid)"]);
    if (own(VOCAB['get.budget.fallback'], b.fallback) === undefined) out.push(['.fallback', "A team the bids didn't fill is filled from what's left at the lowest price, or left short: fill, or short"]);
  } else if (b.fallback !== undefined) out.push(['.fallback', "Filling a team the bids didn't is an auction's (a salary cap's draft picks every place)"]);
  if (!auction || trade) {
    if (!(isInt(b.ceiling, 0) && (!isInt(b.floor, 0) || b.ceiling >= b.floor) && (!isInt(b.total, 1) || b.ceiling <= b.total)) && (b.ceiling !== undefined || each !== null)) {
      out.push(['.ceiling', 'The highest price is from the lowest to the budget']);
    }
    if (own(VOCAB['get.budget.gone'], b.gone) === undefined) out.push(['.gone', trade ? 'Someone gone home sells for nothing, or the price they went home at: zero, or last' : 'Someone gone home counts against the cap as nothing, or the price they went home at: zero, or last']);
    if (!(isObj(s.score) && s.score.by === 'moments')) out.push(['', trade ? "A stock market's prices are each castaway's points so far by the game's rules: a draft scored by moments (scored by place, everyone still in has the same points, so nothing would cost more)" : "A salary cap's prices are each castaway's points so far by the game's rules: a draft scored by moments (scored by place, everyone still in has the same points, so nothing would cost more)"]);
  }
  if (trade) {
    if (!isObj(b.trade)) out.push(['.trade', 'Trading is { fee }: what each trade costs, 0 for nothing']);
    else if (!(isInt(b.trade.fee, 0) && (!isInt(b.total, 1) || b.trade.fee <= b.total))) out.push(['.trade.fee', 'A trade costs 0 to the budget']);
    // Before anyone's scored everyone costs the middle price, so a team drafted then (every game made before its premiere) costs
    // that many times it: within the budget, or everyone would start with less than nothing to trade with (an auction's bids
    // are its own).
    if (!auction && isInt(b.total, 1) && isInt(b.floor, 0) && isInt(b.ceiling, 0) && each !== null) {
      const middle = Math.round((b.floor + b.ceiling) / 2);
      if (middle * each > b.total) out.push(['.ceiling', `Before anyone's scored everyone costs ${middle}, so a team of ${each} would cost ${middle * each}, more than the ${b.total} everyone has: a highest price of at most ${ceilingFor(b.total, each, b.floor)} fits`]);
    }
  }
  if (b.left !== undefined) {
    if (own(VOCAB['get.budget.left'], b.left) === undefined) out.push(['.left', "The draft's money left over is cash to trade with, lost, or a budget to bid on waivers with: cash, lost or bids"]);
    else if (b.left === 'cash' && !trade) out.push(['.left', "The draft's money left over is cash to trade with only where the game trades: without trading it's worth nothing after the draft (lost)"]);
  }
  return out;
}

/**
 * Keepers across seasons (A10 part 4: get.keep), as [[at, problem]]: { each: 1 to the team's size, from: the game it continues
 * (a league id: which ones are the couch's is the data rule's, settleProblems with ctx.games), cost: place | round (a snake's
 * only: the draft taken in turns has rounds) | price (a budget the data prices: a salary cap or a stock market; an auction's
 * prices are its bids), fallback: best | none }. Who is back is the data's (the new season's cast), never a name typed here.
 */
function keepProblems(k, s) {
  if (!isObj(k)) return [['', 'Keepers are { each, from, cost, fallback }']];
  const out = [];
  const each = isInt(s.get.each, 1) ? s.get.each : null;
  if (!(isInt(k.each, 1) && (each === null || k.each <= each))) out.push(['.each', each === null ? 'Keep 1 or more each' : `Keep 1 to ${each} each: a keeper takes a place on a team of ${each}`]);
  if (!(typeof k.from === 'string' && k.from.trim() && k.from.length <= 100)) out.push(['.from', "Keepers come from last season's game: from names it"]);
  if (own(VOCAB['get.keep.cost'], k.cost) === undefined) out.push(['.cost', 'A keeper costs a place on your team, one of your earliest rounds, or their price: place, round or price']);
  else if (k.cost === 'round' && s.get.order !== 'snake') out.push(['.cost', 'A keeper costs a round only in a draft taken in turns (a snake): elsewhere it costs a place']);
  else if (k.cost === 'price') {
    const b = budgetParts(s);
    if (!b || b.ceiling === undefined) out.push(['.cost', "A keeper's price comes from the data's prices: a salary cap or a stock market (an auction's prices are its bids)"]);
  }
  if (own(VOCAB['get.keep.fallback'], k.fallback) === undefined) out.push(['.fallback', 'Someone who names no keepers by the draft keeps their best who are back, or nobody: best, or none']);
  return out;
}

/**
 * A pool's lives, buyback and mulligans (A10 part 2: score.lives, .buyback, .mulligans), as [[at, problem]]: lives 1 to
 * MAX_LIVES; mulligans 1 to MAX_MULLIGANS; a buyback { times: 1 to MAX_BUYBACKS, before: { phase: id } | { episode: n } | null
 * (any time), cost: 0 to MAX_BUYBACK_COST points } only with lives (nobody's out without them). A new game's buyback before an
 * episode is after its first, or nobody could ever use it (a league's own keeps what it plays). Which phases there are is the
 * data rule's (settleProblems).
 */
function poolProblems(score, s, league) {
  const out = [];
  if (score.lives !== undefined && !(isInt(score.lives, 1) && score.lives <= MAX_LIVES)) out.push(['.lives', `A pool has 1 to ${MAX_LIVES} lives`]);
  if (score.mulligans !== undefined && !(isInt(score.mulligans, 1) && score.mulligans <= MAX_MULLIGANS)) out.push(['.mulligans', `A pool forgives 1 to ${MAX_MULLIGANS} wrong picks`]);
  const b = score.buyback;
  if (b === undefined) return out;
  if (!isObj(b)) return [...out, ['.buyback', 'A buyback is { times, before, cost }']];
  if (score.lives === undefined) out.push(['.buyback', "A buyback brings someone back who's out: a pool with lives"]);
  if (!(isInt(b.times, 1) && b.times <= MAX_BUYBACKS)) out.push(['.buyback.times', `Someone can buy back 1 to ${MAX_BUYBACKS} times`]);
  if (!(isNum(b.cost) && b.cost >= 0 && b.cost <= MAX_BUYBACK_COST)) out.push(['.buyback.cost', `A buyback costs 0 to ${MAX_BUYBACK_COST} points`]);
  const before = b.before;
  if (before !== null) {
    const keys = isObj(before) ? Object.keys(before) : [];
    if (keys.length !== 1 || !['phase', 'episode'].includes(keys[0])) out.push(['.buyback.before', 'Until when: { phase: id } or { episode: n } (someone out before it can buy back), or null for any time']);
    else if (keys[0] === 'phase' && !(typeof before.phase === 'string' && before.phase)) out.push(['.buyback.before.phase', 'Which phase of the season']);
    else if (keys[0] === 'episode' && !isInt(before.episode, 2)) out.push(['.buyback.before.episode', 'Before an episode number, 2 or later']);
    else if (keys[0] === 'episode' && !league && isObj(s.span)) {
      const first = spanStart(s.span);
      if (first !== null && before.episode <= first) out.push(['.buyback.before.episode', "It's before the game's first episode, so nobody could buy back"]);
    }
  }
  return out;
}

/**
 * A draft's race and cuts (A11 part 1: rank.race, rank.cut), as [[at, problem]]. A race { to: 1 to MAX_RACE points }; cuts a list
 * of 1 to MAX_CUTS, each { at: { every: 1 to MAX_WINDOW } | { episode: n } | { phase: id }, out: 1 to MAX_CUT_OUT | 'half', tie:
 * keep | all, quiet: cut | skip }, ranked last one standing. Both beside a draft (Outlast, a lineup, best ball): a game of
 * questions' and a pool's come with A11 part 2. A new game's cut at an episode is one it plays, before its last (a league's own
 * keeps what it plays, as a span changes); a cut at the phase the game starts at has nobody to cut. Which phases there are is
 * the data rule's (settleProblems).
 */
function knockoutProblems(rank, s, league) {
  const out = [];
  const draft = isObj(s.get) && s.get.by === 'draft';
  if (rank.race !== undefined) {
    if (!(isObj(rank.race) && isInt(rank.race.to, 1) && rank.race.to <= MAX_RACE)) out.push(['.race', `A race is { to: 1 to ${MAX_RACE} points }: the first there wins`]);
    else if (!draft) out.push(['.race', "A race is a draft's for now: a game of questions' and a pool's come with A11 part 2"]);
    else if (rank.by !== 'total' && rank.by !== 'standing') out.push(['.race', 'A race is won on points: it ranks by the total, or last one standing']);
  }
  if (rank.cut === undefined) return out;
  const list = rank.cut;
  if (!Array.isArray(list) || !list.length || list.length > MAX_CUTS) return [...out, ['.cut', `Players knocked out is a list of 1 to ${MAX_CUTS} cuts`]];
  if (!draft) out.push(['.cut', "Knocking players out is a draft's for now: a game of questions' and a pool's come with A11 part 2"]);
  else if (rank.by !== 'standing') out.push(['.by', "A game that knocks players out ranks last one standing: whoever's still in, then whoever went out last"]);
  const first = isObj(s.span) ? spanStart(s.span) : null;
  const last = isObj(s.span) ? s.span.to : null;
  list.forEach((c, i) => {
    const at = `.cut[${i}]`;
    if (!isObj(c)) return out.push([at, 'Each cut is { at, out, tie, quiet }']);
    const keys = isObj(c.at) ? Object.keys(c.at) : [];
    if (keys.length !== 1 || !CUT_AT.includes(keys[0])) out.push([`${at}.at`, 'When: { every: n } (every n episodes, by the points over them), { episode: n } or { phase: id } (by the total)']);
    else if (keys[0] === 'every' && !(isInt(c.at.every, 1) && c.at.every <= MAX_WINDOW)) out.push([`${at}.at.every`, `Every 1 to ${MAX_WINDOW} episodes`]);
    else if (keys[0] === 'episode' && !isInt(c.at.episode, 1)) out.push([`${at}.at.episode`, 'After an episode number, 1 or later']);
    else if (keys[0] === 'phase' && !(typeof c.at.phase === 'string' && c.at.phase)) out.push([`${at}.at.phase`, 'Before which phase of the season']);
    else if (keys[0] === 'phase' && spanPhase(s.span) === c.at.phase) out.push([`${at}.at.phase`, 'The game starts at that phase, so nobody has played yet to cut']);
    else if (keys[0] === 'episode' && !league && ((first !== null && c.at.episode < first) || (last !== null && c.at.episode >= last))) {
      out.push([`${at}.at.episode`, "It's not one of the game's episodes before its last, so the cut would never matter"]);
    }
    if (!(c.out === 'half' || (isInt(c.out, 1) && c.out <= MAX_CUT_OUT))) out.push([`${at}.out`, `How many go: 1 to ${MAX_CUT_OUT}, or 'half' (the bottom half)`]);
    if (own(VOCAB['rank.cut.tie'], c.tie) === undefined) out.push([`${at}.tie`, 'A tie at the line: keep (nobody tied there goes) or all (they all go, never everyone left)']);
    if (own(VOCAB['rank.cut.quiet'], c.quiet) === undefined) out.push([`${at}.quiet`, 'A night nobody goes home: cut (like any other) or skip (no cut that night)']);
  });
  return out;
}

/** A pool's second pick (A10 part 2: get.second), as [[at, problem]]: { fallback: void | counts }, beside a pool whose picks
 *  stay in (a night two go home is one where two people leave; nobody goes home in a pool that scores). */
function secondPickProblems(g, s) {
  if (!isObj(g)) return [['', 'A second pick is { fallback }']];
  const out = [];
  if (own(VOCAB['get.second.fallback'], g.fallback) === undefined) out.push(['.fallback', 'On a night only one goes home, a second pick is void (no points either way) or counts like the first: void, or counts']);
  if (!(isObj(s.score) && s.score.by === 'survive' && s.score.means === 'staysIn')) out.push(['', 'A second pick counts on a night two go home: a pool whose picks stay in']);
  return out;
}

/** A draft's waivers, as WaiverLogic plays them: nothing it would quietly read as something else. */
function waiverProblems(w, s) {
  if (!isObj(w)) return [['', 'Waivers are an object']];
  const out = [];
  const roster = isInt(s.get.each, 1) ? s.get.each : null;
  const lineup = countKind(s.count) === 'start';
  if (!WAIVER_FEELS.includes(w.feel)) out.push(['.feel', `The feel is ${WAIVER_FEELS.join(', ')}`]);
  if (!REPLACE_RULES.includes(w.replace)) out.push(['.replace', `Replacements are ${REPLACE_RULES.join(', ')}`]);
  else if (w.replace === 'whenShort' && !lineup) out.push(['.replace', "Only a lineup is short: with everyone counting, a loss is replaced right away ('always')"]);
  if (w.short !== null && !(isInt(w.short, 0) && (roster === null || w.short <= roster - 1))) out.push(['.short', `Short at 0 to ${roster === null ? 'the team less one' : roster - 1} still in, or null for the recommended`]);
  const win = w.windows;
  if (!(isObj(win) && WINDOW_SCHEDULES.includes(win.schedule) && isInt(win.every, 2) && isInt(win.swaps, 0))) out.push(['.windows', 'Windows are { schedule: everyEpisode | every | manual, every: 2 or more, swaps: 0 or more }']);
  else if (roster !== null && win.swaps > roster) out.push(['.windows.swaps', `A window swaps at most the team: ${roster}`]);
  // A10 part 3c: a stock market's trades are its windows' swaps.
  else if (marketOf(s) && win.swaps === 0) out.push(['.windows.swaps', 'A stock market trades in its waiver windows: each needs at least one trade (a swap)']);
  if (!WAIVER_ORDERS.includes(w.order)) out.push(['.order', `The order is ${WAIVER_ORDERS.join(', ')}`]);
  if (!WAIVER_HOURS.includes(w.hours)) out.push(['.hours', `They run ${WAIVER_HOURS.join(', ')} hours before`]);
  if (typeof w.freeAgency !== 'boolean') out.push(['.freeAgency', 'freeAgency is true or false']);
  if (typeof w.autoFill !== 'boolean') out.push(['.autoFill', 'autoFill is true or false']);
  return out;
}

/**
 * A game of questions' parlays (A9), as [[at, problem]]: each { of: 2 to MAX_LEGS of its question ids, times: more than 1,
 * up to MAX_TIMES }. A leg is one answer that's right or wrong (one person or group, a yes or no, a choice, a number, an
 * over/under), plain (no share, rollover, shrink or wager: the parlay is how it combines), and every leg is asked the same way,
 * so they share their windows; a question is in one parlay at most.
 */
function parlayProblems(list, s) {
  if (!Array.isArray(list) || !list.length || list.length > MAX_PARLAYS) return [['', `Parlays are a list of 1 to ${MAX_PARLAYS}`]];
  const out = [];
  const qs = new Map((Array.isArray(s.ask) ? s.ask : []).filter(isObj).map((q) => [q.id, q]));
  const used = new Set();
  list.forEach((p, i) => {
    const at = `[${i}]`;
    if (!isObj(p)) return out.push([at, 'A parlay is { of: [question ids], times }']);
    if (!(isNum(p.times) && p.times > 1 && p.times <= MAX_TIMES)) out.push([`${at}.times`, `A parlay multiplies by more than 1, up to ${MAX_TIMES}`]);
    const of = p.of;
    if (!(Array.isArray(of) && of.length >= 2 && of.length <= MAX_LEGS && of.every((id) => typeof id === 'string' && id))) return out.push([`${at}.of`, `A parlay is 2 to ${MAX_LEGS} questions`]);
    if (new Set(of).size !== of.length) return out.push([`${at}.of`, 'A parlay names each question once']);
    const legs = [];
    for (const id of of) {
      const q = qs.get(id);
      if (!q) out.push([`${at}.of`, `"${id}" isn't one of its questions`]);
      else if (used.has(id)) out.push([`${at}.of`, `"${id}" is in two parlays`]);
      else {
        used.add(id);
        legs.push(q);
      }
    }
    for (const q of legs) {
      const single = LEGS.includes(q.answer) && !(NAMES.includes(q.answer) && q.pick !== 1) && q.each === undefined;
      if (!single) out.push([`${at}.of`, `"${q.id}" isn't one answer that's right or wrong: a parlay's legs are one person or group, a yes or no, a choice, a number or an over/under`]);
      else if (q.share !== undefined || q.rollover !== undefined || q.shrink !== undefined || q.wager !== undefined) out.push([`${at}.of`, `"${q.id}" combines its own way: a parlay's legs are plain`]);
    }
    const way = (q) => `${q.asked}|${q.every || ''}|${q.over || ''}`;
    if (legs.length > 1 && legs.some((q) => way(q) !== way(legs[0]))) out.push([`${at}.of`, "A parlay's questions are asked the same way, so they're answered together"]);
  });
  return out;
}

/**
 * When a draft's points multiply (A9 part 2: score.times), as [[at, problem]]: 1 to MAX_WHEN windows, each { times, and one of
 * episode: n | from: n (to: m, or null or left out for the season's end) | phase: id | finale: true }. times is more than 0
 * (half points are 0.5) and not 1, up to MAX_TIMES; an episode in two windows multiplies by both. A new game's windows are
 * inside its episodes, and its finale needs a game that runs to it (a league's own keeps what it plays, as a span changes).
 * Which phases there are, and whether a show has a finale results can place, is the data rule's (settleProblems).
 */
function timesProblems(list, s, league) {
  if (!Array.isArray(list) || !list.length || list.length > MAX_WHEN) return [['', `When points multiply is a list of 1 to ${MAX_WHEN}`]];
  const out = [];
  const first = isObj(s.span) ? spanStart(s.span) : null;
  const last = isObj(s.span) ? s.span.to : null;
  list.forEach((t, i) => {
    const at = `[${i}]`;
    if (!isObj(t)) return out.push([at, 'Each is { times, and one of episode, from (and to), phase or finale }']);
    if (!(isNum(t.times) && t.times > 0 && t.times !== 1 && t.times <= MAX_TIMES)) out.push([`${at}.times`, `Points multiply by more than 0 (half is 0.5), up to ${MAX_TIMES}, and not 1`]);
    const kinds = WHEN.filter((k) => t[k] !== undefined);
    if (kinds.length !== 1) return out.push([at, 'Say when, once: an episode, a run of them (from, to), a phase or the finale']);
    const k = kinds[0];
    if (k !== 'from' && t.to !== undefined) out.push([`${at}.to`, 'Only a run of episodes (from) has an end']);
    if (k === 'episode' && !isInt(t.episode, 1)) out.push([`${at}.episode`, 'An episode number, 1 or later']);
    if (k === 'from') {
      if (!isInt(t.from, 1)) out.push([`${at}.from`, 'A run starts at an episode number, 1 or later']);
      else if (t.to !== undefined && t.to !== null && !(isInt(t.to, 1) && t.to >= t.from)) out.push([`${at}.to`, 'A run ends at an episode from its start on, or null for the season\'s end']);
    }
    if (k === 'phase' && !(typeof t.phase === 'string' && t.phase)) out.push([`${at}.phase`, 'Which phase of the season']);
    if (k === 'finale' && t.finale !== true) out.push([`${at}.finale`, 'finale is true']);
    if (league || out.some(([where]) => where.startsWith(at))) return;
    // A new game's: inside the episodes it plays.
    const lo = k === 'episode' ? t.episode : k === 'from' ? t.from : null;
    const hi = k === 'episode' ? t.episode : k === 'from' && isInt(t.to, 1) ? t.to : null;
    if (lo !== null && ((first !== null && hi !== null && hi < first) || (last !== null && lo > last))) out.push([at, "It's outside the game's episodes, so it would never count"]);
    if (k === 'finale' && last !== null) out.push([`${at}.finale`, 'The finale counts only in a game that runs to it: no end of its own']);
  });
  return out;
}

// The data-can-settle rule (the user's decision, 2026-10-27): only what data can settle. Sports: box scores and
// scoreboards (the Sport's stat keys, finals). Shows: the results research, which counts as data.
function settleProblems(s, ctx, opts) {
  const out = [];
  // A start at a phase: one of the season's, never its first (that one starts with Episode 1).
  const phase = spanPhase(s.span);
  if (phase && Array.isArray(ctx.phases)) {
    const at = ctx.phases.findIndex((p) => (isObj(p) ? p.id : p) === phase);
    if (at < 0) out.push(['span.from.phase', `"${phase}" isn't one of the season's phases`]);
    else if (at === 0) out.push(['span.from.phase', 'The first phase starts with Episode 1: start it there']);
  }
  const moments = Array.isArray(ctx.moments) ? ctx.moments : [];
  const momentById = new Map(moments.map((m) => [m.id, m]));
  const stats = new Set((Array.isArray(ctx.stats) ? ctx.stats : []).map((x) => (isObj(x) ? x.key : x)));
  const roles = new Set(Array.isArray(ctx.roles) ? ctx.roles : []);
  const byData = (m) => m.answeredBy === 'research' || (!!m.auto && m.answeredBy !== 'league');
  const couchWord = (m) => `${m.label || m.id} is the couch's word: research doesn't answer it, so data can't settle it`;
  // `strict`: the couch's word never settles it, even in a league's own rules (a question: only Weekly Calls' calls on a talk
  // show keep the couch's word, below).
  const momentProblem = (id, strict) => {
    const m = momentById.get(id);
    if (!m) return `"${id}" isn't one of the show's moments`;
    if ((strict || !opts.league) && !byData(m)) return couchWord(m);
    return null;
  };
  // An exclusive draft only when the pool covers every pick (the 9:10 PM decision): a new game's, where it drafts. A league's own
  // keeps the draft it made (its couch grows by people joining, who ask: extras.join).
  const get = isObj(s.get) ? s.get : {};
  // A10 part 4b: teams, not people (teamsOf: ctx.teams, else ctx.couch).
  const teams = teamsOf(ctx);
  if (!opts.league && get.by === 'draft' && get.own === 'exclusive' && isInt(get.each, 1) && isInt(ctx.pool, 0) && teams && !covers({ pool: ctx.pool, people: teams.n, each: get.each })) {
    const more = `${teams.said} × ${get.each} ${get.each === 1 ? 'pick' : 'picks'} is more than the ${ctx.pool} who can be drafted`;
    // A10 part 3b: an auction can't be shared; its shared version is a salary cap (prices from the data, no bidding).
    out.push(['get.own', get.order === 'auction' ? `${more}: an auction needs castaways nobody else can have, so make it a salary cap (prices from the data, no bidding), where two of you can have the same one` : `${more}: make it shared, so two of you can have the same one`]);
  } else if (!opts.league && marketOf(s) && get.own === 'exclusive' && isInt(get.each, 1) && isInt(ctx.pool, 0) && teams && teams.n * get.each >= ctx.pool) {
    // A10 part 3c: an exclusive stock market needs someone left over to buy, or nobody can ever trade (the count where it drafts;
    // as people go home a replacement waits for someone free, as an exclusive draft's waivers do).
    out.push(['get.own', `${teams.said} × ${get.each} ${get.each === 1 ? 'pick' : 'picks'} takes all ${ctx.pool} who can be drafted, so nobody's left to buy: make it shared, so two of you can hold the same one${get.order === 'auction' ? ' (a salary cap: prices from the data, no bidding)' : ''}`]);
  }
  // A10 part 4: keepers come from one of the couch's games on an earlier season of the show (ctx.games, the context pack's: ids,
  // or { id }), never a game typed in. Left out: not checked. The exclusive count above needs nothing more for keepers: each
  // keeper takes one castaway out of the pool and one pick out of the draft, so a pool that covers every pick still does.
  if (get.by === 'draft' && isObj(get.keep) && Array.isArray(ctx.games) && typeof get.keep.from === 'string') {
    const ids = new Set(ctx.games.map((g) => (isObj(g) ? g.id : g)));
    if (!ids.has(get.keep.from)) out.push(['get.keep.from', "Keepers come from one of the couch's games on an earlier season of this show"]);
  }
  // A10 part 3: a draft spread across the cast's groups needs a show whose cast has groups, and a guy and a girl needs data
  // that says who is which: no show's cast or research records it, so nothing settles it. Exclusive, each group where it
  // drafts covers its share of every team (ctx.poolGroups: how many can be drafted in each; the pool shrinking per group).
  if (get.by === 'draft' && isObj(get.across)) {
    if (get.across.of === 'group' && ctx.grouped === false) out.push(['get.across.of', "Nobody on the show is in a group (a tribe, a team): there's nothing to spread across"]);
    if (get.across.of === 'gender') out.push(['get.across.of', "Nothing in the show's data says who's a guy and who's a girl (its cast and research don't record it), so nothing can check a draft of one each"]);
    // Groups with someone in them, as the spread reads them (SpreadLogic.groupsNow).
    const sizes = Array.isArray(ctx.poolGroups) ? ctx.poolGroups.filter((n) => isInt(n, 1)) : [];
    const b = spreadBounds(get.each, sizes.length);
    if (!opts.league && get.across.of === 'group' && get.own === 'exclusive' && b && b.least && teams) {
      const short = Math.min(...sizes);
      if (!covers({ pool: short, people: teams.n, each: b.least })) out.push(['get.own', `${teams.said} each need ${b.least} from every group, and one has only ${short}: make it shared, so two of you can have the same one`]);
    }
  }
  const score = isObj(s.score) ? s.score : {};
  if (score.by === 'moments') {
    const given = pointsMap(score.points) ? score.points : {};
    const shared = isObj(s.get) && s.get.own === 'shared';
    if (!opts.league) {
      // Every moment that scores, by the spec's points for it or else the rulebook's own (ActiveRosterLogic.pointsFor); one
      // the rulebook switched off scores nothing whatever the points say (it isn't among the rules' events).
      for (const m of moments) {
        const pts = m.off ? 0 : Object.prototype.hasOwnProperty.call(given, m.id) ? given[m.id] : defaultOf(m.defaultPoints, shared);
        if (pts !== 0 && !byData(m)) out.push([`score.points.${m.id}`, `${couchWord(m)}. Score it 0`]);
      }
      // ...and every moment the spec gives points is the show's.
      for (const [id, pts] of Object.entries(given)) {
        if (pts !== 0 && !momentById.has(id)) out.push([`score.points.${id}`, `"${id}" isn't one of the show's moments`]);
      }
    }
  }
  if (score.by === 'stats' && pointsMap(score.points)) {
    for (const key of Object.keys(score.points)) if (!stats.has(key)) out.push([`score.points.${key}`, `Nothing counts "${key}": it isn't one of the sport's stats`]);
  }
  // A10 part 2: a pool's buyback until a phase is one of the season's, never its first (where it starts is data: the desk
  // confirms it); a second pick needs results that say who goes home (a night two go is known only from them).
  if (score.by === 'survive' && isObj(score.buyback) && isObj(score.buyback.before) && typeof score.buyback.before.phase === 'string' && score.buyback.before.phase && Array.isArray(ctx.phases)) {
    const at = ctx.phases.findIndex((p) => (isObj(p) ? p.id : p) === score.buyback.before.phase);
    if (at < 0) out.push(['score.buyback.before.phase', `"${score.buyback.before.phase}" isn't one of the season's phases`]);
    else if (at === 0) out.push(['score.buyback.before.phase', 'The first phase starts with Episode 1: nobody is out before it']);
  }
  if (get.by === 'pick' && get.second !== undefined && ctx.results === false) out.push(['get.second', "The show's results don't say who goes home, so nothing says a night sent two"]);
  // A11 part 1: a cut before a phase is one of the season's, never its first (that starts with Episode 1: nobody has played); where
  // it starts is data (the desk confirms it). A night nobody goes home skipped needs results that say who goes home.
  if (isObj(s.rank) && Array.isArray(s.rank.cut)) {
    const ids = Array.isArray(ctx.phases) ? ctx.phases.map((p) => (isObj(p) ? p.id : p)) : null;
    s.rank.cut.forEach((c, i) => {
      if (!isObj(c) || !isObj(c.at)) return;
      if (ids && typeof c.at.phase === 'string' && c.at.phase) {
        const at = ids.indexOf(c.at.phase);
        if (at < 0) out.push([`rank.cut[${i}].at.phase`, `"${c.at.phase}" isn't one of the season's phases`]);
        else if (at === 0) out.push([`rank.cut[${i}].at.phase`, 'The first phase starts with Episode 1: nobody has played yet to cut']);
      }
      if (c.quiet === 'skip' && ctx.results === false) out.push([`rank.cut[${i}].quiet`, "The show's results don't say who goes home, so nothing says a night was quiet"]);
    });
  }
  // A9 part 2: a phase whose points multiply is one of the season's (where it starts is data: the desk confirms it); the finale
  // is the episode that ends the season, which only a show whose results say who goes home or wins places.
  if (score.by === 'moments' && Array.isArray(score.times)) {
    const ids = Array.isArray(ctx.phases) ? ctx.phases.map((p) => (isObj(p) ? p.id : p)) : null;
    score.times.forEach((t, i) => {
      if (!isObj(t)) return;
      if (ids && typeof t.phase === 'string' && t.phase && !ids.includes(t.phase)) out.push([`score.times[${i}].phase`, `"${t.phase}" isn't one of the season's phases`]);
      if (t.finale === true && ctx.results === false) out.push([`score.times[${i}].finale`, "The show's results don't say who goes home or wins, so nothing says which episode is its finale"]);
    });
  }
  (Array.isArray(s.ask) ? s.ask : []).forEach((q, i) => {
    const st = (q && q.settle) || {};
    if (st.by === 'moment' && typeof st.moment === 'string') {
      const p = momentProblem(st.moment, true);
      if (p) out.push([`ask[${i}].settle.moment`, p]);
    }
    // A secret role is one of the show's, recorded by research (the cast's starting roles, recruits).
    if (st.by === 'role' && typeof st.role === 'string' && !roles.has(st.role)) {
      out.push([`ask[${i}].settle.role`, roles.size ? `"${st.role}" isn't one of the show's roles: ${[...roles].join(', ')}` : "The show has no secret roles to settle it"]);
    }
    // A phase (A7): one of the season's, never its first (that starts with Episode 1); asked by phase, a season that has more
    // than one (where each starts is data: the desk confirms it, from research and the results).
    if (Array.isArray(ctx.phases)) {
      const ids = ctx.phases.map((p) => (isObj(p) ? p.id : p));
      if (st.by === 'phase' && typeof st.phase === 'string') {
        const at = ids.indexOf(st.phase);
        if (at < 0) out.push([`ask[${i}].settle.phase`, `"${st.phase}" isn't one of the season's phases`]);
        else if (at === 0) out.push([`ask[${i}].settle.phase`, 'The first phase starts with Episode 1: nothing to settle']);
      }
      if (q && q.asked === 'phase' && ids.length < 2) out.push([`ask[${i}].asked`, 'The season has one phase: ask it once, or each episode']);
    }
    // A group answer names a group someone's on, as research records them after each swap: a show whose cast has none can't.
    if (q && q.answer === 'group' && ctx.grouped === false) out.push([`ask[${i}].answer`, "Nobody on the show is in a group (a tribe, a team): name a person instead"]);
    if (st.by === 'stat' && typeof st.stat === 'string' && !stats.has(st.stat)) out.push([`ask[${i}].settle.stat`, `Nothing counts "${st.stat}": it isn't one of the sport's stats`]);
    if (st.by === 'results' && ctx.results === false) out.push([`ask[${i}].settle`, "The show's results don't say who goes home or wins"]);
    else if (st.by === 'results' && ['winner', 'placed', 'top', 'split'].includes(st.take) && ctx.winner === false) out.push([`ask[${i}].settle`, "Nobody wins this show: its results don't crown a winner"]);
    else if (st.by === 'results' && st.take === 'split' && ctx.jury === false) out.push([`ask[${i}].settle`, 'A jury vote split needs a finale a jury decides']);
    // Each person's points by the game's rules (A8): every moment that scores in them is one research answers.
    if (st.by === 'points') {
      const scoring = moments.filter((m) => !m.off && defaultOf(m.defaultPoints, false) !== 0);
      if (!scoring.length) out.push([`ask[${i}].settle`, "The show's rules score nothing to rank by"]);
      for (const m of scoring) if (!byData(m)) out.push([`ask[${i}].settle`, `${couchWord(m)}, and it scores in a points leaderboard`]);
    }
    // A talk show's calls are what the couch says happened: its word, which only a league's own keeps (Weekly Calls).
    if (st.by === 'calls' && ctx.calls === 'couch' && !opts.league) out.push([`ask[${i}].settle`, "The show's calls are settled by the couch's word here, not its results"]);
  });
  return out;
}
/** A moment's own points for the draft's ownership (a format may give { exclusive, shared }). */
const defaultOf = (d, shared) => (isObj(d) ? d[shared ? 'shared' : 'exclusive'] || 0 : d || 0);

/** "sports", "later" in the order a spec waits for them. */
const STEP_ORDER = ['sports', 'later'];
const STEP_NAMES = {
  sports: 'the sports branch',
  later: 'no step yet',
};

/**
 * What a well-formed spec needs that isn't built, as [{ at, step, problem }]: a value only a later step builds ('sports',
 * 'later'), or, with every value built, what's still to say (an over/under's line: step null) or a combination no game
 * plays yet (step null). Empty: today's engine plays it (typeOf gives its league type). For the wizard to say what isn't
 * there yet, and G2's sports requests.
 */
function specWaitsFor(spec) {
  const s = fullSpec(spec);
  const out = [];
  const need = (at, step, what) => out.push({ at, step, problem: `${what} comes with ${STEP_NAMES[step]}` });
  const val = (key, at, v, what) => {
    const step = own(VOCAB[key], v);
    if (step && step !== 'now') need(at, step, what);
  };
  const where = isObj(s.pool) && isObj(s.pool.where) ? Object.keys(s.pool.where)[0] : null;
  if (where) val('pool.where', 'pool.where', where, where === 'teams' ? 'Picking from teams' : 'Picking from a group');
  if (isObj(s.get)) val('get.by', 'get.by', s.get.by, 'Squares');
  if (isObj(s.get) && isObj(s.get.groups)) val('get.groups.fallback', 'get.groups.fallback', s.get.groups.fallback, "Starting the game's next stage when a slot's groups aren't sure");
  if (isObj(s.get) && isObj(s.get.across)) val('get.across.of', 'get.across.of', s.get.across.of, 'A draft of a guy and a girl each');
  if (isObj(s.get) && isObj(s.get.budget)) val('get.budget.left', 'get.budget.left', s.get.budget.left, "Bidding on waivers with the draft's money left over");
  const count = countKind(s.count);
  if (count) val('count', 'count', count, 'Best ball');
  if (isObj(s.score)) val('score.by', 'score.by', s.score.by, 'Scoring by stats');
  if (isObj(s.rank)) val('rank.by', 'rank.by', s.rank.by, `Ranking by ${s.rank.by}`);
  val('closes', 'closes', s.closes, `Locking ${s.closes}`);
  (Array.isArray(s.ask) ? s.ask : []).forEach((q, i) => {
    const steps = [own(VOCAB['ask.answer'], q && q.answer), own(VOCAB['ask.settle'], q && q.settle && q.settle.by), own(VOCAB['ask.fallback'], q && q.fallback)].filter(Boolean);
    const step = STEP_ORDER.slice().reverse().find((x) => steps.includes(x));
    if (step) need(`ask[${i}]`, step, `"${(q && q.ask) || q.id}"`);
  });
  // Said, but not all of it yet: an over/under with no line (ESPN's, or the wizard asks).
  const lines = (Array.isArray(s.ask) ? s.ask : []).map((q, i) => [q, i]).filter(([q]) => isObj(q) && q.answer === 'overUnder' && !isNum(q.line));
  const seen = new Set();
  const steps = out.filter((x) => !seen.has(`${x.at}|${x.step}`) && seen.add(`${x.at}|${x.step}`));
  steps.sort((a, b) => STEP_ORDER.indexOf(a.step) - STEP_ORDER.indexOf(b.step));
  if (!steps.length) for (const [q, i] of lines) steps.push({ at: `ask[${i}].line`, step: null, problem: `"${q.ask || q.id}" needs its line` });
  if (!steps.length && !typeOf(s)) steps.push({ at: '', step: null, problem: 'No game plays this way yet' });
  return steps;
}

module.exports = {
  SPEC_VERSION, VOCAB, TAKES, SETTLES_FOR, SEASON_TAKES, EACH_SETTLES_FOR, NAMES, NUMBERS, MAX_WINDOW, LATE_HOURS, windowed,
  RANKS, MAX_ORDER, MAX_WITHIN, MAX_CHIPS, MAX_PAIRS, WAGERS, WAGER_TOTAL, SHARES, SHRINK_PER, LEGS, MAX_LEGS, MAX_TIMES, MAX_WHEN, WHEN, PRESETS, PRESET_TYPES, TYPE_PRESETS, PRESET_LABELS, NO_WAIVERS, DRAFT_ROOM,
  MAX_GROUP_SLOTS, GROUP_SLOTS, covers, MAX_LIVES, MAX_BUYBACKS, MAX_MULLIGANS, MAX_BUYBACK_COST, BUYBACK, SECOND_PICK, poolParts,
  DRAFT_ACROSS, DRAW_OWN, spreadBounds, MAX_BUDGET, BUDGET, CAP, AUCTION, MAX_BIDS, ceilingFor, budgetParts, TRADE, MARKET_LEFT,
  marketWaivers, marketOf, KEEP, keepParts, SEATS, MAX_SEAT_PEOPLE, seatPeople, teamsOf,
  MAX_RACE, MAX_CUTS, MAX_CUT_OUT, CUT, CUT_AT, knockoutParts,
  REPLACE_RULES, WINDOW_SCHEDULES, WAIVER_FEELS, WAIVER_ORDERS, WAIVER_HOURS, DRAFT_TIMERS, MAX_BET_POINTS, JOINS, ORDER_OF,
  MAX_TEAM, MAX_STARTERS, MAX_BENCH, MAX_LINEUP_TEAM, MAX_QUESTIONS, MAX_PICK, MAX_QUESTION_POINTS, MAX_OPTIONS, YES_NO,
  CALLS, finaleQuestions, finaleOf, isCalls, callsAsk, fullQuestion, optionRange, playable,
  fullSpec, typeOf, playsAs, flagsOf, sizesOf, specProblems, specWaitsFor, waiversFit, finaleFits, betsFit, countKind, presetOf, sameValue, own,
  spanStart, spanPhase,
};
