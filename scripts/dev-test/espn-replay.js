// Dev-only: a recorded game (tests/fixtures/espn/, recorded by scripts/dev-test/record-espn.js) as ESPN's summary would have
// answered at a moment of it (docs/PLAN-start-a-game-gpt.md track L, step L2), so the phone's poller (src/lib/sports/live.ts)
// can be driven through a whole game without one on: fake-espn.js's replay (real time or 60x), tests/sports-live.test.js
// (virtual time) and scripts/dev-test/check-live-clock.js. Pure: no server, no database.
//
//   const { asOf, bounds, replayClock } = require("./espn-replay");
//   bounds(summary, sport)          { first, last, end } in ms: its first play, its last, and when it turns final (a minute after);
//                                   with its sport, by the sport's own play times (sport.playTimes: college baseball's stat crew
//                                   stamps its plays 12 hours early, and a live feed answers them when they happen)
//   asOf(summary, at, { sport })    the summary at `at` (ms), `sport` its TeamSport (src/lib/sports, through jiti):
//     - plays: ESPN's up to then, in ESPN's order, cut where their times (which never go back: inOrder) pass `at`, as a live
//       feed lists them; football's: the drives finished by then in drives.previous, the one going on (its plays so far) in
//       drives.current, as ESPN's live summary has it (never seen live yet: the plan's Noticed); soccer's: its commentary so far
//       (an entry with no play of its own at the time of the one before it) and its key events by their own times;
//     - status: pre before the first play, in during it (its period, and where in the sport's words), and from `end` the
//       recording itself (post, final);
//     - the header's score: the plays' so far (the sport's reduce), with no winner and no goalies of record until the end;
//     - the box score: its people kept (who's who: the readers match names to them), every number 0 until the end (soccer's
//       match sheets too, their starters known before the kickoff, as ESPN lists them);
//     - the line (pickcenter) as recorded.
//   replayClock({ from, speed })    a replay's moment: `from` (ms) at the wall time it's made, running at `speed` (1 real time,
//                                   60: a minute a second); .at(), .set(at), .pause(), .resume()
//   known(sport, summary)           (at, final) => the recording as known at `at`: its plays up to then (sport.reduce), and the
//                                   final's correction (what only the final box score knows: a pitcher's win, minutes, time on
//                                   ice) only once the game's final, since that's when it becomes known (the timeline stamps it
//                                   at the last play's moment)
//   differences(a, b)               where two GameStates differ: ["score ...", "<athlete> <stat> a/b"]
//   settles(log, { within })        a run of answers' differences (each { at, diffs }) as streaks; those longer than `within` ms
//
// What it can't show: how a live answer differs from the recording beyond the cut (ESPN filing a play again, an at-bat's start
// carrying the score so far): that's a real game in progress, recorded by scripts/dev-test/record-espn-live.js.

/** A game turns final this long after its last play. */
const FINAL_AFTER_MS = 60_000;

const ms = (t) => {
  const v = typeof t === "string" ? Date.parse(t) : NaN;
  return Number.isFinite(v) ? v : null;
};

/** Soccer's: its plays are its commentary and key events (src/lib/sports/soccer.ts), not `plays`. */
const isSoccer = (summary) => !summary.plays && !summary.drives && !!(summary.commentary || summary.keyEvents);

/** The recording's plays in ESPN's order, each with its drive's index (football's) or null; a play listed twice once. Soccer's:
 *  its commentary entries (an entry's play, or nothing for one with none: it's at the time of the one before), then its key
 *  events. */
function flat(summary, sport) {
  if (isSoccer(summary)) return { drives: null, list: [...(summary.commentary ?? []).map((c) => ({ p: c.play ?? {}, entry: c })), ...(summary.keyEvents ?? []).map((e) => ({ p: e, key: true }))] };
  if (summary.drives) {
    const drives = [...(summary.drives.previous ?? []), ...(summary.drives.current ? [summary.drives.current] : [])];
    const out = [];
    const seen = new Set();
    drives.forEach((d, i) => {
      for (const p of d.plays ?? []) {
        if (p.id != null && seen.has(String(p.id))) continue;
        if (p.id != null) seen.add(String(p.id));
        out.push({ p, drive: i });
      }
    });
    return { drives, list: out };
  }
  const at = sport?.playTimes ? sport.playTimes(summary) : [];
  return { drives: null, list: (summary.plays ?? []).map((p, i) => ({ p, drive: null, t: at[i] })) };
}

/** Each play's time as a live feed reaches it: its own, or the latest before it when that's later (or when it has none). */
function times(list) {
  let last = -Infinity;
  return list.map(({ p, t: when }) => {
    const t = ms(when ?? p.wallclock);
    if (t != null && t > last) last = t;
    return last;
  });
}

function bounds(summary, sport) {
  const { list } = flat(summary, sport);
  const t = (isSoccer(summary) ? list.map(({ p }) => ms(p.wallclock)).filter((x) => x != null).sort((a, b) => a - b) : times(list)).filter((x) => Number.isFinite(x));
  if (!t.length) throw new Error("the recording has no timed plays to replay");
  const last = t[t.length - 1];
  return { first: t[0], last, end: last + FINAL_AFTER_MS };
}

/** Every number in a box score's value made 0 ("27/40" "0/0", "18:32" "0:0", "5.2" "0.0"), its shape kept. */
const zero = (v) => (typeof v === "number" ? 0 : typeof v === "string" ? v.replace(/\d+/g, "0") : v);

