// L4 part 1b (docs/PLAN-start-a-game-gpt.md track L): a game ranked by a sport's categories, and head to head's and best ball's
// default specs, on the recorded fixtures (tests/fixtures/espn/). The pure scorer (src/lib/game/sequence/categories.js): each
// seat's category totals over a window of games, from the kept finals' lines (final.ts storedGame, as the server reads them), a
// rate (FG%, ERA, GAA) worked out from the window's counts added, never averaged; head to head by categories (a week's record,
// most categories); roto (points by rank, the tied sharing). The spec's shape and its check (schema.js categoryProblems, the
// sport's ctx.categories), its words, and the defaults (basketball's and hockey's Yahoo categories, baseball's 5x5) passing it.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, sportById, allSports, defaultsFor, specContextOf, storedGame } = jiti("../src/lib/sports/index.ts");
const { rateOf, categoryTotals, windowLines, compareCategory, categoryMatchup, categoryWeek, categoryRecords, roto } = require("../src/lib/game/sequence/categories.js");
const { statMoments } = require("../src/lib/game/sequence/stats.js");
const Seq = require("../src/lib/game/sequence/index.js");
const { specProblems, specWaitsFor, fullSpec, categoryParts, matchupParts, describeSpec } = require("../src/lib/game/game-spec/index.js");

const problems = (spec, ctx) => specProblems(spec, ctx).map((p) => `${p.at}: ${p.problem}`);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
// A recorded game as the server keeps it (read back as saved), each line with its derived stats, and ESPN's own box beside it.
function game(league, file) {
  const sport = sportOf(league);
  const summary = require(`./fixtures/espn/${file}.json`);
  const kept = JSON.parse(JSON.stringify(storedGame(sport, summary)));
  const box = sport.readBox(summary);
  const lines = Object.fromEntries(Object.entries(kept.lines).map(([id, l]) => [id, sport.full(l)]));
  return { sport, box, lines, people: Object.values(box.people) };
}
// Someone's id by name, and the top n of a game's people by a stat (ESPN's box), for seats made of whoever's there.
const idOf = (g, name) => g.people.find((p) => p.name === name).id;
const topBy = (g, stat, n, skip = []) => g.people.filter((p) => !skip.includes(p.id)).sort((a, b) => (b.stats[stat] ?? 0) - (a.stats[stat] ?? 0) || a.id.localeCompare(b.id)).slice(0, n);

test("every rate of every sport has its parts as data, and its `of` is them (one definition for a game's line and a window's)", () => {
  for (const sport of allSports()) {
    for (const s of sport.stats.filter((x) => x.kind === "rate")) {
      assert.ok(s.parts, `${sport.name} ${s.key}: its parts`);
      const counts = Object.fromEntries([...Object.keys(s.parts.top), ...Object.keys(s.parts.bottom)].map((k, i) => [k, 3 + i * 7]));
      assert.equal(s.of(counts), rateOf(s.parts, counts), `${sport.name} ${s.key}`);
    }
    const defs = sport.categoryDefs();
    assert.ok(Object.values(defs).every((d) => d.better && d.group), sport.name);
    assert.ok(!sport.stats.some((s) => s.place && defs[s.key]), `${sport.name}: a place is never a category`);
  }
  const mlb = sportById("baseball");
  // The rates as they always read: ERA 27 earned runs a 27 outs, WHIP the hits and walks an inning; none without innings.
  assert.equal(mlb.stat("ERA").of({ ER: 3, OUTS: 18 }), 4.5);
  assert.equal(mlb.stat("WHIP").of({ PH: 5, PBB: 1, OUTS: 18 }), 1);
  assert.equal(mlb.stat("ERA").of({ ER: 3 }), null);
  assert.equal(sportById("hockey").stat("GAA").of({ GA: 2, TOI: 3600 }), 2);
  // ctx.categories: a rate's marked, which way is better, no place.
  const ctx = specContextOf(sportOf("basketball/nba"));
  assert.deepEqual(ctx.categories.find((c) => c.key === "FG%"), { key: "FG%", label: "Field goal percentage", better: "higher", rate: true });
  assert.equal(ctx.categories.find((c) => c.key === "TO").better, "lower");
  assert.ok(!specContextOf(sportOf("golf/pga")).categories.some((c) => c.key === "POS"));
});

