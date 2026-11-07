// College football (src/lib/sports/college-football.ts's CollegeFootball, on football.ts and sport.ts; docs/PLAN-start-a-game-gpt.md
// track L, step L5 part 2b): Football's vocabulary on ESPN's college feed, its own grammar of plays (jersey numbers, the home
// crew's team codes, "QB hurried by"), what the NCAA counts otherwise (a sack is the quarterback's rush, a kneel-down and a spike
// the team's, hurries not hits), and the proof: each recorded game's plays, reduced, come to ESPN's own box score (every
// player's counts, the team totals, the score), the stat crew's calls (tackles, sacks, hurries, passes defended) apart, which the
// final's correction settles. The recorded games (tests/fixtures/espn/, by scripts/dev-test/record-espn.js): Texas A&M at Alabama,
// 2026-10-24 (a pick-six, an interception a review gave, sacks and a split sack, kneel-downs) and BYU at UCF in two overtimes the
// same day (possessions from the 25, a two-point pass told only in the scoring plays). The same proof against many real games is
// scripts/dev-test/check-sport-reduce.js --league=football/college-football --weeks=6-8 --groups=80. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, sportById, defaultsFor, allSports, Football, CollegeFootball, defenseId } = jiti("../src/lib/sports/index.ts");

const college = sportOf("football/college-football");
const ALABAMA = require("./fixtures/espn/college-football-401856727.json");
const UCF = require("./fixtures/espn/college-football-401856835.json");
const nameOf = (box, name) => Object.values(box.people).find((p) => p.name === name);
const named = (box, deltas) => Object.fromEntries(Object.entries(deltas).map(([w, d]) => [box.people[w]?.name ?? w, d]));
const playOf = (plays, text) => plays.find((p) => p.text.includes(text));

test("college football: Football's vocabulary but hurries for hits and no sack yards, untimed overtimes, weekly locks", () => {
  assert.ok(college instanceof CollegeFootball && college instanceof Football);
  assert.ok(allSports().includes(college));
  assert.equal(college.id, "football", "ESPN's sport slug: the defaults are football's");
  assert.equal(college.name, "College football");
  assert.deepEqual(college.leagues, ["college-football"]);
  assert.ok(!(sportById("football") instanceof CollegeFootball), "the sport's own is the NFL's");
  assert.equal(sportOf("football/nfl"), sportById("football"));
  const keys = college.stats.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.includes("HUR") && !keys.includes("QBH") && !keys.includes("SACKYDS"), "hurries, not hits; a sack's yards are rushing yards");
  assert.equal(college.stat("SACKED").kind, "count", "times sacked, from the plays (ESPN's college box hasn't it)");
  assert.deepEqual(college.stats.filter((s) => s.judged).map((s) => s.key), ["TGT", "TCK", "SOLO", "SACK", "TFL", "PD", "FF", "DSTSACK", "HUR"]);
  // Net passing yards are passing yards: a sack is a rush.
  assert.equal(college.full({ PYDS: 250, SACKED: 3 }).NPYDS, 250);
  assert.equal(college.lock, "weekly");
  assert.equal(college.where({ period: 2, half: null, clock: "5:32" }), "2nd quarter, 5:32");
  assert.equal(college.where({ period: 5, half: null, clock: "0:00" }), "overtime");
  assert.equal(college.where({ period: 6, half: null, clock: "0:00" }), "2nd overtime");
});

test("college's defaults are football's: a college roster's positions (QB, RB, WR, TE, PK) fill every slot", () => {
  const d = defaultsFor(college.id);
  assert.equal(d, defaultsFor("football"));
  for (const slot of d.slots.lineup) for (const pos of slot.takes) assert.ok(college.position(pos), `${slot.slot} takes ${pos}`);
  for (const k of Object.keys(d.scoring.points)) assert.ok(college.stat(k), k);
});

