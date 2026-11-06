// Every draft's shape on one made-up season, for the scoring sequence's proof (docs/PLAN-start-a-game-gpt.md track C, C2 part 1:
// "a test per shape that the old scorer and the sequence agree episode by episode"; tests/sequence-agree.test.js). Each shape is
// a game spec on the same league: fifteen castaways c0 to c14, four seats (ann, bo, cy, di), seven episodes with every kind of
// night (a double boot, a medevac, a quit, a night nobody went home, the finale with a fire-making loss, two losing finalists and
// the winner), moments counted in units that leave float noise (3 x 1.1), lineups set, carried and left unset, captains named and
// carried, two pickups (one after the last episode but one, so a mark sees the move before the series does), side bets (one paying,
// one alone, one shared), finale predictions, group slots on the format's pairs, a handicap, a stock market's cash. C2 part 2 adds
// the week's results on the same season (weekShapes: knockouts, head to head, teams of players, pools with every piece), each
// read with its walk's own output too (weekOf). C2 part 3 adds what the server scores outside the state (outsideShapes: a game of
// questions with every way its points combine and every walk on it, its answers and what only the server knows as data here;
// Weekly Calls and bingo on the server's counts; a game in stages on its stages' tables), each read as the server reads it
// (questionsRead, outsideRead, stageRead).
//
// What each read is (readOf): everything the engine scores a draft by, as a viewer sees it at a mark (nothing seen, each episode,
// everything; GhostLogic.viewFor, as golden.js reads): the table's rows (every field, in its order), the knockouts' series
// episode by episode, each seat's episodeScore for each episode with results (a game scored by moments), each castaway's place and
// the still-in points, the market, the finale's points, who's out and where the game ends.
//
// The record (scoring-shapes.json) is the scorers' reads before C2 (made by the code at d5222e68, C1), a hash a read: the test
// reads each again on the code as it stands and compares. Remake it only when a step changes how a draft scores on purpose, and
// say which reads move and why. Moved so far: C2 part 2, a plain lineup's table rows (15 shapes, 180 reads: lineup, lineup-early,
// handicap, race, matchups and the week's lineups, at the marks from Episode 3 on), a cent each on the half-cent moments (0.5
// points x 1.15 units), its table now adding up each episode's total as its series always did, where it rounded after each moment
// (`--diff` against d5222e68 lists them). C2 part 3's shapes (q-plain on) were recorded from the engine before part 3 (its
// commit's parent, with --ref=HEAD), and read the same on d5222e68's. C2 part 4a's (q-shrink-shared, q-parlay-legs, q-parlay-shrink)
// are combinations no engine before it plays (refused there), so their reads are new, recorded from part 4a's engine and proven by
// hand in tests/shared-shrink.test.js and tests/parlay-legs.test.js; the 1,620 reads before them stay as they were. C2 part 4b's
// (seriesShapes: a pool's series of totals, teams knocked out and racing) likewise, from part 4b's engine, proven by hand in
// tests/pool-series.test.js and tests/team-knockouts.test.js and checked in tests/sequence-agree.test.js; the 1,674 before them stay.
// C2 part 4c's (askShapes: a draft's own questions, an Outlast's and a lineup's, with every way their points combine, the server's
// facts, head to head, teams and a handicap on them) likewise, from part 4c's engine, each read with the questions'
// lines the server hands it (o.asks), proven by hand in tests/draft-questions.test.js and checked in tests/sequence-agree.test.js;
// the 1,836 before them stay. C3's (multiplyShapes: a multiplier on how a holding joined) likewise, from C3's engine, proven by hand
// in tests/multipliers.test.js; the 1,998 before them stay. C4's (ownShapes: replacements and swaps from anyone still in, so a
// castaway two teams hold in an exclusive draft) likewise, from C4's engine, proven by hand in tests/ownership.test.js, and each
// read the same as the engine before C4 gives on the same holdings with no `own` (which nothing scored reads); the 2,088 before
// them stay. C5's (weekWonShapes: a pick each episode scored by what they do, only some moments and hits, weeks won) likewise, from
// C5's engine, proven by hand in tests/weeks.test.js; the 2,124 before them stay. C6's (in outsideShapes: a stake beside a split
// pot, a parlay's staked leg, a bank at the pool's odds, a bank that runs out; part 2, a ticket) likewise, from C6's engine, proven
// by hand below and in tests/money.test.js; the 2,250 before them stay:
//   node tests/fixtures/scoring-shapes.js --write [--ref=<git ref>]      the record, from this tree's engine (or the ref's)
//   node tests/fixtures/scoring-shapes.js --print <shape> <seat|-> <mark|-|all> [--ref=<git ref>]   one read, in full
//   node tests/fixtures/scoring-shapes.js --diff [<shape>] [--ref=d5222e68]   where this tree's reads part from the ref's (the
//                                             scorers before C2 by default): each seat@mark, the fields, before -> after
// A ref's engine is its src/lib/game, exported into the OS temp folder (git archive) and taken out after.
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

// C2 part 3: the moments a game of questions here is settled by, the show's calls, the trivia key and the title quote (research
// rated reliable on it), so every shape's spec has no problems.
const CTX = {
  moments: ["individualImmunity", "idolPlayed", "idolFound", "tribeImmunity"].map((id) => ({ id, label: id, defaultPoints: 1, answeredBy: "research" })),
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  jury: true,
  phases: [{ id: "premerge" }, { id: "merged" }],
  calls: "results",
  trivia: true,
  facts: { titleQuote: { asked: 10, settled: 10 } },
};
const SEATS = ["ann", "bo", "cy", "di"];
const FINALE = (G) => G.finaleQuestions({ top3: 1, winner: 3, from: "any" });
// C2 part 4c: the same two, written out (a draft's own questions after them).
const FINALE_Q = [
  { id: "top3", ask: "Who makes the final three?", answer: "person", points: 1, settle: { by: "results", take: "top", place: 3 }, asked: "once", closes: "finale", pick: 3, from: "cast" },
  { id: "winner", ask: "Who wins?", answer: "person", points: 3, settle: { by: "results", take: "winner" }, asked: "once", closes: "finale", pick: 1, from: "cast" },
];

/** The shapes: [name, spec, how the league is held]. `own`: exclusive (each seat's three, two pickups) or shared (overlapping). */
function shapes(G) {
  const outlast = (more = {}) => ({ preset: "outlast", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, ...more });
  const lineup = (more = {}, get = { by: "draft", each: 3, order: "snake", own: "exclusive" }) => ({ preset: "weekly-lineup", get, count: { start: 2 }, score: { by: "moments", points: null }, ...more });
  const shared = { by: "draft", each: 3, order: "blind", own: "shared" };
  return [
    ["outlast", outlast({ ask: FINALE(G), extras: { bets: { points: 1 } } }), "exclusive"],
    ["outlast-shared", outlast({ get: shared, extras: { bets: { points: 1 } } }), "shared"],
    ["outlast-reverse", outlast({ score: { by: "place", reverse: true }, ask: FINALE(G) }), "exclusive"],
    ["outlast-early", outlast({ ask: FINALE(G), extras: { bets: { points: 1 } } }), "exclusive", { early: 7 }],
    ["outlast-cut", outlast({ rank: { by: "standing", cut: [{ at: { every: 2 }, out: 1 }] }, extras: { bets: { points: 1 } } }), "exclusive"],
    ["lineup", lineup({ ask: FINALE(G), extras: { bets: { points: 1 } } }), "exclusive"],
    ["lineup-shared", lineup({ extras: { bets: { points: 1 } } }, shared), "shared"],
    ["lineup-early", lineup({ ask: FINALE(G) }), "exclusive", { early: 6 }],
    ["captain", lineup({ score: { by: "moments", points: null, captain: { times: 2 } }, extras: { bets: { points: 1 } } }), "exclusive"],
    ["times", lineup({ score: { by: "moments", points: null, times: [{ times: 2, finale: true }, { times: 1.5, episode: 2 }, { times: 0.5, from: 4, to: 5 }] } }), "exclusive"],
    ["captain-times", lineup({ score: { by: "moments", points: null, captain: { times: 3 }, times: [{ times: 1.5, from: 2 }] }, ask: FINALE(G) }), "exclusive"],
    ["best-ball", lineup({ count: { best: 2 }, extras: { bets: { points: 1 } } }), "exclusive"],
    ["best-ball-shared", lineup({ count: { best: 2 } }, shared), "shared"],
    ["group-slots", lineup({}, { by: "draft", each: 3, order: "snake", own: "exclusive", groups: { slots: 1 } }), "exclusive", { pairs: true }],
    ["group-slots-sum", lineup({ score: { by: "moments", points: null, times: [{ times: 2, episode: 3 }] } }, { by: "draft", each: 3, order: "snake", own: "exclusive", groups: { slots: 2, points: "sum", fallback: "carry-on" } }), "exclusive", { pairs: true }],
    ["handicap", lineup({ rank: { by: "total", handicap: { points: 2 } } }), "exclusive", { history: true }],
    ["handicap-outlast", outlast({ rank: { by: "total", handicap: { points: 3 } } }), "exclusive", { history: true }],
    ["race", lineup({ rank: { by: "total", race: { to: 12 } } }), "exclusive"],
    ["guillotine", lineup({ count: { best: 2 }, rank: { by: "standing", cut: [{ at: { every: 1 }, out: 1 }] } }), "exclusive"],
    ["matchups", lineup({ rank: { by: "matchups" }, extras: { bets: { points: 1 } } }), "exclusive"],
    ["market", lineup({ rank: { by: "worth" } }, { by: "draft", each: 3, order: "blind", own: "shared", budget: { total: 100, floor: 5, ceiling: 25, trade: { fee: 1 } } }), "shared", { market: true }],
    ["market-total", lineup({}, { by: "draft", each: 3, order: "blind", own: "shared", budget: { total: 100, floor: 5, ceiling: 25, trade: {} } }), "shared", { market: true }],
    ...weekShapes(G, outlast, lineup),
    ...outsideShapes(),
    ...seriesShapes(outlast, lineup),
    ...askShapes(outlast, lineup),
    ...multiplyShapes(G, outlast, lineup),
    ...ownShapes(G, outlast, lineup),
    ...weekWonShapes(outlast, lineup),
  ];
}

