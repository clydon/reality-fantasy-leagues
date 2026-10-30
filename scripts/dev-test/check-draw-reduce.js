// Dev-only check of tennis's reader (src/lib/sports/tennis.ts, a BoutSport; docs/PLAN-start-a-game-gpt.md track L, L5 part 4b)
// against the REAL ESPN, on as many finished events as asked: check-bout-reduce.js's sibling for a tennis event's draws. For each
// event, its board (espn-tennis-board.js: every draw's matches) and:
//  - each side's plays (a player's, a doubles pair's), added up, against ESPN's own numbers (the reader's box: the sets, games,
//    tiebreaks and results ESPN gives) over the event and match by match; the timeline (the plays and the final's correction)
//    against the same, the correction nothing;
//  - each result against ESPN's other words for it: the winner it flags, and its note ("A bt B 6-3 6-7 (4-7) 7-6 (7-1)": who
//    beat whom, each set's games and tiebreak points, "ret" for a retirement and "w/o" for a walkover, against its status);
//  - each match's format (best of three or five) against the sets its winner won; each main-draw round against the draw (a
//    match's winner plays their next match in the next round; the final's plays no more); one champion a draw, everyone else
//    out;
//  - the moments: each match known no earlier than its start, by the next start of a match either side plays, and the event as
//    of each match's moment (that match done, every one known before it done, none known after it); how many were known by a next
//    match, how many only 12 hours after their start;
//  - ESPN's own, listed apart (they don't fail an event): a winner flagged nowhere (read from the sets or the note), a note still
//    saying "leads" after the end, a note whose score isn't the sets', a winner who won more sets than the format has, a draw
//    whose rounds ESPN doesn't name.
// Real calls, no app server, no database, nothing written but its cache.
//
//   node scripts/dev-test/check-draw-reduce.js --league=tennis/atp [--season=2026] [--max=80] [--verbose]
//   node scripts/dev-test/check-draw-reduce.js --league=tennis/wta --events=232-2026,264-2026
//
// Without --events, the tour's events of the season (ESPN's core API: one uncached call) that are over, at most --max. A
// combined event (both tours on one board: the Grand Slams, Indian Wells, Miami...) is on both tours' lists, so each tour's run
// checks it (the total counts them). --cache keeps each finished event's board (tennis-<tour>-board-<event>.json; default: rfl-espn-cache in the
// OS temp folder, shared with record-espn.js and record-espn-live.js), so running it again asks ESPN nothing. Prints each event
// OK or its differences (the reader's notes under --verbose), then a total; exits 1 on any difference.
const fs = require("fs");
const os = require("os");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { sportOf, Tennis, setOf, noteWinner } = jiti("../../src/lib/sports/index.ts");
const { cachedTennisBoard, tennisEvents, drawOver } = require("./espn-tennis-board");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, ...v]) => [k, v.length ? v.join("=") : true]));
const league = args.league || "tennis/atp";
const sport = sportOf(league);
if (!(sport instanceof Tennis)) {
  console.error(`${league} isn't tennis (MMA's cards: check-bout-reduce.js; fields: check-field-reduce.js; team sports: check-sport-reduce.js).`);
  process.exit(2);
}
const tour = league.split("/")[1];
const cacheDir = args.cache || path.join(os.tmpdir(), "rfl-espn-cache");
fs.mkdirSync(cacheDir, { recursive: true });
const wire = { calls: 0, bytes: 0, raw: 0 };

async function events() {
  if (args.events) return String(args.events).split(",").filter(Boolean);
  const years = args.season ? [args.season] : [new Date().getFullYear()];
  const out = [];
  for (const year of years) out.push(...(await tennisEvents({ tour, year, wire })));
  return out;
}

/** ESPN's note's score, winner first: each set's two numbers and its tiebreak's, and how it ended ("ret", "w/o"). */
function noteScore(note) {
  const m = /((?:\s\d+-\d+(?:\s\(\d+-\d+\))?)*)\s*(ret|w\/o)?\s*$/.exec(String(note ?? ""));
  const sets = [...String(m?.[1] ?? "").matchAll(/(\d+)-(\d+)(?:\s\((\d+)-(\d+)\))?/g)].map((x) => ({ a: Number(x[1]), b: Number(x[2]), ta: x[3] != null ? Number(x[3]) : null, tb: x[4] != null ? Number(x[4]) : null }));
  return { sets, tail: m?.[2] ?? null };
}

const nameOf = (box, id) => box.people[id]?.name ?? id;

