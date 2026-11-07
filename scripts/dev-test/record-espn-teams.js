// Dev-only: records a league's ESPN team list as a test fixture (tests/fixtures/espn/; docs/PLAN-start-a-game-gpt.md track L, L7:
// finding a game by team), trimmed to what the reader reads (src/lib/server/sports/espn.ts readTeams): the league's names, and
// each team's id, names (display, short, nickname, name, location), abbreviation, colour, first logo and whether it's active. A raw
// list is 25 KB to 1.8 MB (college football's 762 teams, each with its links); a trimmed one 3 to 150 KB. One real call; no app
// server, no database. Teams come and go between seasons, so the file says when it was recorded.
//
//   node scripts/dev-test/record-espn-teams.js --league=football/nfl [--out=tests/fixtures/espn/nfl-teams.json] [--note=...]
const fs = require("fs");
const path = require("path");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, ...v]) => [k, v.length ? v.join("=") : true]));
const { league } = args;
if (!league) {
  console.error("Usage: node scripts/dev-test/record-espn-teams.js --league=football/nfl [--out=] [--note=]");
  process.exit(2);
}
const short = league.split("/")[1];
const out = args.out || path.join(__dirname, "..", "..", "tests", "fixtures", "espn", `${short}-teams.json`);

const TEAM = { id: true, displayName: true, shortDisplayName: true, name: true, nickname: true, location: true, abbreviation: true, color: true, isActive: true };

function trim(value, shape) {
  if (shape === true || value == null) return value;
  if (typeof value !== "object") return undefined;
  const o = {};
  for (const [k, s] of Object.entries(shape)) {
    const v = trim(value[k], s);
    if (v !== undefined) o[k] = v;
  }
  return o;
}

(async () => {
  // ESPN's default page is 50 teams at most (college has hundreds).
  const url = `https://site.api.espn.com/apis/site/v2/sports/${league}/teams?limit=1000`;
  const res = await fetch(url, { headers: { "User-Agent": "GameYourShow/1.0" } });
  if (!res.ok) throw new Error(`ESPN answered ${res.status}`);
  const raw = await res.json();
  const l = raw.sports?.[0]?.leagues?.[0] ?? {};
  const recorded = { league, from: url.replace("https://", ""), at: new Date().toISOString().slice(0, 10), ...(args.note ? { note: args.note } : {}), by: "scripts/dev-test/record-espn-teams.js" };
  const named = JSON.stringify(trim(l, { name: true, abbreviation: true, shortName: true, slug: true })).slice(1, -1);
  const teams = (l.teams ?? []).map((t) => {
    const team = trim(t.team, TEAM);
    const logo = t.team?.logos?.[0]?.href;
    return { team: { ...team, ...(logo ? { logos: [{ href: logo }] } : {}) } };
  });
  // ESPN's own shape (the reader takes it as it is), each team on a line of its own: small diffs when it's recorded again.
  const body = `{\n "_recorded": ${JSON.stringify(recorded)},\n "sports": [{"leagues": [{${named}${named ? "," : ""} "teams": [\n${teams.map((t) => `  ${JSON.stringify(t)}`).join(",\n")}\n ]}]}]\n}\n`;
  JSON.parse(body);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, body);
  console.log(`${path.relative(process.cwd(), out)}: ${teams.length} teams, ${(body.length / 1024).toFixed(0)} KB (from ${(JSON.stringify(raw).length / 1024).toFixed(0)} KB)`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
