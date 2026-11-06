// Dev-only check of the phone's poller for a field's, a draw's or a card's event (src/lib/sports/live-event.ts;
// docs/PLAN-start-a-game-gpt.md track L, L2 part 2) on the real live recordings record-espn-live.js made (the OS temp folder's
// rfl-espn-live/<league>-<event>/): each recording replayed in virtual time, a stand-in fetch answering each ask with the
// recording's answers as of then, the poller asking on its own rhythm (every 30 s while a match, a session or a bout is on,
// every minute while a round is; until the next start between) and its feed's later rounds (racing's and MMA's core API calls).
// No app server, no database, no ESPN.
//
//   node scripts/dev-test/check-live-event.js                                          every tennis, golf, racing and MMA recording there
//   node scripts/dev-test/check-live-event.js --league=tennis/atp --event=23-2026 [--verbose]
//   node scripts/dev-test/check-live-event.js --league=racing/nascar-premier --event=202611010020
//
// The stand-in answers each call with the recording's answers as of the ask: a board, leaderboard or FightCenter with the last
// one recorded by then; a core call (racing's session list, a driver's statistics or status; a card's rounds, a bout's plays, a
// fighter's statistics) with the last recorded answer that had it, else a 503 (not recorded yet: asked again). The recorder asked
// a bout's statistics at its end and at the card's final only, so a fighter's are the final's once the FightCenter's totals are
// the final's (the core's are the FightCenter's once final; the one bout asked between, 401921310, had both at once).
//
// For each recording it asserts:
//  - every play's moment is a phone's first sight of it as it is: never before the first recorded answer that had it so (or the
//    reader's own moment in it, where ESPN times it: a bout's plays, a session's start for its grid), and no later than the
//    poller's second ask after it;
//  - no play moved on by a later poll as it is, and no result re-stamped at all (by its id: a result whose numbers change would
//    count from the change);
//  - the end: the poller's event at the end is the recording's last answer's (each session's or bout's core as last asked),
//    every line;
//  - the asks: none after the poller's done; how many came on the rhythm is said, and each kind of call's count and size;
//  - the points (L3 part 3: src/lib/sports/points.ts livePoints, at the sport's default season table): each ask's, live from the
//    poller's state then, never failing; at the end, the final kept from the recording's last answer (final.ts storedField,
//    storedCard: what the server keeps) replacing them once the poller has the final, nobody's points changed by it.
// Recorded answers are each read whole, as a phone would have them (each session's or bout's core as last asked). Exits 1 on
// any failure. Golf's 600-answer recording and the UFC's 690 take a few minutes each.
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const L = jiti("../../src/lib/sports/index.ts");
const { virtual } = require("../../tests/harness/virtual-time");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, ...v]) => [k, v.length ? v.join("=") : true]));
const ROOT = path.join(os.tmpdir(), "rfl-espn-live");

/** The recordings to replay: --league and --event, else every tennis, golf, racing and MMA one there. A racing series' name has a
 *  dash ("racing-nascar-premier-<event>"), a tennis event's id too ("tennis-atp-23-2026"). */
function recordings() {
  if (args.league && args.event) return [{ league: args.league, event: args.event, dir: path.join(ROOT, `${args.league.replace("/", "-")}-${args.event}`) }];
  if (!fs.existsSync(ROOT)) return [];
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^(tennis|golf|racing|mma)-/.test(d.name))
    .map((d) => {
      const [sport, ...rest] = d.name.split("-");
      const [tour, event] = sport === "racing" ? [rest.slice(0, -1).join("-"), rest[rest.length - 1]] : [rest[0], rest.slice(1).join("-")];
      return { league: `${sport}/${tour}`, event, dir: path.join(ROOT, d.name) };
    });
}

const iso = (t) => new Date(t).toISOString();
/** A play as the poller knows it: its id and content (live-event.ts's contentOf). */
const keyOf = (p) => `${p.id}\u0000${L.contentOf(p)}`;

/** The feed for a league, and which of its plays are its results. */
function feedOf(league, sport) {
  const kind = league.split("/")[0];
  if (kind === "tennis") return { feed: L.drawFeed(sport), result: (p) => p.kind === "result", word: "results" };
  if (kind === "golf") return { feed: L.golfFeed(sport), result: (p) => p.hole != null, word: "holes" };
  if (kind === "racing") return { feed: L.raceFeed(sport), result: (p) => p.kind.endsWith("-result"), word: "results" };
  return { feed: L.cardFeed(sport), result: (p) => p.kind === "result", word: "results" };
}

/** The recorded answers as a phone would have them: each session's or bout's core as last asked, its statistics from the last
 *  ask that had them (record-espn-live.js's --compare does the same). */
function carry(raws) {
  const carried = {};
  return raws.map((a) => {
    if (!a.core) return a;
    for (const [id, x] of Object.entries(a.core)) {
      const prev = carried[id];
      const keep = (c) => {
        const was = prev?.competitors?.find((y) => String(y.id) === String(c.id));
        return { ...(was ?? {}), ...c, ...(c.statistics || !was?.statistics ? {} : { statistics: was.statistics }), ...(c.status || !was?.status ? {} : { status: was.status }) };
      };
      carried[id] = { ...x, competitors: (x.competitors ?? []).map(keep) };
    }
    return { ...a, core: { ...carried } };
  });
}

