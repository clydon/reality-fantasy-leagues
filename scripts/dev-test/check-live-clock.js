// Dev-only check of the live clock (docs/PLAN-start-a-game-gpt.md track L, step L2) through a real HTTP stand-in for ESPN: every
// recorded game in tests/fixtures/espn/ replayed at once by scripts/dev-test/fake-espn.js (at 60x by default, a minute a second),
// each asked by the phone's poller (src/lib/sports/live.ts) every 15 s of game time, as a phone asks ESPN. No app server, no
// database, no real ESPN (scripts/dev-test/check-espn-browser.js asks the real one from a browser).
//
//   node scripts/dev-test/check-live-clock.js [--speed=60] [--games=nba-401909093,mlb-401907924] [--every=15] [--within=6]
//
// For each game it asserts:
//  - every answer: the poller's game on a live clock is the recording as known at that answer's moment (espn-replay.js's known:
//    its plays up to then, the final's correction once final), but for what a later play settles: a run of answers that differ
//    must settle within --within minutes of game time (each listed);
//  - a later watch: someone 20 minutes behind (synced), and someone who tapped the play 10 before the last (set to it), see the
//    recording at their moment;
//  - the asks: the first, then none until the start; about every 15 s (±10%) while it's on; none while the screen's hidden (5
//    minutes, 40% of the way in) and one at once when it's back; doubling while the stand-in fails (3 minutes, 25% of the way
//    in) and every 15 s again after; none after the final;
//  - the end: ESPN's own box score, every person's every count, and its score.
// A 3-hour game takes 3 minutes at 60x; every game runs at the same time. Exits 1 on any failure.
const fs = require("fs");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const L = jiti("../../src/lib/sports/index.ts");
const { known, differences, settles } = require("./espn-replay");
const fakeEspn = require("./fake-espn");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, ...v]) => [k, v.length ? v.join("=") : true]));
const SPEED = Number(args.speed || 60);
const EVERY = Number(args.every || 15) * 1000;
const WITHIN = Number(args.within || 6) * 60_000;
const MIN = 60_000;
const FIXTURES = path.join(__dirname, "..", "..", "tests", "fixtures", "espn");
const files = args.games
  ? String(args.games).split(",").map((g) => `${g.replace(/\.json$/, "")}.json`)
  : fs.readdirSync(FIXTURES).filter((f) => f.endsWith(".json") && !f.includes("schedule"));

const iso = (t) => new Date(t).toISOString().slice(11, 19);

