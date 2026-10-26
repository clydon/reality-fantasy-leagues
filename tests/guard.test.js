// The spoiler guard, server side (src/lib/server/guard.ts, docs/PLAN-new-design.md step 0b): nothing past
// someone's episode, an unknown episode counts as 0, secret roles only once that person has left, and a show
// watched privately isn't shared, nor what someone's What your couch sees keeps back (step 15 part 3; shares() itself is SQL,
// checked against the database by scripts/dev-test/check-new-sharing.js). Also the league roles' one rule (roles.ts). Run with
// `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const G = jiti("../src/lib/server/guard.ts");
const S = jiti("../src/lib/sharing.ts");
const { roleAtLeast, lastCommissionerProblem } = jiti("../src/lib/server/roles.ts");
const { FORMATS } = require("../src/lib/game/formats/index.js");

// A stand-in for the database: show_follows and user_settings rows, answered the way guard.ts asks.
const fakeDb = ({ follows = {}, immediate = {} } = {}) => ({
  query: async (sql, [userId, seasonId]) => {
    if (/FROM show_follows WHERE user_id = \$1 AND season_id = \$2\) AS mark/.test(sql)) {
      return { rows: [{ mark: follows[`${userId}/${seasonId}`] ?? null, immediate: !!immediate[userId] }] };
    }
    if (/SELECT following, private FROM show_follows/.test(sql)) {
      const f = follows[`${userId}/${seasonId}`];
      return { rows: f === undefined ? [] : [{ following: true, private: false, ...(typeof f === "object" ? f : {}) }] };
    }
    if (/FROM league_memberships m JOIN leagues l/.test(sql)) return { rows: [] };
    throw new Error(`unexpected query: ${sql}`);
  },
});

test("seenThrough: the follow's mark, and 0 when nothing is known (fail closed)", async () => {
  const db = fakeDb({ follows: { "u1/s1": 4 } });
  assert.equal(await G.seenThrough("u1", "s1", db), 4);
  assert.equal(await G.seenThrough("u1", "s2", db), 0, "no follow: episode 0");
  assert.equal(await G.seenThrough("u2", "s1", db), 0, "someone else's follow is not yours");
});

test("seenThrough: spoiler protection off sees everything only where they play an ordinary seat", async () => {
  // No league on this season: a follow alone goes by its mark, whatever the setting.
  assert.equal(await G.seenThrough("u1", "s1", fakeDb({ follows: { "u1/s1": 2 }, immediate: { u1: true } })), 2);
  assert.equal(G.progressFrom(3, true, [{ lateJoiner: false }]), G.EVERYTHING, "an ordinary seat: everything, as classic shows it");
  assert.equal(G.progressFrom(3, true, [{ lateJoiner: true }]), 3, "a late joiner always goes by their mark");
  assert.equal(G.progressFrom(3, true, [{ lateJoiner: true }, { lateJoiner: false }]), G.EVERYTHING, "one ordinary seat is enough");
  assert.equal(G.progressFrom(3, false, [{ lateJoiner: false }]), 3, "protection on: the mark");
  for (const bad of [null, undefined, -1, 2.5, NaN]) assert.equal(G.progressFrom(bad, false, []), 0, `a mark of ${bad} is 0`);
});

test("nothing past your episode gets through, and nothing with an unknown episode", () => {
  const events = [{ ep: 1 }, { ep: 3 }, { ep: 4 }, { ep: 9 }, { ep: null }, {}, { ep: "3" }, { ep: 3.5 }];
  assert.deepEqual(G.throughEpisode(events, 3, (e) => e.ep), [{ ep: 1 }, { ep: 3 }]);
  assert.deepEqual(G.throughEpisode(events, 0, (e) => e.ep), [], "episode 0: nothing");
  assert.equal(G.throughEpisode(events, G.EVERYTHING, (e) => e.ep).length, 4, "everything: every known episode");
  assert.equal(G.withinSeen(4, 3), null);
  assert.equal(G.withinSeen(3, 3), 3);
  assert.equal(G.withinSeen(undefined, 3), null);
});