test("ESPN's college box score: its columns in Football's keys, a side's own line, the team totals, a defense without its touchdowns", () => {
  const box = college.readBox(ALABAMA);
  assert.equal(box.final, true);
  const reed = nameOf(box, "Marcel Reed");
  // No sacks taken in a college passing table: they're in his rushing.
  assert.deepEqual(reed.stats, { CMP: 14, PATT: 21, PYDS: 163, PTD: 1, INT: 2, RATT: 17, RYDS: 23, RTD: 1, FUM: 3, FUML: 1, FREC: 0 });
  assert.deepEqual(nameOf(box, "Mario Craver").stats, { RATT: 2, RYDS: 10, RTD: 0, REC: 6, RECYDS: 45, RECTD: 1 }, "no targets");
  assert.ok("HUR" in nameOf(box, "Marcus Ratcliffe").stats && !("QBH" in nameOf(box, "Marcus Ratcliffe").stats));
  // A side's own line (ESPN's "Team", a negative id): its kneel-downs.
  assert.deepEqual(box.people["-7622"], { id: "-7622", name: "Team", team: "245", position: null, stats: { RATT: 1, RYDS: -1, RTD: 0 } });
  assert.deepEqual(box.teams.map((t) => [t.abbreviation, t.home, t.score, t.stats]), [
    ["ALA", true, 31, { NPYDS: 311, CMP: 19, PATT: 30, RYDS: 68, RATT: 28, FUML: 0, INT: 1 }],
    ["TA&M", false, 20, { NPYDS: 163, CMP: 14, PATT: 21, RYDS: 115, RATT: 40, FUML: 1, INT: 2 }],
  ]);
  // ESPN's college box has no "defensiveTouchdowns": a team defense's touchdowns are the plays' alone (never a 0 to correct to).
  assert.deepEqual(box.people[defenseId("333")].stats, { DSTG: 1, DSTSACK: 2, DSTINT: 2, DSTFR: 1 });
});

test("the proof, both recorded games: the plays alone reduce to ESPN's own box score, every team total and the score", () => {
  for (const game of [ALABAMA, UCF]) {
    const box = college.readBox(game);
    const notes = [];
    const plays = college.readPlays(game, notes);
    assert.deepEqual(notes, [], `${game.header.id}: nothing the reader couldn't read`);
    const state = college.reduce(plays);
    let compared = 0;
    let judged = 0;
    for (const p of Object.values(box.people)) {
      for (const [k, v] of Object.entries(p.stats)) {
        compared++;
        if (college.stat(k).judged) {
          if ((state.lines[p.id]?.[k] ?? 0) !== v) judged++;
          continue;
        }
        assert.equal(state.lines[p.id]?.[k] ?? 0, v, `${game.header.id} ${p.name} ${k}`);
      }
    }
    assert.ok(compared >= 380, `${game.header.id}: ${compared} numbers compared`);
    assert.ok(judged <= 4, `${game.header.id}: ${judged} of the crew's calls otherwise`);
    for (const id of Object.keys(state.lines)) assert.ok(box.people[id], `${game.header.id}: ${id} is in the box`);
    for (const t of box.teams) {
      const sum = {};
      for (const p of Object.values(box.people)) {
        if (p.team !== t.id) continue;
        for (const [k, v] of Object.entries(college.full(state.lines[p.id] ?? {}))) sum[k] = (sum[k] ?? 0) + v;
      }
      for (const [k, v] of Object.entries(t.stats)) assert.equal(sum[k] ?? 0, v, `${game.header.id} ${t.abbreviation} ${k}`);
      assert.equal(state.score[t.id], t.score, `${game.header.id} ${t.abbreviation}'s score`);
    }
  }
});

