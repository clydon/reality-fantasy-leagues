// Dev-only: a stand-in for ESPN (src/lib/server/sports/espn.ts), so a check can link a sport's episodes to "ESPN's" games
// (docs/PLAN-sports-data.md step 2) without the real one. One origin answers for all three of ESPN's hosts, as espn(base) asks:
//   GET /apis/search/v2?query=        teams and leagues whose names hold every word asked (case-insensitive), as ESPN's search
//                                     answers: { results: [{ type: "team" | "league", contents: [...] }] }
//   GET /apis/site/v2/sports/:sport/:league/scoreboard?dates=YYYYMMDD   that league's events starting that day in the East
//   GET /apis/site/v2/sports/:sport/:league/scoreboard?dates=YYYYMM     that month's (L8: a slate's fixtures)
//   GET /apis/site/v2/sports/:sport/:league/scoreboard                  (no dates) the league's season now from `calendars`, as
//                                     ESPN's bare scoreboard says it (its season, stage and calendar of days or weeks), else 404
//   GET /v2/sports/:sport/leagues/:league/seasons/:year/types[/:n]      its stages' bounds, as the core lists them (refs, then each)
//   GET /apis/site/v2/sports/:sport/:league/teams                       that league's teams (L7: finding a game by team), as ESPN's
//                                     list answers ({ sports: [{ leagues: [{ name, abbreviation, teams: [{ team }] }] }] }), each
//                                     with its `color` and `logo` when given; 404 for a league with no teams and no name
//   GET /apis/site/v2/sports/:sport/:league/teams/:id/roster            a team's players (`roster` on the team; [] for none, as
//                                     ESPN's AFL rosters come back), its manager apart (ESPN's `coach`), else 404
//   GET /apis/site/v2/sports/:sport/:league/teams/:id/schedule          a team's games in that league (only the stage asked, with
//                                     seasontype), as ESPN's schedule lists them, else 404
//   GET /apis/site/v2/sports/:sport/:league/summary?event=              a game's box score from its `box` (each team's lines) and its
//                                     line (`odds`, as ESPN's pickcenter), else 404; a replayed game's summary as of its replay
//                                     clock (below)
//   GET /apis/common/v3/sports/:sport/:league/athletes/:id/stats?season= an athlete's season lines from `seasons` (ESPN's
//                                     categories, each with that year's row), { categories: [] } for one it has none for
//   GET /v2/sports, /v2/sports/:sport/leagues                           the index, as refs
//   GET /apis/v2/sports/:sport/:league/standings                        a league's table from `standings` (B1's Standings tab), as
//                                     ESPN's level=3 answer nests it (its top groups, their divisions; or one level), each team's
//                                     line counted from the stand-in's own finals (so it agrees with the schedules): W-L(-T),
//                                     PCT, GB, PF, PA, DIFF, home, road, streak, and a seed in its top group (division leaders
//                                     first, then by PCT), else 404
//
//   const espn = await require("./fake-espn").start({ teams, leagues, events, seasons });
//   // teams:   [{ id, name, short, location, abbreviation, league: "baseball/zt-mlb", color?, logo?,
//   //             roster?: [{ id, name, position, abbr? (its abbreviation: ESPN gives both), headshot?, injuries? ([{ status, date }], ESPN's) }] }]
//   // leagues: [{ league: "baseball/zt-little", name: "ZT Little League World Series", short? }]
//   // events:  [{ league, id, at (ISO), home: teamId, away: teamId, state: "pre" | "in" | "post", score?: [home, away], note?,
//   //             stage?: "pre" | "regular" | "post" (its season's, as ESPN's slug says it; "regular" unless said),
//   //             season? (ESPN's year for it; the year it starts in, UTC, unless said), off? (called off: over, not completed),
//   //             odds?: { details: "ZPH -2.5", overUnder: 237.5, spread: -2.5, provider? } (on the scoreboard while "pre"),
//   //             bestOf? (a playoff series' most games: the scoreboard's series.totalCompetitions, as ESPN's 2026 playoffs list it),
//             records?: [home, away] (each side's season record, "6-2": the scoreboard's competitors[].records[0].summary),
//             network? ("FOX": the scoreboard's broadcasts[].names), clock?: { period, display: "6:41", detail?: "6:41 - 3rd",
//             possession?: teamId, down?: "2nd & 7" } (a game on: the scoreboard's status, and a summary with football's
//             possession and down and distance even without a box: the scores strip's live read, /api/sports/now),
//   //             box?: { [teamId]: { labels: ["D", "G"], rows: [{ id, name, position, stats: ["21", "2"] }] }
//   //                            or { tables: [{ name: "batting", labels, rows }, { name: "pitching", labels, rows }] } } }]
//   //          or a field's event (a race): [{ league, id, at, name, state, field: [{ id, name, headshot? }] }] (its order the place)
//   // seasons: { [athleteId]: [{ year, name: "career-batting", displayName: "Career Batting", season?: "2026", labels, stats }] }
//   // calendars: { [league]: { season, label, now?, stages: [{ type, name, from, to }], days?: ["2026-11-02"], weeks?: [{ type,
//   //             label, detail?, from, to }] } } (L8; days and bounds as ESPN writes them: ISO instants, a day at 07:00Z)
//   // standings: { [league]: { season: "2026", groups: [{ id, name, abbreviation, parent?: { id, name, abbreviation },
//   //             teams: [teamId], notes?: { [teamId]: { description, color } }, clinch?: { [teamId]: "x" | "e" } }] } }
//   espn.url (pass to espn(base));  espn.asked (paths asked, in order);  espn.down = true (every call 503s);
//   espn.events.push(...) (a game scheduled later);  await espn.close();
//
// A recorded game replayed live (docs/PLAN-start-a-game-gpt.md track L, step L2): its summary answers as of a replay clock, from a
// fixture in tests/fixtures/espn/ (scripts/dev-test/espn-replay.js: the plays up to then, status pre, then in, then the recording
// itself, final, a minute after the last play), in real time or faster:
//   const r = espn.replay(require("../../tests/fixtures/espn/nba-401909093.json"), { speed: 60, from });
//   // from: the game's moment it starts at (default 5 minutes before the first play); speed 1 is real time, 60 a minute a second
//   r.at() (the replay's moment now), r.set(at), r.pause(), r.resume(), r.first / r.last / r.end (its bounds, ms), r.sport,
//   r.down = true (its summary 503s, the others' don't)
//   espn.answers: every replayed answer, { event, at, plays } (`at`: the moment it was as of)
//
// No database and no app server. Names start "ZT " so nothing it answers can be mistaken for a real team.
const http = require("http");
const path = require("path");
const { eastern } = require("./fake-listings");
const replay = require("./espn-replay");

