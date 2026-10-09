// Episode research as a compiled-research cache (docs/PLAN-episode-research-compiled-cache.md): the
// merge a partial run does into the stored answers, the coverage check that narrows a league's prompt,
// and the per-league paste path end to end against an in-memory database
// (tests/harness/fake-research-db.js). Run with `npm test`.
//
// The admin path's "nothing changed" proof is tests/harness/research-store-regression.js (a before/after
// diff); the test here pins the one property it rests on -- the admin store never merges.
const test = require("node:test");
const assert = require("node:assert/strict");
const { fakeResearchDb, stubEmbeddings } = require("./harness/fake-research-db.js");

stubEmbeddings();
const R = require("../db/episode-research.js");
const Formats = require("../src/lib/game/formats/index.js");
const StateLogic = require("../src/lib/game/state-logic.js");
const { termsFor } = require("../db/wiki-sync.js");

const survivor = Formats.formatFor("survivor");
const CAST = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson"];

const entry = (name, confidence, extra = {}) => ({ name, confidence, sources: ["https://example.com"], ...extra });

// ---------- piece 1: the merge ----------

test("merge: someone the new run didn't answer for keeps their stored entry untouched", () => {
  const stored = { summary: "old", castaways: [entry("Ada Lovelace", "high", { foundAdvantage: "yes" }), entry("Grace Hopper", "low")] };
  const { payload, kept, replaced } = R.mergeResearchPayload(stored, { summary: "new", castaways: [entry("Grace Hopper", "medium")] });
  assert.deepEqual(payload.castaways[0], stored.castaways[0]);
  assert.equal(payload.castaways[1].confidence, "medium");
  assert.deepEqual(kept, ["Ada Lovelace"]);
  assert.deepEqual(replaced, ["Grace Hopper"]);
  assert.equal(payload.summary, "new");
});

test("merge: in both, the more confident entry wins; a tie goes to the newer one", () => {
  const stored = { castaways: [entry("Ada Lovelace", "high", { tag: "old" }), entry("Grace Hopper", "medium", { tag: "old" })] };
  const { payload } = R.mergeResearchPayload(stored, {
    castaways: [entry("Ada Lovelace", "low", { tag: "new" }), entry("Grace Hopper", "medium", { tag: "new" })],
  });
  assert.equal(payload.castaways[0].tag, "old", "a less confident re-answer doesn't overwrite a confident one");
  assert.equal(payload.castaways[1].tag, "new", "a tie keeps the newer answer");
});

test("merge: a re-answer keeps the stored spelling; someone new is added", () => {
  const stored = { castaways: [entry("Ada Lovelace", "low")] };
  const { payload, added } = R.mergeResearchPayload(stored, { castaways: [entry("Ada", "high"), entry("Grace Hopper", "high")] });
  assert.deepEqual(payload.castaways.map((c) => [c.name, c.confidence]), [["Ada Lovelace", "high"], ["Grace Hopper", "high"]]);
  assert.deepEqual(added, ["Grace Hopper"]);
});

test("merge: episode-level answers fall back to the stored ones only where the new run had none; bets merge by question", () => {
  const stored = {
    episodeTitle: "Old title",
    tribalCouncilHeld: "yes",
    rulesNote: "A new twist.",
    castaways: [],
    betAnswers: [{ question: "Idol played?", answer: "yes" }, { question: "Who goes home?", answer: "Ada" }],
  };
  const { payload } = R.mergeResearchPayload(stored, {
    episodeTitle: "New title",
    tribalCouncilHeld: "unknown",
    rulesNote: null,
    castaways: [],
    betAnswers: [{ question: "who goes home", answer: "Grace" }],
  });
  assert.equal(payload.episodeTitle, "New title");
  assert.equal(payload.tribalCouncilHeld, "yes");
  assert.equal(payload.rulesNote, "A new twist.");
  assert.deepEqual(payload.betAnswers.map((a) => a.answer).sort(), ["Grace", "yes"]);
});

test("merge: with nothing stored, the new run is the answer as-is", () => {
  const incoming = { castaways: [entry("Ada Lovelace", "high")] };
  assert.equal(R.mergeResearchPayload(null, incoming).payload, incoming);
});