test("plays: the crew's text by jersey and name; a sack the quarterback's rush, a kneel-down the team's, a pick-six, a review's call", () => {
  const box = college.readBox(ALABAMA);
  const plays = college.readPlays(ALABAMA);
  assert.equal(plays.length, 180);
  for (let i = 1; i < plays.length; i++) assert.ok(plays[i].at >= plays[i - 1].at, `${plays[i].id} in time order`);
  // The Noticed's own example: "#12 K.Russell pass complete short right to #40 J.Ford caught at ALA40, for 16 yards to the ALA41
  // (#7 D.Brooks), 1ST DOWN".
  const first = playOf(plays, "#40 J.Ford");
  assert.deepEqual(named(box, first.deltas), { "Keelon Russell": { CMP: 1, PATT: 1, PYDS: 16 }, "Josh Ford": { REC: 1, RECYDS: 16, TGT: 1 }, "Dalton Brooks": { TCK: 1, SOLO: 1 } });
  assert.deepEqual([first.kind, first.team, first.unit, college.where(first)], ["catch", "333", "4018567272", "1st quarter, 14:49"]);
  assert.deepEqual(named(box, playOf(plays, "QB hurried by #3 M.Ratcliffe and #10 M.Jones").deltas), { "Keelon Russell": { PATT: 1 }, "Red Morgan": { TGT: 1 }, "Marcus Ratcliffe": { HUR: 1 }, "Marco Jones": { HUR: 1 } });
  // A sack: the quarterback's rush for its loss, and times sacked; its tackler's sack and tackle for loss.
  assert.deepEqual(named(box, playOf(plays, "M.Reed sacked for loss of 10").deltas), { "Marcel Reed": { SACKED: 1, RATT: 1, RYDS: -10 }, "Fatutoa Henry": { TCK: 1, SOLO: 1, TFL: 1, SACK: 1 }, "Alabama Crimson Tide D/ST": { DSTSACK: 1 } });
  // "(A, B)" on a sack is a split one.
  assert.deepEqual(named(box, playOf(plays, "K.Russell sacked for loss of 5 yards to the TAM15").deltas), { "Keelon Russell": { SACKED: 1, RATT: 1, RYDS: -5 }, "Marcus Ratcliffe": { TCK: 1, TFL: 0.5, SACK: 0.5 }, "Marco Jones": { TCK: 1, TFL: 0.5, SACK: 0.5 }, "Texas A&M Aggies D/ST": { DSTSACK: 1 } });
  // Whoever kneels, it's the team's.
  assert.deepEqual(named(box, playOf(plays, "Kneel down by #10 M.Reed").deltas), { Team: { RATT: 1, RYDS: -1 } });
  // A pick-six: the interception, its return, a defensive touchdown, the try; Texas A&M's defense allowed only the try.
  const six = playOf(plays, "D.Lee Jr. at TAM39");
  assert.deepEqual(named(box, six.deltas), {
    "Marcel Reed": { PATT: 1, INT: 1 },
    "Dijon Lee Jr.": { DINT: 1, DINTYDS: 39, DINTTD: 1, DTD: 1 },
    "Alabama Crimson Tide D/ST": { DSTINT: 1, DSTTD: 1 },
    "Conor Talty": { XPA: 1, XPM: 1 },
    "Texas A&M Aggies D/ST": { PA: 1 },
  });
  assert.deepEqual(six.score, { 245: 0, 333: 7 });
  // A review made it an interception: what stood is read, not "(Original Play: ...)".
  const reviewed = playOf(plays, "C.McDonald III at TAM41");
  assert.match(reviewed.text, /Original Play:.*pass incomplete/);
  assert.deepEqual(named(box, reviewed.deltas), { "Marcel Reed": { PATT: 1, INT: 1 }, "Chuck McDonald III": { DINT: 1 }, "Alabama Crimson Tide D/ST": { DSTINT: 1 } });
});

test("overtime: each possession from the 25, untimed; a touchdown there kept; a two-point pass from the scoring plays' summary", () => {
  const box = college.readBox(UCF);
  const plays = college.readPlays(UCF);
  // The 1st overtime's touchdown, though the 2nd overtime's first play starts where it did (another drive).
  const first = playOf(plays, "J.Derry caught at BYU00");
  assert.equal(college.where(first), "overtime");
  assert.deepEqual(named(box, first.deltas), { "Keyone Jenkins": { CMP: 1, PATT: 1, PYDS: 25, PTD: 1 }, "Josh Derry": { REC: 1, RECYDS: 25, TGT: 1, RECTD: 1 }, "Will Stone": { XPA: 1, XPM: 1 }, "BYU Cougars D/ST": { PA: 7 } });
  // "#2 T.Hornes pass attempt Successful" doesn't say who threw it; the summary does: "(Keyone Jenkins Pass to Tyren Hornes for
  // Two-Point Conversion)".
  const second = playOf(plays, "T.Hornes pass attempt Successful");
  assert.equal(college.where(second), "2nd overtime");
  assert.deepEqual(named(box, second.deltas), { "Keyone Jenkins": { CMP: 1, PATT: 1, PYDS: 4, PTD: 1, P2PT: 1 }, "Grayson Brousseau": { REC: 1, RECYDS: 4, TGT: 1, RECTD: 1 }, "Tyren Hornes": { RE2PT: 1 }, "BYU Cougars D/ST": { PA: 8 } });
  assert.equal(college.full(college.reduce(plays).lines[nameOf(box, "Keyone Jenkins").id])["2PT"], 1);
  assert.deepEqual(college.reduce(plays).score, { 252: 31, 2116: 39 });
});

