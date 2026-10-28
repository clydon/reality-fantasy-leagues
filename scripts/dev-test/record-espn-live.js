// Dev-only: records a game IN PROGRESS from the real ESPN, then compares what it said live with what it says once the game's
// final (docs/PLAN-start-a-game-gpt.md track L, step L2: every check before it was on finished games, so how a live answer
// differs from the final was unknown). Fixtures (record-espn.js) and replays (espn-replay.js) are finished games cut at a
// moment, which can't show it.
//
//   node scripts/dev-test/record-espn-live.js --league=basketball/nba --event=401909881 [--every=30] [--hours=5] [--dir=<folder>]
//   node scripts/dev-test/record-espn-live.js --league=basketball/nba --event=401909881 --compare [--dir=<folder>]
//   (--base=<url>: a stand-in instead of ESPN, e.g. fake-espn.js's replay, to check this script itself)
//
// Recording: ESPN's summary for the game every --every seconds (30) from now until it's final (at most --hours), as a phone's
// poller would see it, each answer kept whole but its news, videos and win probability, gzipped (~50-80 KB), with a line in
// log.jsonl (when, its state, its plays, the bytes over the wire). Waits for a game that hasn't started, asking every 5 minutes.
// Kept in the OS temp folder (rfl-espn-live/<league>-<event>/) by default: raw ESPN, never in the repo. One real call per ask.
//
// Comparing (the game final, its last answer kept): each live answer read by the game's Sport (src/lib/sports) against the
// final read the same way, and printed:
//  - plays ESPN listed live and dropped by the final, and plays the final reads otherwise (its deltas, its time, its score);
//  - the game as of each live answer's newest play against the final's at that moment (what a phone showed, against the
//    truth), as streaks of answers that differ, with how long each took to settle;
//  - ESPN's lag: how long after a play's wallclock it was first in an answer (median, 90th percentile, most);
//  - the raw fields the readers don't trust live: baseball's outs and score on an at-bat's start and the plays in it (the
//    final's carry the at-bat's end), football's drives.current (and whether drives.previous also lists it), a hockey box's
//    goalies who hadn't played yet;
//  - a phone's data: the bytes over the wire per answer and per hour at 15 s.
// Exits 1 if it can't compare (no final answer kept).
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, ...v]) => [k, v.length ? v.join("=") : true]));
const league = args.league;
const event = args.event && String(args.event);
if (!league || !event) {
  console.error("Usage: node scripts/dev-test/record-espn-live.js --league=basketball/nba --event=<ESPN event id> [--every=30] [--compare]");
  process.exit(2);
}
const dir = args.dir || path.join(os.tmpdir(), "rfl-espn-live", `${league.replace("/", "-")}-${event}`);
const base = (args.base || "https://site.api.espn.com").replace(/\/$/, "");
const EVERY = Number(args.every || 30) * 1000;
const HOURS = Number(args.hours || 5);
const HEAVY = ["news", "videos", "article", "winprobability", "standings", "seasonseries", "againstTheSpread", "broadcasts", "leaders", "injuries", "predictor", "ticketsInfo", "meta"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stateOf = (s) => s?.header?.competitions?.[0]?.status?.type ?? {};
const playCount = (s) => (s.plays ?? []).length + [...(s.drives?.previous ?? []), ...(s.drives?.current ? [s.drives.current] : [])].reduce((n, d) => n + (d.plays ?? []).length, 0);

async function record() {
  fs.mkdirSync(dir, { recursive: true });
  const url = `${base}/apis/site/v2/sports/${league}/summary?event=${event}`;
  const until = Date.now() + HOURS * 3600_000;
  console.log(`Recording ${url} every ${EVERY / 1000} s into ${dir} (at most ${HOURS} h)...`);
  while (Date.now() < until) {
    const at = Date.now();
    let summary;
    let bytes = null;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "GameYourShow/1.0", "Accept-Encoding": "gzip" } });
      bytes = Number(res.headers.get("content-length")) || null;
      if (!res.ok) throw new Error(`ESPN answered ${res.status}`);
      summary = await res.json();
    } catch (e) {
      fs.appendFileSync(path.join(dir, "log.jsonl"), JSON.stringify({ at: new Date(at).toISOString(), error: e.message }) + "\n");
      console.log(`${new Date(at).toISOString()}  ${e.message}`);
      await sleep(EVERY);
      continue;
    }
    const st = stateOf(summary);
    const raw = JSON.stringify(summary).length;
    for (const k of HEAVY) delete summary[k];
    if (st.state !== "pre") fs.writeFileSync(path.join(dir, `${at}.json.gz`), zlib.gzipSync(JSON.stringify({ _asked: new Date(at).toISOString(), ...summary })));
    const line = { at: new Date(at).toISOString(), state: st.state, completed: !!st.completed, detail: st.detail, plays: playCount(summary), bytes, raw };
    fs.appendFileSync(path.join(dir, "log.jsonl"), JSON.stringify(line) + "\n");
    console.log(`${line.at}  ${st.state} ${st.detail ?? ""}  ${line.plays} plays  ${bytes ? `${Math.round(bytes / 1024)} KB over the wire` : ""} (${Math.round(raw / 1024)} KB)`);
    if (st.state === "post") {
      console.log(st.completed ? "Final: done. Compare with --compare." : "Over but not completed (postponed or called off): done.");
      return;
    }
    await sleep(st.state === "pre" ? Math.min(5 * 60_000, EVERY * 10) : EVERY);
  }
  console.log("Stopped at --hours before the final.");
}

