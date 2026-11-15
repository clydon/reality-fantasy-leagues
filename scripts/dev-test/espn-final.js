// Dev-only: one real game's final from ESPN, read by the app's own reader (src/lib/sports/final.ts storedGame: what
// finals.ts saves on sports_events.lines for every linked game once it's over), for the bench's real-game situations
// (tools/gameplay-bench/explorer/situations.cjs, "A real game"): everyone's counts in the sport's keys, as a real league would
// score them. One call to ESPN's public summary, with the app's own User-Agent.
//
//   node scripts/dev-test/espn-final.js --teams=NE,DET [--week=10] [--league=football/nfl]   the game those teams play that week
//   node scripts/dev-test/espn-final.js --event=401872xxx [--league=football/nfl]
//       (the week and teams are looked up in the newest recording: scripts/dev-test/espn-snapshot.js)
//
// Where it lands: .ui-atlas/fixtures/espn/final-<sport>-<league>-<event>.json (ignored: real athletes stay off the public repo).
// A game still being played is written too, marked final: false (the situations refuse it until it's over: run again then).
// Nothing here touches the database.
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const root = path.resolve(__dirname, "../..");
const DIR = path.join(root, ".ui-atlas/fixtures/espn");
const league = opt("league", "football/nfl");

function eventOf() {
  if (opt("event")) return { id: opt("event"), name: null };
  const teams = (opt("teams", "") || "").split(",").filter(Boolean);
  if (teams.length !== 2) throw new Error("--teams=NE,DET (two abbreviations) or --event=<id>");
  const Roster = require(path.join(root, "tools/gameplay-bench/explorer/sports-roster.cjs"));
  const snap = Roster.load(league);
  const abbr = Object.fromEntries(snap.teams.map((t) => [t.id, t.abbreviation]));
  const week = opt("week") ? Number(opt("week")) : null;
  const e = snap.events.find((x) => (week == null || x.week === week) && teams.every((t) => [abbr[x.home], abbr[x.away]].includes(t)));
  if (!e) throw new Error(`no ${teams.join(" and ")} game${week ? " in week " + week : ""} in the recording`);
  return { id: e.id, name: e.name, week: e.week };
}

async function main() {
  const ev = eventOf();
  const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league}/summary?event=${encodeURIComponent(ev.id)}`, {
    headers: { "User-Agent": "GameYourShow/1.0" },
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error(`ESPN answered ${r.status}`);
  const raw = await r.json();
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(root, "src") } });
  const { sportOf } = jiti(path.join(root, "src/lib/sports/index.ts"));
  const { storedGame } = jiti(path.join(root, "src/lib/sports/final.ts"));
  const sport = sportOf(league);
  const g = storedGame(sport, raw);
  if (!g) throw new Error("the app's reader found no game in ESPN's answer");
  const comp = raw.header?.competitions?.[0];
  const out = {
    schemaVersion: 1,
    recordedAt: new Date().toISOString(),
    source: "ESPN's public summary, read by src/lib/sports/final.ts storedGame (scripts/dev-test/espn-final.js); stays out of git",
    league,
    event: ev.id,
    week: ev.week ?? null,
    name: ev.name,
    when: comp?.date ?? null,
    status: comp?.status?.type?.detail ?? null,
    final: !!g.final,
    score: (comp?.competitors ?? []).map((c) => ({ team: c.team?.id, abbr: c.team?.abbreviation, name: c.team?.displayName, score: c.score ?? null, home: c.homeAway === "home" })),
    stored: g,
  };
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, `final-${league.replace("/", "-")}-${ev.id}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(`${file}\n${out.status}: ${out.score.map((s) => s.abbr + " " + s.score).join(", ")}; final ${out.final}; ${Object.keys(g.lines || {}).length} lines`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
