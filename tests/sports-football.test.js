// Football (src/lib/sports/football.ts, on src/lib/sports/sport.ts; docs/PLAN-start-a-game-gpt.md track L, step L1 part 2): its
// vocabulary, ESPN's box score and its text-only plays read into its keys, and the proof: each recorded game's plays, reduced,
// come to ESPN's own box score (every player's counts, every team total ESPN gives, the score), the stat crew's calls (tackles,
// QB hits, passes defended, targets) apart, which the final's correction settles. The recorded games (tests/fixtures/espn/,
// recorded by scripts/dev-test/record-espn.js) are 49ers at Falcons, 2026-10-25 (a catch fumbled and recovered short of where it
// ended, a spot foul behind a run, a lateral, an aborted snap, two interceptions) and Cardinals at 49ers, 2026-09-27 (a lateral
// for a touchdown, a touchdown a holding call took away, a muffed punt the kicking side recovered, a quarter's last play
// recorded again). The same proof against many real games is scripts/dev-test/check-sport-reduce.js --league=football/nfl
// --weeks=3-7. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, sportById, defaultsFor, allSports, defenseId } = jiti("../src/lib/sports/index.ts");
const { playNames, sentencesOf } = jiti("../src/lib/sports/football.ts");

const football = sportOf("football/nfl");
const FALCONS = require("./fixtures/espn/nfl-401873017.json");
const NINERS = require("./fixtures/espn/nfl-401872958.json");
const nameOf = (box, name) => Object.values(box.people).find((p) => p.name === name);
const named = (box, deltas) => Object.fromEntries(Object.entries(deltas).map(([w, d]) => [box.people[w]?.name ?? w, d]));
const playOf = (plays, text) => plays.find((p) => p.text.includes(text));

test("Football's vocabulary: unique stat keys, positions in their groups, four quarters, weekly locks, the NFL only", () => {
  assert.equal(football.id, "football");
  assert.equal(sportById("football"), football);
  assert.equal(sportOf("football/college-football"), null, "college's plays are written otherwise: L5");
  assert.ok(allSports().includes(football));
  const keys = football.stats.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, "keys are unique: a passer's interceptions INT, a defender's DINT, a team's DSTINT");
  const groups = new Set(football.statGroups.map((g) => g.key));
  for (const s of football.stats) {
    assert.ok(groups.has(s.group), s.key);
    assert.ok(s.label && s.short && s.noun, s.key);
    assert.ok(["higher", "lower"].includes(s.better), s.key);
    assert.equal(s.kind === "count", !s.of, `${s.key}: counts are counted, the rest worked out`);
  }
  // Every count ESPN's box has, the plays carry: nothing waits for the final.
  assert.deepEqual(football.stats.filter((s) => s.known === "final").map((s) => s.key), []);
  // The stat crew's calls, which ESPN's box can count otherwise after the play.
  assert.deepEqual(football.stats.filter((s) => s.judged).map((s) => s.key), ["TGT", "TCK", "SOLO", "SACK", "TFL", "PD", "QBH", "FF", "DSTSACK"]);
  const posGroups = new Set(football.groups.map((g) => g.key));
  for (const p of football.positions) assert.ok(posGroups.has(p.group), p.key);
  for (const g of football.groups) for (const s of g.stats) assert.ok(groups.has(s), g.key);
  assert.equal(football.lock, "weekly");
  assert.equal(football.where({ period: 2, half: null, clock: "5:32" }), "2nd quarter, 5:32");
  assert.equal(football.where({ period: 5, half: null, clock: "3:10" }), "overtime, 3:10");
  const ctx = football.specStats();
  assert.deepEqual(ctx.find((s) => s.key === "PYDS"), { key: "PYDS", label: "passing yard" });
  assert.ok(!ctx.some((s) => s.key === "CMP%" || s.key === "YPC"));
});

test("derived and rate stats: net passing yards, two-point conversions, kicking points, return touchdowns, points allowed's brackets", () => {
  const qb = football.full({ CMP: 27, PATT: 40, PYDS: 288, SACKED: 2, SACKYDS: 11, P2PT: 1 });
  assert.deepEqual([qb.NPYDS, qb["CMP%"], qb.YPA, qb["2PT"]], [277, 27 / 40, 7.2, 1]);
  assert.ok(!("YPC" in qb), "no carries, no yards a carry");
  const k = football.full({ FGM: 3, FGA: 4, FGM30: 2, FGM50: 1, XPM: 2, XPA: 3 });
  assert.deepEqual([k.KPTS, k.FGMISS, k.XPMISS, k["FG%"]], [11, 1, 1, 0.75]);
  assert.equal(football.full({ KR: 2, KRYDS: 130, KRTD: 1, PR: 1, PRYDS: 0 }).RETTD, 1);
  // A team defense's line always has its game, so a shutout with nothing else to show is still worked out.
  const shutout = football.full({ DSTG: 1 });
  assert.deepEqual([shutout.PA0, shutout.PA1_6, shutout.PA35], [1, 0, 0]);
  const brackets = (pa) => ["PA0", "PA1_6", "PA7_13", "PA14_20", "PA21_27", "PA28_34", "PA35"].filter((b) => football.full({ DSTG: 1, PA: pa })[b]);
  assert.deepEqual([6, 7, 20, 21, 34, 35, 52].map(brackets), [["PA1_6"], ["PA7_13"], ["PA14_20"], ["PA21_27"], ["PA28_34"], ["PA35"], ["PA35"]]);
});

