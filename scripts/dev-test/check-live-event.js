// Dev-only check of the phone's poller for a field's or a draw's event (src/lib/sports/live-event.ts; docs/PLAN-start-a-game-gpt.md
// track L, L2 part 2) on the real live recordings record-espn-live.js made (the OS temp folder's rfl-espn-live/<league>-<event>/):
// each recording replayed in virtual time, a stand-in fetch answering each ask with the recording's answer as of then, the
// poller asking on its own rhythm (every 30 s while a match is on, every minute while a round is; until the next start
// between). No app server, no database, no ESPN.
//
//   node scripts/dev-test/check-live-event.js                                          every draw and golf recording there
//   node scripts/dev-test/check-live-event.js --league=tennis/atp --event=23-2026 [--verbose]
//
// For each recording it asserts:
//  - every play's moment is a phone's first sight of it as it is: never before the first recorded answer that had it so, and
//    no later than two asks after it (the poller asks on its own rhythm, the recording on the recorder's);
//  - no play moved on by a later poll as it is, and no match's result re-stamped at all (by its id: a result whose numbers change
//    would count from the change);
//  - the end: the poller's event at the end is the recording's last answer's, every line;
//  - the asks: none after the poller's done (every match or round over); how many came on the rhythm (30 s for a draw, a minute
//    for golf) is said.
// Exits 1 on any failure. Golf's 600-answer recording takes a few minutes (each answer read whole).
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const L = jiti("../../src/lib/sports/index.ts");
const { virtual } = require("../../tests/harness/virtual-time");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, ...v]) => [k, v.length ? v.join("=") : true]));
const ROOT = path.join(os.tmpdir(), "rfl-espn-live");

/** The recordings to replay: --league and --event, else every tennis and golf one there. */
function recordings() {
  if (args.league && args.event) return [{ league: args.league, event: args.event, dir: path.join(ROOT, `${args.league.replace("/", "-")}-${args.event}`) }];
  if (!fs.existsSync(ROOT)) return [];
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^(tennis|golf)-/.test(d.name))
    .map((d) => {
      const [sport, tour, ...rest] = d.name.split("-");
      return { league: `${sport}/${tour}`, event: rest.join("-"), dir: path.join(ROOT, d.name) };
    });
}

const iso = (t) => new Date(t).toISOString();
/** A play as the poller knows it: its id and content (live-event.ts's contentOf). */
const keyOf = (p) => `${p.id}\u0000${L.contentOf(p)}`;

