// Tennis (src/lib/sports/tennis.ts, a BoutSport in src/lib/sports/sport.ts; docs/PLAN-start-a-game-gpt.md track L, L5 part 4b): its
// vocabulary for both tours, ESPN's answer for an event (its board: every draw's matches, their sets, who won, ESPN's note) read
// into plays and results, and the proof: each recorded event's plays, reduced, come to ESPN's own numbers for every player and
// pair (their sets, games, tiebreaks and results), over the event and match by match, set by set, at the moments a match is known
// by. The recorded events (tests/fixtures/espn/, recorded by scripts/dev-test/record-espn.js) are the 2026 US Open (a Grand
// Slam's five draws and their qualifying, men's singles best of five, mixed doubles' short sets, walkovers ESPN never scheduled,
// retirements in a set and between sets), the 2025 Nitto ATP Finals (round robins, their semifinals and finals), the 2025 Qatar
// ExxonMobil Open (a doubles draw ESPN names no rounds of) and the 2026 Nordea Open (an ATP 250 and a WTA 250 on one board, a
// winner flagged nowhere). The same proof on every finished event of a tour's season is scripts/dev-test/check-draw-reduce.js
// --league=tennis/atp --season=2026. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, sportById, defaultsFor, allSports, BoutSport, FieldSport, TeamSport, MMA, Tennis, setOf, setComplete, noteWinner } = jiti("../src/lib/sports/index.ts");

const USOPEN = require("./fixtures/espn/atp-189-2026.json");
const FINALS = require("./fixtures/espn/atp-339-2025.json");
const DOHA = require("./fixtures/espn/atp-119-2025.json");
const BASTAD = require("./fixtures/espn/wta-306-2026.json");
const EVENTS = [
  ["the 2026 US Open", USOPEN],
  ["the 2025 ATP Finals", FINALS],
  ["the 2025 Qatar ExxonMobil Open", DOHA],
  ["the 2026 Nordea Open", BASTAD],
];
const tennis = sportOf("tennis/atp");
const clone = (x) => JSON.parse(JSON.stringify(x));
const idOf = (a, name) => Object.values(tennis.readBox(a).people).find((p) => p.name === name).id;
const playOf = (a, bout, kind) => tennis.readPlays(a).find((p) => p.bout === bout && p.kind === kind);
const matchOf = (a, id) => a.board.groupings.flatMap((g) => g.competitions).find((c) => String(c.id) === id);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

test("tennis's vocabulary: unique stat keys, the draws as positions, both tours, a lineup a day", () => {
  assert.ok(tennis instanceof Tennis && tennis instanceof BoutSport && !(tennis instanceof FieldSport) && !(tennis instanceof TeamSport));
  assert.equal(sportOf("tennis/wta"), tennis);
  assert.equal(sportById("tennis"), tennis);
  assert.ok(allSports().includes(tennis));
  assert.ok(sportOf("mma/ufc") instanceof MMA, "MMA's still MMA");
  assert.equal(tennis.lock, "daily");
  const keys = tennis.stats.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, "unique keys");
  for (const s of tennis.stats) assert.ok(tennis.statGroups.some((g) => g.key === s.group), `${s.key}'s group`);
  for (const k of ["MP", "W", "L", "STR", "WRET", "WRET1", "WRET5", "RET", "WWO", "LWO", "SW", "SL", "GW", "GL", "TBW", "TBL", "CS", "CSL", "QLF", "R16", "QF", "SF", "FNL", "TTL"]) assert.ok(tennis.stat(k), k);
  for (const k of ["L", "SL", "GL", "TBL", "CSL", "RET", "LWO"]) assert.equal(tennis.stat(k).better, "lower", k);
  // ESPN has no match statistics: nothing a table scores from them is in the vocabulary.
  for (const k of ["ACE", "DF", "BP", "BPW"]) assert.equal(tennis.stat(k), null, k);
  const f = tennis.full({ W: 3, L: 1, SW: 6, SL: 2, GW: 40, GL: 30 });
  assert.equal(f.WPCT, 0.75);
  assert.equal(f.SPCT, 0.75);
  assert.equal(f.GPCT, 40 / 70);
  assert.ok(!tennis.specStats().some((s) => ["WPCT", "SPCT", "GPCT"].includes(s.key)), "rates aren't scored");
  // The draws from ESPN's slugs and names.
  const draws = { "mens-singles": "MS", "Women's Singles": "WS", "mens-doubles": "MD", "Womens Doubles": "WD", "mixed-doubles": "XD", MS: "MS" };
  for (const [espn, key] of Object.entries(draws)) {
    assert.equal(tennis.positionKey(espn), key, espn);
    assert.ok(tennis.position(key), key);
  }
  assert.equal(tennis.position("MD").group, "pairs");
  assert.equal(tennis.position("WS").group, "players");
  assert.equal(tennis.positionKey(null), null);
  assert.equal(tennis.where({ period: 3, half: null, clock: null }), "the 3rd set");
  assert.equal(tennis.where({ period: 0, half: null, clock: null }), "the result");
});