/**
 * C5: the week as a result, on the same season: a pick each episode scored by what they do (POOL_PICKS, a pick's second person its
 * `more`: o.more), by its points, weeks won and in teams; only some moments, counted as hits per objective; and weeks won on a
 * lineup (a tie split), an Outlast and a pool by its points (a tie to nobody). No engine before C5 plays them (it refuses a pick
 * scored by moments, score.only, score.hits and rank.by weeks), so their reads are new (from C5's engine), the mechanics proven by
 * hand in tests/weeks.test.js; the 2,124 before them stay.
 */
function weekWonShapes(outlast, lineup) {
  const pick = (score = {}, rank = { by: "total" }) => ({ get: { by: "pick", each: 2 }, count: { pick: true }, score: { by: "moments", points: null, ...score }, rank });
  const pool = (rank) => ({ preset: "survival-pool", score: { by: "survive", means: "staysIn", points: 1 }, rank });
  const P = { week: true, pick: true, more: true };
  return [
    ["w-pick", pick(), null, P],
    ["w-pick-weeks", pick({ times: [{ times: 2, finale: true }] }, { by: "weeks" }), null, P],
    ["w-pick-hits", pick({ only: ["individualImmunity", "idolFound", "idolPlayed", "tribeImmunity"], hits: "objective" }, { by: "weeks" }), null, P],
    ["w-pick-teams", pick({ only: ["individualImmunity", "tribeImmunity"], hits: "pick" }, { by: "weeks", teams: { of: 2, made: "choose", score: "sum" } }), null, { ...P, teamSeats: true }],
    ["w-lineup", lineup({ score: { by: "moments", points: null, hits: "every" }, rank: { by: "weeks", ties: "split" } }), "exclusive", { week: true }],
    ["w-outlast", outlast({ rank: { by: "weeks" } }), "exclusive", { week: true }],
    ["w-pool", pool({ by: "weeks", ties: "none" }), null, { week: true, pick: true }],
  ];
}

/**
 * C3: a multiplier on how a holding joined (score.multiply), on the same season and its two pickups (bo's c12 for c3 after Episode
 * 2, cy's c14 for c8 after 6: both replacements). No engine before C3 plays them (it reads no score.multiply), so their reads are
 * new (from C3's engine), the mechanics proven by hand in tests/multipliers.test.js: an Outlast whose replacements score half, then a
 * quarter, with its finale predictions and side bets (each holding's line what it earns while it's yours: bo's c12 from 3 to 8,
 * half: 2.5, where its whole place was 8; cy keeps c8's 9 and c14 earns nothing more); an Outlast whose draft counts double and
 * pickups half, cut every two episodes and head to head; a lineup with a captain, the finale doubled and replacements half; best
 * ball with pickups triple per slot.
 */
function multiplyShapes(G, outlast, lineup) {
  const W = { week: true };
  const place = (multiply) => ({ by: "place", multiply });
  // Waivers that replace anyone gone (a multiplier on how a holding joined needs a move that makes it: settingsOf is null otherwise).
  const waivers = { ...G.fullSpec({ preset: "outlast" }).extras.waivers, replace: "always" };
  const x = (spec, more = {}) => ({ ...spec, extras: { ...(spec.extras || {}), waivers, ...more } });
  return [
    ["x-outlast", x(outlast({ score: place([{ joined: "replacement", times: [0.5, 0.25] }]), ask: FINALE(G) }), { bets: { points: 1 } }), "exclusive"],
    ["x-outlast-cut", x(outlast({ score: place([{ joined: "draft", times: 2 }, { joined: "pickup", times: 0.5 }]), rank: { by: "standing", cut: [{ at: { every: 2 }, out: 1 }] } })), "exclusive", W],
    ["x-outlast-matchups", x(outlast({ score: place([{ joined: "replacement", times: 3 }]), rank: { by: "matchups", quiet: "tie" } })), "exclusive", W],
    ["x-lineup", x(lineup({ score: { by: "moments", points: null, captain: { times: 2 }, times: [{ times: 2, finale: true }], multiply: [{ joined: "replacement", times: 0.5 }] }, ask: FINALE(G) })), "exclusive"],
    ["x-best-ball", x(lineup({ count: { best: 2 }, score: { by: "moments", points: null, multiply: [{ joined: "pickup", times: [3], per: "slot" }] } })), "exclusive", W],
  ];
}

/**
 * C4: ownership per holding (extras.waivers.own), on the same season with MOVES.own: replacements from anyone still in, so bo's
 * for c3 after Episode 2 is cy's c7 and di's for c9 after 4 is ann's c0 (each on both teams then), and cy's for c8 after 6 the
 * free c14. No engine before C4 plays them (it refuses `own`), so their reads are new (from C4's engine), proven by hand in
 * tests/ownership.test.js: the user's second game (an exclusive Outlast, its replacements shared, half then a quarter) with its
 * finale predictions (di's c0 earns from its 5 at Episode 4 to the Sole Survivor's 15, half: 5; cy keeps c7's whole place, bo half
 * of what it earns from 3), and best ball with both moves shared (c7's and c0's moments count for both their teams from the next
 * episode), with no multiplier.
 */
function ownShapes(G, outlast, lineup) {
  const waivers = { ...G.fullSpec({ preset: "outlast" }).extras.waivers, replace: "always" };
  const M = { moves: MOVES.own };
  return [
    ["own-outlast", outlast({ score: { by: "place", multiply: [{ joined: "replacement", times: [0.5, 0.25] }] }, ask: FINALE(G), extras: { waivers: { ...waivers, own: { replace: "shared" } } } }), "exclusive", M],
    ["own-best-ball", lineup({ count: { best: 2 }, extras: { waivers: { ...waivers, windows: { schedule: "every", every: 3, swaps: 1 }, own: { replace: "shared", swap: "shared" } } } }), "exclusive", { ...M, week: true }],
  ];
}

/**
 * The week's results (C2 part 2): what each episode's totals make, on the same season. Each is read with its walk's own output
 * too (weekOf: a pool's histories, the knockouts' walk, head to head's, the teams'). Knockouts on an Outlast and a lineup (a race,
 * a cut after an episode with a tie sending everyone tied, a cut before a phase taking half, the guillotine skipping a quiet
 * night and playing on to one left); head to head with playoffs (from an episode, and placed by the season's length), with an
 * odd seat (the median, or a bye with a quiet night tied), on an Outlast; teams of players (drawn by the mean, chosen and summed
 * with a move mid-season, on an Outlast, head to head between teams); and pools (a streak, points a pick, lives, a buyback until
 * an episode and until a phase, a mulligan, a second pick void or counting, a pick that never repeats skipped or missed, last one
 * standing ending it, and the night everyone left goes out: back, sharing it, by points).
 */
function weekShapes(G, outlast, lineup) {
  const pool = (score = {}, get = null, rest = {}) => ({ preset: "survival-pool", score: { by: "survive", ...score }, ...(get ? { get: { by: "pick", each: 1, ...get } } : {}), ...rest });
  const standing = (more = {}) => ({ rank: { by: "standing", ...more } });
  const P = { week: true, pick: true };
  const W = { week: true };
  // ann and cy both out the night of Episode 4 (cy's pick c9 goes home): everyone left that night.
  const allOut = { ...P, picks: { 4: { cy: ["c9"] } } };
  return [
    ["outlast-race", outlast({ rank: { by: "total", race: { to: 15 } } }), "exclusive", W],
    ["outlast-cut-episode", outlast({ rank: { by: "standing", cut: [{ at: { episode: 3 }, out: 1, tie: "all" }] } }), "exclusive", W],
    ["lineup-cut-phase", lineup({ rank: { by: "standing", cut: [{ at: { phase: "merged" }, out: "half" }] } }), "exclusive", { ...W, phaseStarts: { merged: 5 } }],
    ["lineup-cut-quiet", lineup({ rank: { by: "standing", cut: [{ at: { every: 1 }, out: 1, quiet: "skip" }], oneLeft: "plays" } }), "exclusive", W],
    ["lineup-race-cut", lineup({ rank: { by: "standing", race: { to: 14 }, cut: [{ at: { every: 2 }, out: 1 }] }, extras: { bets: { points: 1 } } }), "exclusive", W],
    ["matchups-playoffs", lineup({ rank: { by: "matchups", playoffs: { teams: 4, from: 6 } }, extras: { bets: { points: 1 } } }), "exclusive", W],
    ["matchups-placed", lineup({ rank: { by: "matchups", playoffs: { teams: 2 } } }), "exclusive", { ...W, seasonEpisodes: 7 }],
    ["matchups-odd", lineup({ rank: { by: "matchups" } }), "exclusive", { ...W, seats: ["ann", "bo", "cy"] }],
    ["matchups-bye", lineup({ rank: { by: "matchups", odd: "bye", quiet: "tie" } }), "exclusive", { ...W, seats: ["ann", "bo", "cy"] }],
    ["matchups-outlast", outlast({ rank: { by: "matchups", quiet: "tie" }, extras: { bets: { points: 1 } } }), "exclusive", W],
    ["teams-mean", lineup({ rank: { by: "total", teams: { of: 2 } }, extras: { bets: { points: 1 } } }), "exclusive", W],
    ["teams-sum", lineup({ rank: { by: "total", teams: { of: 2, score: "sum", made: "choose" } } }), "exclusive", { ...W, teamSeats: true }],
    ["teams-outlast", outlast({ rank: { by: "total", teams: { of: 2, score: "sum" } } }), "exclusive", W],
    ["teams-matchups", lineup({ rank: { by: "matchups", teams: { of: 2 } } }), "exclusive", W],
    ["pool", pool(), null, P],
    ["pool-points", pool({ points: 2 }), null, P],
    ["pool-lives", pool({ lives: 2 }, null, standing()), null, P],
    ["pool-buyback", pool({ lives: 1, buyback: { times: 1, before: { episode: 6 }, cost: 2 } }, null, standing()), null, P],
    ["pool-buyback-phase", pool({ lives: 1, buyback: { times: 2, before: { phase: "merged" } } }, null, standing()), null, { ...P, phaseStarts: { merged: 5 } }],
    ["pool-mulligans", pool({ lives: 1, mulligans: 1 }, null, standing()), null, P],
    ["pool-second", pool({}, { second: { fallback: "void" } }), null, P],
    ["pool-second-counts", pool({ lives: 2 }, { second: { fallback: "counts" } }, standing()), null, P],
    ["pool-never", pool({}, { repeat: "never", fallback: "skip" }), null, P],
    ["pool-never-miss", pool({ lives: 2 }, { repeat: "never" }, standing()), null, P],
    ["pool-last", pool({ lives: 1 }, null, standing({ oneLeft: "ends" })), null, P],
    ["pool-allout-back", pool({ lives: 1 }, null, standing({ allOut: "back" })), null, allOut],
    ["pool-allout-share", pool({ lives: 1 }, null, standing({ allOut: "share", oneLeft: "ends" })), null, allOut],
    ["pool-allout-points", pool({ lives: 1 }, null, standing({ allOut: "points" })), null, allOut],
  ];
}

