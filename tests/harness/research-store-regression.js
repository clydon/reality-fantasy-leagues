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

// A chat's full answer for `names`, built off the real skeleton, with `edits` per person and, when given, the episode's
// own fields (`top`: the format section, merged).
function answer(names, edits, top = {}) {
  const ctx = { showName: "Survivor", showSlug: "survivor", season: 50, episodeNumber: 1, castNames: names, terms: termsFor({}).terms, format: survivor, domains: [] };
  const skel = R.pasteSkeleton(ctx, []);
  skel.summary = "An episode.";
  for (const c of skel.castaways) Object.assign(c, { confidence: "high", sources: ["https://example.com/recap"] }, edits[c.name] || {});
  Object.assign(skel, top);
  return JSON.stringify(skel);
}

// F3's cases: a season on two tribes of four, where staging moves people between tribes (from newGroup before F3, from the
// format section after it).
const TRIBES = { Reds: ["Ann Ash", "Bo Birch", "Cy Cole", "Di Dunn"], Blues: ["Ed Eno", "Flo Fox", "Gus Gray", "Hal Hart"] };
const TRIBAL = Object.values(TRIBES).flat();
function tribalWorld() {
  return fakeResearchDb({
    shows: [{ id: "show-1", slug: "survivor", name: "Survivor", format: "survivor" }],
    seasons: [{ id: "season-50", show_id: "show-1", season_number: 50 }],
    seasonCast: Object.entries(TRIBES).flatMap(([tribe, names]) => names.map((name) => ({ season_id: "season-50", name, tribe_name: tribe }))),
  });
}
const tribes = (groups, changes = []) => ({ formatState: { playedAs: "tribes", phase: null, groups: Object.entries(groups).map(([name, members]) => ({ name, members })), alone: [], newcomers: [], wentHomeAs: "individuals", changes } });
const voted = { leftTheGame: "yes", exitMethod: "Voted Out" };

const out = [];
const show = (title, value) => out.push(`## ${title}`, JSON.stringify(value, null, 1), "");

async function scenario(title, steps, makeWorld = world) {
  const { db, pool } = makeWorld();
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
  // F3: group moves. A swap at episode 2 (Di to the Blues, Ed to the Reds), answered the way an older prompt's answer has it
  // (newGroup, no format section): staged the same before and after.
  await scenario(
    "a swap answered with newGroup alone",
    [
      [1, answer(TRIBAL, { "Hal Hart": voted })],
      [2, answer(TRIBAL.slice(0, 7), { "Di Dunn": { newGroup: "Blues" }, "Ed Eno": { newGroup: "Reds" } })],
    ],
    tribalWorld
  );
  // The same swap with both (newGroup for the code before F3, the section for after): the same moves either way.
  const swapped = { Reds: ["Ann Ash", "Bo Birch", "Cy Cole", "Ed Eno"], Blues: ["Di Dunn", "Flo Fox", "Gus Gray"] };
  const swap = [{ kind: "swap", when: "start", from: 2, what: "Di and Ed swapped tribes", sure: "high" }];
  await scenario(
    "a swap answered with newGroup and the format section",
    [
      [1, answer(TRIBAL, { "Hal Hart": voted })],
      [2, answer(TRIBAL.slice(0, 7), { "Di Dunn": { newGroup: "Blues" }, "Ed Eno": { newGroup: "Reds" } }, tribes(swapped, swap))],
    ],
    tribalWorld
  );
  // The section alone, as research answers since F3 (newGroup isn't asked beside it): the code before F3 stages no move
  // (it read only newGroup); after, the moves come from the section.
  await scenario(
    "a swap answered with the format section alone",
    [
      [1, answer(TRIBAL, { "Hal Hart": voted })],
      [2, answer(TRIBAL.slice(0, 7), {}, tribes(swapped, swap))],
    ],
    tribalWorld
  );
  // Swapped and voted out the same night: Ed moves to the Reds and goes to their Tribal, voted out, so the section's groups at
  // the end don't have him (Di's move to the Blues is newGroup before F3, the section after). The Tribal check adds Ed's move
  // (a majority of who was there is on the Reds), before and after.
  const tribal = (votes) => ({ attendedTribal: "yes", votesReceived: votes, votedFor: "Ed Eno" });
  await scenario(
    "swapped and voted out the same night",
    [
      [1, answer(TRIBAL, {})],
      [
        2,
        answer(
          TRIBAL,
          { "Ann Ash": tribal(0), "Bo Birch": tribal(0), "Cy Cole": tribal(0), "Ed Eno": { ...voted, ...tribal(3), votedFor: "Ann Ash" }, "Di Dunn": { newGroup: "Blues" } },
          tribes({ Reds: ["Ann Ash", "Bo Birch", "Cy Cole"], Blues: ["Di Dunn", "Flo Fox", "Gus Gray", "Hal Hart"] }, [{ kind: "swap", when: "start", from: 2, what: "Di and Ed swapped", sure: "high" }])
        ),
      ],
    ],
    tribalWorld
  );
  // The merge: everyone onto one named tribe, and merged said.
  await scenario(
    "the merge",
    [
      [1, answer(TRIBAL, { "Hal Hart": voted })],
      [2, answer(TRIBAL.slice(0, 7), Object.fromEntries(TRIBAL.slice(0, 7).map((n) => [n, { newGroup: "Kalo" }])), { ...tribes({ Kalo: TRIBAL.slice(0, 7) }, [{ kind: "merge", when: "start", from: 2, what: "The tribes merged into Kalo", sure: "high" }]), merged: "yes" })],
    ],
    tribalWorld
  );
  process.stdout.write(out.join("\n") + "\n");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
