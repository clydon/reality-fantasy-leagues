// A game scored by a sport's stats, the spec's way (docs/PLAN-start-a-game-gpt.md track L, L1 part 4a): `score.by: 'stats'` with
// its tables (points each, byPosition, byPlace, byFormat), checked by the game spec's own check (schema.js specProblems) against a
// sport's ctx (specContextOf: its stats, places marked, position groups, bouts' formats, standard roster), and scored by one
// scorer (src/lib/sports/spec.ts) on every shape's lines: a team game's box score as of a moment, a field's standings and places,
// a card's results and a tennis event's matches at their formats. On the recorded fixtures (tests/fixtures/espn/), the numbers the
// sports' own tests worked out by hand. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, sportById, allSports, defaultsFor, specContextOf, linePoints, statePoints, placePoints, placeRange, specCloses } = jiti("../src/lib/sports/index.ts");
const { specProblems, specWaitsFor, placeRange: specPlaceRange } = require("../src/lib/game/game-spec/schema.js");
const { describeSpec } = require("../src/lib/game/game-spec/index.js");
const examples = require("./fixtures/sports-examples.js");

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const nameOf = (box, name) => Object.values(box.people).find((p) => p.name === name).id;
const close = (x, y) => assert.ok(Math.abs(x - y) < 1e-9, `${x} vs ${y}`);
const problems = (spec, ctx) => specProblems(spec, ctx).map((p) => `${p.at}: ${p.problem}`);

// Every sport's defaults, each league's own too (racing's series, college's): [sport, league, defaults].
function everyDefaults() {
  const out = [];
  for (const sport of allSports()) {
    const league = sport.leagues?.[0];
    out.push([sport, league, defaultsFor(sport.id, league)]);
  }
  return out;
}

test("every sport's default specs pass the game spec's own check against the sport, and wait only for the sports branch's pieces", () => {
  for (const [sport, league, d] of everyDefaults()) {
    const ctx = specContextOf(sport, league);
    for (const [name, { spec }] of Object.entries(d.specs)) {
      assert.deepEqual(problems(spec, ctx), [], `${sport.name} ${name}`);
      for (const w of specWaitsFor(spec)) assert.equal(w.step, "sports", `${sport.name} ${name}: ${w.at}`);
      // A game scored by stats carries the sport's table (L4 part 1a's pick'em and pick a few are scored by their answers), or its
      // categories (L4 part 1b's categories and roto).
      if (spec.score.categories) assert.deepEqual(spec.score.categories, d.categories.stats, `${sport.name} ${name}: the sport's categories`);
      else if (spec.score.by === "stats") {
        assert.deepEqual(Object.keys(spec.score).filter((k) => k !== "by" && k !== "points"), Object.keys(d.scoring).filter((k) => k.startsWith("by")), `${sport.name} ${name}: the table's own ways`);
        for (const k of ["byPosition", "byPlace", "byFormat"]) if (d.scoring[k]) assert.deepEqual(spec.score[k], d.scoring[k]);
      }
      assert.ok(["start", specCloses(sport.lock)].includes(spec.closes), `${sport.name} ${name} closes ${spec.closes}`);
    }
    if (d.specs.season) assert.equal(d.specs.season.spec.closes, specCloses(sport.lock), `${sport.name}: a season locks as the sport does`);
  }
});

test("a sport's ctx: its stats with places marked, its position groups, its bouts' formats and its standard roster", () => {
  const golf = specContextOf(sportOf("golf/pga"));
  assert.deepEqual(golf.stats.filter((s) => s.place).map((s) => s.key), ["POS"]);
  assert.deepEqual(golf.formats, []);
  assert.ok(golf.positions.length, "golf's golfers");
  const f1 = specContextOf(sportOf("racing/f1"));
  for (const k of ["POS", "FIN", "GRID", "SPR", "QUAL"]) assert.ok(f1.stats.find((s) => s.key === k).place, k);
  assert.ok(!f1.stats.find((s) => s.key === "PG").place, "places gained is a count");
  assert.deepEqual(f1.sizes, { starters: 5, bench: 0 }, "F1's own roster");
  assert.deepEqual(specContextOf(sportById("tennis")).formats, [{ key: "3", label: "3 sets" }, { key: "5", label: "5 sets" }]);
  assert.deepEqual(specContextOf(sportById("mma")).formats.map((f) => f.label), ["3 rounds", "5 rounds"]);
  assert.deepEqual(specContextOf(sportById("soccer")).positions.map((g) => g.key), ["GK", "DEF", "MID", "FWD"]);
  assert.deepEqual(specContextOf(sportById("baseball")).sizes, { starters: 18, bench: 5 });
  assert.equal(specCloses("event"), "start");
  assert.equal(specCloses("daily"), "daily");
  assert.equal(specCloses("weekly"), "weekly");
});

