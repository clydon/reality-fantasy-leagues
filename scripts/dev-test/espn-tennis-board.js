// Dev-only: a tennis event's answer from ESPN, as src/lib/sports/tennis.ts reads it (BoutAnswer; docs/PLAN-start-a-game-gpt.md
// track L, L5 part 4b): its board (`site.api.espn.com/apis/site/v2/sports/tennis/<tour>/scoreboard/<event>`, one call: every
// draw's matches, their sets, who won, ESPN's note), and a tour's events of a season from ESPN's core API (one call). Nothing
// else has more (no summary; the core's match has no statistics or plays: tennis.ts's header). Shared by check-draw-reduce.js
// (its cache), record-espn.js (fixtures) and record-espn-live.js (the live recorder's --compare). No app server, no database;
// real calls.
//
//   const { tennisBoard, cachedTennisBoard, tennisEvents, drawOver, matchOver } = require("./espn-tennis-board");
//   await tennisBoard({ tour: "atp", event: "23-2026", wire })       // the board, or null
//   await cachedTennisBoard(cacheDir, { tour, event })                // tennis-<tour>-board-<event>.json, kept once every match is over
//   await tennisEvents({ tour: "atp", year: 2026 })                   // ["970-2026", ...], in ESPN's order (the calendar's)
const fs = require("fs");
const path = require("path");

const SITE = "https://site.api.espn.com/apis/site/v2/sports/tennis";
const CORE = "https://sports.core.api.espn.com/v2/sports/tennis/leagues";

/** Every match of a board, each once. */
const drawMatches = (board) => {
  const seen = new Set();
  return (board?.groupings ?? []).flatMap((g) => g.competitions ?? []).filter((c) => !seen.has(String(c.id)) && seen.add(String(c.id)));
};

/** A match over: tennis.ts's own (a live board's STATUS_SUSPENDED is "post", a stall it comes back from), loaded once needed. */
let tennis = null;
const matchOver = (c) => {
  tennis ??= require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } })("../../src/lib/sports/tennis.ts");
  return tennis.matchOver(c);
};

/** An event over for good: every match over or called off, none to come (ESPN's own status for the event says final all week),
 *  and its last day gone. */
const drawOver = (board) => {
  const ms = drawMatches(board);
  return ms.length > 0 && ms.every(matchOver) && (!board.endDate || Date.parse(board.endDate) < Date.now());
};

async function get(url, wire) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "GameYourShow/1.0", "Accept-Encoding": "gzip" } });
    const text = await res.text();
    if (wire) {
      wire.calls++;
      wire.bytes += Number(res.headers.get("content-length")) || 0;
      wire.raw += text.length;
    }
    return res.ok ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/** The event's board, or null when ESPN doesn't answer. */
const tennisBoard = ({ tour, event, wire = null }) => get(`${SITE}/${tour}/scoreboard/${event}`, wire);

/** The board from the cache (tennis-<tour>-board-<event>.json), else asked, and kept only once the event's over. */
async function cachedTennisBoard(cacheDir, { tour, event, wire = null }) {
  const at = path.join(cacheDir, `tennis-${tour}-board-${event}.json`);
  if (fs.existsSync(at)) return JSON.parse(fs.readFileSync(at, "utf8"));
  const board = await tennisBoard({ tour, event, wire });
  if (board && drawOver(board)) fs.writeFileSync(at, JSON.stringify(board));
  return board;
}

/** A tour's events of a season (ESPN's core API: "970-2026" ...). */
async function tennisEvents({ tour, year, wire = null }) {
  const got = await get(`${CORE}/${tour}/seasons/${year}/types/2/events?limit=300`, wire);
  return (got?.items ?? []).map((i) => /events\/([^?]+)/.exec(i.$ref ?? "")?.[1]).filter(Boolean);
}

module.exports = { tennisBoard, cachedTennisBoard, tennisEvents, drawOver, drawMatches, matchOver };
