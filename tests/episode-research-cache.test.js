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

test("just what's new (docs/PLAN-maker-scoring.md step 5): only the questions stored answers have nothing for, filled in", () => {
  const keys = R.checklistKeys(survivor);
  assert.ok(keys.includes("votesReceived") && !keys.includes("name") && !keys.includes("confidence"), "the format's own questions, not the core ones");
  // Answers from before votesReceived and wentOnJourney were asked: those two are what's missing.
  const old = { castaways: [Object.fromEntries(["name", "confidence", ...keys.filter((k) => k !== "votesReceived" && k !== "wentOnJourney")].map((k) => [k, "no"]))] };
  assert.deepEqual(R.unaskedKeys(survivor, old), ["votesReceived", "wentOnJourney"]);
  assert.deepEqual(R.unaskedKeys(survivor, { castaways: [Object.fromEntries(keys.map((k) => [k, "no"]))] }), []);
  // A question asked besides, which scores nothing (anything else notable, what was found), isn't asked again for.
  const noNotes = { castaways: [Object.fromEntries(keys.filter((k) => !["notableTwist", "advantageFoundName"].includes(k)).map((k) => [k, "no"]))] };
  assert.deepEqual(R.unaskedKeys(survivor, noNotes), []);
  // The cut-down checklist: the core fields and those keys, nothing per episode, no groups or merge.
  const only = R.onlyFormat(survivor, ["votesReceived"]);
  const schema = R.researchSchemaFor(only);
  assert.deepEqual(Object.keys(schema.shape.castaways.element.shape).sort(), ["confidence", "exitMethod", "leftTheGame", "name", "sources", "votesReceived"]);
  assert.equal("merged" in schema.shape, false);
  assert.ok("summary" in schema.shape && "airDate" in schema.shape, "still says which episode it's about");
  assert.equal(survivor.hasGroups, true, "the format itself is untouched");
  // Filled in: the new answer joins the stored entry, everything it had stays.
  const stored = { castaways: [{ ...entry("Ada Lovelace", "high"), attendedTribal: "yes", foundAdvantage: "yes" }] };
  const merged = R.mergeResearchPayload(stored, { castaways: [{ name: "Ada Lovelace", leftTheGame: "no", exitMethod: null, sources: ["https://x"], confidence: "medium", votesReceived: 2 }] }, { fill: true }).payload;
  assert.equal(merged.castaways[0].votesReceived, 2);
  assert.equal(merged.castaways[0].attendedTribal, "yes");
  assert.equal(merged.castaways[0].foundAdvantage, "yes");
  assert.equal(merged.castaways[0].confidence, "high");
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

const stored = (castaways, format = "survivor", rulebook) => ({ payload: { castaways }, provenance: { format, ...(rulebook ? { rulebook } : {}) }, researched_at: "t" });
// What asks now (contextFrom): the format, and the season's rulebook when it's what asks.
const asks = (formatId, rulebook = null) => ({ format: { id: formatId }, rulebook });

test("coverage: fully covered -- nobody to ask", () => {
  const c = R.researchCoverage(stored(CAST.map((n) => entry(n, "medium"))), CAST, asks("survivor"));
  assert.equal(c.researched, true);
  assert.deepEqual(c.covered, CAST);
  assert.deepEqual(c.needsAsking, []);
});

test("coverage: partially covered -- only the missing are asked", () => {
  const c = R.researchCoverage(stored([entry("Ada Lovelace", "high"), entry("Grace", "medium")]), CAST, asks("survivor"));
  assert.deepEqual(c.covered, ["Ada Lovelace", "Grace Hopper"], "matched by the same forgiving name match as everything else");
  assert.deepEqual(c.missing, ["Alan Turing", "Katherine Johnson"]);
  assert.deepEqual(c.needsAsking, ["Alan Turing", "Katherine Johnson"]);
});

test("coverage: fully answered but some low-confidence -- those are asked again", () => {
  const c = R.researchCoverage(stored(CAST.map((n, i) => entry(n, i < 2 ? "low" : "high"))), CAST, asks("survivor"));
  assert.deepEqual(c.missing, []);
  assert.deepEqual(c.lowConfidence, ["Ada Lovelace", "Grace Hopper"]);
  assert.deepEqual(c.needsAsking, ["Ada Lovelace", "Grace Hopper"]);
});

test("coverage: nothing stored, or answers to another format's checklist, settle nobody", () => {
  assert.deepEqual(R.researchCoverage(null, CAST, asks("survivor")).needsAsking, CAST);
  const other = R.researchCoverage(stored(CAST.map((n) => entry(n, "high")), "traitors"), CAST, asks("survivor"));
  assert.equal(other.researched, false);
  assert.deepEqual(other.needsAsking, CAST);
});

test("coverage: stored answers are matched by the rulebook that asked them, whatever its format is called now", () => {
  const all = CAST.map((n) => entry(n, "high"));
  const X = { id: "rulebook-x", version: 3 };
  // The season's rulebook moved onto new rules (its question map keeps the keys) under another format id: still its answers.
  assert.equal(R.researchCoverage(stored(all, "survivor", X), CAST, asks("survivor-blocks", { id: "rulebook-x", version: 4 })).researched, true);
  // Another rulebook of the same format (a show switched away and back: the same questions) reads them as ever.
  assert.equal(R.researchCoverage(stored(all, "survivor", X), CAST, asks("survivor", { id: "rulebook-y", version: 1 })).researched, true);
  // Another rulebook and another format: not its answers.
  assert.equal(R.researchCoverage(stored(all, "survivor", X), CAST, asks("traitors", { id: "rulebook-y", version: 1 })).researched, false);
  // Answers from before the rulebook was recorded, or asked with none, go by the format that asked them.
  assert.equal(R.researchCoverage(stored(all, "survivor"), CAST, asks("survivor", X)).researched, true);
  assert.equal(R.researchCoverage(stored(all, "traitors"), CAST, asks("survivor", X)).researched, false);
  assert.equal(R.researchCoverage(stored(all, "survivor", X), CAST, asks("survivor")).researched, true);
  // From before formats recorded one: the default's.
  const old = { payload: { castaways: all }, provenance: {}, researched_at: "t" };
  assert.equal(R.researchCoverage(old, CAST, asks("survivor")).researched, true);
  assert.equal(R.researchCoverage(old, CAST, asks("traitors")).researched, false);
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

test("merge, fill (research again): unknowns never erase, later answers win, a later no keeps an earlier yes and says so", () => {
  const stored = {
    castaways: [
      entry("Ada Lovelace", "medium", { foundAdvantage: "yes", wonTribeImmunity: "unknown", votesReceived: null, newGroup: "Dina" }),
      entry("Grace Hopper", "high", { satOutOfChallenge: "no", playedAdvantage: "unknown" }),
    ],
  };
  const { payload, disagreements } = R.mergeResearchPayload(
    stored,
    {
      castaways: [
        { name: "Ada", confidence: "low", sources: ["https://second.example"], foundAdvantage: "no", wonTribeImmunity: "yes", votesReceived: 2, newGroup: null },
        { name: "Grace Hopper", confidence: "high", sources: [], satOutOfChallenge: "yes", playedAdvantage: "unknown" },
      ],
    },
    { fill: true }
  );
  const [ada, grace] = payload.castaways;
  assert.equal(ada.name, "Ada Lovelace", "the stored spelling stays");
  assert.equal(ada.foundAdvantage, "yes", "a later no doesn't silently erase an earlier yes");
  assert.equal(ada.wonTribeImmunity, "yes", "a gap is filled");
  assert.equal(ada.votesReceived, 2);
  assert.equal(ada.newGroup, "Dina", "a pass that saw no move doesn't undo one");
  assert.equal(ada.confidence, "medium", "the better confidence of the two");
  assert.deepEqual(ada.sources, ["https://example.com", "https://second.example"]);
  assert.equal(grace.satOutOfChallenge, "yes", "an earlier no (too early) is replaced by a later yes");
  assert.equal(grace.playedAdvantage, "unknown");
  assert.equal(disagreements.length, 1);
  assert.match(disagreements[0], /Ada Lovelace: .*"found advantage"/);
});

test("league path, research again: fully covered still offers everyone, and the answer fills gaps instead of replacing", async () => {
  const { db, pool } = selfServeWorld();
  await R.researchFromPasteForLeague(
    pool,
    "league-a",
    1,
    chatAnswer(CAST, { "Ada Lovelace": { leftTheGame: "yes", exitMethod: "Voted Out" }, "Grace Hopper": { foundAdvantage: "yes" } })
  );
  const plain = await R.leagueResearchStatus(pool, "league-b", 1);
  assert.equal(plain.prompt, null);
  const again = await R.leagueResearchStatus(pool, "league-b", 1, { again: true });
  assert.equal(again.again, true);
  for (const n of ["Ada", "Grace Hopper", "Alan Turing", "Katherine Johnson"]) assert.ok(again.prompt.includes(n), `again asks about ${n}`);

  // A second model: finds Alan's immunity win the first missed, says Grace found nothing, and is
  // unsure about Ada's exit.
  const second = ["Ada", "Grace Hopper", "Alan Turing", "Katherine Johnson"];
  const run = await R.researchFromPasteForLeague(
    pool,
    "league-b",
    1,
    chatAnswer(second, { Ada: { leftTheGame: "unknown" }, "Grace Hopper": { foundAdvantage: "no" }, "Alan Turing": { wonIndividualImmunity: "yes" } }),
    { again: true }
  );
  const row = db.research[0].payload.castaways;
  assert.equal(row.length, 4, "still one entry per person, under league A's spellings");
  assert.equal(row[0].leftTheGame, "yes", "Ada's exit survived the unsure second pass");
  assert.equal(row[1].foundAdvantage, "yes", "Grace's find is kept…");
  assert.ok(run.problems.some((p) => /Grace Hopper: .*"found advantage"/.test(p)), "…and the disagreement is reported");
  assert.equal(row[2].wonIndividualImmunity, "yes", "the gap is filled");
  assert.ok(db.decisions.some((d) => d.castaway_name === "Alan Turing" && d.kind === "event"), "the new find is staged");
  assert.ok(db.decisions.some((d) => d.castaway_name === "Ada Lovelace" && d.kind === "elimination"), "the first pass's results stay staged");
});

test("league path: an empty league roster is a clear error (cast first), not an empty checklist", async () => {
  const { db, pool } = selfServeWorld();
  db.leagues[0].state.castaways = [];
  await assert.rejects(R.leagueResearchStatus(pool, "league-a", 1), /No cast to ask about/);
});

// ---------- is this paste for THIS episode? / clearing it ----------

const titled = (title, airDate, summary) => ({ episodeTitle: title, airDate, summary });
const stash = (episode_number, title, air_date, summary = null) => ({ episode_number, title, air_date, summary });

test("mismatch: a paste carrying another episode's title is caught, and says which", () => {
  const m = R.pasteEpisodeMismatch(titled("The Sleeper Agent", null, ""), 6, { siblings: [stash(5, "The Sleeper Agent", "October 8, 2026"), stash(4, "Other", null)] });
  assert.equal(m.episode, 5);
  assert.match(m.message, /looks like episode 5's results, not episode 6's/);
  assert.match(m.message, /The Sleeper Agent/);
});

test("mismatch: titles compare loosely, and the episode's own title is never a mismatch", () => {
  const known = { siblings: [stash(5, "The Sleeper Agent", null), stash(6, "Fire in the Hole", null)] };
  assert.equal(R.pasteEpisodeMismatch(titled("the sleeper agent!", null, ""), 6, known).episode, 5);
  assert.equal(R.pasteEpisodeMismatch(titled("Fire in the Hole", null, ""), 6, known), null);
});

test("mismatch: another episode's air date, from stored research or the dates the league holds", () => {
  const fromResearch = R.pasteEpisodeMismatch(titled(null, "October 8, 2026", ""), 6, { siblings: [stash(5, null, "October 8, 2026")] });
  assert.equal(fromResearch.episode, 5);
  assert.match(fromResearch.message, /dated October 8, 2026, the day episode 5 aired/);
  const fromLeague = R.pasteEpisodeMismatch(titled(null, "October 8, 2026", ""), 6, {
    leagueEpisodes: [{ number: 5, airDate: "October 9, 2026" }, { number: 6, airDate: "October 16, 2026" }],
  });
  assert.equal(fromLeague.episode, 5, "a day apart is the same night in another time zone");
});

test("mismatch: the estimated schedule (airsAt) is never compared: a week off the air would make it wrong for every later episode", () => {
  const leagueEpisodes = [{ number: 5, airsAt: "2026-10-09T00:00:00.000Z" }, { number: 6, airsAt: "2026-10-16T00:00:00.000Z" }];
  assert.equal(R.pasteEpisodeMismatch(titled(null, "October 22, 2026", ""), 6, { leagueEpisodes }), null);
});

test("mismatch: the same words as another episode's summary", () => {
  const text = "Ada was voted out after a tied vote and a rock draw at a chaotic tribal council.";
  assert.equal(R.pasteEpisodeMismatch(titled(null, null, text), 6, { siblings: [stash(5, null, null, text)] }).episode, 5);
  assert.equal(R.pasteEpisodeMismatch(titled(null, null, "Short."), 6, { siblings: [stash(5, null, null, "Short.")] }), null, "too short to mean anything");
});

test("mismatch: a date that fits this episode, or a paste with nothing to compare, passes", () => {
  const siblings = [stash(5, "Five", "October 8, 2026")];
  const leagueEpisodes = [{ number: 6, airDate: "October 15, 2026" }];
  assert.equal(R.pasteEpisodeMismatch(titled("Six", "October 15, 2026", ""), 6, { siblings, leagueEpisodes }), null);
  assert.equal(R.pasteEpisodeMismatch(titled("Six", "October 16, 2026", ""), 6, { siblings, leagueEpisodes }), null, "a day out is a time zone, not a different episode");
  assert.equal(R.pasteEpisodeMismatch(titled(null, null, ""), 6, { siblings, leagueEpisodes }), null);
  assert.equal(R.pasteEpisodeMismatch(titled("Six", "no idea", ""), 6, { siblings, leagueEpisodes }), null);
  assert.equal(R.pasteEpisodeMismatch(titled("Six", "October 15, 2026", ""), 6, {}), null);
});

test("mismatch: a date that fits this episode wins over another episode holding the same title (that one may be the wrong paste)", () => {
  // Episode 6 holds episode 5's answer from an earlier mistake; now the right paste goes into episode 5.
  const siblings = [stash(6, "The Sleeper Agent", "October 8, 2026")];
  const paste = titled("The Sleeper Agent", "October 8, 2026", "");
  assert.equal(R.pasteEpisodeMismatch(paste, 5, { siblings, leagueEpisodes: [{ number: 5, airDate: "October 8, 2026" }] }), null, "a printed date for 5");
  assert.equal(R.pasteEpisodeMismatch(paste, 5, { siblings, leagueEpisodes: [{ number: 5, airsAt: "2026-10-09T00:00:00.000Z" }] }), null, "the estimated schedule, in 5's favour");
  // With nothing saying what 5's date is, it's still held -- and says where to look.
  const m = R.pasteEpisodeMismatch(paste, 5, { siblings });
  assert.equal(m.episode, 6);
  assert.match(m.message, /If episode 6 holds a paste that was meant for another episode, clear it there first/);
});

test("mismatch: two episodes on one night don't flag each other when the date fits this one", () => {
  const siblings = [stash(11, "Part one", "December 17, 2026")];
  const leagueEpisodes = [{ number: 12, airDate: "December 17, 2026" }];
  assert.equal(R.pasteEpisodeMismatch(titled("Part two", "December 17, 2026", ""), 12, { siblings, leagueEpisodes }), null);
});

test("mismatch: a date weeks off this episode's own, matching no other, is flagged more gently", () => {
  const m = R.pasteEpisodeMismatch(titled(null, "September 3, 2026", ""), 6, { leagueEpisodes: [{ number: 6, airDate: "October 15, 2026" }] });
  assert.equal(m.episode, null);
  assert.match(m.message, /may not be episode 6's results: they're dated September 3, 2026, but episode 6 is dated October 15, 2026/);
});

// A chat answer that carries its episode's title, date and summary.
const dated = (names, title, airDate, edits = {}) => {
  const body = JSON.parse(chatAnswer(names, edits).slice(8, -4));
  Object.assign(body, { episodeTitle: title, airDate, summary: `${title}: the tribes met and somebody went home at tribal council.` });
  return JSON.stringify(body);
};

test("league path: episode 1's answer pasted into episode 2 is held for confirming, saves nothing, and goes through once confirmed", async () => {
  const { db, pool } = selfServeWorld();
  const answer = dated(CAST, "The Sleeper Agent", "October 8, 2026", { "Ada Lovelace": { leftTheGame: "yes", exitMethod: "Voted Out" } });
  await R.researchFromPasteForLeague(pool, "league-a", 1, answer);
  assert.equal(db.research.length, 1);
  const decisions = db.decisions.length;

  await assert.rejects(R.researchFromPasteForLeague(pool, "league-a", 2, answer), (e) => e.code === "EPISODE_MISMATCH" && /looks like episode 1's results, not episode 2's/.test(e.message));
  assert.equal(db.research.length, 1, "nothing was stored for episode 2");
  assert.equal(db.decisions.length, decisions, "nothing was staged");

  await R.researchFromPasteForLeague(pool, "league-a", 2, answer, { confirmed: true });
  assert.deepEqual(db.research.map((r) => r.episode_number).sort(), [1, 2]);
});

test("league path: its own episode's answer, and one with no title or date, are not held", async () => {
  const { db, pool } = selfServeWorld();
  await R.researchFromPasteForLeague(pool, "league-a", 1, dated(CAST, "The Sleeper Agent", "October 8, 2026"));
  await R.researchFromPasteForLeague(pool, "league-a", 2, dated(CAST, "Fire in the Hole", "October 15, 2026"));
  await R.researchFromPasteForLeague(pool, "league-a", 3, chatAnswer(CAST));
  assert.equal(db.research.length, 3);
});

test("clear: takes the episode's research and research-only results back out, and keeps what an admin or the wiki also holds", async () => {
  const { db, pool } = selfServeWorld();
  const win = { wonIndividualImmunity: "yes" };
  const answer = dated(CAST, "The Sleeper Agent", "October 8, 2026", { "Alan Turing": win, "Katherine Johnson": win, "Grace Hopper": win });
  await R.researchFromPasteForLeague(pool, "league-a", 1, answer);
  await R.researchFromPasteForLeague(pool, "league-a", 2, answer, { confirmed: true });
  const at = (ep) => db.decisions.filter((d) => d.episode_number === ep);
  assert.equal(at(2).length, 3);
  // One of episode 2's results was also read by the wiki; one was accepted by an admin; one is research's alone.
  const [wiki, accepted] = at(2);
  wiki.from_wiki = true;
  accepted.status = "accepted";
  const episode1 = at(1).length;

  const out = await R.clearLeagueResearch(pool, "league-a", 2);
  assert.equal(out.cleared, true);
  assert.deepEqual(db.research.map((r) => r.episode_number), [1], "episode 1's research is untouched");
  assert.equal(at(1).length, episode1);
  assert.deepEqual(at(2).map((d) => d.id).sort(), [wiki.id, accepted.id].sort());
  assert.equal(wiki.from_research, false, "the wiki still reports it; research no longer does");
  assert.equal(db.leagues.every((l) => l.state.castaways.every((c) => c.status === "active")), true, "no league changed");

  // The episode asks its question afresh.
  const status = await R.leagueResearchStatus(pool, "league-a", 2);
  assert.equal(status.coverage.researched, false);
  assert.ok(status.prompt.includes("Alan Turing"));
});

test("clear: an episode with nothing pasted is a harmless no-op", async () => {
  const { pool } = selfServeWorld();
  const out = await R.clearLeagueResearch(pool, "league-a", 4);
  assert.deepEqual(out, { cleared: false, withdrawn: 0 });
});

test("a double episode: an answer dated the night both aired is the second one's when the schedule says so", () => {
  const { pasteEpisodeMismatch } = require("../db/episode-research.js");
  // Episode 1 is stored, dated the premiere night; episodes 1 and 2 aired back to back that night (an hour apart, UTC).
  const siblings = [{ episode_number: 1, title: "A New Dawn", air_date: "September 17, 2026", summary: null }];
  const parsed = { episodeTitle: "", airDate: "September 17, 2026", summary: "" };
  const schedule = [
    { number: 1, airsAt: "2026-09-18T00:00:00.000Z" },
    { number: 2, airsAt: "2026-09-18T01:00:00.000Z" },
    { number: 3, airsAt: "2026-09-25T00:00:00.000Z" },
  ];
  assert.equal(pasteEpisodeMismatch(parsed, 2, { siblings, leagueEpisodes: schedule }), null, "the schedule puts episode 2 that night too");
  assert.match(pasteEpisodeMismatch(parsed, 2, { siblings }).message, /episode 1's/, "without the schedule it reads as episode 1's (the bug)");
  assert.match(pasteEpisodeMismatch(parsed, 3, { siblings, leagueEpisodes: schedule }).message, /episode 1's/, "a week later's still caught");
});