/** The sports (src/lib/sports), loaded only for a replay. */
let sports = null;
const sportsCode = () => (sports ??= require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } })("../../src/lib/sports/index.ts"));

const words = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const holds = (name, q) => {
  const have = new Set(words(name));
  const want = words(q);
  return want.length > 0 && want.every((w) => have.has(w));
};

async function start(opts = {}) {
  const espn = { asked: [], down: false, url: null, teams: opts.teams || [], leagues: opts.leagues || [], events: opts.events || [], seasons: opts.seasons || {}, calendars: opts.calendars || {}, standings: opts.standings || {}, replays: [], answers: [] };
  espn.replay = (summary, { speed = 60, from } = {}) => {
    const { league, event } = summary._recorded ?? {};
    const sport = sportsCode().sportOf(league);
    if (!sport) throw new Error(`no sport reads ${league}`);
    const b = replay.bounds(summary, sport);
    // From 5 minutes before the game: its first play, or its scheduled start when that's earlier (a recording that keeps it).
    const starts = Date.parse(summary.header?.competitions?.[0]?.date ?? "");
    const clock = replay.replayClock({ from: from ?? Math.min(b.first, Number.isFinite(starts) ? starts : b.first) - 5 * 60_000, speed });
    const r = { ...clock, ...b, league, event: String(event), summary, sport };
    espn.replays.push(r);
    return r;
  };
  const teamOf = (id) => espn.teams.find((t) => t.id === id);
  const rawTeam = (t) => ({ id: t.id, displayName: t.name, shortDisplayName: t.short, name: t.short, location: t.location, abbreviation: t.abbreviation });
  const SLUGS = { pre: [1, "preseason"], regular: [2, "regular-season"], post: [3, "post-season"] };
  const seasonOf = (e) => {
    const [type, slug] = SLUGS[e.stage || "regular"];
    return { year: e.season ?? new Date(e.at).getUTCFullYear(), type, slug };
  };
  /** A game's line as ESPN writes it (a scoreboard's odds[], a summary's pickcenter[]). */
  const line = (o) => ({ provider: { name: o.provider || "ZT Book", displayName: o.provider || "ZT Book" }, details: o.details, overUnder: o.overUnder, spread: o.spread });
  /** Its status as ESPN writes it: a game on with its period and clock (`clock`), a final as Final. */
  const statusOf = (e) => ({
    ...(e.clock ? { period: e.clock.period, displayClock: e.clock.display } : {}),
    type: {
      state: e.state,
      completed: e.state === "post" && !e.off,
      name: e.state === "in" ? (e.clock?.half ? "STATUS_HALFTIME" : "STATUS_IN_PROGRESS") : e.state === "post" ? "STATUS_FINAL" : "STATUS_SCHEDULED",
      shortDetail: e.state === "in" ? (e.clock?.half ? "Halftime" : e.clock?.detail ?? null) : e.state === "post" ? "Final" : null,
    },
  });
  /** Each side's record, as a scoreboard lists it (records[0] the season's). */
  const recordOf = (e, i) => (e.records?.[i] ? { records: [{ name: "overall", type: "total", summary: e.records[i] }] } : {});
  /** An event as a scoreboard lists it; a game still to play with its line (ESPN drops it once it starts). */
  const rawEvent = (e) => {
    const status = statusOf(e);
    if (e.field) {
      const competitors = e.field.map((p, i) => ({ order: i + 1, athlete: { id: p.id, displayName: p.name, ...(p.headshot ? { headshot: { href: p.headshot } } : {}) } }));
      return { id: e.id, date: e.at, name: e.name, shortName: e.name, season: seasonOf(e), status, competitions: [{ id: e.id, date: e.at, status, competitors }] };
    }
    const home = teamOf(e.home);
    const away = teamOf(e.away);
    return {
      id: e.id,
      date: e.at,
      name: `${away.name} at ${home.name}`,
      shortName: `${away.abbreviation} @ ${home.abbreviation}`,
      season: seasonOf(e),
      status,
      competitions: [
        {
          id: e.id,
          date: e.at,
          status,
          notes: e.note ? [{ headline: e.note }] : [],
          ...(e.bestOf ? { series: { type: "playoff", title: "Playoff Series", totalCompetitions: e.bestOf } } : {}),
          competitors: [
            { homeAway: "home", team: rawTeam(home), score: e.score ? String(e.score[0]) : "0", winner: e.state === "post" && e.score ? e.score[0] > e.score[1] : undefined, ...recordOf(e, 0) },
            { homeAway: "away", team: rawTeam(away), score: e.score ? String(e.score[1]) : "0", winner: e.state === "post" && e.score ? e.score[1] > e.score[0] : undefined, ...recordOf(e, 1) },
          ],
          ...(e.network ? { broadcasts: [{ market: "national", names: [e.network] }] } : {}),
          ...(e.odds && e.state === "pre" ? { odds: [line(e.odds)] } : {}),
        },
      ],
    };
  };
  /** A team's line from the stand-in's finals in its league, as ESPN's standings write each number. */
  const lineOf = (league, id) => {
    const games = espn.events.filter((e) => e.league === league && e.state === "post" && e.score && !e.off && (e.home === id || e.away === id)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const n = { w: 0, l: 0, t: 0, pf: 0, pa: 0, hw: 0, hl: 0, rw: 0, rl: 0 };
    const results = [];
    for (const e of games) {
      const home = e.home === id;
      const us = home ? e.score[0] : e.score[1];
      const them = home ? e.score[1] : e.score[0];
      n.pf += us;
      n.pa += them;
      const r = us > them ? "W" : us < them ? "L" : "T";
      results.push(r);
      if (r === "W") {
        n.w++;
        home ? n.hw++ : n.rw++;
      } else if (r === "L") {
        n.l++;
        home ? n.hl++ : n.rl++;
      } else n.t++;
    }
    const last = results[results.length - 1];
    let k = 0;
    for (let i = results.length - 1; i >= 0 && results[i] === last; i--) k++;
    const pct = n.w + n.l + n.t ? (n.w + n.t / 2) / (n.w + n.l + n.t) : 0;
    return { ...n, pct, streak: last ? `${last}${k}` : "-" };
  };
  const stat = (name, type, value, displayValue, summary) => ({ name, type, value, displayValue: String(displayValue), ...(summary ? { summary } : {}) });
  const standingsOf = (league, st) => {
    const lines = new Map(st.groups.flatMap((g) => g.teams).map((id) => [id, lineOf(league, id)]));
    const diff = (id) => lines.get(id).pf - lines.get(id).pa;
    const byPct = (a, b) => lines.get(b).pct - lines.get(a).pct || diff(b) - diff(a);
    // Seeds in each top group: its divisions' leaders first, then the rest, each by PCT (a league of one level: by PCT).
    const seeds = new Map();
    const tops = [...new Set(st.groups.map((g) => g.parent?.id ?? "_"))];
    for (const top of tops) {
      const gs = st.groups.filter((g) => (g.parent?.id ?? "_") === top);
      const leaders = top === "_" ? [] : gs.map((g) => [...g.teams].sort(byPct)[0]);
      const rest = gs.flatMap((g) => g.teams).filter((id) => !leaders.includes(id));
      [...leaders.sort(byPct), ...rest.sort(byPct)].forEach((id, i) => seeds.set(id, i + 1));
    }
    const entry = (g, id, lead) => {
      const n = lines.get(id);
      const gb = (lines.get(lead).w - n.w + (n.l - lines.get(lead).l)) / 2;
      const t = teamOf(id);
      const rec = n.t ? `${n.w}-${n.l}-${n.t}` : `${n.w}-${n.l}`;
      return {
        team: { id, abbreviation: t.abbreviation, displayName: t.name, shortDisplayName: t.short, location: t.location },
        ...(g.notes?.[id] ? { note: g.notes[id] } : {}),
        stats: [
          stat("wins", "wins", n.w, n.w),
          stat("losses", "losses", n.l, n.l),
          stat("ties", "ties", n.t, n.t),
          stat("winPercent", "winpercent", n.pct, n.pct.toFixed(3).replace(/^0/, "")),
          stat("gamesBehind", "gamesbehind", gb, gb <= 0 ? "-" : String(gb)),
          stat("playoffSeed", "playoffseed", seeds.get(id), seeds.get(id)),
          stat("pointsFor", "pointsfor", n.pf, n.pf),
          stat("pointsAgainst", "pointsagainst", n.pa, n.pa),
          stat("pointDifferential", "pointdifferential", diff(id), `${diff(id) > 0 ? "+" : ""}${diff(id)}`),
          stat("streak", "streak", 0, n.streak),
          ...(g.clinch?.[id] ? [stat("clincher", "clincher", 0, g.clinch[id])] : []),
          stat("overall", "total", 0, rec, rec),
          stat("Home", "home", 0, `${n.hw}-${n.hl}`, `${n.hw}-${n.hl}`),
          stat("Road", "road", 0, `${n.rw}-${n.rl}`, `${n.rw}-${n.rl}`),
        ],
      };
    };
    // ESPN lists a division's teams in no order of its own: by id here.
    const node = (g) => {
      const lead = [...g.teams].sort(byPct)[0];
      return { id: g.id, name: g.name, abbreviation: g.abbreviation, standings: { seasonDisplayName: st.season, entries: [...g.teams].sort().map((id) => entry(g, id, lead)) } };
    };
    const named = espn.leagues.find((l) => l.league === league);
    const root = { id: "0", name: named?.name ?? league, abbreviation: named?.short ?? league };
    if (tops[0] === "_") return { ...root, children: st.groups.map(node) };
    return {
      ...root,
      children: tops.map((top) => {
        const p = st.groups.find((g) => g.parent.id === top).parent;
        return { id: p.id, name: p.name, abbreviation: p.abbreviation, children: st.groups.filter((g) => g.parent.id === top).map(node) };
      }),
    };
  };
  const server = http.createServer((req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const u = new URL(req.url, "http://x");
    espn.asked.push(u.pathname + u.search);
    if (espn.down) return send(503, { message: "the stand-in ESPN is down" });
    let m;
    if (u.pathname === "/apis/search/v2") {
      const q = u.searchParams.get("query") || "";
      const teams = espn.teams.filter((t) => holds(t.name, q)).map((t) => {
        const [sport, slug] = t.league.split("/");
        return { uid: `s:1~l:1~t:${t.id}`, type: "team", displayName: t.name, sport, defaultLeagueSlug: slug };
      });
      const leagues = espn.leagues.filter((l) => holds(l.name, q)).map((l) => {
        const [sport, slug] = l.league.split("/");
        return { uid: "s:1~l:1", type: "league", displayName: l.name, sport, defaultLeagueSlug: slug };
      });
      return send(200, { results: [...(teams.length ? [{ type: "team", contents: teams }] : []), ...(leagues.length ? [{ type: "league", contents: leagues }] : []), { type: "article", contents: [] }] });
    }
    if ((m = u.pathname.match(/^\/apis\/site\/v2\/sports\/([^/]+)\/([^/]+)\/scoreboard$/))) {
      const league = `${m[1]}/${m[2]}`;
      const dates = u.searchParams.get("dates") || "";
      if (!dates) {
        // L8: the bare scoreboard: the league's season now and its calendar.
        const c = espn.calendars[league];
        if (!c) return send(404, { code: 404 });
        const named = espn.leagues.find((l) => l.league === league);
        const calendar = c.weeks?.length
          ? [...new Set(c.weeks.map((w) => w.type))].map((type) => ({ value: String(type), entries: c.weeks.filter((w) => w.type === type).map((w) => ({ label: w.label, detail: w.detail ?? null, startDate: w.from, endDate: w.to })) }))
          : c.days || [];
        return send(200, { leagues: [{ slug: m[2], name: named?.name, abbreviation: named?.short, season: { year: c.season, displayName: c.label, type: { type: c.now ?? 2 } }, calendarType: c.weeks?.length ? "list" : "day", calendar }], events: [] });
      }
      // A month ("202611"), else a day.
      const month = /^\d{6}$/.test(dates) ? `${dates.slice(0, 4)}-${dates.slice(4)}` : null;
      const day = dates.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
      const events = espn.events.filter((e) => e.league === league && (month ? eastern(Date.parse(e.at)).date.slice(0, 7) === month : eastern(Date.parse(e.at)).date === day)).map(rawEvent);
      return send(200, { leagues: [{ slug: m[2] }], events });
    }
    if ((m = u.pathname.match(/^\/apis\/site\/v2\/sports\/([^/]+)\/([^/]+)\/teams$/))) {
      // A league's teams, as ESPN's list answers (L7).
      const league = `${m[1]}/${m[2]}`;
      const named = espn.leagues.find((l) => l.league === league);
      const teams = espn.teams.filter((t) => t.league === league);
      if (!teams.length && !named) return send(404, { code: 404 });
      const team = (t) => ({ ...rawTeam(t), isActive: true, ...(t.color ? { color: t.color } : {}), ...(t.logo ? { logos: [{ href: t.logo }] } : {}) });
      return send(200, { sports: [{ leagues: [{ name: named?.name ?? league, abbreviation: named?.short ?? m[2].toUpperCase(), slug: m[2], teams: teams.map((t) => ({ team: team(t) })) }] }] });
    }
    if ((m = u.pathname.match(/^\/apis\/site\/v2\/sports\/([^/]+)\/([^/]+)\/teams\/([^/]+)\/schedule$/))) {
      // A team's games, as ESPN's schedule lists them: its season's stage in `seasonType`, only the stage asked (seasontype).
      const league = `${m[1]}/${m[2]}`;
      const id = decodeURIComponent(m[3]);
      const t = teamOf(id);
      if (!t || t.league !== league) return send(404, { code: 404 });
      const type = Number(u.searchParams.get("seasontype")) || null;
      const events = espn.events
        .filter((e) => e.league === league && (e.home === id || e.away === id) && (!type || SLUGS[e.stage || "regular"][0] === type))
        .map((e) => {
          const { season, ...rest } = rawEvent(e);
          // Its scores as ESPN's schedule writes them, and no line (the schedule has none).
          rest.competitions = rest.competitions.map(({ odds, ...c }) => ({ ...c, competitors: c.competitors.map((x) => ({ ...x, score: e.score ? { value: Number(x.score), displayValue: x.score } : undefined })) }));
          return { ...rest, season: { year: season.year }, seasonType: { type: season.type } };
        });
      return send(200, { team: { id, displayName: t.name }, events });
    }
    if ((m = u.pathname.match(/^\/apis\/site\/v2\/sports\/([^/]+)\/([^/]+)\/teams\/([^/]+)\/roster$/))) {
      const t = teamOf(decodeURIComponent(m[3]));
      if (!t || t.league !== `${m[1]}/${m[2]}`) return send(404, { code: 404 });
      // A position as ESPN gives it: its name, and its abbreviation where the roster says one (`abbr`: the recorded NFL season's).
      const athlete = (p) => ({ id: p.id, displayName: p.name, position: { displayName: p.position, ...(p.abbr ? { abbreviation: p.abbr } : {}) }, ...(p.headshot ? { headshot: { href: p.headshot } } : {}), ...(p.injuries ? { injuries: p.injuries } : {}) });
      return send(200, { athletes: (t.roster || []).map(athlete), coach: [{ id: "1", firstName: "ZT", lastName: "Manager" }] });
    }
    if ((m = u.pathname.match(/^\/apis\/site\/v2\/sports\/([^/]+)\/([^/]+)\/summary$/))) {
      const r = espn.replays.find((x) => x.league === `${m[1]}/${m[2]}` && x.event === u.searchParams.get("event"));
      if (r) {
        if (r.down) return send(503, { message: "the stand-in ESPN is down for this game" });
        const at = r.at();
        const body = replay.asOf(r.summary, at, { sport: r.sport });
        espn.answers.push({ event: r.event, at, plays: (body.plays ?? []).length + [...(body.drives?.previous ?? []), ...(body.drives?.current ? [body.drives.current] : [])].reduce((n, d) => n + (d.plays ?? []).length, 0) });
        res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "max-age=5" });
        return res.end(JSON.stringify(body));
      }
      const e = espn.events.find((x) => x.league === `${m[1]}/${m[2]}` && x.id === u.searchParams.get("event"));
      if (!e || (!e.box && !e.clock)) return send(404, { code: 404 });
      const status = statusOf(e);
      const side = (id, homeAway, score) => ({ homeAway, team: rawTeam(teamOf(id)), score: score == null ? "0" : String(score), ...(e.clock && "possession" in e.clock ? { possession: e.clock.possession === id } : {}) });
      if (!e.box) {
        // A game on, without its box: the header (score, status, who has the ball) and the current drive's last play (football's
        // down and distance: its end, as ESPN writes it).
        const drive = e.clock.down ? { current: { team: rawTeam(teamOf(e.clock.possession)), plays: [{ id: `${e.id}1`, end: { shortDownDistanceText: e.clock.down, downDistanceText: `${e.clock.down} at midfield`, team: { id: e.clock.possession } } }] } } : null;
        return send(200, { header: { id: e.id, season: seasonOf(e), competitions: [{ date: e.at, status, competitors: [side(e.home, "home", e.score?.[0]), side(e.away, "away", e.score?.[1])] }] }, ...(drive ? { drives: drive } : {}) });
      }
      // A table's name where ESPN puts it: football's as `name` ("passing", "rushing": what football.ts's final reads; the recorded
      // NFL season's box scores, espn-snapshot.js), baseball's as `type` ("batting", "pitching").
      const named = m[1] === "football" ? "name" : "type";
      const players = Object.entries(e.box).map(([id, t]) => ({
        team: rawTeam(teamOf(id)),
        statistics: (t.tables || [t]).map((x) => ({ [named]: x.name, labels: x.labels, athletes: x.rows.map((r) => ({ starter: true, athlete: { id: r.id, displayName: r.name, position: { displayName: r.position } }, stats: r.stats })) })),
      }));
      return send(200, { header: { id: e.id, season: seasonOf(e), competitions: [{ status, competitors: [side(e.home, "home", e.score?.[0]), side(e.away, "away", e.score?.[1])] }] }, boxscore: { players }, ...(e.odds ? { pickcenter: [line(e.odds)] } : {}) });
    }
    if ((m = u.pathname.match(/^\/apis\/common\/v3\/sports\/([^/]+)\/([^/]+)\/athletes\/([^/]+)\/stats$/))) {
      const year = Number(u.searchParams.get("season"));
      const lines = espn.seasons[decodeURIComponent(m[3])] || [];
      const categories = [...new Set(lines.map((l) => l.name))].map((name) => {
        const rows = lines.filter((l) => l.name === name);
        return { name, displayName: rows[0].displayName, labels: rows[0].labels, statistics: rows.map((l) => ({ season: { year: l.year, displayName: l.season || String(l.year) }, teamSlug: "zt-team", stats: l.stats })) };
      });
      return send(200, { categories: categories.filter((c) => c.statistics.some((r) => r.season.year === year)) });
    }
    if ((m = u.pathname.match(/^\/v2\/sports\/([^/]+)\/leagues\/([^/]+)\/seasons\/(\d+)\/types(?:\/(\d+))?$/))) {
      // L8: a season's stages, as the core lists them (refs at ESPN's own host), then each.
      const c = espn.calendars[`${m[1]}/${m[2]}`];
      if (!c || c.season !== Number(m[3])) return send(404, { code: 404 });
      if (!m[4]) return send(200, { count: c.stages.length, items: c.stages.map((s) => ({ $ref: `http://sports.core.api.espn.com/v2/sports/${m[1]}/leagues/${m[2]}/seasons/${m[3]}/types/${s.type}?lang=en` })) });
      const s = c.stages.find((x) => x.type === Number(m[4]));
      return s ? send(200, { type: s.type, name: s.name, startDate: s.from, endDate: s.to }) : send(404, { code: 404 });
    }
    if ((m = u.pathname.match(/^\/apis\/v2\/sports\/([^/]+)\/([^/]+)\/standings$/))) {
      const league = `${m[1]}/${m[2]}`;
      const st = espn.standings[league];
      if (!st) return send(404, { code: 404 });
      return send(200, standingsOf(league, st));
    }
    if (u.pathname === "/v2/sports") {
      const sports = [...new Set([...espn.teams.map((t) => t.league), ...espn.leagues.map((l) => l.league)].map((l) => l.split("/")[0]))];
      return send(200, { items: sports.map((s) => ({ $ref: `http://sports.core.api.espn.com/v2/sports/${s}?lang=en` })) });
    }
    if ((m = u.pathname.match(/^\/v2\/sports\/([^/]+)\/leagues$/))) {
      const all = [...new Set([...espn.teams.map((t) => t.league), ...espn.leagues.map((l) => l.league)])].filter((l) => l.startsWith(`${m[1]}/`));
      return send(200, { items: all.map((l) => ({ $ref: `http://sports.core.api.espn.com/v2/sports/${m[1]}/leagues/${l.split("/")[1]}?lang=en` })) });
    }
    return send(404, { code: 404, message: "not in the stand-in" });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  espn.url = `http://127.0.0.1:${server.address().port}`;
  espn.close = () => new Promise((r) => server.close(r));
  return espn;
}

module.exports = { start };