/**
 * C2 part 4b: a pool's series of totals and the week's result on a team's totals, on the same season. No engine before part 4b plays
 * them, so their reads are new (from part 4b's engine), the mechanics proven by hand in tests/pool-series.test.js and
 * tests/team-knockouts.test.js: a pool ranked by its points (a second pick that counts; one that never repeats, skipped, at 2 points),
 * head to head on it with playoffs from Episode 6 (Episode 7's picks count nothing after the final), in teams of players (chosen
 * and summed, di moving mid-season; drawn, head to head between them) and with a handicap; teams knocked out (a lineup's three teams,
 * the guillotine every two episodes to one team left; an Outlast's two teams cut after Episode 3, playing on with one left, the cut
 * team's castaways back in the pool) and a race between teams.
 */
function seriesShapes(outlast, lineup) {
  const pool = (rank, score = {}, get = null) => ({ preset: "survival-pool", score: { by: "survive", means: "staysIn", points: 1, ...score }, ...(get ? { get: { by: "pick", each: 1, repeat: "cycle", ...get } } : {}), rank });
  const P = { week: true, pick: true };
  const W = { week: true };
  const THREE = { ann: [{ team: "t1", from: 1 }], bo: [{ team: "t2", from: 1 }], cy: [{ team: "t3", from: 1 }], di: [{ team: "t1", from: 1 }] };
  return [
    ["pool-total", pool({ by: "total" }, {}, { second: { fallback: "counts" } }), null, P],
    ["pool-total-never", pool({ by: "total" }, { points: 2 }, { repeat: "never", fallback: "skip" }), null, P],
    ["pool-matchups", pool({ by: "matchups", playoffs: { teams: 2, from: 6 } }), null, P],
    ["pool-teams", pool({ by: "total", teams: { of: 2, made: "choose", score: "sum" } }), null, { ...P, teamSeats: true }],
    ["pool-teams-matchups", pool({ by: "matchups", teams: { of: 2 } }), null, P],
    ["pool-handicap", pool({ by: "total", handicap: { points: 2 } }), null, { ...P, history: true }],
    ["teams-guillotine", lineup({ rank: { by: "standing", cut: [{ at: { every: 2 }, out: 1 }], teams: { of: 3, made: "choose", score: "sum" } } }), "exclusive", { ...W, teamSeats: THREE }],
    ["teams-cut-outlast", outlast({ rank: { by: "standing", cut: [{ at: { episode: 3 }, out: 1 }], oneLeft: "plays", teams: { of: 2 } } }), "exclusive", W],
    ["teams-race", lineup({ rank: { by: "total", race: { to: 10 }, teams: { of: 2, score: "sum" } } }), "exclusive", W],
  ];
}

/**
 * C2 part 4c: a draft's own questions beyond its finale predictions, on the same season, each read as the server reads it (o.asks:
 * their answers and what only the server knows, graded on the viewer's copy into the lines it carries: AnswerLogic.lines). No engine
 * before part 4c plays them, so their reads are new (from part 4c's engine), the mechanics proven by hand in
 * tests/draft-questions.test.js: an Outlast with its finale predictions, side bets and a pot split; a lineup with a captain, only the
 * only one right and a number's closest; a shared Outlast's pick from your own team and the season's winner; best ball with a fixed
 * stake; a pot and a rollover; head to head with playoffs; teams of players on the answer most of you give; a handicap with chips;
 * and the server's facts (the bot's call, trivia, an episode fact, a shrinking call). (A draft's own questions beside its cuts or a
 * race have no place yet: schema.js draftAskPlace.)
 */
function askShapes(outlast, lineup) {
  const W = { week: true };
  const shared = { by: "draft", each: 3, order: "blind", own: "shared" };
  // Each question's answers as game_answers holds them (a finale prediction's are the state's, FINALE_PICKS: none here), and who goes
  // home from your own team (a shared team's: c1 and c10 in Episode 5, c8 in 6; cy's c7 in 4 stays).
  const MINE = { mine: { 4: { cy: "c7" }, 5: { di: "c10", ann: "c1" }, 6: { cy: "c8" } } };
  const shape = (name, spec, own, o = {}) => [name, spec, own, { ...o, asks: { answers: answersOf(spec.ask.filter((q) => !FINALE_Q.includes(q)), MINE), extra: o.extra } }];
  const server = () => ({ ...SERVER.trivia(), ...SERVER.facts(), ...SERVER.bot() });
  return [
    shape("dq-outlast", outlast({ ask: [...FINALE_Q, BOOT, Q.POT, IDOL], extras: { bets: { points: 1 } } }), "exclusive"),
    shape("dq-lineup", lineup({ score: { by: "moments", points: null, captain: { times: 2 } }, ask: [IMMUNE, Q.ONLY, MANY] }), "exclusive"),
    shape("dq-shared", outlast({ get: shared, ask: [{ ...BOOT, id: "mine", from: "team" }, WINNER] }), "shared"),
    shape("dq-stake", lineup({ count: { best: 2 }, ask: [BOOT, Q.BET] }), "exclusive", W),
    shape("dq-rollover", outlast({ ask: [BOOT, Q.POT, Q.ROLL] }), "exclusive", W),
    shape("dq-matchups", lineup({ rank: { by: "matchups", playoffs: { teams: 2, from: 6 } }, ask: [BOOT, IMMUNE, WINNER] }), "exclusive", W),
    shape("dq-teams", outlast({ rank: { by: "total", teams: { of: 2, score: "sum" } }, ask: [BOOT, Q.HERD] }), "exclusive", W),
    shape("dq-handicap", lineup({ rank: { by: "total", handicap: { points: 2 } }, ask: [BOOT, Q.CHIPS] }), "exclusive", { history: true }),
    shape("dq-server", outlast({ ask: [{ ...BOOT, ...BOT }, Q.TRIVIA, Q.QUOTE, WIN] }), "exclusive", { extra: server }),
  ];
}

