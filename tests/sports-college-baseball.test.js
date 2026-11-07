// College baseball (src/lib/sports/college-baseball.ts's CollegeBaseball, on Baseball's vocabulary; docs/PLAN-start-a-game-gpt.md
// track L, step L5 part 2c): ESPN's college box (names without the " - P " some carry, no pitches seen), its two feeds (the
// postseason's, every pitch a play as the MLB's, and the regular season's stat crew, an at-bat a start and a result whose text
// is the official scorer's), the crew's clock put right, and the proof: each recorded game's plays, reduced, come to ESPN's own
// box score. The recorded games (tests/fixtures/espn/, by scripts/dev-test/record-espn.js): the 2026 College World Series
// final's Game 3 (Oklahoma 13, North Carolina 2), Georgia 26 at Arkansas 14, and LSU at Ole Miss, 12-2 in seven innings. The
// same proof against many real games is scripts/dev-test/check-sport-reduce.js --league=baseball/college-baseball --pbp
// --apart=PC,PST. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, sportById, defaultsFor, allSports, Baseball, CollegeBaseball } = jiti("../src/lib/sports/index.ts");
const { boxName, crewClauses, crewNameFit, crewOutcome, crewPitches, crewTimes, typeSlug } = jiti("../src/lib/sports/college-baseball.ts");
const { movedBy } = jiti("../src/lib/sports/baseball.ts");

const college = sportOf("baseball/college-baseball");
const CWS = require("./fixtures/espn/college-baseball-401874453.json");
const ARKANSAS = require("./fixtures/espn/college-baseball-401847137.json");
const SEVEN = require("./fixtures/espn/college-baseball-401847368.json");
const GAMES = [CWS, ARKANSAS, SEVEN];
const nameOf = (box, name) => Object.values(box.people).find((p) => p.name === name);
const byName = (box, deltas) => Object.fromEntries(Object.entries(deltas).map(([id, d]) => [box.people[id]?.name ?? id, d]));

test("college baseball: Baseball's vocabulary on its own league, nine innings, daily locks; the MLB's still the sport's own", () => {
  assert.ok(college instanceof CollegeBaseball && college instanceof Baseball);
  assert.ok(allSports().includes(college));
  assert.equal(college.id, "baseball", "ESPN's sport slug: the defaults are baseball's");
  assert.equal(college.name, "College baseball");
  assert.deepEqual(college.leagues, ["college-baseball"]);
  assert.ok(!(sportById("baseball") instanceof CollegeBaseball), "the sport's own is the MLB's");
  assert.equal(sportOf("baseball/mlb"), sportById("baseball"));
  assert.notEqual(sportOf("baseball/mlb"), college);
  assert.deepEqual(college.stats.map((s) => s.key), sportById("baseball").stats.map((s) => s.key), "the same stat keys");
  assert.deepEqual(college.periods, sportById("baseball").periods);
  assert.equal(college.where({ period: 8, half: "top", clock: null }), "Top 8th");
  assert.equal(college.lock, "daily");
});

test("college's defaults are baseball's: every position a college box gives fills a default slot", () => {
  const d = defaultsFor(college.id);
  const box = college.readBox(ARKANSAS);
  const groupOf = (pos) => college.position(pos)?.group;
  for (const p of Object.values(box.people)) {
    assert.ok(p.position, p.name);
    assert.ok(d.slots.lineup.some((s) => s.takes.includes(p.position) || s.takes.includes(groupOf(p.position))), `${p.name}: ${p.position}`);
  }
});

test("ESPN's college box: names without their position, no pitches seen, a team's pitches from its own total", () => {
  assert.equal(boxName("Hunter - P Elliott"), "Hunter Elliott");
  assert.equal(boxName("Jean-Paul Smith"), "Jean-Paul Smith");
  const raw = CWS.boxscore.players.flatMap((s) => s.statistics.flatMap((t) => t.athletes.map((a) => a.athlete.displayName)));
  assert.ok(raw.includes("Walker - P McDuffie"), "as ESPN has it");
  const box = college.readBox(CWS);
  assert.ok(nameOf(box, "Walker McDuffie"));
  assert.ok(!Object.values(box.people).some((p) => / - /.test(p.name)));
  // #P is 0 for everyone in a college box (the team's too): said by nobody, so the plays' own pitches seen stand.
  assert.ok(raw.length && CWS.boxscore.players.every((s) => s.statistics.filter((t) => t.type === "batting").every((t) => t.athletes.every((a) => a.stats[t.labels.indexOf("#P")] === "0"))));
  for (const p of Object.values(box.people)) assert.ok(!("NP" in p.stats), p.name);
  for (const t of box.teams) {
    for (const k of ["NP", "GIDP", "SF", "SH"]) assert.ok(!(k in t.stats), `${t.abbreviation} ${k}: always 0 in a college box`);
    const sum = Object.values(box.people).filter((p) => p.team === t.id).reduce((n, p) => n + (p.stats.PC ?? 0), 0);
    assert.equal(t.stats.PC, sum, `${t.abbreviation}: its pitchers' pitches ("pitches", not "pitchCount", which is 0)`);
  }
  assert.deepEqual(nameOf(box, "Walker McDuffie").stats, { GS: 0, W: 0, L: 0, SV: 0, HLD: 0, BS: 0, OUTS: 2, PH: 1, PR: 3, ER: 3, PBB: 3, PK: 1, PHR: 0, PC: 25, PST: 10 });
});

