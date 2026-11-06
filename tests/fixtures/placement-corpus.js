// The placement corpus (docs/PLAN-start-a-game-gpt.md track C, C2 part 4: playing by placement). Every way of holding, scoring,
// ranking and asking crossed with every other, as game specs, for the proof that a spec plays by each piece's place in the scoring
// sequence exactly where it played by one of the seven shapes before (tests/placement.test.js): the record
// (placement-corpus.json) is each spec's verdict on the engine before part 4 (made by the code at 6b8b1269, C2 part 3), and the test
// works each out again on the code as it stands. A verdict is what the engine says of the spec: the shape it plays as (typeOf), and
// whether specProblems and specWaitsFor have anything against it (shape only: no ctx, so nothing here is about what a show can
// settle). Part 4's parts open combinations one by one: the test lists each spec whose verdict moves, and why.
//
//   node tests/fixtures/placement-corpus.js --write [--ref=6b8b1269]   the record, from this tree's engine or a ref's (the engine
//                                                       before part 4: the corpus grows by recording from it)
//   node tests/fixtures/placement-corpus.js --diff      where this tree's verdicts part from the record: each spec, before -> after
//   node tests/fixtures/placement-corpus.js --count     how many specs, and how many play
const fs = require("fs");
const path = require("path");

const RECORD = path.join(__dirname, "placement-corpus.json");

