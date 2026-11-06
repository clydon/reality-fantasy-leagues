// Your move in a game, as the Games tab's card says it (src/new/show/your-move.ts; the user, 2026-10-31): the week's lineup and
// pick, set or due; the draft until it's done (coming up, your turn, someone else's, blind); the mid-season draft (someone of yours
// to replace, your claim, optional swaps, a swap window set for later); due before set. Made-up games, no database.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { yourMove, movesOf } = jiti("../src/new/show/your-move.ts");

const cast = ["Carter Krull", "Jelly Loblack", "Kristin Flickinger", "Mike Pinsky", "Thien An Nguyen", "Sharonda Cox", "Eric Macksoud"].map((name, i) => ({ id: `c${i}`, name }));
const game = (over) => ({ leagueId: "L1", gameType: "classic-draft", over: false, cast, lineup: null, pick: null, revealFirst: null, ...over });
const ctx = (over) => ({ seasonId: "S", episode: "Episode", when: (iso) => `at ${iso}`, ...over });
const lineup = (over) => ({ epId: "e7", episode: 7, airsAt: "Wed", locked: false, slots: 3, need: 3, starters: ["c4", "c1", "c2"], roster: ["c0", "c1", "c2", "c3", "c4"], set: true, carried: false, ...over });
const pick = (over) => ({ epId: "e7", episode: 7, airsAt: "Wed", open: true, pick: "c5", available: ["c5", "c6"], blocked: [], streak: 5, ...over });
const draft = (over) => ({ leagueId: "L1", kind: "snake", you: "me", phase: "waiting", scheduledAt: "Sat", size: 5, seats: [{ playerId: "riley", name: "riley" }, { playerId: "me", name: "conor" }], turns: ["riley", "me", "me", "riley"], teams: [{ playerId: "me", castawayIds: [] }, { playerId: "riley", castawayIds: [] }], picks: [], clock: null, locked: [], revealFirst: null, ...over });
const face = (id, out = null) => ({ id, name: cast.find((c) => c.id === id).name, photo: null, group: null, points: 0, out, tag: null });
const waivers = (over) => ({
  leagueId: "L1", revealFirst: null, stage: "open", period: { id: "p", episode: 6, window: false, swaps: 0, due: "Mon", until: null },
  replace: ["c0"], outIds: ["c0"], nobodyFree: false, swapsAllowed: 0, swapsLeft: 0,
  team: [face("c2"), face("c3"), face("c0", 6)], free: [face("c6")], spots: [],
  how: { out: "", swap: "", order: "", lanes: { episodes: [7, 8, 9], now: 6, replace: [true, true, true], swap: [false, false, true] } },
  ...over,
});