test("a game as of a moment: the half, then the final", () => {
  const plays = college.readPlays(ALABAMA);
  const half = plays.find((p) => p.text === "End of 2nd quarter.");
  const at = college.stateAt(ALABAMA, half.at);
  assert.deepEqual(at.score, { 245: 17, 333: 17 });
  assert.equal(at.last.text, "End of 2nd quarter.");
  assert.ok(at.plays < plays.length);
  assert.deepEqual(college.stateAt(ALABAMA, "2026-10-24T19:00:00Z").score, { 245: 0, 333: 0 }, "before the kickoff, 0-0 from the header's sides");
  assert.deepEqual(college.stateAt(ALABAMA).score, { 245: 20, 333: 31 });
});

test("the final's correction: only the stat crew's calls, and with it every number of ESPN's box score; none live", () => {
  for (const game of [ALABAMA, UCF]) {
    const box = college.readBox(game);
    const correction = college.correction(college.reduce(college.readPlays(game)), box);
    for (const [who, d] of Object.entries(correction)) for (const k of Object.keys(d)) assert.ok(college.stat(k).judged, `${box.people[who].name} ${k}`);
    const end = college.reduce(college.timeline(game));
    for (const p of Object.values(box.people)) for (const [k, v] of Object.entries(p.stats)) assert.equal(end.lines[p.id]?.[k] ?? 0, v, `${p.name} ${k}`);
  }
  const live = JSON.parse(JSON.stringify(ALABAMA));
  live.header.competitions[0].status.type = { state: "in", completed: false };
  assert.ok(!college.timeline(live).some((p) => p.final));
  live.drives.current = live.drives.previous.pop();
  assert.equal(college.readPlays(live).length, college.readPlays(ALABAMA).length, "a drive going on is read too");
});

// A made-up game for the rules the recorded ones don't show: the away side (1, ESPN's "ZTA") against the home side (2, "ZHM"),
// the text using ESPN's codes unless a test says otherwise; people by jersey ("#1 A.Arm"); each side's own line (ESPN's "Team").
// A spot's yard line is from the home side's goal line.
const AWAY = [["a1", "Al Arm", "1"], ["a2", "Bo Back", "2"], ["a3", "Cy Catch", "3"], ["a4", "Kit Kicker", "4"], ["a5", "Pat Punter", "5"], ["a7", "Lou Line", "7"]];
const HOME = [["h1", "Dee Def", "11"], ["h2", "Eli End", "12"], ["h3", "Fay Free", "13"], ["h4", "Hal Hold", "14"], ["h5", "Ike Iron", "15"], ["h6", "Jo Jumper", "16"]];
function made(plays, { codes = ["ZTA", "ZHM"], people = [AWAY, HOME], scoring = [] } = {}) {
  const rows = (list) => list.map(([id, displayName, jersey]) => ({ athlete: { id, displayName, jersey }, stats: [] }));
  const side = (team, abbr, list, own) => ({
    team: { id: team, abbreviation: abbr },
    statistics: [
      { name: "defensive", labels: ["TOT"], athletes: rows(list) },
      { name: "rushing", labels: ["CAR"], athletes: [{ athlete: { id: own, displayName: " Team" }, stats: [] }] },
      // Each side's one passer and one punter (a punt with no name, a pick-six's passer).
      { name: "passing", labels: ["C/ATT"], athletes: rows(list.slice(0, 1)) },
      { name: "punting", labels: ["NO"], athletes: rows(list.filter(([, n]) => /Punter|Jumper/.test(n))) },
    ],
  });
  const start = { text: "Timeout Zeta Away, clock 15:00", type: "Timeout", down: 0 };
  return {
    header: {
      id: "zt9",
      season: { type: 2 },
      competitions: [{ status: { type: { state: "post", completed: true, detail: "Final" } }, competitors: [{ homeAway: "away", score: "0", team: { id: "1", abbreviation: codes[0], displayName: "Zeta Away" } }, { homeAway: "home", score: "0", team: { id: "2", abbreviation: codes[1], displayName: "Zeta Home" } }] }],
    },
    boxscore: { players: [side("1", codes[0], people[0], "-901"), side("2", codes[1], people[1], "-902")], teams: [] },
    scoringPlays: scoring,
    drives: {
      previous: [
        {
          id: "zd1",
          team: { id: "1" },
          plays: [start, ...plays].map((p, i) => ({
            id: p.id ?? `z${i}`,
            type: { text: p.type ?? "Play" },
            text: p.text,
            awayScore: p.score?.[0] ?? 0,
            homeScore: p.score?.[1] ?? 0,
            period: { number: 1 },
            clock: { displayValue: `${14 - (i % 14)}:00` },
            wallclock: `2026-10-24T17:${String(i).padStart(2, "0")}:00Z`,
            start: { team: { id: p.team ?? "1" }, down: p.down ?? 1 + (i % 3), distance: 10, yardLine: p.los ?? 30 + i },
            ...(p.end != null ? { end: { yardLine: p.end } } : {}),
            ...(p.sy != null ? { statYardage: p.sy } : {}),
          })),
        },
      ],
    },
  };
}
const deltas = (game) => college.readPlays(game).slice(1).map((p) => p.deltas);