test("the proof, all three recorded games: the plays alone reduce to ESPN's own box score, every team total and the score", () => {
  for (const game of GAMES) {
    const box = college.readBox(game);
    const plays = college.readPlays(game);
    const state = college.reduce(plays);
    let compared = 0;
    // ESPN's box and its own plays disagree by a pitch now and then (the CWS game: one of LJ Mercurius's, as the team's).
    const apart = [];
    for (const p of Object.values(box.people)) {
      for (const [k, v] of Object.entries(p.stats)) {
        // A pitcher's win, loss or save: only the final knows (its correction).
        if (college.stat(k).known === "final") continue;
        compared++;
        if ((state.lines[p.id]?.[k] ?? 0) === v) continue;
        if (k === "PC" || k === "PST") apart.push(`${p.name} ${k}`);
        else assert.equal(state.lines[p.id]?.[k] ?? 0, v, `${game.header.id} ${p.name} ${k}`);
      }
    }
    assert.ok(compared >= 200, `${game.header.id}: ${compared} numbers compared`);
    assert.deepEqual(apart, game === CWS ? ["LJ Mercurius PC"] : [], `${game.header.id}: pitch counts`);
    for (const id of Object.keys(state.lines)) assert.ok(box.people[id], `${game.header.id}: ${id} is in the box`);
    for (const t of box.teams) {
      const sum = {};
      for (const p of Object.values(box.people)) {
        if (p.team !== t.id) continue;
        for (const [k, v] of Object.entries(college.full(state.lines[p.id] ?? {}))) sum[k] = (sum[k] ?? 0) + v;
      }
      for (const [k, v] of Object.entries(t.stats)) if (!(game === CWS && k === "PC" && t.abbreviation === "OU")) assert.equal(sum[k] ?? 0, v, `${game.header.id} ${t.abbreviation} ${k}`);
      assert.equal(state.score[t.id], t.score, `${game.header.id} ${t.abbreviation}'s score`);
    }
  }
});

test("the postseason feed is the MLB's shape on Baseball's reader: types by their text, the text's runners when ESPN's count says fewer", () => {
  assert.equal(typeSlug("Strike Looking - Overturned"), "strike-looking---overturned");
  assert.equal(typeSlug("Start Batter/Pitcher"), "start-batterpitcher");
  assert.ok(CWS.plays.some((p) => p.summaryType === "P") && CWS.plays.every((p) => !p.type?.type), "no slug in college's types");
  const box = college.readBox(CWS);
  const notes = [];
  const plays = college.readPlays(CWS, notes);
  // ESPN's scoreValue says 1 here, the score 6-1 after it; its box has both runs (Camden Johnson's 1 run).
  const willits = plays.find((p) => /^J\. Willits singled to right, J\. Walk and C\. Johnson scored/.test(p.text));
  assert.deepEqual(byName(box, willits.deltas), { "Jaxon Willits": { PA: 1, AB: 1, H: 1, RBI: 2 }, "Jason Walk": { R: 1 }, "Camden Johnson": { R: 1 }, "Walker McDuffie": { PR: 2, ER: 2 }, "Caden Glauber": { PH: 1 } });
  assert.deepEqual(notes, [`${willits.id}: 1 run(s), read 2 scoring: ${willits.text}`]);
  assert.equal(plays.filter((p) => p.kind === "pitching-change").length, 9, "each relief pitcher (ESPN's text keeps the box's \"- P\")");
});