test("the play-by-play's names and sentences: initials and a last name, a suffix dropped, a hyphen's first part, St. Brown", () => {
  assert.ok(playNames("Bijan Robinson").includes("bi.robinson"));
  assert.ok(playNames("Michael Penix Jr.").includes("m.penix"));
  assert.ok(playNames("C.J. Henderson").includes("c.henderson"));
  assert.ok(playNames("Ji'Ayir Brown").includes("j.brown"));
  assert.ok(playNames("Amon-Ra St. Brown").includes("a.stbrown"));
  assert.ok(playNames("Sebastian Joseph-Day").includes("s.joseph"), "the text can cut a hyphenated name");
  assert.deepEqual(sentencesOf("J.Goff pass short right to A.St. Brown for 4 yards, TOUCHDOWN.PENALTY on DET-B.Miller, Taunting, 15 yards, enforced between downs. J.Bates extra point is GOOD, Center-H.Hatten, Holder-J.Fox."), [
    "J.Goff pass short right to A.St. Brown for 4 yards, TOUCHDOWN.",
    "PENALTY on DET-B.Miller, Taunting, 15 yards, enforced between downs.",
    "J.Bates extra point is GOOD, Center-H.Hatten, Holder-J.Fox.",
  ]);
  assert.deepEqual(sentencesOf("G.Smith pass deep middle to I.Williams for 58 yards, TOUCHDOWN [J.van den Berg]. J.Sanders extra point is No Good."), ["G.Smith pass deep middle to I.Williams for 58 yards, TOUCHDOWN [J.van den Berg].", "J.Sanders extra point is No Good."]);
});

test("ESPN's box score in Football's keys: a passer's gross yards, a pair's two counts, the team's net totals, a team defense", () => {
  const box = football.readBox(FALCONS);
  assert.equal(box.event, "401873017");
  assert.deepEqual(
    box.teams.map((t) => [t.id, t.abbreviation, t.home, t.score, t.winner]),
    [
      ["1", "ATL", true, 29, true],
      ["25", "SF", false, 20, false],
    ]
  );
  // "27/40" and "2-11" are two counts each; the passer's yards are gross, the table's total net of the sacks.
  assert.deepEqual(nameOf(box, "Brock Purdy").stats, { CMP: 27, PATT: 40, PYDS: 288, PTD: 1, INT: 2, SACKED: 2, SACKYDS: 11, RATT: 2, RYDS: 5, RTD: 0 });
  assert.deepEqual(box.teams[1].stats, { NPYDS: 277, CMP: 27, PATT: 40, INT: 2, SACKED: 2, SACKYDS: 11, RYDS: 123, RATT: 23, FUML: 2 });
  assert.deepEqual(nameOf(box, "Nick Folk").stats, { FGM: 3, FGA: 3, XPM: 2, XPA: 3 });
  assert.deepEqual(nameOf(box, "Jake Bailey").stats, { PUNT: 3, PUNTYDS: 117, PUNTTB: 0, PUNTIN20: 1 });
  assert.deepEqual(nameOf(box, "Kendal Daniels").stats, { FUM: 0, FUML: 0, FREC: 1, TCK: 11, SOLO: 9, SACK: 0, TFL: 1, PD: 1, QBH: 0, DTD: 0, DINT: 1, DINTYDS: 29, DINTTD: 0 });
  assert.equal(nameOf(box, "Brock Purdy").position, null, "ESPN's football box score has no positions: the roster's say");
  // Each side's defense and special teams: its sacks and interceptions, the other side's fumbles lost, its touchdowns.
  assert.deepEqual(box.people[defenseId("1")], { id: "def:1", name: "Atlanta Falcons D/ST", team: "1", position: "DEF", stats: { DSTG: 1, DSTSACK: 2, DSTINT: 2, DSTFR: 2, DSTTD: 0 } });
  assert.equal(football.readBox({}), null);
});

