// Dev-only fixture: "ZT Castle Game", a show someone adds and makes a game on a RESEARCHED rulebook (researched-traitors.json:
// what research wrote for a real Traitors season on 2026-10-27, renamed; no cast names in it), with nobody playing it. Shared
// by check-research-asks.js (results looked up for a show you watch) and check-maker-scoring.js (the maker edits its scoring).
//
//   const fx = require("./castle-fixture");
//   const users = await fx.up(pool);                       // zt_ra_watcher (adds it, makes it a game), zt_ra_friend, zt_ra_late
//   const tv = await fakeListings.start({ shows: [...fakeListings.shows(), fx.castleShow()] });
//   const bot = await fakeBot.start({ answer: (p, kind) => fx.answer(p, kind) });   // or wrap it (failures, a new question)
//   const sid = await fx.makeGame(as.watcher, { seen: 4 });  // added (on Episode 4), made a game through the real API
//   await fx.down(pool);                                   // zt_ra_ people, the show 990041 and everything it made
//
// The show: TVmaze 990041, season 5, six weekly episodes, four aired, its six people in every episode's guest cast with
// photos (the showcase's, by made-up names). The stand-in bot's answers: how it works (the researched rulebook), who's in it
// (names, no photos), the recaps, and each episode's full research from the prompt's own skeleton (everyone answered with
// high confidence, OUT[n] murdered, someone still in answering yes to the first yes/no question).
const crypto = require("crypto");
const fakeListings = require("./fake-listings");

const PASSWORD = "zt-pass-12345";
const PEOPLE = ["watcher", "friend", "late"];
const TV_ID = 990041;
const SLUG = "zt-castle-game";
const SHOW = "ZT Castle Game";
const CAST = ["Ada Moat", "Bea Tower", "Cal Keep", "Dot Gate", "Eli Hall", "Fay Spire"];
// Stand-in faces (the showcase's, already in the repo), by the cast's made-up names.
const PHOTOS = ["abbey-benjamin", "abby-lee", "arisa-thomas", "ben-mcdonnell", "clyde-moser", "jay-vinnedge"].map((f) => `/mock/showcase/img/the-traitors-us-5/${f}.jpg`);
// Who goes in each episode (murdered: the researched rulebook's way out).
const OUT = { 1: "Ada Moat", 2: "Bea Tower", 3: "Dot Gate", 4: "Cal Keep" };
const RULEBOOK = require("./researched-traitors.json");
const fence = "```";

async function down(pool) {
  const { rows } = await pool.query(`SELECT id FROM "user" WHERE username LIKE 'zt\\_ra\\_%'`);
  const ids = rows.map((r) => r.id);
  await pool.query(`DELETE FROM leagues WHERE slug LIKE 'zt-ra-%'`);
  await pool.query(`DELETE FROM admin_changes WHERE user_id = ANY($1::text[])`, [ids]);
  // Its season, cast, rulebook, setup, research, results, asks, runs and follows go with the show.
  await pool.query(`DELETE FROM shows WHERE tvmaze_id = $1 OR slug = $2`, [TV_ID, SLUG]);
  await pool.query(`DELETE FROM show_formats WHERE id = $1`, [`made-${SLUG}`]);
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_ra\\_%'`); // sessions, accounts, notifications cascade
}

/** The three people (new design), the fixture taken down first. Answers their user ids by name. */
async function up(pool) {
  await down(pool);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const users = {};
  for (const who of PEOPLE) {
    users[who] = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const name = `zt_ra_${who}`;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, now(), now())`,
      [users[who], name, `${name}@example.invalid`]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
      crypto.randomUUID(),
      users[who],
      hash,
    ]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [users[who]]);
  }
  return users;
}

/** The show, with its six people in every episode's guest cast (TVmaze's shape: "Self - Contestant"). */
function castleShow() {
  const season = fakeListings.shows().find((s) => s.show.id === 990002).seasons[0]; // a weekly season to borrow the shape of
  const now = Date.now();
  const DAY = 24 * 3600 * 1000;
  const last = now - 3 * DAY;
  const at = (n) => {
    const d = new Date(last - (4 - n) * 7 * DAY);
    d.setUTCHours(1, 0, 0, 0);
    return d;
  };
  const episodes = Array.from({ length: 6 }, (_, i) => ({
    id: 990041500 + i + 1, season: 5, number: i + 1, type: "regular", name: `Night ${i + 1}`,
    airdate: at(i + 1).toISOString().slice(0, 10), airtime: "21:00", airstamp: at(i + 1).toISOString(), runtime: 60,
  }));
  return {
    show: { id: TV_ID, name: SHOW, type: "Reality", genres: ["Mystery"], status: "Running", premiered: episodes[0].airdate, network: { name: "ZT Network", country: { name: "United States", code: "US", timezone: "America/New_York" } }, webChannel: null, image: { medium: "/mock/showcase/art/traitors.jpg", original: "/mock/showcase/art/traitors.jpg" }, url: `https://www.tvmaze.com/shows/${TV_ID}`, schedule: { time: "21:00", days: ["Thursday"] } },
    seasons: [{ season: { ...season.season, id: 9900415, number: 5, episodeOrder: 6, premiereDate: episodes[0].airdate, endDate: episodes[5].airdate }, episodes }],
    guestCast: CAST.map((name, i) => ({ person: { id: 0, name, image: { medium: PHOTOS[i] } }, character: { id: 0, name: "Self - Contestant", image: null }, self: true, voice: false })),
  };
}