// ---- C2 part 3: what the server scores outside the state ----
// A game of questions' questions (each a window an episode, or the game's), every way their points combine.
const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } };
const IMMUNE = { id: "immune", ask: "Who wins immunity?", answer: "person", points: 2, asked: "each", settle: { by: "moment", moment: "individualImmunity", take: "who" } };
const IDOL = { id: "idol", ask: "An idol played?", answer: "yesNo", points: 1, asked: "each", settle: { by: "moment", moment: "idolPlayed", take: "happened" } };
const MANY = { id: "many", ask: "How many idols played?", answer: "number", points: 3, asked: "each", settle: { by: "moment", moment: "idolPlayed", take: "count" } };
const TRIBE = { id: "tribe", ask: "Which tribe wins immunity?", answer: "group", points: 1, asked: "each", settle: { by: "moment", moment: "tribeImmunity", take: "who" } };
const WINNER = { id: "winner", ask: "Who wins?", answer: "person", points: 5, settle: { by: "results", take: "winner" } };
const WIN = { id: "win", ask: "Who wins? Less for each episode late", answer: "person", points: 10, closes: "finale", shrink: { points: 1, per: "episode" }, settle: { by: "results", take: "winner" } };
const Q = {
  BOOT, IMMUNE, IDOL, MANY, TRIBE, WINNER, WIN,
  POT: { ...BOOT, id: "pot", ask: "10 points split between everyone who calls the boot", points: 10, share: "split" },
  ONLY: { ...BOOT, id: "only", points: 2, share: "only" },
  ONLY2: { ...BOOT, id: "only2", ask: "Two who go home: only yours count", points: 2, pick: 2, share: "only" },
  ONLY_IDOL: { ...IDOL, id: "onlyidol", points: 3, share: "only" },
  ROLL: { ...BOOT, id: "roll", points: 2, rollover: true },
  ROLL_POT: { ...BOOT, id: "rollpot", points: 6, rollover: true, share: "split" },
  CHIPS: { id: "chips", ask: "10 points split by chips on who wins immunity", answer: "chips", points: 10, chips: 10, asked: "each", share: "split", settle: { by: "moment", moment: "individualImmunity", take: "who" } },
  SEAL: { ...WIN, id: "seal", ask: "Seal your winner: every change costs a point", shrink: { points: 1, per: "change" } },
  BET: { id: "bet", ask: "An idol found tonight?", answer: "yesNo", points: 1, asked: "each", wager: 5, settle: { by: "moment", moment: "idolFound", take: "happened" } },
  TRIVIA: { id: "trivia", ask: "Trivia about the episode before", answer: "trivia", points: 1, asked: "each", settle: { by: "trivia" } },
  QUOTE: { id: "quote", ask: "Who says the title quote?", answer: "person", points: 2, asked: "each", settle: { by: "fact", fact: "titleQuote", take: "who" } },
  HERD: { id: "herd", ask: "Who goes home, as most of us say?", answer: "person", points: 2, asked: "each", settle: { by: "players", take: "majority" } },
  GUESS: { id: "guess", ask: "Who will most of us say goes home?", answer: "person", points: 3, asked: "each", settle: { by: "players", take: "majority", of: "boot" } },
  // C2 part 4a: a shrinking call that's shared.
  WINPOT: { ...WIN, id: "winpot", ask: "Who wins? Less for each episode late, split between everyone right", share: "split" },
  SEALPOT: { ...WIN, id: "sealpot", ask: "Seal your winner, split: every change costs a point", shrink: { points: 1, per: "change" }, share: "split" },
  WINALONE: { ...WIN, id: "winalone", ask: "Who wins? Less for each episode late, only if you're the only one", share: "only" },
};
const BOT = { beat: { by: "bot" } };
// C6, money: stakes ({ answer, stake }) beside a split pot, as a parlay's leg, from a bank at the pool's odds, from a bank that runs out.
const bet = (answer, stake) => ({ answer, stake });
const STAKE = {
  POT: { ...BOOT, id: "stakepot", ask: "Who goes home? Stake up to 5, the pot split", points: 10, wager: 5, share: "split" },
  LEG: { ...BOOT, id: "stakeleg", ask: "Who goes home? Stake up to 3", wager: 3 },
  POOL: { ...BOOT, id: "bankpool", ask: "Who goes home? Stake any of your bank, the pool's odds", wager: "total", odds: "pool" },
  BROKE: { ...BOOT, id: "broke", ask: "Who goes home? Stake any of your bank", wager: "total" },
  TICKET: { id: "ticket", ask: "Build a ticket", answer: "ticket", points: 0, asked: "each", wager: "total", settle: { by: "legs", of: ["boot", "immune", "idol"] } },
  SAID: {
    stakepot: { 1: { ann: bet("c13", 5), bo: bet("c13", 2), cy: bet("c5", 4), di: bet("c13", 0) }, 3: { ann: bet("c2", 5) }, 4: { ann: bet("c6", 3), bo: bet("c0", 1), cy: bet("c9", 5) } },
    stakeleg: { 1: { ann: bet("c13", 3), bo: bet("c13", 3), cy: bet("c5", 2) }, 2: { ann: bet("c4", 1), bo: bet("c3", 3) }, 5: { bo: bet("c1", 3), cy: bet("c2", 2), di: bet("c10", 1) } },
    bankpool: { 1: { ann: bet("c13", 10), bo: bet("c5", 5), cy: bet("c13", 5), di: bet("c2", 20) }, 2: { ann: bet("c3", 20), bo: bet("c4", 10), cy: bet("c0", 9) }, 4: { ann: bet("c6", 30), bo: bet("c6", 5), cy: bet("c2", 4) } },
    broke: { 1: { ann: bet("c5", 5), bo: bet("c13", 2), cy: bet("c13", 0), di: bet("c2", 5) }, 2: { bo: bet("c3", 8), cy: bet("c4", 6) } },
    ticket: {
      1: { ann: { legs: ["boot", "immune", "idol"], stake: 5 }, bo: { legs: ["boot", "immune"], stake: 4 }, cy: { legs: ["immune", "idol"], stake: 3 }, di: { legs: ["boot", "immune"], stake: 2 } },
      2: { ann: { legs: ["boot", "idol"], stake: 3 }, bo: { legs: ["boot", "idol"], stake: 2 }, di: { legs: ["boot", "idol"], stake: 1 } },
      4: { ann: { legs: ["boot", "idol"], stake: 2 }, bo: { legs: ["boot", "idol"], stake: 2 } },
    },
  },
};
// The answers, as game_answers holds them: { question: { episode (0: the game's): { seat: answer } } }.
const SAID = {
  boot: { 1: { ann: "c13", bo: "c13", cy: "c5", di: "c2" }, 2: { ann: "c4", bo: "c3", cy: "c0" }, 3: { ann: "c2", cy: "c7", di: "c8" }, 4: { ann: "c6", bo: "c9", cy: "c4", di: "c0" }, 5: { ann: "c4", bo: "c1", cy: "c2", di: "c10" }, 6: { ann: "c7", bo: "c8", cy: "c14", di: "c12" }, 7: { ann: "c0", bo: "c4", di: "c7" } },
  immune: { 1: { ann: "c0", bo: "c4", cy: "c0", di: "c1" }, 2: { ann: "c1", bo: "c2" }, 3: { ann: "c2", bo: "c2", cy: "c4" }, 5: { bo: "c4", cy: "c0", di: "c4" }, 6: { ann: "c0", di: "c0" }, 7: { cy: "c2", di: "c4" } },
  idol: { 1: { ann: "no", bo: "yes", cy: "no" }, 2: { ann: "yes", bo: "yes", cy: "no", di: "yes" }, 3: { bo: "no", di: "yes" }, 4: { ann: "no" }, 6: { ann: "yes", cy: "yes", di: "no" }, 7: { ann: "no", bo: "no" } },
  many: { 2: { ann: 2, bo: 1, cy: 3, di: 0 }, 4: { ann: 0, bo: 1 }, 6: { ann: 1, cy: 1, di: 2 } },
  tribe: { 1: { ann: "t1", bo: "t2", cy: "t1" }, 2: { ann: "t2", di: "t1" } },
  winner: { 0: { ann: "c0", bo: "c4", cy: "c2", di: "c0" } },
  only2: { 4: { ann: ["c6", "c9"], bo: ["c9", "c0"], cy: ["c4"] }, 5: { ann: ["c1"], di: ["c10", "c1"] }, 6: { ann: ["c11", "c8"], bo: ["c8", "c12"], di: ["c12", "c2"] } },
  chips: { 1: { ann: { c0: 6, c4: 4 }, bo: { c0: 10 }, cy: { c4: 10 } }, 3: { ann: { c2: 5, c0: 5 }, di: { c2: 3 } }, 5: { bo: { c4: 10 }, di: { c4: 1, c0: 9 } } },
  bet: { 1: { ann: { answer: "yes", stake: 3 }, bo: { answer: "no", stake: 5 }, cy: { answer: "yes", stake: 0 } }, 2: { ann: { answer: "no", stake: 2 }, bo: { answer: "yes", stake: 4 } }, 4: { cy: { answer: "yes", stake: 5 }, di: { answer: "no", stake: 1 } } },
  trivia: { 2: { ann: { q1: "A", q2: "B" }, bo: { q1: "B" }, cy: { q2: "B" } }, 3: { ann: { q3: "C" } }, 4: { bo: { q4: "A", q5: "D" }, di: { q4: "A", q5: "C" } } },
  quote: { 1: { ann: "c4", bo: "c0" }, 2: { ann: "c1" }, 3: { cy: "c2" }, 4: { di: "c13" }, 5: { ann: "c2", bo: "c2", cy: "c4" } },
  herd: { 1: { ann: "c13", bo: "c13", cy: "c5" }, 2: { ann: "c4", bo: "c3" }, 4: { ann: "c6", bo: "c6", cy: "c9", di: "c9" }, 5: { ann: "c4", bo: "c1", cy: "c4" } },
  guess: { 1: { ann: "c13", cy: "c2" }, 4: { bo: "c6", di: "c4" }, 5: { ann: "c2", di: "c4" } },
};
// A shrinking call's: how many episodes had started when each was made (late), and how many times each was changed once the
// game had started (changes).
const LATE = { win: { ann: 0, bo: 1, cy: 3, di: 6 }, winpot: { ann: 0, bo: 1, cy: 3, di: 6 }, winalone: { ann: 2 } };
const CHANGES = { seal: { ann: 0, cy: 2, di: 12 }, sealpot: { ann: 0, cy: 2, di: 12 } };
/** Each question's answers as rows ({ playerId, question, episode, answer, late?, changes? }): its own (`from`: another's). */
function answersOf(qs, over = {}) {
  const rows = [];
  for (const q of qs) {
    const from = ["win", "seal", "winpot", "sealpot", "winalone"].includes(q.id) ? "winner" : q.id in SAID ? q.id : ["pot", "only", "roll", "rollpot"].includes(q.id) ? "boot" : q.id === "onlyidol" ? "idol" : q.id === "beatonly" ? "only2" : q.id;
    const by = over[q.id] || SAID[from] || {};
    for (const [n, seats] of Object.entries(by)) {
      for (const [playerId, answer] of Object.entries(seats)) {
        const row = { playerId, question: q.id, episode: Number(n), answer };
        if (LATE[q.id] && playerId in LATE[q.id]) row.late = LATE[q.id][playerId];
        if (CHANGES[q.id] && playerId in CHANGES[q.id]) row.changes = CHANGES[q.id][playerId];
        rows.push(row);
      }
    }
  }
  return rows;
}
/** What only the server knows (answer-points.ts serverFacts), fresh for each read: each round's trivia key, research's title quote
 *  by episode, and the bot's calls (its windows locked). */
const SERVER = {
  trivia: () => ({ trivia: new Map([[2, [{ id: "q1", answer: "A" }, { id: "q2", answer: "C" }]], [3, []], [4, [{ id: "q4", answer: "A" }, { id: "q5", answer: "D" }]], [5, [{ id: "q6", answer: "B" }]]]) }),
  facts: () => ({
    episodeFacts: new Map([
      [1, { titleQuote: { state: "who", who: "c4", name: "C4" } }],
      [2, { titleQuote: { state: "unsure", why: "Two people say it" } }],
      [3, { titleQuote: { state: "none" } }],
      [4, { titleQuote: { state: "who", who: "c13", name: "C13" } }],
      [5, { titleQuote: { state: "who", who: "c2", name: "C2" } }],
      [6, { titleQuote: { state: "outside", name: "The host" } }],
    ]),
  }),
  bot: () => {
    const calls = { "boot|1": "c13", "boot|2": "c0", "boot|4": "c6", "boot|5": "c10", "idol|2": "yes", "idol|6": "no", "many|2": 2, "many|6": 1, "beatonly|4": ["c6", "c4"], "beatonly|6": ["c8"] };
    return { bot: new Map(Object.entries(calls)), botCalled: new Set([...Object.keys(calls), "boot|7"]) };
  },
};
// Lives that empty on one night: ann and bo both wrong in Episode 2, the only two left after Episode 1.
const ALL_OUT = { boot: { ...SAID.boot, 2: { ann: "c4", bo: "c5", cy: "c0" } } };
// Weekly Calls' right calls and bingo's lines, each seat's by episode, as the server counts them (calls.ts callRights, bingo.ts
// bingoLines): the table at a mark reads them through it (answer-points.ts outsideCounts), times a line's points.
const COUNTS = { 1: { ann: 2, bo: 1 }, 2: { bo: 2, cy: 1 }, 3: {}, 4: { ann: 1, di: 3 }, 5: { cy: 2 }, 6: { ann: 1, bo: 1, cy: 1, di: 1 }, 7: { di: 2, ann: 1 } };
// A game in stages' walk as the server hands it (answer-points.ts stageWalk): each stage's table after each episode, its points
// with float noise in them (1.1 + 2.2), its places, over at its end.
const STAGE_WALK = {
  stages: [
    { key: "a", leagueId: "zt-a", from: 1, to: 3, entries: [
      { episode: 1, over: false, rows: [["ann", 1.1, 1], ["cy", 1.1, 1], ["bo", 0.5, 3], ["di", 0, 4]] },
      { episode: 2, over: false, rows: [["bo", 3.3, 1], ["ann", 2.2, 2], ["cy", 1.15, 3], ["di", 0.45, 4]] },
      { episode: 3, over: true, rows: [["ann", 4.4, 1], ["bo", 3.3, 2], ["cy", 2.25, 3], ["di", 2.25, 3]] },
    ] },
    { key: "b", leagueId: "zt-b", from: 4, to: null, entries: [
      { episode: 4, over: false, rows: [["di", 2.2, 1], ["ann", 1.1, 2], ["bo", 0, 3], ["cy", 0, 3]] },
      { episode: 5, over: false, rows: [["di", 3.3, 1], ["cy", 2.1, 2], ["ann", 1.1, 3], ["bo", 0.7, 4]] },
      { episode: 6, over: false, rows: [["cy", 4.35, 1], ["di", 3.3, 2], ["bo", 2.7, 3], ["ann", 1.2, 4]] },
      { episode: 7, over: true, rows: [["cy", 5.45, 1], ["bo", 4.7, 2], ["di", 3.3, 3], ["ann", 3.3, 3]] },
    ] },
  ].map((st) => ({ ...st, entries: st.entries.map((e) => ({ ...e, rows: e.rows.map(([playerId, points, place]) => ({ playerId, points, place })) })) })),
};