for (const [name, game, judged] of [
  ["49ers at Falcons", FALCONS, []],
  // The stat crew's tackles, which the final's correction settles.
  ["Cardinals at 49ers", NINERS, ["Fred Warner SOLO", "Kevin Givens TCK", "Marques Sigle TCK", "Sebastian Valdez SOLO"]],
]) {
  test(`the proof, ${name}: the plays alone reduce to ESPN's own box score, every team total and the score`, () => {
    const box = football.readBox(game);
    const notes = [];
    const plays = football.readPlays(game, notes);
    assert.deepEqual(notes, [], "nothing the reader couldn't read");
    const state = football.reduce(plays);
    let compared = 0;
    const calls = [];
    for (const p of Object.values(box.people)) {
      for (const [k, v] of Object.entries(p.stats)) {
        compared++;
        if (football.stat(k).judged && (state.lines[p.id]?.[k] ?? 0) !== v) calls.push(`${p.name} ${k}`);
        else assert.equal(state.lines[p.id]?.[k] ?? 0, v, `${p.name} ${k}`);
      }
    }
    assert.deepEqual(calls, judged);
    assert.ok(compared > 450, `${compared} numbers compared`);
    for (const id of Object.keys(state.lines)) assert.ok(box.people[id], `${id} is in the box score`);
    for (const t of box.teams) {
      const sum = {};
      for (const p of Object.values(box.people)) {
        if (p.team !== t.id) continue;
        for (const [k, v] of Object.entries(football.full(state.lines[p.id] ?? {}))) sum[k] = (sum[k] ?? 0) + v;
      }
      for (const [k, v] of Object.entries(t.stats)) assert.equal(sum[k] ?? 0, v, `${t.abbreviation} ${k}`);
      assert.equal(state.score[t.id], t.score, `${t.abbreviation}'s score`);
    }
  });
}

test("plays: in time order, each with its quarter and clock, its drive, its people and what it adds to whose line", () => {
  const plays = football.readPlays(FALCONS);
  const box = football.readBox(FALCONS);
  for (let i = 1; i < plays.length; i++) assert.ok(plays[i].at >= plays[i - 1].at, `${plays[i].id} after ${plays[i - 1].id}`);
  for (const p of plays) assert.ok(p.period >= 1 && p.period <= 4 && p.half === null && /^\d+:\d\d$/.test(p.clock), p.id);
  // The unit is the drive (live calls' "the next drive").
  assert.equal(new Set(plays.map((p) => p.unit)).size, 19);
  const td = playOf(plays, "C.McCaffrey up the middle for 1 yard, TOUCHDOWN");
  assert.equal(football.where(td), "1st quarter, 9:22");
  assert.deepEqual(named(box, td.deltas), { "Christian McCaffrey": { RATT: 1, RYDS: 1, RTD: 1 }, "Eddy Pineiro": { XPA: 1, XPM: 1 }, "Atlanta Falcons D/ST": { PA: 7 } });
  assert.deepEqual(td.score, { 1: 0, 25: 7 });
  assert.equal(td.team, "25");
  // A sack: the quarterback's yards lost, the sacker's tackle for loss and hit, the team's sack.
  assert.deepEqual(named(box, playOf(plays, "B.Purdy sacked at 50").deltas), { "Brock Purdy": { SACKED: 1, SACKYDS: 7 }, "Maason Smith": { TCK: 1, SOLO: 1, SACK: 1, TFL: 1, QBH: 1 }, "Atlanta Falcons D/ST": { DSTSACK: 1 } });
  // "(A; B)" is a shared tackle, "(A, B)" A's with B's help; "[J.Ivey]" a hit on the quarterback.
  assert.deepEqual(named(box, playOf(plays, "to J.James to ATL 37").deltas), { "Brock Purdy": { CMP: 1, PATT: 1, PYDS: 11 }, "Jordan James": { REC: 1, RECYDS: 11, TGT: 1 }, "Kendal Daniels": { TCK: 1 }, "Zach Harrison": { TCK: 1 }, "Jared Ivey": { QBH: 1 } });
  assert.deepEqual(named(box, playOf(plays, "(H.Perkins, A.Terrell)").deltas), { "Brock Purdy": { CMP: 1, PATT: 1, PYDS: -4 }, "Kaelon Black": { REC: 1, RECYDS: -4, TGT: 1 }, "Harold Perkins Jr.": { TCK: 1, SOLO: 1, TFL: 1 }, "A.J. Terrell Jr.": { TCK: 1 } });
  // An interception: the passer's, the intended receiver's target, the defender's pick and pass defended, the team's.
  assert.deepEqual(named(box, playOf(plays, "INTERCEPTED by J.Bates").deltas), { "Brock Purdy": { PATT: 1, INT: 1 }, "Jacob Cowing": { TGT: 1 }, "Jessie Bates III": { DINT: 1, PD: 1 }, "Atlanta Falcons D/ST": { DSTINT: 1 } });
  // A holding call behind the run: the run counts to the foul's spot (ATL 35 to ATL 32: 3 of the 10 yards).
  assert.deepEqual(named(box, playOf(plays, "C.McCaffrey right guard to ATL 25").deltas), { "Christian McCaffrey": { RATT: 1, RYDS: 3 }, "C.J. Henderson": { TCK: 1, SOLO: 1 } });
  // A lateral: the catch is the first receiver's, the yards after it the second's, all of them the passer's.
  assert.deepEqual(named(box, playOf(plays, "Lateral to Bi.Robinson").deltas), { "Michael Penix Jr.": { CMP: 1, PATT: 1, PYDS: 16 }, "Drake London": { REC: 1, RECYDS: 2, TGT: 1 }, "Bijan Robinson": { RECYDS: 14 }, "Malik Mustapha": { TCK: 1 }, "Ji'Ayir Brown": { TCK: 1 } });
  // A catch fumbled and recovered by the other side a yard back: the catch counts to where they got it (21 of 22 yards).
  assert.deepEqual(named(box, playOf(plays, "to G.Kittle to ATL 19 for 22 yards").deltas), { "Brock Purdy": { CMP: 1, PATT: 1, PYDS: 21 }, "George Kittle": { REC: 1, RECYDS: 21, TGT: 1, FUM: 1, FUML: 1 }, "Jessie Bates III": { TCK: 1, SOLO: 1, FF: 1 }, "Kendal Daniels": { FREC: 1 }, "Atlanta Falcons D/ST": { DSTFR: 1 } });
  // An aborted snap: the quarterback's carry for no gain, the center's fumble.
  assert.deepEqual(named(box, playOf(plays, "M.Penix Aborted").deltas), { "Ryan Neuzil": { FUM: 1 }, "Michael Penix Jr.": { RATT: 1, FREC: 1 } });
  // A false start wipes out the play.
  assert.deepEqual(playOf(plays, "PENALTY on SF-T.Williams, False Start").deltas, {});
});