test("a week of basketball summed: FG% and FT% from the week's makes and attempts (never each game's averaged), the counts added", () => {
  // Four games, a seat's starters in each: the 76ers' opener, the WNBA's final, a men's and a women's college game.
  const week = [game("basketball/nba", "nba-401909093"), game("basketball/wnba", "wnba-401918306"), game("basketball/mens-college-basketball", "ncaam-401820165"), game("basketball/womens-college-basketball", "ncaaw-401813906")];
  const defs = sportOf("basketball/nba").categoryDefs();
  const cats = defaultsFor("basketball").categories.stats;
  const nba = week[0];
  const [maxey, mitchell] = ["Tyrese Maxey", "Donovan Mitchell"].map((n) => idOf(nba, n));
  // Seat A: Maxey and each other game's top scorer; seat B: Mitchell and each other game's second.
  const a = [maxey, ...week.slice(1).map((g) => topBy(g, "PTS", 1)[0].id)];
  const b = [mitchell, ...week.slice(1).map((g) => topBy(g, "PTS", 2)[1].id)];
  const byEpisode = Object.fromEntries(week.map((g, i) => [i + 1, g.lines]));
  const seat = (ids) => windowLines(byEpisode, 1, 4, (ep) => [ids[ep - 1]]);
  const linesA = seat(a);
  assert.equal(linesA.length, 4, "Maxey in the opener, one starter in each of the other three");
  const tA = categoryTotals(linesA, cats, defs);
  const tB = categoryTotals(seat(b), cats, defs);
  // ESPN's own box scores, added by hand.
  const boxOf = (ids) => ids.map((id, i) => week[i].box.people[id].stats);
  const add = (ids, k) => sum(boxOf(ids).map((s) => s[k] ?? 0));
  for (const [ids, t] of [[a, tA], [b, tB]]) {
    for (const k of ["3PM", "PTS", "REB", "AST", "STL", "BLK", "TO"]) assert.equal(t[k], add(ids, k), k);
    assert.equal(t["FG%"], add(ids, "FGM") / add(ids, "FGA"), "FG%: the week's makes over its attempts");
    assert.equal(t["FT%"], add(ids, "FTM") / add(ids, "FTA"));
  }
  // Never each game's FG% averaged (they differ here).
  const averaged = sum(boxOf(a).map((s) => s.FGM / s.FGA)) / 4;
  assert.notEqual(tA["FG%"], averaged);
  // Head to head: each category to the better total, turnovers to the fewer.
  const m = categoryMatchup(tA, tB, cats, defs);
  for (const c of m.cats) {
    const better = c.stat === "TO" ? (c.a < c.b ? "a" : c.b < c.a ? "b" : null) : c.a > c.b ? "a" : c.b > c.a ? "b" : null;
    assert.equal(c.won, better, c.stat);
  }
  assert.equal(m.a.wins + m.a.losses + m.a.ties, 9);
  assert.deepEqual(m.b, { wins: m.a.losses, losses: m.a.wins, ties: m.a.ties });
  assert.equal(m.result, m.a.wins > m.b.wins ? "a" : m.b.wins > m.a.wins ? "b" : "tie");
  // Maxey's 32 against Mitchell's 32 in the opener alone: points tied, the rest by their lines.
  const one = categoryMatchup(categoryTotals([nba.lines[maxey]], cats, defs), categoryTotals([nba.lines[mitchell]], cats, defs), cats, defs);
  assert.equal(one.cats.find((c) => c.stat === "PTS").won, null, "32 each: a tie");
});