test("the NCAA's counting: spikes, grounding, kneels and fumbled snaps; fumbles, recoveries and muffs; blocked and nameless punts", () => {
  const d = deltas(
    made([
      // A spike is the team's attempt; intentional grounding a sack (ESPN gives its loss), never an attempt.
      { text: "(00:30) No Huddle-Shotgun #1 A.Arm pass incomplete, Spike" },
      { text: "(00:20) Shotgun #1 A.Arm pass incomplete short right thrown to ZHM40 QB hurried by #11 D.Def PENALTY ZTA Intentional Grounding (#1 A.Arm)", type: "Sack", sy: -9 },
      { text: "Kneel down by #1 A.Arm at ZTA30 for loss of 1 yard" },
      // A team's rush is a fumbled snap: the team's fumble, said or not.
      { text: "No Huddle-Shotgun Zeta Away rush middle for 4 yards loss to the ZTA26, End Of Play" },
      // Recovered by a teammate: a fumble, not a recovery (the NCAA's is the other side's only).
      { text: "Shotgun #2 B.Back rush right for 3 yards gain to the ZTA36 fumbled by #2 B.Back at ZTA36 recovered by ZTA #3 C.Catch at ZTA36, End Of Play" },
      { text: "Shotgun #2 B.Back rush right for 2 yards gain to the ZTA38 fumbled by #2 B.Back at ZTA38 forced by #13 F.Free recovered by ZHM #11 D.Def at ZTA38, End Of Play" },
      // A muffed punt his side kept: his fumble, and his return to where it was got back.
      { text: "#5 P.Punter punt 40 yards to the ZHM20 muffed by #16 J.Jumper at ZHM20 recovered by ZHM #14 H.Hold at ZHM22, End Of Play" },
      // A blocked punt is the team's.
      { text: "#5 P.Punter punt 9 yards to the ZTA36 blocked by #12 E.End, out of bounds at ZTA36" },
      // A punt with no name is the side's punter's.
      { text: "(07:22)  punt 41 yards to the ZHM12 #16 J.Jumper return 2 yards to the ZHM14 (#7 L.Line)" },
    ])
  );
  assert.deepEqual(d[0], { "-901": { PATT: 1 } });
  assert.deepEqual(d[1], { a1: { SACKED: 1, RATT: 1, RYDS: -9 }, h1: { HUR: 1 }, "def:2": { DSTSACK: 1 } });
  assert.deepEqual(d[2], { "-901": { RATT: 1, RYDS: -1 } });
  assert.deepEqual(d[3], { "-901": { RATT: 1, RYDS: -4, FUM: 1 } });
  assert.deepEqual(d[4], { a2: { RATT: 1, RYDS: 3, FUM: 1 } });
  assert.deepEqual(d[5], { a2: { RATT: 1, RYDS: 2, FUM: 1, FUML: 1 }, h3: { FF: 1 }, h1: { FREC: 1 }, "def:2": { DSTFR: 1 } });
  assert.deepEqual(d[6], { a5: { PUNT: 1, PUNTYDS: 40 }, h6: { FUM: 1, PR: 1, PRYDS: 2 } });
  assert.deepEqual(d[7], { "-901": { PUNT: 1, PUNTYDS: 9 }, h2: { BLKK: 1 }, "def:2": { DSTBLK: 1 } });
  assert.deepEqual(d[8], { a5: { PUNT: 1, PUNTYDS: 41, PUNTIN20: 1 }, h6: { PR: 1, PRYDS: 2 }, a7: { TCK: 1, SOLO: 1 } });
});