async function run(espn, file) {
  const summary = JSON.parse(fs.readFileSync(path.join(FIXTURES, file), "utf8"));
  const r = espn.replay(summary, { speed: SPEED });
  const sport = r.sport;
  const truth = known(sport, summary);
  const fails = [];
  const log = [];
  const asks = [];
  let visible = true;
  const hide = { from: r.first + 0.4 * (r.last - r.first), to: null };
  hide.to = hide.from + 5 * MIN;
  const down = { from: r.first + 0.25 * (r.last - r.first), to: null };
  down.to = down.from + 3 * MIN;

  let finished;
  const done = new Promise((res) => (finished = res));
  const g = new L.LiveGame({
    sport,
    league: r.league,
    event: r.event,
    base: espn.url,
    every: EVERY,
    now: () => r.at(),
    setTimer: (run, ms) => setTimeout(run, ms / SPEED),
    clearTimer: (t) => clearTimeout(t),
    visible: () => visible,
    fetch: async (url) => {
      // As it's sent: an answer can come back after the screen's hidden.
      const at = r.at();
      const hidden = !visible;
      const failing = !!r.down;
      const res = await fetch(url);
      asks.push({ at, ok: res.ok, hidden, down: failing });
      return res;
    },
    onChange: (game) => {
      const ask = asks[asks.length - 1];
      if (!ask?.ok || game.lastError) return;
      const answer = espn.answers.filter((a) => a.event === r.event).pop();
      if (!answer) return;
      const at = answer.at;
      log.push({ at, diffs: differences(game.state(L.live()), truth(at, game.final)) });
      // A later watch: 20 minutes behind, and set to the play 10 before the newest.
      const m = at - 20 * MIN;
      if (m >= r.first) {
        const late = differences(game.state(L.startAt(m, game.now())), truth(m, false));
        if (late.length) fails.push(`20 minutes behind at ${iso(m)}: ${late.slice(0, 4).join("; ")}`);
      }
      const tapped = game.plays[game.plays.length - 11];
      if (tapped && !tapped.final) {
        const t = L.playMoment(tapped);
        const seen = differences(game.state(L.setTo(L.live(), game.now(), t)), truth(t, false));
        // What a later play settles shows here too while it's unsettled: only the live comparison above judges it.
        if (seen.length && !log[log.length - 1].diffs.length) fails.push(`tapped a play at ${iso(t)}: ${seen.slice(0, 4).join("; ")}`);
      }
      if (game.done) finished();
    },
  });

  // The screen hidden, then back; the stand-in failing, then back: each at its moment of the game.
  const watch = setInterval(() => {
    const at = r.at();
    r.down = at >= down.from && at < down.to;
    const hidden = at >= hide.from && at < hide.to;
    if (hidden === visible) {
      visible = !hidden;
      g.visibilityChanged();
    }
  }, 20);
  g.start();
  await done;
  clearInterval(watch);
  // Let a stray timer show itself.
  await new Promise((res) => setTimeout(res, (3 * EVERY) / SPEED));

  // The answers against the recording.
  const { streaks, long } = settles(log, { within: WITHIN });
  for (const s of long) fails.push(`differs from ${iso(s.from)} for ${s.ms === Infinity ? "ever" : `${Math.round(s.ms / 1000)} s`}: ${s.diffs.slice(0, 4).join("; ")}`);

  // The asks.
  const startsAt = g.startsAt;
  const before = asks.filter((a) => a.at < startsAt - 1000);
  if (before.length !== 1) fails.push(`${before.length} asks before the start (want 1, the first)`);
  if (asks.some((a) => a.hidden)) fails.push(`${asks.filter((a) => a.hidden).length} asks while hidden`);
  const back = asks.find((a) => a.at >= hide.to);
  if (!back || back.at - hide.to > 5_000) fails.push(`no ask at once when the screen came back (next at ${back ? iso(back.at) : "none"})`);
  const failed = asks.filter((a) => !a.ok);
  const waits = failed.map((a) => (asks[asks.indexOf(a) + 1]?.at ?? NaN) - a.at).map((w) => Math.round(w / 1000));
  const wantWaits = failed.map((_, i) => Math.min(EVERY * 2 ** (i + 1), L.MAX_BACKOFF_MS) / 1000);
  if (!failed.length) fails.push("no ask failed while the stand-in was down");
  else if (waits.some((w, i) => Math.abs(w - wantWaits[i]) > 3)) fails.push(`backoff waits ${waits.join(", ")} s (want ${wantWaits.join(", ")})`);
  // The rhythm while it's on: each answer after an answer, apart from the hidden stretch and the backoff after the failing one.
  const gaps = [];
  asks.forEach((a, i) => {
    const prev = asks[i - 1];
    if (!prev || !a.ok || !prev.ok || prev.at < r.first || a.at > r.last) return;
    if (prev.at < hide.to && a.at >= hide.from) return;
    gaps.push(a.at - prev.at);
  });
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)] ?? NaN;
  const slow = gaps.filter((x) => x > EVERY * 1.1 + 5_000);
  if (!(median >= EVERY * 0.9 && median <= EVERY * 1.1 + 2_000)) fails.push(`asks every ${Math.round(median / 1000)} s while on (want ~${EVERY / 1000})`);
  if (slow.length > gaps.length * 0.02) fails.push(`${slow.length} of ${gaps.length} gaps over ${(EVERY * 1.1) / 1000 + 5} s while on`);
  const after = asks.filter((a) => a.at > (espn.answers.filter((x) => x.event === r.event).find((x) => x.at >= r.end)?.at ?? Infinity));
  if (after.length) fails.push(`${after.length} asks after the final`);
  if (!g.done || !g.final) fails.push(`not final at the end (${g.status})`);

  // The end: ESPN's own box score.
  const box = sport.readBox(summary);
  const end = g.state(L.ended());
  let numbers = 0;
  for (const [id, p] of Object.entries(box.people)) {
    for (const [k, v] of Object.entries(p.stats)) {
      numbers++;
      if ((end.lines[id]?.[k] ?? 0) !== v) fails.push(`the end: ${p.name} ${k} ${end.lines[id]?.[k] ?? 0}, ESPN ${v}`);
    }
  }
  for (const t of box.teams) if (end.score[t.id] !== t.score) fails.push(`the end: ${t.abbreviation} ${end.score[t.id]}, ESPN ${t.score}`);

  return { file, summary, asks, log, streaks, fails, numbers, median, plays: g.plays.length };
}

(async () => {
  const espn = await fakeEspn.start();
  const t0 = Date.now();
  console.log(`Replaying ${files.length} recorded games at ${SPEED}x, asked every ${EVERY / 1000} s of game time...`);
  const results = await Promise.all(files.map((f) => run(espn, f)));
  await espn.close();
  let bad = 0;
  for (const r of results) {
    const name = r.summary._recorded.note ?? r.file;
    console.log(`${r.fails.length ? "FAIL" : "OK  "}  ${r.file}  ${name.slice(0, 70)}`);
    console.log(`        ${r.asks.length} asks (${r.asks.filter((a) => !a.ok).length} failed), ${r.log.length} answers, every ${Math.round(r.median / 100) / 10} s while on; the end: ${r.plays} plays, ${r.numbers} numbers of ESPN's box score`);
    for (const s of r.streaks) console.log(`        settled by a later play after ${Math.round(s.ms / 1000)} s (from ${iso(s.from)}): ${s.diffs.slice(0, 4).join("; ")}`);
    for (const f of r.fails) console.log(`        ${f}`);
    if (r.fails.length) bad++;
  }
  console.log(`\n${results.length - bad} of ${results.length} games pass (${Math.round((Date.now() - t0) / 1000)} s).`);
  process.exit(bad ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
