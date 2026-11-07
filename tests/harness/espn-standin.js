// A stand-in for ESPN's site, web and core APIs, answering a field's or a card's recorded answer (tests/fixtures/espn/: golf's board
// and leaderboard, a race weekend's board and core, a card's board, FightCenter, rounds and core) call by call, as the phone's
// pollers ask them (src/lib/sports/live-event.ts's feeds) and the server's eventFinal does (src/lib/server/sports/espn.ts).
//
//   const { espn } = require("./harness/espn-standin");
//   const api = espn(() => answer, (kind, url) => undefined);   // api.fetch, api.calls, api.count(kind)
const clone = (x) => JSON.parse(JSON.stringify(x));

/** A stand-in for ESPN's site, web and core APIs: `answer()` the answer of record-espn.js's as of now (its board, FightCenter and
 *  core), `override(kind, url)` a call's own body or status first; every call logged by its kind. ESPN's 404 where the answer has
 *  none. */
function espn(answer, override = () => undefined) {
  const calls = [];
  const fetch = async (url) => {
    const a = answer();
    const reply = (kind, body) => {
      calls.push({ kind, url });
      const mine = override(kind, url);
      if (typeof mine === "number") return { ok: false, status: mine, json: async () => ({}) };
      const b = mine === undefined ? body : mine;
      return b == null ? { ok: false, status: 404, json: async () => ({}) } : { ok: true, status: 200, json: async () => clone(b) };
    };
    if (url.includes("/fightcenter/")) return reply("fightcenter", a.fightcenter);
    if (url.includes("/golf/leaderboard?")) return reply("leaderboard", a.leaderboard);
    if (url.includes("/scoreboard/")) return reply("board", a.board);
    let m = /\/racing\/leagues\/[^/]+\/events\/[^/]+\/competitions\/([^/]+)\/competitors(?:\/([^/?]+)\/(statistics|status))?/.exec(url);
    if (m) {
      const cs = a.core?.[m[1]]?.competitors ?? [];
      if (!m[2]) return reply("list", { items: cs.map((c) => ({ ...c, statistics: { $ref: "link" }, status: { $ref: "link" } })) });
      return reply(m[3], cs.find((c) => String(c.id) === m[2])?.[m[3]]);
    }
    m = /\/mma\/leagues\/[^/]+\/events\/[^/?]+(?:\/competitions\/([^/]+)\/(plays|competitors\/([^/]+)\/statistics))?/.exec(url);
    if (m && !m[1]) return reply("event", a.event);
    if (m && m[2] === "plays") return reply("plays", { items: a.core?.[m[1]]?.plays ?? [] });
    if (m) return reply("statistics", a.core?.[m[1]]?.competitors?.find((c) => String(c.id) === m[3])?.statistics);
    throw new Error(`nothing stands in for ${url}`);
  };
  return { fetch, calls, count: (kind, since = 0) => calls.slice(since).filter((c) => c.kind === kind).length };
}

module.exports = { espn };