test("yards and tries: a spot foul behind a return, a run's own count to the foul, a lateral, an illegal pass, a try told again", () => {
  const d = deltas(
    made([
      // The returning side's foul behind the return: it counts only to the foul's spot.
      { text: "#4 K.Kicker kickoff 65 yards to the ZHM00 #16 J.Jumper return 30 yards to the ZHM30 (#2 B.Back) PENALTY ZHM Holding (#15 I.Iron) 10 yards from ZHM20 to ZHM10", los: 35 },
      // "gain (16)": the text counts it to the foul already.
      { text: "#2 B.Back rush left for 17 yards gain (16) to the ZHM40 (#13 F.Free) PENALTY ZTA Holding (#7 L.Line) 10 yards from ZHM41 to ZHM49" },
      // A lateral ending where the catch's yards ended: those were the whole play's.
      { text: "#1 A.Arm pass complete short right to #3 C.Catch caught at ZTA45, for 30 yards to the ZHM33 lateral to #2 B.Back for 7 yards gain to the ZHM33 (#13 F.Free)", los: 37 },
      { text: "#1 A.Arm pass complete short right to #3 C.Catch caught at ZHM40, for 1 yard to the ZHM39 PENALTY ZTA Illegal Forward Pass (#1 A.Arm) 5 yards from ZHM39 to ZHM44" },
      // A try told again after a penalty on it: once.
      { text: "#2 B.Back rush middle for 2 yards gain to the ZHM00 TOUCHDOWN, clock 03:00 #4 K.Kicker kick attempt good (H: #5 P.Punter, LS: #7 L.Line) PENALTY #4 K.Kicker kick attempt good (H: #5 P.Punter, LS: #7 L.Line) PENALTY ZHM Roughing The Kicker (#12 E.End) 15 yards, assessed on the kickoff. #4 K.Kicker kick attempt good (H: #5 P.Punter, LS: #7 L.Line)", score: [7, 0], los: 98 },
      // "NO PLAY" on the try voids the try only.
      { text: "#1 A.Arm pass complete short left to #3 C.Catch caught at ZHM00, for 9 yards to the ZHM00 TOUCHDOWN, clock 02:00 #1 A.Arm rush attempt failed #1 A.Arm rush attempt failed PENALTY ZHM Face Mask (#11 D.Def) 2 yards from ZHM03 to ZHM02. NO PLAY", score: [13, 0], los: 91 },
      { text: "#1 A.Arm pass incomplete short left to #3 C.Catch thrown to ZHM10 PENALTY ZHM Pass Interference (#11 D.Def) 15 yards from ZHM40 to ZHM25, 1ST DOWN. NO PLAY" },
      // A count to the foul's spot that's less than none.
      { text: "Shotgun #2 B.Back rush right for 2 yards gain (-10) to the ZTA35 (#11 D.Def) PENALTY ZTA Holding (#7 L.Line) 10 yards from ZTA25 to ZTA15" },
      // Declined, with its fouler named: the pass stands.
      { text: "#1 A.Arm pass incomplete short right to #3 C.Catch thrown to ZHM40 PENALTY ZTA Intentional Grounding (#1 A.Arm) declined", type: "Sack", sy: -9 },
      // A touchdown pass to someone the box hasn't: still the passer's; the fouler in a penalty isn't a tackler.
      { text: "#1 A.Arm pass complete short left to #88 Q.Unknown caught at ZHM05, for 5 yards to the ZHM00 TOUCHDOWN, clock 01:00", score: [19, 0], los: 95 },
      { text: "#2 B.Back rush right for 4 yards gain to the ZTA39 (#13 F.Free) PENALTY ZTA Holding (#7 L.Line) ZHM Personal Foul (#11 D.Def) 25 yards" },
    ])
  );
  assert.deepEqual(d[0], { h6: { KR: 1, KRYDS: 20 }, a2: { TCK: 1, SOLO: 1 } });
  assert.deepEqual(d[1], { a2: { RATT: 1, RYDS: 16 }, h3: { TCK: 1, SOLO: 1 } });
  assert.deepEqual(d[2], { a1: { CMP: 1, PATT: 1, PYDS: 30 }, a3: { REC: 1, RECYDS: 23, TGT: 1 }, a2: { RECYDS: 7 }, h3: { TCK: 1, SOLO: 1 } });
  assert.deepEqual(d[3], {}, "a pass from past the line isn't one");
  assert.deepEqual(d[4], { a2: { RATT: 1, RYDS: 2, RTD: 1 }, a4: { XPA: 1, XPM: 1 }, "def:2": { PA: 7 } });
  assert.deepEqual(d[5], { a1: { CMP: 1, PATT: 1, PYDS: 9, PTD: 1 }, a3: { REC: 1, RECYDS: 9, TGT: 1, RECTD: 1 }, "def:2": { PA: 6 } });
  assert.deepEqual(d[6], {});
  assert.deepEqual(d[7], { a2: { RATT: 1, RYDS: -10 }, h1: { TCK: 1, SOLO: 1, TFL: 1 } });
  assert.deepEqual(d[8], { a1: { PATT: 1 }, a3: { TGT: 1 } });
  assert.deepEqual(d[9], { a1: { CMP: 1, PATT: 1, PYDS: 5, PTD: 1 }, "def:2": { PA: 6 } });
  assert.deepEqual(d[10], { a2: { RATT: 1, RYDS: 4 }, h3: { TCK: 1, SOLO: 1 } });
});