/**
 * What the server scores outside the league's state (C2 part 3), on the same season: a game of questions with every way its points
 * combine (a plain window on each answer kind; a pot split; only the only one right, by pick and alone; a rollover, plain and as a
 * pot; chips split; a shrinking call by episode and by change; a wager; a parlay; trivia; an episode fact; the players' answers;
 * the bot's calls) and every walk on it (lives, last one standing, the night everyone left goes out each way, a race, cuts, all three
 * with early results, co-op with each `saves`, head to head with and without playoffs, teams of players and head to head between
 * them, a handicap, a span); Weekly Calls and bingo (their counts through each mark, at a line's points); and a game in stages by
 * points, places and wins. Each read as the server reads it (questionsRead, outsideRead, stageRead).
 */
function outsideShapes() {
  const game = (ask, score = {}, rank, more = {}) => ({ get: { by: "none" }, score: { by: "answers", ...score }, ask, ...(rank ? { rank } : {}), ...more });
  const qs = (ask, more = {}) => ({ none: true, questions: { answers: answersOf(ask, more.over), extra: more.extra }, ...(more.o || {}) });
  const two = [BOOT, IMMUNE];
  const legs = [Q.ROLL, IMMUNE, Q.ONLY, IDOL];
  const stages = (by) => ({ stages: [{ id: "a", game: { preset: "outlast", span: { from: 1, to: 3 } } }, { id: "b", game: { preset: "outlast", span: { from: 4 } } }], overall: { by } });
  const botQs = [{ ...BOOT, ...BOT }, { ...IDOL, ...BOT }, { ...MANY, ...BOT }, { ...Q.ONLY2, id: "beatonly", ...BOT }];
  const shape = (name, spec, ask, more) => [name, spec, null, qs(ask, more)];
  const CENTS = { ...Q.CHIPS, id: "cents", ask: "1 point split by chips on who wins immunity", points: 1 };
  return [
    shape("q-plain", game([BOOT, IMMUNE, IDOL, MANY, TRIBE, WINNER]), [BOOT, IMMUNE, IDOL, MANY, TRIBE, WINNER]),
    shape("q-pot", game([Q.POT]), [Q.POT]),
    shape("q-only", game([Q.ONLY, Q.ONLY2, Q.ONLY_IDOL]), [Q.ONLY, Q.ONLY2, Q.ONLY_IDOL]),
    shape("q-rollover", game([Q.ROLL, Q.ROLL_POT]), [Q.ROLL, Q.ROLL_POT]),
    shape("q-chips", game([Q.CHIPS]), [Q.CHIPS]),
    shape("q-shrink", game([WIN, Q.SEAL]), [WIN, Q.SEAL]),
    shape("q-wager", game([Q.BET]), [Q.BET]),
    shape("q-parlay", game(two, { parlays: [{ of: ["boot", "immune"], times: 3 }] }), two),
    shape("q-trivia", game([Q.TRIVIA, BOOT]), [Q.TRIVIA, BOOT], { extra: SERVER.trivia }),
    shape("q-fact", game([Q.QUOTE]), [Q.QUOTE], { extra: SERVER.facts }),
    shape("q-players", game([BOOT, Q.HERD, Q.GUESS]), [BOOT, Q.HERD, Q.GUESS]),
    shape("q-bot", game(botQs), botQs, { extra: SERVER.bot }),
    shape("q-bot-pot", game([{ ...Q.POT, ...BOT, beat: { by: "bot", none: "void" } }]), [Q.POT], { extra: () => ({ bot: new Map([["pot|1", "c13"], ["pot|5", "c1"]]), botCalled: new Set(["pot|1", "pot|5"]) }) }),
    shape("q-lives", game([BOOT, IDOL], { lives: 2, livesOn: ["boot"] }, { by: "standing" }), [BOOT, IDOL]),
    shape("q-lives-last", game([BOOT], { lives: 1 }, { by: "standing", oneLeft: "ends" }), [BOOT]),
    shape("q-allout-back", game([BOOT], { lives: 1 }, { by: "standing", allOut: "back" }), [BOOT], { over: ALL_OUT }),
    shape("q-allout-share", game([BOOT], { lives: 1 }, { by: "standing", allOut: "share", oneLeft: "ends" }), [BOOT], { over: ALL_OUT }),
    shape("q-allout-points", game([BOOT], { lives: 1 }, { by: "standing", allOut: "points" }), [BOOT], { over: ALL_OUT }),
    shape("q-race", game(two, {}, { by: "total", race: { to: 6 } }), two),
    shape("q-race-early", game(two, {}, { by: "total", race: { to: 9 } }), two, { o: { early: 6 } }),
    shape("q-race-lives", game(two, { lives: 2, livesOn: ["boot"] }, { by: "standing", race: { to: 7 } }), two),
    shape("q-cuts", game(two, {}, { by: "standing", cut: [{ at: { every: 2 }, out: 1 }] }), two),
    shape("q-cuts-lives", game([BOOT, Q.POT], { lives: 3, livesOn: ["boot"] }, { by: "standing", cut: [{ at: { episode: 3 }, out: 1, tie: "all" }] }), [BOOT, Q.POT], { o: { early: 7 } }),
    shape("q-coop-one", game([BOOT, IDOL], { lives: 3 }, { by: "coop" }), [BOOT, IDOL]),
    shape("q-coop-most", game([BOOT, IDOL], { lives: 3, saves: "most" }, { by: "coop" }), [BOOT, IDOL]),
    shape("q-coop-all", game([BOOT, IDOL], { lives: 2, saves: "all" }, { by: "coop" }), [BOOT, IDOL]),
    shape("q-matchups", game(two, {}, { by: "matchups" }), two),
    shape("q-matchups-playoffs", game([BOOT, IMMUNE, WINNER], {}, { by: "matchups", playoffs: { teams: 2, from: 6 } }), [BOOT, IMMUNE, WINNER]),
    shape("q-teams", game(two, {}, { by: "total", teams: { of: 2 } }), two),
    shape("q-teams-matchups", game(two, {}, { by: "matchups", teams: { of: 2 } }), two),
    shape("q-handicap", game(two, {}, { by: "total", handicap: { points: 2 } }), two, { o: { history: true } }),
    // Each window's share to the cent, the sum of them with float noise in it (0.7 + 0.1), rounded as it adds up; a handicap in the
    // walk's series (a race on it, head to head on it).
    shape("q-chips-cents", game([CENTS]), [CENTS], { over: { cents: { 1: { ann: { c0: 7, c4: 3 }, bo: { c0: 3 } }, 3: { ann: { c2: 1 }, di: { c2: 9 } }, 5: { bo: { c4: 2 }, cy: { c4: 2 }, di: { c4: 6 } } } } }),
    shape("q-handicap-race", game(two, {}, { by: "total", race: { to: 12 }, handicap: { points: 2 } }), two, { o: { history: true } }),
    shape("q-handicap-matchups", game(two, {}, { by: "matchups", handicap: { points: 2 } }), two, { o: { history: true } }),
    shape("q-span", game([Q.ROLL, IMMUNE], {}, undefined, { span: { from: 2, to: 5 } }), [Q.ROLL, IMMUNE]),
    // C2 part 4a: the combinations the scoring sequence opens (no engine before part 4 plays them: their reads are new, from part 4's
    // engine, and proven by hand in tests/shared-shrink.test.js and tests/parlay-legs.test.js). A shrinking call that's shared:
    // split by episode and by change, and only the only one right; a parlay whose legs roll over or pay only the only one right; a
    // parlay with a shrinking leg.
    shape("q-shrink-shared", game([Q.WINPOT, Q.SEALPOT, Q.WINALONE]), [Q.WINPOT, Q.SEALPOT, Q.WINALONE], { over: { winalone: { 0: { ann: "c0", bo: "c4", cy: "c2" } } } }),
    shape("q-parlay-legs", game(legs, { parlays: [{ of: ["roll", "immune"], times: 3 }, { of: ["only", "idol"], times: 2 }] }), legs),
    shape("q-parlay-shrink", game([WIN, WINNER], { parlays: [{ of: ["win", "winner"], times: 2 }] }), [WIN, WINNER]),
    // C6, money: a stake as a line of its own beside the question's points (no engine before C6 plays these). A stake beside a split
    // pot (p24): Episode 1, the 10-point pot three ways (ann, bo, di right: 3.33 each), ann winning her 5 and bo his 2, cy losing 4;
    // Episode 3 nobody went home: every stake back. A parlay's staked leg, doubled with its points: Episode 1 ann right on who goes
    // home (1 + 3) and immunity (2), both doubled: 8 and 4. A bank of 20 at the pool's odds: Episode 1 ann and cy right, staking 10
    // and 5, take the wrong stakes (bo's 5, di's 20) by theirs: 16.67 and 8.33, with a point each. A bank of 5 that runs out: ann
    // and di lose all 5 in Episode 1 (out), cy all 6 in Episode 2 (out), bo left alone at 17: it ends there.
    shape("q-wager-pot", game([STAKE.POT]), [STAKE.POT], { over: STAKE.SAID }),
    shape("q-wager-parlay", game([STAKE.LEG, IMMUNE], { parlays: [{ of: ["stakeleg", "immune"], times: 2 }] }), [STAKE.LEG, IMMUNE], { over: STAKE.SAID }),
    shape("q-bank-pool", game([STAKE.POOL], { bank: { start: 20 } }), [STAKE.POOL], { over: STAKE.SAID }),
    shape("q-bank-out", game([STAKE.BROKE], { bank: { start: 5, out: true } }, { by: "standing" }), [STAKE.BROKE], { over: STAKE.SAID }),
    // C6 part 2, a ticket built from who goes home, immunity and an idol played, from a bank of 50. Episode 1: ann's three all right
    // (7 x 5 = 35); bo's immunity wrong (4 lost); cy's immunity and idol right (3 x 3 = 9); di's immunity wrong (2 lost). Episode 2:
    // bo's boot and idol right (3 x 2 = 6), ann's boot wrong (3 lost), di's boot left blank (1 lost). Episode 4: ann's boot and idol
    // right (3 x 2 = 6), bo's idol left blank (2 lost).
    shape("q-ticket", game([BOOT, IMMUNE, IDOL, STAKE.TICKET], { bank: { start: 50 } }), [BOOT, IMMUNE, IDOL, STAKE.TICKET], { over: STAKE.SAID }),
    ["calls", { preset: "weekly-calls" }, null, { none: true, outside: { each: 1 } }],
    ["bingo", { preset: "weekly-bingo", score: { by: "lines", points: 2 } }, null, { none: true, outside: { each: 2 } }],
    ["stages-points", stages("points"), null, { none: true, stages: true }],
    ["stages-places", stages("places"), null, { none: true, stages: true }],
    ["stages-wins", stages("wins"), null, { none: true, stages: true }],
  ];
}