async function check({ league, event, dir }) {
  const sport = L.sportOf(league);
  const draw = league.startsWith("tennis/");
  const feed = draw ? L.drawFeed(sport) : L.golfFeed(sport);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json.gz")).sort();
  if (!files.length) return { league, event, ok: false, lines: ["no answers recorded"] };
  const answers = files.map((f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString("utf8")));
  const times = answers.map((a) => Date.parse(a._asked));
  // Each play's first recorded answer with it as it is, read as the reader reads each one.
  const firstRecorded = new Map();
  answers.forEach((a, i) => {
    for (const p of feed.timeline(a)) if (!firstRecorded.has(keyOf(p))) firstRecorded.set(keyOf(p), times[i]);
  });
  // The stand-in: the recording's answer as of the ask (the last one had by then; before the first, the first).
  const vt = virtual(times[0]);
  const asked = [];
  const fetch = async (url) => {
    // An ask's calls go out together: one ask a moment.
    if (asked[asked.length - 1] !== vt.now()) asked.push(vt.now());
    let i = 0;
    while (i + 1 < answers.length && times[i + 1] <= vt.now()) i++;
    const a = answers[i];
    const body = draw ? a.board : url.includes("/leaderboard") ? a.leaderboard : a.board;
    return { ok: true, status: 200, json: async () => body };
  };
  const live = new L.LiveEvent({ feed, league, event, fetch, now: vt.now, setTimer: vt.setTimer, clearTimer: vt.clearTimer, random: () => 0.5 });
  const end = times[times.length - 1];
  // Each play's moment as the poller had it after each ask: a later poll must never move a play on as it is, nor a result at all.
  const pollerAt = new Map();
  const resultAt = new Map();
  const moved = [];
  let doneAt = null;
  const take = () => {
    for (const p of live.plays) {
      const k = keyOf(p);
      const had = pollerAt.get(k);
      if (had != null && had !== p.at) moved.push(`${p.id}: ${had} then ${p.at}`);
      pollerAt.set(k, p.at);
      if (p.kind === "result") {
        const was = resultAt.get(p.id);
        if (was != null && was !== p.at) moved.push(`${p.id} (its result re-stamped): ${was} then ${p.at}`);
        resultAt.set(p.id, p.at);
      }
    }
    if (live.done && doneAt == null) doneAt = vt.now();
  };
  live.start();
  await vt.settle();
  take();
  while (vt.timers.length && vt.timers.reduce((m, t) => Math.min(m, t.at), Infinity) <= end + 60 * 60_000) {
    await vt.advance();
    take();
  }
  live.stop();
  const after = doneAt == null ? 0 : asked.filter((t) => t > doneAt).length;
  const lines = [];
  // Every play's moment: its first recorded answer's, to two asks after it.
  const slack = 2 * feed.every * 1.1;
  const early = [];
  const late = [];
  let results = 0;
  for (const p of live.plays.filter((x) => !x.final)) {
    const rec = firstRecorded.get(keyOf(p));
    const at = Date.parse(p.at);
    if (rec == null) continue;
    // On already at the first answer: the poller's first ask is its first sight.
    if (rec === times[0]) continue;
    if (draw ? p.kind === "result" : p.hole != null) results++;
    if (at < rec) early.push(`${p.id} (${p.kind}) at ${p.at}, first recorded ${iso(rec)}`);
    else if (at > rec + slack) late.push(`${p.id} (${p.kind}) at ${p.at}, first recorded ${iso(rec)}`);
  }
  // The end: the poller's event at the end against the recording's last answer read whole.
  const want = draw ? sport.reduce(sport.timeline(answers[answers.length - 1]), null, sport.card(answers[answers.length - 1])) : sport.reduce(sport.timeline(answers[answers.length - 1]), null, sport.fieldEvent(answers[answers.length - 1]));
  const got = live.stateAt(null);
  const people = new Set([...Object.keys(want.lines), ...Object.keys(got?.lines ?? {})]);
  const same = (x, y) => JSON.stringify(Object.entries(x ?? {}).sort()) === JSON.stringify(Object.entries(y ?? {}).sort());
  const off = [...people].filter((id) => !same(want.lines[id], got?.lines?.[id]));
  // The asks while on: their gaps.
  const gaps = asked.slice(1).map((t, i) => t - asked[i]).filter((g) => g <= feed.every * 1.2);
  const ok = !early.length && !late.length && !moved.length && !off.length && !after;
  lines.push(
    `${answers.length} answers recorded (${answers[0]._asked} to ${answers[answers.length - 1]._asked}); ${asked.length} asks, ${gaps.length} on the rhythm (${feed.every / 1000} s); ${live.plays.length} plays, ${results} ${draw ? "results" : "holes"} seen after the first answer; status ${live.status}`,
  );
  lines.push(`  moments: ${early.length} before their first recorded answer, ${late.length} more than two asks after it, ${moved.length} moved on by a later poll; ${after} asks after it was done${doneAt != null ? ` (${iso(doneAt)})` : ""}`);
  lines.push(`  the end: ${people.size - off.length} of ${people.size} lines the recording's last answer's`);
  const list = (xs) => xs.slice(0, args.verbose ? 50 : 5).map((x) => `    ${x}`);
  lines.push(...list(early), ...list(late), ...list(moved), ...list(off.map((id) => `${id}: ${JSON.stringify(got?.lines?.[id] ?? {})}, the recording's ${JSON.stringify(want.lines[id] ?? {})}`)));
  return { league, event, ok, lines };
}

(async () => {
  const all = recordings();
  if (!all.length) {
    console.error(`No tennis or golf recording in ${ROOT} (record one with record-espn-live.js).`);
    process.exit(1);
  }
  let failed = 0;
  for (const r of all) {
    const out = await check(r);
    if (!out.ok) failed++;
    console.log(`${out.ok ? "OK  " : "FAIL"}  ${r.league} ${r.event}: ${out.lines.join("\n")}`);
  }
  console.log(`\n${all.length - failed} of ${all.length} recordings pass.`);
  process.exit(failed ? 1 : 0);
})();
