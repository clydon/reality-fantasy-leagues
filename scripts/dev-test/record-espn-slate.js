// Dev-only: records a league's slate as ESPN answers it (docs/PLAN-start-a-game-gpt.md track L, L8), as a test fixture in
// tests/fixtures/espn/: its bare scoreboard's season and calendar (days, or football's weeks), its season's stages (the core's
// types, each with its bounds) and its games month by month (the scoreboard's `dates=YYYYMM`), each event trimmed to what
// readScoreboard reads (its teams' names, its state, its stage, its note and line). Plain calls (no browser), a few, each once;
// no app server, no database.
//
//   node scripts/dev-test/record-espn-slate.js --league=football/nfl [--stage=2] [--months=2026-09,2026-10] [--note="..."]
//        [--out=tests/fixtures/espn/nfl-schedule-league-2026.json]
//
// Without --months it records every month of the stage (--stage: ESPN's number, 2 the regular season, unless said; a soccer
// league's season is its own). Its name holds "schedule", so the tests that read every recorded game skip it.
const fs = require("fs");
const path = require("path");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, ...v]) => [k, v.length ? v.join("=") : true]));
const league = args.league;
if (!league) {
  console.error("usage: --league=football/nfl [--stage=2] [--months=YYYY-MM,...] [--note=...] [--out=...]");
  process.exit(1);
}
const UA = { "User-Agent": "GameYourShow/1.0" };
const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const CORE = "https://sports.core.api.espn.com";

async function get(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

const pick = (o, keys) => (o ? Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]])) : undefined);
const team = (t) => pick(t, ["id", "displayName", "shortDisplayName", "name", "location", "abbreviation"]);
const status = (s) => s && { type: pick(s.type, ["state", "completed", "name", "detail"]) };
function trim(e) {
  const c = e.competitions?.[0] ?? {};
  return {
    ...pick(e, ["id", "date", "name", "shortName"]),
    season: pick(e.season, ["year", "type", "slug"]),
    ...(e.week ? { week: pick(e.week, ["number"]) } : {}),
    status: status(e.status),
    competitions: [
      {
        ...pick(c, ["id", "date"]),
        status: status(c.status),
        notes: (c.notes ?? []).map((n) => pick(n, ["headline"])),
        competitors: (c.competitors ?? []).map((x) => ({ ...pick(x, ["homeAway", "score", "winner"]), team: team(x.team) })),
        ...(c.odds?.[0] ? { odds: [{ ...pick(c.odds[0], ["details", "overUnder", "spread"]), provider: pick(c.odds[0].provider, ["name"]) }] } : {}),
      },
    ],
  };
}

function monthsOf(from, to) {
  const out = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); ) {
    out.push(m);
    const [y, mo] = m.split("-").map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  return out;
}

(async () => {
  const board = await get(`${SITE}/${league}/scoreboard`);
  const l = board.leagues?.[0] ?? {};
  const year = l.season?.year;
  const refs = await get(`${CORE}/v2/sports/${league.replace("/", "/leagues/")}/seasons/${year}/types?limit=20`);
  const types = [];
  for (const r of refs.items ?? []) {
    const t = await get(r.$ref.replace(/^http:/, "https:"));
    types.push(pick(t, ["type", "name", "startDate", "endDate"]));
  }
  const stage = Number(args.stage ?? (types.length === 1 ? types[0].type : 2));
  const s = types.find((t) => t.type === stage);
  // ESPN's bounds are the Pacific's midnights; a month list from the bounds' dates is wide enough.
  const months = args.months ? String(args.months).split(",") : monthsOf(s.startDate.slice(0, 10), s.endDate.slice(0, 10));
  const byMonth = {};
  let n = 0;
  for (const m of months) {
    const raw = await get(`${SITE}/${league}/scoreboard?dates=${m.replace("-", "")}&limit=1000`);
    byMonth[m] = { events: (raw.events ?? []).map(trim) };
    n += byMonth[m].events.length;
    console.log(`  ${m}: ${byMonth[m].events.length} events`);
  }
  const out = {
    _recorded: { league, at: new Date().toISOString(), from: "site.api.espn.com scoreboard (bare, and dates=YYYYMM), sports.core.api.espn.com season types", stage, note: args.note ?? null },
    scoreboard: { leagues: [pick(l, ["name", "abbreviation", "slug", "season", "calendarType", "calendar"])] },
    types,
    months: byMonth,
  };
  const file = args.out ?? path.join("tests", "fixtures", "espn", `${league.split("/").pop()}-schedule-league-${year}.json`);
  // Each event on a line of its own (a diff stays readable).
  const monthsText = months.map((m) => `${JSON.stringify(m)}: { "events": [\n${byMonth[m].events.map((e) => JSON.stringify(e)).join(",\n")}\n] }`).join(",\n");
  const text = `{\n"_recorded": ${JSON.stringify(out._recorded)},\n"scoreboard": ${JSON.stringify(out.scoreboard)},\n"types": ${JSON.stringify(types)},\n"months": {\n${monthsText}\n}\n}\n`;
  JSON.parse(text);
  fs.writeFileSync(file, text);
  console.log(`${file}: ${n} events over ${months.length} months, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
