// Dev-only: a stand-in for ESPN (src/lib/server/sports/espn.ts), so a check can link a sport's episodes to "ESPN's" games
// (docs/PLAN-sports-data.md step 2) without the real one. One origin answers for all three of ESPN's hosts, as espn(base) asks:
//   GET /apis/search/v2?query=        teams and leagues whose names hold every word asked (case-insensitive), as ESPN's search
//                                     answers: { results: [{ type: "team" | "league", contents: [...] }] }
//   GET /apis/site/v2/sports/:sport/:league/scoreboard?dates=YYYYMMDD   that league's events starting that day in the East
//   GET /apis/site/v2/sports/:sport/:league/teams/:id/roster            a team's players (`roster` on the team; [] for none, as
//                                     ESPN's AFL rosters come back), its manager apart (ESPN's `coach`), else 404
//   GET /apis/site/v2/sports/:sport/:league/summary?event=              a game's box score from its `box` (each team's lines), else 404
//   GET /apis/common/v3/sports/:sport/:league/athletes/:id/stats?season= an athlete's season lines from `seasons` (ESPN's
//                                     categories, each with that year's row), { categories: [] } for one it has none for
//   GET /v2/sports, /v2/sports/:sport/leagues                           the index, as refs
//
//   const espn = await require("./fake-espn").start({ teams, leagues, events, seasons });
//   // teams:   [{ id, name, short, location, abbreviation, league: "baseball/zt-mlb", roster?: [{ id, name, position, headshot? }] }]
//   // leagues: [{ league: "baseball/zt-little", name: "ZT Little League World Series" }]
//   // events:  [{ league, id, at (ISO), home: teamId, away: teamId, state: "pre" | "in" | "post", score?: [home, away], note?,
//   //             stage?: "pre" | "regular" | "post" (its season's, as ESPN's slug says it; "regular" unless said),
//   //             box?: { [teamId]: { labels: ["D", "G"], rows: [{ id, name, position, stats: ["21", "2"] }] }
//   //                            or { tables: [{ name: "batting", labels, rows }, { name: "pitching", labels, rows }] } } }]
//   //          or a field's event (a race): [{ league, id, at, name, state, field: [{ id, name, headshot? }] }] (its order the place)
//   // seasons: { [athleteId]: [{ year, name: "career-batting", displayName: "Career Batting", season?: "2026", labels, stats }] }
//   espn.url (pass to espn(base));  espn.asked (paths asked, in order);  espn.down = true (every call 503s);
//   espn.events.push(...) (a game scheduled later);  await espn.close();
//
// No database and no app server. Names start "ZT " so nothing it answers can be mistaken for a real team.
const http = require("http");
const { eastern } = require("./fake-listings");

const words = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const holds = (name, q) => {
  const have = new Set(words(name));
  const want = words(q);
  return want.length > 0 && want.every((w) => have.has(w));
};

async function start(opts = {}) {
  const espn = { asked: [], down: false, url: null, teams: opts.teams || [], leagues: opts.leagues || [], events: opts.events || [], seasons: opts.seasons || {} };
  const teamOf = (id) => espn.teams.find((t) => t.id === id);
  const rawTeam = (t) => ({ id: t.id, displayName: t.name, shortDisplayName: t.short, name: t.short, location: t.location, abbreviation: t.abbreviation });
  const SLUGS = { pre: [1, "preseason"], regular: [2, "regular-season"], post: [3, "post-season"] };
  const seasonOf = (e) => {
    const [type, slug] = SLUGS[e.stage || "regular"];
    return { year: new Date(e.at).getUTCFullYear(), type, slug };
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
      const day = (u.searchParams.get("dates") || "").replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
      const events = espn.events
        .filter((e) => e.league === league && eastern(Date.parse(e.at)).date === day)
        .map((e) => {
          const status = { type: { state: e.state, completed: e.state === "post" } };
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
                competitors: [
                  { homeAway: "home", team: rawTeam(home), score: e.score ? String(e.score[0]) : "0", winner: e.state === "post" && e.score ? e.score[0] > e.score[1] : undefined },
                  { homeAway: "away", team: rawTeam(away), score: e.score ? String(e.score[1]) : "0", winner: e.state === "post" && e.score ? e.score[1] > e.score[0] : undefined },
                ],
              },
            ],
          };
        });
      return send(200, { leagues: [{ slug: m[2] }], events });
    }
    if ((m = u.pathname.match(/^\/apis\/site\/v2\/sports\/([^/]+)\/([^/]+)\/teams\/([^/]+)\/roster$/))) {
      const t = teamOf(decodeURIComponent(m[3]));
      if (!t || t.league !== `${m[1]}/${m[2]}`) return send(404, { code: 404 });
      const athlete = (p) => ({ id: p.id, displayName: p.name, position: { displayName: p.position }, ...(p.headshot ? { headshot: { href: p.headshot } } : {}) });
      return send(200, { athletes: (t.roster || []).map(athlete), coach: [{ id: "1", firstName: "ZT", lastName: "Manager" }] });
    }
    if ((m = u.pathname.match(/^\/apis\/site\/v2\/sports\/([^/]+)\/([^/]+)\/summary$/))) {
      const e = espn.events.find((x) => x.league === `${m[1]}/${m[2]}` && x.id === u.searchParams.get("event"));
      if (!e || !e.box) return send(404, { code: 404 });
      const status = { type: { state: e.state, completed: e.state === "post" } };
      const side = (id, homeAway, score) => ({ homeAway, team: rawTeam(teamOf(id)), score: score == null ? "0" : String(score) });
      const players = Object.entries(e.box).map(([id, t]) => ({
        team: rawTeam(teamOf(id)),
        statistics: (t.tables || [t]).map((x) => ({ type: x.name, labels: x.labels, athletes: x.rows.map((r) => ({ starter: true, athlete: { id: r.id, displayName: r.name, position: { displayName: r.position } }, stats: r.stats })) })),
      }));
      return send(200, { header: { id: e.id, season: seasonOf(e), competitions: [{ status, competitors: [side(e.home, "home", e.score?.[0]), side(e.away, "away", e.score?.[1])] }] }, boxscore: { players } });
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