test("a rate with nothing to divide by loses its category, and two of them tie; a skater's time on ice is no goalie's (GAA)", () => {
  const defs = sportOf("basketball/nba").categoryDefs();
  // A count in a rate's top and its bottom is added once: FO%'s faceoffs won over won and lost, OBP's hits, walks and hit-by-pitches.
  const hdefs0 = sportById("hockey").categoryDefs();
  assert.equal(categoryTotals([{ FW: 6, FL: 4 }, { FW: 4, FL: 6 }], ["FO%"], hdefs0)["FO%"], 0.5);
  const obp = categoryTotals([{ AB: 4, H: 1, BB: 1 }, { AB: 3, H: 2, HBP: 1, SF: 1 }], ["OBP"], sportById("baseball").categoryDefs()).OBP;
  assert.equal(obp, (1 + 1 + 2 + 1) / (4 + 1 + 3 + 1 + 1), "OBP: times on base over plate appearances that count");
  const none = categoryTotals([{ PTS: 4, FTM: 4, FTA: 4 }], ["FG%", "PTS"], defs);
  assert.equal(none["FG%"], null, "no shots: no FG%");
  assert.equal(compareCategory(null, 0, "higher"), -1);
  assert.equal(compareCategory(0.5, null, "lower"), 1, "an ERA of anything beats none");
  assert.equal(compareCategory(null, null, "higher"), 0);
  assert.equal(compareCategory(10 / 20, 5 / 10, "higher"), 0, "the same rate from other counts is exactly the same");
  // Kings at Rangers: a goalie pulled after the 1st. A seat with both of a team's goalies and its skaters: GAA from the goalies'
  // goals against and time on ice added (the skaters' time left out), SV% from their saves and shots.
  const g = game("hockey/nhl", "nhl-401892582");
  const hockey = sportById("hockey");
  const hdefs = hockey.categoryDefs();
  const goalies = g.people.filter((p) => p.position === "G" && (p.stats.TOI ?? 0) > 0);
  const team = goalies[0].team;
  const two = goalies.filter((p) => p.team === team);
  const withTwo = two.length === 2 ? two : goalies.filter((p) => p.team !== team);
  assert.equal(withTwo.length, 2, "one team used two goalies");
  const skaters = g.people.filter((p) => p.team === withTwo[0].team && p.position !== "G").slice(0, 4);
  const ids = [...withTwo, ...skaters].map((p) => p.id);
  const t = categoryTotals(ids.map((id) => g.lines[id]), ["GAA", "SV%", "SOG", "W"], hdefs);
  const gs = withTwo.map((p) => p.stats);
  assert.equal(t.GAA, (3600 * sum(gs.map((s) => s.GA ?? 0))) / sum(gs.map((s) => s.TOI)), "goals against over the goalies' time on ice only");
  assert.equal(t["SV%"], sum(gs.map((s) => s.SV ?? 0)) / sum(gs.map((s) => s.SA ?? 0)));
  assert.equal(t.SOG, sum(skaters.map((p) => p.stats.SOG ?? 0)));
  // Each goalie's own GAA averaged is something else.
  assert.notEqual(t.GAA, sum(gs.map((s) => (3600 * (s.GA ?? 0)) / s.TOI)) / 2);
});