test("the stat crew's text: clauses, the batter's outcome, pitches from the letters, names as the crew writes them", () => {
  assert.deepEqual(crewClauses("Martin doubled to left field, RBI (2-0 BB); Levu advanced to third; West scored."), [
    { name: "Martin", rest: "doubled to left field, RBI (2-0 BB)" },
    { name: "Levu", rest: "advanced to third" },
    { name: "West", rest: "scored" },
  ]);
  assert.deepEqual(crewClauses("Fralick, C. intentionally walked (2-0 BB)."), [{ name: "Fralick, C.", rest: "intentionally walked (2-0 BB)" }]);
  assert.deepEqual(crewClauses("BURRESS grounded out to ss (0-0); KERCE no advance."), [
    { name: "BURRESS", rest: "grounded out to ss (0-0)" },
    { name: "KERCE", rest: "no advance" },
  ]);
  assert.deepEqual(crewClauses("UK mound visit."), [{ name: "", rest: "UK mound visit" }]);
  const outcomes = {
    "singled up the middle, 2 RBI (2-2 BBSK)": "single",
    "doubled down the lf line (0-0)": "double",
    "homered to left field, 3RBI (1-0 B)": "home-run",
    "walked (3-1 BBFBB)": "walk",
    "intentionally walked (0-0)": "intentional-walk",
    "hit by pitch (1-1 BS)": "hit-by-pitch",
    "struck out swinging, reached first on a wild pitch (1-2 KSBS)": "strikeout",
    "flied out to cf, SF, RBI (2-2 FKBBF)": "sac-fly",
    "grounded out to p, SAC, bunt (1-1 BS)": "sac-bunt",
    "sacrifice bunt to the pitcher, p to 1b (0-0)": "sac-bunt",
    "grounded into double play ss to 2b to 1b (1-1 BK)": "double-play",
    "reached on a fielder's choice (3-2 BKBSBF)": "fielders-choice",
    "reached on a fielding error by ss (0-0)": "error",
    "out on batter's interference (2-1 BBS)": "out",
    "reached on catcher's interference (0-0)": "interference",
    "popped up to 2b (0-0)": "out",
  };
  for (const [rest, want] of Object.entries(outcomes)) assert.equal(crewOutcome(rest), want, rest);
  // The letters are every pitch but a ball put in play or a hit batter; a strikeout's and a walk's include their last.
  assert.deepEqual(crewPitches("struck out swinging (3-2 KBSBFBS)", "strikeout"), { pitches: 7, strikes: 4 });
  assert.deepEqual(crewPitches("singled (1-1 BK)", "single"), { pitches: 3, strikes: 2 });
  assert.deepEqual(crewPitches("homered (0-0)", "home-run"), { pitches: 1, strikes: 1 });
  assert.deepEqual(crewPitches("hit by pitch (2-0 BB)", "hit-by-pitch"), { pitches: 3, strikes: 0 });
  assert.deepEqual(crewPitches("walked (3-1 BBFBB)", "walk"), { pitches: 5, strikes: 1 });
  assert.deepEqual(crewPitches("intentionally walked (0-0)", "intentional-walk"), { pitches: 0, strikes: 0 }, "signalled");
  assert.deepEqual(crewPitches("intentionally walked (3-0 BBB)", "intentional-walk"), { pitches: 3, strikes: 0 });
  assert.equal(crewPitches("struck out swinging.", "strikeout"), null, "no letters: nothing to count");
  // Names, as the crew writes them, against the box's.
  const fits = [
    ["Brayden Mart", "Brayden Martin"],
    ["Nate Hawton-", "Nate Hawton-Henley"],
    ["Paul Jones I", "Paul Jones Ii"],
    ["West", "Dean West"],
    ["Martin,Brayden", "Brayden Martin"],
    ["Valincius, V", "Vytas Valincius"],
    ["Allen, He.", "Henry Allen"],
    ["Duplantier J", "Jake Duplantier"],
    ["TarpleyJr,Derrick", "Derrick Tarpley Jr."],
    ["Pack Jr.", "Aidan Pack Jr."],
    ["S. Campbell", "Scott Campbell Jr."],
    ["OShaughnessy", "Michael O'Shaughnessy"],
    ["Webb,KutterGage", "Kutter-Gage Webb"],
    ["Rasmu,Cooper", "Cooper Rasmussen"],
    ["M,ILGENFRITZ", "Mason Ilgenfritz"],
    ["PURIFY", "Jarren Purify"],
  ];
  for (const [text, box] of fits) assert.ok(crewNameFit(text, box) > 0, `${text} is ${box}`);
  for (const [text, box] of [["West", "Dean Weston"], ["Martin,Brayden", "Brayden Marsh"], ["S. Campbell", "Tom Campbell"], ["Rasmu,Cooper", "Tyler Rasmussen"], ["James", "James Nunnallee"]]) assert.equal(crewNameFit(text, box), 0, `${text} isn't ${box}`);
  assert.ok(crewNameFit("Brayden Mart", "Brayden Martin") > crewNameFit("Martin", "Brayden Martin"), "a fuller name is surer");
});