test("the 49ers' quirks: a lateral for a touchdown, a touchdown a penalty took away, a muffed punt, a play recorded twice", () => {
  const plays = football.readPlays(NINERS);
  const box = football.readBox(NINERS);
  // The touchdown is the passer's and the second receiver's.
  assert.deepEqual(named(box, playOf(plays, "Lateral to D.Samuel for 80 yards").deltas), { "Brock Purdy": { CMP: 1, PATT: 1, PYDS: 82, PTD: 1 }, "Mike Evans": { REC: 1, RECYDS: 2, TGT: 1 }, "Deebo Samuel Sr.": { RECYDS: 80, RECTD: 1 }, "Eddy Pineiro": { XPA: 1, XPM: 1 }, "Arizona Cardinals D/ST": { PA: 7 } });
  // "TOUCHDOWN NULLIFIED by Penalty": no touchdown, but the run counts to the holding call's spot (35 of 45 yards).
  const nullified = playOf(plays, "TOUCHDOWN NULLIFIED");
  assert.deepEqual(named(box, nullified.deltas), { "Brock Purdy": { RATT: 1, RYDS: 35 } });
  // A muffed punt the kicking side recovers: the returner's fumble lost and a return of nothing; the punt's yards run on to
  // where it was recovered (SF 30 to SF 28).
  assert.deepEqual(named(box, playOf(plays, "S.Neal MUFFS catch").deltas), { "Siran Neal": { FUM: 1, PR: 1, FUML: 1 }, "Blake Gillikin": { PUNT: 1, PUNTYDS: 48 }, "Simi Fehoko": { FREC: 1 }, "Arizona Cardinals D/ST": { DSTFR: 1 } });
  // The 3rd quarter's last play, recorded again at the 4th's start from the same down and spot: the first is left out.
  const twice = playOf(plays, "to J.Love to SF 22 for 4 yards");
  assert.deepEqual([twice.kind, twice.deltas], ["replaced", {}]);
  assert.equal(playOf(plays, "to Mi.Wilson to SF 20 for 6 yards").kind, "catch");
});

test("a game as of a moment: the half, then the final", () => {
  const plays = football.timeline(FALCONS);
  const box = football.readBox(FALCONS);
  const half = plays.find((p) => p.kind === "end-of-half");
  const at = football.reduce(plays, half.at);
  assert.deepEqual(at.score, { 1: 12, 25: 14 });
  assert.equal(football.where(at.last), "2nd quarter, 0:00");
  const purdy = nameOf(box, "Brock Purdy").id;
  assert.equal(at.lines[purdy].PYDS < 288, true);
  const end = football.reduce(plays);
  assert.deepEqual(end.score, { 1: 29, 25: 20 });
  assert.equal(end.lines[purdy].PYDS, 288);
  // The team defenses: the Falcons allowed the 49ers' 20, the 49ers the Falcons' 29.
  assert.equal(football.full(end.lines[defenseId("1")]).PA14_20, 1);
  assert.equal(football.full(end.lines[defenseId("25")]).PA28_34, 1);
});