test("a set from ESPN's lines: its games, its tiebreak, who won it; a match tiebreak however it's written; ESPN's note's winner", () => {
  // A set flagged; a tiebreak's points on both lines.
  assert.deepEqual(setOf({ value: 6, winner: true }, { value: 3, winner: false }, true), { games: [6, 3], tiebreak: null, winner: 0, matchTiebreak: false });
  assert.deepEqual(setOf({ value: 6, tiebreak: 4, winner: false }, { value: 7, tiebreak: 7, winner: true }, true), { games: [6, 7], tiebreak: [4, 7], winner: 1, matchTiebreak: false });
  // A match tiebreak: "1-0 (10-8)"; "0-0 (10-6)" with nobody flagged (its points say who, once it's over); "10-7" as games.
  assert.deepEqual(setOf({ value: 1, tiebreak: 10, winner: true }, { value: 0, tiebreak: 8, winner: false }, true), { games: [1, 0], tiebreak: [10, 8], winner: 0, matchTiebreak: true });
  assert.deepEqual(setOf({ value: 0, tiebreak: 6 }, { value: 0, tiebreak: 10 }, true), { games: [0, 1], tiebreak: [6, 10], winner: 1, matchTiebreak: true });
  assert.deepEqual(setOf({ value: 0, tiebreak: 6 }, { value: 0, tiebreak: 9 }, false), { games: [0, 0], tiebreak: [6, 9], winner: null, matchTiebreak: true }, "under way: nobody's yet");
  assert.deepEqual(setOf({ value: 10, winner: true }, { value: 7, winner: false }, true), { games: [1, 0], tiebreak: [10, 7], winner: 0, matchTiebreak: true });
  // Unflagged: a finished match's set by its games; one under way, nobody's.
  assert.equal(setOf({ value: 6 }, { value: 4 }, true).winner, 0);
  assert.equal(setOf({ value: 5 }, { value: 4 }, false).winner, null);
  // Complete by its games: six and two ahead, 7-5, 7-6; not 6-5 or 6-6, nor a short set's 4-1.
  for (const g of [[6, 0], [6, 4], [7, 5], [6, 7], [7, 6]]) assert.ok(setComplete(g), g.join("-"));
  for (const g of [[6, 5], [6, 6], [5, 3], [4, 1], [0, 0]]) assert.ok(!setComplete(g), g.join("-"));
  // ESPN's note: who beat whom, a pair's names, a seed; a name the note spells otherwise ("Daria" for "Darya") read by the other's.
  assert.equal(noteWinner("Jerome Kym (SUI) bt (1) Ben Shelton (USA) 6-3 6-7 (4-7) 7-6 (7-1)", [["Ben Shelton"], ["Jerome Kym"]]), 1);
  assert.equal(noteWinner("(5) Christian Harrison (USA) & Neal Skupski (GBR) bt (6) Kevin Krawietz (GER) & Tim Puetz (GER) 6-4 7-6 (8-6)", [["Kevin Krawietz", "Tim Puetz"], ["Christian Harrison", "Neal Skupski"]]), 1);
  assert.equal(noteWinner("Daria Khomutsianskaya (BLR) bt Saumya Vig (IND) 6-0 6-0", [["Darya Khomutsyanskaya"], ["Saumya Vig"]]), 0);
  assert.equal(noteWinner("Constantin Frantzén (GER) & Robin Haase (NED) bt ...", [["Robin Haase", "Constantin Frantzen"], ["Bart Stevens", "Vasil Kirkov"]]), 0, "accents");
  assert.equal(noteWinner("(8) Victoria Mboko (CAN) leads Kimberly Birrell (AUS) 6-2 6-1", [["Victoria Mboko"], ["Kimberly Birrell"]]), null, "a note that says nobody beat anybody");
  assert.equal(noteWinner(null, [["A"], ["B"]]), null);
});