test("the stat crew's plays: the scorer's RBIs and unearned runs, pitches from the letters, runs charged to whoever put the runner on", () => {
  const box = college.readBox(ARKANSAS);
  const notes = [];
  const plays = college.readPlays(ARKANSAS, notes);
  assert.deepEqual(notes, []);
  const at = (re) => plays.find((p) => re.test(p.text));
  // Two runners in, one each pitcher's: Helfrick was Grant Edwards's, Ruiz Paul Farley's.
  assert.deepEqual(byName(box, at(/^Niu singled up the middle, 2 RBI/).deltas), { "Maika Niu": { PA: 1, AB: 1, H: 1, RBI: 2, NP: 5 }, "Paul Farley": { PH: 1, PC: 5, PST: 3, PR: 1, ER: 1 }, "Ryder Helfrick": { R: 1 }, "Damian Ruiz": { R: 1 }, "Grant Edwards": { PR: 1, ER: 1 } });
  // "unearned", the scorer's word.
  assert.deepEqual(byName(box, at(/^OShaughnessy singled to right field/).deltas), { "Michael O'Shaughnessy": { PA: 1, AB: 1, H: 1, RBI: 2, NP: 3 }, "Gabe Gaeckle": { PH: 1, PC: 3, PST: 3, PR: 2 }, "Daniel Jackson": { R: 1 }, "Tre Phelps": { R: 1 } });
  assert.deepEqual(byName(box, at(/^OShaughnessy homered to right field, 4 RBI/).deltas)["Peyton Lee"], { PH: 1, PHR: 1, PC: 1, PST: 1, PR: 4, ER: 3 });
  // A runner's play in the middle of an at-bat, a result of its own.
  const wild = at(/^Phelps advanced to second on a wild pitch; Branch scored on a wild pitch, unearned/);
  assert.equal(wild.kind, "runners");
  assert.deepEqual(byName(box, wild.deltas), { "Kolby Branch": { R: 1 }, "Colin Fisher": { PR: 1 } });
  assert.deepEqual(byName(box, at(/^Niu stole second/).deltas), { "Maika Niu": { SB: 1 } });
  assert.equal(at(/pinch hit for/).kind, "substitution");
});

test("the stat crew's clock: 12 hours early read as morning, put right by the scheduled start, at noon, past midnight, after a suspension", () => {
  const play = (wallclock, summaryType = "N") => ({ wallclock, summaryType });
  const at = (start, stamps) => crewTimes(stamps.map((s) => (typeof s === "string" ? play(s) : s)), start);
  // A 7 PM Eastern game: every stamp 12 hours early.
  assert.deepEqual(at("2026-04-11T23:00Z", ["2026-04-11T11:02:00Z", "2026-04-11T12:30:00Z", "2026-04-11T14:05:00Z"]), ["2026-04-11T23:02:00Z", "2026-04-12T00:30:00Z", "2026-04-12T02:05:00Z"]);
  // Noon Eastern: the noon hour's stamps are right, then 1 PM reads as 1 AM.
  assert.deepEqual(at("2026-04-11T16:00Z", ["2026-04-11T16:04:00Z", "2026-04-11T16:55:00Z", "2026-04-11T05:10:00Z"]), ["2026-04-11T16:04:00Z", "2026-04-11T16:55:00Z", "2026-04-11T17:10:00Z"]);
  // A Pacific game's too: 12 hours, its stamps Eastern (California's 24 games).
  assert.deepEqual(at("2026-04-12T02:00Z", ["2026-04-11T14:03:00Z"]), ["2026-04-12T02:03:00Z"]);
  // Suspended at night, resumed the next afternoon: not at 2 in the morning.
  assert.deepEqual(at("2026-05-15T23:30Z", ["2026-05-15T11:33:00Z", "2026-05-15T13:50:00Z", "2026-05-16T06:02:00Z"]), ["2026-05-15T23:33:00Z", "2026-05-16T01:50:00Z", "2026-05-16T18:02:00Z"]);
  // Past midnight: "12:15" on the new date reads as noon, 12 hours late; 1 AM as itself.
  assert.deepEqual(at("2026-04-11T23:00Z", ["2026-04-11T11:02:00Z", "2026-04-11T15:50:00Z", "2026-04-12T16:15:00Z", "2026-04-12T05:00:00Z"]), ["2026-04-11T23:02:00Z", "2026-04-12T03:50:00Z", "2026-04-12T04:15:00Z", "2026-04-12T05:00:00Z"]);
  // A late start is read late, not as an hour earlier somewhere else: the crew's clock is Eastern wherever the game is.
  assert.deepEqual(at("2026-04-12T00:00Z", ["2026-04-11T12:45:00Z"]), ["2026-04-12T00:45:00Z"]);
  // An "End Inning" filed with the next day's time doesn't move the clock: it's at the clock's time.
  assert.deepEqual(at("2026-04-11T23:00Z", ["2026-04-11T11:02:00Z", play("2026-04-12T16:00:00Z", null), "2026-04-11T11:40:00Z"]), ["2026-04-11T23:02:00Z", "2026-04-11T23:02:00Z", "2026-04-11T23:40:00Z"]);
  // The recorded games: the first play at the scheduled start, the last within the game.
  for (const game of [ARKANSAS, SEVEN]) {
    const plays = college.readPlays(game);
    const start = Date.parse(game.header.competitions[0].date);
    const first = Date.parse(plays[0].at);
    const last = Date.parse(plays[plays.length - 1].at);
    assert.ok(first >= start && first - start < 15 * 60e3, `${game.header.id}: starts at ${plays[0].at}`);
    assert.ok(last - first > 2 * 3600e3 && last - first < 5 * 3600e3, `${game.header.id}: ${(last - first) / 3600e3} hours`);
  }
});

