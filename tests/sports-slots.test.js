// Step 2.3 (docs/PLAN-sports-ready.md): lineup slots for every team sport, not football's alone. The NBA's (PG, SG, G, SF, PF, F, 2 C,
// 2 Util), MLB's and the NHL's defaults' slots go on their standard games; a slot takes ESPN's positions or the sport's position
// groups. MLB's roster lists every position a player has played, so a player fills each in his own group, and a two-way player
// (listed as a starting pitcher) the pitchers' too (eligibleFor, stamped per read as state.castEligible). Computer players draft a
// team that can fill every slot and sit anyone out injured or with no game. Rosters as ESPN lists them (checked 2026-11-20: the
// NBA's say G, F or C; the NHL's C, LW, RW, D, G), names made up. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Bots = require("../src/lib/game/bot-logic.js");
const { defaultsFor, eligibleFor, sportOf, groupOf, specContextOf } = jiti("../src/lib/sports/index.ts");
const { readRoster } = jiti("../src/lib/server/sports/espn.ts");

const slotsOf = (league) => defaultsFor(league.split("/")[0], league).specs.season.spec.count.slots;

// A lineup game on a league's defaults' season spec: [id, ESPN position, points], each castaway's group stamped as the server does.
function game(league, roster, { bots = [], each = roster.length, eligible = {}, injuries, episode = {} } = {}) {
  const sport = sportOf(league);
  const d = defaultsFor(sport.id, league).specs.season.spec;
  // Its waivers' swaps held to the team (step 2.5: the NFL's "no limit" is the team's size).
  const w = d.extras && d.extras.waivers;
  const spec = { ...d, get: { by: "draft", each, order: "snake", own: "exclusive" }, ...(w ? { extras: { ...d.extras, waivers: { ...w, windows: { ...w.windows, swaps: Math.min(w.windows.swaps, each) } } } } : {}) };
  const people = ["ann", ...bots];
  const s = S.migrateLeagueState({
    settings: { ...G.settingsOf(spec), showFormat: "survivor" },
    players: people.map((id) => ({ id, name: id, color: "#000", active: true, ...(bots.includes(id) ? { automated: true } : {}) })),
    draftOrder: people,
    tribes: [{ id: "t1", name: "Rivertown" }, { id: "t2", name: "Lakeside" }],
    castaways: roster.map(([id, , , team]) => ({ id, name: id.toUpperCase(), status: "active", tribeId: team || "t1", ownerIds: [bots[0] || "ann"], placementOrder: null, exitMethod: null, exitEpisodeId: null })),
    episodes: [{ id: "ep1", number: 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {}, ...episode }],
  });
  s.castProps = Object.fromEntries(roster.map(([id, pos]) => [id, { position: pos }]));
  s.castPropDefs = [];
  s.statGroups = Object.fromEntries(roster.map(([id, pos]) => [id, groupOf(sport, pos)]));
  if (Object.keys(eligible).length) s.castEligible = eligible;
  if (injuries) s.castInjuries = injuries;
  return s;
}