test("the proof: each recorded event's plays come to ESPN's own numbers, over the event and match by match; the final's correction is nothing", () => {
  for (const [name, a] of EVENTS) {
    const notes = [];
    const plays = tennis.readPlays(a, notes);
    const box = tennis.readBox(a);
    const card = tennis.card(a);
    assert.ok(box.final, `${name} is over`);
    const state = tennis.reduce(plays, null, card);
    let numbers = 0;
    for (const [who, p] of Object.entries(box.people)) {
      assert.deepEqual(state.lines[who] ?? {}, p.stats, `${name}: ${p.name}`);
      numbers += Object.keys(p.stats).length;
    }
    for (const [bout, lines] of Object.entries(box.byBout)) for (const [who, d] of Object.entries(lines)) assert.deepEqual(state.byBout[bout]?.[who] ?? {}, d, `${name}: ${box.people[who].name} in match ${bout}`);
    assert.ok(numbers > 100, `${name}: ${numbers} numbers`);
    // The final's correction carries ESPN's results and changes no number.
    const timeline = tennis.timeline(a);
    const fin = timeline[timeline.length - 1];
    assert.ok(fin.final && fin.kind === "final");
    assert.deepEqual(fin.deltas, {}, `${name}: the final's correction`);
    assert.equal(fin.results.length, box.results.length);
    // Every match over has its result, its winner the one ESPN flags (where it flags one) and its note's.
    for (const b of card.bouts) {
      const c = matchOf(a, b.id);
      const r = box.results.find((x) => x.bout === b.id);
      assert.ok(r, `${name}: match ${b.id}'s result`);
      const flagged = c.competitors.find((x) => x.winner === true);
      if (flagged) assert.equal(r.winner, String(flagged.id), `${name}: match ${b.id}'s winner`);
      assert.equal(r.loser, b.sides.find((s) => s !== r.winner));
      assert.equal(b.sides.length, 2);
    }
    // Every match's plays: its sets in order, then its end and its result, at one moment.
    for (const b of card.bouts) {
      const mine = plays.filter((p) => p.bout === b.id && p.kind !== "reached");
      const kinds = mine.map((p) => p.kind);
      assert.equal(kinds[kinds.length - 1], "result", `${name}: match ${b.id}`);
      assert.equal(kinds[kinds.length - 2], "bout-end");
      assert.ok(kinds.slice(0, -2).every((k) => k === "set"));
      assert.deepEqual(mine.slice(0, -2).map((p) => p.period), mine.slice(0, -2).map((_, i) => i + 1));
      assert.equal(new Set(mine.map((p) => p.at)).size, 1, `${name}: match ${b.id} known at one moment`);
    }
    // Times never go back.
    const times = plays.map((p) => Date.parse(p.at));
    assert.ok(times.every((t, i) => i === 0 || t >= times[i - 1]), `${name}: in time order`);
  }
});

