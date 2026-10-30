// Dev-only check of the bout sports' readers (src/lib/sports/: BoutSport, MMA; docs/PLAN-start-a-game-gpt.md track L, L5 part 4)
// against the REAL ESPN, on as many finished cards as asked: check-field-reduce.js's sibling for a card of bouts. For each card,
// ESPN's answers (its board, its FightCenter, and from the core API its rounds and each bout's status, plays and fighters'
// statistics: espn-mma-card.js) and:
//  - each fighter's plays, added up, against ESPN's own numbers (the reader's box: the core's statistics, else the FightCenter's)
//    and their bout's result's counts; the timeline (the plays and the final's correction) against the same;
//  - ESPN's two sets of totals against each other: the core's statistics and the FightCenter's, number by number;
//  - each result: the winner against ESPN's winner flags on the board, the FightCenter and the core; how (ESPN's result name,
//    read as MMA's keys: one it doesn't name fails the card); a decision's round the bout's last scheduled one; the judges'
//    scores against the FightCenter's text; the round of a finish no later than the bout's rounds;
//  - the moments: bouts in the order fought (each one's end before the next one's first moment), each result after its bout's
//    end, and the card as of each bout's result (that bout and every one before it done, every one after it not);
//  - ESPN's own, listed apart (they don't fail a card): the rounds' knockdowns, takedowns, takedown attempts, submission
//    attempts and reversals (the plays, which name no fighter) against the bout's totals; the plays' last round against the
//    status's; a decision before its last scheduled round; a bout ESPN never moved past "scheduled" on a card it calls final; a draw by name with a
//    winner flagged. Bouts with no plays (no times: the PFL's, LFA's, the UFC's before April 2025) are counted, not apart.
// Real calls, no app server, no database, nothing written but its cache.
//
//   node scripts/dev-test/check-bout-reduce.js --league=mma/ufc [--season=2026] [--max=60] [--verbose]
//   node scripts/dev-test/check-bout-reduce.js --league=mma/ufc --events=600057024,600057025
//   (mma/pfl, mma/lfa, mma/cage-warriors, mma/other ...) [--cache=<dir>]
//
// Without --events, the league's finished cards of the season (its board's calendar: one uncached call), at most --max. --cache
// keeps each finished card as a file (mma-<league>-card-<event>.json; default: rfl-espn-cache in the OS temp folder, shared
// with record-espn.js and record-espn-live.js), so running it again asks ESPN nothing. Prints each card OK or its differences
// (the reader's notes under --verbose), then a total; exits 1 on any difference.
const fs = require("fs");
const os = require("os");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { sportOf, BoutSport, mmaCoreStats, mmaCenterStats, methodOf } = jiti("../../src/lib/sports/index.ts");
const { cachedMmaCard } = require("./espn-mma-card");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, ...v]) => [k, v.length ? v.join("=") : true]));
const league = args.league || "mma/ufc";
const sport = sportOf(league);
if (!(sport instanceof BoutSport)) {
  console.error(`${league} isn't a bout sport built yet (team sports: check-sport-reduce.js; fields: check-field-reduce.js).`);
  process.exit(2);
}
const [, promotion] = league.split("/");
const cacheDir = args.cache || path.join(os.tmpdir(), "rfl-espn-cache");
fs.mkdirSync(cacheDir, { recursive: true });
const wire = { calls: 0, bytes: 0, raw: 0 };

