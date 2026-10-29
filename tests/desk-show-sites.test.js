// A show's research sites on the desk (docs/PLAN-desk-parity.md part 7a; src/lib/desk-show-sites.ts): a pasted page kept as
// its hostname, anything else refused, and our usual as research's domainsFor gives it (check-desk-shows.js proves that one
// against research's own context too). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { siteOf, usualSites } = jiti("../src/lib/desk-show-sites.ts");

test("a site is kept as its hostname", () => {
  assert.equal(siteOf("https://www.RealityTea.com/category/survivor/"), "realitytea.com");
  assert.equal(siteOf("insidesurvivor.com"), "insidesurvivor.com");
  assert.equal(siteOf("  www.goldderby.com/tv/  "), "goldderby.com");
  assert.equal(siteOf("http://ew.com:8080/x?y=1#z"), "ew.com");
  assert.equal(siteOf("survivor.fandom.com."), "survivor.fandom.com");
});

test("anything that isn't a site is refused", () => {
  for (const x of ["", "  ", "not a site", "localhost", "https://", "1.2.3.4", "survivor", null, undefined, "a".repeat(400) + ".com"]) assert.equal(siteOf(x), null, String(x));
});

test("our usual: its wiki's host first, then tvline.com and parade.com", () => {
  assert.deepEqual(usualSites("https://survivor.fandom.com/api.php"), ["survivor.fandom.com", "tvline.com", "parade.com"]);
  assert.deepEqual(usualSites("https://www.example-wiki.org/w/api.php"), ["example-wiki.org", "tvline.com", "parade.com"]);
  assert.deepEqual(usualSites(null), ["tvline.com", "parade.com"]);
  assert.deepEqual(usualSites("not a url"), ["tvline.com", "parade.com"]);
});
