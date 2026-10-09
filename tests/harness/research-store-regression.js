// Regression harness for episode research's STORE-and-STAGE path (db/episode-research.js) -- the
// method tests/harness/format-regression.js uses, for the change docs/PLAN-episode-research-compiled-
// cache.md makes: episode_research learned to MERGE a partial run into what's stored, and the merge
// must not change anything about today's admin path (a full paste of an episode, then a full re-paste
// of the same, already-covered episode).
//
// Not a test: it runs fixed admin scenarios through researchFromPaste against an in-memory database
// (tests/harness/fake-research-db.js) and prints every write -- each episode_research row as stored,
// each season_decisions upsert, each withdrawal -- plus the final rows. Run it against the file before
// the change and after, and diff:
//
//   git show <before>:db/episode-research.js > db/episode-research.before.js
//   node tests/harness/research-store-regression.js db/episode-research.before.js > before.txt
//   node tests/harness/research-store-regression.js > after.txt
//   git diff --no-index before.txt after.txt          # byte-identical: the admin path is unchanged
//   rm db/episode-research.before.js
//
// (The copy has to sit in db/ so its own relative requires resolve.)
const path = require("path");
const { fakeResearchDb, stubEmbeddings } = require("./fake-research-db.js");

stubEmbeddings();
const file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, "../../db/episode-research.js");
const R = require(file);
const Formats = require("../../src/lib/game/formats/index.js");
const { termsFor } = require("../../db/wiki-sync.js");

const CAST = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson"];
const survivor = Formats.formatFor("survivor");

function world() {
  return fakeResearchDb({
    shows: [{ id: "show-1", slug: "survivor", name: "Survivor", format: "survivor" }],
    seasons: [{ id: "season-50", show_id: "show-1", season_number: 50 }],
    seasonCast: CAST.map((name) => ({ season_id: "season-50", name })),
  });
}

// A chat's full answer for `names`, built off the real skeleton, with `edits` per person.
function answer(names, edits) {
  const ctx = { showName: "Survivor", showSlug: "survivor", season: 50, episodeNumber: 1, castNames: names, terms: termsFor({}).terms, format: survivor, domains: [] };
  const skel = R.pasteSkeleton(ctx, []);
  skel.summary = "An episode.";
  for (const c of skel.castaways) Object.assign(c, { confidence: "high", sources: ["https://example.com/recap"] }, edits[c.name] || {});
  return JSON.stringify(skel);
}

const out = [];
const show = (title, value) => out.push(`## ${title}`, JSON.stringify(value, null, 1), "");

async function scenario(title, steps) {
  const { db, pool } = world();
  for (const [episode, notes] of steps) {
    try {
      const run = await R.researchFromPaste(pool, "survivor", 50, episode, notes, { structured: true });
      show(`${title}: run ep ${episode} result`, {
        castNames: run.castNames,
        problems: run.problems,
        counts: run.counts,
        decisions: run.decisions,
        payload: run.payload,
      });
    } catch (e) {
      show(`${title}: run ep ${episode} threw`, e.message);
    }
  }
  show(`${title}: writes`, db.log);
  show(`${title}: episode_research`, db.research.map((r) => ({ ep: r.episode_number, payload: r.payload })));
  show(`${title}: season_decisions`, db.decisions.map(({ id, research_id, ...d }) => d));
}

(async () => {
  // A full paste, then a full re-paste of the same episode that changes its mind: one person's claim
  // dropped (their pending decision must be withdrawn), one person's confidence lowered (a full run
  // replaces it as it always has), one new claim.
  await scenario("full re-research of a covered episode", [
    [1, answer(CAST, { "Ada Lovelace": { leftTheGame: "yes", exitMethod: "Voted Out" }, "Grace Hopper": { foundAdvantage: "yes" } })],
    [
      1,
      answer(CAST, {
        "Ada Lovelace": { leftTheGame: "yes", exitMethod: "Voted Out", confidence: "low" },
        "Alan Turing": { wonIndividualImmunity: "yes" },
      }),
    ],
  ]);
  // The next episode: whoever left in episode 1 isn't asked about again.
  await scenario("next episode after a boot", [
    [1, answer(CAST, { "Ada Lovelace": { leftTheGame: "yes", exitMethod: "Voted Out" } })],
    [2, answer(CAST.slice(1), { "Grace Hopper": { satOutOfChallenge: "yes" } })],
  ]);
  // A re-paste that misses someone is still fatal and writes nothing.
  await scenario("re-paste missing a person", [
    [1, answer(CAST, { "Grace Hopper": { foundAdvantage: "yes" } })],
    [1, answer(CAST.slice(0, 3), {})],
  ]);
  process.stdout.write(out.join("\n") + "\n");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
