// Dev-only check of the field sports' readers and standings (src/lib/sports/: FieldSport, Golf, Racing;
// docs/PLAN-start-a-game-gpt.md track L, L5 part 3) against the REAL ESPN, on as many finished events as asked:
// check-sport-reduce.js's sibling for a field. For each golf event, ESPN's answers (its board and its leaderboard, asked
// together) and:
//  - each competitor's plays (golf's holes, or rounds where the tour's board has none), added up, against ESPN's own numbers:
//    strokes and score to par, round by round and in all; the front and back nines (ESPN's outScore, inScore); the kinds of
//    holes where ESPN's board counts them (birdies, bogeys, double bogeys, eagles, pars); a withdrawal, a disqualification, a
//    playoff's holes and strokes;
//  - the standings from the plays alone (no final's correction) against ESPN's final places (the place, tied or not, and who's
//    cut, withdrew or was disqualified), and after each round against ESPN's place after it (`currentPosition`);
//  - the timeline (the plays and the final's correction) against every number ESPN gives, earnings and season points too.
// For each race weekend (racing/f1, racing/nascar-premier, racing/nascar-secondary, racing/nascar-truck, racing/irl), its board
// and its scored sessions' core answers (racing.ts: every session but practice, whose place the board has; each driver's
// statistics a call, F1's status a call), and:
//  - each driver's plays, added up, against ESPN's own numbers, session by session and in all (the place, the grid as ESPN's
//    `pole` statistic, laps, laps led, pit stops, the fastest lap, F1's statuses, bonus and penalty points) and the event's
//    championship points (F1's race number is the weekend's: the plays have the sprint's and the race's apart);
//  - the standings from the plays alone against ESPN's order (the disqualified and whoever didn't qualify out);
//  - ESPN's own, listed apart (they don't fail an event): its wins, top 5 and top 10 against the standings' (all 0 in some
//    races), and NASCAR's and IndyCar's laps led against the race's laps;
//  - F1's points from 2025 (no fastest-lap point): the race's less the sprint's against its table by place, the sprint's
//    against the sprint's table (failing an event: the split would be wrong);
//  - with --standings (a whole season: --season, no --max or --events), each driver's championship points over the season's
//    events, less their penalty points, against ESPN's season standings (`site.web.api.espn.com/apis/v2/sports/racing/<series>/standings?season=`; F1's
//    event by event too; NASCAR's are reset for its playoffs, so its totals are only told).
// Real calls, no app server, no database, nothing written but its cache.
//
//   node scripts/dev-test/check-field-reduce.js --league=golf/pga [--season=2026] [--max=60] [--verbose]
//   node scripts/dev-test/check-field-reduce.js --league=golf/pga --events=401811941,401850917
//   (golf/lpga, golf/eur, golf/liv, golf/champions-tour, golf/ntw ...) [--cache=<dir>]
//   node scripts/dev-test/check-field-reduce.js --league=racing/f1 --season=2025 [--standings] [--verbose]
//
// Without --events, the tour's finished events of the season (its board's calendar: one uncached call), at most --max; an event
// called off (STATUS_CANCELED) or played as match play (the Presidents Cup) is listed apart. --cache keeps each finished answer as
// a file (default: rfl-espn-cache in the OS temp folder, shared with check-sport-reduce.js and record-espn.js), so running it again
// asks ESPN nothing (racing's: racing-<series>-board-<event>.json and racing-<series>-core-<event>-<session>.json, the session's
// competitors with each one's statistics and status in place of ESPN's links). Prints each event OK or its differences (the
// reader's notes under --verbose), then a total; exits 1 on any difference.
const fs = require("fs");
const os = require("os");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { sportOf, FieldSport, boardCounts, fieldEventOf, coreStats } = jiti("../../src/lib/sports/index.ts");
const { cachedRaceCore } = require("./espn-race-core");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, ...v]) => [k, v.length ? v.join("=") : true]));
const league = args.league || "golf/pga";
const sport = sportOf(league);
if (!(sport instanceof FieldSport)) {
  console.error(`${league} isn't a field sport built yet (team sports: check-sport-reduce.js; a card of bouts: check-bout-reduce.js).`);
  process.exit(2);
}
const [slug, tour] = league.split("/");
const cacheDir = args.cache || path.join(os.tmpdir(), "rfl-espn-cache");
fs.mkdirSync(cacheDir, { recursive: true });
const SITE = "https://site.api.espn.com/apis/site/v2/sports";