test("every team sport's standard games carry its slots; a lineup of one slot taking everyone carries none", () => {
  const said = (league) => slotsOf(league).map((x) => `${x.n} ${x.label}`).join(", ");
  assert.equal(said("basketball/nba"), "1 PG, 1 SG, 1 G, 1 SF, 1 PF, 1 F, 2 C, 2 Util");
  assert.equal(said("basketball/wnba"), "1 PG, 1 SG, 1 G, 1 SF, 1 PF, 1 F, 2 C, 2 Util");
  assert.equal(said("baseball/mlb"), "1 C, 1 1B, 1 2B, 1 3B, 1 SS, 3 OF, 2 Util, 2 SP, 2 RP, 4 P");
  assert.equal(said("hockey/nhl"), "2 C, 2 LW, 2 RW, 4 D, 2 G");
  assert.equal(said("football/nfl"), "1 QB, 2 WR, 2 RB, 1 TE, 1 W/R/T, 1 K, 1 DEF", "football's as it was");
  assert.equal(slotsOf("soccer/eng.1").length, 5, "soccer's formation: a keeper, 3 defenders, 2 midfielders, a forward, 4 outfield");
  for (const league of ["golf/pga", "racing/f1", "mma/ufc", "tennis/atp"]) {
    const d = defaultsFor(league.split("/")[0], league);
    assert.ok(!Object.values(d.specs).some((x) => x.spec.count && x.spec.count.slots), `${league}: none`);
  }
  // Each spec that counts exactly the lineup gets them (categories and roto too); best ball's best N too. Every value one the sport
  // knows (a position or a position group), and the spec passes its own check.
  for (const league of ["basketball/nba", "baseball/mlb", "hockey/nhl", "soccer/eng.1"]) {
    const sport = sportOf(league);
    const d = defaultsFor(sport.id, league);
    for (const id of Object.keys(d.specs)) {
      const c = d.specs[id].spec.count;
      if (c && (c.start || c.best)) assert.ok(c.slots, `${league} ${id} has slots`);
    }
    for (const x of slotsOf(league)) for (const v of x.values) assert.ok(sport.position(v) || sport.groups.some((g) => g.key === v), `${league} ${x.label} takes ${v}`);
    assert.deepEqual(G.specProblems(d.specs.season.spec, specContextOf(sport, league.split("/")[1])).filter((p) => /count/.test(p.at)), [], league);
  }
});

test("the NBA: ESPN's G, F and C fill its slots; five centers don't (two in C, two in Util)", () => {
  // ESPN's NBA rosters say only G, F or C: a guard fills PG, SG or G, a forward SF, PF or F, anyone Util.
  const roster = [["g1", "G"], ["g2", "G"], ["g3", "G"], ["f1", "F"], ["f2", "F"], ["f3", "F"], ["c1", "C"], ["c2", "C"], ["g4", "G"], ["f4", "F"], ["c3", "C"], ["c4", "C"], ["c5", "C"]];
  const s = game("basketball/nba", roster);
  assert.ok(S.SlotLogic.on(s));
  const ten = ["g1", "g2", "g3", "f1", "f2", "f3", "c1", "c2", "g4", "f4"];
  assert.equal(S.ActiveRosterLogic.validateLineup(s, "ep1", "ann", ten), null);
  // Each guard in a guard's slot, each forward in a forward's (which of PG, SG and G is the sheet's tidying: all three take any G).
  const kind = { PG: "g", SG: "g", G: "g", SF: "f", PF: "f", F: "f", C: "c" };
  for (const x of S.SlotLogic.assignment(s, ten)) assert.ok(x.label === "Util" || x.id.startsWith(kind[x.label]), `${x.label}:${x.id}`);
  assert.match(S.ActiveRosterLogic.validateLineup(s, "ep1", "ann", ["c1", "c2", "c3", "c4", "c5"]) || "", /C5 has no open slot: the lineup is 1 PG, 1 SG, 1 G, 1 SF, 1 PF, 1 F, 2 C, 2 Util/);
});

test("the NHL: two goalies at most, four defensemen", () => {
  const roster = [["c1", "C"], ["c2", "C"], ["l1", "LW"], ["l2", "LW"], ["r1", "RW"], ["r2", "RW"], ["d1", "D"], ["d2", "D"], ["d3", "D"], ["d4", "D"], ["g1", "G"], ["g2", "G"], ["g3", "G"]];
  const s = game("hockey/nhl", roster);
  assert.equal(S.ActiveRosterLogic.validateLineup(s, "ep1", "ann", roster.slice(0, 12).map((r) => r[0])), null);
  assert.match(S.ActiveRosterLogic.validateLineup(s, "ep1", "ann", ["g1", "g2", "g3"]) || "", /G3 has no open slot/);
});