test("baseball's 5x5 as roto over the Red Sox-Yankees series: ERA and WHIP from the series' outs, every category ranked, ties sharing", () => {
  const games = [game("baseball/mlb", "mlb-401907924"), game("baseball/mlb", "mlb-401907963")];
  const mlb = sportById("baseball");
  const defs = mlb.categoryDefs();
  const cats = defaultsFor("baseball").categories.stats;
  assert.deepEqual(cats, ["R", "HR", "RBI", "SB", "AVG", "W", "SV", "PK", "ERA", "WHIP"]);
  // Four seats: each team's hitters split in two, each half with one of the team's pitchers.
  const seats = new Map();
  for (const teamIdx of [0, 1]) {
    const teamId = games[0].box.teams[teamIdx].id;
    const people = new Map();
    for (const g of games) for (const p of g.people) if (p.team === teamId && !people.has(p.id)) people.set(p.id, p);
    const all = [...people.values()].sort((x, y) => x.id.localeCompare(y.id));
    const hitters = all.filter((p) => games.some((g) => g.lines[p.id]?.AB));
    const pitchers = all.filter((p) => games.some((g) => g.lines[p.id]?.OUTS));
    for (const half of [0, 1]) {
      const ids = [...hitters.filter((_, i) => i % 2 === half), pitchers[half]].filter(Boolean).map((p) => p.id);
      const lines = games.flatMap((g) => ids.map((id) => g.lines[id]).filter(Boolean));
      seats.set(`${teamId}-${half}`, { ids, lines, totals: categoryTotals(lines, cats, defs) });
    }
  }
  for (const s of seats.values()) {
    const pitched = s.lines.filter((l) => l.OUTS);
    const outs = sum(pitched.map((l) => l.OUTS));
    assert.equal(s.totals.ERA, outs ? (27 * sum(pitched.map((l) => l.ER ?? 0))) / outs : null);
    assert.equal(s.totals.WHIP, outs ? (3 * sum(pitched.map((l) => (l.PH ?? 0) + (l.PBB ?? 0)))) / outs : null);
    const hit = s.lines.filter((l) => l.AB);
    assert.equal(s.totals.AVG, sum(hit.map((l) => l.H ?? 0)) / sum(hit.map((l) => l.AB)), "AVG: hits over at-bats added");
  }
  const totals = new Map([...seats].map(([id, s]) => [id, s.totals]));
  const table = roto(totals, cats, defs);
  assert.equal(table.length, 4);
  // Every category hands out 4 + 3 + 2 + 1 = 10, however it ties.
  for (const k of cats) assert.equal(sum(table.map((r) => r.points[k])), 10, k);
  assert.equal(sum(table.map((r) => r.total)), 100);
  assert.ok(table.every((r, i) => i === 0 || table[i - 1].total >= r.total), "the most first");
  // Each category's points follow its order: better (lower for ERA and WHIP) never fewer points.
  for (const k of cats) {
    for (const x of table) for (const y of table) {
      const c = compareCategory(totals.get(x.id)[k], totals.get(y.id)[k], defs[k].better);
      if (c > 0) assert.ok(x.points[k] > y.points[k], `${k}: ${x.id} over ${y.id}`);
      if (c === 0) assert.equal(x.points[k], y.points[k], `${k}: tied share`);
    }
  }
});