test("college's own rules: seven innings by the run rule, extra innings with no runner on second", () => {
  assert.equal(SEVEN.header.competitions[0].status.type.detail, "Final/7");
  const plays = college.readPlays(SEVEN);
  assert.equal(Math.max(...plays.map((p) => p.period)), 7);
  const end = college.stateAt(SEVEN);
  assert.deepEqual(end.score, { 92: 12, 85: 2 }, "Ole Miss 12, LSU 2: ten runs ahead after seven");
  assert.equal(college.where(end.last), "Top 7th", "the home side leading, its seventh not played");
  // Extra innings start with the bases empty (every one in ESPN's data), so a runner on second nobody put on in the tenth is the
  // reader's miss, not the MLB's runner on second: his run is earned, as any other (the MLB's reader has it unearned).
  const P = (id, summaryType, typeText, text, extra = {}) => ({ id, summaryType, type: { text: typeText, type: typeSlug(typeText) }, text, period: { type: "Top", number: 10 }, wallclock: "2026-06-23T02:00:00Z", ...extra });
  const part = (list) => list.map(([type, id]) => ({ type, athlete: { id } }));
  const game = made([]);
  game.plays = [
    P("i", "I", "Start Inning", "Top of the 10th inning"),
    P("a", "A", "Start Batter/Pitcher", "pitches to", { atBatId: "ab", participants: part([["pitcher", "zt-p2"], ["batter", "zt-b1"], ["onSecond", "zt-b2"]]) }),
    P("p", "P", "Single", "Pitch 1", { atBatId: "ab", atBatPitchNumber: 1, participants: part([["pitcher", "zt-p2"], ["batter", "zt-b1"]]) }),
    P("r", "S", "Play Result", "A. Hit singled to left, B. Walker scored.", { atBatId: "ab", atBatPitchNumber: 1, scoreValue: 1, outs: 0, participants: part([["pitcher", "zt-p2"], ["batter", "zt-b1"], ["onFirst", "zt-b1"]]) }),
  ];
  const box = college.readBox(game);
  const run = (sport) => byName(box, sport.readPlays(game).find((p) => p.id === "r").deltas)["Pat Throw"];
  assert.deepEqual(run(college), { PH: 1, PR: 1, ER: 1 });
  assert.deepEqual(run(sportById("baseball")), { PH: 1, PR: 1 }, "the MLB's: unearned");
});

test("a game as of a moment, and the final's correction: what only the final knows, ESPN's own pitch counts; none live", () => {
  const plays = college.readPlays(ARKANSAS);
  const fifth = plays.find((p) => p.text === "Bottom of the 5th inning");
  assert.deepEqual(college.stateAt(ARKANSAS, fifth.at).score, { 58: 9, 78: 11 });
  assert.deepEqual(college.stateAt(ARKANSAS, Date.parse(plays[0].at) - 1).score, { 58: 0, 78: 0 }, "0-0 before the first play");
  for (const game of GAMES) {
    const box = college.readBox(game);
    const correction = college.correction(college.reduce(college.readPlays(game)), box);
    for (const [who, d] of Object.entries(correction)) for (const k of Object.keys(d)) assert.ok(college.stat(k).known === "final" || (game === CWS && k === "PC"), `${game.header.id} ${box.people[who].name} ${k}`);
    const end = college.reduce(college.timeline(game));
    for (const p of Object.values(box.people)) for (const [k, v] of Object.entries(p.stats)) assert.equal(end.lines[p.id]?.[k] ?? 0, v, `${game.header.id} ${p.name} ${k}`);
  }
  const live = JSON.parse(JSON.stringify(ARKANSAS));
  live.header.competitions[0].status.type = { state: "in", completed: false };
  assert.ok(!college.timeline(live).some((p) => p.final));
  // A live answer is the plays so far: the first so many, read the same.
  const cut = JSON.parse(JSON.stringify(live));
  cut.plays = cut.plays.slice(0, 200);
  const first = college.readPlays(cut);
  assert.deepEqual(first.map((p) => [p.id, p.at, p.deltas]), college.readPlays(ARKANSAS).slice(0, first.length).map((p) => [p.id, p.at, p.deltas]));
});