test("the check: a sport's roster raises a show's sizes, and only as far as the sport's", () => {
  const season = defaultsFor("baseball").specs.season.spec;
  const ctx = specContextOf(sportById("baseball"));
  assert.ok(problems(season, { stats: ctx.stats }).some((p) => /A draft is 1 to 14 each/.test(p)), "a show's limits without the sport's roster");
  assert.deepEqual(problems(season, ctx), []);
  assert.ok(problems({ ...season, get: { ...season.get, each: 30 } }, ctx).some((p) => /A draft is 1 to 24 each/.test(p)));
  assert.ok(problems({ ...season, count: { start: 20 } }, ctx).some((p) => /A lineup starts 1 to 18/.test(p)));
});

test("the check: a place scores only by place, its ranges once each; a position is the sport's; a format a bout's", () => {
  const golf = specContextOf(sportOf("golf/pga"));
  const by = (score) => ({ spec: 1, get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, count: { all: true }, score: { by: "stats", ...score }, rank: { by: "total" } });
  assert.deepEqual(problems(by({ points: { BIR: 3 }, byPlace: { POS: { 1: 25, "4-10": 8 } } }), golf), []);
  assert.ok(problems(by({ points: { POS: 25 } }), golf).includes('score.points.POS: POS is a place: score it by place (byPlace)'));
  assert.ok(problems(by({ byPlace: { BIR: { 1: 3 } } }), golf).includes("score.byPlace.BIR: BIR isn't a place: score it in points"));
  assert.ok(problems(by({ byPlace: { POS: { "1-5": 10, "4-10": 8 } } }), golf).includes("score.byPlace.POS: Each place scores once: the ranges overlap"));
  assert.ok(problems(by({ byPlace: { POS: { top: 10 } } }), golf).some((p) => /"top" isn't a place/.test(p)));
  assert.ok(problems(by({ points: { POS: 1 }, byPlace: { POS: { 1: 25 } } }), golf).includes("score.points.POS: POS scores by its place: leave it out of points"));
  assert.ok(problems(by({}), golf).includes("score.points: Stats score as stat key to points: name one"));
  assert.ok(problems(by({ points: { XYZ: 1 } }), golf).some((p) => /Nothing counts "XYZ"/.test(p)));
  const soccer = specContextOf(sportById("soccer"));
  assert.deepEqual(problems(by({ points: { G: 5 }, byPosition: { G: { GK: 10, FWD: 4 } } }), soccer), []);
  assert.ok(problems(by({ points: { G: 5 }, byPosition: { G: { STRIKER: 4 } } }), soccer).some((p) => /"STRIKER" isn't one of the sport's positions: GK, DEF, MID, FWD/.test(p)));
  assert.ok(problems(by({ points: { G: 5 }, byFormat: { 5: { G: 6 } } }), soccer).includes("score.byFormat.5: Only a bout has a format to score by"));
  const tennis = specContextOf(sportById("tennis"));
  assert.deepEqual(problems(by({ points: { GW: 2.5 }, byFormat: { 5: { GW: 2 } } }), tennis), []);
  assert.ok(problems(by({ points: { GW: 2.5 }, byFormat: { 7: { GW: 2 } } }), tennis).includes("score.byFormat.7: A bout here is scheduled for 3 or 5"));
  assert.deepEqual(problems(by({ byFormat: { 5: { W: 5 } } }), tennis), [], "a table by format alone scores");
  // Without a sport (a show's ctx), nothing counts a stat.
  assert.ok(problems(by({ points: { BIR: 3 } }), { moments: [] }).some((p) => /Nothing counts "BIR"/.test(p)));
  // The two placeRanges agree.
  for (const k of ["1", "4-10", "10-4", "0", "x", "3-3"]) assert.deepEqual(placeRange(k), specPlaceRange(k), k);
});

test("a place's points: the place's or its range's, the tied each the place's, none out of the places", () => {
  const t = { 1: 25, 2: 12, 3: 10, "4-10": 8, "11-20": 3 };
  assert.deepEqual([1, 2, 3, 4, 10, 11, 20, 21, null].map((p) => placePoints(t, p)), [25, 12, 10, 8, 8, 3, 3, 0, 0]);
  // A line's places and counts together; a position's points in place of the flat ones; a format's for a bout of it.
  const score = { points: { BIR: 3.5, G: 5 }, byPlace: { POS: t }, byPosition: { G: { FWD: 4 } }, byFormat: { 5: { BIR: 2 } } };
  assert.deepEqual(linePoints(score, { BIR: 4, POS: 9 }), { points: 22, parts: [{ stat: "BIR", value: 4, points: 14 }, { stat: "POS", value: 9, points: 8 }] });
  assert.equal(linePoints(score, { G: 2 }, { group: "FWD" }).points, 8);
  assert.equal(linePoints(score, { G: 2 }, { group: "GK" }).points, 10, "a group the table leaves out at the flat points");
  assert.equal(linePoints(score, { BIR: 4 }, { format: 5 }).points, 8);
  assert.equal(linePoints(score, { BIR: 4 }, { format: 3 }).points, 14, "a format the table leaves out at the flat points");
});

test("team sports: the Red Sox-Yankees series scored from the plays' lines, as the user typed it", () => {
  const ex = examples.redSoxYankees;
  const baseball = sportById("baseball");
  const totals = new Map();
  for (const f of ex.recorded) {
    const game = require(`./fixtures/${f}`);
    const box = baseball.readBox(game);
    for (const [id, s] of Object.entries(statePoints(baseball, ex.spec.score, baseball.reduce(baseball.timeline(game))))) {
      const t = totals.get(id) ?? { name: box.people[id].name, points: 0 };
      t.points += s.points;
      totals.set(id, t);
    }
  }
  const best = [...totals.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)).slice(0, ex.settles.best.length);
  assert.deepEqual(best.map((b) => [b.name, b.points]), ex.settles.best.map((b) => [b.name, b.points]));
});

test("team sports: soccer by position (FPL's goal and clean sheet), a game's box at a moment and at the end", () => {
  const soccer = sportOf("soccer/eng.1");
  const game = require("./fixtures/espn/epl-401878767.json");
  const box = soccer.readBox(game);
  const groupOf = (id) => soccer.position(box.people[id]?.position)?.group ?? null;
  const score = defaultsFor("soccer").specs.season.spec.score;
  const end = statePoints(soccer, score, soccer.stateAt(game), { groupOf });
  // Tel (a midfielder): played, 60 minutes, a goal at a midfielder's 5, a clean sheet at a midfielder's 1.
  assert.deepEqual(end[nameOf(box, "Mathys Tel")], { points: 8, parts: [{ stat: "APP", value: 1, points: 1 }, { stat: "MIN60", value: 1, points: 1 }, { stat: "G", value: 1, points: 5 }, { stat: "CS", value: 1, points: 1 }] });
  // Kinsky (a keeper): a keeper's clean sheet, 4.
  assert.equal(end[nameOf(box, "Antonín Kinsky")].points, 1 + 1 + 4 + 1);
  assert.equal(end[nameOf(box, "Andy Robertson")].points, 1 + 1 + 4, "a defender's clean sheet");
  // At half-time nobody has 60 minutes yet, so nobody has the point for them.
  const plays = soccer.timeline(game);
  const second = plays.find((p) => p.period === 2);
  const half = statePoints(soccer, score, soccer.stateAt(game, second.at), { groupOf });
  assert.ok(Object.values(half).every((s) => !s.parts.some((p) => p.stat === "MIN60")));
});

test("fields: racing's places by place (Byron's Daytona 500, Piastri's and Hamilton's Chinese Grand Prix), golf's tied places", () => {
  const cup = sportOf("racing/nascar-premier");
  const f1 = sportOf("racing/f1");
  const DAYTONA = require("./fixtures/espn/nascar-premier-202502160001.json");
  const CHINA = require("./fixtures/espn/f1-600052046.json");
  const scoreOf = (sport) => defaultsFor(sport.id, sport.leagues[0]).specs.season.spec.score;
  const at = (sport, a, name) => statePoints(sport, scoreOf(sport), sport.stateAt(a))[nameOf(sport.readBox(a), name)].points;
  assert.equal(at(cup, DAYTONA, "William Byron"), 45 + 4 + 2.5);
  assert.equal(at(f1, CHINA, "Oscar Piastri"), 25 + 7 + 10);
  assert.equal(at(f1, CHINA, "Lewis Hamilton"), 8 + 5 + 6 - 20);

  const golf = sportOf("golf/pga");
  const BERMUDA = require("./fixtures/espn/pga-401850917.json");
  const d = defaultsFor("golf");
  const state = golf.stateAt(BERMUDA);
  const pts = statePoints(golf, d.specs.season.spec.score, state);
  const pos = d.scoring.byPlace.POS;
  const place = (p) => (p == null ? 0 : p <= 3 ? pos[p] : p <= 10 ? pos["4-10"] : p <= 20 ? pos["11-20"] : 0);
  for (const s of state.standings) {
    const line = state.lines[s.id] ?? {};
    close(pts[s.id]?.points ?? 0, Math.round((sum(Object.entries(d.scoring.points).map(([k, v]) => (line[k] ?? 0) * v)) + place(s.place)) * 100) / 100);
  }
  const tied = state.standings.filter((s) => s.tied && s.place <= 10);
  assert.ok(tied.length >= 2, "a tie in the top ten to read");
  for (const s of tied) assert.equal(pts[s.id].parts.find((p) => p.stat === "POS").points, place(s.place), "the tied each take the place's points");
});

test("cards: MMA's results (Gaethje's decision), and tennis's matches each at their format (Zverev's US Open final, best of five)", () => {
  const mma = sportOf("mma/ufc");
  const UFC324 = require("./fixtures/espn/ufc-600057024.json");
  const fight = statePoints(mma, defaultsFor("mma").specs.season.spec.score, mma.stateAt(UFC324));
  close(fight[nameOf(mma.readBox(UFC324), "Justin Gaethje")].points, Math.round((0.2 * 200 + 0.2 * 144 + 0.03 * 355 + 5 * 3 + 10 * 2 + 30) * 100) / 100);

  const tennis = sportOf("tennis/atp");
  const USOPEN = require("./fixtures/espn/atp-189-2026.json");
  const d = defaultsFor("tennis");
  const score = d.specs.season.spec.score;
  const card = tennis.card(USOPEN);
  const state = tennis.stateAt(USOPEN);
  const pts = statePoints(tennis, score, state, { card });
  const box = tennis.readBox(USOPEN);
  const final = (draw) => card.bouts.find((b) => b.place.draw === draw && b.place.fromFinal === 1);
  const men = final("mens-singles");
  const zverev = nameOf(box, "Alexander Zverev");
  const inFinal = sum(pts[zverev].parts.filter((p) => p.bout === men.id).map((p) => p.points));
  assert.equal(Math.round(inFinal * 10) / 10, 66.7);
  // His whole event: each match at its own format, and what the card's line has besides at the flat points.
  const each = sum(card.bouts.filter((b) => state.byBout[b.id]?.[zverev]).map((b) => linePoints(score, state.byBout[b.id][zverev], { format: b.rounds }).points));
  close(pts[zverev].points, Math.round(sum(pts[zverev].parts.map((p) => p.points)) * 100) / 100);
  assert.ok(Math.abs(pts[zverev].points - each) < 0.05, `${pts[zverev].points} vs ${each}`);
});

test("a stats score in words: each stat's points, a position's own, each place's and a format's", () => {
  const words = (sport, spec) => describeSpec(spec, specContextOf(sport)).rules.find((r) => r.startsWith("Points come from their stats"));
  const soccer = words(sportById("soccer"), defaultsFor("soccer").specs.season.spec);
  assert.match(soccer, /5 a goal \(10 for goalkeepers, 6 for defenders and 4 for forwards\)/);
  assert.match(soccer, /1 a clean sheet \(4 for goalkeepers, 4 for defenders and 0 for forwards\)/);
  const golf = words(sportOf("golf/pga"), defaultsFor("golf").specs.season.spec);
  assert.match(golf, /; by place: 25 for 1st, 12 for 2nd, 10 for 3rd, 8 for 4th–10th and 3 for 11th–20th\.$/);
  const tennis = words(sportById("tennis"), defaultsFor("tennis").specs.season.spec);
  assert.match(tennis, /; scheduled for 5 sets: 30 a match played, 2 a game won/);
  // Scored by place alone, it still says so.
  const only = { ...defaultsFor("golf").specs.short.spec, score: { by: "stats", byPlace: { POS: { 1: 10 } } } };
  assert.match(words(sportOf("golf/pga"), only), /^Points come from their stats: by place: 10 for 1st\.$/);
});

test("a card scored by its bouts' formats needs the card: without it the scorer says so, never scores every bout as the usual", () => {
  const tennis = sportOf("tennis/atp");
  const USOPEN = require("./fixtures/espn/atp-189-2026.json");
  const score = defaultsFor("tennis").specs.season.spec.score;
  assert.throws(() => statePoints(tennis, score, tennis.stateAt(USOPEN)), /needs the card/);
  const flat = { ...score, byFormat: undefined };
  const state = tennis.stateAt(USOPEN);
  for (const [id, s] of Object.entries(statePoints(tennis, flat, state))) close(s.points, linePoints(flat, state.lines[id]).points);
});