/** A full research prompt's skeleton, parsed, and its episode. */
function skeletonOf(prompt) {
  const at = prompt.indexOf("Start from this skeleton");
  const a = JSON.parse(prompt.slice(prompt.indexOf("{", at), prompt.lastIndexOf("}") + 1));
  const n = Number(a.episodeNumber ?? a.episode ?? (prompt.match(/[Ee]pisode (\d+)/) || [])[1]);
  return { a, n };
}

/** A full answer from the prompt's own skeleton: everyone answered (high confidence), one murdered, one who did something.
 *  `edit(a, n)` changes the parsed answer before it's sent (a new question's answer, say). */
function fullAnswer(prompt, edit = null) {
  const { a, n } = skeletonOf(prompt);
  for (const k of Object.keys(a)) if (a[k] === "unknown") a[k] = "no";
  a.summary = `Night ${n}.`;
  for (const c of a.castaways) {
    for (const k of Object.keys(c)) if (c[k] === "unknown") c[k] = "no";
    Object.assign(c, { sources: [`https://example.invalid/castle/${n}`], confidence: "high" });
  }
  const gone = a.castaways.find((c) => c.name === OUT[n]);
  if (!gone || !("leftTheGame" in gone)) throw new Error(`episode ${n}'s skeleton: no ${OUT[n]} or no leftTheGame (${JSON.stringify(a.castaways[0])})`);
  Object.assign(gone, { leftTheGame: "yes", exitMethod: "Murdered" });
  // Something that scores: someone still in answers yes to the first yes/no question that isn't about leaving.
  const doer = a.castaways.find((c) => c.name !== OUT[n]);
  const q = Object.keys(doer).find((k) => doer[k] === "no" && !/left|exit|out/i.test(k));
  if (q) doer[q] = "yes";
  if (edit) edit(a, n);
  return { n, text: `${fence}json\n${JSON.stringify(a)}\n${fence}` };
}

/** The recaps' answer: a line for each episode asked about. */
function recapAnswer(prompt) {
  const ns = [...prompt.matchAll(/^- Episode (\d+)/gm)].map((m) => Number(m[1]));
  return JSON.stringify({ episodes: ns.map((n) => ({ number: n, summary: `Night ${n} at the castle: someone was murdered.` })) });
}

/** The stand-in bot's answer to any of the show's questions (a check wraps it for failures and its own questions). */
function answer(prompt, kind) {
  if (kind === "setup") return `Here's how it works:\n${fence}json\n${JSON.stringify(RULEBOOK)}\n${fence}`;
  if (kind === "cast") return `${fence}json\n${JSON.stringify({ castaways: CAST.map((name) => ({ name, photoUrl: "", startingRole: "Faithful" })), sources: ["https://example.invalid/cast"] })}\n${fence}`;
  if (/Search the web for what happened in each/.test(prompt)) return recapAnswer(prompt);
  if (kind === "full") return fullAnswer(prompt).text;
  throw new Error(`no answer for a ${kind} question`);
}

/** As `maker` (an api() session with the stand-ins' headers): add the show (on Episode `seen`), make it a game through Make it
 *  a game's real API (our bot asks, the review, Looks right). Answers the season's id. */
async function makeGame(maker, { seen = 4 } = {}) {
  const added = await maker.call("POST", "/api/me/shows", { listing: TV_ID, seenThrough: seen });
  if (added.status !== 200) throw new Error(`adding the show: ${added.status} ${JSON.stringify(added.body)}`);
  const sid = added.body.seasonId;
  const asked = await maker.call("POST", `/api/seasons/${sid}/make`, { action: "ask" });
  if (asked.status !== 200) throw new Error(`Make it a game: ${asked.status} ${JSON.stringify(asked.body)}`);
  for (let i = 0; i < 100; i++) {
    if (!(await maker.call("GET", `/api/seasons/${sid}/make?poll=1`)).body?.asking) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  const ok = await maker.call("POST", `/api/seasons/${sid}/make`, { action: "confirm" });
  if (ok.status !== 200) throw new Error(`Looks right: ${ok.status} ${JSON.stringify(ok.body)}`);
  return sid;
}

module.exports = { PASSWORD, PEOPLE, TV_ID, SLUG, SHOW, CAST, PHOTOS, OUT, RULEBOOK, down, up, castleShow, skeletonOf, fullAnswer, recapAnswer, answer, makeGame };