test("scoring: a two-point pass from the scoring plays, a pick-six only summarized, return touchdowns, a safety", () => {
  const d = deltas(
    made(
      [
        { id: "td", text: "#1 A.Arm pass complete short left to #3 C.Catch caught at ZHM00, for 5 yards to the ZHM00 TOUCHDOWN, clock 02:00 #2 B.Back pass attempt Successful", score: [8, 0], los: 95 },
        // A pick-six ESPN tells only as a summary: the interception is the returner's, the side's passer threw it.
        { team: "1", text: "Dee Def 52 Yd Interception Return (Two-Point Pass Conversion Failed)", score: [8, 6] },
        // A return touchdown is a defensive one too in college's box.
        { team: "1", text: "#4 K.Kicker kickoff 65 yards to the ZHM00 #16 J.Jumper return 100 yards to the ZTA00 TOUCHDOWN, clock 01:31", score: [8, 12], los: 35 },
        { team: "1", text: "#2 B.Back rush middle for 2 yards loss to the ZTA00 (#11 D.Def). Zeta Home SAFETY, clock 01:00", score: [8, 14], los: 2 },
        // An interception's own (no summary): the returner's yards, the side's interception.
        { text: "#1 A.Arm pass intercepted by #13 F.Free at ZHM30 QB hurried by #12 E.End #13 F.Free return 12 yards to the ZHM42 (#3 C.Catch)" },
      ],
      { scoring: [{ id: "td", text: "Cy Catch 5 Yd pass from Al Arm (Al Arm Pass to Bo Back for Two-Point Conversion)" }] }
    )
  );
  assert.deepEqual(d[0], { a1: { CMP: 1, PATT: 1, PYDS: 5, PTD: 1, P2PT: 1 }, a3: { REC: 1, RECYDS: 5, TGT: 1, RECTD: 1 }, a2: { RE2PT: 1 }, "def:2": { PA: 8 } });
  assert.deepEqual(d[1], { h1: { DINT: 1, DINTYDS: 52, DINTTD: 1, DTD: 1 }, "def:2": { DSTTD: 1, DSTINT: 1 }, a1: { PATT: 1, INT: 1 } });
  assert.deepEqual(d[2], { h6: { KR: 1, KRYDS: 100, KRTD: 1, DTD: 1 }, "def:2": { DSTTD: 1 }, "def:1": { PA: 6 } });
  assert.deepEqual(d[3], { a2: { RATT: 1, RYDS: -2 }, h1: { TCK: 1, SOLO: 1, TFL: 1 }, "def:2": { DSTSAF: 1 } });
  assert.deepEqual(d[4], { a1: { PATT: 1, INT: 1 }, h2: { HUR: 1 }, h3: { DINT: 1, DINTYDS: 12 }, "def:2": { DSTINT: 1 }, a3: { TCK: 1, SOLO: 1 } });
});