test("roto's points by rank, the tied sharing their places' points; a week of head to head by categories, odd and quiet", () => {
  const defs = { R: { better: "higher", group: "b" }, ERA: { better: "lower", group: "p", parts: { top: { ER: 27 }, bottom: { OUTS: 1 } } } };
  const cats = ["R", "ERA"];
  const totals = new Map([["a", { R: 10, ERA: 3 }], ["b", { R: 10, ERA: null }], ["c", { R: 4, ERA: 2 }], ["d", { R: 12, ERA: 3 }]]);
  const t = roto(totals, cats, defs);
  const by = Object.fromEntries(t.map((r) => [r.id, r.points]));
  assert.deepEqual(by.d, { R: 4, ERA: 2.5 }, "most runs; ERA tied with a for 2nd and 3rd");
  assert.deepEqual(by.a, { R: 2.5, ERA: 2.5 }, "runs tied with b for 2nd and 3rd");
  assert.deepEqual(by.b, { R: 2.5, ERA: 1 }, "no innings: last in ERA");
  assert.deepEqual(by.c, { R: 1, ERA: 4 });
  assert.deepEqual(t.map((r) => [r.id, r.total]), [["d", 6.5], ["a", 5], ["c", 5], ["b", 3.5]], "a tie keeps the seats' order");

  // Three seats: the round robin leaves one out each week, to play the middle of the others in each category, or sit out.
  const week = new Map([["a", { R: 5, ERA: 4 }], ["b", { R: 3, ERA: 2 }], ["c", { R: 4, ERA: null }]]);
  const w0 = categoryWeek(week, ["a", "b", "c"], 0, cats, defs);
  const odd = w0.games.find((g) => g.b === null);
  const middle = { R: Seq.median([...week].filter(([id]) => id !== odd.a).map(([, v]) => v.R)) };
  assert.equal(odd.matchup.cats.find((c) => c.stat === "R").b, middle.R, "the others' middle");
  assert.equal(categoryWeek(week, ["a", "b", "c"], 0, cats, defs, { odd: "bye" }).games.find((g) => g.b === null).matchup, null);
  // Records: each category a win, loss or tie; or each matchup to whoever won more categories.
  const played = w0.games.filter((g) => g.b !== null);
  const recCats = categoryRecords([w0], "categories");
  const recWeeks = categoryRecords([w0], "matchups");
  for (const g of played) {
    assert.deepEqual(recCats.get(g.b), { wins: g.matchup.b.wins, losses: g.matchup.b.losses, ties: g.matchup.b.ties });
    assert.equal(sum(Object.values(recWeeks.get(g.b))), 1, "a week is one matchup");
  }
  assert.equal(sum(Object.values(recCats.get(odd.a))), 2, "against the middle: both categories, and nobody's record for the middle");
  // A week nobody has anything: nobody's (skip), or every category tied.
  const quiet = new Map([["a", { R: 0, ERA: null }], ["b", { R: 0, ERA: null }]]);
  assert.equal(categoryWeek(quiet, ["a", "b"], 0, cats, defs).quiet, true);
  assert.equal(categoryWeek(quiet, ["a", "b"], 0, cats, defs).games[0].matchup, null);
  assert.deepEqual(categoryWeek(quiet, ["a", "b"], 0, cats, defs, { quiet: "tie" }).games[0].matchup.a, { wins: 0, losses: 0, ties: 2 });
});