// The season: who went home in each episode (method, jury votes), and the moments recorded (type, castaway, units).
const EXITS = {
  1: [["c13", "Voted Out"]],
  2: [["c3", "Voted Out"]],
  3: [],
  4: [["c6", "Voted Out"], ["c9", "Voted Out"]],
  5: [["c10", "Voted Out"], ["c1", "Medically Evacuated"]],
  6: [["c11", "Voted Out"], ["c12", "Quit"], ["c8", "Voted Out"]],
  7: [["c14", "Voted Out"], ["c7", "Voted Out"], ["c5", "Lost Fire-Making"], ["c4", "Lost Final Tribal (Jury Vote)", 2], ["c2", "Lost Final Tribal (Jury Vote)", 0], ["c0", "Sole Survivor", 5]],
};
const MOMENTS = {
  1: [["individualImmunity", "c0", 1.1], ["idolFound", "c4"], ["satOut", "c8"], ["rewardWin", "c5"], ["tribeImmunity", "c0"], ["tribeImmunity", "c1"], ["tribeImmunity", "c2"]],
  2: [["challengeRunnerUp", "c1", 1.3], ["idolPlayed", "c4"], ["chosenForReward", "c7"], ["survivedVotes", "c2"], ["rewardWin", "c12"], ["idolPlayed", "c0", 1.004], ["wentOnJourney", "c0", 1.004]],
  3: [["individualImmunity", "c2", 0.7], ["wentOnJourney", "c12"], ["satOut", "c10"], ["idolFound", "c9"], ["zeroVotesSafe", "c4", 1.15], ["votedWithMajority", "c4", 1.15], ["zeroVotesSafe", "c1", 1.15], ["votedWithMajority", "c1", 1.15]],
  4: [["votesNegated", "c0"], ["idolFound", "c11"], ["challengeThird", "c14", 2.1], ["survivedVotes", "c7"]],
  5: [["individualImmunity", "c4"], ["rewardWin", "c0", 1.7], ["satOut", "c5"], ["chosenForReward", "c14"]],
  6: [["individualImmunity", "c0"], ["idolPlayed", "c7"], ["zeroVotesSafe", "c2"], ["zeroVotesSafe", "c14", 1.15]],
  7: [["wonFireMaking", "c4"], ["individualImmunity", "c2", 1.05], ["zeroVotesSafe", "c2", 1.15], ["votedWithMajority", "c2", 1.15], ["votedWithMajority", "c7", 1.15], ["zeroVotesSafe", "c7", 1.15]],
};
// Each seat's team: exclusive (three each, c12 to c14 free) or shared (overlapping).
const TEAMS = {
  exclusive: { ann: ["c0", "c1", "c2"], bo: ["c3", "c4", "c5"], cy: ["c6", "c7", "c8"], di: ["c9", "c10", "c11"] },
  shared: { ann: ["c0", "c1", "c2"], bo: ["c0", "c4", "c5"], cy: ["c2", "c7", "c8"], di: ["c9", "c10", "c0"] },
};
// The exclusive draft's pickups (the mid-season log): bo's after Episode 2 (c3 gone home, c12 in), cy's after Episode 6 (c8
// gone, c14 in: a mark at 6 sees it, the series at 6 doesn't). The stock market's: a trade after Episode 3.
const MOVES = {
  exclusive: [
    { playerId: "bo", episode: 2, droppedCastawayId: "c3", addedCastawayId: "c12" },
    { playerId: "cy", episode: 6, droppedCastawayId: "c8", addedCastawayId: "c14" },
  ],
  shared: [],
  // C4: replacements from anyone still in (ownShapes): bo's c3 for cy's c7 after Episode 2, di's c9 for ann's c0 after 4, cy's c8
  // for the free c14 after 6.
  own: [
    { playerId: "bo", episode: 2, droppedCastawayId: "c3", addedCastawayId: "c7" },
    { playerId: "di", episode: 4, droppedCastawayId: "c9", addedCastawayId: "c0" },
    { playerId: "cy", episode: 6, droppedCastawayId: "c8", addedCastawayId: "c14" },
  ],
  market: [
    { playerId: "ann", episode: 3, droppedCastawayId: "c1", addedCastawayId: "c4", sold: 10, paid: 18, fee: 1 },
    { playerId: "di", episode: 5, droppedCastawayId: "c10", addedCastawayId: "c14", sold: 0, paid: 7 },
  ],
};
// Lineups by episode (two starters; unset is carried), and captains.
const LINEUPS = {
  exclusive: {
    1: { ann: ["c0", "c1"], bo: ["c4", "c5"], cy: ["c7", "c8"] },
    3: { ann: ["c1", "c2"], bo: ["c12", "c4"] },
    4: { ann: ["c0", "c2"] },
    6: { ann: ["c0", "c2"], cy: ["c7"] },
    7: { cy: ["c7", "c14"], bo: ["c4", "c5"] },
  },
  shared: {
    1: { ann: ["c0", "c1"], bo: ["c0", "c4"], cy: ["c7", "c8"] },
    3: { ann: ["c1", "c2"], bo: ["c4", "c5"], di: ["c0", "c9"] },
    5: { cy: ["c2", "c7"] },
    7: { ann: ["c0", "c2"] },
  },
};
const CAPTAINS = { 1: { ann: "c0", bo: "c5" }, 4: { ann: "c2" }, 6: { bo: "c4" } };
const BETS = {
  1: [{ id: "b1", label: "An idol found?", points: 2, predictions: [{ id: "p1", playerId: "ann", guess: "yes", correct: true }, { id: "p2", playerId: "bo", guess: "no", correct: false }] }],
  4: [{ id: "b2", label: "A blindside?", points: 1, predictions: [{ id: "p3", playerId: "cy", guess: "yes", correct: true }] }],
  6: [{ id: "b3", label: "A quit?", points: 3, predictions: [{ id: "p4", playerId: "ann", guess: "yes", correct: true }, { id: "p5", playerId: "bo", guess: "yes", correct: true }, { id: "p6", playerId: "di", guess: "no", correct: false }] }],
};
const FINALE_PICKS = [
  { playerId: "ann", top3: ["c0", "c2", "c4"], winner: "c0" },
  { playerId: "bo", top3: ["c4", "c5", "c1"], winner: "c4" },
  { playerId: "cy", top3: ["c2", null, null], winner: null },
];
// Group slots: the show's pairs at each episode's end (the format section's), and each seat's pick.
const PAIRS = [["c0", "c4"], ["c1", "c5"], ["c2", "c7"], ["c8", "c11"]];
const SLOT_PICKS = { 2: { ann: [0], bo: [1], cy: [0] }, 4: { di: [3] }, 5: { ann: [2, 1] } };
// A pool's picks, [first, second] (C2 part 2): right and wrong, missed (bo on the quiet night, di in Episode 2), a second on a
// night one goes (void) and on doubles (c4 right, c9 wrong), cy having picked everyone still in by the finale (a pick that never
// repeats has nobody left), the finale where only the winner survives (bo's losing finalist).
const POOL_PICKS = {
  1: { ann: ["c0"], bo: ["c13"], cy: ["c5"], di: ["c2"] },
  2: { ann: ["c1", "c4"], bo: ["c3"], cy: ["c0"] },
  3: { ann: ["c2"], cy: ["c7"], di: ["c8"] },
  4: { ann: ["c6", "c4"], bo: ["c4", "c9"], cy: ["c4"], di: ["c0", "c2"] },
  5: { ann: ["c4"], bo: ["c1"], cy: ["c2", "c10"], di: ["c10"] },
  6: { ann: ["c7"], bo: ["c2", "c8"], cy: ["c14"], di: ["c12"] },
  7: { ann: ["c0"], bo: ["c4"], di: ["c0", "c7"] },
};
// Teams of players chosen (made 'choose'), kept from the start: di moved to ann's team from Episode 5.
const TEAM_SEATS = { ann: [{ team: "t1", from: 1 }], bo: [{ team: "t2", from: 1 }], cy: [{ team: "t1", from: 1 }], di: [{ team: "t2", from: 1 }, { team: "t1", from: 5 }] };