function differences(ans) {
  const notes = [];
  const plays = sport.readPlays(ans, notes);
  const box = sport.readBox(ans);
  const card = sport.card(ans);
  const out = [];
  const apart = [];
  const numbers = { all: 0, same: 0 };
  const moments = { next: 0, late: 0, none: 0 };
  if (!box || !card) return { out: ["no board"], apart, notes, plays, numbers, moments, matches: 0 };
  const same = (ok, msg) => {
    numbers.all++;
    if (ok) numbers.same++;
    else out.push(msg);
  };
  const compare = (who, want, have, where) => {
    for (const k of new Set([...Object.keys(want), ...Object.keys(have)])) same(Math.abs((want[k] ?? 0) - (have[k] ?? 0)) < 1e-9, `${nameOf(box, who)}${where} ${k}: ESPN ${want[k] ?? 0}, the plays ${have[k] ?? 0}`);
  };
  // The plays alone, and the timeline, against ESPN's numbers: over the event and match by match.
  const state = sport.reduce(plays, null, card);
  const end = sport.reduce(sport.timeline(ans), null, card);
  for (const [id, p] of Object.entries(box.people)) {
    compare(id, p.stats, state.lines[id] ?? {}, "");
    for (const k of new Set([...Object.keys(p.stats), ...Object.keys(end.lines[id] ?? {})])) if (Math.abs((p.stats[k] ?? 0) - (end.lines[id]?.[k] ?? 0)) > 1e-9) out.push(`${p.name} ${k}: the timeline ${end.lines[id]?.[k] ?? 0}, ESPN ${p.stats[k] ?? 0}`);
  }
  for (const [bout, lines] of Object.entries(box.byBout ?? {})) for (const [who, want] of Object.entries(lines)) compare(who, want, state.byBout[bout]?.[who] ?? {}, ` (match ${bout})`);
  for (const [bout, lines] of Object.entries(state.byBout)) for (const who of Object.keys(lines)) if (!box.byBout?.[bout]?.[who]) out.push(`${nameOf(box, who)} has plays in match ${bout} ESPN gives nothing for`);
  const corr = plays.find((p) => p.final);
  if (sport.timeline(ans).some((p) => p.final && Object.keys(p.deltas).length)) out.push("the final's correction isn't nothing");
  if (corr) out.push("readPlays has a final's correction");

  // Each result against ESPN's flags and note.
  const comps = new Map();
  for (const g of ans.board.groupings ?? []) for (const c of g.competitions ?? []) comps.set(String(c.id), c);
  const results = new Map(box.results.map((r) => [r.bout, r]));
  for (const b of card.bouts) {
    const c = comps.get(b.id);
    const r = results.get(b.id);
    const status = c.status?.type?.name;
    if (c.status?.type?.state !== "post") continue;
    if (!r) {
      out.push(`match ${b.id}: over (${status}) with no result read`);
      continue;
    }
    const sorted = [...(c.competitors ?? [])].sort((x, y) => (x.order ?? 9) - (y.order ?? 9));
    const flagged = sorted.find((x) => x.winner === true);
    if (flagged && String(flagged.id) !== r.winner) out.push(`match ${b.id}: ESPN flags ${nameOf(box, String(flagged.id))}, read ${nameOf(box, r.winner)}`);
    if (!flagged) apart.push(`match ${b.id}: no winner flagged (${status}): read ${nameOf(box, r.winner)}`);
    const note = c.notes?.[0]?.text ?? "";
    const names = b.sides.map((s) => {
      const e = box.people[s];
      const x = sorted.find((y) => String(y.id) === s);
      return e.type === "team" ? (x?.roster?.athletes ?? []).map((a) => a.displayName ?? "") : [e.name];
    });
    const w = b.sides.indexOf(r.winner);
    if (/\bleads\b|\bis tied with\b/.test(note)) apart.push(`match ${b.id}: ESPN's note still says "${note}"`);
    else if (note) {
      const said = noteWinner(note, names);
      if (said == null) out.push(`match ${b.id}: the note's winner not read ("${note}")`);
      else if (said !== w) (flagged ? apart : out).push(`match ${b.id}: the note says ${nameOf(box, b.sides[said])} won, ${flagged ? "ESPN flags" : "read"} ${nameOf(box, r.winner)} ("${note}")`);
      const { sets, tail } = noteScore(note);
      // A retirement between sets: ESPN's note lists the set never started ("6-3 7-6 (9-7) 0-0 ret"), its lines don't.
      if (sets.length === (r.sets ?? []).length + 1 && sets[sets.length - 1].a === 0 && sets[sets.length - 1].b === 0 && sets[sets.length - 1].ta == null) sets.pop();
      const want = { STATUS_RETIRED: "ret", STATUS_WALKOVER: "w/o" }[status] ?? null;
      if (tail !== want && !(status === "STATUS_WALKOVER" && !sets.length)) apart.push(`match ${b.id}: ${status}, its note ends "${tail ?? note.slice(-12)}"`);
      // The note's sets (winner first) read as the reader reads ESPN's lines, against the reader's sets.
      const read = (r.sets ?? []).map((s) => ({ games: [s.games[w], s.games[1 - w]], tiebreak: s.tiebreak ? [s.tiebreak[w], s.tiebreak[1 - w]] : null }));
      const told = sets.map((s, i) => {
        const x = setOf({ value: s.a, tiebreak: s.ta ?? undefined }, { value: s.b, tiebreak: s.tb ?? undefined }, !(tail === "ret" && i === sets.length - 1));
        return { games: x.games, tiebreak: x.tiebreak };
      });
      if (status !== "STATUS_WALKOVER" && JSON.stringify(read) !== JSON.stringify(told)) apart.push(`match ${b.id}: the sets ${JSON.stringify(read.map((s) => s.games))} and the note's "${note}" differ`);
    }
    // The format: a match played out has its winner win (rounds + 1) / 2 sets.
    if (status === "STATUS_FINAL") {
      const won = (r.sets ?? []).filter((s) => s.winner === w).length;
      if (won !== (b.rounds + 1) / 2) apart.push(`match ${b.id} (${b.place.draw} ${b.place.round}, best of ${b.rounds}): its winner won ${won} sets ("${note}")`);
    }
    // The draw: a main-draw winner's next match in it is the next round (by round: a walkover ESPN never scheduled has no start).
    if (b.place.fromFinal != null && !b.place.qualifying) {
      const later = card.bouts.filter((x) => x.place.draw === b.place.draw && !x.place.qualifying && x.place.fromFinal != null && x.place.fromFinal < b.place.fromFinal && x.sides.includes(r.winner));
      const next = Math.max(...later.map((x) => x.place.fromFinal));
      if (b.place.fromFinal === 1 && later.length) out.push(`match ${b.id}: the final's winner plays on in the draw`);
      // A round further on: ESPN's board lacks the match between (Alex De Minaur's 2026 Indian Wells third round).
      if (b.place.fromFinal > 1 && later.length && next !== b.place.fromFinal - 1) (next < b.place.fromFinal - 1 ? apart : out).push(`match ${b.id} (${b.place.draw} ${b.place.round}): its winner's next match on ESPN's board is ${later.find((x) => x.place.fromFinal === next).place.round}`);
      if (b.place.fromFinal > 1 && !later.length) apart.push(`match ${b.id} (${b.place.draw} ${b.place.round}): its winner has no next match on ESPN's board`);
    }
  }
  const unnamed = notes.filter((n) => /no rounds/.test(n));
  for (const n of unnamed) apart.push(n);
  // Each draw: one champion once its final's over, everyone else out.
  for (const d of sport.draws(end, card)) {
    const fin = card.bouts.find((b) => b.place.draw === d.draw && b.place.fromFinal === 1 && !b.place.qualifying);
    if (!fin || !results.get(fin.id)) continue;
    const champs = d.entries.filter((e) => e.champion);
    const still = d.entries.filter((e) => !e.out && !e.champion);
    if (champs.length !== 1 || champs[0].id !== results.get(fin.id).winner) out.push(`${d.draw}: champions ${champs.map((e) => nameOf(box, e.id)).join(", ") || "none"}`);
    // Still in at the end: in the main draw, a difference; in qualifying, a win ESPN lists no next match after (ESPN's own).
    // One a known win put in a round whose matches ESPN lists without them (a withdrawal it doesn't show): ESPN's own.
    const listed = (e) => card.bouts.some((b) => b.place.draw === d.draw && !b.place.qualifying && b.place.fromFinal === e.fromFinal && b.sides.includes(e.id));
    const main = still.filter((e) => !e.qualifying);
    if (main.some(listed)) out.push(`${d.draw}: still in at the end: ${main.filter(listed).map((e) => `${nameOf(box, e.id)} (${e.round})`).slice(0, 5).join(", ")}`);
    for (const e of main.filter((x) => !listed(x))) apart.push(`${d.draw}: ${nameOf(box, e.id)} won into the ${e.round} and isn't on any of its matches on ESPN's board`);
    for (const e of still.filter((x) => x.qualifying)) apart.push(`${d.draw}: ${nameOf(box, e.id)} won in ${e.round} and has no next match on ESPN's board`);
  }

  // The moments: each match known no earlier than its start; the event as of each match's moment.
  const known = new Map();
  for (const p of plays) if (p.kind === "result" && !known.has(p.bout)) known.set(p.bout, p.at);
  const starts = new Map(card.bouts.map((b) => [b.id, b.start]));
  const byPerson = new Map();
  for (const b of card.bouts) for (const who of b.sides.flatMap((s) => s.split("-"))) byPerson.set(who, [...(byPerson.get(who) ?? []), b]);
  for (const [bout, at] of known) {
    const b = card.bouts.find((x) => x.id === bout);
    const t = Date.parse(at);
    if (at == null) moments.none++;
    else if (b.start && t < Date.parse(b.start)) out.push(`match ${bout}: known at ${at}, before its start ${b.start}`);
    const next = b.sides.flatMap((s) => s.split("-")).flatMap((who) => byPerson.get(who) ?? []).filter((x) => x !== b && x.start && b.start && Date.parse(x.start) > Date.parse(b.start));
    if (at != null && next.some((x) => Date.parse(x.start) === t)) moments.next++;
    else if (at != null) moments.late++;
  }
  // As of each result's moment: every match known by then done, every one known after it not (a sample: every 7th, and the last).
  const order = [...known].filter(([, at]) => at != null).sort((x, y) => Date.parse(x[1]) - Date.parse(y[1]));
  order.forEach(([bout, at], i) => {
    if (i % 7 && i !== order.length - 1) return;
    const s = sport.reduce(plays, at, card);
    for (const [other, t] of order) {
      const done = s.bouts[other]?.stage === "done";
      if (Date.parse(t) <= Date.parse(at) && !done) out.push(`as of ${at} (match ${bout}): match ${other}, known at ${t}, isn't done`);
      if (Date.parse(t) > Date.parse(at) && done) out.push(`as of ${at} (match ${bout}): match ${other}, known at ${t}, is done already`);
    }
    void starts;
  });
  return { out, apart, notes, plays, numbers, moments, matches: card.bouts.length };
}

