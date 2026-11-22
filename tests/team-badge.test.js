// A team's badge as a picture (docs/PLAN-team-logos.md L0; src/lib/sports/team-badge.ts): our own mark for a team defense's photo,
// never the league's logo. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { teamBadgeSrc, teamInk, LEAGUE_LOGO } = jiti("../src/lib/sports/team-badge.ts");

const svgOf = (src) => decodeURIComponent(src.replace(/^data:image\/svg\+xml,/, ""));

test("the badge: the abbreviation on the team's colour, in white or ink by contrast, as a small SVG", () => {
  const chiefs = teamBadgeSrc("KC", "e31837", "Kansas City Chiefs");
  assert.match(chiefs, /^data:image\/svg\+xml,/);
  assert.ok(chiefs.length < 1000, `a few hundred bytes (${chiefs.length})`);
  const svg = svgOf(chiefs);
  assert.match(svg, /fill="#e31837"/);
  assert.match(svg, />KC<\/text>/);
  assert.match(svg, new RegExp(`fill="${teamInk("e31837")}">KC`));
  // A pale colour takes ink, a dark one white (the same rule as TeamMark).
  assert.equal(teamInk("ffb612"), "#121018");
  assert.equal(teamInk("0b162a"), "#fff");
});

test("no abbreviation: the name's first letters; no colour: the stand-in plate; never more than four letters", () => {
  assert.match(svgOf(teamBadgeSrc(null, null, "ZT Rovers")), />ZR<\/text>/);
  assert.match(svgOf(teamBadgeSrc(null, null, "ZT Rovers")), /fill="#4a4558"/);
  assert.match(svgOf(teamBadgeSrc("ABCDEF", "123456")), />ABCD<\/text>/);
  assert.match(svgOf(teamBadgeSrc("", "bad", "")), />\?<\/text>/);
});

test("text is escaped", () => {
  assert.match(svgOf(teamBadgeSrc("<&>", "123456")), />&lt;&amp;&gt;<\/text>/);
});

test("ESPN's team logo addresses are recognised, plain or through its resizer; a headshot isn't one", () => {
  assert.ok(LEAGUE_LOGO.test("https://a.espncdn.com/i/teamlogos/nfl/500/kc.png"));
  assert.ok(LEAGUE_LOGO.test("https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/bos.png&w=80"));
  assert.ok(!LEAGUE_LOGO.test("https://a.espncdn.com/i/headshots/nfl/players/full/3139477.png"));
});