test("the admin store replaces wholesale and never merges (no read, no lock -- one upsert of exactly what it was given)", async () => {
  const queries = [];
  const pool = {
    query: async (sql, params) => {
      queries.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      return { rows: [{ id: "r1" }] };
    },
    connect: async () => assert.fail("the admin store must not open a merge transaction"),
  };
  const payload = { castaways: [entry("Ada Lovelace", "low")] };
  const out = await R.storeResearch(pool, { showId: "s", season: 1, episodeNumber: 2 }, payload, { format: "survivor" }, {});
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /^INSERT INTO episode_research .* DO UPDATE SET payload=EXCLUDED.payload/);
  assert.equal(queries[0].params[3], JSON.stringify(payload));
  assert.equal(out.payload, payload);
});

// ---------- piece 3: coverage ----------

const stored = (castaways, format = "survivor") => ({ payload: { castaways }, provenance: { format }, researched_at: "t" });

test("coverage: fully covered -- nobody to ask", () => {
  const c = R.researchCoverage(stored(CAST.map((n) => entry(n, "medium"))), CAST, "survivor");
  assert.equal(c.researched, true);
  assert.deepEqual(c.covered, CAST);
  assert.deepEqual(c.needsAsking, []);
});

test("coverage: partially covered -- only the missing are asked", () => {
  const c = R.researchCoverage(stored([entry("Ada Lovelace", "high"), entry("Grace", "medium")]), CAST, "survivor");
  assert.deepEqual(c.covered, ["Ada Lovelace", "Grace Hopper"], "matched by the same forgiving name match as everything else");
  assert.deepEqual(c.missing, ["Alan Turing", "Katherine Johnson"]);
  assert.deepEqual(c.needsAsking, ["Alan Turing", "Katherine Johnson"]);
});

test("coverage: fully answered but some low-confidence -- those are asked again", () => {
  const c = R.researchCoverage(stored(CAST.map((n, i) => entry(n, i < 2 ? "low" : "high"))), CAST, "survivor");
  assert.deepEqual(c.missing, []);
  assert.deepEqual(c.lowConfidence, ["Ada Lovelace", "Grace Hopper"]);
  assert.deepEqual(c.needsAsking, ["Ada Lovelace", "Grace Hopper"]);
});

test("coverage: nothing stored, or answers to another format's checklist, settle nobody", () => {
  assert.deepEqual(R.researchCoverage(null, CAST, "survivor").needsAsking, CAST);
  const other = R.researchCoverage(stored(CAST.map((n) => entry(n, "high")), "traitors"), CAST, "survivor");
  assert.equal(other.researched, false);
  assert.deepEqual(other.needsAsking, CAST);
});

// ---------- pieces 2 + 3 end to end: a self-serve season nobody catalogued ----------

// Two leagues on a researched show with NO show_seasons row for their season and NO season_cast: each
// typed its own cast, spelled a little differently.
function selfServeWorld() {
  const league = (id, names) => {
    const state = StateLogic.defaultState();
    state.settings.showId = "my-show";
    state.settings.wikiSeason = 3;
    state.settings.showFormat = "survivor";
    StateLogic.applyCastImport(state, { castaways: names.map((name) => ({ name })) });
    return { id, name: id, state };
  };
  return fakeResearchDb({
    shows: [{ id: "show-x", slug: "my-show", name: "My Show", format: "survivor" }],
    leagues: [league("league-a", CAST), league("league-b", ["Ada", "Grace Hopper", "Alan Turing", "Katherine Johnson"])],
  });
}

// A chat's JSON answer for exactly `names` (the prompt's own skeleton), with `edits` per person.
function chatAnswer(names, edits = {}) {
  const ctx = { showName: "My Show", showSlug: "my-show", season: 3, episodeNumber: 1, castNames: names, terms: termsFor({}).terms, format: survivor, domains: [] };
  const skel = R.pasteSkeleton(ctx, []);
  skel.summary = "Episode one.";
  for (const c of skel.castaways) Object.assign(c, { confidence: "high", sources: ["https://example.com/recap"] }, edits[c.name] || {});
  return "```json\n" + JSON.stringify(skel) + "\n```";
}