test("the 2026 US Open read: its draws and formats, the champions' lines, a walkover, retirements in a set and between sets, short sets", () => {
  const box = tennis.readBox(USOPEN);
  const card = tennis.card(USOPEN);
  const plays = tennis.readPlays(USOPEN);
  assert.equal(card.bouts.length, 625);
  assert.deepEqual([...new Set(card.bouts.map((b) => b.class))].sort(), ["MD", "MS", "WD", "WS", "XD"]);
  // Best of five: the men's singles main draw only; its qualifying, the women's, doubles and mixed best of three.
  for (const b of card.bouts) assert.equal(b.rounds, b.place.draw === "mens-singles" && !b.place.qualifying ? 5 : 3, `${b.place.draw} ${b.place.round}`);
  assert.equal(card.bouts.filter((b) => b.place.draw === "mens-singles" && b.place.fromFinal === 7).length, 64, "the men's first round is seven from the final");
  // The men's final: Zverev over Shelton in four.
  const zverev = idOf(USOPEN, "Alexander Zverev");
  const shelton = idOf(USOPEN, "Ben Shelton");
  const final = card.bouts.find((b) => b.place.draw === "mens-singles" && b.place.fromFinal === 1);
  assert.ok(final.main && final.title && final.sides.includes(zverev) && final.sides.includes(shelton));
  const res = box.results.find((r) => r.bout === final.id);
  assert.equal(res.winner, zverev);
  assert.equal(playOf(USOPEN, final.id, "result").text, "Alexander Zverev beat Ben Shelton 6-3 7-6 (7-2) 5-7 6-2");
  assert.equal(res.round, 4);
  assert.deepEqual(box.byBout[final.id][zverev], { GW: 24, GL: 18, SW: 3, SL: 1, TBW: 1, MP: 1, W: 1, TTL: 1 });
  assert.deepEqual(box.people[zverev].stats, { GW: 158, GL: 113, SW: 21, SL: 5, TBW: 6, TBL: 2, MP: 7, W: 7, STR: 4, R16: 1, QF: 1, SF: 1, FNL: 1, TTL: 1 });
  assert.equal(box.people[shelton].stats.L, 1);
  assert.equal(box.people[shelton].stats.FNL, 1);
  assert.equal(box.people[shelton].stats.TTL, undefined);
  assert.equal(box.people[idOf(USOPEN, "Elena Rybakina")].stats.TTL, 1);
  // A pair: its people, its matches (a walkover among them).
  const pair = box.people["2221-8017"];
  assert.equal(pair.name, "Elise Mertens / Diana Shnaider");
  assert.deepEqual(pair.members, ["2221", "8017"]);
  assert.equal(pair.type, "team");
  assert.equal(pair.bouts.length, 5);
  assert.deepEqual({ W: pair.stats.W, L: pair.stats.L, MP: pair.stats.MP, WWO: pair.stats.WWO }, { W: 3, L: 1, MP: 4, WWO: 1 });
  // The walkover ESPN never scheduled (its start the day's placeholder): known when the pair's next match starts.
  const wo = card.bouts.find((b) => b.id === "182782");
  assert.equal(wo.start, null);
  assert.equal(box.results.find((r) => r.bout === "182782").method, "WWO");
  assert.equal(playOf(USOPEN, "182782", "result").at, "2026-09-07T18:25:00Z");
  assert.deepEqual(playOf(USOPEN, "182782", "bout-end").deltas, {}, "a walkover isn't a match played");
  assert.equal(playOf(USOPEN, "182782", "result").text, "Elise Mertens / Diana Shnaider beat Marta Kostyuk / Elena-Gabriela Ruse by walkover");
  // Retirements: in the 1st set (5-0), the 2nd, the 3rd; the stopped set's games count, the set doesn't.
  const ret = (id) => box.results.find((r) => r.bout === id);
  assert.deepEqual([ret("184744").method, ret("184744").round, ret("184661").round, ret("184599").round], ["WRET", 1, 2, 3]);
  const bronzetti = idOf(USOPEN, "Lucia Bronzetti");
  assert.deepEqual(box.byBout["184744"][bronzetti], { GW: 5, MP: 1, W: 1, WRET: 1, WRET1: 1 });
  assert.deepEqual(box.byBout["184744"][card.bouts.find((b) => b.id === "184744").sides.find((s) => s !== bronzetti)], { GL: 5, MP: 1, L: 1, RET: 1 });
  // A note's stray unplayed set on a match played out ("6-1 7-6 (7-4) 0-0", ESPN's own): straight sets.
  assert.equal(ret("182823").method, null);
  assert.equal(box.byBout["182823"][ret("182823").winner].STR, 1);
  // Between sets, as ESPN writes one (Wimbledon 2026's "6-3 7-6 (9-7) 0-0 ret": its last listed set complete, flagged nowhere):
  // both sets count, retired in the 3rd.
  const w = clone(USOPEN);
  const c = matchOf(w, "182823");
  c.status = { period: 2, type: { state: "post", name: "STATUS_RETIRED" } };
  for (const x of c.competitors) delete x.linescores[1].winner;
  const wbox = tennis.readBox(w);
  const between = wbox.results.find((r) => r.bout === "182823");
  assert.deepEqual([between.method, between.round], ["WRET", 3]);
  assert.deepEqual(between.sets.map((s) => s.winner), [between.sets[0].winner, between.sets[0].winner]);
  assert.deepEqual(wbox.byBout["182823"][between.winner], { GW: 13, GL: 7, SW: 2, TBW: 1, MP: 1, W: 1, WRET: 1, WRET3: 1, R16: 1 });
  // Mixed doubles' short sets and match tiebreaks, however ESPN wrote them ("10-7" as games, "1-0 (10-6)").
  const mixedFinal = card.bouts.find((b) => b.place.draw === "mixed-doubles" && b.place.fromFinal === 1);
  assert.equal(playOf(USOPEN, mixedFinal.id, "result").text, "Karolina Muchova / Jakub Mensik beat Belinda Bencic / Flavio Cobolli 6-3 1-6 1-0 (10-6)");
  assert.equal(playOf(USOPEN, "184825", "result").text, "Erin Routliffe / Lloyd Glasspool beat Luisa Stefani / Neal Skupski 4-1 3-5 1-0 (10-7)");
  assert.deepEqual(matchOf(USOPEN, "184825").competitors.map((c) => c.linescores[2].value).sort(), [10, 7], "ESPN wrote it as games");
  // Through qualifying: the qualifying finals' winners (16 men, 16 women, 2 mixed pairs).
  assert.equal(Object.values(box.people).filter((p) => p.stats.QLF).length, 34);
  // Every match over: 621 won, 4 by walkover; a won match is a win, a played one two matches played.
  const tot = (k) => sum(Object.values(box.people).map((p) => p.stats[k] ?? 0));
  assert.deepEqual([tot("W"), tot("L"), tot("WWO"), tot("LWO"), tot("MP"), tot("WRET"), tot("RET")], [621, 621, 4, 4, 1242, 8, 8]);
  assert.equal(tot("SW"), tot("SL"));
  assert.equal(tot("GW"), tot("GL"));
  assert.equal(tot("TBW"), tot("TBL"));
  assert.equal(plays.filter((p) => p.kind === "result").length, 625);
});