// A made-up stat crew game: the away side (zt-a, batting in the top) against the home side (zt-h). Each at-bat is
// [summaryType "A" for a start-and-result, pitcher, batter, who's on before it ([first, second, third] ids), the result's text],
// or a result of its own with "N" (a runner's play or a substitution, no start), listing who's on; the outs before each come
// from the text's count unless `outs` says (ESPN's).
const AWAY = [["zt-b1", "Ann Hit"], ["zt-b2", "Bea Walker"], ["zt-b3", "Cal Runner"], ["zt-b4", "Dee Standford"], ["zt-b5", "Eve Bunt"]];
const HOME = [["zt-p1", "Gus Starter"], ["zt-p2", "Pat Throw"]];
function made(atBats, { inning = 1, outs = [] } = {}) {
  const rows = (list) => list.map(([id, displayName]) => ({ athlete: { id, displayName }, position: { abbreviation: "LF" }, stats: ["0-0", "0", "0", "0", "0", "0", "0", "0", "0"] }));
  const pitchRows = (list) => list.map(([id, displayName]) => ({ athlete: { id, displayName }, stats: ["0.0", "0", "0", "0", "0", "0", "0", "0-0", "0", "0"] }));
  const players = [
    { team: { id: "zt-a", abbreviation: "ZTA" }, statistics: [{ type: "batting", labels: ["H-AB", "AB", "R", "H", "RBI", "HR", "BB", "K", "#P"], athletes: rows(AWAY) }] },
    { team: { id: "zt-h", abbreviation: "ZTH" }, statistics: [{ type: "pitching", labels: ["IP", "H", "R", "ER", "BB", "K", "HR", "PC-ST", "ERA", "PC"], athletes: pitchRows(HOME) }] },
  ];
  const plays = [{ id: "zt-0", summaryType: "I", type: { text: "Start Inning" }, period: { type: "Top", number: inning }, text: `Top of the ${inning}th inning`, wallclock: "2026-04-11T11:00:00Z" }];
  let n = 0;
  atBats.forEach(([st, pitcher, batter, on, text], k) => {
    const part = [...(pitcher ? [{ type: "pitcher", athlete: { id: pitcher } }] : []), ...(batter ? [{ type: "batter", athlete: { id: batter } }] : []), ...on.map((id, b) => (id ? { type: ["onFirst", "onSecond", "onThird"][b], athlete: { id } } : null)).filter(Boolean)];
    const base = { period: { type: "Top", number: inning }, atBatId: `zt-ab${k}`, outs: outs[k] ?? 0, wallclock: `2026-04-11T11:${String(10 + k).padStart(2, "0")}:00Z` };
    if (st === "A") plays.push({ ...base, id: `zt-${++n}`, summaryType: "A", type: { text: "Start Batter/Pitcher" }, text: `pitches to`, participants: part });
    plays.push({ ...base, id: `zt-${++n}`, summaryType: st === "C" ? "C" : "N", type: { text: "Play Result" }, text, participants: st === "C" ? undefined : part });
  });
  return {
    header: { id: "zt-game", competitions: [{ date: "2026-04-11T23:00Z", status: { type: { state: "post", completed: true } }, competitors: [{ homeAway: "away", score: "0", team: { id: "zt-a", abbreviation: "ZTA" } }, { homeAway: "home", score: "0", team: { id: "zt-h", abbreviation: "ZTH" } }] }] },
    boxscore: { players, teams: [] },
    plays,
  };
}

