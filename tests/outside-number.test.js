// A number from a vetted outside source (docs/PLAN-start-a-game-gpt.md step A14 part 7; the tracker's s42, "Predict each episode's
// IMDb rating.", and settle.outside): `settle: { by: 'outside', take: 'rating', source: 'tvmaze', after }`, an episode's TVmaze rating
// read once `after` days after it aired and stored (outside_numbers, migration 0213: db/outside-numbers.js settleOutside), graded on
// the server's facts.outside as a number, an over/under or a choice of ranges. Its shape, defaults, refusals, words and settings; the
// grade (the closest, the line, a range; void when TVmaze had none; waiting before it's read; the spoiler guard); what's due and
// stored (its moment, nothing twice, unlisted, TVmaze not answering and its grace). TVmaze is never asked: its reads are stubbed.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const { settleOutside, asked, GRACE_DAYS } = require("../db/outside-numbers.js");

const A = S.AnswerLogic;
const CTX = { moments: [{ id: "eliminated", label: "Eliminated", defaultPoints: 0, answeredBy: "research" }], results: true, winner: true, roles: [], grouped: false, jury: false, phases: [], tvmaze: true };
const RATING = { id: "rating", ask: "What will the episode's TVmaze rating be?", answer: "number", points: 3, asked: "each", settle: { by: "outside", take: "rating" } };
const questions = (ask = [RATING]) => ({ spec: 1, get: { by: "none" }, count: null, score: { by: "answers" }, rank: { by: "total" }, ask });
const S42 = questions();
const at = (spec, ctx = CTX) => G.specProblems(spec, ctx).map((p) => p.at);
const DAY = 24 * 3600 * 1000;

/** A game on Dancing with the Stars with six couples and three players, made `spec` through setGame, Episodes 1 to 3 with results. */
function league(spec) {
  const s = S.defaultState();
  S.ensureNextEpisode(s);
  S.updateSettings(s, "showId", "dancing-with-the-stars");
  S.updateSettings(s, "wikiSeason", 35);
  S.updateSettings(s, "leagueTypeId", "questions");
  for (let i = 0; i < 6; i++) S.addCastaway(s, `Couple ${i}`);
  s.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (const n of [1, 2, 3, 4]) S.ensureEpisodeNumber(s, n, false);
  for (const n of [1, 2, 3]) S.addElimination(s, s.episodes.find((e) => e.number === n).id, s.castaways[6 - n].id, "Eliminated");
  return s;
}
const outside = (entries) => new Map(entries.map(([n, o]) => [n, { "tvmaze:rating:7": o }]));