/** The league for one shape, its spec through its settings (as stored, the flag off), the whole season recorded. */
function league(S, G, T, spec, own, o = {}) {
  const castaways = Array.from({ length: 15 }, (_, i) => ({
    id: `c${i}`, name: `C${i}`, status: "active", tribeId: i < 8 ? "t1" : "t2", ownerIds: [], placementOrder: null, exitMethod: null, exitEpisodeId: null,
  }));
  // The seats (all four, or the first few: an odd number for head to head), and what's theirs.
  const seats = o.seats || SEATS;
  const mine = (byPlayer) => Object.fromEntries(Object.entries(byPlayer || {}).filter(([p]) => seats.includes(p)));
  const s = S.migrateLeagueState({
    settings: { ...G.settingsOf(spec), showFormat: "survivor", setupComplete: true },
    players: seats.map((id, i) => ({ id, name: id.toUpperCase(), color: `#00${i}` })),
    draftOrder: seats.slice(),
    tribes: [{ id: "t1", name: "Toka", color: "#111" }, { id: "t2", name: "Vula", color: "#222" }],
    castaways,
    episodes: Array.from({ length: 7 }, (_, i) => ({ id: `e${i + 1}`, number: i + 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} })),
  });
  // A pool holds nobody: each seat's pick an episode (POOL_PICKS, a shape's own over them). Nor does a game scored outside the state
  // (o.none: a game of questions, Weekly Calls, bingo, a game in stages: C2 part 3).
  const holds = !o.pick && !o.none;
  const team = holds ? mine(TEAMS[own]) : {};
  for (const [p, ids] of Object.entries(team)) ids.forEach((id) => s.castaways.find((c) => c.id === id).ownerIds.push(p));
  s.castaways.forEach((c) => { if (c.ownerIds.length) c.acquiredVia = "draft"; });
  if (o.phaseStarts) s.phaseStarts = { ...o.phaseStarts };
  if (o.seasonEpisodes) s.seasonEpisodes = o.seasonEpisodes;
  if (o.teamSeats) {
    // C2 part 4b: a shape's own seats (o.teamSeats an object), else TEAM_SEATS.
    s.teamSeats = JSON.parse(JSON.stringify(mine(o.teamSeats === true ? TEAM_SEATS : o.teamSeats)));
    s.teamDraw = { seed: "zt-teams", kept: true };
  }
  const moves = holds ? (o.moves || (o.market ? MOVES.market : MOVES[own])).filter((m) => seats.includes(m.playerId)) : [];
  s.midSeason = { ...(s.midSeason || {}), log: moves.map((m) => ({ ...m })) };
  moves.forEach((m) => {
    const drop = s.castaways.find((c) => c.id === m.droppedCastawayId);
    const add = s.castaways.find((c) => c.id === m.addedCastawayId);
    drop.ownerIds = drop.ownerIds.filter((id) => id !== m.playerId);
    drop.formerOwnerId = m.playerId;
    if (!add.ownerIds.includes(m.playerId)) add.ownerIds.push(m.playerId);
    add.acquiredVia = "replenish";
  });
  if (o.market) s.blindDraft = { ...(s.blindDraft || {}), paid: { ann: 45, bo: 52, cy: 38, di: 60 } };
  if (o.history) s.seatHistory = { ann: { couch: 3, show: 1 }, bo: { couch: 0, show: 0 }, cy: { couch: 1, show: 0 }, di: { couch: 0, show: 0 } };
  for (let n = 1; n <= 7; n++) {
    const ep = s.episodes.find((e) => e.number === n);
    for (const [type, cid, units] of MOMENTS[n]) ep.scoringEvents.push({ id: `m${n}-${type}-${cid}`, type, castawayId: cid, ...(units ? { units } : {}) });
    for (const [cid, method, votes] of EXITS[n]) S.EpisodeLogic.addElimination(s, ep.id, cid, method, votes);
    if (!EXITS[n].length) ep.noExit = true;
    if (o.pick) {
      const picks = { ...mine(POOL_PICKS[n]), ...mine((o.picks || {})[n]) };
      // C5: a pick of several each episode carries its second person as `more` (o.more), a pool's as its second pick.
      ep.picks = Object.entries(picks).map(([playerId, [castawayId, second]]) => ({ playerId, castawayId, ...(second ? (o.more ? { more: [second] } : { second }) : {}) }));
    }
    const lu = holds ? LINEUPS[own][n] : null;
    if (lu) Object.entries(mine(lu)).forEach(([p, ids]) => { ep.lineups[p] = ids.slice(); });
    if (CAPTAINS[n]) ep.captains = { ...CAPTAINS[n] };
    ep.bets = (BETS[n] || []).map((b) => JSON.parse(JSON.stringify(b)));
    if (o.early === n) ep.resultsStage = "early";
  }
  s.finalePredictions = FINALE_PICKS.map((f) => JSON.parse(JSON.stringify(f)));
  if (o.stages) s.stageWalk = JSON.parse(JSON.stringify(STAGE_WALK));
  if (o.pairs) {
    // Pairs from the premiere to Episode 5, each for themselves after (a re-pairing would end every slot at once).
    const reports = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
      episode: n,
      state: n <= 5
        ? { playedAs: "pairs", phase: null, groups: PAIRS.map((m) => ({ name: null, members: m.map((x) => x.toUpperCase()) })), alone: [], newcomers: [], wentHomeAs: EXITS[n].length ? "individuals" : "nobody", changes: [] }
        : { playedAs: "individuals", phase: null, groups: [], alone: [], newcomers: [], wentHomeAs: "individuals", changes: n === 6 ? [{ kind: "split-into-individuals", sure: true }] : [] },
      left: EXITS[n].map(([cid]) => cid.toUpperCase()),
      merged: null,
    }));
    const tl = T.buildTimeline(reports, { cast: s.castaways.map((c) => c.name) });
    S.GroupSlotLogic.settle(s, T.slotRecords(tl, { resolve: (name) => (s.castaways.find((c) => c.name === name) || {}).id || null }));
    for (const [n, picks] of Object.entries(SLOT_PICKS)) {
      const ep = s.episodes.find((e) => e.number === Number(n));
      ep.groupSlots = ep.groupSlots || {};
      for (const [p, which] of Object.entries(picks)) {
        ep.groupSlots[p] = Object.fromEntries(which.map((w, slot) => [slot, { id: `pair-${w}`, members: PAIRS[w].slice(), size: 2 }]));
      }
    }
  }
  return s;
}

/** Plain data from a walk's Maps and Sets (each an array of its entries), for a read. */
const plain = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x, (k, val) => (val instanceof Map || val instanceof Set ? [...val] : val)));

/**
 * The week's results as one viewer sees them (C2 part 2): a pool's histories (every row, streak, life, mulligan, buyback, second
 * pick) and where it ends, and who can pick next; the knockouts' walk (who's out when, where it ends); head to head's (each week's
 * games, the records, the seeds, the bracket, the champion, how far each went) and what each seat sees of it; the teams' (their
 * points episode by episode, what a seat sees); and why each seat can't make a move for each episode.
 */
function weekOf(S, v) {
  const out = {};
  const seats = (v.players || []).map((p) => p.id);
  if (S.gameOf(v).get.by === "pick") {
    out.pool = plain(S.PickEmLogic.histories(v));
    out.ends = S.PickEmLogic.endsAt(v);
    const next = S.PickEmLogic.upcomingEpisode(v);
    out.eligible = next ? seats.map((p) => plain(S.PickEmLogic.eligibility(v, next.id, p)).available) : null;
    // C2 part 4b: a pool's series of totals, where head to head, teams of players or a handicap read it.
    if (S.PickEmLogic.series && (S.MatchupLogic.on(v) || S.TeamLogic.on(v) || S.HandicapLogic.on(v))) out.series = plain(S.PickEmLogic.series(v));
  }
  if (S.KnockoutLogic.on(v)) {
    const k = S.KnockoutLogic.run(v);
    out.knockouts = { out: plain(k.out), ends: k.ends };
    // C2 part 4b: teams knocked out or racing (each team's out, the teams in it, their totals walked).
    if (k.teams) out.knockouts.teams = plain(k.teams);
  }
  if (S.MatchupLogic.on(v)) {
    out.matchups = plain(S.MatchupLogic.run(v));
    out.views = seats.map((p) => plain(S.MatchupLogic.view(v, p)));
  }
  if (S.TeamLogic.on(v)) out.teams = { series: plain(S.TeamLogic.series(v)), view: plain(S.TeamLogic.view(v, "bo")) };
  out.moves = seats.map((p) => [1, 2, 3, 4, 5, 6, 7, 8].map((n) => S.KnockoutLogic.moveProblem(v, p, n)));
  return out;
}

/**
 * Everything the engine scores a draft by, as one viewer sees it (`v`, a copy at a mark), as a string. `o`: the shape's own
 * options; the week's shapes (o.week) add their walks' own output (weekOf), and a pool reads no draft's series.
 */