test("the final's correction: only the stat crew's calls, and with it every number of ESPN's box score", () => {
  for (const game of [FALCONS, NINERS]) {
    const box = football.readBox(game);
    const correction = football.correction(football.reduce(football.readPlays(game)), box);
    for (const [who, d] of Object.entries(correction)) for (const k of Object.keys(d)) assert.ok(football.stat(k).judged, `${box.people[who].name} ${k}`);
    const end = football.reduce(football.timeline(game));
    for (const p of Object.values(box.people)) for (const [k, v] of Object.entries(p.stats)) assert.equal(end.lines[p.id]?.[k] ?? 0, v, `${p.name} ${k}`);
  }
  const live = JSON.parse(JSON.stringify(FALCONS));
  live.header.competitions[0].status.type = { state: "in", completed: false };
  assert.ok(!football.timeline(live).some((p) => p.final));
  // A live game's drive in progress is read too, once.
  live.drives.current = live.drives.previous.pop();
  live.drives.previous.push(live.drives.current);
  assert.equal(football.readPlays(live).length, football.readPlays(FALCONS).length);
});

// A made-up game for the rules the recorded ones don't show: the away side (1, "ZTA") against the home side (2, its text code
// "ZHM", learned from its kickoff). A spot's yard line is from the home side's goal line.
const AWAY = [["a1", "Al Arm"], ["a2", "Bo Back"], ["a3", "Cy Catch"], ["a4", "Kit Kicker"], ["a5", "Pat Punter"], ["a6", "Ray Return"], ["a7", "Lou Line"], ["a8", "Bam Tread"]];
// The home side's Rex Tread has the text's "R.Tread" exactly; the away side's Bam Tread is "R.Tread" by his last name alone.
const HOME = [["h1", "Dee Def"], ["h2", "Eli End"], ["h3", "Fay Free"], ["h4", "Hal Hold"], ["h5", "Ike Iron"], ["h6", "Kip Kick"], ["h7", "Jo Jumper"], ["h8", "Sam Joseph-Day"], ["h9", "Rex Tread"]];
function made(plays) {
  const side = (team, abbr, people) => ({ team: { id: team, abbreviation: abbr }, statistics: [{ name: "defensive", labels: ["TOT"], athletes: people.map(([id, displayName]) => ({ athlete: { id, displayName }, stats: [] })) }] });
  const kickoff = { type: "Kickoff", text: "K.Kick kicks 65 yards from ZHM 35 to end zone, Touchback to the ZTA 35.", team: "2", down: 0, los: 35 };
  return {
    header: {
      id: "zt3",
      season: { type: 2 },
      competitions: [{ status: { type: { state: "post", completed: true, detail: "Final" } }, competitors: [{ homeAway: "away", score: "0", team: { id: "1", abbreviation: "ZTA", displayName: "Zeta Away" } }, { homeAway: "home", score: "0", team: { id: "2", abbreviation: "ZTH", displayName: "Zeta Home" } }] }],
    },
    boxscore: { players: [side("1", "ZTA", AWAY), side("2", "ZTH", HOME)], teams: [] },
    drives: {
      previous: [
        {
          id: "zd1",
          team: { id: "1" },
          plays: [kickoff, ...plays].map((p, i) => ({
            id: `z${i}`,
            type: { text: p.type ?? "Play" },
            text: p.text,
            awayScore: p.score?.[0] ?? 0,
            homeScore: p.score?.[1] ?? 0,
            period: { number: 1 },
            clock: { displayValue: `${14 - i}:00` },
            wallclock: `2026-10-25T17:${String(i).padStart(2, "0")}:00Z`,
            start: { team: { id: p.team ?? "1" }, down: p.down ?? 1 + (i % 3), distance: 10, yardLine: p.los ?? 30 + i },
          })),
        },
      ],
    },
  };
}
const lines = (game) => football.reduce(football.readPlays(game)).lines;
const deltasOf = (game, i) => football.readPlays(game)[i + 1].deltas;