test("an outside number: its shape, defaults, words and settings; what's refused", () => {
  const over = { ...RATING, id: "ou", answer: "overUnder", line: 7.5 };
  const range = { ...RATING, id: "band", answer: "choice", options: ["0-6.9", "7-7.9", "8+"] };
  for (const s of [S42, questions([over]), questions([range]), questions([{ ...RATING, settle: { by: "outside", take: "rating", source: "tvmaze", after: 3 } }])]) {
    assert.deepEqual(at(s), [], JSON.stringify(s));
    assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, s)), G.fullSpec(s), JSON.stringify(s));
  }
  assert.deepEqual(G.fullQuestion(RATING).settle, { by: "outside", take: "rating", source: "tvmaze", after: 7 }, "the defaults: TVmaze, 7 days");
  assert.equal(G.outsideKey(RATING.settle), "tvmaze:rating:7");
  assert.equal(G.outsideKey({ by: "outside", take: "rating", after: 3 }), "tvmaze:rating:3");
  assert.equal(G.isOutside(RATING), true);
  assert.equal(G.typeOf(S42), "questions");
  // The words: how it's settled, and its fallback.
  const d = G.describeSpec(S42, { show: "Dancing with the Stars 35" });
  assert.match(d.rules.join(" "), /It's settled by the episode's TVmaze rating 7 days after it airs\. If TVmaze has no rating by then, it doesn't count either way\./);
  assert.match(G.describeSpec(questions([{ ...RATING, settle: { by: "outside", take: "rating", after: 1 } }]), {}).rules.join(" "), /TVmaze rating a day after it airs/);
  // Refused: another source, a moment outside 1 to 30 days, asked other than each episode, over a few, about each couple, against
  // the bot, its options not a rating's, source or after on another settle, a season not linked to TVmaze.
  const one = (q, ctx) => at(questions([{ ...RATING, ...q }]), ctx);
  assert.deepEqual(one({ settle: { by: "outside", take: "rating", source: "imdb" } }), ["ask[0].settle.source"]);
  assert.deepEqual(one({ settle: { by: "outside", take: "rating", after: 0 } }), ["ask[0].settle.after"]);
  assert.deepEqual(one({ settle: { by: "outside", take: "rating", after: 31 } }), ["ask[0].settle.after"]);
  assert.deepEqual(one({ settle: { by: "outside", take: "votes" } }), ["ask[0].settle.take"]);
  assert.deepEqual(one({ asked: "once" }), ["ask[0].asked"]);
  assert.deepEqual(one({ over: 2 }), ["ask[0].asked"]);
  assert.ok(one({ each: "person" }).includes("ask[0].settle"));
  assert.deepEqual(one({ beat: { by: "bot" } }), ["ask[0].beat"]);
  assert.deepEqual(one({ answer: "choice", options: ["low", "high"] }), ["ask[0].options"]);
  assert.deepEqual(one({ answer: "choice", options: ["7.25", "8+"] }), ["ask[0].options"], "a tenth at most");
  assert.deepEqual(one({ answer: "yesNo" }), ["ask[0].settle"]);
  assert.deepEqual(at(questions([{ ...RATING, settle: { by: "moment", take: "count", moment: "eliminated", after: 7 } }])), ["ask[0].settle.after"]);
  assert.deepEqual(one({}, { ...CTX, tvmaze: false }), ["ask[0].settle"]);
  assert.match(G.specProblems(S42, { ...CTX, tvmaze: false })[0].problem, /isn't linked to TVmaze/);
  assert.deepEqual(one({}, { ...CTX, tvmaze: undefined }), [], "left out: not checked");
  // A count's options stay whole numbers.
  assert.equal(G.optionRange("7-7.9"), null);
  assert.deepEqual(G.optionRange("7-7.9", true), { min: 7, max: 7.9 });
  // An answer is a rating, 0 to 10.
  assert.equal(G.answerProblem(RATING, 7.4), null);
  assert.equal(G.answerProblem(RATING, 11), "A rating, 0 to 10");
});