(async () => {
  const ids = await events();
  const max = Number(args.max || 80);
  let ok = 0;
  let exact = 0;
  let checked = 0;
  const totals = { numbers: 0, same: 0, matches: 0, plays: 0, next: 0, late: 0, none: 0 };
  const combined = new Set();
  for (const event of ids) {
    if (checked >= max) break;
    const board = await cachedTennisBoard(cacheDir, { tour, event, wire });
    if (!board || !drawOver(board)) {
      if (args.events) console.log(`${event}: ${board ? "not over yet" : "no answer"}`);
      continue;
    }
    // A combined event is on both tours' boards: the same matches, each tour's run.
    const draws = (board.groupings ?? []).map((g) => g.grouping?.slug);
    if (draws.some((d) => /^mens-/.test(d)) && draws.some((d) => /^womens-/.test(d))) combined.add(event);
    checked++;
    const { out, apart, notes, plays, numbers, moments, matches } = differences({ board });
    totals.numbers += numbers.all;
    totals.same += numbers.same;
    totals.matches += matches;
    totals.plays += plays.length;
    totals.next += moments.next;
    totals.late += moments.late;
    totals.none += moments.none;
    const head = `${event} ${board.name}: ${matches} matches, ${numbers.all} numbers`;
    if (!out.length) {
      ok++;
      if (!apart.length) exact++;
      console.log(`OK  ${head}${apart.length ? `; ESPN's own: ${apart.length}` : ""}`);
    } else console.log(`DIFF ${head}: ${out.length} differences\n  ${out.slice(0, 12).join("\n  ")}`);
    if (args.verbose) {
      for (const a of apart) console.log(`  apart: ${a}`);
      for (const n of notes) console.log(`  note: ${n}`);
    } else for (const a of apart.slice(0, 3)) console.log(`  apart: ${a}`);
  }
  console.log(`\n${ok} of ${checked} events read every number and result of ESPN's (${exact} with nothing of ESPN's own apart): ${totals.same} of ${totals.numbers} numbers, ${totals.matches} matches, ${totals.plays} plays; ${combined.size} combined events (both tours)`);
  console.log(`The moments: ${totals.next} matches known by the next start of a match either side plays, ${totals.late} only 12 hours after their start (a final, or a side's last match), ${totals.none} never (at the end)`);
  console.log(`ESPN: ${wire.calls} calls, ${Math.round(wire.bytes / 1024)} KB over the wire, ${Math.round(wire.raw / 1024)} KB unpacked (the rest from the cache)`);
  process.exit(ok === checked ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
