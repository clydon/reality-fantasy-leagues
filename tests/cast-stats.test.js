// The new design's cast stats (src/lib/game/cast-stats.ts, docs/PLAN-new-design.md step 3): a season's accepted
// results applied to an empty league (seasonFacts) count the same as the league they came from, a range counts only
// its episodes, nothing past where you are is counted, and a secret role (the Traitors') stays secret: no groups
// named for it, no role and no result that gives one away for anyone still in. Runs on made-up seasons, so no
// database is needed. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const { castawayEventStats } = jiti("../src/lib/game/active-roster-rows.ts");
const { castStats, seasonFacts, secretEvents } = jiti("../src/lib/game/cast-stats.ts");
const { rulebookFor } = require("../src/lib/game/formats/blocks/index.js");
const { formatFor } = require("../src/lib/game/formats/index.js");
const S = require("../src/lib/game/state-logic.js");

const EPISODES = 12;
const CURSOR = 5;
const TRIBES = ["Toka", "Savu", "Dina"];
const data = {
  id: "test", showId: "survivor", showName: "Test", seasonName: "Test", episodeCount: EPISODES,
  players: ["ann", "bo"].map((key) => ({ key, name: key, color: "#000" })),
  groups: TRIBES.map((name) => ({ key: name.toLowerCase(), name, color: "#123456" })),
  castaways: Array.from({ length: 18 }, (_, i) => ({
    key: `k${i}`, name: `Castaway ${i}`, placement: i + 1, groupKey: TRIBES[i % 3].toLowerCase(),
    exitEpisode: Math.min(i + 1, EPISODES), exitMethod: i === 17 ? "Sole Survivor" : "Voted Out",
  })),
};
const survivor = rulebookFor("survivor", formatFor("survivor").data);
let n = 0;
const row = (episode, kind, name, method = "", eventType = "") => ({
  id: `d${++n}`, episode_number: episode, post_merge: false, kind, castaway_name: name, method, event_type: eventType,
  jury_votes: null, units: null, applied: null, decided_at: new Date(0),
});

/** A Weekly Lineup league through episode 5, and the season's accepted results and cast as an admin would leave them. */
function season() {
  const league = S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, "active-roster", CURSOR))));
  const name = new Map(league.castaways.map((c) => [c.id, c.name]));
  const decisions = league.episodes.flatMap((ep) => [
    ...ep.events.map((e) => row(ep.number, "elimination", name.get(e.castawayId), e.method)),
    ...ep.scoringEvents.map((e) => row(ep.number, "event", name.get(e.castawayId), "", e.type)),
  ]);
  const cast = data.castaways.map((c, i) => ({ id: `sc${i}`, name: c.name, tribeName: TRIBES[i % 3], photoUrl: null }));
  return { league, decisions, cast };
}

test("a season's accepted results count as the league they came from: events, points, who's out", () => {
  const { league, decisions, cast } = season();
  const facts = seasonFacts({ settings: { eventPoints: league.settings.eventPoints, ownershipMode: league.settings.ownershipMode }, cast, withTribes: true, decisions, seen: CURSOR });
  const stats = castStats(facts, { seen: CURSOR, book: survivor });
  assert.equal(stats.through, CURSOR);
  assert.deepEqual([stats.from, stats.to], [1, CURSOR]);
  assert.equal(stats.stats[0].key, "points");
  assert.ok(stats.stats.some((s) => s.name === "Voted with the majority"), "named from the rulebook");
  // Asked as a number but scored once (2nd from a finishing place, votes cancelled by an idol): counted in times.
  const once = stats.stats.filter((s) => ["challengeRunnerUp", "challengeThird", "votesNegated"].includes(s.key));
  assert.ok(once.length, "the demo has some");
  for (const s of once) assert.equal(s.unit, "times", s.key);
  assert.deepEqual(stats.groups.map((g) => g.name), TRIBES);
  for (const c of league.castaways) {
    const mine = stats.cast.find((x) => x.name === c.name);
    assert.equal(mine.points, castawayEventStats(league, c.id).total, `${c.name}'s points`);
    const exit = c.status === "eliminated" ? league.episodes.find((e) => e.id === c.exitEpisodeId).number : null;
    assert.equal(mine.out, exit, `${c.name} out`);
    const counted = {};
    for (const ep of league.episodes) for (const e of ep.scoringEvents) if (e.castawayId === c.id) counted[e.type] = (counted[e.type] || 0) + 1;
    assert.deepEqual(mine.counts, counted, `${c.name}'s counts`);
  }
});