test("fumbles: the gain counts to where the other side got it, back to a teammate's recovery but never on past the fumble", () => {
  // The away side runs down the field: ZHM 45 is 45, ZHM 40 is 40, ZTA 30 is 70.
  const behind = made([{ text: "B.Back left end to ZHM 40 for 5 yards (D.Def). FUMBLES (D.Def), recovered by ZTA-C.Catch at ZHM 47.", los: 45 }]);
  assert.deepEqual(deltasOf(behind, 0), { a2: { RATT: 1, RYDS: -2, FUM: 1 }, h1: { TCK: 1, SOLO: 1, FF: 1 }, a3: { FREC: 1 } });
  const ahead = made([{ text: "B.Back left end to ZHM 40 for 5 yards (D.Def). FUMBLES (D.Def), recovered by ZTA-C.Catch at ZHM 37.", los: 45 }]);
  assert.equal(deltasOf(ahead, 0).a2.RYDS, 5, "a teammate's advance isn't the runner's");
  const lost = made([{ text: "B.Back left end to ZHM 40 for 5 yards (D.Def). FUMBLES (D.Def), touched at ZHM 42, RECOVERED by ZHM-F.Free at ZHM 41.", los: 45 }]);
  assert.deepEqual(deltasOf(lost, 0), { a2: { RATT: 1, RYDS: 3, FUM: 1, FUML: 1 }, h1: { TCK: 1, SOLO: 1, FF: 1 }, h3: { FREC: 1 }, "def:2": { DSTFR: 1 } });
  // A sack fumbled: its yards are to where the other side first touched it, its tackle for loss and its hit gone (ESPN's).
  const sack = made([{ text: "A.Arm sacked at ZTA 30 for -8 yards (E.End). FUMBLES (E.End), touched at ZTA 33, RECOVERED by ZHM-D.Def at ZTA 31.", los: 62 }]);
  assert.deepEqual(deltasOf(sack, 0), { a1: { SACKED: 1, FUM: 1, FUML: 1, SACKYDS: 5 }, h2: { TCK: 1, SOLO: 1, SACK: 1, FF: 1 }, h1: { FREC: 1 }, "def:2": { DSTSACK: 1, DSTFR: 1 } });
  // ... and to where it went out of bounds only when that's behind him.
  const out = made([{ text: "A.Arm sacked at ZTA 30 for -8 yards (E.End). FUMBLES (E.End), ball out of bounds at ZTA 36.", los: 62 }]);
  assert.equal(deltasOf(out, 0).a1.SACKYDS, 8);
  // "Fumble Forced by 55-E.End.": someone else forced it than the tackler named.
  const forced = made([{ text: "B.Back left end to ZHM 40 for 5 yards (D.Def). FUMBLES (D.Def), recovered by ZTA-B.Back at ZHM 40. Fumble Forced by 55-E.End.", los: 45 }]);
  assert.deepEqual([deltasOf(forced, 0).h1.FF, deltasOf(forced, 0).h2.FF], [undefined, 1]);
});

test("snaps: an aborted one is the quarterback's carry (from the line when he runs with it); a fumbled one before a pass isn't a run", () => {
  const ran = made([{ text: "A.Arm FUMBLES (Aborted) at ZTA 30, and recovers at ZTA 29. A.Arm to ZHM 45 for 26 yards (F.Free).", los: 65 }]);
  assert.deepEqual(deltasOf(ran, 0), { a1: { FUM: 1, RATT: 1, FREC: 1, RYDS: 20 }, h3: { TCK: 1, SOLO: 1 } });
  const fell = made([{ text: "A.Arm Aborted. L.Line FUMBLES at ZTA 33, recovered by ZTA-A.Arm at ZTA 25.", los: 65 }]);
  assert.deepEqual(deltasOf(fell, 0), { a1: { RATT: 1, FREC: 1 }, a7: { FUM: 1 } });
  const threw = made([{ text: "A.Arm to ZTA 30 for -5 yards. FUMBLES, and recovers at ZTA 29. A.Arm pass incomplete short left to C.Catch.", los: 65 }]);
  assert.deepEqual(deltasOf(threw, 0), { a1: { FUM: 1, FREC: 1, PATT: 1 }, a3: { TGT: 1 } });
});

test("scoring: a summary's full names, two points, a pick-six and a safety, and the points a defense allowed (Yahoo's)", () => {
  const game = made([
    { text: "Cy Catch 9 Yd pass from Al Arm (Kit Kicker Kick)", score: [7, 0] },
    { text: "B.Back up the middle for 2 yards, TOUCHDOWN. TWO-POINT CONVERSION ATTEMPT. A.Arm pass to C.Catch is complete. ATTEMPT SUCCEEDS.", score: [15, 0] },
    { team: "2", text: "H.Hold pass short right intended for I.Iron INTERCEPTED by L.Line at ZHM 30. L.Line for 30 yards, TOUCHDOWN. K.Kicker extra point is GOOD, Center-P.Punter, Holder-P.Punter.", score: [22, 0], los: 20 },
    { type: "Two-minute warning", text: "Two-Minute Warning", score: [0, 0], team: "2", los: 40 },
    { team: "2", text: "H.Hold sacked in End Zone for -6 yards (L.Line), SAFETY.", score: [24, 0], los: 4 },
    { text: "Al Arm Pass Complete for 5 Yds to Cy Catch", score: [24, 0] },
    { text: "Al Arm Incomplete Pass, Intended For Cy Catch", score: [24, 0] },
  ]);
  const plays = football.readPlays(game);
  const l = football.reduce(plays).lines;
  assert.deepEqual(plays[1].deltas, { a3: { REC: 1, RECYDS: 9, RECTD: 1, TGT: 1 }, a1: { CMP: 1, PATT: 1, PYDS: 9, PTD: 1 }, a4: { XPA: 1, XPM: 1 }, "def:2": { PA: 7 } });
  assert.deepEqual([l.a1.P2PT, l.a3.RE2PT, l.a2.RTD], [1, 1, 1]);
  assert.deepEqual(plays[3].deltas, { h4: { PATT: 1, INT: 1 }, h5: { TGT: 1 }, a7: { DINT: 1, PD: 1, DINTYDS: 30, DINTTD: 1, DTD: 1 }, a4: { XPA: 1, XPM: 1 }, "def:1": { DSTINT: 1, DSTTD: 1 }, "def:2": { PA: 1 } });
  // ESPN's 0-0 on the two-minute warning doesn't take the score back.
  assert.deepEqual(plays[4].score, { 1: 22, 2: 0 });
  assert.deepEqual(plays[5].deltas, { h4: { SACKED: 1, SACKYDS: 6 }, a7: { TCK: 1, SOLO: 1, SACK: 1, SAF: 1, TFL: 1, QBH: 1 }, "def:1": { DSTSACK: 1, DSTSAF: 1 } });
  // The home defense allowed 7 + 8 + 1: not the pick-six's 6 or the safety's 2.
  assert.equal(l["def:2"].PA, 16);
  assert.deepEqual(football.full(l["def:2"]).PA14_20, 1);
  // The summary's catch and the phrases' (a two-point try is neither a catch nor an attempt).
  assert.deepEqual([l.a1.CMP, l.a1.PATT, l.a3.REC, l.a3.TGT], [2, 3, 2, 3]);
});