test("secret roles: only the Traitors have them, and only someone who has left shows theirs", () => {
  const traitors = FORMATS.traitors;
  assert.deepEqual(G.secretFields(traitors), ["role"]);
  assert.deepEqual(G.secretFields(FORMATS.survivor), [], "Survivor has no secret roles");
  assert.deepEqual(G.secretFields(null), []);
  const still = { name: "riley", exitEpisode: null, role: "Traitor" };
  const later = { name: "jordan", exitEpisode: 6, role: "Traitor" };
  const gone = { name: "sam", exitEpisode: 2, role: "Faithful" };
  assert.deepEqual(G.withoutSecrets(still, traitors, 4), { name: "riley", exitEpisode: null }, "still in: no role");
  assert.deepEqual(G.withoutSecrets(later, traitors, 4), { name: "jordan", exitEpisode: 6 }, "leaves after your episode: no role yet");
  assert.deepEqual(G.withoutSecrets(gone, traitors, 4), gone, "left by your episode: the role shows");
  assert.deepEqual(G.withoutSecrets(still, FORMATS.survivor, 4), still, "a format without secrets keeps everything");
  assert.equal(still.role, "Traitor", "the original is untouched");
});

test("sharing: a show watched privately, not followed, or kept back by Where I am isn't shared; your own always is", async () => {
  const follows = [
    { userId: "me", seasonId: "s1", following: true, private: true },
    { userId: "riley", seasonId: "s1", following: true, private: false },
    { userId: "jordan", seasonId: "s1", following: true, private: true },
    { userId: "sam", seasonId: "s1", following: false, private: false },
    { userId: "kat", seasonId: "s1", following: true, private: false },
  ];
  const sharing = new Map([["kat", S.SHARE_PRESETS.games]]);
  assert.deepEqual(G.visibleFollows("me", follows, sharing).map((f) => f.userId), ["me", "riley"], "kat's Just my games keeps what she watches back");
  assert.deepEqual(G.visibleFollows("me", follows, new Map()).map((f) => f.userId), ["me", "riley", "kat"], "nobody's settings: everything, the default");
  assert.equal(await G.shares("jordan", "jordan", { kind: "ratings", seasonId: "s1" }, fakeDb()), true, "your own, without asking the database");
  // The SQL each kind asks: games need only an open follow; the four switches each ask their own column too.
  assert.doesNotMatch(G.sharesSql("play", "r.user_id", "r.season_id"), /user_settings/);
  for (const k of S.SHARE_SWITCHES) {
    const sql = G.sharesSql(k, "r.user_id", "r.season_id");
    assert.ok(sql.includes(`share_${k} FROM user_settings us_ WHERE us_.user_id = r.user_id), true)`), k);
    assert.match(sql, /sf_.following AND NOT sf_.private/, `${k}: never a show watched privately`);
  }
});

test("sharing: the three levels, and what a save may send", () => {
  assert.equal(S.presetOf(S.SHARE_DEFAULT), "all", "everything by default");
  assert.equal(S.presetOf({ where: false, now: false, ratings: true, reactions: true }), "games");
  assert.equal(S.presetOf({ where: false, now: false, ratings: false, reactions: false }), "min");
  assert.equal(S.presetOf({ where: true, now: false, ratings: true, reactions: true }), "custom", "a mix of your own");
  assert.deepEqual(S.sharingFrom({ preset: "games" }, S.SHARE_DEFAULT), S.SHARE_PRESETS.games);
  assert.deepEqual(S.sharingFrom({ now: false }, S.SHARE_DEFAULT), { where: true, now: false, ratings: true, reactions: true }, "one switch over what's there");
  for (const bad of [null, [], {}, { preset: "some" }, { now: "no" }, { where: true, colour: 1 }]) assert.equal(S.sharingFrom(bad, S.SHARE_DEFAULT), null, JSON.stringify(bad));
});

test("roles: a Commissioner can do what a Game admin can; the last Commissioner can't step down", () => {
  assert.equal(roleAtLeast("commissioner", "admin"), true);
  assert.equal(roleAtLeast("admin", "admin"), true);
  assert.equal(roleAtLeast("admin", "commissioner"), false);
  assert.equal(roleAtLeast("member", "admin"), false);
  assert.equal(roleAtLeast("owner", "member"), false, "not a league role");
  const one = [{ userId: "alex", role: "commissioner" }, { userId: "riley", role: "admin" }];
  assert.match(lastCommissionerProblem(one, "alex", "admin"), /Every game needs a Commissioner/);
  assert.match(lastCommissionerProblem(one, "alex", "member"), /Hand it to someone first/);
  assert.equal(lastCommissionerProblem(one, "alex", "commissioner"), null, "staying on is fine");
  assert.equal(lastCommissionerProblem(one, "riley", "member"), null, "a Game admin can step down");
  assert.equal(lastCommissionerProblem(one, "riley", "commissioner"), null, "and be made a Commissioner");
  const two = [...one, { userId: "jordan", role: "commissioner" }];
  assert.equal(lastCommissionerProblem(two, "alex", "member"), null, "a shared role can be handed back");
});