test("the spec: categories on the score, ranked head to head by each one, by most categories or roto; what the check refuses", () => {
  const nba = sportOf("basketball/nba");
  const ctx = specContextOf(nba);
  const d = defaultsFor("basketball");
  const cats = d.specs.categories.spec;
  assert.deepEqual(problems(cats, ctx), []);
  assert.deepEqual(problems(d.specs.roto.spec, ctx), []);
  assert.deepEqual(specWaitsFor(cats).map((w) => w.at), ["rank.by"], "the sports branch's own: the engine's hook scores the stats and locks daily (L3 part 2), the rank still waits");
  const by = (score, rank, more = {}) => ({ ...cats, score: { by: "stats", ...score }, ...(rank ? { rank } : {}), ...more });
  // A categories score's rank when the spec leaves it out: head to head by each category.
  assert.equal(fullSpec({ ...cats, rank: undefined }).rank.by, "categories");
  assert.deepEqual(problems(by({ categories: ["PTS", "REB"] }, { by: "matchups", playoffs: { teams: 4 } }), ctx), [], "most categories, with playoffs");
  assert.deepEqual(problems(by({ categories: ["PTS", "REB"] }, { by: "categories", playoffs: { teams: 4 }, odd: "bye" }), ctx), []);
  const has = (spec, re, c = ctx) => assert.ok(problems(spec, c).some((p) => re.test(p)), `${re} in ${problems(spec, c).join(" | ")}`);
  has(by({ categories: ["PTS"], points: { PTS: 1 } }, { by: "categories" }), /score.categories: A categories game compares each stat's total, not points/);
  has(by({ categories: [] }, { by: "categories" }), /score.categories: Categories are 1 to 20/);
  has(by({ categories: ["PTS", "PTS"] }, { by: "categories" }), /Each category once/);
  has(by({ categories: ["PTS", "XYZ"] }, { by: "categories" }), /score.categories\[1\]: Nothing counts "XYZ"/);
  has(by({ categories: ["PTS"] }, { by: "total" }), /rank.by: A categories game ranks head to head by each category/);
  has(by({ points: { PTS: 1 } }, { by: "roto" }), /rank.by: Ranking by roto compares each stat's total/);
  has(by({ categories: ["PTS"] }, { by: "roto", playoffs: { teams: 4 } }), /rank.playoffs: Playoffs are head to head's/);
  has(by({ categories: ["PTS"] }, { by: "categories" }, { count: { best: 5 } }), /count.best: Best ball counts your best few by their points/);
  has(by({ categories: ["PTS"] }, { by: "categories", handicap: { points: 5 } }), /rank.handicap: A handicap isn't built with categories/);
  has(by({ categories: ["PTS"] }, { by: "roto", cut: [{ at: { every: 2 }, out: 1 }] }), /rank.cut: Nothing races, cuts or knocks anyone out on categories/);
  has(by({ categories: ["PTS"] }, { by: "roto" }, { get: { by: "pick" }, count: { pick: true } }), /get.by: A categories game adds up a drafted team's stats: a draft/);
  const q = { id: "most", ask: "Who has the most points?", answer: "person", points: 5, settle: { by: "stat", stat: "PTS", take: "most" }, asked: "each" };
  has(by({ categories: ["PTS"] }, { by: "categories" }, { ask: [q] }), /^ask: A categories game has no points for questions to add to/);
  // A place is never a category (golf's POS); a rate is one (FG%), though it never scores points.
  const golf = specContextOf(sportOf("golf/pga"));
  const golfCats = { ...defaultsFor("golf").specs.season.spec, score: { by: "stats", categories: ["POS", "BIR"] }, rank: { by: "roto" } };
  has(golfCats, /score.categories\[0\]: POS is a place/, golf);
  has(by({ points: { "FG%": 10 } }, { by: "matchups" }), /Nothing counts "FG%"/);
  // Read the one way.
  assert.deepEqual(categoryParts(cats), { by: "categories", categories: d.categories.stats, odd: "median", quiet: "skip", playoffs: null });
  assert.equal(categoryParts(d.specs.roto.spec).odd, null);
  assert.equal(categoryParts(d.specs.season.spec), null, "points head to head isn't categories");
  assert.equal(matchupParts(by({ categories: ["PTS"] }, { by: "matchups" })), null, "most categories isn't head to head on points");
});

test("the words: the categories with fewer-is-better said, head to head by category, by most categories and roto", () => {
  const ctx = { ...specContextOf(sportOf("basketball/nba")), part: { singular: "game", plural: "games" } };
  const d = defaultsFor("basketball");
  const h2h = describeSpec(d.specs.categories.spec, ctx);
  assert.match(h2h.sentence, /Nine categories: field goal percentage, free throw percentage, three-pointers made, points, rebounds, assists, steals, blocks and turnovers \(fewer is better in turnovers\)\./);
  assert.match(h2h.sentence, /Each game you play one of the others head to head in every category: each one you win is a win\. Most wins at the end wins\./);
  assert.ok(h2h.rules.some((r) => /worked out from what's added up \(made over attempted\), never an average/.test(r)));
  assert.ok(!h2h.sentence.includes("points wins it"), "no points");
  const most = describeSpec({ ...d.specs.categories.spec, rank: { by: "matchups", playoffs: { teams: 4 } } }, ctx);
  assert.match(most.sentence, /whoever wins more categories wins it\. The top four by wins make the playoffs, over the last two games\./);
  assert.ok(most.rules.some((r) => /whoever wins more categories goes through/.test(r)));
  const r = describeSpec(d.specs.roto.spec, ctx);
  assert.match(r.sentence, /Each category ranks everyone on their totals so far, the best earning the most points: most points wins\./);
  assert.ok(r.rules.some((x) => /the best gets as many points as there are of you/.test(x)));
  // Baseball's 5x5: lower is better in ERA and WHIP.
  const mlb = describeSpec(defaultsFor("baseball").specs.roto.spec, specContextOf(sportById("baseball")));
  assert.match(mlb.sentence, /\(lower is better in earned run average and walks and hits per inning\)/, "a rate is lower, a count fewer");
  const nhl = describeSpec(defaultsFor("hockey").specs.categories.spec, specContextOf(sportById("hockey")));
  assert.match(nhl.sentence, /\(lower is better in goals against average\)/);
});

test("head to head's and best ball's default specs on the recorded fixtures: each game's best ten count; more points wins the week", () => {
  const d = defaultsFor("basketball");
  const best = d.specs.bestBall.spec;
  const ctx = specContextOf(sportOf("basketball/nba"));
  assert.deepEqual(problems(best, ctx), []);
  assert.deepEqual(specWaitsFor(best).map((w) => w.at), [], "best ball, its lock and its stats are the engine's now (L3 part 2: the hook)");
  // Every team sport's and golf's best ball: the season's draft and table, its starters' worth counting, no lineups.
  for (const id of ["basketball", "football", "baseball", "hockey", "soccer", "golf"]) {
    const s = defaultsFor(id).specs;
    assert.equal(s.bestBall.spec.get.each, s.season.spec.get.each, id);
    assert.deepEqual(s.bestBall.spec.score, s.season.spec.score, id);
  }
  // The 76ers' opener: a roster of thirteen, the best ten of them by the sequence's line counting.
  const g = game("basketball/nba", "nba-401909093");
  const roster = topBy(g, "MIN", 13).map((p) => p.id);
  const moments = statMoments(g.lines, best.score);
  const raw = Seq.momentRaw(roster, moments);
  const lines = roster.map((id) => ({ id, points: raw.get(id) || 0 }));
  Seq.best(lines, best.count.best);
  const counted = lines.filter((l) => l.counted).map((l) => l.points);
  assert.equal(counted.length, 10);
  const all = lines.map((l) => l.points).sort((x, y) => y - x);
  assert.equal(Seq.episodeTotal(lines, []), Seq.round(sum(all.slice(0, 10))), "the ten most");
  // Head to head (the season spec): two seats, two games (the opener, then the WNBA's final); each game's points decide it.
  const w = game("basketball/wnba", "wnba-401918306");
  const season = d.specs.season.spec;
  const pts = (gm, ids) => Seq.round(sum(statMoments(gm.lines, season.score).filter((m) => ids.includes(m.castawayId)).map((m) => m.points)));
  const [maxey, mitchell] = ["Tyrese Maxey", "Donovan Mitchell"].map((n) => idOf(g, n));
  const [w1, w2] = topBy(w, "PTS", 2).map((p) => p.id);
  const seats = { a: [maxey, w2], b: [mitchell, w1] };
  const series = [];
  let run = { a: 0, b: 0 };
  for (const [n, gm] of [[1, g], [2, w]]) {
    run = { a: Seq.round(run.a + pts(gm, seats.a)), b: Seq.round(run.b + pts(gm, seats.b)) };
    series.push({ number: n, totals: new Map(Object.entries(run)) });
  }
  const walk = Seq.matchups(series, { parts: { odd: "median", quiet: "skip", playoffs: null }, start: 1, from: null, finale: null, ended: false, sides: ["a", "b"], seatsAt: () => ["a", "b"] });
  for (const [i, gm] of [g, w].entries()) {
    const [pa, pb] = [pts(gm, seats.a), pts(gm, seats.b)];
    assert.equal(walk.weeks[i].games[0].result, pa > pb ? "a" : pb > pa ? "b" : "tie", `game ${i + 1}: ${pa} to ${pb}`);
  }
  assert.equal(walk.records.get("a").wins + walk.records.get("b").wins + walk.records.get("a").ties, 2);
});
