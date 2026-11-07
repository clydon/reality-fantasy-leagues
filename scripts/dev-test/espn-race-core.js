// Dev-only: a race session's answer from ESPN's core API, as src/lib/sports/racing.ts reads it (FieldAnswer.core; docs/
// PLAN-start-a-game-gpt.md track L, L5 part 3b): the session's competitors (one call: their order, grid and car) and, `full`,
// each one's statistics and F1's status in place of ESPN's links (a call each, a few at a time; NASCAR's and IndyCar's
// statuses are a 400). Shared by check-field-reduce.js (its cache), record-espn.js (fixtures) and record-espn-live.js (the live
// recorder and its --compare). No app server, no database; real calls.
//
//   const { raceCore, cachedRaceCore } = require("./espn-race-core");
//   await raceCore({ series: "f1", event: "600052046", session: "401737705" })  // { competitors, complete }
//   await cachedRaceCore(cacheDir, { series, event, session, done })             // racing-<series>-core-<event>-<session>.json
const fs = require("fs");
const path = require("path");

const CORE = "https://sports.core.api.espn.com/v2/sports/racing/leagues";

/** A competitor without ESPN's links to its statistics and status. */
function bare(c) {
  const o = { ...c };
  delete o.statistics;
  delete o.status;
  return o;
}

/**
 * The session's core answer: `{ competitors, complete }` (`complete`: every driver's statistics answered; F1's status can be
 * missing, as for 2026's sprint qualifying), or null when ESPN doesn't answer the list. `wire` ({ calls, bytes, raw }) counts
 * what came over it. `full` false: the list alone (order, grid, car), ESPN's links dropped.
 */
async function raceCore({ series, event, session, full = true, wire = null, batch = 8 }) {
  const base = `${CORE}/${series}/events/${event}/competitions/${session}/competitors`;
  const get = async (url) => {
    const res = await fetch(url, { headers: { "User-Agent": "GameYourShow/1.0", "Accept-Encoding": "gzip" } });
    const text = await res.text();
    if (wire) {
      wire.calls++;
      wire.bytes += Number(res.headers.get("content-length")) || 0;
      wire.raw += text.length;
    }
    return res.ok ? JSON.parse(text) : null;
  };
  const list = await get(`${base}?limit=200`);
  if (!list) return null;
  const items = list.items ?? [];
  if (!full) return { competitors: items.map(bare), complete: true };
  let complete = true;
  const competitors = [];
  for (let i = 0; i < items.length; i += batch) {
    const some = await Promise.all(
      items.slice(i, i + batch).map(async (c) => {
        const statistics = await get(`${base}/${c.id}/statistics`);
        const status = series === "f1" ? await get(`${base}/${c.id}/status`) : null;
        if (!statistics) complete = false;
        return { ...bare(c), ...(statistics ? { statistics } : {}), ...(status ? { status } : {}) };
      }),
    );
    competitors.push(...some);
  }
  return { competitors, complete };
}

/** The session's core answer from the cache (racing-<series>-core-<event>-<session>.json), else asked, and kept only when
 *  `done` (the session's over) and complete with someone in it, so a failed or partial answer is asked again. */
async function cachedRaceCore(cacheDir, { series, event, session, done, wire = null }) {
  const at = path.join(cacheDir, `racing-${series}-core-${event}-${session}.json`);
  if (fs.existsSync(at)) return JSON.parse(fs.readFileSync(at, "utf8"));
  const got = await raceCore({ series, event, session, wire });
  const out = { competitors: got?.competitors ?? [] };
  if (done && got?.complete && out.competitors.length) fs.writeFileSync(at, JSON.stringify(out));
  return out;
}

module.exports = { raceCore, cachedRaceCore };
