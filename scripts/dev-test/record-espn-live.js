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
//    truth), as streaks of answers that differ, with how long each took to settle; then count by count (a person's stat, or the
//    score), from the first answer that showed it otherwise to the first that matched, the stat crew's judged counts apart
//    (hockey's hits and blocks are revised all game), the longest listed; and how many people the box listed live and at the end
//    (the NHL's lists a player only once he's played);
//  - ESPN's lag: how long after a play's wallclock it was first in an answer (median, 90th percentile, most), for the plays
//    that came after the first answer recorded (a recording started mid-game has the rest in its first answer already);
//  - the raw fields the readers don't trust live: baseball's outs and score on an at-bat's start and the plays in it (the
//    final's carry the at-bat's end), football's drives.current (and whether drives.previous also lists it), a hockey box's
//    goalies who hadn't played yet; soccer's answers whose commentary came cut short (fewer entries than the answer before);
//  - a phone's data: the bytes over the wire per answer and per hour at 15 s.
// Exits 1 if it can't compare (no final answer kept).
//
// A field (golf, racing: L5 part 3) has no summary: each ask is ESPN's answers for the event, kept together in one file
// ({ _asked, board, leaderboard } or { _asked, board, core }): golf's event board (`golf/<tour>/scoreboard/<event>`: every hole,
// in the order played) and its leaderboard (`golf/leaderboard?event=`: places, thru, tee times, who's cut or withdrew); racing's
// event board (`racing/<series>/scoreboard/<event>`: each session's order) and, from ESPN's core API, the session on's
// competitors every ask (one call: their order and grid) with each one's statistics and F1's status every --stats-every
// seconds (300; a call a driver), and a session's in full in the first answer after it's over (racing.ts reads them).
// It waits until play is on (a golf tournament between rounds is
// "post", "Round 1 - Play Complete"), then records until play stops again: the round's play complete, suspended, or the final
// (--until=final records on through the next rounds or sessions, waiting between them, until the event's final: at most --hours,
// 18 a round or 120 to the final). Between rounds it asks every 5 minutes and keeps only the first answer after play stops.
//   node scripts/dev-test/record-espn-live.js --league=golf/pga --event=401850978 [--every=60] [--hours=18] [--until=final]
//   node scripts/dev-test/record-espn-live.js --league=golf/pga --event=401850978 --compare
// A field's --compare reads each answer recorded while play was on with the event's Sport (Golf, Racing) against the event's
// final, read the same way: the final's answers from check-field-reduce.js's cache (golf-<tour>-board-/leaderboard-<event>,
// racing-<series>-board-/core-<event>-<session>), asked and cached once the event's final (golf's is the Sunday's, after the
// round recorded); before then, the recording's last answer, said so. It prints:
//  - plays a live answer showed that the final reads otherwise (golf: a hole rescored; racing: a session's result as the running
//    order had it), how long each took to settle, and plays dropped;
//  - golf: holes per answer and how fast they came, how `thru` moved (back, or jumping holes), whether ESPN's `currentPosition`
//    is filled in for a round as each player finishes it, the places shown against the places after the round;
//  - racing: each session as it went: its laps (`status.period`) answer by answer, how often its order changed and its leader,
//    how many answers had the final order and from when, the core's live order against the board's, and its live statistics
//    (laps, laps led) against the final's;
//  - ESPN's lag: no hole or lap has a time in a field's answers, so only how long after a session's or round's start its first
//    result showed;
//  - a phone's data: the bytes per answer (the board's and the leaderboard's, or racing's board and, apart, its core) and per hour.
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
// Soccer's plays are its commentary entries (its key events are mostly the same plays again), not `plays`.
const playCount = (s) => (s.plays ?? []).length + (s.commentary ?? []).length + [...(s.drives?.previous ?? []), ...(s.drives?.current ? [s.drives.current] : [])].reduce((n, d) => n + (d.plays ?? []).length, 0);

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

// A field's event (golf, racing): the answers asked together, and where play is.
const FIELD = /^(golf|racing)\//.test(String(league));
const RACING = String(league).startsWith("racing/");
const STATS_EVERY = Number(args["stats-every"] || 300) * 1000;
const { raceCore: askCore, cachedRaceCore } = require("./espn-race-core");

