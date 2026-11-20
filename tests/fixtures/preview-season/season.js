// A made-up season as the preview builder takes it (tools/gameplay-bench/preview/definition.cjs): 18 castaways in two tribes, 13
// weekly episodes, the season page's shape (page.json), no real people. For tests/preview-definition.test.js and
// scripts/dev-test/preview-catalogue.js. `season({ mark, from, real, ... })` overrides any part.
const { page } = require("./page.json");

const WEEK = 7 * 24 * 3600 * 1000, EP1 = Date.parse("2030-02-12T01:00:00.000Z");
const cast = Array.from({ length: 18 }, (_, i) => ({ name: "Castaway " + (i + 1), photoUrl: null, tribe: i % 2 ? "Blue" : "Red" }));
const season = (o = {}) => ({
  label: "Test Island 1", format: "survivor", show: { name: "Test Island", slug: "test-island" }, seasonName: "Season 1", number: 1,
  cast, episodes: Array.from({ length: 13 }, (_, i) => ({ number: i + 1, airAt: new Date(EP1 + i * WEEK).toISOString() })),
  real: [], mark: 3, from: 4, page, ...o,
});

module.exports = { season, cast, page, WEEK, EP1 };
