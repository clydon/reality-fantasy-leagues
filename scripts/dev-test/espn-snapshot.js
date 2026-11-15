// Dev-only: a real league's season recorded once from ESPN's public API, for tests that need real-size, real-looking sports data
// (the design round's sports checks: hundreds of athletes with real names, positions, teams and headshots, a real schedule, real
// box scores) without asking ESPN again. The file is in exactly fake-espn.js's start({ teams, leagues, events, calendars }) input,
// so any check can serve the recorded season through the stand-in, and the bench can read the same athletes
// (tools/gameplay-bench/explorer/sports-roster.cjs).
//
//   node scripts/dev-test/espn-snapshot.js record [--league=football/nfl] [--weeks=1-10] [--no-box]
//       teams (each with its roster: id, name, position as ESPN displays it and its abbreviation, headshot URL, jersey), the
//       season's calendar as the bare scoreboard gives it, every regular-season game (when, home, away, state, score), and each
//       finished game's box score (ESPN's tables: passing, rushing, receiving... with their labels and every athlete's row).
//       Sequential, a short pause between calls, the app's own User-Agent (no URL in it: espn.ts). About 200 calls for the NFL.
//   node scripts/dev-test/espn-snapshot.js check [--file=<path>] [--as=football/zt-nfl]
//       serves the recording through fake-espn.js and reads it back with the app's own client (src/lib/server/sports/espn.ts):
//       its teams, a roster's people with headshots, the calendar, a week's games and a finished game's box score.
//
// Where it lands: .ui-atlas/fixtures/espn/<sport>-<league>-<YYYY-MM-DD>.json, which is ignored. Real athletes' names and
// ESPN's headshot URLs stay on this machine and out of the public repo; the headshots themselves are never downloaded (the app
// shows them from ESPN's resizer, as production does). Nothing here touches the database.
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const SITE = "https://site.api.espn.com";
const UA = { "User-Agent": "GameYourShow/1.0" };
const DIR = path.resolve(__dirname, "../../.ui-atlas/fixtures/espn");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0;

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    calls++;
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) }).catch((e) => ({ ok: false, status: 0, e }));
    if (r.ok) {
      await sleep(150);
      return r.json();
    }
    if (r.status === 404) return null;
    if (attempt >= 4) throw new Error(`ESPN answered ${r.status || r.e?.message} for ${url}`);
    await sleep(1500 * attempt);
  }
}

/** "1-10", "8", or "done" (every week whose games have all started): the weeks to record, or null for every week. */
function weeksWanted(spec) {
  if (!spec || spec === "all") return null;
  const m = /^(\d+)(?:-(\d+))?$/.exec(spec);
  if (!m) throw new Error("--weeks is a week or a range (1-10)");
  const a = Number(m[1]), b = Number(m[2] ?? m[1]);
  return new Set(Array.from({ length: b - a + 1 }, (_, i) => a + i));
}