test("the rules of sacks, tackles, punts and kickoffs the recorded games don't show", () => {
  const game = made([
    { text: "A.Arm sacked at ZTA 30 for -4 yards (sack split by D.Def and E.End)." },
    { text: "A.Arm sacked ob at ZTA 32 for -2 yards (F.Free)." },
    { text: "B.Back left end to ZTA 33 for -1 yards (D.Def; E.End)." },
    // A punt returned, a holding call by the returning side behind the return: the return to the spot, and the punt inside the 20.
    { text: "P.Punter punts 50 yards to ZHM 15, Center-L.Line. J.Jumper to ZHM 30 for 15 yards (B.Back).PENALTY on ZHM-I.Iron, Offensive Holding, 10 yards, enforced at ZHM 18.", los: 65 },
    // A muffed punt kept: a fumble and a return, of nothing.
    { text: "P.Punter punts 45 yards to ZHM 20, Center-L.Line. J.Jumper MUFFS catch, and recovers at ZHM 17.", los: 65 },
    // A muffed kickoff kept: a return; a nickname in the box ("Bam Tread" is the text's "R.Tread"); a cut hyphenated name.
    { team: "2", text: "K.Kick kicks 65 yards from ZHM 35 to ZTA 2. R.Tread MUFFS catch, and recovers at ZTA 3. R.Tread to ZTA 20 for 17 yards (S.Joseph).", down: 0, los: 35 },
    { team: "2", text: "H.Hold pass short left to I.Iron to ZHM 39 for -1 yards. Lateral to J.Jumper to ZHM 45 for 6 yards (L.Line).", los: 40 },
  ]);
  const plays = football.readPlays(game);
  assert.deepEqual(plays[1].deltas, { a1: { SACKED: 1, SACKYDS: 4 }, h1: { TCK: 1, SACK: 0.5, QBH: 1 }, h2: { TCK: 1, SACK: 0.5, QBH: 1 }, "def:2": { DSTSACK: 1 } });
  // Run out of bounds behind the line: a sack and a tackle for loss, not a hit.
  assert.deepEqual(plays[2].deltas, { a1: { SACKED: 1, SACKYDS: 2 }, h3: { TCK: 1, SOLO: 1, SACK: 1, TFL: 1 }, "def:2": { DSTSACK: 1 } });
  // A tackle for loss is the first tackler's.
  assert.deepEqual(plays[3].deltas, { a2: { RATT: 1, RYDS: -1 }, h1: { TCK: 1, TFL: 1 }, h2: { TCK: 1 } });
  assert.deepEqual(plays[4].deltas, { a5: { PUNT: 1, PUNTYDS: 50, PUNTIN20: 1 }, h7: { PR: 1, PRYDS: 3 }, a2: { TCK: 1, SOLO: 1 } });
  assert.deepEqual(plays[5].deltas, { a5: { PUNT: 1, PUNTYDS: 48, PUNTIN20: 1 }, h7: { FUM: 1, PR: 1, FREC: 1 } });
  assert.deepEqual(plays[6].deltas, { a8: { KR: 1, KRYDS: 17 }, h8: { TCK: 1, SOLO: 1 } });
  // A catch behind the line lateralled on: the catch's own yards, then the lateral's, all the passer's.
  assert.deepEqual(plays[7].deltas, { h4: { CMP: 1, PATT: 1, PYDS: 5 }, h5: { REC: 1, RECYDS: -1, TGT: 1 }, h7: { RECYDS: 6 }, a7: { TCK: 1, SOLO: 1 } });
});

