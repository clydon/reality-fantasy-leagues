// Dev-only: a stand-in postseason for the recorded NFL season (docs/PLAN-sports-ready.md step 2.7: a game through the playoffs needs a
// season that has one, and the recording, made 2026-11-15, has Weeks 1 to 9 played). nfl-slate-fixture.js's `up({ postseason: true })`
// applies it to the recording before it's served:
//   - the regular season's games still to play (Weeks 10 to 18) played: each side's line and points from a week it played (its own
//     players' box score, in turn), a tie broken by a point for the home side, so every week has finals and box scores;
//   - this season's playoffs: the 2025 season's real bracket (ESPN's January and February 2026 games, recorded in
//     tests/fixtures/espn/nfl-schedule-playoffs-2026.json: no athletes in it), each game 53 weeks on so it falls in this season's
//     playoff weeks as ESPN's calendar lists them (Wild Card Jan 13-19 2027 ... Super Bowl Feb 3-15), its teams, notes and scores as
//     they were, each side's box score its own from a week it played; each round's games listed only once the round before is over
//     (`listedAt`: the Wild Card's the Monday after Week 18, as ESPN lists them), so a team's season takes its games as they're set;
//   - the Pro Bowl as ESPN lists it (AFC against NFC, in the Super Bowl's week, listed from the start), so a check sees it left out.
// The 2025 bracket: Seattle won it all (a bye, then San Francisco, the Rams, New England), New England lost the Super Bowl, Buffalo
// won at Jacksonville and lost at Denver, Pittsburgh lost its Wild Card game at home; Miami and 17 others weren't in it.
//
//   const { withPostseason } = require("./nfl-postseason");
//   withPostseason(input, league);   // fake-espn's start() input, changed in place; returns { regular, playoffs: [{ id, week, note, listedAt }] }
// Pure (no database, no network); reusable for any check on nfl-slate-fixture.js.
const PLAYOFFS = require("../../tests/fixtures/espn/nfl-schedule-playoffs-2026.json");

/** The 2025 bracket's games land 53 weeks on, the same weekdays: the 2026 calendar's playoff weeks. */
const SHIFT_MS = 371 * 86_400_000;
/** The Pro Bowl's two sides: teams of no league the app reads (the stand-in needs a team for each side). */
const PRO_BOWL_TEAMS = [
  { id: "zt-pro-afc", name: "AFC", short: "AFC", location: "AFC", abbreviation: "AFC", league: "football/zt-nfl-exhibition", roster: [] },
  { id: "zt-pro-nfc", name: "NFC", short: "NFC", location: "NFC", abbreviation: "NFC", league: "football/zt-nfl-exhibition", roster: [] },
];
const shifted = (iso) => new Date(Date.parse(iso) + SHIFT_MS).toISOString().replace(/:00\.000Z$/, "Z");

function withPostseason(input, league) {
  const games = input.events.filter((e) => e.league === league).sort((a, b) => a.at.localeCompare(b.at));
  // Each team's played weeks, in order: its own side of the box score and its points.
  const lines = new Map();
  for (const g of games.filter((e) => e.state === "post" && e.box && e.score)) {
    for (const [team, i] of [[g.home, 0], [g.away, 1]]) {
      if (!g.box[team]) continue;
      if (!lines.has(team)) lines.set(team, []);
      lines.get(team).push({ box: g.box[team], points: g.score[i] });
    }
  }
  const turn = new Map();
  const borrow = (team) => {
    const list = lines.get(team);
    if (!list?.length) throw new Error(`nfl-postseason: no played week of team ${team} to borrow`);
    const k = turn.get(team) ?? 0;
    turn.set(team, k + 1);
    return list[k % list.length];
  };
  const played = (e) => {
    const h = borrow(e.home);
    const a = borrow(e.away);
    const score = [h.points, a.points === h.points ? a.points + (h.points === 0 ? 1 : -1) : a.points];
    return { ...e, state: "post", score, box: { [e.home]: h.box, [e.away]: a.box } };
  };
  let regular = 0;
  for (let i = 0; i < input.events.length; i++) {
    const e = input.events[i];
    if (e.league !== league || e.state === "post" || (e.stage ?? "regular") !== "regular") continue;
    input.events[i] = { ...played(e), standin: true };
    regular++;
  }

  // The 2025 bracket as this season's playoffs.
  const raw = Object.values(PLAYOFFS.months).flatMap((m) => m.events).sort((a, b) => a.date.localeCompare(b.date));
  const ids = new Set(input.teams.map((t) => t.id));
  const playoffs = raw.map((r) => {
    const c = r.competitions[0];
    const side = (h) => c.competitors.find((x) => x.homeAway === h);
    const note = c.notes?.[0]?.headline ?? null;
    const pro = /pro bowl/i.test(note ?? "");
    const home = pro ? PRO_BOWL_TEAMS[0].id : side("home").team.id;
    const away = pro ? PRO_BOWL_TEAMS[1].id : side("away").team.id;
    if (!pro && (!ids.has(home) || !ids.has(away))) throw new Error(`nfl-postseason: a team the recording hasn't (${home}, ${away})`);
    const score = [Number(side("home").score), Number(side("away").score)];
    const e = { league, id: r.id, at: shifted(r.date), home, away, state: "post", score, stage: "post", season: input.calendars?.[league]?.season ?? 2026, week: r.week?.number ?? null, name: r.shortName, note };
    return pro ? e : { ...e, box: { [home]: borrow(home).box, [away]: borrow(away).box } };
  });
  // Each round listed once the round before is over (its last game's end, about 4 hours after its start); the first the Monday
  // after the regular season's last Sunday; the Pro Bowl from the start.
  const rounds = [...new Set(playoffs.filter((g) => !/pro bowl/i.test(g.note ?? "")).map((g) => g.week))].sort((a, b) => a - b);
  const lastOf = (week) => Math.max(...playoffs.filter((g) => g.week === week).map((g) => Date.parse(g.at)));
  const regularLast = Math.max(...games.map((g) => Date.parse(g.at)));
  for (const g of playoffs) {
    if (/pro bowl/i.test(g.note ?? "")) continue;
    const i = rounds.indexOf(g.week);
    g.listedAt = new Date((i === 0 ? regularLast : lastOf(rounds[i - 1])) + 4 * 3_600_000).toISOString();
  }
  input.teams.push(...PRO_BOWL_TEAMS.filter((t) => !input.teams.some((x) => x.id === t.id)));
  input.events.push(...playoffs);
  return { regular, playoffs: playoffs.map((g) => ({ id: g.id, at: g.at, week: g.week, note: g.note, home: g.home, away: g.away, score: g.score, listedAt: g.listedAt ?? null })) };
}

module.exports = { withPostseason, SHIFT_MS, PRO_BOWL_TEAMS };
