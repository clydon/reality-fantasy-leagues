// Dev-only check of the sports' readers and reducers (src/lib/sports/; docs/PLAN-start-a-game-gpt.md track L, step L1) against
// the REAL ESPN, on as many finished games as asked: each game's plays, reduced, must come to ESPN's own box score (every
// player's counts, the team totals ESPN gives, the score), as tests/sports-*.test.js prove on the recorded games. Stats known
// only at the final (a pitcher's win, a basketball player's minutes) come from the final's correction and aren't compared. The
// scorer's calls (a stat marked `judged`: baseball's earned runs and RBIs, basketball's assists and rebounds, hockey's shots on
// goal and hits) are listed apart and don't fail a game, since the final's correction settles them; any other difference
// fails it, and so does a count the plays credit to someone who isn't in ESPN's box score or is there with no line (didn't
// play). Real calls, no app server, no database, nothing written but its cache.
//
//   node scripts/dev-test/check-sport-reduce.js --league=baseball/mlb --from=2026-09-01 [--days=3] [--max=40]
//   node scripts/dev-test/check-sport-reduce.js --league=baseball/mlb --events=401907924,401907963
//   node scripts/dev-test/check-sport-reduce.js --league=football/nfl --weeks=5-8 [--season=2026] [--seasontype=2] [--max=80]
//   node scripts/dev-test/check-sport-reduce.js --league=football/nfl --weeks=1-5 --season=2025 --seasontype=3
//        [--cache=<dir>] [--verbose]
//   node scripts/dev-test/check-sport-reduce.js --league=basketball/mens-college-basketball --from=2026-01-17 --groups=50
//   node scripts/dev-test/check-sport-reduce.js --league=baseball/college-baseball --from=2026-03-14 --pbp --apart=PC,PST
//   (any league a sport reads: basketball/nba, basketball/wnba, basketball/womens-college-basketball, hockey/nhl, soccer/eng.1,
//   soccer/usa.1, soccer/fifa.world ...)
//
// --from/--days: the finished games on those days' scoreboards (ESPN's days), at most --max; --weeks: football's weeks instead
// (its scoreboards go by week; --season and --seasontype with it); --groups: a college board's group (ESPN's own lists only its
// featured games: --groups=50 is every Division I basketball game that day, --groups=80 college football's FBS); --pbp: only the
// games the board says have play by play; --events: just these. --apart=PC,PST: those stats' differences listed apart (they
// don't fail a game: college baseball's pitch counts, where ESPN's box and its plays disagree by a pitch now and then). A game
// whose plays have no one in them (a box and only innings: an empty feed) is listed apart too. Also says the share of ESPN's
// numbers the plays come to. --cache keeps
// each finished answer as a file (default: rfl-espn-cache in the OS temp folder: a final game, a day whose games are all over),
// so running it again asks ESPN nothing. Prints each game
// OK or its differences (with the reader's notes under --verbose), then a total; exits 1 on any difference.
const fs = require("fs");
const os = require("os");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { sportOf } = jiti("../../src/lib/sports/index.ts");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, ...v]) => [k, v.length ? v.join("=") : true]));
const league = args.league || "baseball/mlb";
const sport = sportOf(league);
if (!sport) {
  console.error(`No sport built for ${league} yet.`);
  process.exit(2);
}
const cacheDir = args.cache || path.join(os.tmpdir(), "rfl-espn-cache");
fs.mkdirSync(cacheDir, { recursive: true });
const SITE = "https://site.api.espn.com/apis/site/v2/sports";

