// Dev-only: records a finished game's ESPN summary as a test fixture (tests/fixtures/espn/; docs/PLAN-start-a-game-gpt.md track L,
// step L1), trimmed to what the sports' readers read (src/lib/sports/): the header (teams, score, status, a hockey game's
// goalies of record), the box score's tables and team totals, ESPN's line before the game, and the plays with their times,
// periods, people and the fields each sport's reader uses (PLAYS, by ESPN's sport slug; football's sit in its drives; soccer's
// are its commentary and key events, its lines its match sheets, `rosters`). A raw summary is ~0.3-1 MB (pitch
// coordinates, win probability, news, videos); a trimmed one 60-230 KB. One real call (or none, from the cache
// check-sport-reduce.js keeps); no app server, no database.
//
//   node scripts/dev-test/record-espn.js --league=baseball/mlb --event=401907924 [--out=tests/fixtures/espn/mlb-401907924.json]
//        [--note="the 2026 Wild Card, Game 1"] [--cache=<dir>]
//
// It refuses a game that isn't final (a fixture is a whole game). Re-run it to re-record; the file says when and from where.
// When a sport's reader starts reading a new field, add it to KEEP below and record again.
const fs = require("fs");
const os = require("os");
const path = require("path");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, ...v]) => [k, v.length ? v.join("=") : true]));
const league = args.league;
const event = args.event;
if (!league || !event) {
  console.error("Usage: node scripts/dev-test/record-espn.js --league=baseball/mlb --event=<ESPN event id> [--out=...] [--note=...]");
  process.exit(2);
}
const short = league.split("/")[1];
const out = args.out || path.join(__dirname, "..", "..", "tests", "fixtures", "espn", `${short}-${event}.json`);
const cacheDir = args.cache || path.join(os.tmpdir(), "rfl-espn-cache");

// What's kept, as a shape: an object lists its keys (true keeps the value whole), an array's shape is its items'.
const TEAM = { id: true, displayName: true, abbreviation: true };
const KEEP = {
  header: {
    id: true,
    season: { year: true, type: true },
    competitions: [
      {
        // The period it ended in and its detail ("Final/SO"), and a hockey game's goalies of record.
        status: { period: true, type: { state: true, completed: true, detail: true }, featuredAthletes: [{ name: true, athlete: { id: true }, team: { id: true } }] },
        // A soccer match's shootout is its own score.
        competitors: [{ homeAway: true, winner: true, score: true, shootoutScore: true, team: TEAM }],
      },
    ],
  },
  boxscore: {
    // Baseball's team totals come in groups; basketball's and hockey's as one list, some only as text ("39-87").
    teams: [{ team: TEAM, statistics: [{ name: true, value: true, displayValue: true, stats: [{ name: true, value: true }] }] }],
    players: [
      {
        team: TEAM,
        statistics: [
          {
            type: true,
            name: true,
            labels: true,
            keys: true,
            totals: true,
            athletes: [{ athlete: { id: true, displayName: true, position: { abbreviation: true } }, position: { abbreviation: true }, starter: true, didNotPlay: true, batOrder: true, stats: true, notes: true }],
          },
        ],
      },
    ],
  },
  // ESPN's line before the game (DraftKings'): the over/under's default (part 3 stores it).
  pickcenter: [{ provider: { name: true }, details: true, overUnder: true, spread: true }],
  // The play fields each sport's reader reads (its ESPN sport slug; a sport not here keeps them all).
  plays: null,
  // Football's plays sit in its drives (the finished ones, and live the one going on): set below for football.
  drives: null,
};