test("league path: no catalog season and no season cast -- the league's own cast is asked, and the season row is created on paste", async () => {
  const { db, pool } = selfServeWorld();
  const status = await R.leagueResearchStatus(pool, "league-a", 1);
  assert.equal(status.ctx.seasonId, null);
  assert.equal(status.coverage.researched, false);
  assert.deepEqual(status.coverage.needsAsking, CAST);
  for (const n of CAST) assert.ok(status.prompt.includes(n));
  assert.equal(db.seasons.length, 0, "reading the status creates nothing");

  // League A pastes a PARTIAL answer: Ada and Grace confidently, Alan and Katherine low.
  const run = await R.researchFromPasteForLeague(
    pool,
    "league-a",
    1,
    chatAnswer(CAST, {
      "Ada Lovelace": { leftTheGame: "yes", exitMethod: "Voted Out" },
      "Grace Hopper": { foundAdvantage: "yes" },
      "Alan Turing": { confidence: "low", wonIndividualImmunity: "yes" },
      "Katherine Johnson": { confidence: "low" },
    })
  );
  assert.equal(db.seasons.length, 1);
  assert.equal(db.seasons[0].lazy, true);
  assert.equal(run.seasonId, db.seasons[0].id);
  assert.equal(run.castFrom, "league");
  assert.equal(db.research.length, 1);
  assert.ok(db.decisions.length >= 3, "the yes answers were staged");

  // League B, same season and episode: Ada and Grace are settled, so only the low-confidence two are asked.
  const b = await R.leagueResearchStatus(pool, "league-b", 1);
  assert.deepEqual(b.coverage.covered, ["Ada", "Grace Hopper"]);
  assert.deepEqual(b.coverage.needsAsking.sort(), ["Alan Turing", "Katherine Johnson"]);
  assert.ok(!b.prompt.includes("Grace Hopper") && !b.prompt.includes("Lovelace"), "the prompt is narrowed to who's left");
  assert.ok(b.prompt.includes("Alan Turing") && b.prompt.includes("Katherine Johnson"));
});

test("league path: a partial paste merges into the stored answers, and staging keeps everyone else's pending decisions", async () => {
  const { db, pool } = selfServeWorld();
  await R.researchFromPasteForLeague(
    pool,
    "league-a",
    1,
    chatAnswer(CAST, {
      "Ada Lovelace": { leftTheGame: "yes", exitMethod: "Voted Out" },
      "Grace Hopper": { foundAdvantage: "yes" },
      "Alan Turing": { confidence: "low", wonIndividualImmunity: "yes" },
      "Katherine Johnson": { confidence: "low" },
    })
  );
  const before = db.decisions.map((d) => `${d.castaway_name}|${d.kind}|${d.event_type}`).sort();

  // League B answers the two it was asked about -- plus a volunteered answer about Ada, who it wasn't
  // asked about and which must not land.
  const narrowed = ["Alan Turing", "Katherine Johnson"];
  const skel = JSON.parse(chatAnswer(narrowed, { "Alan Turing": { wonIndividualImmunity: "yes" }, "Katherine Johnson": { foundAdvantage: "yes" } }).slice(8, -4));
  skel.castaways.push({ ...skel.castaways[0], name: "Ada", leftTheGame: "no", wonIndividualImmunity: "no", confidence: "high" });
  const run = await R.researchFromPasteForLeague(pool, "league-b", 1, JSON.stringify(skel));

  assert.equal(db.research.length, 1, "still one row per episode");
  const row = db.research[0].payload.castaways;
  assert.deepEqual(row.map((c) => [c.name, c.confidence]), CAST.map((n) => [n, "high"]), "merged, with league A's spellings kept");
  assert.equal(row[0].leftTheGame, "yes", "Ada's stored answer survived the volunteered one");
  assert.ok(row[3].foundAdvantage === "yes");
  assert.deepEqual(run.provenance.mergedInto.castKept.sort(), ["Ada Lovelace", "Grace Hopper"]);

  const after = db.decisions.map((d) => `${d.castaway_name}|${d.kind}|${d.event_type}`).sort();
  for (const k of before) assert.ok(after.includes(k), `league A's pending ${k} was withdrawn by league B's partial run`);
  assert.ok(after.some((k) => k.startsWith("Katherine Johnson|event|")), "league B's new answer was staged");
  assert.equal(db.log.filter((w) => w.write === "withdrawn").length, 0);
  // Nobody's league changed: staging only.
  assert.equal(db.leagues.every((l) => l.state.castaways.every((c) => c.status === "active")), true);
});