/** ESPN's answer, from the cache when it's there; kept only when `done` says it won't change (a final game, a day all over). */
async function get(url, file, done) {
  const at = path.join(cacheDir, file);
  if (fs.existsSync(at)) return JSON.parse(fs.readFileSync(at, "utf8"));
  const res = await fetch(url, { headers: { "User-Agent": "GameYourShow/1.0" } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const json = await res.json();
  if (done(json)) fs.writeFileSync(at, JSON.stringify(json));
  return json;
}
const finalGame = (s) => s.header?.competitions?.[0]?.status?.type?.completed === true;
const dayOver = (b) => (b.events ?? []).length > 0 && b.events.every((e) => e.status?.type?.completed === true);

/** A college board's group (--groups): its query and its cache file's suffix. */
const group = args.groups ? { query: `&groups=${args.groups}`, file: `-g${args.groups}` } : { query: "", file: "" };

/** --pbp: only the games the board says have play by play (college baseball's: ESPN's networks' games and the College World
 *  Series; the rest are a score only). */
const playable = (e) => !args.pbp || e.competitions?.[0]?.playByPlayAvailable === true;
const apartKeys = new Set(String(args.apart || "").split(",").filter(Boolean));

async function events() {
  if (args.events) return String(args.events).split(",").filter(Boolean);
  const out = [];
  // Football's scoreboards go by week: a season (its year), a season type (2 the regular season, 3 the postseason) and its
  // weeks, "5-8" or "7"; college football's only list its FBS games with groups=80.
  if (args.weeks) {
    const [a, b] = String(args.weeks).split("-").map(Number);
    const season = args.season || "2026";
    const type = args.seasontype || "2";
    for (let w = a; w <= (b || a) && out.length < Number(args.max || 40); w++) {
      const board = await get(`${SITE}/${league}/scoreboard?dates=${season}&seasontype=${type}&week=${w}${group.query}&limit=300`, `${league.replace("/", "-")}-board-${season}-${type}-${w}${group.file}.json`, dayOver);
      for (const e of board.events ?? []) if (e.status?.type?.completed && playable(e)) out.push(String(e.id));
    }
    return out.slice(0, Number(args.max || 40));
  }
  const from = new Date(`${args.from || "2026-09-01"}T12:00:00Z`);
  for (let d = 0; d < Number(args.days || 1); d++) {
    const day = new Date(from.getTime() + d * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
    // A day's scoreboard changes until its games are over; only then is it cached.
    const board = await get(`${SITE}/${league}/scoreboard?dates=${day}&limit=300${group.query}`, `${league.replace("/", "-")}-board-${day}${group.file}.json`, dayOver);
    for (const e of board.events ?? []) if (e.status?.type?.completed && playable(e)) out.push(String(e.id));
  }
  return out.slice(0, Number(args.max || 40));
}

/** Where a game's plays, reduced, differ from its box score: per person, per team total, the score; the scorer's calls apart. */
function differences(summary) {
  const box = sport.readBox(summary);
  const notes = [];
  const plays = sport.readPlays(summary, notes);
  const state = sport.reduce(plays);
  const out = [];
  const judged = [];
  const apart = [];
  const numbers = { all: 0, same: 0 };
  const bucket = (k) => (apartKeys.has(k) ? apart : sport.stat(k)?.judged ? judged : out);
  if (!box) return { out: ["no box score"], judged, apart, notes, plays, numbers };
  // An empty feed (innings and no at-bats: no play with anyone in it): nothing to read. A reader that reads plays with people and
  // credits none of them still fails.
  if (!plays.some((p) => p.people.length)) return { out: [], judged, apart, notes, plays, numbers, empty: true };
  for (const [id, p] of Object.entries(box.people)) {
    const have = state.lines[id] ?? {};
    for (const [k, v] of Object.entries(p.stats)) {
      const stat = sport.stat(k);
      if (stat?.known === "final") continue;
      numbers.all++;
      if ((have[k] ?? 0) === v) {
        numbers.same++;
        continue;
      }
      bucket(k).push(`${p.name} ${k}: ESPN ${v}, plays ${have[k] ?? 0}`);
    }
  }
  for (const [id, have] of Object.entries(state.lines)) {
    if (!box.people[id]) out.push(`the plays credit ${id} (${Object.keys(have).join(" ")}), who isn't in ESPN's box score`);
    else if (!Object.keys(box.people[id].stats).length) out.push(`the plays credit ${box.people[id].name} (${Object.keys(have).join(" ")}), who didn't play`);
  }
  for (const t of box.teams) {
    const sum = {};
    for (const [id, p] of Object.entries(box.people)) {
      if (p.team !== t.id) continue;
      for (const [k, v] of Object.entries(sport.full(state.lines[id] ?? {}))) sum[k] = (sum[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(t.stats)) {
      numbers.all++;
      if (Math.abs((sum[k] ?? 0) - v) > 1e-9) bucket(k).push(`${t.abbreviation} total ${k}: ESPN ${v}, plays ${sum[k] ?? 0}`);
      else numbers.same++;
    }
    numbers.all++;
    if ((state.score[t.id] ?? 0) !== t.score) out.push(`${t.abbreviation} score: ESPN ${t.score}, plays ${state.score[t.id] ?? 0}`);
    else numbers.same++;
  }
  // The timeline (the plays, then the final's correction) comes to the box score whatever the plays missed.
  const end = sport.reduce(sport.timeline(summary));
  for (const [id, p] of Object.entries(box.people)) {
    for (const [k, v] of Object.entries(p.stats)) if ((end.lines[id]?.[k] ?? 0) !== v) out.push(`timeline: ${p.name} ${k}: ESPN ${v}, ${end.lines[id]?.[k] ?? 0}`);
    if (!Object.keys(p.stats).length && end.lines[id]) out.push(`timeline: ${p.name} didn't play but has ${Object.keys(end.lines[id]).join(" ")}`);
  }
  return { out, judged, apart, notes, plays, numbers };
}

(async () => {
  const ids = await events();
  let bad = 0;
  let plays = 0;
  let calls = 0;
  let empty = 0;
  let butApart = 0;
  const numbers = { all: 0, same: 0 };
  const queue = [...ids];
  const results = new Map();
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const id = queue.shift();
        try {
          const summary = await get(`${SITE}/${league}/summary?event=${id}`, `${league.replace("/", "-")}-summary-${id}.json`, finalGame);
          results.set(id, { summary, ...differences(summary) });
        } catch (e) {
          results.set(id, { error: e.message });
        }
      }
    })
  );
  for (const id of ids) {
    const r = results.get(id);
    if (r.error) {
      bad++;
      console.log(`FAIL  ${id}  ${r.error}`);
      continue;
    }
    const name = r.summary.header?.competitions?.[0]?.competitors?.map((c) => `${c.team?.abbreviation} ${c.score}`).join(" - ");
    if (r.empty) {
      empty++;
      console.log(`NONE  ${id}  ${name}  (${r.plays.length} plays, none crediting anyone: an empty feed)`);
      continue;
    }
    plays += r.plays.length;
    numbers.all += r.numbers.all;
    numbers.same += r.numbers.same;
    if (r.out.length) bad++;
    else if (r.apart.length) butApart++;
    if (r.judged.length) calls++;
    console.log(`${r.out.length ? "FAIL" : r.apart.length ? "OK*" : "OK  "}  ${id}  ${name}  (${r.plays.length} plays${r.judged.length ? `; the scorer judged ${r.judged.length} otherwise` : ""}${r.apart.length ? `; ${r.apart.length} apart` : ""})`);
    for (const d of r.out) console.log(`        ${d}`);
    for (const d of r.judged) console.log(`        judged: ${d}`);
    for (const d of r.apart) console.log(`        apart: ${d}`);
    if (args.verbose || r.out.length) for (const n of r.notes) console.log(`        note: ${n}`);
  }
  const read = ids.length - empty;
  console.log(`\n${read - bad - butApart} of ${read} games reduce to ESPN's box score${apartKeys.size ? `, ${read - bad} but for ${[...apartKeys].join(", ")}` : ""} (${plays} plays read; ${numbers.same} of ${numbers.all} numbers, ${((100 * numbers.same) / Math.max(1, numbers.all)).toFixed(1)}%); in ${calls}, the scorer judged a count otherwise (the final's correction settles it).${empty ? ` ${empty} more had an empty feed.` : ""}`);
  process.exit(bad ? 1 : 0);
})();