/** A race session's core answer as racing.ts reads it, as recorded: its competitors and, `full`, their statistics and F1's
 *  status (espn-race-core.js), with when it was asked. Counts what came over the wire into `wire`. */
async function raceCore(session, full, wire) {
  const got = await askCore({ series: league.split("/")[1], event, session, full, wire });
  return { _asked: new Date().toISOString(), ...(full ? { _full: true } : {}), competitors: got?.competitors ?? [] };
}
const fieldUrls = () =>
  league.startsWith("golf/")
    ? { board: `${base}/apis/site/v2/sports/${league}/scoreboard/${event}`, leaderboard: `${base}/apis/site/v2/sports/golf/leaderboard?event=${event}` }
    : { board: `${base}/apis/site/v2/sports/${league}/scoreboard/${event}` };
/** Where a field's play is: golf's competition status ("Round 2 - In Progress"; "post" between rounds, "Round 1 - Play
 *  Complete"), racing's session on (the first not over), and whether the event's final. */
function fieldState(answer) {
  const board = answer.board ?? {};
  const ev = answer.leaderboard?.events?.[0] ?? board;
  const final = ev.status?.type?.state === "post" || board.status?.type?.state === "post";
  const comps = board.competitions ?? ev.competitions ?? [];
  const on = league.startsWith("golf/") ? comps[0] : comps.find((c) => c.status?.type?.state === "in") ?? comps.find((c) => c.status?.type?.state === "pre") ?? comps[comps.length - 1];
  const st = (league.startsWith("golf/") ? answer.leaderboard?.events?.[0]?.competitions?.[0]?.status : null) ?? on?.status ?? {};
  const holes = (comps[0]?.competitors ?? []).reduce((n, c) => n + (c.linescores ?? []).reduce((m, r) => m + (r.linescores ?? []).length, 0), 0);
  return { final, state: st.type?.state, detail: st.type?.detail ?? st.type?.shortDetail, name: st.type?.name, session: on?.type?.abbreviation ?? null, holes };
}

async function recordField() {
  fs.mkdirSync(dir, { recursive: true });
  const urls = fieldUrls();
  const toFinal = args.until === "final";
  const hours = Number(args.hours || (toFinal ? 120 : 18));
  const until = Date.now() + hours * 3600_000;
  let played = false;
  let wasOn = false;
  let statsAt = 0;
  let onSession = null;
  console.log(`Recording ${Object.values(urls).join(" and ")}${RACING && !args.base ? " and the core API's session on" : ""} every ${EVERY / 1000} s into ${dir} (at most ${hours} h, until ${toFinal ? "the final" : "play stops"})...`);
  while (Date.now() < until) {
    const at = Date.now();
    const answer = { _asked: new Date(at).toISOString() };
    let bytes = 0;
    let raw = 0;
    try {
      for (const [k, url] of Object.entries(urls)) {
        const res = await fetch(url, { headers: { "User-Agent": "GameYourShow/1.0", "Accept-Encoding": "gzip" } });
        bytes += Number(res.headers.get("content-length")) || 0;
        if (!res.ok) throw new Error(`ESPN answered ${res.status} for ${k}`);
        const text = await res.text();
        raw += text.length;
        answer[k] = JSON.parse(text);
      }
      // Racing's core: the session on's competitors every ask, their statistics every --stats-every; a session just over, in full.
      if (RACING && !args.base) {
        const wire = { calls: 0, bytes: 0, raw: 0 };
        const comps = answer.board?.competitions ?? [];
        const now = comps.find((c) => c.status?.type?.state === "in");
        const over = onSession && comps.find((c) => String(c.id) === onSession && c.status?.type?.state === "post");
        answer.core = {};
        // The board's kept whatever the core does.
        try {
          if (now) {
            const full = at - statsAt >= STATS_EVERY;
            answer.core[String(now.id)] = await raceCore(String(now.id), full, wire);
            if (full) statsAt = at;
          }
          if (over) answer.core[String(over.id)] = await raceCore(String(over.id), true, wire);
          onSession = now ? String(now.id) : over ? null : onSession;
        } catch (e) {
          wire.error = e.message;
        }
        answer._core = wire;
        bytes += wire.bytes;
        raw += wire.raw;
      }
    } catch (e) {
      fs.appendFileSync(path.join(dir, "log.jsonl"), JSON.stringify({ at: answer._asked, error: e.message }) + "\n");
      console.log(`${answer._asked}  ${e.message}`);
      await sleep(EVERY);
      continue;
    }
    const st = fieldState(answer);
    const on = st.state === "in";
    // While on, the first answer after (where play stopped), and the final: not the same answer every 5 minutes between rounds.
    if (on || wasOn || st.final) fs.writeFileSync(path.join(dir, `${at}.json.gz`), zlib.gzipSync(JSON.stringify(answer)));
    wasOn = on;
    const line = { at: answer._asked, state: st.state, name: st.name, detail: st.detail, session: st.session, final: st.final, holes: st.holes, bytes: bytes || null, raw, ...(answer._core ? { core: answer._core } : {}) };
    fs.appendFileSync(path.join(dir, "log.jsonl"), JSON.stringify(line) + "\n");
    console.log(`${line.at}  ${st.state} ${st.detail ?? ""}${st.session ? ` (${st.session})` : ""}  ${st.holes} holes  ${bytes ? `${Math.round(bytes / 1024)} KB over the wire` : ""} (${Math.round(raw / 1024)} KB)`);
    if (st.final) {
      console.log("Final: done. Compare with --compare (still to write for a field).");
      return;
    }
    if (on) played = true;
    else if (played && !toFinal) {
      console.log(`Play stopped (${st.detail}): done.`);
      return;
    }
    await sleep(on ? EVERY : Math.min(5 * 60_000, EVERY * 10));
  }
  console.log("Stopped at --hours before play stopped.");
}