test("league path: a paste that skips some of who it was asked about is kept, and the skipped stay to be asked", async () => {
  const { db, pool } = selfServeWorld();
  // A real chat that ran short: answers for two of the four, nothing at all for the other two.
  const skel = JSON.parse(chatAnswer(CAST, { "Ada Lovelace": { leftTheGame: "yes", exitMethod: "Voted Out" } }).slice(8, -4));
  skel.castaways = skel.castaways.slice(0, 2);
  const run = await R.researchFromPasteForLeague(pool, "league-a", 1, JSON.stringify(skel));
  assert.ok(run.problems.some((p) => /no answers for 2 .*still to research: Alan Turing, Katherine Johnson/.test(p)), run.problems.join("; "));
  assert.deepEqual(db.research[0].payload.castaways.map((c) => c.name), ["Ada Lovelace", "Grace Hopper"]);
  assert.ok(db.decisions.some((d) => d.castaway_name === "Ada Lovelace" && d.kind === "elimination"));

  const next = await R.leagueResearchStatus(pool, "league-a", 1);
  assert.deepEqual(next.coverage.missing, ["Alan Turing", "Katherine Johnson"]);
  assert.ok(!next.prompt.includes("Ada Lovelace") && next.prompt.includes("Alan Turing"));
});

test("league path: a paste answering NOBODY it asked about is still refused (wrong names, most likely)", async () => {
  const { db, pool } = selfServeWorld();
  const skel = JSON.parse(chatAnswer(CAST).slice(8, -4));
  // Close, but not the names as asked -- the prompt says to keep every name exactly as written.
  skel.castaways = skel.castaways.map((c) => ({ ...c, name: c.name.split(" ")[0] }));
  await assert.rejects(R.researchFromPasteForLeague(pool, "league-a", 1, JSON.stringify(skel)), /don't cover the cast, so nothing was saved/);
  assert.equal(db.research.length, 0);
  assert.equal(db.seasons.length, 1, "the season row may exist by now -- harmless, it's what the next paste needs");
});

test("league path: an entry not named as asked is dropped, as reported, not merged by a looser match", async () => {
  const { db, pool } = selfServeWorld();
  const skel = JSON.parse(chatAnswer(CAST).slice(8, -4));
  skel.castaways[0].name = "Ada"; // asked as "Ada Lovelace"
  const run = await R.researchFromPasteForLeague(pool, "league-a", 1, JSON.stringify(skel));
  assert.ok(run.problems.some((p) => /who aren't in the cast, dropped: Ada$/.test(p)));
  assert.ok(run.problems.some((p) => /still to research: Ada Lovelace/.test(p)));
  assert.deepEqual(db.research[0].payload.castaways.map((c) => c.name), ["Grace Hopper", "Alan Turing", "Katherine Johnson"]);
});

test("the admin path still refuses a paste that leaves anyone out (its store replaces, so a gap would erase them)", () => {
  const review = R.validateResearch({ castaways: [entry("Ada Lovelace", "high")] }, CAST, termsFor({}).terms, survivor);
  assert.equal(review.fatal.length, 1);
  assert.match(review.fatal[0], /no answers for 3/);
});

test("league path: the prompt says to paste back into the commissioner's panel, not the admin one", async () => {
  const { pool } = selfServeWorld();
  const { prompt } = await R.leagueResearchStatus(pool, "league-a", 1);
  assert.match(prompt, /"Research this episode" box/);
  assert.doesNotMatch(prompt, /Structured \(JSON\)/);
});

test("league path: fully covered -- no prompt, and a paste is refused rather than re-asking", async () => {
  const { pool } = selfServeWorld();
  await R.researchFromPasteForLeague(pool, "league-a", 1, chatAnswer(CAST));
  const status = await R.leagueResearchStatus(pool, "league-b", 1);
  assert.equal(status.prompt, null);
  assert.deepEqual(status.coverage.needsAsking, []);
  await assert.rejects(R.researchFromPasteForLeague(pool, "league-b", 1, chatAnswer(CAST)), /already researched for everyone/);
});

test("league path: an empty league roster is a clear error (cast first), not an empty checklist", async () => {
  const { db, pool } = selfServeWorld();
  db.leagues[0].state.castaways = [];
  await assert.rejects(R.leagueResearchStatus(pool, "league-a", 1), /No cast to ask about/);
});
