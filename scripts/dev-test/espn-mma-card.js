// Dev-only: a fight card's answers from ESPN, as src/lib/sports/mma.ts reads them (BoutAnswer; docs/PLAN-start-a-game-gpt.md
// track L, L5 part 4a): the card's board (`site.api.espn.com/apis/site/v2/sports/mma/<league>/scoreboard/<event>`: its bouts in
// the order fought, each fighter, the winner, the round and time it ended, the judges' totals), its FightCenter
// (`site.web.api.espn.com/apis/common/v3/sports/mma/<league>/fightcenter/<event>`: each bout's result and how, the judges'
// scores, each fighter's totals; its videos, news and menus dropped) and, from ESPN's core API, the card's rounds (its event:
// "3 Rnd (5-5-5)") and each bout's status (its result) and plays (round by round, timed) with each fighter's statistics
// (`full`: two calls a bout more), a few calls at a time.
// Shared by check-bout-reduce.js (its cache), record-espn.js (fixtures) and record-espn-live.js (the live recorder and its
// --compare). No app server, no database; real calls.
//
//   const { mmaCard, cachedMmaCard } = require("./espn-mma-card");
//   await mmaCard({ league: "ufc", event: "600057024" })              // { board, fightcenter, event, core, complete }
//   await mmaCard({ league, event, have: { board, fightcenter, event }, bouts: ["401836543"], full: false })  // just those bouts' core
//   await cachedMmaCard(cacheDir, { league, event })                   // mma-<league>-card-<event>.json, kept once final
const fs = require("fs");
const path = require("path");

const SITE = "https://site.api.espn.com/apis/site/v2/sports/mma";
const WEB = "https://site.web.api.espn.com/apis/common/v3/sports/mma";
const CORE = "https://sports.core.api.espn.com/v2/sports/mma/leagues";
/** The FightCenter's parts the readers don't read (~90% of its bytes). */
const HEAVY = ["videos", "news", "menus", "meta"];

/** A card over for good: final, or called off. */
const over = (board) => board?.status?.type?.state === "post";

/** The core event's bouts, only their rounds: `{ competitions: [{ id, description, format }] }`. */
const eventRounds = (ev) => (ev ? { competitions: (ev.competitions ?? []).map((c) => ({ id: String(c.id), description: c.description ?? null, format: c.format?.regulation ? { regulation: { periods: c.format.regulation.periods, clock: c.format.regulation.clock } } : undefined })) } : null);

/**
 * The card's answers: `{ board, fightcenter, event, core, complete }`. `core` is each bout's `{ status, plays, competitors }` by
 * its id (a competitor's `statistics` in place of ESPN's link when `full`); `complete`: every call answered. `core: false`: the
 * board and the FightCenter alone (a phone's two calls). `bouts`: only these bouts' core (a live recorder's bouts on). `have`:
 * the board, FightCenter and event already had (only the core is asked). `wire` ({ calls, bytes, raw }) counts what came over
 * it. Null when the board doesn't answer.
 */
async function mmaCard({ league, event, full = true, core = true, bouts = null, wire = null, batch = 8, have = null }) {
  let complete = true;
  const get = async (url) => {
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": "GameYourShow/1.0", "Accept-Encoding": "gzip" } });
    } catch {
      complete = false;
      return null;
    }
    const text = await res.text();
    if (wire) {
      wire.calls++;
      wire.bytes += Number(res.headers.get("content-length")) || 0;
      wire.raw += text.length;
    }
    // A 404 is ESPN's answer that there's none (a bout with no statistics: the PFL's, the smaller leagues'), not a failure.
    if (!res.ok) {
      if (res.status !== 404) complete = false;
      return null;
    }
    return JSON.parse(text);
  };
  const board = have?.board ?? (await get(`${SITE}/${league}/scoreboard/${event}`));
  if (!board) return null;
  const fc = have ? have.fightcenter ?? null : await get(`${WEB}/${league}/fightcenter/${event}?region=us&lang=en&contentorigin=espn`);
  if (fc && !have) for (const k of HEAVY) delete fc[k];
  const out = { board, fightcenter: fc, core: {}, complete: true };
  if (core) {
    const ids = (board.competitions ?? []).map((c) => String(c.id)).filter((id) => !bouts || bouts.includes(id));
    const base = `${CORE}/${league}/events/${event}/competitions`;
    // The core's event: each bout's rounds as ESPN describes them ("3 Rnd (5-5-5)", "3 Rnd + OT (5-5-5-5)": a tournament's
    // overtime round), which the board's `format` counts as one number.
    out.event = have?.event ?? eventRounds(await get(`${CORE}/${league}/events/${event}`));
    for (let i = 0; i < ids.length; i += batch) {
      const some = await Promise.all(
        ids.slice(i, i + batch).map(async (id) => {
          const comp = (board.competitions ?? []).find((c) => String(c.id) === id);
          const [status, plays] = await Promise.all([get(`${base}/${id}/status`), get(`${base}/${id}/plays?limit=1000`)]);
          const competitors = await Promise.all(
            (comp?.competitors ?? []).map(async (c) => {
              const statistics = full ? await get(`${base}/${id}/competitors/${c.id}/statistics`) : null;
              return { id: String(c.id), order: c.order, winner: c.winner, ...(statistics ? { statistics: { splits: statistics.splits } } : {}) };
            }),
          );
          return [id, { status: status ? { ...status, $ref: undefined } : null, plays: (plays?.items ?? []).map((p) => ({ ...p, $ref: undefined })), competitors }];
        }),
      );
      for (const [id, x] of some) out.core[id] = x;
    }
  }
  out.complete = complete;
  return out;
}

/** The card's answers from the cache (mma-<league>-card-<event>.json), else asked, and kept only when the card's over and every
 *  call answered, so a failed or partial answer is asked again. */
async function cachedMmaCard(cacheDir, { league, event, wire = null }) {
  const at = path.join(cacheDir, `mma-${league}-card-${event}.json`);
  if (fs.existsSync(at)) return JSON.parse(fs.readFileSync(at, "utf8"));
  const got = await mmaCard({ league, event, wire });
  if (got && over(got.board) && got.complete) fs.writeFileSync(at, JSON.stringify(got));
  return got;
}

module.exports = { mmaCard, cachedMmaCard, over, eventRounds, CORE };