async function events() {
  if (args.events) return String(args.events).split(",").filter(Boolean);
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league}/scoreboard${args.season ? `?dates=${args.season}` : ""}`, { headers: { "User-Agent": "GameYourShow/1.0" } });
  const board = await res.json();
  const now = Date.now();
  return (board.leagues?.[0]?.calendar ?? [])
    .filter((c) => (!args.season || String(c.startDate).startsWith(String(args.season))) && Date.parse(c.endDate) + 86400000 < now)
    .map((c) => /events\/(\d+)/.exec(c.event?.$ref ?? "")?.[1])
    .filter(Boolean)
    .slice(-Number(args.max || 60));
}

const ms = (t) => Date.parse(t);
const sortCards = (xs) => xs.map((c) => `${Math.max(...c)}-${Math.min(...c)}`).sort().join(" | ");

function differences(ans) {
  const notes = [];
  const plays = sport.readPlays(ans, notes);
  const box = sport.readBox(ans);
  const card = sport.card(ans);
  const out = [];
  const apart = [];
  const numbers = { all: 0, same: 0, apart: 0 };
  const same = (ok, msg, why) => {
    numbers.all++;
    if (ok) numbers.same++;
    else if (why) (numbers.apart++, apart.push(`${why}: ${msg}`));
    else out.push(msg);
  };
  if (!box || !card) return { out: ["no board"], apart, notes, plays, numbers, timed: 0, tally: {} };
  const name = (id) => box.people[id]?.name ?? id;
  // The plays alone, and the timeline, against ESPN's own numbers.
  const state = sport.reduce(plays, null, card);
  const end = sport.reduce(sport.timeline(ans), null, card);
  for (const [id, p] of Object.entries(box.people)) {
    for (const k of new Set([...Object.keys(p.stats), ...Object.keys(state.lines[id] ?? {})])) same((state.lines[id]?.[k] ?? 0) === (p.stats[k] ?? 0), `${p.name} ${k}: ESPN ${p.stats[k] ?? 0}, plays ${state.lines[id]?.[k] ?? 0}`);
    for (const k of Object.keys(p.stats)) if ((end.lines[id]?.[k] ?? 0) !== p.stats[k]) out.push(`timeline: ${p.name} ${k}: ESPN ${p.stats[k]}, ${end.lines[id]?.[k] ?? 0}`);
  }
  for (const id of Object.keys(state.lines)) if (!box.people[id]) out.push(`the plays credit ${id}, who isn't on ESPN's card`);
  const fcOf = new Map(Object.values(ans.fightcenter?.cards ?? {}).flatMap((s) => s.competitions ?? []).map((c) => [String(c.id), c]));
  const tally = { bouts: 0, timed: 0, withStats: 0 };
  for (const [i, b] of card.bouts.entries()) {
    const board = (ans.board?.competitions ?? []).find((c) => String(c.id) === b.id);
    const core = ans.core?.[b.id];
    const fc = fcOf.get(b.id);
    const res = box.results.find((r) => r.bout === b.id);
    tally.bouts++;
    if (!res) {
      // A bout ESPN never moved past "scheduled" on a card it calls final (Super RIZIN 5's): its own.
      const st = (core?.status ?? board?.status)?.type;
      if (box.final && st?.state === "pre") apart.push(`a bout still scheduled on a finished card: bout ${b.id} (${b.sides.map(name).join(" vs. ")})`);
      else out.push(`bout ${b.id} (${b.sides.map(name).join(" vs. ")}): no result`);
      continue;
    }
    // ESPN's two sets of totals.
    for (const id of b.sides) {
      const c = mmaCoreStats(core?.competitors?.find((x) => String(x.id) === id));
      const f = mmaCenterStats(fc?.competitors?.find((x) => String(x.id) === id));
      if (c) tally.withStats++;
      if (c && f) for (const [k, v] of Object.entries(f)) same(c[k] === v, `${name(id)} ${k}: the core ${c[k]}, the FightCenter ${v}`);
    }
    // The winner, by every flag ESPN gives.
    for (const [where, cs] of [["the board", board?.competitors], ["the FightCenter", fc?.competitors], ["the core", core?.competitors]]) {
      if (!cs?.length) continue;
      const f = cs.find((x) => x.winner === true)?.id ?? null;
      same(String(f ?? "") === String(res.winner ?? ""), `bout ${b.id}: ${where}'s winner ${f ? name(String(f)) : "none"}, the result's ${res.winner ? name(res.winner) : "none"}`);
    }
    const espnName = core?.status?.result?.name ?? fc?.status?.result?.name;
    same(!!methodOf(espnName) || !espnName, `bout ${b.id}: ESPN's result "${espnName}" isn't read`);
    if (methodOf(espnName)?.outcome === "draw" && res.outcome === "win") apart.push(`ESPN names a draw and flags a winner (read as a win): bout ${b.id} ("${espnName}", ${name(res.winner)})`);
    if (["UD", "SD", "MD", "DEC"].includes(res.method)) same(res.round === b.rounds, `bout ${b.id}: a decision in round ${res.round} of ${b.rounds}`, "a decision before its last scheduled round (a technical decision, or ESPN's rounds wrong: the PFL's core describes none)");
    same(res.round == null || res.round <= b.rounds + (b.overtime ? 1 : 0), `bout ${b.id}: ended in round ${res.round} of ${b.rounds}`);
    if (fc?.judgesScores) same(sortCards(res.cards) === sortCards(fc.judgesScores.split("|").map((x) => x.trim().split("-").map(Number))), `bout ${b.id}: the judges ${sortCards(res.cards)}, the FightCenter's ${fc.judgesScores}`);
    // The plays' rounds (no fighter named) against the bout's totals, and their last round: ESPN's own.
    const bp = plays.filter((p) => p.bout === b.id);
    const timed = (core?.plays ?? []).length > 0;
    if (timed) {
      tally.timed++;
      const rounds = end.bouts[b.id].rounds;
      const sum = (k) => Object.values(rounds).reduce((a, s) => a + (s[k] ?? 0), 0);
      for (const k of ["KD", "TDL", "TDA", "SUBA", "REV"]) {
        const total = b.sides.reduce((a, id) => a + (box.people[id]?.stats[k] ?? 0), 0);
        if (b.sides.some((id) => mmaCoreStats(core?.competitors?.find((x) => String(x.id) === id)))) same(sum(k) === total, `bout ${b.id} ${k}: its rounds' plays ${sum(k)}, the fighters' totals ${total}`, "the plays' moments not the totals");
      }
      const lastRound = Math.max(0, ...bp.map((p) => p.period));
      same(lastRound === res.round, `bout ${b.id}: plays to round ${lastRound}, ended in ${res.round}`, "the plays' last round not the status's");
    } else notes.push(`no plays (no times) for bout ${b.id} (${b.sides.map(name).join(" vs. ")})`);
    // The moments: its end before the next bout's first moment, its result after its end; the card as of its result.
    const endAt = bp.find((p) => p.kind === "bout-end")?.at;
    const resAt = bp.find((p) => p.kind === "result")?.at;
    if (!endAt || !resAt || ms(resAt) < ms(endAt)) out.push(`bout ${b.id}: its end ${endAt}, its result ${resAt}`);
    const next = card.bouts[i + 1];
    const nextFirst = next ? plays.find((p) => p.bout === next.id)?.at : null;
    if (endAt && nextFirst && ms(nextFirst) < ms(endAt)) out.push(`bout ${b.id} ends ${endAt}, after the next one's first moment ${nextFirst}`);
    if (resAt) {
      const at = sport.reduce(plays, resAt, card);
      const done = card.bouts.map((x) => at.bouts[x.id].stage === "done");
      const want = card.bouts.map((x, j) => j <= i || (plays.find((p) => p.bout === x.id && p.kind === "result")?.at === resAt));
      if (done.join() !== want.join()) notes.push(`as of bout ${b.id}'s result (${resAt}): done ${done.map(Number).join("")}, the order says ${want.map(Number).join("")}`);
    }
  }
  if (box.final && JSON.stringify(end.results) !== JSON.stringify(box.results)) out.push("timeline: the results aren't ESPN's");
  return { out, apart, notes, plays, numbers, tally };
}

