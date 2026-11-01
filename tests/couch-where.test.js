// Where everyone is (src/new/couch/where.ts; the user's picks F, C and B of the 2026-11-01 mocks): how far someone is in words
// ("Up to Episode 5 of 7", never "On Episode 5"), what one person on the couch watches as the hub's person sheet lists it,
// who's up to which episode on a show's Episodes tab, and the header line's faces, groups and words. Made-up home and space
// reads, no database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { personShows, episodeMarks, marksLine, namesLine, seasonLabel, marksOf, whereGroups, caughtUpLine } = jiti("../src/new/couch/where.ts");
const { whereWords } = jiti("../src/lib/sharing.ts");
const whereLong = (seen, o) => whereWords(seen, o, "full");

const show = (id, name, over = {}) => ({
  seasonId: id,
  seasonNumber: 51,
  seasonName: null,
  status: "airing",
  episodeCount: 13,
  premiereDate: "2026-09-16",
  release: "weekly",
  show: { id: `show-${id}`, slug: id, name, kind: "competition", artUrl: null, terms: { castaway: null, tribe: null } },
  latestAired: 7,
  ...over,
});
const mine = (id, name, over = {}) => ({ ...show(id, name, over), following: true, private: false, seenThrough: 7, games: [], keepUp: "off", ...over });

test("how far someone is, in full and as a chip", () => {
  const weekly = { aired: 7, total: 13, ownPace: false };
  assert.equal(whereLong(7, weekly), "Caught up · Episode 7");
  assert.equal(whereLong(5, weekly), "Up to Episode 5 of 7");
  assert.equal(whereLong(0, weekly), "Not started");
  assert.equal(whereLong(3, { aired: 0, total: 13, ownPace: false }), "Not on yet");
  assert.equal(whereLong(4, { aired: 8, total: 8, ownPace: true }), "Up to Episode 4 of 8");
  assert.equal(whereLong(8, { aired: 8, total: 8, ownPace: true }), "Finished");
  assert.equal(whereLong(2, { ...weekly, word: "Race" }), "Up to Race 2 of 7");
  // The couch's other words say "Up to" too, never "On Episode 5" (it reads as halfway through it): one rule, three styles.
  assert.equal(whereWords(5, weekly), "Up to Episode 5");
  assert.equal(whereWords(5, weekly, true), "Ep 5");
  assert.equal(whereWords(7, weekly), "Caught up");
  assert.equal(whereWords(3, { aired: 0, total: 13, ownPace: false }), null);
  assert.equal(seasonLabel(show("t", "The Traitors (US)", { seasonNumber: 5 })), "The Traitors 5");
});

const home = {
  user: { id: "alex" },
  shows: [mine("surv", "Survivor", { seenThrough: 5 }), mine("trait", "The Traitors", { seasonNumber: 5, latestAired: 3, seenThrough: 3 }), mine("secret", "Love Island", { private: true, seenThrough: 2 })],
  couchShows: [show("race", "The Amazing Race", { seasonNumber: 39, latestAired: 6 })],
};
const couch = {
  games: [],
  members: [
    { userId: "alex", name: "alex", watching: ["surv", "trait"], at: { surv: 5, trait: 3 } },
    { userId: "riley", name: "riley", watching: ["surv", "race", "trait"], at: { surv: 7, race: 6, trait: 2 } },
    { userId: "jamie", name: "jamie", watching: [], at: {} },
  ],
};

test("someone's shows: watching now first, then what you both watch, then the rest, each with how far", () => {
  const list = personShows(home, couch, "riley", [{ userId: "riley", seasonId: "trait", episode: 3 }]);
  assert.deepEqual(
    list.map((p) => [p.label, p.where, p.line, p.yours]),
    [
      ["The Traitors 5", "Up to Episode 2 of 3", "Watching Episode 3 now", true],
      ["Survivor 51", "Caught up · Episode 7", "2 ahead of you", true],
      ["The Amazing Race 39", "Caught up · Episode 6", "You don't watch it", false],
    ]
  );
  assert.ok(list[0].now);
});

test("someone who shares nothing has nothing to list; someone off the couch neither", () => {
  assert.deepEqual(personShows(home, couch, "jamie"), []);
  assert.deepEqual(personShows(home, couch, "nobody"), []);
});

test("your own sheet: what the couch sees of you, then what you watch privately, said as only yours", () => {
  const list = personShows(home, couch, "alex", [{ userId: "alex", seasonId: "surv", episode: 6 }]);
  assert.deepEqual(
    list.map((p) => [p.label, p.where, p.line]),
    [
      ["Survivor 51", "Up to Episode 5 of 7", null],
      ["The Traitors 5", "Caught up · Episode 3", null],
      ["Love Island 51", "Up to Episode 2 of 7", "Watching privately: only you see it"],
    ]
  );
});

test("your own sheet with Where I am off: the couch sees none of it, and each says so", () => {
  const list = personShows(home, couch, "alex", [], false);
  assert.deepEqual(
    list.map((p) => [p.label, p.line, p.private]),
    [
      ["Love Island 51", "Watching privately: only you see it", true],
      ["Survivor 51", "Only you see it: your Where I am is off", true],
      ["The Traitors 5", "Only you see it: your Where I am is off", true],
    ]
  );
});