test("MLB: a player fills each position he's played in his own group; a two-way player the pitchers' too", () => {
  const mlb = "baseball/mlb";
  assert.deepEqual(eligibleFor(mlb, "SS", ["2B", "3B", "SS", "DH", "PH"]), ["2B", "3B", "DH", "PH"]);
  assert.deepEqual(eligibleFor(mlb, "RP", ["RP", "P", "SP"]), ["P", "SP"], "a reliever who's started fills SP");
  assert.deepEqual(eligibleFor(mlb, "DH", ["P", "DH", "SP"]), ["SP", "pitchers"], "a two-way player: SP, and so the pitchers' P");
  assert.deepEqual(eligibleFor(mlb, "C", ["RP", "P", "C", "1B", "PH"]), ["1B", "PH"], "not a catcher who pitched in a blowout");
  assert.deepEqual(eligibleFor(mlb, "SS", null), []);
  assert.deepEqual(eligibleFor("basketball/nba", "G", ["G", "F"]), [], "a league with no rule: the roster's one");
  assert.deepEqual(eligibleFor("baseball/zt-mlb-check", "SS", ["2B"]), ["2B"], "a check's stand-in reads as MLB");

  // On a lineup: a shortstop fills 2B, the two-way player SP or P, and nobody else crosses over.
  const roster = [["c1", "C"], ["b1", "1B"], ["s1", "SS"], ["s2", "SS"], ["t1", "3B"], ["o1", "LF"], ["o2", "CF"], ["o3", "RF"], ["u1", "DH"], ["tw", "DH"], ["sp1", "SP"], ["rp1", "RP"], ["rp2", "RP"], ["p1", "SP"], ["p2", "SP"], ["p3", "RP"]];
  const eligible = { s2: eligibleFor(mlb, "SS", ["2B", "SS"]), tw: eligibleFor(mlb, "DH", ["P", "DH", "SP"]) };
  const s = game(mlb, roster, { eligible, each: 23 });
  // Two other designated hitters in the Utils: the two-way player pitches.
  const lineup = ["c1", "b1", "s2", "t1", "s1", "o1", "o2", "o3", "u1", "u2", "tw", "sp1", "rp1", "rp2", "p1", "p2", "p3"];
  const s2 = game(mlb, [...roster, ["u2", "DH"]], { eligible, each: 23 });
  assert.equal(S.ActiveRosterLogic.validateLineup(s2, "ep1", "ann", lineup), null, "s2 at 2B, the two-way player at SP or P");
  const at = Object.fromEntries(S.SlotLogic.assignment(s2, lineup).filter((x) => x.id).map((x) => [x.id, x.label]));
  assert.equal(at.s2, "2B");
  assert.ok(["SP", "P"].includes(at.tw), at.tw);
  // Without his listing the shortstop doesn't fill 2B.
  const plain = game(mlb, roster, { each: 23 });
  assert.match(S.ActiveRosterLogic.validateLineup(plain, "ep1", "ann", ["s1", "s2", "u1", "tw"]) || "", /has no open slot/);
  assert.equal(S.ActiveRosterLogic.validateLineup(s, "ep1", "ann", ["s1", "s2", "u1", "tw"]), null);
});

test("ESPN's roster: every position it lists a player at, as abbreviations", () => {
  const raw = { athletes: [
    { position: "Designated Hitter", items: [{ id: "1", displayName: "Kenji Ota", position: { abbreviation: "DH" }, positions: [{ abbreviation: "P" }, { abbreviation: "DH" }, { abbreviation: "SP" }] }] },
    { position: "Infielders", items: [{ id: "2", displayName: "Rafael Soto", position: { abbreviation: "SS" } }] },
  ] };
  const [two, one] = readRoster(raw);
  assert.deepEqual(two.positions, ["P", "DH", "SP"]);
  assert.equal(one.positions, undefined);
});