function quantile(xs, q) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

function compare() {
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
  const { sportOf, LiveGame } = jiti("../../src/lib/sports/index.ts");
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
  const already = new Set(live.length ? sport.readPlays(live[0]).map((p) => p.id) : []);
  const dropped = new Map();
  const otherwise = new Map();
  const log = [];
  // What a phone had: each answer taken by the poller itself (an answer behind or cut short only the second time in a row).
  const phone = new LiveGame({ sport, league, event, now: () => 0 });
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
    phone.take(a);
    const had = phone.plays;
    // What the phone showed (the game as of its newest play) against the final's plays at that moment.
    const newest = had[had.length - 1];
    if (newest) {
      const shown = sport.reduce(had, null, sides);
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
  for (const s of streaks.slice(0, 25)) console.log(`  from ${new Date(s.from).toISOString()} for ${s.ms === Infinity ? "ever" : `${Math.round(s.ms / 1000)} s`}: ${s.diffs.slice(0, 5).join("; ")}`);
  if (streaks.length > 25) console.log(`  ... and ${streaks.length - 25} more`);
  // Count by count (a person's stat, or the score): from the first answer that showed it otherwise to the first that showed it
  // as the final does, judged counts (the stat crew's: settled at the final) apart from the rest.
  const open = new Map();
  const spans = [];
  const keyOf = (d) => d.replace(/ -?[\d.]+\/-?[\d.]+$/, "").replace(/^score .*/, "score");
  for (const a of log) {
    const now = new Set(a.diffs.map(keyOf));
    for (const k of now) if (!open.has(k)) open.set(k, { from: a.at, first: a.diffs.find((d) => keyOf(d) === k) });
    for (const [k, o] of [...open]) if (!now.has(k)) (spans.push({ k, ...o, ms: a.at - o.from }), open.delete(k));
  }
  for (const [k, o] of open) spans.push({ k, ...o, ms: Infinity });
  const judgedKey = (k) => k !== "score" && !!sport.stat(k.split(" ")[1])?.judged;
  for (const [label, xs] of [["not judged", spans.filter((s) => !judgedKey(s.k))], ["judged", spans.filter((s) => judgedKey(s.k))]]) {
    const ms = xs.filter((s) => s.ms !== Infinity).map((s) => s.ms / 1000);
    console.log(`  ${label}: ${xs.length} counts shown otherwise for a while${ms.length ? `, settled in a median ${Math.round(quantile(ms, 0.5))} s, 90th ${Math.round(quantile(ms, 0.9))} s, most ${Math.round(Math.max(...ms))} s` : ""}${xs.some((s) => s.ms === Infinity) ? `, ${xs.filter((s) => s.ms === Infinity).length} only at the final` : ""}`);
    for (const s of [...xs].sort((a, b) => b.ms - a.ms).slice(0, label === "judged" ? 3 : 8)) console.log(`    ${new Date(s.from).toISOString()} for ${s.ms === Infinity ? "ever" : `${Math.round(s.ms / 1000)} s`}: ${s.first}`);
  }
  const boxPeople = (s) => new Set((s.boxscore?.players ?? []).flatMap((side) => (side.statistics ?? []).flatMap((t) => (t.athletes ?? []).map((r) => String(r.athlete?.id)))));
  if (live.length) console.log(`\nThe box score's people: ${boxPeople(live[0]).size} in the first live answer, ${boxPeople(final).size} in the final's`);
  const lags = [...firstSeen].filter(([id, x]) => !already.has(id) && Number.isFinite(x.at)).map(([, x]) => (x.asked - x.at) / 1000);
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
  if (league.startsWith("soccer/")) {
    const cut = live.filter((a, i) => i > 0 && (a.commentary ?? []).length < (live[i - 1].commentary ?? []).length);
    const bare = live.filter((a) => !(a.commentary ?? []).length);
    console.log(`
Soccer: ${cut.length} of ${live.length} live answers came with fewer commentary entries than the one before (${cut.map((a) => `${a._asked}: ${(a.commentary ?? []).length}`).join(", ") || "none"}); ${bare.length} with none (a thinner feed's are its key events only)`);
  }
  const lines = fs.existsSync(path.join(dir, "log.jsonl")) ? fs.readFileSync(path.join(dir, "log.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
  const wire = lines.filter((l) => l.state === "in" && l.bytes).map((l) => l.bytes);
  if (wire.length) {
    const avg = wire.reduce((a, b) => a + b, 0) / wire.length;
    console.log(`\nA phone's data: ${Math.round(avg / 1024)} KB an answer on average over the wire (${Math.round(Math.min(...wire) / 1024)}-${Math.round(Math.max(...wire) / 1024)}), so ${Math.round((avg * 240) / 1024 / 1024)} MB an hour at 15 s`);
  }
}

/** The event's final answers (check-field-reduce.js's cache, else asked and cached once final), or null while it isn't. */
async function fieldFinal() {
  const [slug, tour] = league.split("/");
  const cacheDir = path.join(os.tmpdir(), "rfl-espn-cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  const get = async (url, file, keep) => {
    const at = path.join(cacheDir, file);
    if (fs.existsSync(at)) return JSON.parse(fs.readFileSync(at, "utf8"));
    const res = await fetch(url, { headers: { "User-Agent": "GameYourShow/1.0" } });
    if (!res.ok) return null;
    const json = await res.json();
    if (keep(json)) fs.writeFileSync(at, JSON.stringify(json));
    return json;
  };
  const over = (e) => e?.status?.type?.state === "post" && e?.status?.type?.completed === true;
  if (slug === "golf") {
    const urls = fieldUrls();
    const leaderboard = await get(urls.leaderboard, `golf-${tour}-leaderboard-${event}.json`, (j) => over(j?.events?.[0]));
    if (!over(leaderboard?.events?.[0])) return null;
    const board = await get(urls.board, `golf-${tour}-board-${event}.json`, over);
    return { board, leaderboard };
  }
  const board = await get(fieldUrls().board, `racing-${tour}-board-${event}.json`, over);
  if (!over(board)) return null;
  const core = {};
  for (const c of board.competitions ?? []) {
    if (/^FP/.test(c.type?.abbreviation ?? "") || !(c.competitors ?? []).length) continue;
    core[String(c.id)] = await cachedRaceCore(cacheDir, { series: tour, event, session: String(c.id), done: true });
  }
  return { board, core };
}

async function compareField() {
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
  const { sportOf, coreStats } = jiti("../../src/lib/sports/index.ts");
  const sport = sportOf(league);
  if (!sport) throw new Error(`no sport reads ${league} yet`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json.gz")).sort();
  // Racing's answers as a phone would have them: each session's core as last asked (its statistics from the last ask that had
  // them, the session on's order and grid from this one).
  const carried = {};
  const answers = files.map((f) => {
    const a = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString("utf8"));
    if (!RACING) return a;
    for (const [sid, sess] of Object.entries(a.core ?? {})) {
      const prev = carried[sid];
      carried[sid] = sess._full || !prev ? sess : { ...sess, competitors: sess.competitors.map((c) => ({ ...prev.competitors.find((x) => String(x.id) === String(c.id)), ...c })) };
    }
    return { ...a, core: { ...carried } };
  });
  const live = answers.filter((a) => fieldState(a).state === "in");
  if (!live.length) {
    console.error(`No answer recorded while play was on in ${dir}.`);
    process.exit(1);
  }
  const final = await fieldFinal();
  const truth = final ? { ...final, _asked: undefined } : answers[answers.length - 1];
  const from = final ? "the event's final" : `the recording's last answer (${truth._asked}: the event isn't final yet)`;
  const finalPlays = sport.readPlays(truth);
  const byId = new Map(finalPlays.map((p) => [p.id, p]));
  console.log(`${league} ${event}: ${live.length} answers while play was on (${live[0]._asked} to ${live[live.length - 1]._asked}), against ${from}: ${finalPlays.length} plays.`);

  // Plays shown otherwise (a play's deltas, by its id), from the first answer that showed it so to the first that matched.
  const firstSeen = new Map();
  const open = new Map();
  const spans = [];
  const dropped = new Map();
  const key = (p) => JSON.stringify(p.deltas);
  for (const a of live) {
    const asked = Date.parse(a._asked);
    const now = new Map(sport.readPlays(a).map((p) => [p.id, p]));
    for (const [id, p] of now) {
      if (!firstSeen.has(id)) firstSeen.set(id, asked);
      const f = byId.get(id);
      if (!f) {
        dropped.set(id, p.text);
        continue;
      }
      if (key(p) !== key(f)) {
        if (!open.has(id)) open.set(id, { from: asked, first: `${p.text}: ${key(p)} then ${key(f)}` });
      } else if (open.has(id)) {
        spans.push({ id, ...open.get(id), ms: asked - open.get(id).from });
        open.delete(id);
      }
    }
    for (const id of dropped.keys()) if (now.has(id) && byId.has(id)) dropped.delete(id);
  }
  for (const [id, o] of open) spans.push({ id, ...o, ms: Infinity });
  const done = spans.filter((x) => x.ms !== Infinity).map((x) => x.ms / 1000);
  console.log(`\nPlays a live answer showed otherwise than ${final ? "the final" : "the last answer"}: ${spans.length}${done.length ? `, settled in a median ${Math.round(quantile(done, 0.5))} s, 90th ${Math.round(quantile(done, 0.9))} s, most ${Math.round(Math.max(...done))} s` : ""}${spans.some((x) => x.ms === Infinity) ? `; ${spans.filter((x) => x.ms === Infinity).length} not by the last live answer` : ""}`);
  for (const x of [...spans].sort((a, b) => b.ms - a.ms).slice(0, 8)) console.log(`  ${new Date(x.from).toISOString()} for ${x.ms === Infinity ? "the rest" : `${Math.round(x.ms / 1000)} s`}: ${x.first.slice(0, 160)}`);
  console.log(`Plays read live and gone from ${final ? "the final" : "the last answer"}: ${dropped.size}`);
  for (const [id, text] of [...dropped].slice(0, 8)) console.log(`  ${id}  ${String(text).slice(0, 110)}`);

  if (league.startsWith("golf/")) {
    const comps = (a) => a.leaderboard?.events?.[0]?.competitions?.[0]?.competitors ?? [];
    const holes = (a) => (a.board?.competitions?.[0]?.competitors ?? []).reduce((n, c) => n + (c.linescores ?? []).reduce((m, r) => m + (r.linescores ?? []).length, 0), 0);
    const counts = live.map((a) => ({ at: Date.parse(a._asked), holes: holes(a) }));
    const added = counts.slice(1).map((c, i) => c.holes - counts[i].holes);
    const mins = (counts[counts.length - 1].at - counts[0].at) / 60_000;
    console.log(`\nGolf: ${counts[0].holes} holes in the first live answer, ${counts[counts.length - 1].holes} in the last (${Math.round((counts[counts.length - 1].holes - counts[0].holes) / Math.max(1, mins))} a minute); answers that added none ${added.filter((x) => x === 0).length} of ${added.length}, that lost some ${added.filter((x) => x < 0).length}`);
    // How `thru` moved: back, or more than one hole between answers a minute apart.
    let back = 0;
    let jumps = 0;
    let moves = 0;
    const last = new Map();
    for (const a of live) {
      for (const c of comps(a)) {
        const id = String(c.id);
        const t = c.status?.thru ?? null;
        const r = c.status?.period ?? null;
        const was = last.get(id);
        if (was && was.r === r && t != null && was.t != null && t !== was.t) {
          moves++;
          if (t < was.t) back++;
          else if (t - was.t > 1) jumps++;
        }
        last.set(id, { t, r });
      }
    }
    console.log(`  thru: ${moves} moves, ${back} back, ${jumps} by more than a hole between answers`);
    // ESPN's currentPosition for the round in progress: filled in as each one finishes it, or only later?
    const round = live[live.length - 1].leaderboard?.events?.[0]?.competitions?.[0]?.status?.period;
    let finished = 0;
    let filled = 0;
    for (const c of comps(live[live.length - 1])) {
      const r = (c.linescores ?? []).find((l) => l.period === round);
      if ((r?.linescores ?? []).length >= 18 || c.status?.thru === 18) (finished++, r?.currentPosition != null && filled++);
    }
    console.log(`  round ${round}'s currentPosition: filled for ${filled} of the ${finished} who'd finished it in the last live answer`);
    // The places shown live against the places after the round (the truth's start place for the next round, or its place now).
    const truthComps = new Map(comps(truth).map((c) => [String(c.id), c]));
    const after = (id) => {
      const c = truthComps.get(id);
      return (c?.linescores ?? []).find((l) => l.period === round + 1)?.startPosition ?? (final ? null : Number(String(c?.status?.position?.displayName ?? "").replace("T", "")) || null);
    };
    let same = 0;
    let all = 0;
    for (const c of comps(live[live.length - 1])) {
      const shown = Number(String(c.status?.position?.displayName ?? "").replace("T", "")) || null;
      const want = after(String(c.id));
      if (shown == null || want == null) continue;
      all++;
      if (shown === want) same++;
    }
    console.log(`  the places in the last live answer the places after round ${round}: ${same} of ${all}`);
    const tees = comps(live[0]).map((c) => Date.parse((c.linescores ?? []).find((l) => l.period === round)?.teeTime ?? "")).filter(Number.isFinite);
    if (tees.length) console.log(`  round ${round}'s first tee time ${new Date(Math.min(...tees)).toISOString()}; its first hole in an answer ${(() => { const i = counts.findIndex((c) => c.holes > counts[0].holes); return i >= 0 ? new Date(counts[i].at).toISOString() : "none after the first"; })()} (no hole has a time: ESPN's lag can't be measured)`);
  }

  if (league.startsWith("racing/")) {
    const sessions = (truth.board?.competitions ?? []).map((c) => ({ id: String(c.id), abbr: c.type?.abbreviation ?? "Race", order: (c.competitors ?? []).filter((x) => x.order != null).sort((a, b) => a.order - b.order).map((x) => String(x.id)) }));
    for (const s of sessions) {
      const on = live.map((a) => ({ a, c: (a.board?.competitions ?? []).find((c) => String(c.id) === s.id) })).filter((x) => x.c?.status?.type?.state === "in");
      if (!on.length) continue;
      const orders = on.map(({ c }) => (c.competitors ?? []).filter((x) => x.order != null).sort((a, b) => a.order - b.order).map((x) => String(x.id)));
      let changes = 0;
      let leaders = 0;
      orders.forEach((o, i) => {
        if (i && o.join() !== orders[i - 1].join()) changes++;
        if (i && o[0] !== orders[i - 1][0]) leaders++;
      });
      const equal = orders.map((o) => o.join() === s.order.join());
      const fromWhen = equal.lastIndexOf(false) + 1;
      const laps = on.map(({ c }) => c.status?.period ?? 0);
      console.log(`\nRacing ${s.abbr}: ${on.length} answers while on (${on[0].a._asked} to ${on[on.length - 1].a._asked}); laps ${laps[0]} to ${laps[laps.length - 1]}; its order changed in ${changes} answers, its leader in ${leaders}; ${equal.filter(Boolean).length} answers had the final order${fromWhen < on.length ? `, every one from ${on[fromWhen].a._asked}` : ", not the last"}; placed: ${orders[0].length} in the first, ${orders[orders.length - 1].length} in the last, ${s.order.length} in the final`);
      // The core's live list: its order against the board's, and its statistics (where asked) against the final's.
      const withCore = on.filter(({ a }) => a.core?.[s.id]?.competitors?.length);
      const coreSame = withCore.filter(({ a, c }) => {
        const board = new Map((c.competitors ?? []).map((x) => [String(x.id), x.order ?? null]));
        return a.core[s.id].competitors.every((x) => (x.order ?? null) === (board.get(String(x.id)) ?? null));
      }).length;
      if (withCore.length) console.log(`  the core's competitors in ${withCore.length} answers: their order the board's in ${coreSame}; with a grid (startOrder) in ${withCore.filter(({ a }) => a.core[s.id].competitors.some((x) => x.startOrder != null)).length}`);
      const full = withCore.filter(({ a }) => a.core[s.id]._full);
      if (full.length) {
        const fin = new Map((truth.core?.[s.id]?.competitors ?? []).map((x) => [String(x.id), coreStats(x)]));
        const moved = {};
        for (const k of ["lapsCompleted", "lapsLead", "championshipPts", "pitsTaken", "place"]) {
          const vals = full.map(({ a }) => a.core[s.id].competitors.reduce((n, x) => n + (coreStats(x)[k] ?? 0), 0));
          moved[k] = `${vals[0]} to ${vals[vals.length - 1]} (final ${[...fin.values()].reduce((n, x) => n + (x[k] ?? 0), 0)})`;
        }
        console.log(`  the core's statistics in ${full.length} answers, summed over the field: ${Object.entries(moved).map(([k, v]) => `${k} ${v}`).join("; ")}`);
      }
      const start = Date.parse(on[0].c.date ?? "");
      if (Number.isFinite(start)) console.log(`  started ${new Date(start).toISOString()}; first placed in an answer ${on.findIndex((x) => (x.c.competitors ?? []).some((y) => y.order != null)) >= 0 ? on.find((x) => (x.c.competitors ?? []).some((y) => y.order != null)).a._asked : "never"} (no lap has a time: ESPN's lag can't be measured)`);
    }
  }

  const lines = fs.existsSync(path.join(dir, "log.jsonl")) ? fs.readFileSync(path.join(dir, "log.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
  const on = lines.filter((l) => l.state === "in");
  const per = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const wire = per(on.filter((l) => l.bytes).map((l) => l.bytes - (l.core?.bytes ?? 0)));
  const raw = per(on.map((l) => l.raw - (l.core?.raw ?? 0)));
  const every = quantile(on.slice(1).map((l, i) => (Date.parse(l.at) - Date.parse(on[i].at)) / 1000), 0.5);
  if (on.length) console.log(`\nA phone's data: ${wire ? `${Math.round(wire / 1024)} KB an answer over the wire` : "no sizes over the wire"} (${Math.round(raw / 1024)} KB unpacked; answers every ${every} s), so ${wire ? Math.round((wire * 60) / 1024) : "?"} KB an hour at 60 s, ${wire ? ((wire * 240) / 1024 / 1024).toFixed(1) : "?"} MB at 15 s`);
  const core = on.filter((l) => l.core?.calls);
  if (core.length) console.log(`  racing's core: ${Math.round(per(core.map((l) => l.core.calls)))} calls and ${Math.round(per(core.map((l) => l.core.raw)) / 1024)} KB unpacked an ask on average (the list every ask, statistics every ${STATS_EVERY / 1000} s)`);
}

(args.compare ? Promise.resolve().then(() => (FIELD ? compareField() : compare())) : FIELD ? recordField() : record()).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