/** The stand-in for a recording: each call answered with the recording's answers as of `now` (the header's). */
function standIn(raws, times, calls) {
  const last = raws[raws.length - 1];
  const lastCenter = (bout, id) => L.mmaCenterStats(Object.values(last.fightcenter?.cards ?? {}).flatMap((s) => s.competitions ?? []).find((c) => String(c.id) === bout)?.competitors?.find((x) => String(x.id) === id));
  const ok = (kind, body) => {
    if (body == null) return none(kind, 404);
    calls[kind] = calls[kind] ?? { n: 0, bytes: 0 };
    calls[kind].n++;
    calls[kind].bytes += JSON.stringify(body).length;
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) };
  };
  const none = (kind, status = 503) => {
    const k = `${kind} (${status === 404 ? "none" : "not recorded yet"})`;
    calls[k] = calls[k] ?? { n: 0, bytes: 0 };
    calls[k].n++;
    return { ok: false, status, json: async () => ({}) };
  };
  return (now) => async (url) => {
    let i = 0;
    while (i + 1 < raws.length && times[i + 1] <= now) i++;
    const a = raws[i];
    /** What `pick` gives of the last recorded answer by now that has it. */
    const latest = (_, pick) => {
      for (let j = i; j >= 0; j--) {
        const x = pick(raws[j]);
        if (x != null) return x;
      }
      return undefined;
    };
    if (url.includes("/fightcenter/")) return ok("fightcenter", a.fightcenter);
    if (url.includes("/golf/leaderboard")) return ok("leaderboard", a.leaderboard);
    if (url.includes("/scoreboard/")) return ok("board", a.board);
    let m = /\/racing\/leagues\/[^/]+\/events\/[^/]+\/competitions\/([^/]+)\/competitors(?:\/([^/?]+)\/(statistics|status))?/.exec(url);
    if (m) {
      const [, sid, who, what] = m;
      if (!who) {
        const cs = latest(now, (r) => r.core?.[sid]?.competitors);
        return cs ? ok("list", { items: cs.map((c) => ({ ...c, statistics: undefined, status: undefined })) }) : none("list");
      }
      const x = latest(now, (r) => (what === "statistics" && !r.core?.[sid]?._full ? undefined : r.core?.[sid]?.competitors?.find((c) => String(c.id) === who)?.[what]));
      return x ? ok(what, x) : none(what);
    }
    m = /\/mma\/leagues\/[^/]+\/events\/[^/?]+(?:\/competitions\/([^/]+)\/(plays|competitors\/([^/]+)\/statistics))?/.exec(url);
    if (m) {
      const [, bout, what, who] = m;
      if (!bout) {
        const ev = latest(now, (r) => r.event);
        return ev ? ok("event", ev) : none("event");
      }
      if (what === "plays") {
        const ps = latest(now, (r) => r.core?.[bout]?.plays);
        return ps ? ok("plays", { items: ps }) : none("plays");
      }
      // A fighter's statistics: the final's once the FightCenter's totals are (the header's).
      const center = L.mmaCenterStats(Object.values(a.fightcenter?.cards ?? {}).flatMap((s) => s.competitions ?? []).find((c) => String(c.id) === bout)?.competitors?.find((x) => String(x.id) === who));
      const fin = last.core?.[bout]?.competitors?.find((c) => String(c.id) === who)?.statistics;
      if (fin && center && JSON.stringify(center) === JSON.stringify(lastCenter(bout, who))) return ok("statistics", fin);
      const x = latest(now, (r) => r.core?.[bout]?.competitors?.find((c) => String(c.id) === who)?.statistics);
      return x ? ok("statistics", x) : none("statistics");
    }
    throw new Error(`the stand-in has nothing for ${url}`);
  };
}