test("graded: the closest, the line, a range; void when TVmaze had none; waiting before it's read, and past what you've seen", () => {
  const over = { ...RATING, id: "ou", answer: "overUnder", line: 7.5, points: 1 };
  const range = { ...RATING, id: "band", answer: "choice", options: ["0-6.9", "7-7.9", "8+"], points: 2 };
  const s = league(questions([RATING, over, range]));
  const rows = [
    { playerId: "ann", question: "rating", episode: 1, answer: 7.1 }, { playerId: "bo", question: "rating", episode: 1, answer: 8 }, { playerId: "cy", question: "rating", episode: 1, answer: 6.9 },
    { playerId: "ann", question: "ou", episode: 1, answer: "over" }, { playerId: "bo", question: "ou", episode: 1, answer: "under" },
    { playerId: "ann", question: "band", episode: 1, answer: "7-7.9" }, { playerId: "bo", question: "band", episode: 1, answer: "8+" },
    { playerId: "ann", question: "rating", episode: 2, answer: 9 }, { playerId: "bo", question: "rating", episode: 2, answer: 5 },
    { playerId: "ann", question: "rating", episode: 3, answer: 9 },
  ];
  // Nothing read at all: every one waits.
  const none = A.grade(s, rows);
  assert.equal(none.verdicts.get("rating|1").state, "waiting");
  assert.deepEqual(Object.fromEntries(none.points), {});
  // Episode 1 read at 7.0; Episode 2 TVmaze had none; Episode 3 not read yet.
  const facts = { ...A.facts(s), outside: outside([[1, { state: "value", value: 7 }], [2, { state: "none", why: "TVmaze had no rating for it 7 days after it aired" }]]) };
  const g = A.grade(s, rows, facts);
  assert.deepEqual(g.verdicts.get("rating|1"), { state: "known", right: [], value: 7 });
  // The closest (ann 7.1 and cy 6.9, a tie: both), under the line (bo), the range 7 to 7.9 (ann).
  assert.deepEqual(Object.fromEntries(g.points), { ann: 3 + 2, cy: 3, bo: 1 });
  assert.equal(g.verdicts.get("rating|2").state, "off");
  assert.equal(g.verdicts.get("rating|2").why, "TVmaze had no rating for it 7 days after it aired: it doesn't count either way");
  assert.equal(g.verdicts.get("rating|3").state, "waiting");
  // An outside number read after another moment's (after: 3) isn't this one's.
  const other = { ...A.facts(s), outside: new Map([[1, { "tvmaze:rating:3": { state: "value", value: 7 } }]]) };
  assert.equal(A.grade(s, rows, other).verdicts.get("rating|1").state, "waiting");
  // Episode 4 has no results: its rating waits, even if read (the spoiler guard's, as any question about the episode).
  const four = { ...A.facts(s), outside: outside([[4, { state: "value", value: 8 }]]) };
  assert.equal(G.verdictOf(A.questions(s)[0], 4, four).state, "waiting");
  // A tenth either side of a rating is a tie (no float noise between 8.2 and 8.4 on an 8.3).
  const tie = G.pointsFor(RATING, { state: "known", right: [], value: 8.3 }, [{ playerId: "ann", answer: 8.2 }, { playerId: "bo", answer: 8.4 }, { playerId: "cy", answer: 8.6 }]);
  assert.deepEqual(Object.fromEntries(tie), { ann: 3, bo: 3 });
  // The walk through Episode 1 doesn't see Episode 2's.
  assert.equal(G.factsThrough(facts, 1).outside.has(2), false);
});

/** A pool that answers settleOutside's queries from `db`: the leagues, the seasons, the stored numbers, the listing; records inserts. */
function fakePool(db) {
  return {
    inserted: [],
    async query(sql, params) {
      if (/FROM leagues/.test(sql)) return { rows: db.leagues.map((state) => ({ state })) };
      if (/FROM show_seasons ss JOIN shows s/.test(sql)) return { rows: db.seasons };
      if (/FROM outside_numbers/.test(sql)) return { rows: db.stored.filter((r) => r.season_id === params[0]) };
      if (/SELECT listing_id/.test(sql)) return { rows: [{ listing_id: db.listing }] };
      if (/INSERT INTO outside_numbers/.test(sql)) {
        const [season_id, episode, source, what, after_days, value, why] = params;
        if (!db.stored.some((r) => r.season_id === season_id && r.episode === episode && r.source === source && r.what === what && r.after_days === after_days)) {
          db.stored.push({ season_id, episode, source, what, after_days, value, why });
          this.inserted.push({ episode, value, why });
        }
        return { rows: [] };
      }
      throw new Error(`unexpected query: ${sql}`);
    },
  };
}

