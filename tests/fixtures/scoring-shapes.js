// Every draft's shape on one made-up season, for the scoring sequence's proof (docs/PLAN-start-a-game-gpt.md track C, C2 part 1:
// "a test per shape that the old scorer and the sequence agree episode by episode"; tests/sequence-agree.test.js). Each shape is
// a game spec on the same league: fifteen castaways c0 to c14, four seats (ann, bo, cy, di), seven episodes with every kind of
// night (a double boot, a medevac, a quit, a night nobody went home, the finale with a fire-making loss, two losing finalists and
// the winner), moments counted in units that leave float noise (3 x 1.1), lineups set, carried and left unset, captains named and
// carried, two pickups (one after the last episode but one, so a mark sees the move before the series does), side bets (one paying,
// one alone, one shared), finale predictions, group slots on the format's pairs, a handicap, a stock market's cash.
//
// What each read is (readOf): everything the engine scores a draft by, as a viewer sees it at a mark (nothing seen, each episode,
// everything; GhostLogic.viewFor, as golden.js reads): the table's rows (every field, in its order), the knockouts' series
// episode by episode, each seat's episodeScore for each episode with results (a game scored by moments), each castaway's place and
// the still-in points, the market, the finale's points, who's out and where the game ends.
//
// The record (scoring-shapes.json) is the scorers' reads before C2 (made by the code at d5222e68, C1), a hash a read: the test
// reads each again on the code as it stands and compares. Remake it only when a step changes how a draft scores on purpose, and
// say which reads move and why:
//   node tests/fixtures/scoring-shapes.js --write [--ref=<git ref>]      the record, from this tree's engine (or the ref's)
//   node tests/fixtures/scoring-shapes.js --print <shape> <seat|-> <mark|-|all> [--ref=<git ref>]   one read, in full
//   node tests/fixtures/scoring-shapes.js --diff [<shape>] [--ref=d5222e68]   where this tree's reads part from the ref's (the
//                                             scorers before C2 by default): each seat@mark, the fields, before -> after
// A ref's engine is its src/lib/game, exported into the OS temp folder (git archive) and taken out after.
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const CTX = {
  moments: [],
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  jury: true,
  phases: [{ id: "premerge" }, { id: "merged" }],
};
const SEATS = ["ann", "bo", "cy", "di"];
const FINALE = (G) => G.finaleQuestions({ top3: 1, winner: 3, from: "any" });

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

/** The league for one shape, its spec through its settings (as stored, the flag off), the whole season recorded. */
function league(S, G, T, spec, own, o = {}) {
  const castaways = Array.from({ length: 15 }, (_, i) => ({
    id: `c${i}`, name: `C${i}`, status: "active", tribeId: i < 8 ? "t1" : "t2", ownerIds: [], placementOrder: null, exitMethod: null, exitEpisodeId: null,
  }));
  const s = S.migrateLeagueState({
    settings: { ...G.settingsOf(spec), showFormat: "survivor", setupComplete: true },
    players: SEATS.map((id, i) => ({ id, name: id.toUpperCase(), color: `#00${i}` })),
    draftOrder: SEATS.slice(),
    tribes: [{ id: "t1", name: "Toka", color: "#111" }, { id: "t2", name: "Vula", color: "#222" }],
    castaways,
    episodes: Array.from({ length: 7 }, (_, i) => ({ id: `e${i + 1}`, number: i + 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} })),
  });
  const team = TEAMS[own];
  for (const [p, ids] of Object.entries(team)) ids.forEach((id) => s.castaways.find((c) => c.id === id).ownerIds.push(p));
  s.castaways.forEach((c) => { if (c.ownerIds.length) c.acquiredVia = "draft"; });
  const moves = o.market ? MOVES.market : MOVES[own];
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
    const lu = LINEUPS[own][n];
    if (lu) Object.entries(lu).forEach(([p, ids]) => { ep.lineups[p] = ids.slice(); });
    if (CAPTAINS[n]) ep.captains = { ...CAPTAINS[n] };
    ep.bets = (BETS[n] || []).map((b) => JSON.parse(JSON.stringify(b)));
    if (o.early === n) ep.resultsStage = "early";
  }
  s.finalePredictions = FINALE_PICKS.map((f) => JSON.parse(JSON.stringify(f)));
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

/** Everything the engine scores a draft by, as one viewer sees it (`v`, a copy at a mark), as a string. */
function readOf(S, v) {
  const g = S.gameOf(v);
  const ids = (list) => (list || []).map((c) => c.id);
  const rows = S.computeScores(v).map((r) => ({ ...r, roster: ids(r.roster), formerRoster: ids(r.formerRoster) }));
  const series = S.KnockoutLogic.series(v).map((x) => ({ number: x.number, quiet: x.quiet, totals: [...x.totals], rows: [...x.rows] }));
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
  });
}

/** Each shape's reads: { shape: { "seat@mark": read } }, the seat null (nobody) and bo, every mark (nothing, 0, 1 to 7). */
function readAll(S, G, T, only) {
  const out = {};
  for (const [name, spec, own, o] of shapes(G)) {
    if (only && name !== only) continue;
    const s = league(S, G, T, spec, own, o);
    out[name] = {};
    for (const seat of [null, "bo"]) {
      for (const mark of [null, 0, 1, 2, 3, 4, 5, 6, 7]) {
        out[name][`${seat || "-"}@${mark === null ? "-" : mark}`] = readOf(S, S.GhostLogic.viewFor(JSON.parse(JSON.stringify(s)), seat, mark));
      }
    }
  }
  return out;
}
const hash = (read) => crypto.createHash("sha1").update(read).digest("hex");

function engine(root = path.join(__dirname, "..", "..")) {
  return {
    S: require(path.join(root, "src/lib/game/state-logic.js")),
    G: require(path.join(root, "src/lib/game/game-spec/index.js")),
    T: require(path.join(root, "src/lib/game/formats/format-timeline.js")),
  };
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
  const { S, G, T } = at || engine();
  if (args[0] === "--diff") {
    const before = engineAt(ref || "d5222e68");
    try {
      const only = args[1] || undefined;
      const a = readAll(before.S, before.G, before.T, only);
      const b = readAll(S, G, T, only);
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
    const all = readAll(S, G, T);
    const record = Object.fromEntries(Object.entries(all).map(([k, reads]) => [k, Object.fromEntries(Object.entries(reads).map(([at, r]) => [at, hash(r)]))]));
    fs.writeFileSync(module.exports.RECORD, JSON.stringify(record, null, 1) + "\n");
    console.log(`wrote ${Object.keys(record).length} shapes, ${Object.values(record).reduce((n, r) => n + Object.keys(r).length, 0)} reads`);
  } else if (args[0] === "--print") {
    const [, shape, seat = "-", mark = "-"] = args;
    const reads = readAll(S, G, T, shape)[shape];
    for (const [at, r] of Object.entries(reads)) if (mark === "all" || at === `${seat}@${mark}`) console.log(at, JSON.stringify(JSON.parse(r), null, 1));
  } else console.log("node tests/fixtures/scoring-shapes.js --write | --print <shape> <seat|-> <mark|-|all> | --diff [<shape>]  [--ref=<git ref>]");
  if (at) at.done();
}