test("reading the text: team codes from ESPN's yard lines, a number learned from the game, another feed's phrases, a review", () => {
  // The home crew's codes, not ESPN's: "ZTA" and "ZHM" placed by where ESPN says each play ended.
  const game = made(
    [
      { text: "#2 B.Back rush left for 5 yards gain to the ZTA35 (#11 D.Def)", los: 70, end: 65 },
      { text: "#2 B.Back rush left for 20 yards gain to the ZHM45 (#11 D.Def)", los: 65, end: 45 },
      // The returning side's foul, which only its code can place.
      { text: "#5 P.Punter punt 40 yards to the ZHM25 #16 J.Jumper return 15 yards to the ZHM40 (#2 B.Back) PENALTY ZHM Holding (#15 I.Iron) 10 yards from ZHM28 to ZHM18", los: 55 },
      // "#9 M.Williams": the box has Mo Williams as #9 and Max Williams as #24, whose "#24 M.Williams" the text has too: the
      // number no box line has is the Williams left.
      { text: "#1 A.Arm pass complete short left to #2 M.Williams caught at ZHM40, for 5 yards to the ZHM40 (#11 D.Def)", los: 45, end: 40 },
      { text: "#1 A.Arm pass complete short left to #24 M.Williams caught at ZHM35, for 5 yards to the ZHM35 (#11 D.Def)", los: 40, end: 35 },
      // ESPN's own phrases, initials or full names.
      { text: "A. Arm pass to C. Catch for 20 yds, for a TD (K. Kicker KICK)", score: [7, 0] },
      { text: "B. Back run for 9 yds" },
      // A review: what stood, before "(Original Play: ...)".
      { text: "(04:00) #2 B.Back rush right for 4 yards gain to the ZHM26 (#11 D.Def). The previous play is under review. CALL OVERTURNED. (Original Play: #2 B.Back rush right for 5 yards gain to the ZHM25 (#11 D.Def), 1ST DOWN)", los: 30, end: 26 },
    ],
    { codes: ["ZA", "ZH"], people: [[...AWAY, ["a8", "Mo Williams", "9"], ["a9", "Max Williams", "24"]], HOME] }
  );
  const notes = [];
  const d = college.readPlays(game, notes).slice(1).map((p) => p.deltas);
  assert.deepEqual(notes, []);
  assert.deepEqual(d[2], { a5: { PUNT: 1, PUNTYDS: 40 }, h6: { PR: 1, PRYDS: 3 }, a2: { TCK: 1, SOLO: 1 } });
  assert.deepEqual(d[3], { a1: { CMP: 1, PATT: 1, PYDS: 5 }, a8: { REC: 1, RECYDS: 5, TGT: 1 }, h1: { TCK: 1, SOLO: 1 } });
  assert.deepEqual(d[4], { a1: { CMP: 1, PATT: 1, PYDS: 5 }, a9: { REC: 1, RECYDS: 5, TGT: 1 }, h1: { TCK: 1, SOLO: 1 } });
  assert.deepEqual(d[5], { a1: { CMP: 1, PATT: 1, PYDS: 20, PTD: 1 }, a3: { REC: 1, RECYDS: 20, TGT: 1, RECTD: 1 }, a4: { XPA: 1, XPM: 1 }, "def:2": { PA: 7 } });
  assert.deepEqual(d[6], { a2: { RATT: 1, RYDS: 9 } });
  assert.deepEqual(d[7], { a2: { RATT: 1, RYDS: 4 }, h1: { TCK: 1, SOLO: 1 } });

  const phrases = made([
    { text: "Bo Back run for 0 yards" },
    { text: "Al Arm pass complete to Cy Catch for a loss of 2 yards to the ZTA28" },
    { text: "Al Arm sacked by Dee Def for a loss of 7 yards to the ZTA21" },
    { text: "Al Arm pass incomplete to Cy Catch" },
    { text: "Kit Kicker kickoff for 65 yds for a touchback" },
    { text: "Pat Punter punt for 41 yds, Jo Jumper returns for 6 yds to the ZHM30" },
    { text: "Kit Kicker 33 yd FG GOOD" },
    // A side's own rush by its name, the crew's (a fumbled snap), though no formation word is in front.
    { text: "(01:16) Zeta Away rush middle for 3 yards loss to the ZTA27, End Of Play" },
    // A two-point run when the scoring plays haven't it yet.
    { text: "#2 B.Back rush middle for 3 yards gain to the ZHM00 TOUCHDOWN, clock 00:30 #2 B.Back rush attempt Successful", score: [8, 0], los: 97 },
  ]);
  const pn = [];
  const pd = college.readPlays(phrases, pn).slice(1).map((p) => p.deltas);
  assert.deepEqual(pn, []);
  assert.deepEqual(pd.slice(0, 8), [
    { a2: { RATT: 1 } },
    { a1: { CMP: 1, PATT: 1, PYDS: -2 }, a3: { REC: 1, RECYDS: -2, TGT: 1 } },
    { a1: { SACKED: 1, RATT: 1, RYDS: -7 }, "def:2": { DSTSACK: 1 } },
    { a1: { PATT: 1 }, a3: { TGT: 1 } },
    {},
    { a5: { PUNT: 1, PUNTYDS: 41 }, h6: { PR: 1, PRYDS: 6 } },
    { a4: { FGA: 1, FGM: 1, FGM30: 1 } },
    { "-901": { RATT: 1, RYDS: -3, FUM: 1 } },
  ]);
  assert.deepEqual(pd[8], { a2: { RATT: 1, RYDS: 3, RTD: 1, R2PT: 1 }, "def:2": { PA: 8 } });
});