test("Weekly Lineup: set says what you've set and when it locks; not set is due, with dashed places", () => {
  const set = yourMove(game({ gameType: "active-roster", lineup: lineup() }), ctx());
  assert.equal(set.kind, "lineup");
  assert.equal(set.title, "Your Episode 7 lineup");
  assert.equal(set.line, "Change until at Wed");
  assert.deepEqual(set.faces, ["c4", "c1", "c2"]);
  assert.equal(set.due, false);
  assert.equal(set.action, "Edit");
  assert.deepEqual(set.go, { tab: "lineup" });
  const due = yourMove(game({ gameType: "active-roster", lineup: lineup({ set: false, starters: ["c4"] }) }), ctx());
  assert.equal(due.title, "Set your Episode 7 lineup");
  assert.equal(due.due, true);
  assert.equal(due.action, "Set");
  assert.equal(due.empty, 2);
  const carried = yourMove(game({ gameType: "active-roster", lineup: lineup({ set: false, carried: true }) }), ctx());
  assert.match(carried.line, /last week's stands in/);
  const locked = yourMove(game({ gameType: "active-roster", lineup: lineup({ locked: true }) }), ctx());
  assert.equal(locked.due, false);
  assert.match(locked.line, /Locked at airtime/);
});

test("Survival Pool: your pick by name, or a pick due; the show's own word for an episode", () => {
  const set = yourMove(game({ gameType: "pickem", pick: pick() }), ctx({ episode: "Game" }));
  assert.equal(set.title, "Your Game 7 pick: Sharonda");
  assert.deepEqual(set.go, { tab: "pool" });
  const due = yourMove(game({ gameType: "pickem", pick: pick({ pick: null }) }), ctx());
  assert.equal(due.title, "Pick a survivor for Episode 7");
  assert.equal(due.due, true);
  assert.equal(due.empty, 1);
  assert.equal(yourMove(game({ gameType: "pickem", pick: pick({ open: false, pick: null }) }), ctx()), null, "closed with no pick: nothing to show");
});

test("A reveal in the way: the card says so, quietly (the dock asks for the reveal)", () => {
  const m = yourMove(game({ gameType: "active-roster", lineup: lineup(), revealFirst: 6 }), ctx());
  assert.equal(m.title, "Reveal Episode 6 first");
  assert.equal(m.due, false);
});

test("Outlast's draft: coming up, your turn, someone else's, blind; the draft room or the blind page", () => {
  const soon = yourMove(game(), ctx({ draft: draft() }));
  assert.equal(soon.kind, "draft");
  assert.equal(soon.title, "Draft · at Sat");
  assert.equal(soon.line, "You pick 2nd · star who you want first");
  assert.equal(soon.due, false);
  assert.deepEqual(soon.go, { href: "/show/S/draft?game=L1" });
  assert.equal(soon.empty, 3);
  const turn = yourMove(game(), ctx({ draft: draft({ phase: "live", clock: { playerId: "me", n: 2, round: 1 }, picks: [{ n: 1, round: 1, inRound: 1, playerId: "riley", castawayId: "c5" }], teams: [{ playerId: "me", castawayIds: [] }] }) }));
  assert.equal(turn.title, "Your turn · round 1");
  assert.equal(turn.line, "riley just took Sharonda");
  assert.equal(turn.due, true);
  assert.equal(turn.action, "Draft");
  const theirs = yourMove(game(), ctx({ draft: draft({ phase: "live", clock: { playerId: "riley", n: 4, round: 2 }, teams: [{ playerId: "me", castawayIds: ["c2", "c4"] }] }) }));
  assert.equal(theirs.title, "riley is picking · round 2");
  assert.equal(theirs.line, "Your team: 2 of 5");
  assert.deepEqual(theirs.faces, ["c2", "c4"]);
  assert.equal(theirs.due, false);
  const blind = yourMove(game(), ctx({ draft: draft({ kind: "blind", phase: "live" }) }));
  assert.equal(blind.title, "Pick your team in private");
  assert.equal(blind.due, true);
  assert.deepEqual(blind.go, { href: "/show/S/blind?game=L1" });
  const lockedIn = yourMove(game(), ctx({ draft: draft({ kind: "blind", phase: "live", locked: ["me"] }) }));
  assert.equal(lockedIn.title, "You're in");
  assert.equal(lockedIn.due, false);
  assert.equal(yourMove(game(), ctx({ draft: draft({ phase: "done" }) })), null, "a done draft says nothing");
});

test("The mid-season draft: someone of yours to replace is due; your claim isn't; swaps are optional", () => {
  const due = yourMove(game(), ctx({ waivers: waivers() }));
  assert.equal(due.kind, "waivers");
  assert.equal(due.title, "Replace Carter");
  assert.equal(due.line, "Claims close at Mon");
  assert.equal(due.due, true);
  assert.equal(due.action, "Claim");
  assert.deepEqual(due.out, ["c0"]);
  assert.deepEqual(due.go, { href: "/show/S/waivers?game=L1" });
  const claimed = yourMove(game(), ctx({ waivers: waivers({ spots: [{ dropId: "c0", addIds: ["c6"] }] }) }));
  assert.equal(claimed.title, "Eric for Carter");
  assert.equal(claimed.line, "Runs at Mon · change until then");
  assert.equal(claimed.due, false);
  const swaps = yourMove(game(), ctx({ waivers: waivers({ replace: [], period: { id: "p", episode: 6, window: true, swaps: 2, due: "Mon", until: null }, swapsLeft: 2 }) }));
  assert.equal(swaps.kind, "swaps");
  assert.equal(swaps.due, false);
  assert.equal(swaps.line, "Until at Mon · swap up to 2");
  assert.equal(yourMove(game(), ctx({ waivers: waivers({ nobodyFree: true }) })), null, "nobody free to come in: nothing to claim");
  assert.equal(yourMove(game(), ctx({ waivers: waivers({ revealFirst: 6 }) })), null, "a week waiting on a reveal says nothing (it would hint at who left)");
});

test("A swap window set for a later episode shows quietly; a replace window after every episode doesn't", () => {
  const later = yourMove(game(), ctx({ waivers: waivers({ stage: "none", period: null }) }));
  assert.equal(later.kind, "swaps");
  assert.equal(later.title, "Swaps open after Episode 9");
  assert.equal(later.due, false);
  const none = waivers({ stage: "none", period: null, how: { out: "", swap: "", order: "", lanes: { episodes: [7, 8], now: 6, replace: [true, true], swap: [false, false] } } });
  assert.equal(yourMove(game(), ctx({ waivers: none })), null);
});

test("Due comes first: a claim to make beats a lineup already set; a lineup due beats a claim already in", () => {
  const wl = game({ gameType: "active-roster", lineup: lineup() });
  assert.equal(yourMove(wl, ctx({ waivers: waivers() })).kind, "waivers");
  const due = game({ gameType: "active-roster", lineup: lineup({ set: false }) });
  assert.equal(yourMove(due, ctx({ waivers: waivers({ spots: [{ dropId: "c0", addIds: ["c6"] }] }) })).kind, "lineup");
  assert.deepEqual(
    movesOf(wl, ctx({ waivers: waivers({ spots: [{ dropId: "c0", addIds: ["c6"] }] }) })).map((m) => m.kind),
    ["waivers", "lineup"],
    "nothing due: the draft and the mid-season draft, then the week's move"
  );
  assert.equal(yourMove(game({ over: true, gameType: "active-roster", lineup: lineup() }), ctx()), null, "a game that's over says nothing");
});