test("a finished season the couch plays is weekly, as its show says, even when you don't play it", () => {
  const done = show("old", "Survivor", { seasonNumber: 50, status: "completed", latestAired: 13, episodeCount: 13 });
  const h = { ...home, couchShows: [done] };
  const c = { ...couch, members: [...couch.members, { userId: "sam", name: "sam", watching: ["old"], at: { old: 13 } }] };
  // Nobody plays it: watched at your own pace, where the end of it is "Finished".
  assert.equal(personShows(h, c, "sam")[0].where, "Finished");
  // The couch plays it (though you don't): weekly, as its own show space says.
  assert.equal(personShows(h, { ...c, games: [{ seasonId: "old" }] }, "sam")[0].where, "Caught up · Episode 13");
  assert.equal(personShows(h, c, "sam")[0].word, "Episode");
});

test("who's up to which episode: you first, not started apart, a player who doesn't share said so, a quiet follower left out", () => {
  const people = [
    { userId: "riley", name: "riley", role: "member", watching: true, seen: 7, playing: ["g1"] },
    { userId: "casey", name: "casey", role: "member", watching: true, seen: 5, playing: [] },
    { userId: "max", name: "max", role: "member", watching: true, seen: 0, playing: ["g1"] },
    { userId: "jamie", name: "jamie", role: "member", watching: false, seen: null, playing: ["g1"] },
    { userId: "kim", name: "kim", role: "member", watching: false, seen: null, playing: [] },
    { userId: "alex", name: "alex", role: "owner", watching: true, seen: null, playing: ["g1"] },
  ];
  const m = episodeMarks(people, { id: "alex", name: "alex", seen: 5 });
  assert.deepEqual([...m.at.keys()].sort(), [5, 7]);
  assert.deepEqual(m.at.get(5).map((x) => x.name), ["alex", "casey"]);
  assert.equal(m.at.get(5)[0].you, true);
  assert.deepEqual(m.notStarted.map((x) => x.name), ["max"]);
  assert.deepEqual(m.quiet.map((x) => x.name), ["jamie"]);
  assert.equal(marksLine(m.at.get(5)), "You're here · casey");
  assert.equal(marksLine(m.at.get(7)), "riley");
  // You're on it only if it's yours (null: you neither follow nor play it).
  assert.equal(episodeMarks(people, { id: "alex", name: "alex", seen: null }).at.get(5).length, 1);
  assert.deepEqual(episodeMarks(null, null), { at: new Map(), notStarted: [], quiet: [] });
});

test("names: a few, then a count", () => {
  assert.equal(namesLine([]), "");
  assert.equal(namesLine(["riley"]), "riley");
  assert.equal(namesLine(["riley", "casey"]), "riley and casey");
  assert.equal(namesLine(["riley", "casey", "pat"]), "riley, casey and pat");
  assert.equal(namesLine(["riley", "casey", "pat", "lee"]), "riley, casey and 2 more");
  assert.equal(marksLine([{ userId: "a", name: "alex", you: true }]), "You're here");
});

test("the header line (B): you first, then furthest along; groups by episode, furthest first; its words", () => {
  const people = [
    { userId: "sam", name: "sam", role: "member", watching: true, seen: 3, playing: ["g1"] },
    { userId: "riley", name: "riley", role: "member", watching: true, seen: 7, playing: ["g1"] },
    { userId: "max", name: "max", role: "member", watching: true, seen: 0, playing: [] },
    { userId: "jamie", name: "jamie", role: "member", watching: false, seen: null, playing: ["g1"] },
    { userId: "casey", name: "casey", role: "member", watching: true, seen: 7, playing: [] },
  ];
  const { known, quiet } = marksOf(people, { id: "alex", name: "alex", seen: 5 });
  assert.deepEqual(known.map((w) => [w.name, w.seen, w.you]), [["alex", 5, true], ["riley", 7, false], ["casey", 7, false], ["sam", 3, false], ["max", 0, false]]);
  assert.deepEqual(quiet.map((m) => m.name), ["jamie"]);
  assert.deepEqual(
    whereGroups(known, 7).map((g) => [g.title, g.people.map((w) => w.name)]),
    [["Caught up · Episode 7", ["riley", "casey"]], ["Up to Episode 5", ["alex"]], ["Up to Episode 3", ["sam"]], ["Not started", ["max"]]]
  );
  assert.equal(whereGroups(known, 7, "Race")[1].title, "Up to Race 5");
  assert.deepEqual(caughtUpLine(known, 7), { top: "2 caught up", under: "3 catching up" });
  assert.deepEqual(caughtUpLine(known.filter((w) => w.seen === 7), 7), { top: "All 2 caught up", under: null });
  assert.deepEqual(caughtUpLine(known.filter((w) => w.seen < 7), 7), { top: "3 catching up", under: null });
  // Without your mark (results straight away), you're not in it.
  assert.equal(marksOf(people, { id: "alex", name: "alex", seen: null }).known.some((w) => w.you), false);
});