test("the moments: a match known by its people's next start, done there and not before; a final 12 hours after its start; when asked", () => {
  const card = tennis.card(USOPEN);
  const plays = tennis.readPlays(USOPEN);
  // Mertens and Shnaider's first round: known when one of them (Mertens, in her singles) next played.
  const r1 = playOf(USOPEN, "182793", "result");
  assert.equal(card.bouts.find((b) => b.id === "182793").start, "2026-09-04T21:40Z");
  assert.equal(r1.at, "2026-09-05T23:05:00Z");
  const before = tennis.reduce(plays, Date.parse(r1.at) - 1, card);
  const at = tennis.reduce(plays, r1.at, card);
  assert.equal(before.bouts["182793"].stage, "pre");
  assert.equal(at.bouts["182793"].stage, "done");
  assert.equal(at.bouts["182793"].result.winner, "2221-8017");
  assert.equal(at.bouts["182793"].round, 2, "ended in its 2nd set");
  assert.equal(at.byBout["182793"]["2221-8017"].SW, 2);
  assert.equal(before.byBout["182793"], undefined);
  // The finals: 12 hours after their start, nothing later of theirs to know them by.
  const final = card.bouts.find((b) => b.place.draw === "mens-singles" && b.place.fromFinal === 1);
  assert.equal(playOf(USOPEN, final.id, "result").at, new Date(Date.parse(final.start) + 12 * 3600_000).toISOString().replace(".000Z", "Z"));
  // Nothing known before the first match is; everything at the end.
  const first = Date.parse(plays[0].at);
  assert.equal(tennis.reduce(plays, first - 1, card).results.length, 0);
  assert.equal(tennis.reduce(plays, null, card).results.length, 625);
  // As of each result, every match known by then done and none known after.
  for (const p of plays.filter((x) => x.kind === "result").filter((_, i) => i % 50 === 0)) {
    const s = tennis.reduce(plays, p.at, card);
    for (const q of plays.filter((x) => x.kind === "result")) assert.equal(s.bouts[q.bout].stage === "done", Date.parse(q.at) <= Date.parse(p.at), `as of ${p.at}: match ${q.bout}`);
  }
  // Read when asked (a recording's `_asked`, before the next starts): known then.
  const asked = { ...clone(USOPEN), _asked: "2026-09-05T03:00:00Z" };
  assert.equal(tennis.readPlays(asked).find((p) => p.bout === "182793" && p.kind === "result").at, "2026-09-05T03:00:00Z");
  assert.equal(tennis.stateAt(asked, "2026-09-05T02:59:59Z").bouts["182793"].stage, "pre");
});