async function check({ league, event, dir }) {
  const sport = L.sportOf(league);
  const { feed, result, word } = feedOf(league, sport);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json.gz")).sort();
  if (!files.length) return { league, event, ok: false, lines: ["no answers recorded"] };
  const raws = files.map((f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString("utf8")));
  const answers = carry(raws);
  const times = raws.map((a) => Date.parse(a._asked));
  // Each play's first recorded answer with it as it is, and its moment there, read as the reader reads each one.
  const firstRecorded = new Map();
  answers.forEach((a, i) => {
    for (const p of feed.timeline(a)) if (!firstRecorded.has(keyOf(p))) firstRecorded.set(keyOf(p), { t: times[i], at: Date.parse(p.at) });
  });
  const vt = virtual(times[0]);
  const asked = [];
  const calls = {};
  const answer = standIn(raws, times, calls);
  const board = Object.values(feed.paths(league, event))[0];
  const fetch = async (url) => {
    // An ask is its first round's board.
    if (url.endsWith(board) && asked[asked.length - 1] !== vt.now()) asked.push(vt.now());
    return answer(vt.now())(url);
  };
  const live = new L.LiveEvent({ feed, league, event, fetch, now: vt.now, setTimer: vt.setTimer, clearTimer: vt.clearTimer, random: () => 0.5 });
  // Each ask's points, live (L3 part 3), at the sport's default season table.
  const score = L.defaultsFor(sport.id, league).specs.season.spec.score;
  const scored = { asks: 0, failed: [] };
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
    if (!live.shape) return;
    try {
      const p = L.livePoints(sport, score, { live: live.stateAt(vt.now()), card: live.shape });
      if (p.from === "live") scored.asks++;
    } catch (e) {
      scored.failed.push(`${iso(vt.now())}: ${e.message}`);
    }
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
  // Every play's moment: its first recorded answer's (or the reader's own there, if earlier), to the poller's second ask after it.
  const early = [];
  const late = [];
  let results = 0;
  for (const p of live.plays.filter((x) => !x.final)) {
    const rec = firstRecorded.get(keyOf(p));
    const at = Date.parse(p.at);
    if (rec == null) continue;
    // On already at the first answer: the poller's first ask is its first sight.
    if (rec.t === times[0]) continue;
    if (result(p)) results++;
    const k = asked.findIndex((t) => t >= rec.t);
    const by = k < 0 ? Infinity : asked[k + 1] ?? Infinity;
    if (at < Math.min(rec.t, Number.isFinite(rec.at) ? rec.at : rec.t)) early.push(`${p.id} (${p.kind}) at ${p.at}, first recorded ${iso(rec.t)}`);
    else if (at > by) late.push(`${p.id} (${p.kind}) at ${p.at}, first recorded ${iso(rec.t)}`);
  }
  // The end: the poller's event at the end against the recording's last answer read whole.
  const lastAnswer = answers[answers.length - 1];
  const want = feed.reduce(feed.timeline(lastAnswer), null, feed.eventOf(lastAnswer));
  const got = live.stateAt(null);
  const people = new Set([...Object.keys(want.lines), ...Object.keys(got?.lines ?? {})]);
  const same = (x, y) => JSON.stringify(Object.entries(x ?? {}).sort()) === JSON.stringify(Object.entries(y ?? {}).sort());
  const off = [...people].filter((id) => !same(want.lines[id], got?.lines?.[id]));
  // The points at the end: the final kept from the recording's last answer, replacing the poller's (nobody's changed: its end is
  // that answer's), once the poller has the final.
  const kept = sport instanceof L.FieldSport ? L.storedField(sport, lastAnswer) : L.storedCard(sport, lastAnswer);
  const atEnd = L.livePoints(sport, score, { live: got, saved: kept, card: live.shape });
  const finalNow = L.atFinal(got) && !!kept?.final;
  const pointsOk = !scored.failed.length && (finalNow ? atEnd.from === "final" && !Object.keys(atEnd.corrections).length : atEnd.from === "live");
  // The asks while on: their gaps.
  const gaps = asked.slice(1).map((t, i) => t - asked[i]).filter((g) => g <= feed.every * 1.2);
  const ok = !early.length && !late.length && !moved.length && !off.length && !after && pointsOk;
  lines.push(`${answers.length} answers recorded (${answers[0]._asked} to ${answers[answers.length - 1]._asked}); ${asked.length} asks, ${gaps.length} on the rhythm (${feed.every / 1000} s); ${live.plays.length} plays, ${results} ${word} seen after the first answer; status ${live.status}${live.next ? `, next ${iso(live.next)}` : ""}`);
  lines.push(`  calls: ${Object.entries(calls).map(([k, v]) => `${k} ${v.n} (${Math.round(v.bytes / 1024)} KB unpacked)`).join("; ")}`);
  lines.push(`  moments: ${early.length} before their first recorded answer, ${late.length} later than the poller's second ask after it, ${moved.length} moved on by a later poll; ${after} asks after it was done${doneAt != null ? ` (${iso(doneAt)})` : ""}`);
  lines.push(`  the end: ${people.size - off.length} of ${people.size} lines the recording's last answer's`);
  const top = Object.entries(atEnd.points).sort((a, b) => b[1].points - a[1].points)[0];
  lines.push(`  points: ${scored.asks} asks scored live, ${scored.failed.length} failed; at the end ${Object.keys(atEnd.points).length} scored, from the ${atEnd.from === "final" ? "kept final" : "poller (not final yet)"}, ${Object.keys(atEnd.corrections).length} changed by it${top ? `; the most ${top[1].points} (${top[0]})` : ""}`);
  const list = (xs) => xs.slice(0, args.verbose ? 50 : 5).map((x) => `    ${x}`);
  lines.push(...list(scored.failed), ...list(Object.entries(atEnd.corrections).map(([id, d]) => `${id}: ${d} at the final`)));
  lines.push(...list(early), ...list(late), ...list(moved), ...list(off.map((id) => `${id}: ${JSON.stringify(got?.lines?.[id] ?? {})}, the recording's ${JSON.stringify(want.lines[id] ?? {})}`)));
  return { league, event, ok, lines };
}

(async () => {
  const all = recordings();
  if (!all.length) {
    console.error(`No tennis, golf, racing or MMA recording in ${ROOT} (record one with record-espn-live.js).`);
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