const PLAY = { id: true, type: { type: true }, text: true, period: { type: true, number: true }, wallclock: true, participants: [{ athlete: { id: true }, type: true }] };
const CLOCKED = { id: true, text: true, period: { number: true, displayValue: true }, clock: { displayValue: true }, wallclock: true, team: { id: true }, scoringPlay: true, scoreValue: true };
const PLAYS = {
  // Baseball counts runs from scoreValue and outs from outs, never a play's score (an at-bat's start carries its end's).
  baseball: { ...PLAY, scoreValue: true, atBatId: true, summaryType: true, atBatPitchNumber: true, outs: true },
  // Basketball reads a play by its type's text and its shot flags; its people have no roles.
  basketball: { ...CLOCKED, type: { id: true, text: true }, participants: [{ athlete: { id: true } }], shootingPlay: true, pointsAttempted: true },
  // Hockey by its type's abbreviation (a penalty's minutes), its people's roles, and a goal's strength and net.
  hockey: { ...CLOCKED, type: { id: true, text: true, abbreviation: true, penaltyMinutes: true, penaltyType: true }, participants: [{ athlete: { id: true }, type: true }], strength: { abbreviation: true }, shotInfo: { abbreviation: true } },
  // Football reads a play's text (its people are only there), the score after it, and who had the ball on which down where.
  football: { id: true, type: { text: true }, text: true, awayScore: true, homeScore: true, period: { number: true }, clock: { displayValue: true }, wallclock: true, start: { team: { id: true }, down: true, distance: true, yardLine: true } },
  any: { ...PLAY, awayScore: true, homeScore: true, clock: { displayValue: true }, scoringPlay: true, scoreValue: true, team: { id: true } },
};
const sportSlug = league.split("/")[0];
// Soccer's play by play (src/lib/sports/soccer.ts): each match sheet's players with their lines, the key events (ESPN's ids),
// and the commentary (every sentence, a play's people by name only); its half's length.
const SOCCER_PLAY = { id: true, type: { type: true, text: true }, text: true, period: { number: true }, clock: { value: true, displayValue: true }, team: { id: true, displayName: true }, participants: [{ athlete: { id: true, displayName: true } }], wallclock: true, shootout: true };
if (sportSlug === "soccer") {
  KEEP.format = { regulation: { periods: true, clock: true } };
  KEEP.rosters = [{ homeAway: true, team: TEAM, roster: [{ starter: true, athlete: { id: true, displayName: true, fullName: true, lastName: true }, position: { abbreviation: true }, stats: [{ name: true, value: true }] }] }];
  KEEP.keyEvents = [SOCCER_PLAY];
  KEEP.commentary = [{ sequence: true, time: { value: true, displayValue: true }, text: true, play: SOCCER_PLAY }];
  delete KEEP.plays;
  delete KEEP.drives;
} else if (sportSlug === "football") {
  const drive = { id: true, team: { id: true }, plays: [PLAYS.football] };
  KEEP.drives = { previous: [drive], current: drive };
  delete KEEP.plays;
} else {
  KEEP.plays = [PLAYS[sportSlug] ?? PLAYS.any];
  delete KEEP.drives;
}

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
  fs.mkdirSync(cacheDir, { recursive: true });
  const cached = path.join(cacheDir, `${league.replace("/", "-")}-summary-${event}.json`);
  const final = (s) => s?.header?.competitions?.[0]?.status?.type?.completed === true;
  let summary = fs.existsSync(cached) ? JSON.parse(fs.readFileSync(cached, "utf8")) : null;
  if (!final(summary)) {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league}/summary?event=${event}`, { headers: { "User-Agent": "GameYourShow/1.0" } });
    if (!res.ok) throw new Error(`ESPN answered ${res.status}`);
    summary = await res.json();
    // Only a final game is kept (the cache check-sport-reduce.js shares): a live one changes.
    if (final(summary)) fs.writeFileSync(cached, JSON.stringify(summary));
  }
  const st = summary.header?.competitions?.[0]?.status?.type;
  if (!(st?.state === "post" && st?.completed)) {
    console.error(`${event} isn't final (${st?.state}): a fixture is a whole game.`);
    process.exit(1);
  }
  const trimmed = {
    _recorded: { league, event, from: `site.api.espn.com/apis/site/v2/sports/${league}/summary?event=${event}`, at: new Date().toISOString().slice(0, 10), ...(args.note ? { note: args.note } : {}), by: "scripts/dev-test/record-espn.js" },
    ...trim(summary, KEEP),
  };
  // Each part on a line of its own, and each play (football's: each drive; soccer's: each commentary entry, each key event, each
  // side's match sheet): small diffs when it's recorded again.
  const plays = trimmed.plays ?? [];
  const drives = trimmed.drives ?? null;
  const lists = sportSlug === "soccer" ? Object.fromEntries(["rosters", "keyEvents", "commentary"].map((k) => [k, trimmed[k] ?? []])) : null;
  delete trimmed.plays;
  delete trimmed.drives;
  for (const k of Object.keys(lists ?? {})) delete trimmed[k];
  const parts = Object.entries(trimmed).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  const tail = lists
    ? Object.entries(lists).map(([k, v]) => ` ${JSON.stringify(k)}: [\n${v.map((x) => `  ${JSON.stringify(x)}`).join(",\n")}\n ]`).join(",\n")
    : drives
    ? ` "drives": {\n  "previous": [\n${(drives.previous ?? []).map((d) => `   ${JSON.stringify(d)}`).join(",\n")}\n  ]${drives.current ? `,\n  "current": ${JSON.stringify(drives.current)}` : ""}\n }`
    : ` "plays": [\n${plays.map((p) => `  ${JSON.stringify(p)}`).join(",\n")}\n ]`;
  const body = `{\n${parts.join(",\n")},\n${tail}\n}\n`;
  JSON.parse(body);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, body);
  const count = lists ? lists.commentary.length + lists.keyEvents.length : drives ? [...(drives.previous ?? []), ...(drives.current ? [drives.current] : [])].reduce((n, d) => n + (d.plays ?? []).length, 0) : plays.length;
  console.log(`${path.relative(process.cwd(), out)}: ${count} plays, ${(body.length / 1024).toFixed(0)} KB (from ${(JSON.stringify(summary).length / 1024).toFixed(0)} KB)`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