async function record() {
  const league = opt("league", "football/nfl");
  const [sport, slug] = league.split("/");
  if (!sport || !slug) throw new Error("--league is sport/league, as ESPN names it (football/nfl)");
  const base = `${SITE}/apis/site/v2/sports/${sport}/${slug}`;

  // Teams, then each one's roster.
  const listed = await get(`${base}/teams?limit=1000`);
  const lg = listed?.sports?.[0]?.leagues?.[0];
  if (!lg) throw new Error(`ESPN lists no teams for ${league}`);
  const teams = [];
  for (const { team: t } of lg.teams) {
    if (t.isActive === false) continue;
    const raw = await get(`${base}/teams/${t.id}/roster`);
    const roster = [];
    for (const g of raw?.athletes ?? []) {
      for (const a of Array.isArray(g.items) ? g.items : [g]) {
        if (!a?.id || !a.displayName) continue;
        roster.push({
          id: String(a.id),
          name: a.displayName,
          position: a.position?.displayName ?? a.position?.name ?? null,
          abbr: a.position?.abbreviation ?? null,
          headshot: typeof a.headshot === "string" ? a.headshot : a.headshot?.href ?? null,
          jersey: a.jersey ?? null,
          group: Array.isArray(g.items) ? g.position ?? null : null,
          status: a.status?.type ?? a.status?.name ?? null,
        });
      }
    }
    teams.push({
      id: String(t.id), name: t.displayName, short: t.shortDisplayName, location: t.location, abbreviation: t.abbreviation, league,
      color: t.color ?? null, logo: t.logos?.[0]?.href ?? null, roster,
    });
    process.stdout.write(`\r[espn] rosters ${teams.length}/${lg.teams.length}`);
  }
  process.stdout.write("\n");

  // The season now, and its calendar (stages, and a football season's weeks), as the bare scoreboard says it.
  const bare = await get(`${base}/scoreboard`);
  const now = bare?.leagues?.[0];
  if (!now?.season) throw new Error(`ESPN's scoreboard for ${league} names no season`);
  const year = now.season.year;
  const stages = (now.calendar ?? []).filter((c) => c && typeof c === "object" && c.value != null);
  const calendar = {
    season: year,
    label: now.season.displayName ?? String(year),
    now: new Date().toISOString(),
    stages: stages.map((c) => ({ type: Number(c.value), name: c.label, from: c.startDate, to: c.endDate })),
    ...(stages.some((c) => c.entries?.length)
      ? { weeks: stages.flatMap((c) => (c.entries ?? []).map((e) => ({ type: Number(c.value), label: e.label, detail: e.detail ?? null, value: Number(e.value), from: e.startDate, to: e.endDate }))) }
      : {}),
  };

  // Every regular-season week's games (football: by week; other leagues would want days, not built here).
  const regular = (calendar.weeks ?? []).filter((w) => w.type === 2);
  if (!regular.length) throw new Error(`${league}'s calendar has no regular-season weeks: this recorder knows football's weeks only`);
  const want = weeksWanted(opt("weeks"));
  const events = [];
  for (const w of regular) {
    if (want && !want.has(w.value)) continue;
    const sb = await get(`${base}/scoreboard?seasontype=2&week=${w.value}&dates=${year}&limit=100`);
    for (const e of sb?.events ?? []) {
      const c = e.competitions?.[0];
      const side = (h) => c?.competitors?.find((x) => x.homeAway === h);
      const home = side("home"), away = side("away");
      if (!home?.team?.id || !away?.team?.id) continue;
      const state = c?.status?.type?.state ?? e.status?.type?.state ?? "pre";
      const num = (x) => (x?.score == null || x.score === "" ? null : Number(typeof x.score === "object" ? x.score.value ?? x.score.displayValue : x.score));
      events.push({
        league, id: String(e.id), at: e.date, home: String(home.team.id), away: String(away.team.id), state,
        ...(state !== "pre" ? { score: [num(home), num(away)] } : {}),
        stage: "regular", season: year, week: w.value, name: e.shortName ?? e.name ?? null,
        ...(c?.status?.type?.name === "STATUS_POSTPONED" || c?.status?.type?.name === "STATUS_CANCELED" ? { off: true } : {}),
      });
    }
    process.stdout.write(`\r[espn] week ${w.value}: ${events.length} games so far`);
  }
  process.stdout.write("\n");

  // Each finished game's box score: ESPN's tables, each athlete's row, in fake-espn's `box` (tables by team).
  if (!has("no-box")) {
    const done = events.filter((e) => e.state === "post");
    let n = 0;
    for (const e of done) {
      const s = await get(`${base}/summary?event=${e.id}`);
      const box = {};
      for (const side of s?.boxscore?.players ?? []) {
        const team = String(side.team?.id ?? "");
        if (!team) continue;
        box[team] = {
          tables: (side.statistics ?? []).map((t) => ({
            name: t.name,
            labels: t.labels ?? [],
            rows: (t.athletes ?? []).filter((a) => a.athlete?.id).map((a) => ({
              id: String(a.athlete.id), name: a.athlete.displayName, position: a.athlete.position?.displayName ?? null, stats: (a.stats ?? []).map(String),
            })),
          })),
        };
      }
      if (Object.keys(box).length) e.box = box;
      process.stdout.write(`\r[espn] box scores ${++n}/${done.length}`);
    }
    process.stdout.write("\n");
  }

  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(DIR, `${sport}-${slug}-${day}.json`);
  fs.mkdirSync(DIR, { recursive: true });
  const snapshot = {
    schemaVersion: 1,
    recordedAt: new Date().toISOString(),
    source: "ESPN's public site API, recorded once for local tests (scripts/dev-test/espn-snapshot.js); stays out of git",
    league,
    leagues: [{ league, name: lg.name, short: lg.abbreviation ?? lg.shortName ?? null }],
    teams,
    events,
    calendars: { [league]: calendar },
  };
  fs.writeFileSync(file, JSON.stringify(snapshot));
  const people = teams.reduce((n, t) => n + t.roster.length, 0);
  const shots = teams.reduce((n, t) => n + t.roster.filter((p) => p.headshot).length, 0);
  console.log(`[espn] ${league} ${calendar.label}: ${teams.length} teams, ${people} people (${shots} with headshots), ${events.length} games (${events.filter((e) => e.box).length} box scores) in ${calls} calls`);
  console.log(`[espn] wrote ${path.relative(process.cwd(), file)} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
  return file;
}

/** The newest recording for a league (or the file asked for). */
function latest(league = "football/nfl", file) {
  if (file) return path.resolve(file);
  const prefix = league.replace("/", "-") + "-";
  const found = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.startsWith(prefix) && f.endsWith(".json")).sort() : [];
  if (!found.length) throw new Error(`no recording for ${league} in ${DIR}: run espn-snapshot.js record first`);
  return path.join(DIR, found[found.length - 1]);
}

/** The recording as fake-espn's start() input, its league renamed when asked (`as`: a zt league, so the app's league show for it
 *  can't be mistaken for a real one). */
function forFake(snapshot, { as } = {}) {
  const from = snapshot.league, to = as || from;
  const re = (x) => ({ ...x, league: x.league === from ? to : x.league });
  return {
    teams: snapshot.teams.map(re),
    leagues: snapshot.leagues.map((l) => (l.league === from ? { ...l, league: to, name: as ? `ZT ${l.name}` : l.name } : l)),
    events: snapshot.events.map(re),
    calendars: { [to]: snapshot.calendars[from] },
  };
}

async function check() {
  const league = opt("league", "football/nfl");
  const file = latest(league, opt("file"));
  const snap = JSON.parse(fs.readFileSync(file, "utf8"));
  const as = opt("as", league.replace("/", "/zt-"));
  const fake = await require("./fake-espn").start(forFake(snap, { as }));
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
  const { espn } = jiti("../../src/lib/server/sports/espn.ts");
  const provider = espn(fake.url);
  const fail = [];
  const expect = (ok, what) => { console.log(`${ok ? "PASS" : "FAIL"} ${what}`); if (!ok) fail.push(what); };
  try {
    const listed = await provider.teams(as);
    expect(listed?.teams?.length === snap.teams.length, `the teams read back: ${listed?.teams?.length} of ${snap.teams.length} (${listed?.name?.name ?? listed?.name ?? "no name"})`);
    const t = snap.teams.find((x) => x.roster.length) ?? snap.teams[0];
    const roster = await provider.roster(as, t.id);
    const shot = roster.filter((p) => p.headshot && /espncdn\.com\/combiner/.test(p.headshot)).length;
    expect(roster.length === t.roster.length && shot > 0, `${t.name}'s roster: ${roster.length} people, ${shot} with a sized headshot, first ${roster[0]?.name} (${roster[0]?.position})`);
    const cal = await provider.calendar(as);
    expect(!!cal && (cal.weeks?.length ?? 0) > 0, `the calendar: ${cal?.label ?? "none"}, ${cal?.weeks?.length ?? 0} weeks`);
    const game = snap.events.find((e) => e.box) ?? snap.events[0];
    const day = new Date(new Date(game.at).toLocaleString("en-US", { timeZone: "America/New_York" }));
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const on = await provider.eventsOn(as, iso);
    expect(on.some((e) => e.id === game.id), `${game.name} is on ${iso}'s scoreboard (${on.length} games that day)`);
    if (game.box) {
      const box = await provider.boxScore(as, game.id);
      const rows = (box?.teams ?? box ?? []).flatMap?.((x) => (x.tables ?? [x]).flatMap((tb) => tb.rows ?? [])) ?? [];
      expect(rows.length > 0, `${game.name}'s box score: ${rows.length} rows read`);
    }
    const names = snap.teams.flatMap((x) => x.roster.map((p) => p.name));
    const dupes = names.length - new Set(names).size;
    console.log(`[espn] ${names.length} people, ${dupes} sharing a name with someone else (the bench's reader tells them apart)`);
  } finally {
    await fake.close();
  }
  console.log(fail.length ? `${fail.length} FAILED` : "ALL PASS");
  process.exitCode = fail.length ? 1 : 0;
}

module.exports = { latest, forFake, DIR };

if (require.main === module) {
  const cmd = args[0];
  (cmd === "record" ? record() : cmd === "check" ? check() : Promise.reject(new Error("usage: record | check (see the header)"))).catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  });
}