function quantile(xs, q) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

function compare() {
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
  const { sportOf } = jiti("../../src/lib/sports/index.ts");
  const { differences, settles } = require("./espn-replay");
  const sport = sportOf(league);
  if (!sport) throw new Error(`no sport reads ${league} yet`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json.gz")).sort();
  const answers = files.map((f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString("utf8")));
  const final = answers[answers.length - 1];
  if (!final || stateOf(final).state !== "post" || !stateOf(final).completed) {
    console.error(`No final answer in ${dir}: record until the game's final first.`);
    process.exit(1);
  }
  const live = answers.slice(0, -1).filter((a) => stateOf(a).state === "in");
  const sides = (final.header.competitions[0].competitors ?? []).map((c) => String(c.team.id));
  const finalPlays = sport.readPlays(final);
  const byId = new Map(finalPlays.map((p) => [p.id, p]));
  const firstSeen = new Map();
  const dropped = new Map();
  const otherwise = new Map();
  const log = [];
  for (const a of live) {
    const asked = Date.parse(a._asked);
    const plays = sport.readPlays(a);
    for (const p of plays) {
      if (!firstSeen.has(p.id)) firstSeen.set(p.id, { asked, at: Date.parse(p.at) });
      const f = byId.get(p.id);
      if (!f) {
        dropped.set(p.id, p.text);
        continue;
      }
      const why = [];
      if (JSON.stringify(p.deltas) !== JSON.stringify(f.deltas)) why.push(`deltas ${JSON.stringify(p.deltas)} then ${JSON.stringify(f.deltas)}`);
      if (p.at !== f.at) why.push(`at ${p.at} then ${f.at}`);
      if (JSON.stringify(p.score) !== JSON.stringify(f.score)) why.push(`score ${JSON.stringify(p.score)} then ${JSON.stringify(f.score)}`);
      if (why.length && !otherwise.has(p.id)) otherwise.set(p.id, `${p.text.slice(0, 80)}: ${why.join("; ")}`);
    }
    // What the phone showed (the game as of its newest play) against the final's plays at that moment.
    const newest = plays[plays.length - 1];
    if (newest) {
      const shown = sport.reduce(plays, null, sides);
      const truth = sport.reduce(finalPlays, newest.at, sides);
      log.push({ at: Date.parse(newest.at), diffs: differences(shown, truth) });
    }
  }
  console.log(`${league} ${event}: ${live.length} live answers, ${finalPlays.length} plays in the final.`);
  console.log(`\nPlays read live that the final's reading leaves out (ESPN dropped them, or a later play showed they were replaced): ${dropped.size}`);
  for (const [id, text] of [...dropped].slice(0, 15)) console.log(`  ${id}  ${String(text).slice(0, 110)}`);
  console.log(`\nPlays the final reads otherwise: ${otherwise.size}`);
  for (const [id, why] of [...otherwise].slice(0, 15)) console.log(`  ${id}  ${why.slice(0, 220)}`);
  const { streaks } = settles(log, { within: 10 * 60_000 });
  console.log(`\nThe game as a phone showed it, against the final at the same moment: ${log.length - log.filter((x) => x.diffs.length).length} of ${log.length} answers equal`);
  for (const s of streaks) console.log(`  from ${new Date(s.from).toISOString()} for ${s.ms === Infinity ? "ever" : `${Math.round(s.ms / 1000)} s`}: ${s.diffs.slice(0, 5).join("; ")}`);
  const lags = [...firstSeen.values()].filter((x) => Number.isFinite(x.at)).map((x) => (x.asked - x.at) / 1000);
  const every = quantile(live.slice(1).map((a, i) => (Date.parse(a._asked) - Date.parse(live[i]._asked)) / 1000), 0.5);
  console.log(`\nESPN's lag (first in an answer after its wallclock, s; answers every ${every} s): median ${quantile(lags, 0.5)}, 90th ${quantile(lags, 0.9)}, most ${Math.max(...lags)}`);

  // The raw fields the readers don't trust live.
  const rawPlays = (s) => [...(s.plays ?? []), ...[...(s.drives?.previous ?? []), ...(s.drives?.current ? [s.drives.current] : [])].flatMap((d) => d.plays ?? [])];
  const finalRaw = new Map(rawPlays(final).map((p) => [String(p.id), p]));
  if (league.startsWith("baseball/")) {
    let starts = 0;
    let outs = 0;
    let score = 0;
    const seen = new Set();
    for (const a of live) {
      for (const p of rawPlays(a)) {
        if (seen.has(String(p.id)) || !["P", "A"].includes(p.summaryType)) continue;
        const f = finalRaw.get(String(p.id));
        if (!f) continue;
        seen.add(String(p.id));
        starts++;
        if (p.outs !== f.outs) outs++;
        if (p.awayScore !== f.awayScore || p.homeScore !== f.homeScore) score++;
      }
    }
    console.log(`\nBaseball: of ${starts} at-bat starts and pitches first seen live, ${outs} carried other outs and ${score} another score than the final's (the final's carry the at-bat's end; the reader reads neither)`);
  }
  if (league.startsWith("football/")) {
    const current = live.filter((a) => a.drives?.current);
    const twice = current.filter((a) => (a.drives.previous ?? []).some((d) => String(d.id) === String(a.drives.current.id)));
    console.log(`\nFootball: drives.current in ${current.length} of ${live.length} live answers; also in drives.previous in ${twice.length} (the reader reads a play once either way)`);
  }
  if (league.startsWith("hockey/")) {
    const unplayed = new Set();
    for (const a of live.slice(0, 20)) {
      for (const side of a.boxscore?.players ?? []) for (const t of side.statistics ?? []) if (t.name === "goalies") for (const row of t.athletes ?? []) if (!(row.stats ?? []).some((v) => /[1-9]/.test(String(v)))) unplayed.add(row.athlete?.displayName);
    }
    console.log(`\nHockey: goalies the live box listed with nothing yet in the game's first answers: ${[...unplayed].join(", ") || "none"} (with none, a goal on the first shot finds its goalie as the side's only one)`);
  }
  const lines = fs.existsSync(path.join(dir, "log.jsonl")) ? fs.readFileSync(path.join(dir, "log.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
  const wire = lines.filter((l) => l.state === "in" && l.bytes).map((l) => l.bytes);
  if (wire.length) {
    const avg = wire.reduce((a, b) => a + b, 0) / wire.length;
    console.log(`\nA phone's data: ${Math.round(avg / 1024)} KB an answer on average over the wire (${Math.round(Math.min(...wire) / 1024)}-${Math.round(Math.max(...wire) / 1024)}), so ${Math.round((avg * 240) / 1024 / 1024)} MB an hour at 15 s`);
  }
}

(args.compare ? Promise.resolve().then(compare) : record()).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