test("computer players draft a team that fills its slots, and sit anyone out or with no game", () => {
  // MLB's 18 starters from 18 picks: a bot that rates shortstops best still ends with a catcher, outfielders and pitchers.
  const mlb = "baseball/mlb";
  const need = slotsOf(mlb).flatMap((x) => Array(x.n).fill(x.values[0] === "batters" ? "DH" : x.values[0] === "pitchers" ? "RP" : x.values[0] === "LF" ? "CF" : x.values[0]));
  const pool = [...Array.from({ length: 30 }, (_, i) => [`ss${i}`, "SS"]), ...need.map((p, i) => [`n${i}`, p])];
  const s = game(mlb, pool, { each: need.length });
  s.castaways.forEach((c) => { c.ownerIds = []; });
  const mine = ["ss0", "ss1", "ss2"];
  const all = pool.map((r) => r[0]).filter((id) => !mine.includes(id));
  assert.deepEqual(S.SlotLogic.draftKeeps(s, mine, all, 18), all, "room to spare: anyone");
  // Three shortstops fill SS and both Utils: with 15 picks for the 15 slots still open, no fourth.
  const tight = S.SlotLogic.draftKeeps(s, mine, all, 15);
  assert.ok(tight.length && tight.every((id) => !id.startsWith("ss")), "no fourth shortstop");
  // Never someone no slot takes: an offensive tackle for the NFL's lineup, while anyone else is there.
  const line = game("football/nfl", [["qb1", "QB"], ["ot1", "OT"], ["wr1", "WR"]], { each: 15 });
  assert.deepEqual(S.SlotLogic.draftKeeps(line, [], ["ot1", "qb1", "wr1"], 15), ["qb1", "wr1"]);

  // Lineups: the bot sits its injured quarterback and its receiver on a bye.
  const nfl = "football/nfl";
  const roster = [["qb1", "QB", 30], ["qb2", "QB", 10], ["rb1", "RB"], ["rb2", "RB"], ["rb3", "RB"], ["wr1", "WR", 0, "t2"], ["wr2", "WR"], ["wr3", "WR"], ["te1", "TE"], ["k1", "PK"], ["def1", "DEF"]];
  const b = game(nfl, roster, { bots: ["x1"], injuries: { qb1: { code: "O", status: "Out", date: null } }, episode: { byeTeams: ["Lakeside"] } });
  Bots.run(b);
  const set = S.ActiveRosterLogic.lineupFor(b, "ep1", "x1");
  assert.ok(set.includes("qb2") && !set.includes("qb1"), "the healthy quarterback");
  assert.ok(!set.includes("wr1"), "not the receiver on a bye");
  assert.equal(S.SlotLogic.problem(b, set), null);
});

test("the cast fill: a roster's listed positions become what each fills, by its league's rule", async () => {
  const { rosterFromEvents } = jiti("../src/lib/server/sports/cast.ts");
  const raw = { athletes: [
    { position: "Designated Hitter", items: [{ id: "1", displayName: "Kenji Ota", position: { abbreviation: "DH" }, positions: [{ abbreviation: "P" }, { abbreviation: "DH" }, { abbreviation: "SP" }] }] },
    { position: "Infielders", items: [{ id: "2", displayName: "Rafael Soto", position: { abbreviation: "SS" }, positions: [{ abbreviation: "2B" }, { abbreviation: "SS" }, { abbreviation: "PR" }] }] },
    { position: "Catchers", items: [{ id: "3", displayName: "Ned Ruiz", position: { abbreviation: "C" }, positions: [{ abbreviation: "RP" }, { abbreviation: "P" }, { abbreviation: "C" }] }] },
    { position: "Pitchers", items: [{ id: "4", displayName: "Lou Park", position: { abbreviation: "RP" } }] },
  ] };
  const provider = { id: "espn", roster: async () => readRoster(raw), teams: async () => null, boxScore: async () => null };
  const links = [{ episode: 1, provider: "espn", league: "baseball/zt-mlb-check", eventId: "e1", part: null, startsAt: null, teams: [{ id: "t1", name: "ZT Rivertown" }] }];
  const { groups } = await rosterFromEvents(links, [provider], Date.now());
  const by = Object.fromEntries(groups.flatMap((g) => g.people).map((p) => [p.name, p.eligible]));
  assert.deepEqual(by, { "Kenji Ota": ["SP", "pitchers"], "Rafael Soto": ["2B", "PR"], "Ned Ruiz": [], "Lou Park": [] });
});