test("whose it is: a safety on a return, a touchdown off a muffed punt, a defensive two-point return, a name on its own side", () => {
  const game = made([
    // The home side's kickoff, its returner downed in his own end zone: the kicking side's safety, not allowed by the other.
    { team: "2", text: "K.Kick kicks 70 yards from ZHM 35 to ZTA -5. R.Return to ZTA -1 for 4 yards (D.Def), SAFETY.", down: 0, los: 35, score: [0, 2] },
    // The away side's punt muffed, its coverage recovering in the end zone: their defense and special teams' touchdown.
    { text: "P.Punter punts 40 yards to ZHM 10, Center-L.Line. J.Jumper MUFFS catch, RECOVERED by ZTA-R.Return at ZHM 0. TOUCHDOWN.", los: 50, score: [6, 2] },
    // A failed try returned by the defense: its two points, not allowed by the other side's defense.
    { text: "B.Back up the middle for 1 yard, TOUCHDOWN. TWO-POINT CONVERSION ATTEMPT. A.Arm pass to C.Catch is incomplete. ATTEMPT FAILS. DEFENSIVE TWO-POINT ATTEMPT. F.Free intercepted the try attempt. ATTEMPT SUCCEEDS.", score: [12, 4], los: 1 },
    // A home run tackled by "R.Tread": the away side's Bam Tread by his last name, not the home side's Rex Tread exactly.
    { team: "2", text: "I.Iron left end to ZHM 34 for 4 yards (R.Tread).", los: 30, score: [12, 4] },
  ]);
  const plays = football.readPlays(game);
  assert.deepEqual(plays[1].deltas, { a6: { KR: 1, KRYDS: 4 }, h1: { TCK: 1, SOLO: 1, SAF: 1 }, "def:2": { DSTSAF: 1 } });
  // The punt's yards run on to where its coverage recovered it (ZHM 10 to the goal line).
  assert.deepEqual(plays[2].deltas, { a5: { PUNT: 1, PUNTYDS: 50, PUNTIN20: 1 }, h7: { FUM: 1, PR: 1, FUML: 1 }, a6: { FREC: 1, DTD: 1 }, "def:1": { DSTFR: 1, DSTTD: 1 }, "def:2": { PA: 6 } });
  assert.deepEqual(plays[3].deltas, { a2: { RATT: 1, RYDS: 1, RTD: 1 }, "def:2": { PA: 6 } });
  assert.deepEqual(plays[4].deltas, { h5: { RATT: 1, RYDS: 4 }, a8: { TCK: 1, SOLO: 1 } });
  const l = football.reduce(plays).lines;
  assert.deepEqual([l["def:1"].PA ?? 0, l["def:2"].PA], [0, 12], "the away side's defense allowed neither the safety nor the defensive two");
});

test("Football's defaults are data the spec reads: Yahoo's half-PPR points, kickers and team defense, slots, weekly locks", () => {
  const d = defaultsFor("football");
  assert.equal(d.sport, "football");
  assert.deepEqual([d.scoring.points.REC, d.scoring.points.PYDS, d.scoring.points.RYDS, d.scoring.points.PTD, d.scoring.points.FUML], [0.5, 0.04, 0.1, 4, -2]);
  assert.deepEqual([d.scoring.points.FGM40, d.scoring.points.FGM50, d.scoring.points.PA0, d.scoring.points.PA35], [4, 5, 10, -4]);
  for (const k of Object.keys(d.scoring.points)) assert.ok(football.stat(k) && football.stat(k).kind !== "rate", `${k} scores`);
  assert.deepEqual(d.categories.stats, [], "Yahoo's football is points only");
  const fill = new Set([...football.positions.map((p) => p.key), ...football.groups.map((g) => g.key)]);
  for (const s of d.slots.lineup) for (const t of s.takes) assert.ok(fill.has(t), `${s.slot} takes ${t}`);
  assert.deepEqual(d.slots.lineup.map((s) => [s.slot, s.n]), [["QB", 1], ["WR", 2], ["RB", 2], ["TE", 1], ["W/R/T", 1], ["K", 1], ["DEF", 1]]);
  assert.equal(d.closes, football.lock);
  const starters = d.slots.lineup.reduce((n, s) => n + s.n, 0);
  assert.equal(d.specs.season.spec.count.start, starters, "the season's lineup is its slots");
  assert.equal(d.specs.season.spec.get.each, starters + d.slots.bench, "and its draft the slots and the bench: Yahoo's 15");
  for (const { spec } of Object.values(d.specs)) {
    assert.equal(spec.spec, 1);
    assert.equal(spec.score.by, "stats");
    assert.deepEqual(spec.score.points, d.scoring.points);
  }
});