test("a range counts only its episodes, and is clamped to what's counted", () => {
  const { decisions, cast } = season();
  const facts = seasonFacts({ settings: {}, cast, withTribes: true, decisions, seen: CURSOR });
  const all = castStats(facts, { seen: CURSOR, book: survivor });
  const part = castStats(facts, { seen: CURSOR, book: survivor, from: "2", to: "3" });
  assert.deepEqual([part.from, part.to], [2, 3]);
  for (const c of part.cast) {
    assert.equal(c.perEp.length, 2);
    assert.ok(c.events.every(([ep]) => ep === 2 || ep === 3));
    const whole = all.cast.find((x) => x.name === c.name);
    assert.equal(c.points, S.roundPoints((whole.perEp[1] ?? 0) + (whole.perEp[2] ?? 0)));
  }
  assert.deepEqual([castStats(facts, { seen: CURSOR, book: survivor, from: 0, to: 99 }).from, castStats(facts, { seen: CURSOR, book: survivor, from: null, to: null }).to], [1, CURSOR]);
});

test("nothing past where you are: on 3 of 5, episodes 4 and 5 aren't counted; on 0, nothing is", () => {
  const { decisions, cast } = season();
  const three = castStats(seasonFacts({ settings: {}, cast, withTribes: true, decisions, seen: 3 }), { seen: 3, book: survivor, to: 5 });
  assert.equal(three.through, 3);
  assert.equal(three.to, 3);
  assert.ok(three.cast.every((c) => (c.out === null || c.out <= 3) && c.events.every(([ep]) => ep <= 3)));
  const none = castStats(seasonFacts({ settings: {}, cast, withTribes: true, decisions, seen: 0 }), { seen: 0, book: survivor });
  assert.equal(none.through, 0);
  assert.ok(none.cast.every((c) => !Object.keys(c.counts).length && c.out === null && c.perEp.length === 0));
});

test("the Traitors: the faction is never a group, and nobody still in has a role or a result that gives one away", () => {
  const traitors = formatFor("traitors");
  const book = rulebookFor("traitors", traitors.data);
  const secret = secretEvents(traitors, book);
  for (const id of ["turnedOnTraitor", "votedOutTraitor", "recruited", "wonAsTraitor", "shieldSavedThem", "consideredForMurder", "banishedAsTraitor"]) assert.ok(secret.has(id), `${id} is secret`);
  for (const id of ["shieldWon", "zeroVotes", "survivedRoundTable", "missionStandout"]) assert.ok(!secret.has(id), `${id} isn't`);
  assert.equal(secretEvents(formatFor("survivor"), survivor).size, 0);

  const people = ["Ada Moss", "Bea Lund", "Hana Kim", "Ivo Petrov"];
  const cast = people.map((name, i) => ({ id: `t${i}`, name, tribeName: /Hana|Ivo/.test(name) ? "Traitor" : "Faithful", photoUrl: null }));
  const decisions = [
    row(1, "role", "Hana Kim", "Traitor"), row(1, "role", "Ivo Petrov", "Traitor"), row(1, "elimination", "Bea Lund", "Murdered"),
    row(1, "event", "Ada Moss", "", "zeroVotes"), row(2, "elimination", "Ivo Petrov", "Banished"), row(2, "event", "Hana Kim", "", "turnedOnTraitor"),
    row(2, "event", "Ivo Petrov", "", "turnedOnTraitor"),
  ];
  const stats = castStats(seasonFacts({ settings: { showFormat: "traitors" }, cast, withTribes: true, decisions, seen: 2 }), { seen: 2, book });
  const by = (name) => stats.cast.find((c) => c.name === name);
  assert.deepEqual(stats.groups, []);
  assert.ok(stats.roles);
  assert.ok(stats.cast.every((c) => c.group === null && c.start === null), "no faction as a group");
  assert.equal(by("Hana Kim").role, null);
  assert.deepEqual(by("Hana Kim").counts, {});
  assert.ok(!JSON.stringify(stats.cast.filter((c) => c.out === null)).includes("Traitor"));
  assert.equal(by("Ivo Petrov").role, "Traitor");
  assert.equal(by("Ivo Petrov").counts.turnedOnTraitor, 1, "told once they've left");
  assert.equal(by("Bea Lund").role, "Faithful");
  assert.ok(stats.stats.some((s) => s.key === "turnedOnTraitor"), "a stat once someone who's left has it");
});
