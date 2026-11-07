// Dev-only: records a team's ESPN schedule as a test fixture (tests/fixtures/espn/; docs/PLAN-start-a-game-gpt.md track L, L1 part
// 3: a matchup's games straight from it), trimmed to what the readers read (src/lib/server/sports/espn.ts readScoreboard, which
// reads a schedule's events as a scoreboard's): each game's id, start, name, season and stage, status, note and sides (team,
// home or away, score, winner). A raw schedule is ~0.8 MB (logos, venues, broadcasts, tickets); a trimmed one ~50 KB. One real
// call; no app server, no database. A schedule changes (games still to play move), so the file says when it was recorded.
//
//   node scripts/dev-test/record-espn-schedule.js --league=basketball/nba --team=20 [--season=2027] [--seasontype=2]
//        [--out=tests/fixtures/espn/nba-schedule-20.json] [--note="the 76ers' 2026-27"]
const fs = require("fs");
const path = require("path");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, ...v]) => [k, v.length ? v.join("=") : true]));
const { league, team } = args;
if (!league || !team) {
  console.error("Usage: node scripts/dev-test/record-espn-schedule.js --league=basketball/nba --team=<ESPN team id> [--season=] [--seasontype=] [--out=] [--note=]");
  process.exit(2);
}
const short = league.split("/")[1];
const out = args.out || path.join(__dirname, "..", "..", "tests", "fixtures", "espn", `${short}-schedule-${team}${args.season ? `-${args.season}` : ""}${args.seasontype ? `-${args.seasontype}` : ""}.json`);

const TEAM = { id: true, displayName: true, shortDisplayName: true, abbreviation: true, location: true, name: true, nickname: true };
const EVENT = {
  id: true,
  date: true,
  name: true,
  shortName: true,
  season: { year: true, displayName: true },
  seasonType: { type: true, abbreviation: true },
  competitions: [{ id: true, date: true, status: { type: { state: true, completed: true, detail: true } }, notes: [{ headline: true }], competitors: [{ homeAway: true, winner: true, score: { value: true, displayValue: true }, team: TEAM }] }],
};

function trim(value, shape) {
  if (shape === true || value == null) return value;
  if (Array.isArray(shape)) return Array.isArray(value) ? value.map((v) => trim(v, shape[0])) : undefined;
  if (typeof value !== "object") return undefined;
  const o = {};
  for (const [k, s] of Object.entries(shape)) {
    const v = trim(value[k], s);
    if (v !== undefined) o[k] = v;
  }
  return o;
}

(async () => {
  const q = [args.season ? `season=${args.season}` : "", args.seasontype ? `seasontype=${args.seasontype}` : ""].filter(Boolean).join("&");
  const url = `https://site.api.espn.com/apis/site/v2/sports/${league}/teams/${team}/schedule${q ? `?${q}` : ""}`;
  const res = await fetch(url, { headers: { "User-Agent": "GameYourShow/1.0" } });
  if (!res.ok) throw new Error(`ESPN answered ${res.status}`);
  const raw = await res.json();
  const head = { _recorded: { league, team, from: url.replace("https://", ""), at: new Date().toISOString().slice(0, 10), ...(args.note ? { note: args.note } : {}), by: "scripts/dev-test/record-espn-schedule.js" }, team: trim(raw.team, { id: true, displayName: true }) };
  const events = (raw.events ?? []).map((e) => trim(e, EVENT));
  // Each game on a line of its own: small diffs when it's recorded again.
  const body = `{\n${Object.entries(head).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n")},\n "events": [\n${events.map((e) => `  ${JSON.stringify(e)}`).join(",\n")}\n ]\n}\n`;
  JSON.parse(body);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, body);
  console.log(`${path.relative(process.cwd(), out)}: ${events.length} games, ${(body.length / 1024).toFixed(0)} KB (from ${(JSON.stringify(raw).length / 1024).toFixed(0)} KB)`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
