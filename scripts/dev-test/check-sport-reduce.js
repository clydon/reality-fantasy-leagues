// Dev-only check of the sports' readers and reducers (src/lib/sports/; docs/PLAN-start-a-game-gpt.md track L, step L1) against
// the REAL ESPN, on as many finished games as asked: each game's plays, reduced, must come to ESPN's own box score (every
// player's counts, the team totals ESPN gives, the score), as tests/sports-*.test.js prove on the recorded games. Stats known
// only at the final (a pitcher's win) come from the final's correction and aren't compared; the official scorer's calls (a
// stat marked `judged`: baseball's earned runs and RBIs) are listed apart and don't fail a game, since the final's correction
// settles them. Real calls, no app server, no database, nothing written but its cache.
//
//   node scripts/dev-test/check-sport-reduce.js --league=baseball/mlb --from=2026-09-01 [--days=3] [--max=40]
//   node scripts/dev-test/check-sport-reduce.js --league=baseball/mlb --events=401907924,401907963
//        [--cache=<dir>] [--verbose]
//
// --from/--days: the finished games on those days' scoreboards (ESPN's days), at most --max; --events: just these. --cache keeps
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

async function events() {
  if (args.events) return String(args.events).split(",").filter(Boolean);
  const out = [];
  const from = new Date(`${args.from || "2026-09-01"}T12:00:00Z`);
  for (let d = 0; d < Number(args.days || 1); d++) {
    const day = new Date(from.getTime() + d * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
    // A day's scoreboard changes until its games are over; only then is it cached.
    const board = await get(`${SITE}/${league}/scoreboard?dates=${day}&limit=300`, `${league.replace("/", "-")}-board-${day}.json`, dayOver);
    for (const e of board.events ?? []) if (e.status?.type?.completed) out.push(String(e.id));
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
  if (!box) return { out: ["no box score"], judged, notes, plays };
  for (const [id, p] of Object.entries(box.people)) {
    const have = state.lines[id] ?? {};
    for (const [k, v] of Object.entries(p.stats)) {
      const stat = sport.stat(k);
      if (stat?.known === "final") continue;
      if ((have[k] ?? 0) !== v) (stat?.judged ? judged : out).push(`${p.name} ${k}: ESPN ${v}, plays ${have[k] ?? 0}`);
    }
  }
  for (const [id, have] of Object.entries(state.lines)) if (!box.people[id]) out.push(`the plays credit ${id} (${Object.keys(have).join(" ")}), who isn't in ESPN's box score`);
  for (const t of box.teams) {
    const sum = {};
    for (const [id, p] of Object.entries(box.people)) {
      if (p.team !== t.id) continue;
      for (const [k, v] of Object.entries(sport.full(state.lines[id] ?? {}))) sum[k] = (sum[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(t.stats)) if (Math.abs((sum[k] ?? 0) - v) > 1e-9) (sport.stat(k)?.judged ? judged : out).push(`${t.abbreviation} total ${k}: ESPN ${v}, plays ${sum[k] ?? 0}`);
    if ((state.score[t.id] ?? 0) !== t.score) out.push(`${t.abbreviation} score: ESPN ${t.score}, plays ${state.score[t.id] ?? 0}`);
  }
  // The timeline (the plays, then the final's correction) comes to the box score whatever the plays missed.
  const end = sport.reduce(sport.timeline(summary));
  for (const [id, p] of Object.entries(box.people)) {
    for (const [k, v] of Object.entries(p.stats)) if ((end.lines[id]?.[k] ?? 0) !== v) out.push(`timeline: ${p.name} ${k}: ESPN ${v}, ${end.lines[id]?.[k] ?? 0}`);
  }
  return { out, judged, notes, plays };
}

(async () => {
  const ids = await events();
  let bad = 0;
  let plays = 0;
  let calls = 0;
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
    plays += r.plays.length;
    if (r.out.length) bad++;
    if (r.judged.length) calls++;
    console.log(`${r.out.length ? "FAIL" : "OK  "}  ${id}  ${name}  (${r.plays.length} plays${r.judged.length ? `; the scorer judged ${r.judged.length} otherwise` : ""})`);
    for (const d of r.out) console.log(`        ${d}`);
    for (const d of r.judged) console.log(`        judged: ${d}`);
    if (args.verbose || r.out.length) for (const n of r.notes) console.log(`        note: ${n}`);
  }
  console.log(`\n${ids.length - bad} of ${ids.length} games reduce to ESPN's box score (${plays} plays read); in ${calls}, the scorer judged an earned run or RBI otherwise (the final's correction settles it).`);
  process.exit(bad ? 1 : 0);
})();