function asOf(summary, at, { sport } = {}) {
  const b = bounds(summary, sport);
  if (at >= b.end) return summary;
  const soccer = isSoccer(summary);
  const { drives, list } = soccer ? { drives: null, list: [] } : flat(summary, sport);
  const t = times(list);
  let n = 0;
  while (n < list.length && t[n] <= at) n++;
  const kept = list.slice(0, n);
  const { plays: _plays, drives: _drives, commentary: _commentary, keyEvents: _keyEvents, ...rest } = summary;
  const out = JSON.parse(JSON.stringify(rest));
  if (soccer) {
    // The commentary in its order, each entry at its play's time or the latest before it; the key events by their own.
    const entries = summary.commentary ?? [];
    const et = times(entries.map((c) => ({ p: c.play ?? {} })));
    out.commentary = JSON.parse(JSON.stringify(entries.filter((_, i) => et[i] <= at)));
    out.keyEvents = JSON.parse(JSON.stringify((summary.keyEvents ?? []).filter((e) => (ms(e.wallclock) ?? Infinity) <= at)));
    for (const side of out.rosters ?? []) for (const row of side.roster ?? []) for (const s of row.stats ?? []) {
      if ("value" in s) s.value = 0;
      if ("displayValue" in s) s.displayValue = "0";
    }
  } else if (drives) {
    // The drives a play so far is in: every one before the last finished (previous), the last going on (current).
    const upto = kept.length ? kept[kept.length - 1].drive : -1;
    const of = (i) => ({ ...drives[i], plays: kept.filter((x) => x.drive === i).map((x) => x.p) });
    out.drives = { previous: [] };
    for (let i = 0; i < upto; i++) out.drives.previous.push(of(i));
    if (upto >= 0) out.drives.current = of(upto);
  } else out.plays = kept.map((x) => x.p);

  // The box score: who's who, nothing counted yet.
  for (const side of out.boxscore?.players ?? []) {
    for (const table of side.statistics ?? []) {
      if (Array.isArray(table.totals)) table.totals = table.totals.map(zero);
      for (const row of table.athletes ?? []) if (Array.isArray(row.stats)) row.stats = row.stats.map(zero);
    }
  }
  for (const side of out.boxscore?.teams ?? []) {
    for (const s of side.statistics ?? []) {
      if ("value" in s) s.value = zero(s.value);
      if ("displayValue" in s) s.displayValue = zero(s.displayValue);
      for (const x of s.stats ?? []) {
        if ("value" in x) x.value = zero(x.value);
        if ("displayValue" in x) x.displayValue = zero(x.displayValue);
      }
    }
  }

  // The header: on (or not yet), the score so far.
  const comp = out.header?.competitions?.[0];
  if (comp) {
    const started = at >= b.first;
    let score = {};
    let detail = "Scheduled";
    let period = 0;
    if (started && sport) {
      const plays = sport.readPlays(out);
      const state = sport.reduce(plays, null, (comp.competitors ?? []).map((c) => String(c.team?.id ?? "")));
      score = state.score;
      if (state.last) {
        period = state.last.period;
        detail = sport.where(state.last);
      }
    }
    comp.status = { period, type: { state: started ? "in" : "pre", completed: false, detail } };
    if (!comp.date) comp.date = new Date(b.first).toISOString().replace(/:\d\d\.\d+Z$/, "Z");
    for (const c of comp.competitors ?? []) {
      c.score = String(score[String(c.team?.id ?? "")] ?? 0);
      delete c.winner;
      delete c.shootoutScore;
    }
  }
  return out;
}

/** A replay's clock: the game's moment `from` (ms) now, running at `speed`. */
function replayClock({ from, speed = 60, now = Date.now } = {}) {
  let base = from;
  let wall = now();
  let paused = false;
  const at = () => (paused ? base : base + (now() - wall) * speed);
  return {
    speed,
    at,
    set(moment) {
      base = moment;
      wall = now();
    },
    pause() {
      base = at();
      paused = true;
    },
    resume() {
      if (!paused) return;
      wall = now();
      paused = false;
    },
  };
}

/** The recording as known at a moment: its plays up to then, the final's correction once it's final. */
function known(sport, summary) {
  const whole = sport.timeline(summary);
  const plays = whole.filter((p) => !p.final);
  const sides = (summary.header?.competitions?.[0]?.competitors ?? []).map((c) => String(c.team?.id ?? ""));
  return (at, final) => sport.reduce(final ? whole : plays, at, sides);
}

/** Where two game states differ: the score, then each person's every count. */
function differences(a, b) {
  const out = [];
  const sa = JSON.stringify(Object.entries(a.score).sort());
  const sb = JSON.stringify(Object.entries(b.score).sort());
  if (sa !== sb) out.push(`score ${sa}/${sb}`);
  for (const id of new Set([...Object.keys(a.lines), ...Object.keys(b.lines)])) {
    const x = a.lines[id] ?? {};
    const y = b.lines[id] ?? {};
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) if ((x[k] ?? 0) !== (y[k] ?? 0)) out.push(`${id} ${k} ${x[k] ?? 0}/${y[k] ?? 0}`);
  }
  return out;
}

/**
 * Answers' differences ({ at, diffs }[], in order) as streaks: from the first answer that differs to the first after it that
 * doesn't. A streak that never settles runs to Infinity. `long`: those lasting more than `within` ms.
 */
function settles(log, { within = 10 * 60_000 } = {}) {
  const streaks = [];
  let cur = null;
  for (const a of log) {
    if (a.diffs.length && !cur) cur = { from: a.at, diffs: a.diffs };
    else if (!a.diffs.length && cur) {
      streaks.push({ ...cur, ms: a.at - cur.from });
      cur = null;
    }
  }
  if (cur) streaks.push({ ...cur, ms: Infinity });
  return { streaks, long: streaks.filter((x) => x.ms > within) };
}

module.exports = { asOf, bounds, replayClock, known, differences, settles, FINAL_AFTER_MS };