test("a draw's rounds: the ATP Finals' round robin to its semifinals, the standings as of each moment, a draw ESPN names no rounds of", () => {
  const box = tennis.readBox(FINALS);
  const card = tennis.card(FINALS);
  const plays = tennis.readPlays(FINALS);
  assert.equal(card.bouts.filter((b) => b.place.group).length, 24);
  for (const b of card.bouts.filter((b) => b.place.group)) assert.equal(b.place.fromFinal, null);
  // A semifinal reached from the group stage: at the semifinal's start, not by a win.
  const sinner = idOf(FINALS, "Jannik Sinner");
  assert.deepEqual(box.people[sinner].stats, { GW: 65, GL: 40, SW: 10, MP: 5, W: 5, STR: 5, TBW: 2, SF: 1, FNL: 1, TTL: 1 });
  const reached = plays.filter((p) => p.kind === "reached");
  assert.equal(reached.length, 8, "four players and four pairs");
  const sf = card.bouts.find((b) => b.place.draw === "mens-singles" && b.place.fromFinal === 2 && b.sides.includes(sinner));
  assert.equal(reached.find((p) => p.who === sinner).at, `${sf.start.replace("Z", "")}:00Z`);
  // The standings: during the groups nobody's out; once the semifinals are set, the other four are; at the end one champion.
  const singles = (s) => tennis.draws(s, card).find((d) => d.draw === "mens-singles").entries;
  const groups = singles(tennis.reduce(plays, "2025-11-13T00:00:00Z", card));
  assert.equal(groups.length, 8);
  assert.ok(groups.every((e) => !e.out && e.round === "Group Stage" && e.fromFinal == null));
  // (The semifinals' places are known at their starts: ESPN times nothing else, so as of the second's.)
  const lastSf = card.bouts.filter((b) => b.place.draw === "mens-singles" && b.place.fromFinal === 2).map((b) => b.start).sort().pop();
  assert.equal(singles(tennis.reduce(plays, sf.start, card)).filter((e) => e.out).length, 0, "two places known: nobody out yet");
  const set = singles(tennis.reduce(plays, lastSf, card));
  assert.equal(set.filter((e) => e.out).length, 4);
  assert.equal(set.filter((e) => e.round === "Semifinal").length, 4);
  const end = singles(tennis.reduce(plays, null, card));
  assert.deepEqual(end.filter((e) => e.champion).map((e) => e.id), [sinner]);
  assert.deepEqual(end.filter((e) => !e.out).map((e) => e.id), [sinner]);
  // A knockout draw: a win reaches the next round before its match is on.
  const usCard = tennis.card(USOPEN);
  const usPlays = tennis.readPlays(USOPEN);
  const zverev = idOf(USOPEN, "Alexander Zverev");
  const sfWin = usCard.bouts.find((b) => b.place.draw === "mens-singles" && b.place.fromFinal === 2 && b.sides.includes(zverev));
  const afterSf = tennis.draws(tennis.reduce(usPlays, playOf(USOPEN, sfWin.id, "result").at, usCard), usCard).find((d) => d.draw === "mens-singles").entries.find((e) => e.id === zverev);
  assert.deepEqual([afterSf.round, afterSf.fromFinal, afterSf.out, afterSf.champion], ["Final", 1, false, false]);
  for (const d of tennis.draws(tennis.reduce(usPlays, null, usCard), usCard)) {
    assert.equal(d.entries.filter((e) => e.champion).length, 1, d.draw);
    assert.equal(d.entries.filter((e) => !e.out && !e.champion).length, 0, `${d.draw}: everyone else out`);
  }
  // A qualifier: qualifying, then into the main draw (out of qualifying's standings) once through.
  const q = Object.values(tennis.readBox(USOPEN).people).find((p) => p.stats.QLF && p.type === "athlete" && p.stats.W >= 4);
  const qe = tennis.draws(tennis.reduce(usPlays, null, usCard), usCard).flatMap((d) => d.entries).find((e) => e.id === q.id);
  assert.ok(!qe.qualifying && qe.fromFinal != null);
  const qFinal = usPlays.find((p) => p.kind === "result" && p.deltas[q.id]?.QLF);
  const entryOf = (at, who) => tennis.draws(tennis.reduce(usPlays, at, usCard), usCard).flatMap((d) => d.entries).find((e) => e.id === who);
  assert.equal(entryOf(Date.parse(qFinal.at) - 1, q.id).qualifying, true);
  assert.deepEqual([entryOf(qFinal.at, q.id).qualifying, entryOf(qFinal.at, q.id).round], [false, "Round 1"]);
  // A main-draw player before anything's played: in the round they enter, not in qualifying.
  const z = entryOf(Date.parse(usPlays[0].at) - 1, zverev);
  assert.deepEqual([z.qualifying, z.round, z.fromFinal, z.out], [false, "Round 1", 7, false]);
  // The 2025 Qatar ExxonMobil Open's doubles: no rounds from ESPN, read from its matches down to its first full round (the round
  // of 16); three before it (its qualifying, which the draw's shape can't tell from byes) left unnamed.
  const notes = [];
  tennis.readPlays(DOHA, notes);
  assert.ok(notes.some((n) => /mens-doubles: no rounds from ESPN, read from its matches \(3 before its first full round/.test(n)));
  const doubles = tennis.card(DOHA).bouts.filter((b) => b.place.draw === "mens-doubles");
  const by = (name) => doubles.filter((b) => b.place.round === name).length;
  assert.deepEqual([by("Final"), by("Semifinal"), by("Quarterfinal"), by("Round of 16"), by(null)], [1, 2, 4, 8, 3]);
  assert.equal(doubles.find((b) => b.place.fromFinal === 1).id, "168994");
  assert.equal(tennis.readBox(DOHA).people["2420-3064"].stats.TTL, 1, "Cash and Glasspool's title");
});

test("ESPN's own: a winner flagged nowhere, read from the sets or its note; a note still saying 'leads'; a match called off; places to be decided", () => {
  // The 2026 Nordea Open's women's doubles semifinal: nobody flagged, the sets say who.
  const notes = [];
  tennis.readPlays(BASTAD, notes);
  assert.ok(notes.includes("match 178710: no winner flagged, read from its sets"));
  assert.equal(playOf(BASTAD, "178710", "result").text, "Emiliana Arango / Simona Waltert beat Ya Hsin Lee / Ye Qiu Yu 6-2 6-3");
  assert.deepEqual([...new Set(tennis.card(BASTAD).bouts.map((b) => b.class))].sort(), ["MD", "MS", "WD", "WS"], "both tours on one board");
  // A retirement nobody's flagged: ESPN's note says who.
  const a = clone(USOPEN);
  const c = matchOf(a, "184744");
  for (const x of c.competitors) delete x.winner;
  const n2 = [];
  const plays = tennis.readPlays(a, n2);
  assert.ok(n2.includes("match 184744: no winner flagged, read from ESPN's note"));
  assert.equal(plays.find((p) => p.bout === "184744" && p.kind === "result").who, idOf(USOPEN, "Lucia Bronzetti"));
  // A finished match whose note still says "leads": the flags and sets stand.
  const b = clone(BASTAD);
  matchOf(b, "178710").notes[0].text = "Emiliana Arango (COL) & Simona Waltert (SUI) leads Ya Hsin Lee () & Qiu Yu Ye (CHN) 6-2 5-3";
  assert.equal(playOf(b, "178710", "result").text, "Emiliana Arango / Simona Waltert beat Ya Hsin Lee / Ye Qiu Yu 6-2 6-3");
  // Called off with nobody in it (ESPN's 2026 qualifying finals at one event): left out. Places to be decided ("TBD"): no side.
  const d = clone(BASTAD);
  const g = d.board.groupings[0];
  g.competitions.push({ id: "999001", date: "2026-07-07T04:00Z", timeValid: false, status: { period: 0, type: { state: "post", name: "STATUS_CANCELED" } }, round: { id: "14", displayName: "Qualifying Final" }, competitors: [{ id: "-4", order: 2, athlete: { displayName: "TBD" } }, { id: "-3", order: 1, athlete: { displayName: "TBD" } }] });
  assert.equal(tennis.card(d).bouts.find((x) => x.id === "999001"), undefined);
  const e = clone(BASTAD);
  const fin = e.board.groupings.flatMap((x) => x.competitions).find((x) => x.round?.displayName === "Final");
  fin.status = { period: 0, type: { state: "pre", name: "STATUS_SCHEDULED" } };
  fin.competitors[0] = { id: "-3", order: fin.competitors[0].order, athlete: { displayName: "TBD" } };
  delete fin.competitors[1].winner;
  delete fin.competitors[1].linescores;
  const bout = tennis.card(e).bouts.find((x) => x.id === String(fin.id));
  assert.equal(bout.sides.length, 1, "one place still to be decided");
  assert.equal(tennis.readBox(e).final, false);
});

test("live: a match on shows its sets so far and the set on's games at when it was asked; one to come has nothing; no final's correction", () => {
  // The 2026 Nordea Open's men's final, put back to the 2nd set: Rublev a set up, 3-2 in the 2nd.
  const a = clone(BASTAD);
  const fin = a.board.groupings.find((g) => g.grouping.slug === "mens-singles").competitions.find((c) => c.round.displayName === "Final");
  const rublev = idOf(BASTAD, "Andrey Rublev");
  fin.status = { period: 2, type: { state: "in", name: "STATUS_IN_PROGRESS" } };
  for (const x of fin.competitors) {
    delete x.winner;
    const mine = String(x.id) === rublev;
    x.linescores = [{ value: mine ? 6 : 4, winner: mine }, { value: mine ? 3 : 2 }];
  }
  a._asked = "2026-07-19T13:40:00Z";
  const plays = tennis.readPlays(a);
  const mine = plays.filter((p) => p.bout === String(fin.id));
  assert.deepEqual(mine.map((p) => p.kind), ["set", "so-far"]);
  assert.ok(mine.every((p) => p.at === "2026-07-19T13:40:00Z"));
  const card = tennis.card(a);
  const s = tennis.reduce(plays, null, card);
  assert.equal(s.bouts[String(fin.id)].stage, "in");
  assert.equal(s.bouts[String(fin.id)].round, 2);
  assert.deepEqual(s.byBout[String(fin.id)][rublev], { GW: 9, GL: 6, SW: 1 });
  assert.equal(s.bouts[String(fin.id)].result, null);
  // A later watch, before it was asked, sees none of it.
  assert.equal(tennis.reduce(plays, "2026-07-19T13:39:59Z", card).byBout[String(fin.id)], undefined);
  // Suspended as ESPN's live board shows a stalled feed ("post", not completed, its note already "bt": Basel 2026's final at
  // one set all): still on, its sets so far, no result.
  const held = clone(a);
  const hfin = held.board.groupings.find((g) => g.grouping.slug === "mens-singles").competitions.find((c) => c.id === fin.id);
  hfin.status = { period: 2, type: { id: "8", name: "STATUS_SUSPENDED", state: "post", completed: false } };
  hfin.notes = [{ text: "Andrey Rublev bt someone 6-4 3-2" }];
  const issues = [];
  const hs = tennis.reduce(tennis.readPlays(held, issues), null, tennis.card(held));
  assert.equal(hs.bouts[String(fin.id)].stage, "in");
  assert.equal(hs.bouts[String(fin.id)].result, null);
  assert.deepEqual(hs.byBout[String(fin.id)][rublev], { GW: 9, GL: 6, SW: 1 });
  assert.ok(issues.some((x) => /STATUS_SUSPENDED, read as on/.test(x)));
  // Not over: no final's correction, and the event isn't final.
  assert.equal(tennis.readBox(a).final, false);
  assert.ok(!tennis.timeline(a).some((p) => p.final));
  // The doubles final to come: nothing of it.
  const dfin = a.board.groupings.find((g) => g.grouping.slug === "mens-doubles").competitions.find((c) => c.round.displayName === "Final");
  dfin.status = { period: 0, type: { state: "pre", name: "STATUS_SCHEDULED" } };
  for (const x of dfin.competitors) {
    delete x.winner;
    delete x.linescores;
  }
  assert.equal(tennis.readPlays(a).filter((p) => p.bout === String(dfin.id) && p.kind !== "reached").length, 0);
  // A board that doesn't list the later rounds yet: a quarterfinal is still three from the final (ESPN's round ids), no title.
  const early = clone(BASTAD);
  for (const g of early.board.groupings) g.competitions = g.competitions.filter((c) => !["Semifinal", "Final"].includes(c.round?.displayName));
  const qf = tennis.card(early).bouts.filter((b) => b.place.round === "Quarterfinal");
  assert.ok(qf.length && qf.every((b) => b.place.fromFinal === 3 && !b.main));
  assert.ok(!Object.values(tennis.readBox(early).people).some((p) => p.stats.TTL), "no title from a quarterfinal");
  assert.ok(Object.values(tennis.readBox(early).people).some((p) => p.stats.SF), "a quarterfinal's win reaches the semifinals");
  // With no `_asked`, a match on counts only at the end.
  delete a._asked;
  assert.ok(tennis.readPlays(a).filter((p) => p.bout === String(fin.id)).every((p) => p.at == null));
});

test("tennis's defaults are data the spec reads: DraftKings' tennis, best of three and best of five apart, six players, a lineup a day", () => {
  const d = defaultsFor("tennis");
  assert.equal(d.sport, "tennis");
  assert.equal(d.closes, "daily");
  for (const [k, v] of Object.entries(d.scoring.points)) assert.ok(tennis.stat(k) && Number.isFinite(v), k);
  for (const [k, v] of Object.entries(d.scoring.byFormat["5"])) assert.ok(tennis.stat(k) && Number.isFinite(v), k);
  assert.deepEqual({ MP: d.scoring.points.MP, GW: d.scoring.points.GW, SW: d.scoring.points.SW, W: d.scoring.points.W }, { MP: 30, GW: 2.5, SW: 6, W: 6 });
  assert.deepEqual({ GW: d.scoring.byFormat["5"].GW, GL: d.scoring.byFormat["5"].GL, WRET4: d.scoring.byFormat["5"].WRET4 }, { GW: 2, GL: -1.6, WRET4: 3 });
  assert.match(d.scoring.source, /ace/i, "what ESPN can't score is said");
  for (const spec of Object.values(d.specs)) assert.deepEqual(spec.spec.score.points, d.scoring.points);
  assert.equal(d.slots.lineup[0].n, 6);
  assert.deepEqual(d.slots.lineup[0].takes, ["players"]);
  // Scored by the table on a match's own line (its format's): Zverev's final (best of five), Rybakina's (best of three).
  const score = (line, rounds) => sum(Object.entries(rounds === 5 ? d.scoring.byFormat["5"] : d.scoring.points).map(([k, v]) => (line[k] ?? 0) * v));
  const box = tennis.readBox(USOPEN);
  const card = tennis.card(USOPEN);
  const final = (draw) => card.bouts.find((b) => b.place.draw === draw && b.place.fromFinal === 1);
  const men = final("mens-singles");
  const women = final("womens-singles");
  assert.equal(Math.round(score(box.byBout[men.id][idOf(USOPEN, "Alexander Zverev")], men.rounds) * 10) / 10, 66.7);
  assert.equal(Math.round(score(box.byBout[women.id][idOf(USOPEN, "Elena Rybakina")], women.rounds) * 10) / 10, 61.5);
  // A win by retirement in the 1st set: 20 with the match won, as DraftKings' table gives it.
  const bronzetti = idOf(USOPEN, "Lucia Bronzetti");
  const line = box.byBout["184744"][bronzetti];
  assert.equal(score({ W: line.W, WRET1: line.WRET1 }, 3), 20);
});