const draft = (order, own, more = {}) => ({ by: "draft", each: 3, order, own, ...more });
const BUDGET = { total: 100, floor: 1 };
const MARKET = { total: 100, floor: 5, ceiling: 25, trade: { fee: 0 } };
/** What you hold, with what counts of it: [name, get, count]. The mismatches are there to be refused. */
const HOLDS = [
  ["snake-all", draft("snake", "exclusive"), { all: true }],
  ["snake-start", draft("snake", "exclusive"), { start: 2 }],
  ["snake-best", draft("snake", "exclusive"), { best: 2 }],
  ["blind-all", draft("blind", "shared"), { all: true }],
  ["blind-start", draft("blind", "shared"), { start: 2 }],
  ["blind-best", draft("blind", "shared"), { best: 2 }],
  ["draw-all", draft("draw", "exclusive"), { all: true }],
  ["draw-start", draft("draw", "shared"), { start: 2 }],
  ["auction-all", draft("auction", "exclusive", { budget: BUDGET }), { all: true }],
  ["auction-start", draft("auction", "exclusive", { budget: BUDGET }), { start: 2 }],
  ["market-start", draft("blind", "shared", { each: 5, budget: MARKET }), { start: 3 }],
  ["market-all", draft("blind", "shared", { each: 5, budget: MARKET }), { all: true }],
  ["snake-pick", draft("snake", "exclusive"), { pick: true }],
  ["snake-none", draft("snake", "exclusive"), null],
  ["snake-blind", draft("blind", "exclusive"), { all: true }],
  ["pick", { by: "pick", each: 1, repeat: "cycle" }, { pick: true }],
  ["pick-never", { by: "pick", each: 1, repeat: "never" }, { pick: true }],
  ["pick-all", { by: "pick", each: 1, repeat: "cycle" }, { all: true }],
  ["pick-two", { by: "pick", each: 2, repeat: "cycle" }, { pick: true }],
  ["none", { by: "none" }, null],
  ["none-all", { by: "none" }, { all: true }],
  ["card", { by: "card" }, null],
  ["squares", { by: "squares" }, null],
];
/** How it scores: [name, score]. */
const SCORES = [
  ["place", { by: "place" }],
  ["place-rev", { by: "place", reverse: true }],
  ["moments", { by: "moments", points: null }],
  ["moments-cap", { by: "moments", points: null, captain: { times: 2 } }],
  ["moments-times", { by: "moments", points: null, times: [{ finale: true, times: 2 }] }],
  ["survive", { by: "survive", means: "staysIn", points: 1 }],
  ["survive-lives", { by: "survive", means: "staysIn", points: 1, lives: 2 }],
  ["survive-scores", { by: "survive", means: "scores", points: 1 }],
  ["answers", { by: "answers" }],
  ["answers-lives", { by: "answers", lives: 1 }],
  ["answers-parlay", { by: "answers", parlays: [{ of: ["boot", "imm"], times: 3 }] }],
  ["answers-parlay-once", { by: "answers", parlays: [{ of: ["winner", "second"], times: 2 }] }],
  ["lines", { by: "lines" }],
  ["lines-pts", { by: "lines", points: 2 }],
  ["stats", { by: "stats", points: { goals: 1 } }],
];
const CUT = [{ at: { every: 1 }, out: 1 }];
const TEAMS = { of: 2 };
const HANDICAP = { points: 2 };
/** How it ranks: [name, rank]. */
const RANKS = [
  ["total", { by: "total" }],
  ["streak", { by: "streak" }],
  ["standing", { by: "standing" }],
  ["standing-cut", { by: "standing", cut: CUT }],
  ["total-race", { by: "total", race: { to: 20 } }],
  ["standing-cut-race", { by: "standing", cut: CUT, race: { to: 20 } }],
  ["matchups", { by: "matchups" }],
  ["matchups-po", { by: "matchups", playoffs: { teams: 2 } }],
  ["matchups-race", { by: "matchups", race: { to: 20 } }],
  ["coop", { by: "coop" }],
  ["worth", { by: "worth" }],
  ["total-teams", { by: "total", teams: TEAMS }],
  ["matchups-teams", { by: "matchups", teams: TEAMS }],
  ["standing-cut-teams", { by: "standing", cut: CUT, teams: TEAMS }],
  ["total-race-teams", { by: "total", race: { to: 20 }, teams: TEAMS }],
  ["total-hc", { by: "total", handicap: HANDICAP }],
  ["streak-hc", { by: "streak", handicap: HANDICAP }],
  ["standing-hc", { by: "standing", handicap: HANDICAP }],
  ["matchups-hc", { by: "matchups", handicap: HANDICAP }],
  ["streak-teams", { by: "streak", teams: TEAMS }],
  ["standing-teams", { by: "standing", teams: TEAMS }],
  ["roto", { by: "roto" }],
];
const boot = (more = {}) => ({ id: "boot", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" }, ...more });
const imm = (more = {}) => ({ id: "imm", ask: "Who wins immunity?", answer: "person", points: 1, asked: "each", settle: { by: "moment", take: "who", moment: "individualImmunity" }, ...more });
const winner = (more = {}) => ({ id: "winner", ask: "Who wins?", answer: "person", points: 5, asked: "once", closes: "finale", settle: { by: "results", take: "winner" }, ...more });
const second = (more = {}) => ({ id: "second", ask: "Who's runner-up?", answer: "person", points: 2, asked: "once", settle: { by: "results", take: "placed", place: 2 }, ...more });
const SHRINK = { points: 1, per: "episode" };
const FINALE = [
  { id: "top3", ask: "Who makes the final three?", answer: "person", pick: 3, from: "cast", points: 1, asked: "once", closes: "finale", settle: { by: "results", take: "top", place: 3 } },
  { id: "winner", ask: "Who wins?", answer: "person", pick: 1, from: "cast", points: 3, asked: "once", closes: "finale", settle: { by: "results", take: "winner" } },
];
const CALLS = { id: "calls", ask: "Two calls before each episode", answer: "calls", points: 1, settle: { by: "calls" }, asked: "each", closes: "start" };
const idol = (more = {}) => ({ id: "idol", ask: "Is an idol played?", answer: "yesNo", points: 2, asked: "each", settle: { by: "moment", take: "happened", moment: "idolPlayed" }, ...more });
/** What it asks: [name, ask]. */
const ASKS = [
  ["none", []],
  ["finale", FINALE],
  ["boot", [boot()]],
  ["boot-imm", [boot(), imm()]],
  ["calls", [CALLS]],
  ["calls-boot", [CALLS, boot()]],
  ["boot-split", [boot({ share: "split" })]],
  ["boot-only", [boot({ share: "only" })]],
  ["boot-rollover", [boot({ rollover: true })]],
  ["boot-split-rollover", [boot({ share: "split", rollover: true })]],
  ["split-imm", [boot({ share: "split" }), imm()]],
  ["only-imm", [boot({ share: "only" }), imm()]],
  ["rollover-imm", [boot({ rollover: true }), imm()]],
  ["wager-imm", [boot({ wager: 3 }), imm()]],
  ["winner", [winner()]],
  ["winner-shrink", [winner({ shrink: SHRINK })]],
  ["winner-shrink-split", [winner({ shrink: SHRINK, share: "split" })]],
  ["winner-shrink-only", [winner({ shrink: SHRINK, share: "only" })]],
  ["winner-shrink-change-split", [winner({ shrink: { points: 2, per: "change" }, share: "split" })]],
  ["winner-second", [winner(), second()]],
  ["shrink-second", [winner({ shrink: SHRINK }), second()]],
  ["shrink-split-second", [winner({ shrink: SHRINK, share: "split" }), second()]],
  ["shrink-only-second", [winner({ shrink: SHRINK, share: "only" }), second()]],
  ["split-second", [winner({ share: "split" }), second()]],
  ["idol-wager", [idol({ wager: 5 })]],
  ["idol-wager-split", [idol({ wager: 5, share: "split" })]],
  ["idol-wager-rollover", [idol({ wager: 5, rollover: true })]],
  ["trivia", [{ id: "trivia", ask: "Trivia", answer: "trivia", points: 1, asked: "each", settle: { by: "trivia" } }]],
  ["team-pick", [boot({ from: "team" })]],
  ["finale-boot", [...FINALE, boot()]],
  ["beat", [boot({ beat: { by: "bot" } })]],
  ["beat-split", [boot({ beat: { by: "bot" }, share: "split" })]],
];
/** The asks crossed with every hold, score and rank (the rest go with the games of questions only: below). */
const EVERYWHERE = ["none", "finale", "boot", "boot-imm", "calls", "finale-boot"];
/** The holds a game of questions' every ask is crossed with. */
const QUESTION_HOLDS = ["none", "snake-all", "pick"];

const STAGE_GAMES = [
  ["outlast", { preset: "outlast" }],
  ["lineup", { preset: "weekly-lineup" }],
  ["pool", { preset: "survival-pool" }],
  ["calls", { preset: "weekly-calls" }],
  ["bingo", { preset: "weekly-bingo" }],
  ["questions", { get: { by: "none" }, count: null, score: { by: "answers" }, rank: { by: "total" }, ask: [boot()] }],
  ["draft-questions", { preset: "outlast", ask: [boot()] }],
  ["pool-total", { preset: "survival-pool", rank: { by: "total" } }],
];

/** Every spec of the corpus, in a fixed order: [name, spec]. */
function corpus() {
  const out = [];
  const one = (h, sc, r, a) => {
    const [hn, get, count] = h;
    const spec = { get, count, score: sc[1], rank: r[1], ask: a[1] };
    out.push([`${hn}|${sc[0]}|${r[0]}|${a[0]}`, spec]);
  };
  const askOf = new Map(ASKS);
  for (const h of HOLDS) for (const sc of SCORES) for (const r of RANKS) for (const an of EVERYWHERE) one(h, sc, r, [an, askOf.get(an)]);
  for (const hn of QUESTION_HOLDS) {
    const h = HOLDS.find((x) => x[0] === hn);
    for (const sc of SCORES.filter((x) => x[0].startsWith("answers") || x[0] === "place" || x[0] === "survive")) {
      for (const r of RANKS) for (const a of ASKS) if (!EVERYWHERE.includes(a[0])) one(h, sc, r, a);
    }
  }
  // A game in stages: two of every kind one after another (the second from Episode 6), one stage, seven, and one beside the game's own.
  const stage = (id, g, more = {}) => ({ id, name: null, game: g, ...more });
  const from = (g, n) => ({ ...g, span: { from: n, to: null } });
  const until = (g, n) => ({ ...g, span: { from: 1, to: n } });
  const staged = (list) => ({ get: { by: "none" }, count: null, score: { by: "stages" }, rank: { by: "total" }, ask: [], stages: list, overall: { by: "points" } });
  for (const [a, ga] of STAGE_GAMES) {
    for (const [b, gb] of STAGE_GAMES) out.push([`stages|${a}|${b}`, staged([stage("one", until(ga, 5)), stage("two", from(gb, 6))])]);
    out.push([`stages|${a}|alone`, staged([stage("one", ga)])]);
    out.push([`stages|${a}|alongside-bingo`, staged([stage("one", ga), stage("two", { preset: "weekly-bingo" }, { alongside: true })])]);
  }
  out.push(["stages|seven", staged(Array.from({ length: 7 }, (_, i) => stage(`s${i}`, i === 6 ? from(STAGE_GAMES[0][1], i * 2 + 1) : { ...STAGE_GAMES[0][1], span: { from: i * 2 + 1, to: i * 2 + 2 } })))]);
  for (const [a, ga] of STAGE_GAMES) {
    out.push([`stages|${a}|overlapping`, staged([stage("one", until(ga, 5)), stage("two", from(ga, 3))])]);
    out.push([`stages|${a}|nested`, staged([stage("one", until(ga, 5)), stage("two", staged([stage("x", until(ga, 8)), stage("y", from(ga, 9))]))])]);
  }
  // A nested game in stages whose own stages are whole games (what fullSpec leaves a nested game as it is).
  const whole = (span) => ({ spec: 1, preset: null, span, pool: { of: "cast", where: { stillIn: true } }, get: draft("snake", "exclusive"), count: { all: true }, score: { by: "place" }, rank: { by: "total" }, ask: [], closes: "start" });
  const inner = { spec: 1, preset: null, span: { from: 6, to: null }, pool: { of: "cast", where: { stillIn: true } }, get: { by: "none" }, count: null, score: { by: "stages" }, rank: { by: "total" }, ask: [], closes: "start", overall: { by: "points" },
    stages: [stage("x", whole({ from: 6, to: 8 })), stage("y", whole({ from: 9, to: null }))] };
  out.push(["stages|whole|nested", staged([stage("one", whole({ from: 1, to: 5 })), stage("two", inner)])]);
  // What every game shares (a span, the cast still in, moves locking at the start), and a draft's order with its ownership, on each
  // kind of game.
  const PARTS = [
    ["daily", { closes: "daily" }],
    ["weekly", { closes: "weekly" }],
    ["group", { pool: { of: "cast", where: { group: "t1" } } }],
    ["teams", { pool: { of: "cast", where: { teams: ["a"] } } }],
    ["anyone", { pool: { of: "cast", where: null } }],
    ["stillin-false", { pool: { of: "cast", where: { stillIn: false } } }],
    ["phase", { span: { from: { phase: "merged" }, to: null } }],
    ["phase-at", { span: { from: { phase: "merged", at: 7 }, to: null } }],
    ["from-0", { span: { from: 0, to: null } }],
    ["span-to-phase", { span: { from: 1, to: { phase: "merged" } } }],
    ["ask-not-list", { ask: "boot" }],
  ];
  const GAMES = [...STAGE_GAMES.filter(([n]) => n !== "draft-questions" && n !== "pool-total"), ["shared-outlast", { preset: "outlast", get: draft("blind", "shared") }]];
  for (const [g, game] of GAMES) for (const [pn, part] of PARTS) out.push([`parts|${g}|${pn}`, { ...game, ...part }]);
  for (const [order, own] of [["draw", "nobody"], ["draw", "shared"], ["auction", "shared"], ["auction", "nobody"], ["snake", "shared"], ["blind", "nobody"], ["nobody", "exclusive"]]) {
    for (const [g, game] of [["outlast", { preset: "outlast" }], ["lineup", { preset: "weekly-lineup" }]]) {
      out.push([`parts|${g}|${order}-${own}`, { ...game, get: draft(order, own, order === "auction" ? { budget: BUDGET } : {}) }]);
    }
  }
  return out;
}

const SHAPE = { "classic-draft": "c", "active-roster": "a", pickem: "p", "weekly-calls": "k", questions: "q", "weekly-bingo": "b", stages: "s" };
/** A spec's verdict, as three letters: the shape it plays as (or '.'), then 'p' when specProblems has anything against it (else
 *  '-'), then 'w' when specWaitsFor does (else '-'). */
function verdictOf(G, spec) {
  const shape = G.typeOf(spec);
  const problems = G.specProblems(spec, null).length > 0;
  const waits = G.specWaitsFor(spec).length > 0;
  return `${shape ? SHAPE[shape] : "."}${problems ? "p" : "-"}${waits ? "w" : "-"}`;
}
/** Every spec's verdict, in the corpus' order. */
function verdicts(G) {
  return corpus().map(([, spec]) => verdictOf(G, spec));
}
/** Plays: a shape, nothing against it. */
const plays = (v) => v[0] !== "." && v[1] === "-" && v[2] === "-";

/** Verdicts run-length packed (a verdict, then *n when it repeats, space-separated), and back. */
function pack(v) {
  const out = [];
  for (let i = 0; i < v.length; ) {
    let j = i;
    while (j < v.length && v[j] === v[i]) j++;
    out.push(j - i > 1 ? `${v[i]}*${j - i}` : v[i]);
    i = j;
  }
  return out.join(" ");
}
function unpack(text) {
  return text.split(" ").flatMap((t) => {
    const [v, n] = t.split("*");
    return Array(n ? Number(n) : 1).fill(v);
  });
}
/** The record's verdicts, one a spec in the corpus' order. */
function record() {
  return unpack(JSON.parse(fs.readFileSync(RECORD, "utf8")).verdicts);
}

/** A git ref's game-spec (its src/lib/game, exported into a temp folder): { G, done() } to take the folder out. */
function specAt(ref) {
  const os = require("os");
  const { execFileSync } = require("child_process");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rfl-placement-"));
  fs.writeFileSync(path.join(dir, "game.tar"), execFileSync("git", ["archive", "--format=tar", ref, "src/lib/game"], { cwd: path.join(__dirname, "..", ".."), maxBuffer: 1 << 28 }));
  execFileSync("tar", ["-xf", "game.tar"], { cwd: dir });
  return { G: require(path.join(dir, "src/lib/game/game-spec/index.js")), done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

if (require.main === module) {
  const ref = (process.argv.find((a) => a.startsWith("--ref=")) || "").slice(6) || null;
  const at = ref ? specAt(ref) : null;
  const G = at ? at.G : require("../../src/lib/game/game-spec/index.js");
  const arg = process.argv[2];
  const list = corpus();
  if (arg === "--write") {
    const v = verdicts(G);
    fs.writeFileSync(RECORD, `${JSON.stringify({ about: "tests/fixtures/placement-corpus.js: each spec's verdict (shape, problems, waits) on the engine before C2 part 4 (6b8b1269), run-length: a verdict, then *n when it repeats", specs: list.length, verdicts: pack(v) }, null, 2)}\n`);
    console.log(`wrote ${list.length} verdicts (${v.filter(plays).length} play)${ref ? ` from ${ref}'s engine` : ""}`);
  } else if (arg === "--diff") {
    const was = record();
    const v = verdicts(G);
    let n = 0;
    list.forEach(([name], i) => {
      const before = was[i];
      if (before !== v[i]) {
        n++;
        console.log(`${name}: ${before} -> ${v[i]}`);
      }
    });
    console.log(`${n} of ${list.length} part from the record`);
  } else if (arg === "--count") {
    const v = verdicts(G);
    console.log(`${list.length} specs, ${v.filter(plays).length} play`);
  } else {
    console.log("--write, --diff or --count  [--ref=<git ref>: that ref's engine]");
  }
  if (at) at.done();
}

module.exports = { corpus, verdictOf, verdicts, plays, record, pack, unpack, SHAPE };