(async () => {
  const ids = await events();
  let bad = 0;
  let none = 0;
  let butApart = 0;
  const numbers = { all: 0, same: 0, apart: 0 };
  const tally = { bouts: 0, timed: 0, withStats: 0, plays: 0 };
  const methods = {};
  for (const id of ids) {
    let ans;
    try {
      ans = await cachedMmaCard(cacheDir, { league: promotion, event: id, wire });
    } catch (e) {
      bad++;
      console.log(`FAIL  ${id}  ${e.message}`);
      continue;
    }
    const st = ans?.board?.status?.type ?? {};
    if (!ans || !st.completed || !(ans.board.competitions ?? []).length) {
      none++;
      console.log(`NONE  ${id}  ${ans?.board?.name ?? ""}  (${st.name}: not a finished card)`);
      continue;
    }
    const r = differences(ans);
    for (const k of Object.keys(numbers)) numbers[k] += r.numbers[k];
    for (const k of ["bouts", "timed", "withStats"]) tally[k] += r.tally[k] ?? 0;
    tally.plays += r.plays.length;
    for (const p of r.plays) if (p.result) methods[p.result.method ?? p.result.outcome] = (methods[p.result.method ?? p.result.outcome] ?? 0) + 1;
    if (r.out.length) bad++;
    else if (r.apart.length) butApart++;
    console.log(`${r.out.length ? "FAIL" : r.apart.length ? "OK* " : "OK  "}  ${id}  ${ans.board.name}  (${r.tally.bouts} bouts, ${r.tally.timed ? `${r.tally.timed} timed` : "none timed"}, ${r.plays.length} plays${r.apart.length ? `; ${r.apart.length} of ESPN's own apart` : ""})`);
    for (const d of r.out.slice(0, 20)) console.log(`        ${d}`);
    for (const d of r.apart.slice(0, args.verbose ? 50 : 4)) console.log(`        apart: ${d}`);
    if (r.out.length > 20) console.log(`        ... and ${r.out.length - 20} more`);
    if (args.verbose || r.out.length) for (const n of r.notes) console.log(`        note: ${n}`);
  }
  const read = ids.length - none;
  console.log(`\n${read - bad - butApart} of ${read} cards add up to ESPN's own numbers and results, ${read - bad} but for ESPN's own differences apart (${tally.bouts} bouts, ${tally.timed} with timed plays, ${tally.withStats / 2} with statistics; ${tally.plays} plays read; ${numbers.same} of ${numbers.all} numbers, ${((100 * numbers.same) / Math.max(1, numbers.all)).toFixed(1)}%, ${numbers.apart} apart). Results: ${Object.entries(methods).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}.${none ? ` ${none} more weren't a finished card.` : ""}${wire.calls ? ` ${wire.calls} uncached calls.` : ""}`);
  // Not process.exit: Node on Windows can assert on a fetch's socket still closing.
  process.exitCode = bad ? 1 : 0;
})().catch((e) => {
  // ESPN not answering the season's calendar, say.
  console.error(e.message);
  process.exitCode = 1;
});