function readOf(S, v, o, seat, eng) {
  // C2 part 3: a game scored outside the state, read as the server reads it (`eng`: the engine's game-spec and game-view.ts, a
  // ref's for its reads; the working tree's by default).
  const e = eng || engine();
  if (o && o.questions) return questionsRead(S, v, o, seat, e);
  if (o && o.outside) return outsideRead(S, v, o, seat, e);
  if (o && o.stages) return stageRead(S, v);
  // C2 part 4c: a draft's own questions, graded on this copy with what only the server knows, carried as its lines (answer-points.ts
  // walked), where the engine plays them.
  const lines = o && o.asks && S.AnswerLogic.lines ? S.AnswerLogic.lines(v, o.asks.answers, { ...S.AnswerLogic.facts(v), ...(o.asks.extra ? o.asks.extra() : {}) }) : null;
  if (lines) v = S.AnswerLogic.withLines(v, lines);
  const g = S.gameOf(v);
  const ids = (list) => (list || []).map((c) => c.id);
  const rows = S.computeScores(v).map((r) => ({ ...r, roster: ids(r.roster), formerRoster: ids(r.formerRoster) }));
  const series = g.get.by !== "draft" ? null : S.KnockoutLogic.series(v).map((x) => ({ number: x.number, quiet: x.quiet, totals: [...x.totals], rows: [...x.rows] }));
  const played = (v.episodes || []).filter((e) => S.EpisodeLogic.hasResults(e)).sort((a, b) => a.number - b.number);
  const A = S.ActiveRosterLogic;
  const episodes = g.score.by === "moments" ? played.map((ep) => SEATS.map((p) => A.episodeScore(v, ep, p))) : null;
  // As a caller that has only the episode's events and multiplier reads it (an episode's lines), and a slot as the group slots'
  // route reads it (the episode's own events).
  const given = g.score.by === "moments" ? played.map((ep) => SEATS.map((p) => A.episodeScore(v, ep, p, { events: A.episodeEvents(v, ep), times: A.timesFor(v, ep.number) }).total)) : null;
  const slots = S.GroupSlotLogic.config(v) ? played.map((ep) => SEATS.map((p) => S.GroupSlotLogic.episodeLines(v, ep, p))) : null;
  const places = (v.castaways || []).map((c) => S.EliminationOrderScoringStrategy.castawayPoints(v, c));
  return JSON.stringify({
    rows,
    series,
    episodes,
    given,
    slots,
    places,
    stillIn: S.EliminationOrderScoringStrategy.stillInPoints(v),
    market: S.MarketLogic.view(v),
    finale: [...S.AnswerLogic.finalePoints(v)],
    outs: [...S.KnockoutLogic.outs(v)].sort(),
    last: S.lastEpisode(v),
    over: S.gameOver(v),
    ...(o && o.week ? { week: weekOf(S, v) } : {}),
    ...(o && o.asks ? { lines } : {}),
  });
}

/**
 * A game of questions as the server reads it for one viewer (answer-points.ts walked and leagueAnswers, sheetNights' grade): the
 * answers graded on their copy with what only the server knows (o.questions.extra), walked first where the game races, knocks
 * players out, plays co-op, head to head, in teams or with a handicap (AnswerLogic.walk), its copy carrying the walk; the grade
 * (each one's points, each window's verdict, what each answer earned, a rollover's worth), the walk, the score rows, the table as
 * the Games tab ranks it (game-view.ts tableOf, by the points), head to head's and the teams' walks, and where it ends.
 */
function questionsRead(S, v, o, seat, { G, GV }) {
  const A = S.AnswerLogic;
  const all = o.questions.answers;
  const extra = o.questions.extra ? o.questions.extra() : {};
  const factsOf = (x) => ({ ...A.facts(x), ...extra });
  const ids = (list) => (list || []).map((c) => c.id);
  let view = S.spanView(v);
  let rows = all;
  let walk = null;
  if (G.answerParts(S.gameOf(v))) {
    walk = A.walk(v, all, factsOf(v));
    view = S.spanView(A.withWalk(v, walk));
    rows = walk ? A.liveRows(v, all, walk.out) : all;
  }
  const graded = A.grade(view, rows, factsOf(view));
  const right = walk ? (p) => walk.totals[p] || 0 : (p) => graded.points.get(p) || 0;
  return JSON.stringify({
    points: plain(graded.points),
    verdicts: plain(graded.verdicts),
    earned: plain(graded.earned),
    worth: plain(graded.worth),
    walk: plain(walk),
    rows: S.computeScores(view).map((r) => ({ ...r, roster: ids(r.roster), formerRoster: ids(r.formerRoster) })),
    table: GV.tableOf(view, seat || "", (p) => p, right),
    matchups: S.MatchupLogic.on(view) ? plain(S.MatchupLogic.run(view)) : null,
    teams: S.TeamLogic.on(view) ? plain(S.TeamLogic.series(view)) : null,
    last: S.lastEpisode(view),
    over: S.gameOver(view),
  });
}
/**
 * Weekly Calls or bingo as the server reads it for one viewer (calls.ts leagueCalls, bingo.ts leagueBingo, answer-points.ts
 * outsideCounts): each seat's count through the latest episode they've seen (the server's counts by episode, COUNTS, added up from
 * the game's start), times a line's points (o.outside.each); the table as the Games tab ranks it, the score rows and where it ends.
 */
function outsideRead(S, v, o, seat, { GV }) {
  const through = S.SpoilerLogic.latestWithResults(v);
  const from = S.startEpisode(v);
  const count = new Map();
  for (let e = from === null ? through + 1 : from; e <= through; e++) for (const [p, n] of Object.entries(COUNTS[e] || {})) count.set(p, (count.get(p) || 0) + n);
  const right = (p) => (count.get(p) || 0) * o.outside.each;
  return JSON.stringify({ through, table: GV.tableOf(v, seat || "", (p) => p, right), rows: S.computeScores(v), last: S.lastEpisode(v), over: S.gameOver(v) });
}
/** A game in stages as one viewer reads it: each stage's standing, the overall, the score rows, where it ends. */
function stageRead(S, v) {
  return JSON.stringify({ standings: S.StageLogic.standings(v), overall: S.StageLogic.overall(v), rows: S.computeScores(v), ends: S.StageLogic.endsAt(v), last: S.lastEpisode(v), over: S.gameOver(v) });
}

/** Each shape's reads: { shape: { "seat@mark": read } }, the seat null (nobody) and bo, every mark (nothing, 0, 1 to 7). `GV`: the
 *  engine's game-view.ts (a ref's, for its reads; the working tree's by default), for the shapes scored outside the state. */
function readAll(S, G, T, only, GV) {
  const eng = { G, get GV() { return GV || gameView(); } };
  const out = {};
  for (const [name, spec, own, o] of shapes(G)) {
    if (only && name !== only) continue;
    const s = league(S, G, T, spec, own, o);
    out[name] = {};
    for (const seat of [null, "bo"]) {
      for (const mark of [null, 0, 1, 2, 3, 4, 5, 6, 7]) {
        out[name][`${seat || "-"}@${mark === null ? "-" : mark}`] = readOf(S, S.GhostLogic.viewFor(JSON.parse(JSON.stringify(s)), seat, mark), o, seat, eng);
      }
    }
  }
  return out;
}
const hash = (read) => crypto.createHash("sha1").update(read).digest("hex");

function engine(root = path.join(__dirname, "..", "..")) {
  let gv = null;
  return {
    S: require(path.join(root, "src/lib/game/state-logic.js")),
    G: require(path.join(root, "src/lib/game/game-spec/index.js")),
    T: require(path.join(root, "src/lib/game/formats/format-timeline.js")),
    // Loaded when a read first needs it (C2 part 3: the Games tab's table).
    get GV() { return (gv = gv || gameView(root)); },
  };
}
/** An engine's game-view.ts (the Games tab's table), through jiti, as the server and the tests load it. */
function gameView(root = path.join(__dirname, "..", "..")) {
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(root, "src") } });
  return jiti(path.join(root, "src/lib/game/game-view.ts"));
}
/** A git ref's engine (its src/lib/game, exported into a temp folder): { ...engine, done() } to take the folder out. */
function engineAt(ref) {
  const os = require("os");
  const { execFileSync } = require("child_process");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rfl-shapes-"));
  const tar = path.join(dir, "game.tar");
  fs.writeFileSync(tar, execFileSync("git", ["archive", "--format=tar", ref, "src/lib/game"], { cwd: path.join(__dirname, "..", ".."), maxBuffer: 1 << 28 }));
  execFileSync("tar", ["-xf", "game.tar"], { cwd: dir });
  return { ...engine(dir), done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
/** Where two reads part: the first few paths whose values differ, before -> after. */
function apart(x, y, at = "", out = []) {
  if (out.length >= 8 || JSON.stringify(x) === JSON.stringify(y)) return out;
  if (x && y && typeof x === "object" && typeof y === "object") {
    for (const k of [...new Set([...Object.keys(x), ...Object.keys(y)])]) apart(x[k], y[k], `${at}.${k}`, out);
    return out;
  }
  out.push(`${at.slice(1)}: ${JSON.stringify(x ?? null).slice(0, 60)} -> ${JSON.stringify(y ?? null).slice(0, 60)}`);
  return out;
}

module.exports = { CTX, SEATS, shapes, league, readOf, readAll, hash, engine, RECORD: path.join(__dirname, "scoring-shapes.json") };

if (require.main === module) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--ref="));
  const ref = (process.argv.find((a) => a.startsWith("--ref=")) || "").slice(6) || null;
  const at = ref && args[0] !== "--diff" ? engineAt(ref) : null;
  const eng = at || engine();
  const { S, G, T } = eng;
  if (args[0] === "--diff") {
    const before = engineAt(ref || "d5222e68");
    try {
      const only = args[1] || undefined;
      const a = readAll(before.S, before.G, before.T, only, before.GV);
      const b = readAll(S, G, T, only, eng.GV);
      let n = 0;
      for (const [shape, reads] of Object.entries(b)) {
        for (const [where, r] of Object.entries(reads)) {
          if (r === a[shape][where]) continue;
          n++;
          console.log(`${shape} ${where}: ${apart(JSON.parse(a[shape][where]), JSON.parse(r)).join("; ")}`);
        }
      }
      console.log(n ? `${n} reads differ` : "every read the same");
    } finally {
      before.done();
    }
  } else if (args[0] === "--write") {
    const all = readAll(S, G, T, undefined, eng.GV);
    const record = Object.fromEntries(Object.entries(all).map(([k, reads]) => [k, Object.fromEntries(Object.entries(reads).map(([at, r]) => [at, hash(r)]))]));
    fs.writeFileSync(module.exports.RECORD, JSON.stringify(record, null, 1) + "\n");
    console.log(`wrote ${Object.keys(record).length} shapes, ${Object.values(record).reduce((n, r) => n + Object.keys(r).length, 0)} reads`);
  } else if (args[0] === "--print") {
    const [, shape, seat = "-", mark = "-"] = args;
    const reads = readAll(S, G, T, shape, eng.GV)[shape];
    for (const [at, r] of Object.entries(reads)) if (mark === "all" || at === `${seat}@${mark}`) console.log(at, JSON.stringify(JSON.parse(r), null, 1));
  } else console.log("node tests/fixtures/scoring-shapes.js --write | --print <shape> <seat|-> <mark|-|all> | --diff [<shape>]  [--ref=<git ref>]");
  if (at) at.done();
}