test("what's due and stored: each episode once, its moment after it airs; unlisted; TVmaze not answering, then its grace", async () => {
  const s = league(S42);
  assert.deepEqual(asked(s), [{ source: "tvmaze", what: "rating", after: 7 }]);
  // A game from Episode 2 on reads nothing of Episode 1.
  const later = league({ ...S42, span: { from: 2, to: null } });
  const p2 = fakePool({ leagues: [later], seasons: [{ id: "sea", slug: "dancing-with-the-stars", season_number: 35, episode_count: 10, premiere_date: "2026-09-14", air_time: "20:00", air_tz: "America/New_York", release: "weekly", drop_at: null, wiki_air_dates: {} }], stored: [], listing: 1234 });
  await settleOutside(p2, { now: Date.parse("2026-09-15T00:00:00Z") + 14 * DAY + 1000, fetchRatings: async () => new Map([[1, 7], [2, 8]]), log: () => {} });
  assert.deepEqual(p2.inserted, [{ episode: 2, value: 8, why: null }]);
  // A weekly season, Mondays at 8 PM Eastern from 2026-09-14: Episode 1 airs 2026-09-15T00:00Z.
  const season = { id: "sea", slug: "dancing-with-the-stars", season_number: 35, episode_count: 10, premiere_date: "2026-09-14", air_time: "20:00", air_tz: "America/New_York", release: "weekly", drop_at: null, wiki_air_dates: {} };
  const ep1 = Date.parse("2026-09-15T00:00:00Z");
  const db = { leagues: [s], seasons: [season], stored: [], listing: 1234 };
  let asks = 0;
  const fetchRatings = async (id) => { asks++; assert.equal(id, 1234); return new Map([[1, 7.3], [2, null]]); };
  const log = () => {};
  // Six days after Episode 1: nothing due, TVmaze not asked.
  let pool = fakePool(db);
  assert.deepEqual(await settleOutside(pool, { now: ep1 + 6 * DAY, fetchRatings, log }), []);
  assert.equal(asks, 0);
  // Seven days after: Episode 1's, as TVmaze has it now.
  pool = fakePool(db);
  await settleOutside(pool, { now: ep1 + 7 * DAY + 1000, fetchRatings, log });
  assert.deepEqual(pool.inserted, [{ episode: 1, value: 7.3, why: null }]);
  // Fourteen days after: Episode 2's (none: TVmaze had no rating), Episode 1's never read again, a later rating notwithstanding.
  pool = fakePool(db);
  await settleOutside(pool, { now: ep1 + 14 * DAY + 1000, fetchRatings: async () => new Map([[1, 9.9], [2, null]]), log });
  assert.deepEqual(pool.inserted, [{ episode: 2, value: null, why: "none" }]);
  assert.equal(db.stored.find((r) => r.episode === 1).value, 7.3);
  // A dry run stores nothing.
  pool = fakePool(db);
  assert.equal((await settleOutside(pool, { now: ep1 + 21 * DAY + 1000, fetchRatings, log, dry: true })).length, 1);
  assert.deepEqual(pool.inserted, []);
  // TVmaze not answering: tried again next time, until GRACE_DAYS past its moment, then void (unreached).
  const down = async () => { throw new Error("TVmaze answered 503"); };
  pool = fakePool(db);
  await settleOutside(pool, { now: ep1 + 21 * DAY + 1000, fetchRatings: down, log });
  assert.deepEqual(pool.inserted, []);
  pool = fakePool(db);
  await settleOutside(pool, { now: ep1 + (21 + GRACE_DAYS) * DAY + 1000, fetchRatings: down, log });
  assert.deepEqual(pool.inserted, [{ episode: 3, value: null, why: "unreached" }]);
  // A season not linked to TVmaze: tried again (a season linked late still settles), then void (unlisted); TVmaze never asked.
  const db2 = { leagues: [s], seasons: [season], stored: [], listing: null };
  asks = 0;
  pool = fakePool(db2);
  await settleOutside(pool, { now: ep1 + 7 * DAY + 1000, fetchRatings, log });
  assert.deepEqual(pool.inserted, []);
  pool = fakePool(db2);
  await settleOutside(pool, { now: ep1 + (7 + GRACE_DAYS) * DAY + 1000, fetchRatings, log });
  assert.deepEqual(pool.inserted, [{ episode: 1, value: null, why: "unlisted" }]);
  assert.equal(asks, 0);
  // Linked late, within the grace: read as any other.
  const db3 = { leagues: [s], seasons: [season], stored: [], listing: null };
  await settleOutside(fakePool(db3), { now: ep1 + 8 * DAY, fetchRatings, log });
  db3.listing = 1234;
  pool = fakePool(db3);
  await settleOutside(pool, { now: ep1 + 9 * DAY, fetchRatings, log });
  assert.deepEqual(pool.inserted, [{ episode: 1, value: 7.3, why: null }]);
  // No game asking one: nothing read at all.
  pool = fakePool({ leagues: [], seasons: [season], stored: [], listing: 1234 });
  assert.deepEqual(await settleOutside(pool, { now: ep1 + 30 * DAY, fetchRatings, log }), []);
});