/** ESPN's answer, from the cache when it's there; kept only when `done` says it won't change. */
async function get(url, file, done) {
  const at = file ? path.join(cacheDir, file) : null;
  if (at && fs.existsSync(at)) return JSON.parse(fs.readFileSync(at, "utf8"));
  const res = await fetch(url, { headers: { "User-Agent": "GameYourShow/1.0" } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  const json = await res.json();
  if (at && done(json)) fs.writeFileSync(at, JSON.stringify(json));
  return json;
}
/** An event over for good: final, or called off (it won't change either way). */
const over = (e) => e?.status?.type?.state === "post";

/** What racing's core calls cost (espn-race-core.js counts them). */
const wire = { calls: 0, bytes: 0, raw: 0 };
/** ESPN's answer, or null for one it refuses. */
async function ask(url) {
  wire.calls++;
  const res = await fetch(url, { headers: { "User-Agent": "GameYourShow/1.0" } });
  return res.ok ? res.json() : null;
}

/** ESPN's answers for an event: golf's board and leaderboard (the cache's names: golf-<tour>-board-<id>, -leaderboard-<id>);
 *  racing's board and each scored session's core (racing-<series>-board-<id>, -core-<id>-<session>). */
async function answer(id) {
  if (slug === "golf") {
    const board = await get(`${SITE}/${league}/scoreboard/${id}`, `golf-${tour}-board-${id}.json`, over);
    const leaderboard = await get(`${SITE}/golf/leaderboard?event=${id}`, `golf-${tour}-leaderboard-${id}.json`, (j) => over(fieldEventOf({ leaderboard: j }, "leaderboard")));
    return { board, leaderboard };
  }
  if (slug === "racing") {
    const board = await get(`${SITE}/${league}/scoreboard/${id}`, `racing-${tour}-board-${id}.json`, over);
    const core = {};
    for (const c of board.competitions ?? []) {
      if (/^FP/.test(c.type?.abbreviation ?? "") || !(c.competitors ?? []).length) continue;
      core[String(c.id)] = await cachedRaceCore(cacheDir, { series: tour, event: id, session: String(c.id), done: c.status?.type?.state === "post", wire });
    }
    return { board, core };
  }
  throw new Error(`no answers for ${slug} yet`);
}

async function events() {
  if (args.events) return String(args.events).split(",").filter(Boolean);
  const board = await get(`${SITE}/${league}/scoreboard${args.season ? `?dates=${args.season}` : ""}`, null, () => false);
  const now = Date.now();
  const cal = board.leagues?.[0]?.calendar ?? [];
  return cal
    .filter((c) => Date.parse(c.endDate) + 2 * 86400000 < now)
    .map((c) => String(c.id ?? /events\/(\d+)/.exec(c.event?.$ref ?? "")?.[1] ?? ""))
    .filter(Boolean)
    .slice(-Number(args.max || 60));
}

const fmt = (s) => (s.place == null ? `${s.status}` : `${s.tied ? "T" : ""}${s.place}`);

/** F1's points tables from 2025 (no fastest-lap point): the race's 1st to 10th, the sprint's 1st to 8th. */
const F1_RACE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const F1_SPRINT = [8, 7, 6, 5, 4, 3, 2, 1];

/** A race weekend's differences (racing.ts): see the header. */
function racingDifferences(ans) {
  const box = sport.readBox(ans);
  const ev = sport.fieldEvent(ans);
  const notes = [];
  const plays = sport.readPlays(ans, notes);
  const out = [];
  const apart = [];
  const numbers = { all: 0, same: 0, apart: 0 };
  const same = (ok, msg, why) => {
    numbers.all++;
    if (ok) numbers.same++;
    else if (why) (numbers.apart++, apart.push(`${why}: ${msg}`));
    else out.push(msg);
  };
  if (!box) return { out: ["no board"], apart, notes, plays, numbers };
  const state = sport.reduce(plays, null, ev);
  for (const [id, p] of Object.entries(box.people)) {
    const have = state.lines[id] ?? {};
    for (const [k, v] of Object.entries(p.stats)) if (!sport.placeKeys.includes(k)) same(Math.abs((have[k] ?? 0) - v) < 1e-9, `${p.name} ${k}: ESPN ${v}, plays ${have[k] ?? 0}`);
    for (const [r, s] of Object.entries(p.parts)) for (const [k, v] of Object.entries(s)) same((state.parts[id]?.[r]?.[k] ?? 0) === v, `${p.name} session ${r} ${k}: ESPN ${v}, plays ${state.parts[id]?.[r]?.[k] ?? 0}`);
    // ESPN's wins, top 5 and 10 (0 for everyone in some races) against the standings'.
    for (const k of ["W", "TOP5", "TOP10"]) same((have[k] ?? 0) === (p.stats[k] ?? 0), `${p.name} ${k}: ESPN ${p.stats[k] ?? 0}, the standings ${have[k] ?? 0}`, "ESPN's wins, top 5 and 10 not the order's");
  }
  for (const id of Object.keys(state.lines)) if (!box.people[id]) out.push(`the plays credit ${id}, who isn't on ESPN's board`);
  const mine = new Map(state.standings.map((s) => [s.id, s]));
  for (const s of box.standings) {
    const m = mine.get(s.id);
    same(m && m.place === s.place && m.tied === s.tied && m.status === s.status, `${box.people[s.id].name}: ESPN ${fmt(s)}, plays ${m ? fmt(m) : "none"}`);
  }
  if (state.standings.length !== box.standings.length) out.push(`the standings list ${state.standings.length}, ESPN's ${box.standings.length}`);
  const board = fieldEventOf(ans, "board");
  const year = Number(String(board?.date ?? "").slice(0, 4));
  for (const c of board?.competitions ?? []) {
    const abbr = c.type?.abbreviation ?? "Race";
    const core = ans.core?.[String(c.id)]?.competitors ?? [];
    if (!core.length || !["Race", "SR"].includes(abbr)) continue;
    // NASCAR's and IndyCar's laps led add up to the race's laps (F1's lapsLead isn't laps).
    if (tour !== "f1") {
      const led = core.reduce((a, x) => a + (coreStats(x).lapsLead ?? 0), 0);
      same(led === c.status?.period, `${abbr}: laps led add up to ${led}, the race ran ${c.status?.period}`, "ESPN's laps led not the race's laps");
      // Whoever ESPN lists without a place didn't qualify (the reader reads nothing else of theirs), but some have laps.
      for (const x of core) if (x.order == null && (coreStats(x).lapsCompleted ?? 0) > 0) same(false, `${box.people[String(x.id)]?.name}: ${coreStats(x).lapsCompleted} laps, no place`, "ESPN's laps for one it gives no place");
    }
    // F1's points by its tables, the race's own (the weekend's less the sprint's) from the plays.
    if (tour === "f1" && year >= 2025) {
      const period = plays.find((p) => p.session === abbr)?.period;
      for (const x of core) {
        const id = String(x.id);
        const dq = x.status?.type?.name === "STATUS_DISQUALIFIED";
        const want = dq ? 0 : (abbr === "SR" ? F1_SPRINT : F1_RACE)[(x.order ?? 99) - 1] ?? 0;
        const got = state.parts[id]?.[period]?.CHPTS ?? 0;
        same(got === want, `${box.people[id]?.name} ${abbr === "SR" ? "sprint" : "race"} ${x.order}${dq ? " (disqualified)" : ""}: points ${got}, F1's table ${want}`);
      }
    }
  }
  const end = sport.reduce(sport.timeline(ans), null, ev);
  for (const [id, p] of Object.entries(box.people)) {
    for (const [k, v] of Object.entries(p.stats)) if (!sport.placeKeys.includes(k) && Math.abs((end.lines[id]?.[k] ?? 0) - v) > 1e-9) out.push(`timeline: ${p.name} ${k}: ESPN ${v}, ${end.lines[id]?.[k] ?? 0}`);
  }
  if (box.final && JSON.stringify(end.standings) !== JSON.stringify(box.standings)) out.push("timeline: the standings aren't ESPN's");
  return { out, apart, notes, plays, numbers, points: Object.fromEntries(Object.entries(end.lines).map(([id, l]) => [id, (l.CHPTS ?? 0) - (l.PEN ?? 0)])) };
}

/** Each driver's championship points over the season's events, less their penalty points (ESPN's are before them: IndyCar's
 *  season is their sum less its penalties), against ESPN's season standings (F1's event by event too). */
async function seasonStandings(byEvent) {
  const st = await ask(`https://site.web.api.espn.com/apis/v2/sports/racing/${tour}/standings?season=${args.season}`);
  const drivers = (st?.children ?? []).find((c) => /driver/i.test(c.name ?? "")) ?? st?.children?.[0];
  const rows = drivers?.standings?.entries ?? [];
  let total = 0;
  let totalSame = 0;
  let cells = 0;
  let cellsSame = 0;
  const off = [];
  for (const e of rows) {
    const id = String(e.athlete?.id);
    const espn = e.stats?.find((s) => s.name === "championshipPts")?.value ?? null;
    const mine = Object.values(byEvent).reduce((a, pts) => a + (pts[id] ?? 0), 0);
    total++;
    if (mine === espn) totalSame++;
    else off.push(`${e.athlete?.displayName}: ESPN ${espn}, the plays ${mine}`);
    for (const s of e.stats ?? []) {
      if (!s.id || !byEvent[s.id] || !s.played || typeof s.value !== "number") continue;
      cells++;
      if ((byEvent[s.id][id] ?? 0) === s.value) cellsSame++;
      else off.push(`${e.athlete?.displayName} at ${s.abbreviation ?? s.id}: ESPN ${s.value}, the plays ${byEvent[s.id][id] ?? 0}`);
    }
  }
  console.log(`\nThe season's standings (ESPN's ${args.season}): ${totalSame} of ${total} drivers' points the plays' over its ${Object.keys(byEvent).length} events${cells ? `; event by event ${cellsSame} of ${cells}` : ""}${tour.startsWith("nascar") ? " (NASCAR's are reset for its playoffs: told, not checked)" : ""}`);
  for (const o of off.slice(0, 12)) console.log(`        ${o}`);
  if (off.length > 12) console.log(`        ... and ${off.length - 12} more`);
  return tour.startsWith("nascar") || !off.length;
}

function differences(ans) {
  if (slug === "racing") return racingDifferences(ans);
  const box = sport.readBox(ans);
  const ev = sport.fieldEvent(ans);
  const notes = [];
  const plays = sport.readPlays(ans, notes);
  const out = [];
  const apart = [];
  const numbers = { all: 0, same: 0, apart: 0 };
  // A difference that's ESPN's own (`why`, its kind) is listed apart and doesn't fail the event.
  const same = (ok, msg, why) => {
    numbers.all++;
    if (ok) numbers.same++;
    else if (why) (numbers.apart++, apart.push(`${why}: ${msg}`));
    else out.push(msg);
  };
  if (!box) return { out: ["no leaderboard"], apart, notes, plays, numbers };
  const state = sport.reduce(plays, null, ev);
  // A withdrawal's unfinished round: ESPN's round can be a hole off the holes it lists, either way (Séamus Power's 2025 Canadian
  // Open leaves his tenth out, Mark Calcavecchia's 2025 Insperity counts a ninth it doesn't list), where its nines are the holes.
  // How far off, where the holes are its nines (the final's correction takes the plays to its round).
  const lbOf = new Map((fieldEventOf(ans, "leaderboard")?.competitions?.[0]?.competitors ?? []).map((c) => [String(c.id), c]));
  const lag = (id, r) => {
    if (box.people[id]?.standing.status !== "wd") return null;
    for (const [round, s] of Object.entries(state.parts[id] ?? {})) {
      if (r != null && Number(round) !== Number(r)) continue;
      const espn = box.people[id].parts[round];
      const line = (lbOf.get(id)?.linescores ?? []).find((l) => l.period === Number(round));
      if (!espn || (s.HOLES ?? 0) >= 18 || (line?.outScore ?? 0) + (line?.inScore ?? 0) !== (s.STR ?? 0)) continue;
      return { STR: (s.STR ?? 0) - espn.STR, TOPAR: (s.TOPAR ?? 0) - espn.TOPAR };
    }
    return null;
  };
  const WD_LAG = "a withdrawal's unfinished round, ESPN's round a hole off its holes and nines";
  // Each competitor's numbers, in all and round by round.
  for (const [id, p] of Object.entries(box.people)) {
    const have = state.lines[id] ?? {};
    for (const [k, v] of Object.entries(p.stats)) {
      if (sport.stat(k)?.known === "final" || sport.placeKeys.includes(k)) continue;
      const off = (have[k] ?? 0) - v;
      same(Math.abs(off) < 1e-9, `${p.name} ${k}: ESPN ${v}, plays ${have[k] ?? 0}`, lag(id)?.[k] === off ? WD_LAG : null);
    }
    for (const [r, s] of Object.entries(p.parts)) {
      const mine = state.parts[id]?.[r] ?? {};
      for (const k of ["STR", "TOPAR"]) same((mine[k] ?? 0) === s[k], `${p.name} round ${r} ${k}: ESPN ${s[k]}, plays ${mine[k] ?? 0}`, lag(id, r)?.[k] === (mine[k] ?? 0) - s[k] ? WD_LAG : null);
    }
  }
  for (const id of Object.keys(state.lines)) if (!box.people[id]) out.push(`the plays credit ${id}, who isn't on ESPN's leaderboard`);
  // The nines, from the holes: ESPN's outScore (holes 1-9) and inScore (10-18).
  const lb = fieldEventOf(ans, "leaderboard");
  for (const c of lb?.competitions?.[0]?.competitors ?? []) {
    for (const r of c.linescores ?? []) {
      if (r.isPlayoff || !(r.value > 0)) continue;
      const holes = plays.filter((p) => p.who === String(c.id) && p.period === r.period && p.hole != null && p.kind !== "playoff-hole");
      if (holes.length !== 18) continue;
      const nine = (lo, hi) => holes.filter((p) => p.hole >= lo && p.hole <= hi).reduce((a, p) => a + (p.deltas[String(c.id)]?.STR ?? 0), 0);
      if (r.outScore != null) same(nine(1, 9) === r.outScore, `${box.people[String(c.id)]?.name} round ${r.period} front nine: ESPN ${r.outScore}, holes ${nine(1, 9)}`);
      if (r.inScore != null) same(nine(10, 18) === r.inScore, `${box.people[String(c.id)]?.name} round ${r.period} back nine: ESPN ${r.inScore}, holes ${nine(10, 18)}`);
    }
  }
  // ESPN's board's own counts of a round's kinds of holes (golf.ts's boardCounts: eagles or better as eagles), where it fills
  // them in (not all 0), against the round's holes.
  for (const c of fieldEventOf(ans, "board")?.competitions?.[0]?.competitors ?? []) {
    const id = String(c.id);
    for (const r of c.linescores ?? []) {
      // A round not finished (a withdrawal's) can have its counts a hole behind its holes.
      const counted = boardCounts(r);
      const mine = state.parts[id]?.[r.period];
      if (!counted || (r.linescores ?? []).length < 18 || !mine) continue;
      for (const [k, e] of Object.entries(counted)) {
        const m = k === "EAG" ? (mine.EAG ?? 0) + (mine.ALB ?? 0) : mine[k] ?? 0;
        same(m === e, `${box.people[id]?.name ?? id} round ${r.period} ${k === "EAG" ? "EAG+ALB" : k}: ESPN's board ${e}, holes ${m}`);
      }
    }
  }
  // The final standings from the plays alone.
  const mine = new Map(state.standings.map((s) => [s.id, s]));
  for (const s of box.standings) {
    const m = mine.get(s.id);
    // ESPN's DP World Tour feed doesn't mark a playoff's losers tied for second, nor its 2025 PURE Insurance Championship those
    // who made the cut and didn't finish: the same place, the tie unsaid.
    same(m && m.place === s.place && m.tied === s.tied && m.status === s.status, `${box.people[s.id].name}: ESPN ${fmt(s)}, plays ${m ? fmt(m) : "none"}`, m && m.place === s.place && m.status === s.status ? "the same place, ESPN's not marked tied" : null);
  }
  // The places after each round, against the place ESPN starts the next round from (its startPosition, for those who played
  // it: a cut player's for a round he never played is anything). ESPN's currentPosition on a round, the place when each one
  // finished it, is only told: it's the same where a round's places weren't kept as they came.
  // ESPN's start place is its leaderboard as the round began, so where it then listed someone it later dropped (a withdrawal
  // before teeing off), everyone below is a place or two lower: a round's places are checked for being in ESPN's order (the tied
  // tied), and how many are exactly ESPN's is told; neither fails an event (its numbers and final places do).
  const rounds = [...new Set(Object.values(box.people).flatMap((p) => Object.keys(p.parts).map(Number)))].sort((a, b) => a - b);
  const after = { all: 0, same: 0, rounds: 0, inOrder: 0 };
  const current = { all: 0, same: 0 };
  const comps = lb?.competitions?.[0]?.competitors ?? [];
  for (const r of rounds) {
    const nextOf = (c) => (c.linescores ?? []).find((l) => l.period === r + 1 && !l.isPlayoff && l.value > 0);
    const places = sport.placesAfter(state, r, new Set(comps.filter(nextOf).map((c) => String(c.id))));
    const pairs = [];
    for (const c of comps) {
      const id = String(c.id);
      const mine = places.get(id);
      const start = nextOf(c)?.startPosition;
      if (start != null && mine) {
        after.all++;
        if (mine.place === start) after.same++;
        pairs.push({ id, mine: mine.place, espn: start });
      }
      const cur = (c.linescores ?? []).find((l) => l.period === r && !l.isPlayoff)?.currentPosition;
      if (cur != null && mine) (current.all++, cur === mine.place && current.same++);
    }
    if (!pairs.length) continue;
    after.rounds++;
    pairs.sort((a, b) => a.mine - b.mine || a.espn - b.espn);
    const bad = pairs.filter((p, i) => i > 0 && (p.mine === pairs[i - 1].mine ? p.espn !== pairs[i - 1].espn : p.espn < pairs[i - 1].espn));
    if (!bad.length) after.inOrder++;
    else notes.push(`after round ${r}, out of ESPN's order: ${bad.slice(0, 3).map((p) => `${box.people[p.id]?.name} (ESPN ${p.espn}, plays ${p.mine})`).join(", ")}`);
  }
  // The timeline comes to every number ESPN gives, and its standings.
  const end = sport.reduce(sport.timeline(ans), null, ev);
  for (const [id, p] of Object.entries(box.people)) {
    for (const [k, v] of Object.entries(p.stats)) if (!sport.placeKeys.includes(k) && Math.abs((end.lines[id]?.[k] ?? 0) - v) > 1e-9) out.push(`timeline: ${p.name} ${k}: ESPN ${v}, ${end.lines[id]?.[k] ?? 0}`);
  }
  if (box.final && JSON.stringify(end.standings) !== JSON.stringify(box.standings)) out.push("timeline: the standings aren't ESPN's");
  return { out, apart, notes, plays, numbers, after, current };
}

(async () => {
  const ids = await events();
  let bad = 0;
  let none = 0;
  let butApart = 0;
  let plays = 0;
  const numbers = { all: 0, same: 0, apart: 0 };
  const after = { all: 0, same: 0, rounds: 0, inOrder: 0 };
  const current = { all: 0, same: 0 };
  const byEvent = {};
  for (const id of ids) {
    let ans;
    try {
      ans = await answer(id);
    } catch (e) {
      bad++;
      console.log(`FAIL  ${id}  ${e.message}`);
      continue;
    }
    const lb = fieldEventOf(ans, "leaderboard");
    const name = lb?.name ?? fieldEventOf(ans, "board")?.name ?? id;
    const st = lb?.status?.type ?? fieldEventOf(ans, "board")?.status?.type ?? {};
    const scoring = lb?.tournament?.scoringSystem?.name;
    const field = slug === "racing" ? (fieldEventOf(ans, "board")?.competitions ?? []).some((c) => (c.competitors ?? []).length) : (lb?.competitions?.[0]?.competitors ?? []).length;
    if (!st.completed || !sport.fieldEvent(ans) || !field) {
      none++;
      console.log(`NONE  ${id}  ${name}  (${st.name}${scoring ? `, ${scoring}` : ""}: not a finished ${slug === "racing" ? "race weekend" : "stroke-play field"})`);
      continue;
    }
    const r = differences(ans);
    if (r.points) byEvent[id] = r.points;
    plays += r.plays.length;
    for (const k of Object.keys(numbers)) numbers[k] += r.numbers[k] ?? 0;
    for (const k of Object.keys(after)) after[k] += r.after?.[k] ?? 0;
    current.all += r.current?.all ?? 0;
    current.same += r.current?.same ?? 0;
    const holes = r.plays.filter((p) => p.hole != null).length;
    if (r.out.length) bad++;
    else if (r.apart.length) butApart++;
    const what =
      slug === "racing"
        ? `${r.plays.length} plays, ${[...new Set(r.plays.map((p) => p.session))].join(" ")}${r.apart.length ? `; ${r.apart.length} of ESPN's own apart` : ""}`
        : `${r.plays.length} plays, ${holes ? `${holes} holes` : "rounds only"}${scoring && scoring !== "Medal" ? `, ${scoring}` : ""}; the places after each round in ESPN's order ${r.after.inOrder}/${r.after.rounds}, its own ${r.after.same}/${r.after.all}${r.apart.length ? `; ${r.apart.length} of ESPN's own apart` : ""}`;
    console.log(`${r.out.length ? "FAIL" : r.apart.length ? "OK* " : "OK  "}  ${id}  ${name}  (${what})`);
    for (const d of r.out.slice(0, 20)) console.log(`        ${d}`);
    for (const d of r.apart.slice(0, 6)) console.log(`        apart: ${d}`);
    if (r.out.length > 20) console.log(`        ... and ${r.out.length - 20} more`);
    if (args.verbose || r.out.length) for (const n of r.notes) console.log(`        note: ${n}`);
  }
  const read = ids.length - none;
  const golfOnly = slug === "golf" ? `; the places after a round in ESPN's order in ${after.inOrder} of ${after.rounds} rounds, ESPN's own start place ${after.same} of ${after.all}; ESPN's currentPosition, the place when each finished a round, the same as after it ${current.same} of ${current.all}` : "";
  console.log(`\n${read - bad - butApart} of ${read} events add up to ESPN's own numbers and places, ${read - bad} but for ESPN's own differences apart (${plays} plays read; ${numbers.same} of ${numbers.all} numbers, ${((100 * numbers.same) / Math.max(1, numbers.all)).toFixed(1)}%, ${numbers.apart} apart${golfOnly}).${none ? ` ${none} more weren't a finished ${slug === "racing" ? "race weekend" : "stroke-play field"}.` : ""}${wire.calls ? ` ${wire.calls} uncached calls.` : ""}`);
  let standingsOk = true;
  if (args.standings && slug === "racing" && args.season && !args.max && !args.events) standingsOk = await seasonStandings(byEvent);
  process.exit(bad || !standingsOk ? 1 : 0);
})();
