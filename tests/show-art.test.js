// Show and season art and cast photos, the pure half (docs/RESEARCH-show-art-and-cast-photos.md; src/lib/game/show-art.ts):
// which of TMDB's images a show gets, who in a season's credits is cast, whose photo is whose by name, and which stored
// photos the finder may replace. Made-up answers, so no network or database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const A = jiti("../src/lib/game/show-art.ts");

test("art: an English poster, a wordless backdrop first, an English logo, best voted", () => {
  const picked = A.pickArt({
    posters: [
      { file_path: "/de.jpg", iso_639_1: "de", vote_average: 9 },
      { file_path: "/en-low.jpg", iso_639_1: "en", vote_average: 4 },
      { file_path: "/en-high.jpg", iso_639_1: "en", vote_average: 6 },
    ],
    backdrops: [
      { file_path: "/words.jpg", iso_639_1: "en", vote_average: 9 },
      { file_path: "/clean.jpg", iso_639_1: null, vote_average: 5 },
    ],
    logos: [{ file_path: "/logo.png", iso_639_1: "en", vote_average: 5 }],
  });
  assert.equal(picked.poster, "https://image.tmdb.org/t/p/w500/en-high.jpg");
  assert.equal(picked.backdrop, "https://image.tmdb.org/t/p/w1280/clean.jpg");
  assert.equal(picked.logo, "https://image.tmdb.org/t/p/w500/logo.png");
  assert.deepEqual(A.pickArt(null), { poster: null, backdrop: null, logo: null });
  // Only a foreign poster: still better than none.
  assert.equal(A.pickArt({ posters: [{ file_path: "/fr.jpg", iso_639_1: "fr" }] }).poster, "https://image.tmdb.org/t/p/w500/fr.jpg");
});

test("choices: English and wordless only, each kind with a small copy", () => {
  const c = A.artCandidates({ posters: [{ file_path: "/a.jpg", iso_639_1: "en" }, { file_path: "/b.jpg", iso_639_1: "es" }], backdrops: [{ file_path: "/c.jpg", iso_639_1: null }] });
  assert.deepEqual(
    c.map((x) => [x.kind, x.url, x.thumb, x.lang]),
    [
      ["poster", "https://image.tmdb.org/t/p/w500/a.jpg", "https://image.tmdb.org/t/p/w185/a.jpg", "en"],
      ["backdrop", "https://image.tmdb.org/t/p/w1280/c.jpg", "https://image.tmdb.org/t/p/w300/c.jpg", null],
    ]
  );
});

test("credits: hosts, judges and guests are left out; characters count as names, roles don't", () => {
  const credits = A.tmdbCredits([
    { name: "Pat Host", profile_path: "/host.jpg", roles: [{ character: "Self - Host" }] },
    { name: "Ana Player", profile_path: "/ana.jpg", roles: [{ character: "Self - Contestant" }] },
    { name: "Guest Star", profile_path: "/g.jpg", roles: [{ character: "Self - Guest" }] },
    { name: "Bryan Actor", profile_path: null, roles: [{ character: "Walter White" }] },
  ]);
  assert.deepEqual(credits, [
    { names: ["Ana Player"], photo: "https://image.tmdb.org/t/p/w185/ana.jpg" },
    { names: ["Bryan Actor", "Walter White"], photo: null },
  ]);
  const tv = A.tvmazeCredits([
    { person: { name: "Ana Player", image: { medium: "https://static.tvmaze.com/a.jpg" } }, character: { name: "Self" } },
    { person: { name: "Pat Host" }, character: { name: "Self - Host" } },
  ]);
  assert.deepEqual(tv, [{ names: ["Ana Player"], photo: "https://static.tvmaze.com/a.jpg" }]);
});

test("credits carry no order or episode counts (they'd tell who went home)", () => {
  const credits = A.tmdbCredits([{ name: "Ana Player", profile_path: "/a.jpg", total_episode_count: 1, roles: [{ character: "Self - Contestant", episode_count: 1 }] }]);
  assert.deepEqual(Object.keys(credits[0]).sort(), ["names", "photo"]);
});

test("names: the same name any way it's written, a short name, a nickname, first and last", () => {
  const credits = [
    { names: ["Thien An Nguyen"], id: 1 },
    { names: ["Jelly Loblack"], id: 2 },
    { names: ["Kristin Flickinger"], id: 3 },
    { names: ["José Núñez"], id: 4 },
    { names: ["Sam Smith"], id: 5 },
    { names: ["Sam Jones"], id: 6 },
  ];
  const who = (n) => A.matchCredit(n, credits)?.id ?? null;
  assert.equal(who("Thien An"), 1);
  assert.equal(who('Angelina "Jelly" Loblack'), 2);
  assert.equal(who("Kristin A. Flickinger"), 3);
  assert.equal(who("Jose Nunez"), 4);
  assert.equal(who("Sam"), null, "two Sams: not clear, so no photo");
  assert.equal(who("Mike Pinsky"), null);
});

test("photos: only none, a wiki icon or a TVmaze one is replaced; one someone chose never is", () => {
  assert.equal(A.replaceablePhoto(null), true);
  assert.equal(A.replaceablePhoto(""), true);
  assert.equal(A.replaceablePhoto("https://static.wikia.nocookie.net/survivor/images/5/57/S51_x_t.png"), true);
  assert.equal(A.replaceablePhoto("https://static.tvmaze.com/uploads/images/medium_portrait/1/2.jpg"), true);
  assert.equal(A.replaceablePhoto("photos/s51/ana.jpg"), false);
  assert.equal(A.replaceablePhoto("https://image.tmdb.org/t/p/w185/a.jpg"), false);
  assert.equal(A.replaceablePhoto("https://example.com/me.png"), false);
  assert.equal(A.fromTmdb("https://image.tmdb.org/t/p/w185/a.jpg"), true);
});

test("sports: Formula 1 by name, Wikipedia titles from links, a search hit is the person", () => {
  assert.equal(A.isFormulaOne("Formula 1"), true);
  assert.equal(A.isFormulaOne("Formula One World Championship"), true);
  assert.equal(A.isFormulaOne("F1 Academy"), true);
  assert.equal(A.isFormulaOne("NFL"), false);
  assert.equal(A.wikiTitle("https://en.wikipedia.org/wiki/George_Russell_(racing_driver)"), "George Russell (racing driver)");
  assert.equal(A.wikiTitle("not a link"), null);
  assert.equal(A.wikiHitIs("George Russell", "George Russell (racing driver)"), true);
  assert.equal(A.wikiHitIs("George Russell", "Russell Crowe"), false);
});