test("the stat crew's quirks, on made-up games: a misspelled batter, ids the box hasn't, a pinch runner it leaves out, notes", () => {
  const game = made([
    // The crew spells him Stanford (Dee Standford): the batter is the one ESPN lists.
    ["A", "zt-p1", "zt-b4", [], "Stanford walked (3-1 BBKBB)."],
    // A pitcher by an id the box hasn't: the one on his side the start names ("P. Throw pitches to").
    ["A", "zt-p9", "zt-b1", ["zt-b4"], "Hit singled to center field (0-0); Standford advanced to second."],
    // A pinch runner the box leaves out (zt-b8) runs for Hit; he scores later, Gus Starter's runner still.
    ["N", null, null, [], "Ghost pinch ran for Hit."],
    ["C", null, null, [], "Throw to p for Starter."],
    ["A", "zt-p2", "zt-b2", ["zt-b8", "zt-b4"], "Walker doubled down the lf line, 2 RBI (1-0 B); Standford scored; Ghost scored."],
    // What the crew notes: nothing happens.
    ["N", "zt-p2", "zt-b3", ["", "zt-b2"], "ZTH mound visit."],
    ["N", "zt-p2", "zt-b3", ["", "zt-b2"], "After review, the call of safe at second base was confirmed."],
    // Picked off but stole the base: no out.
    ["N", "zt-p2", "zt-b3", ["", "zt-b2"], "Walker picked off, stole third."],
    ["A", "zt-p2", "zt-b3", ["", "", "zt-b2"], "Runner out on batter's interference (2-1 BBS)."],
    // A sacrifice he was safe on.
    ["A", "zt-p2", "zt-b5", ["", "", "zt-b2"], "Bunt sacrifice bunt, error throwing by 3b (0-0); Walker scored, unearned."],
  ], { outs: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1] });
  // Start texts name the pitcher for the id the box hasn't.
  game.plays.find((p) => p.participants?.some((x) => x.athlete.id === "zt-p9") && p.summaryType === "A").text = "P. Throw pitches to A. Hit";
  const box = college.readBox(game);
  const notes = [];
  const plays = college.readPlays(game, notes);
  const line = college.reduce(plays).lines;
  const named = byName(box, line);
  assert.deepEqual(named["Dee Standford"], { PA: 1, BB: 1, NP: 5, R: 1 });
  assert.deepEqual(named["Ann Hit"], { PA: 1, AB: 1, H: 1, NP: 1 });
  assert.deepEqual(line["zt-b8"], { R: 1 }, "the box leaves him out: his run under ESPN's id, taken back at the final");
  assert.equal(named["Gus Starter"].GS, 1);
  assert.deepEqual({ PR: named["Gus Starter"].PR, ER: named["Gus Starter"].ER }, { PR: 1, ER: 1 }, "Standford's run, Gus Starter's walk");
  assert.equal(named["Pat Throw"].PH, 2, "the single (under an id the box hasn't) and the double");
  assert.deepEqual({ PR: named["Pat Throw"].PR, ER: named["Pat Throw"].ER }, { PR: 2, ER: 1 }, "Hit's run (his pinch runner's: Pat Throw gave up the single), and Walker's, unearned");
  assert.deepEqual(named["Bea Walker"], { PA: 1, AB: 1, H: 1, "2B": 1, RBI: 2, NP: 2, SB: 1, R: 1 });
  assert.deepEqual(named["Cal Runner"], { PA: 1, AB: 1, NP: 4 }, "out on his own interference: an at-bat; the notes before it count nothing");
  assert.deepEqual(named["Eve Bunt"], { PA: 1, SH: 1, NP: 1 }, "safe on the error: no at-bat, no out");
  assert.equal(college.reduce(plays).lines["zt-p2"].OUTS, 1, "batter's interference: the one out");
  assert.deepEqual(plays.filter((p) => p.kind === "note").length, 2);
  assert.deepEqual(notes, []);

  // A batter safe on a fielder's choice is charged to the pitcher of the runner put out (the rules' 9.16(g)), and a half the
  // game goes on from ends on three outs, the pitcher on the mound getting any the text didn't say.
  const fc = made([
    ["A", "zt-p1", "zt-b1", [], "Hit walked (3-1 BBKBB)."],
    ["C", null, null, [], "Throw to p for Starter."],
    ["A", "zt-p2", "zt-b2", ["zt-b1"], "Walker reached on a fielder's choice (0-0); Hit out at second ss to 2b."],
    ["A", "zt-p2", "zt-b3", ["zt-b2"], "Runner doubled down the lf line, RBI (0-0); Walker scored."],
    ["A", "zt-p2", "zt-b4", ["", "zt-b3"], "Standford struck out swinging (0-2 KKS)."],
  ], { outs: [0, 0, 0, 1, 1] });
  fc.plays.push({ id: "zt-next", summaryType: "I", type: { text: "Start Inning" }, period: { type: "Bottom", number: 1 }, text: "Bottom of the 1st inning", wallclock: "2026-04-11T11:30:00Z" });
  const fcNotes = [];
  const fcPlays = college.readPlays(fc, fcNotes);
  const fcLines = byName(college.readBox(fc), college.reduce(fcPlays).lines);
  assert.deepEqual({ PR: fcLines["Gus Starter"].PR, ER: fcLines["Gus Starter"].ER }, { PR: 1, ER: 1 }, "Walker's run: Hit's pitcher's");
  assert.equal(fcLines["Pat Throw"].PR, undefined);
  assert.equal(fcLines["Pat Throw"].OUTS, 3, "two read, one the text didn't say");
  assert.deepEqual(fcNotes, ["zt-next: 1 out(s) not read before: Bottom of the 1st inning"]);
});

