// Dev-only: records games ESPN called off, made up or moved, as a test fixture in tests/fixtures/espn/ (docs/PLAN-start-a-game-gpt.md
// track L, L3 part 3b): each day's scoreboard asked (only the games of the team named, trimmed to what readScoreboard reads: its
// teams, its state and status name, its stage, its note, its line) and each event's summary asked (its header's status, date, note
// and sides, and its pickcenter's line: what a postponed game's summary still says after the fact). Plain calls (no browser), one
// a day and one an event; no app server, no database.
//
//   node scripts/dev-test/record-espn-called-off.js --league=baseball/mlb --team=NYY --days=2026-05-23,2026-09-22
//        [--events=401815462,401817103] [--note="..."] [--out=tests/fixtures/espn/mlb-schedule-called-off-2026.json]
//
// The Yankees' 2026 (the first recording, 2026-11-06): TB at NYY on May 23 postponed (rain, its makeup Sept 22, a new event: Game
// 1 of a doubleheader), BAL at NYY moved from Sept 26 to Sept 25 (the same event, "Rescheduled from Sep. 26") and BAL at NYY on
// Sept 27 cancelled (never made up). ESPN's 2025 and 2026 MLB seasons list no suspended game (no STATUS_SUSPENDED in any month's
// scoreboard), so none is recorded. Its name holds "schedule", so the tests that read every recorded game skip it.
const fs = require("fs");
const path = require("path");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, ...v]) => [k, v.length ? v.join("=") : true]));
const { league, team } = args;
if (!league || !team || !args.days) {
  console.error("usage: --league=baseball/mlb --team=NYY --days=YYYY-MM-DD,... [--events=id,...] [--note=...] [--out=...]");
  process.exit(1);
}
const UA = { "User-Agent": "GameYourShow/1.0" };
const SITE = `https://site.api.espn.com/apis/site/v2/sports/${league}`;

async function get(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

const pick = (o, keys) => (o ? Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]])) : undefined);
const side = (t) => pick(t, ["id", "displayName", "shortDisplayName", "name", "location", "abbreviation"]);
const status = (s) => s && { type: pick(s.type, ["state", "completed", "name", "detail"]) };
const odds = (o) => (o ? { ...pick(o, ["details", "overUnder", "spread"]), provider: pick(o.provider, ["name"]) } : undefined);
const sides = (c) => (c.competitors ?? []).map((x) => ({ ...pick(x, ["homeAway", "score", "winner"]), team: side(x.team) }));

/** A scoreboard's event as readScoreboard reads it. */
function trim(e) {
  const c = e.competitions?.[0] ?? {};
  return {
    ...pick(e, ["id", "date", "name", "shortName"]),
    season: pick(e.season, ["year", "type", "slug"]),
    status: status(e.status),
    competitions: [{ ...pick(c, ["id", "date"]), status: status(c.status), notes: (c.notes ?? []).map((n) => pick(n, ["headline"])), competitors: sides(c), ...(c.odds?.[0] ? { odds: [odds(c.odds[0])] } : {}) }],
  };
}

/** A summary's header and line: what it says of a game called off after the fact. */
function summary(s) {
  const c = s.header?.competitions?.[0] ?? {};
  return {
    header: { id: s.header?.id, season: pick(s.header?.season, ["year", "type"]), competitions: [{ ...pick(c, ["id", "date"]), status: status(c.status), competitors: sides(c) }] },
    gameInfo: { venue: pick(s.gameInfo?.venue, ["fullName"]) },
    plays: (s.plays ?? []).length,
    pickcenter: (s.pickcenter ?? []).slice(0, 1).map(odds),
  };
}

(async () => {
  const days = String(args.days).split(",");
  const out = { _recorded: { league, team, at: new Date().toISOString(), from: "site.api.espn.com scoreboard?dates=YYYYMMDD and summary?event=", note: args.note ?? null, by: "scripts/dev-test/record-espn-called-off.js" }, days: {}, summaries: {} };
  const mine = (e) => (e.competitions?.[0]?.competitors ?? []).some((x) => x.team?.abbreviation === team || x.team?.id === team);
  for (const d of days) {
    const raw = await get(`${SITE}/scoreboard?dates=${d.replace(/-/g, "")}&limit=300`);
    out.days[d] = { events: (raw.events ?? []).filter(mine).map(trim) };
    console.log(`  ${d}: ${out.days[d].events.map((e) => `${e.id} ${e.shortName} ${e.status?.type?.name}`).join("; ") || "none of theirs"}`);
  }
  for (const id of args.events ? String(args.events).split(",") : []) {
    out.summaries[id] = summary(await get(`${SITE}/summary?event=${id}`));
    console.log(`  summary ${id}: ${out.summaries[id].header.competitions[0].status?.type?.name}, ${out.summaries[id].plays} plays`);
  }
  const file = args.out ?? path.join("tests", "fixtures", "espn", `${league.split("/").pop()}-schedule-called-off-${days[0].slice(0, 4)}.json`);
  // Each event on a line of its own (a diff stays readable).
  const dayText = days.map((d) => `${JSON.stringify(d)}: { "events": [\n${out.days[d].events.map((e) => JSON.stringify(e)).join(",\n")}\n] }`).join(",\n");
  const sumText = Object.entries(out.summaries).map(([id, s]) => `${JSON.stringify(id)}: ${JSON.stringify(s)}`).join(",\n");
  const text = `{\n"_recorded": ${JSON.stringify(out._recorded)},\n"days": {\n${dayText}\n},\n"summaries": {\n${sumText}\n}\n}\n`;
  JSON.parse(text);
  fs.writeFileSync(file, text);
  console.log(`${file}: ${days.length} days, ${Object.keys(out.summaries).length} summaries, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