test("Baseball's reader, for college's postseason feed: a runner's play with no bases after it, a result told twice, ESPN's outs", () => {
  // Who's on after a runner's play, from its text.
  const c = (id, rest) => ({ id, rest });
  assert.deepEqual(movedBy(["p", "l", null], [c("p", "to second"), c("l", "scored"), c("p", "to third on wild pitch by S.")]), [null, null, "p"]);
  assert.deepEqual(movedBy(["a", null, null], [c("a", "stole second")]), [null, "a", null]);
  assert.deepEqual(movedBy(["a", "b", null], [c("a", "picked off")]), [null, "b", null]);
  assert.deepEqual(movedBy(["a", null, "c"], [c("a", "safe at third on throwing error by pitcher J.")]), [null, null, "a"], "c left unsaid: the text moved a onto him");
  // A made-up postseason game: a wild pitch whose play-result says only "." (its words on the typed play), a run on it, then
  // the batter's result saying that runner scored again; a double play ESPN's outs call one.
  const P = (id, summaryType, typeText, text, extra = {}) => ({ id, summaryType, type: { text: typeText }, text, period: { type: "Top", number: 2 }, wallclock: "2026-06-22T23:30:00Z", ...extra });
  const part = (list) => list.map(([type, id]) => ({ type, athlete: { id } }));
  // An at-bat: its start lists who's on before it, its result who's on after it.
  const ab = (n, pitches, result, before, after, outsAfter, scoreValue = 0) => [
    P(`a${n}`, "A", "Start Batter/Pitcher", "pitches to", { atBatId: `ab${n}`, participants: part([["pitcher", "zt-p1"], ["batter", `zt-b${n}`], ...before]) }),
    ...pitches.map((t, k) => P(`p${n}${k}`, "P", t, `Pitch ${k + 1}`, { atBatId: `ab${n}`, atBatPitchNumber: k + 1, participants: part([["pitcher", "zt-p1"], ["batter", `zt-b${n}`]]) })),
    P(`r${n}`, "N", "Play Result", result, { atBatId: `ab${n}`, atBatPitchNumber: pitches.length, outs: outsAfter, scoreValue, participants: part([["pitcher", "zt-p1"], ["batter", `zt-b${n}`], ...after]) }),
  ];
  const third = ab(3, ["Ball", "Ball", "Strike Looking"], "C. Runner grounded into double play, shortstop to second to first, A. Hit scored, B. Walker out at home.", [["onFirst", "zt-b2"], ["onSecond", "zt-b1"]], [], 1, 0);
  const plays = [
    P("i", "I", "Start Inning", "Top of the 2nd inning"),
    ...ab(1, ["Ball", "Single"], "A. Hit singled to left.", [], [["onFirst", "zt-b1"]], 0),
    // A walk signalled: three automatic balls and an "Intentional Ball", none pitched.
    ...ab(2, ["Automatic Ball", "Automatic Ball", "Automatic Ball", "Intentional Ball"], "B. Walker intentionally walked, A. Hit to second.", [["onFirst", "zt-b1"]], [["onFirst", "zt-b2"], ["onSecond", "zt-b1"]], 0),
    third[0],
    // A runner's play-result lists no one on base (college's), and can say only "." (its words on the typed play).
    P("wp", undefined, "Wild Pitch", "A. Hit to third, B. Walker to second on wild pitch by G. Starter.", { atBatId: "ab3", atBatPitchNumber: 1, participants: part([["pitcher", "zt-p1"]]) }),
    P("wpr", "N", "Play Result", ".", { atBatId: "ab3", atBatPitchNumber: 1, scoreValue: 0, participants: part([["pitcher", "zt-p1"]]) }),
    P("wp2", undefined, "Wild Pitch", "A. Hit scored, B. Walker to third on wild pitch by G. Starter.", { atBatId: "ab3", atBatPitchNumber: 2, participants: part([["pitcher", "zt-p1"]]) }),
    P("wp2r", "S", "Play Result", ".", { atBatId: "ab3", atBatPitchNumber: 2, scoreValue: 1, participants: part([["pitcher", "zt-p1"]]) }),
    ...third.slice(1),
  ];
  const game = made([]);
  game.plays = plays;
  const box = college.readBox(game);
  const notes = [];
  const read = college.readPlays(game, notes);
  const lines = byName(box, college.reduce(read).lines);
  assert.equal(read.find((p) => p.id === "wp2r").text, "A. Hit scored, B. Walker to third on wild pitch by G. Starter.", "the typed play's words");
  // Its typed twin can come after it too.
  const after = JSON.parse(JSON.stringify(game));
  const k = after.plays.findIndex((p) => p.id === "wp2");
  after.plays.splice(k + 1, 0, after.plays.splice(k, 1)[0]);
  assert.equal(college.readPlays(after).find((p) => p.id === "wp2r").text, "A. Hit scored, B. Walker to third on wild pitch by G. Starter.");
  assert.deepEqual(college.reduce(college.readPlays(after)).score, college.reduce(read).score);
  assert.deepEqual(lines["Ann Hit"], { PA: 1, AB: 1, H: 1, NP: 2, R: 1 }, "his run once: the batter's result says it again, scoreValue 0");
  assert.deepEqual(lines["Bea Walker"], { PA: 1, BB: 1, IBB: 1 }, "out at home");
  assert.deepEqual(lines["Cal Runner"], { PA: 1, AB: 1, NP: 3 }, "no GIDP: Walker, out at home from third with first empty, wasn't forced");
  assert.equal(lines["Gus Starter"].PC, 5, "the intentional walk's four aren't pitches");
  assert.equal(lines["Gus Starter"].OUTS, 2, "a double play's two outs, though ESPN's college outs say one");
  assert.ok(notes.every((n) => !/ESPN says/.test(n)), notes.join("\n"));
});
