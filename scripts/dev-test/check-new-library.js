// Dev-only check for rulebooks phase 8, the library and the new-show flow (docs/PLAN-new-design.md step 10 part 3), against the
// dev server, on new-fixture.js's couch (alex, riley, jordan, sam; alex and casey also on "ZT Extra"), the desk's own admin
// (zt_nd_desk, made here), a stand-in for TVmaze (fake-listings.js, plus shows this check adds: ZT Rally and ZT Speedway, two
// race series; ZT Harbour Crew and ZT Coast Guard, reality series; ZT Night Desk, a talk show) and a stand-in for our bot
// (fake-bot.js).
//   API:
//   - the library: templates by kind (the built-ins' mirrors), the design plan's proposed shapes, drafts, rulebooks in use;
//     the desk's only (403 for anyone else); a made show's stored format never becomes a template (the old leak);
//   - a rulebook alex made with Make it a game: in the Inbox ("nobody on another couch has checked it") and under Made by
//     players; casey's couch says "Looks right to us" from How it works (alex's own couch can't), it reads "checked by another
//     couch" and leaves the Inbox; the desk takes it over (and History's Undo puts it back); Fits these games on its page;
//   - Save as a starting point from its season's rulebook: a series template, its show's name left blank; the desk edits the
//     template (a fix on a library rulebook); Make it a game's prompt for another reality series starts from it (templateFor
//     reads the library: the newest the desk saved for the kind, a show of its family by name); offered or not, Delete;
//   - New show (the desk's): a listing made without following it; started from the template (make-game.ts's template path:
//     the cast from the listing), set up checked as it's made, its parent the template, How it works "Made from the ZT Yacht
//     Life rulebook"; alex starts a Weekly Lineup on it (a series, end to end); a talk show through our bot: Fits these games
//     (Weekly Bingo and Weekly Calls, both startable since step 12) and How it works (a talk show, end to end);
//   - a set-up show's next season (New season on its show page): last season's rulebook, every change folded in, live;
//   - a show alex added by name: in the Inbox; the desk's show page; Looks fine (Undo brings it back); Archive;
//   - two race series made games: the Race series shape goes from proposed to earned; the earned template's examples
//     (Formula 1, NASCAR...) find it for a new show by name;
//   - nothing real changed: every real league's state and every rulebook that was here before.
//   In a real browser at --width (390 by default), as the desk: Find's Library and New show, the library (a proposed card's
//   toast, Make it a template on the earned one), a made rulebook's page (Take it over, Fits these games), a template's page,
//   New show from a listing to the template to Make it a game's review, Looks right and the desk link, a show added by name
//   (Looks fine), the Inbox; as casey: How it works' "Looks right to us". Nothing wider than the screen; no page errors.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-library.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js up and takes it down (--keep leaves it; the down removes zt_nd people, the
// shows they added, made formats and the library rulebooks saved from zt shows); touches zt rows only; refuses a non-local
// database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const fakeListings = require("./fake-listings");
const fakeBot = require("./fake-bot");
const { LIBRARY } = require("../../src/lib/game/formats/library/index.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-library runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-library.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;
const DESK = fixture.username("desk");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const clone = (v) => JSON.parse(JSON.stringify(v));
const fenced = (o) => `\`\`\`json\n${JSON.stringify(o, null, 1)}\n\`\`\``;
const answerFrom = (id, show) => fenced({ ...clone(LIBRARY[id].blocks), show });
const castAnswer = (people) => fenced({ castaways: people.map(([name, group]) => ({ name, photoUrl: "", startingGroup: group })), sources: ["https://example.invalid/cast"] });
/** A race series: everyone races every event and the order scores (the library's Race series shape). */
function raceAnswer(show) {
  const b = clone(LIBRARY["world-series"].blocks);
  return fenced({
    ...b,
    show,
    tagline: "Drivers race for the championship",
    premise: "Drivers race on a different track each weekend; where they finish earns championship points.",
    parts: { singular: "race", plural: "races", label: "Each race" },
    cast: { unit: "people", singular: "driver", plural: "drivers", usualSize: 20, groups: { type: "sides", singular: "team", change: "never" } },
    season: { phases: [{ id: "theSeason", name: "The season", starts: { type: "episode", n: 1 }, changes: [] }], finale: { decidedBy: "mostPoints" } },
    segments: [
      { id: "qualifying", name: "Qualifying", decidedBy: "result", takesPart: "everyone", decides: "fullOrder", onTheLine: "advantage", often: "everyEpisode" },
      { id: "race", name: "The race", decidedBy: "result", takesPart: "everyone", decides: "fullOrder", onTheLine: "points", often: "everyEpisode" },
    ],
    waysOut: [
      { id: "didNotFinish", name: "Did not finish", means: "outForOne" },
      { id: "injured", name: "Withdrawn injured", means: "out", cause: "medical" },
    ],
    twists: [],
    customMoments: [],
    points: {},
    leftOut: [],
  });
}
const DRIVERS = [["Ana Speed", "Red Team"], ["Bo Lap", "Red Team"], ["Cy Pole", "Blue Team"], ["Di Grid", "Blue Team"], ["Ed Pit", "Green Team"], ["Fi Flag", "Green Team"]];
const ANSWERS = {
  "ZT Yacht Life": { setup: () => answerFrom("below-deck", "ZT Yacht Life") },
  "ZT Rally": { setup: () => raceAnswer("ZT Rally"), cast: () => castAnswer(DRIVERS) },
  "ZT Speedway": { setup: () => raceAnswer("ZT Speedway"), cast: () => castAnswer(DRIVERS.map(([n, g]) => [`${n} Jr`, g])) },
  "ZT Night Desk": { setup: () => answerFrom("saturday-night-live", "ZT Night Desk") },
};
const showIn = (prompt) => Object.keys(ANSWERS).find((name) => prompt.includes(name));

/** More shows for the stand-in listings, each one of fake-listings' under a new id (and new season and episode ids). */
function moreShows(shows) {
  const like = (fromId, id, name, type, extra = {}) => {
    const base = clone(shows.find((s) => s.show.id === fromId));
    base.show = { ...base.show, id, name, type, url: `https://www.tvmaze.com/shows/${id}`, ...extra };
    base.seasons = base.seasons.map((s) => ({ season: { ...s.season, id: s.season.id + id * 10 }, episodes: s.episodes.map((e) => ({ ...e, id: e.id + id * 1000 })) }));
    return base;
  };
  const crewOf = (prefix) => ["Captain", "Chief Stew", "Bosun", "Chef", "Deckhand"].map((role, i) => ({ person: { id: 0, name: `${prefix} ${["Rivers", "Chief", "Sun", "Galley", "Deck"][i]}`, image: null }, character: { id: 0, name: role, image: null }, self: false, voice: false }));
  return [
    like(990012, 990014, "ZT Rally", "Sports"),
    like(990012, 990015, "ZT Speedway", "Sports"),
    { ...like(990011, 990016, "ZT Harbour Crew", "Reality"), cast: crewOf("Harbour") },
    { ...like(990011, 990018, "ZT Coast Guard", "Reality"), cast: crewOf("Coast") },
    { ...like(990011, 990019, "ZT Yacht Life Riviera", "Reality"), cast: crewOf("Riviera") },
    { ...like(990005, 990017, "ZT Night Desk", "Talk Show", { status: "Running", schedule: { time: "23:30", days: ["Thursday"] } }), seasons: like(990011, 990017, "x", "x").seasons },
  ];
}

const REAL_LEAGUES = "SELECT slug, md5(state::text) AS h FROM leagues WHERE slug NOT LIKE 'zt%' ORDER BY slug";
// Every rulebook that isn't the fixture's or this check's (theirs are named "ZT ...").
const RULEBOOKS = "SELECT id, version, is_template, status, review_status, md5(blocks::text) AS b FROM rulebooks WHERE name NOT LIKE 'ZT %' ORDER BY id";

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const tv = await fakeListings.start();
  tv.shows.push(...moreShows(tv.shows));
  const bot = await fakeBot.start({
    delayMs: 150,
    answer: (prompt, kind) => {
      const fn = ANSWERS[showIn(prompt)]?.[kind];
      if (!fn) throw new Error(`no answer for ${kind} about ${showIn(prompt) ?? "?"}`);
      return fn();
    },
  });
  const headers = { "x-gys-listings": tv.url, "x-gys-bot": bot.url };
  const closers = [];
  const realBefore = (await pool.query(REAL_LEAGUES)).rows;
  try {
    const fx = await fixture.up(pool);
    const rulebooksBefore = (await pool.query(RULEBOOKS)).rows;
    const { hashPassword } = await import("better-auth/crypto");
    const deskId = crypto.randomUUID();
    await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`, [deskId, DESK, `${DESK}@example.invalid`]);
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), deskId, await hashPassword(PASSWORD)]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[...Object.values(fx.users), deskId]]);
    const A = fx.couchId;
    const B = fx.extraCouchId;
    const as = { desk: await api({ user: DESK, pass: PASSWORD, headers }) };
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: fixture.username(who), pass: PASSWORD, headers });
    const desk = (method, p, body) => as.desk.call(method, `/api/desk${p}`, body);
    const library = async () => (await desk("GET", "/library")).body;
    const inbox = async () => (await desk("GET", "/inbox")).body.items;
    const page = async (id) => (await desk("GET", `/rulebooks/${id}`)).body;
    const how = async (who, season, couch) => (await as[who].call("GET", `/api/seasons/${season}/how-it-works${couch ? `?couch=${couch}` : ""}`)).body;
    const rowOf = async (id) => (await pool.query("SELECT * FROM rulebooks WHERE id = $1", [id])).rows[0];
    const seasonBook = async (season) => (await pool.query("SELECT * FROM rulebooks WHERE owner_kind = 'season' AND season_id = $1 AND status <> 'archived'", [season])).rows[0];
    const add = async (who, listing) => {
      const r = await as[who].call("POST", "/api/me/shows", { listing });
      if (r.status !== 200) throw new Error(`adding ${listing}: ${r.status} ${JSON.stringify(r.body)}`);
      return r.body.seasonId;
    };
    const settle = async (who, season, couch) => {
      for (let i = 0; i < 80; i++) {
        const p = (await as[who].call("GET", `/api/seasons/${season}/make?poll=1`)).body;
        if (!p.asking) return (await as[who].call("GET", `/api/seasons/${season}/make${couch ? `?couch=${couch}` : ""}`)).body;
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error("the ask never finished");
    };
    const makeIt = async (who, season, couch) => {
      const q = couch ? `?couch=${couch}` : "";
      await as[who].call("POST", `/api/seasons/${season}/make${q}`, { action: "ask" });
      let m = await settle(who, season, couch);
      if (m.setup?.stage === "cast") {
        await as[who].call("POST", `/api/seasons/${season}/make${q}`, { action: "continue" });
        m = await settle(who, season, couch);
      }
      const c = await as[who].call("POST", `/api/seasons/${season}/make${q}`, { action: "confirm" });
      if (c.status !== 200) throw new Error(`making ${season} a game: ${c.status} ${JSON.stringify(c.body).slice(0, 300)}`);
      return c.body;
    };
    const templatesFor = async () => jiti("../../src/lib/server/templates.ts").libraryTemplates();
    const { templateFor } = jiti("../../src/lib/game/make-game.ts");

    // ---------- the library ----------
    let lib = await library();
    const comp = lib.kinds.find((k) => k.kind === "competition");
    check(lib.kinds.map((k) => k.kind).join() === "competition,series,talk,sport", "the library: templates by kind", lib.kinds.map((k) => k.kind).join());
    check(["Survivor", "The Traitors", "The Challenge"].every((n) => comp.templates.some((t) => t.name === n)) && comp.templates.find((t) => t.name === "Survivor").tags.includes("Vote"), "the built-ins' templates, each with who decides its segments", comp.templates.map((t) => t.name).join());
    check(lib.counts.proposed === 8 && lib.kinds.every((k) => k.proposed.every((p) => p.kind === k.kind)), "the design plan's eight proposed shapes, under their kinds", String(lib.counts.proposed));
    check(!lib.kinds.flatMap((k) => k.proposed).find((p) => p.id === "brackets").shows.some((s) => /Challenge/.test(s.name)), "a show with a template of its own (The Challenge) doesn't count toward a shape");
    check(["Below Deck", "Saturday Night Live", "Scrubs"].every((n) => lib.drafts.some((d) => d.name === n)), "the researched rulebooks are drafts", lib.drafts.map((d) => d.name).join());
    check((await as.alex.call("GET", "/api/desk/library")).status === 403, "the library is the desk's: 403 for anyone else");

    // ---------- a rulebook a player made ----------
    const yacht = await add("alex", 990011);
    await makeIt("alex", yacht, A);
    const yBook = await seasonBook(yacht);
    check(yBook.review_status === "unreviewed" && yBook.provenance.from === "made" && yBook.created_by === fx.users.alex, "alex made ZT Yacht Life a game: its rulebook is new (unreviewed), alex its first maker");
    let items = await inbox();
    check(items.some((i) => i.kind === "made" && i.title === "ZT Yacht Life 2: a new rulebook" && /Made with ChatGPT by zt_nd_alex · nobody on another couch/.test(i.line) && i.href === `/desk/rulebook/${yBook.id}`), "the Inbox: a new rulebook nobody's checked", JSON.stringify(items.filter((i) => i.kind === "made")));
    lib = await library();
    check(lib.made.some((m) => m.id === yBook.id && m.review === "unreviewed" && /^Made with ChatGPT by zt_nd_alex · new/.test(m.line)), "the library: under Made by players", JSON.stringify(lib.made));
    check(!lib.kinds.flatMap((k) => k.templates).some((t) => /ZT Yacht/.test(t.name)), "its stored format isn't a template");
    const started = await as.alex.call("POST", `/api/seasons/${yacht}/start?couch=${A}`, { game: "weeklyLineup" });
    check(started.status === 200, "alex starts a Weekly Lineup on it", JSON.stringify(started.body).slice(0, 200));
    check(!(await pool.query("SELECT 1 FROM rulebooks WHERE owner_kind = 'library' AND parent_id LIKE 'made-zt-%'")).rows.length, "a game on a made show still leaves the library alone (the old leak, fixed)");
    lib = await library();
    check(lib.inUse.some((x) => x.id === yBook.id && /^Made with ChatGPT by zt_nd_alex · new, nobody's checked it · 1 league follows it/.test(x.line)), "in use: where it came from, and who follows it", JSON.stringify(lib.inUse.filter((x) => /^ZT/.test(x.name))));

    // Looks right to us, from another couch
    let h = await how("alex", yacht, A);
    check(h.check === null && /new until another couch checks it/.test(h.how.lineage), "alex's own couch: How it works says it's new, and can't check it", `${h.check} ${h.how.lineage}`);
    h = await how("casey", yacht, B);
    check(h.check === "can", "casey, on another couch: Looks right to us", String(h.check));
    check((await as.alex.call("POST", `/api/seasons/${yacht}/rulebook/check?couch=${A}`)).status === 409, "the maker's couch is refused");
    let r = await as.casey.call("POST", `/api/seasons/${yacht}/rulebook/check?couch=${B}`);
    check(r.status === 200 && (await rowOf(yBook.id)).review_status === "checked", "casey checks it: checked", JSON.stringify(r.body));
    h = await how("casey", yacht, B);
    check(h.check === "done" && /checked by another couch/.test(h.how.lineage), "How it works: checked by another couch; casey's couch has", `${h.check} ${h.how.lineage}`);
    check((await as.casey.call("POST", `/api/seasons/${yacht}/rulebook/check?couch=${B}`)).status === 200 && (await pool.query("SELECT count(*)::int AS n FROM rulebook_checks WHERE rulebook_id = $1", [yBook.id])).rows[0].n === 1, "checking again changes nothing");
    check(!(await inbox()).some((i) => i.kind === "made" && i.href.endsWith(yBook.id)), "the couches settled it: out of the Inbox");

    // the desk's page: Fits these games, Take it over
    let p = await page(yBook.id);
    check(p.made?.review === "checked" && p.made.couches.includes("ZT Extra") && /checked by another couch/.test(p.made.line), "the desk's page: a player made it, ZT Extra checked it", JSON.stringify(p.made));
    check(p.fits.map((g) => `${g.key}:${g.fits}`).join() === "weeklyLineup:true,survivalPool:false,outlast:false" && /knocked out/.test(p.fits.find((g) => g.key === "outlast").needs), "Fits these games: Weekly Lineup; the others say what they need", JSON.stringify(p.fits.map((g) => [g.key, g.fits, g.needs])));
    check(p.lineage.length === 0, "no lineage: the listing called it Reality, so ChatGPT started from no skeleton", p.lineage.join(" › "));
    r = await desk("POST", `/rulebooks/${yBook.id}`, { action: "takeOver" });
    let row = await rowOf(yBook.id);
    check(r.status === 200 && row.review_status === "reviewed" && row.approved_by === deskId && row.created_by === fx.users.alex, "Take it over: the desk's, alex still its first maker", `${r.status} ${row.review_status}`);
    h = await how("riley", yacht, A);
    check(!/new until|checked by another/.test(h.how.lineage) && /Made with ChatGPT by zt_nd_alex/.test(h.how.lineage), "How it works stops calling it new", h.how.lineage);
    check((await desk("POST", `/rulebooks/${yBook.id}`, { action: "takeOver" })).status === 409, "taking it over twice is refused");
    const takeLine = r.body.history.find((l) => /Taken over by the desk/.test(l.text));
    check(takeLine?.undoable, "History: Taken over, undoable");
    await desk("POST", `/changes/${takeLine.id}/undo`);
    check((await rowOf(yBook.id)).review_status === "checked", "Undo puts it back as checked");
    await desk("POST", `/rulebooks/${yBook.id}`, { action: "takeOver" });

    // ---------- Save as a starting point; the library's template ----------
    r = await desk("POST", `/rulebooks/${yBook.id}`, { action: "template" });
    const T = r.body.id;
    let t = await rowOf(T);
    check(r.status === 200 && t.owner_kind === "library" && t.is_template && t.kind === "series" && !t.blocks.show && !t.blocks.tagline && t.provenance.shows.join() === "ZT Yacht Life" && t.name === "ZT Yacht Life", "Save as a starting point: a series template named for its show, the show's name left blank", JSON.stringify({ name: t.name, kind: t.kind, shows: t.provenance.shows, show: t.blocks.show }));
    lib = await library();
    check(lib.kinds.find((k) => k.kind === "series").templates.some((x) => x.id === T && x.saved && x.name === "ZT Yacht Life" && !x.like.length), "the library: under A series");
    p = await page(T);
    check(p.library?.template === true && p.library.shows.join() === "ZT Yacht Life" && p.library.deletable && p.season === null && p.fits.find((g) => g.key === "weeklyLineup").fits, "the template's page: a starting point, deletable, Fits these games", JSON.stringify(p.library));
    // The desk edits the template: a fix on a library rulebook.
    const edited = clone(p.now);
    edited.segments = edited.segments.map((s) => (s.id === "charter" ? { ...s, name: "Harbour Charter" } : s));
    r = await desk("POST", `/rulebooks/${T}`, { action: "save", blocks: edited, kind: "fix" });
    check(r.status === 200 && (await rowOf(T)).blocks.segments.some((s) => s.name === "Harbour Charter"), "the desk edits the template (a fix)", JSON.stringify(r.body).slice(0, 200));
    let lt = await templatesFor();
    check(templateFor({ name: "ZT Harbour Crew", kind: "series", type: "Reality" }, lt)?.id === T, "templateFor: a new reality series starts from the newest series template the desk saved");
    check(templateFor({ name: "ZT Yacht Life Mediterranean", kind: "competition", type: "Reality" }, lt)?.id === T, "templateFor: a show of its family by name, whatever the listing guessed");
    check(templateFor({ name: "Survivor South Africa", kind: "competition" }, lt)?.id === "survivor", "templateFor: ours by name before a mirror (Survivor)");
    const harbourWatch = await add("riley", 990016);
    const riviera = await add("riley", 990019);
    const prompt = (await as.riley.call("GET", `/api/seasons/${riviera}/make?prompt=rules`)).body.prompt;
    check(/Start from this rulebook of a similar show/.test(prompt) && /Harbour Charter/.test(prompt), "Make it a game's prompt for ZT Yacht Life Riviera (its family) starts from the desk's template", prompt.slice(-200));
    await desk("POST", `/rulebooks/${T}`, { action: "untemplate" });
    lt = await templatesFor();
    lib = await library();
    check(!lt.some((x) => x.id === T) && lib.drafts.some((d) => d.id === T), "not offered any more: a draft, and templateFor passes it by");
    await desk("POST", `/rulebooks/${T}`, { action: "template" });
    check((await rowOf(T)).is_template, "offered again");

    // ---------- New show, the desk's ----------
    r = await desk("POST", "/shows", { listing: 990016 });
    check(r.status === 200 && r.body.seasonId === harbourWatch && r.body.ready === false && r.body.showId, "New show: ZT Harbour Crew from its listing (the one riley added), not a game yet", JSON.stringify(r.body));
    check(!(await pool.query("SELECT 1 FROM show_follows WHERE user_id = $1", [deskId])).rows.length, "the desk follows nothing");
    check((await as.alex.call("POST", `/api/seasons/${harbourWatch}/make`, { action: "template", template: T })).status === 403, "starting from a template is the desk's");
    r = await as.desk.call("POST", `/api/seasons/${harbourWatch}/make`, { action: "template", template: T });
    const hm = r.body;
    check(r.status === 200 && hm.review?.kind.key === "series" && hm.review.cast.count === 5 && hm.review.approvable && hm.setup.via === "template", "started from the template: a series, its crew from the listing, ready to check", JSON.stringify({ s: r.status, kind: hm.review?.kind, cast: hm.review?.cast.count, ok: hm.review?.approvable, e: r.body.error }));
    check(hm.review.how.rundown?.some?.((x) => /Harbour Charter/.test(JSON.stringify(x))) || /Harbour Charter/.test(JSON.stringify(hm.review.how)), "the review reads the template's parts");
    r = await as.desk.call("POST", `/api/seasons/${harbourWatch}/make`, { action: "confirm" });
    const hBook = await seasonBook(harbourWatch);
    check(r.status === 200 && r.body.ready && r.body.rulebookId === hBook.id, "Looks right: set up, and the Done view knows its rulebook", JSON.stringify({ s: r.status, ready: r.body.ready, id: r.body.rulebookId }));
    check(hBook.review_status === "reviewed" && hBook.approved_by === deskId && hBook.parent_id === T && hBook.provenance.via === "template" && hBook.blocks.show === "ZT Harbour Crew", "checked as it's made, its parent the template", JSON.stringify({ rs: hBook.review_status, parent: hBook.parent_id === T, via: hBook.provenance.via, show: hBook.blocks.show }));
    h = await how("alex", harbourWatch, A);
    check(h.how.lineage === "Made from the ZT Yacht Life rulebook", "How it works: made from the ZT Yacht Life rulebook (the desk names nobody)", h.how.lineage);
    check(!(await inbox()).some((i) => i.kind === "made" && i.href === `/desk/rulebook/${hBook.id}`), "the desk's own isn't in the Inbox as a new rulebook");
    check((await page(hBook.id)).lineage.includes("ZT Yacht Life"), "its lineage: from the ZT Yacht Life template", (await page(hBook.id)).lineage.join(" › "));
    check((await desk("POST", `/rulebooks/${T}`, { action: "delete" })).status === 409, "the template can't be deleted now a rulebook was made from it");
    r = await as.alex.call("POST", `/api/seasons/${harbourWatch}/start?couch=${A}`, { game: "weeklyLineup" });
    let lg = (await pool.query("SELECT state FROM leagues WHERE id = $1", [r.body.leagueId])).rows[0]?.state;
    check(r.status === 200 && lg?.settings.rulebook?.id === hBook.id && lg.settings.leagueTypeId === "active-roster" && lg.castaways.length === 5, "a series end to end: alex's Weekly Lineup plays by its rulebook, with its crew", JSON.stringify({ s: r.status, rb: lg?.settings.rulebook?.id === hBook.id, n: lg?.castaways.length }));

    // a talk show through our bot, from the desk
    r = await desk("POST", "/shows", { listing: 990017 });
    const night = r.body.seasonId;
    await makeIt("desk", night, null);
    const nBook = await seasonBook(night);
    p = await page(nBook.id);
    check(nBook.kind === "talk" && nBook.review_status === "reviewed", "a talk show made a game from the desk (our bot)", `${nBook.kind} ${nBook.review_status}`);
    // Weekly Calls starts since step 12 part 2, Weekly Bingo since part 3.
    check(p.fits.filter((g) => g.fits).map((g) => `${g.key}:${g.soon}`).join() === "weeklyBingo:null,weeklyCalls:null" && p.fits.filter((g) => !g.fits).length === 3, "Fits these games: Weekly Bingo and Weekly Calls; the drafts don't", JSON.stringify(p.fits.map((g) => [g.key, g.fits, g.soon])));
    h = await how("alex", night, A);
    const so = (await as.alex.call("GET", `/api/seasons/${night}/start?couch=${A}`)).body;
    check(h.how.kind?.key === "talk" || /talk/i.test(JSON.stringify(h.how.kind)), "How it works: a talk show", JSON.stringify(h.how.kind));
    check(
      so.kind === "talk" && so.games.filter((g) => g.fits).map((g) => `${g.key}:${g.soon}`).join() === "weeklyBingo:null,weeklyCalls:null",
      "a talk show end to end: Start a game offers its two games, both startable",
      JSON.stringify(so.games?.map((g) => [g.key, g.fits, g.soon]))
    );

    // ---------- a set-up show's next season ----------
    const yachtShow = (await pool.query("SELECT show_id FROM show_seasons WHERE id = $1", [yacht])).rows[0].show_id;
    r = await desk("POST", `/shows/${yachtShow}`, { action: "season" });
    const next = r.body.seasonId;
    const nextBook = await seasonBook(next);
    const nextSeason = (await pool.query("SELECT rulebook_live, rulebook_id, season_number FROM show_seasons WHERE id = $1", [next])).rows[0];
    check(r.status === 200 && nextSeason.season_number === 3 && nextBook && nextBook.parent_id === yBook.id && nextBook.provenance.sameAsLastSeason && nextSeason.rulebook_live && nextSeason.rulebook_id === nextBook.id, "New season 3 of a set-up show: last season's rulebook, playing by it", JSON.stringify({ s: r.status, n: nextSeason.season_number, parent: nextBook?.parent_id === yBook.id }));
    check(nextBook.compiled_source === "blocks" && nextBook.blocks.segments.length === yBook.blocks.segments.length && !(await pool.query("SELECT 1 FROM rulebooks WHERE owner_kind = 'library' AND parent_id LIKE 'made-zt-%'")).rows.length, "compiled for itself; still no template from its stored format");
    check(r.body.history.some((l) => /Added season 3, playing by last season's rulebook/.test(l.text)), "the show's History says so");

    // ---------- a show added by name ----------
    r = await as.alex.call("POST", "/api/me/shows", { name: "ZT Mystery Hour" });
    const mysteryShow = (await pool.query("SELECT show_id FROM show_seasons WHERE id = $1", [r.body.seasonId])).rows[0].show_id;
    items = await inbox();
    check(items.some((i) => i.kind === "show" && i.title === "ZT Mystery Hour: added by name" && /By zt_nd_alex · not in the TV listings · 1 following/.test(i.line)), "the Inbox: a show added by name", JSON.stringify(items.filter((i) => i.kind === "show")));
    let sp = (await desk("GET", `/shows/${mysteryShow}`)).body;
    check(sp.added?.by === "zt_nd_alex" && sp.added.listing === false && !sp.reviewed && !sp.setUp, "its page: added by alex by name, not looked at", JSON.stringify(sp.added));
    r = await desk("POST", `/shows/${mysteryShow}`, { action: "reviewed" });
    check(r.status === 200 && r.body.reviewed?.by === DESK && !(await inbox()).some((i) => i.kind === "show" && /Mystery/.test(i.title)), "Looks fine: out of the Inbox");
    await desk("POST", `/changes/${r.body.history[0].id}/undo`);
    check((await inbox()).some((i) => i.kind === "show" && /Mystery/.test(i.title)), "Undo: back in the Inbox");
    // A show by name the desk makes itself (New show) has been looked at.
    r = await desk("POST", "/shows", { name: "ZT Desk Special" });
    check(r.status === 200 && !(await inbox()).some((i) => i.kind === "show" && /ZT Desk Special/.test(i.title)), "a show the desk adds by name isn't the Inbox's", JSON.stringify(r.body).slice(0, 120));
    r = await desk("POST", `/shows/${mysteryShow}`, { action: "archive" });
    const catalog = (await as.riley.call("GET", "/api/catalog")).body;
    check(r.status === 200 && r.body.archived && !(await inbox()).some((i) => i.kind === "show" && /Mystery/.test(i.title)) && !JSON.stringify(catalog).includes("ZT Mystery Hour"), "Archive: out of the Inbox and everyone's search");

    // ---------- shapes: two race series ----------
    const rally = await add("alex", 990014);
    await makeIt("alex", rally, A);
    lib = await library();
    let race = lib.kinds.find((k) => k.kind === "sport").proposed.find((x) => x.id === "race");
    check(race.shows.length === 1 && race.shows[0].name === "ZT Rally", "Race series: one show plays like it (still proposed)", JSON.stringify(race.shows));
    check((await desk("POST", "/library", { action: "earn", shape: "race" })).status === 409, "it can't be a template on one show");
    const speedway = await add("alex", 990015);
    await makeIt("alex", speedway, A);
    lib = await library();
    race = lib.kinds.find((k) => k.kind === "sport").proposed.find((x) => x.id === "race");
    check(race.shows.map((s) => s.name).sort().join() === "ZT Rally,ZT Speedway", "two real shows play like it: it's earned its place", JSON.stringify(race.shows));
    items = await inbox();
    check(items.filter((i) => i.kind === "made" && /ZT (Rally|Speedway)/.test(i.title)).length === 2, "both new rulebooks are in the Inbox");

    if (apiOnly) {
      // The browser earns it; here, the API.
      r = await desk("POST", "/library", { action: "earn", shape: "race" });
      t = await rowOf(r.body.id);
      check(r.status === 200 && t.name === "Race series" && t.provenance.shape === "race" && t.provenance.shows.includes("Formula 1"), "earned: the Race series template", JSON.stringify(t?.provenance));
      check(templateFor({ name: "NASCAR Cup Series", kind: "sport" }, await templatesFor())?.id === r.body.id, "templateFor: a show like its examples (NASCAR) starts from it");
    } else {
      await pool.query("UPDATE show_follows SET following = true WHERE user_id = $1", [fx.users.casey]);
      // Motion off, so a capture sees where a push lands rather than the slide; the dev badge hidden.
      const b = await open({ user: DESK, pass: PASSWORD, width, height: 844, headers, motion: "off" });
      const noBadge = () => {
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        });
      };
      await b.page.context().addInitScript(noBadge);
      closers.push(b.close);
      const { page: pg, errors } = b;
      // Chrome's own /favicon.ico fetch now and then logs "Failed to load resource" (the app's icons are icon1.png): only that one is
      // discounted, as check-new-backstage does.
      let favicon = 0;
      pg.on("console", (m) => m.type() === "error" && m.location().url.endsWith("/favicon.ico") && favicon++);
      let n = 0;
      // A capture waits for the screen to land (a push's view transition: settle, capped as a skeleton's pulse never ends).
      const shot = async (name) => {
        await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
        await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`) });
      };
      const wide = async (what) => {
        const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(over <= 1, `${what}: nothing wider than the screen`, `${over}px`);
      };

      // Find: Library and New show
      await pg.goto(`${BASE}/desk/find`, { waitUntil: "load" });
      await pg.locator("[data-desk-library-link]").waitFor();
      check((await pg.locator("[data-desk-new-link]").count()) === 1, "Find: Library and New show");
      // A screenshot before the page has hydrated hides the caret on its input, which React then calls a mismatch.
      await pg.waitForTimeout(800);
      await shot("find");
      await pg.locator("[data-desk-library-link]").click();
      await pg.locator("[data-desk-library] [data-library-kind='competition']").waitFor();
      check((await pg.locator("[data-template-card]").count()) >= 4 && (await pg.locator("[data-proposed]").count()) === 8 && (await pg.locator("[data-new-show]").count()) === 1, "the library: templates, the eight proposed shapes, New show");
      await shot("library");
      await wide("the library");
      await pg.locator("[data-proposed='awards']").click();
      await pg.locator("text=It earns a template once two real shows share its shape.").first().waitFor();
      check(true, "a proposed shape says how it earns its place");
      const earn = pg.locator("[data-proposed='race'][data-earned] [data-earn]");
      await earn.scrollIntoViewIfNeeded();
      await shot("library-earned");
      await earn.click();
      await pg.waitForURL(/\/desk\/rulebook\//);
      await pg.locator("[data-library-controls]").waitFor();
      const raceId = pg.url().split("/").pop();
      t = await rowOf(raceId);
      check(t.name === "Race series" && t.provenance.shape === "race" && t.is_template, "Make it a template: the Race series starting point, its page", JSON.stringify(t?.provenance));
      check(templateFor({ name: "NASCAR Cup Series", kind: "sport" }, await templatesFor())?.id === raceId, "templateFor: a show like its examples (NASCAR) starts from it");
      await shot("race-template");
      await wide("a template's page");

      // a made rulebook: Take it over, Fits these games
      const rallyBook = await seasonBook(rally);
      await pg.goto(`${BASE}/desk/rulebook/${rallyBook.id}`, { waitUntil: "load" });
      await pg.locator("[data-made='unreviewed']").waitFor();
      check((await pg.locator("[data-fit='weeklyLineup'][data-fits-it='yes']").count()) === 1 && (await pg.locator("[data-fit='outlast'][data-fits-it='no']").count()) === 1, "a sport's page: Fits these games (the draft of athletes; not Outlast)");
      await shot("made-rulebook");
      await wide("a made rulebook's page");
      await pg.locator("[data-take-over]").click();
      await pg.locator("text=Taken over").first().waitFor();
      await pg.locator("[data-made='unreviewed']").waitFor({ state: "detached" });
      check((await rowOf(rallyBook.id)).review_status === "reviewed", "Take it over: the desk's");
      await pg.locator("[data-fits]").scrollIntoViewIfNeeded();
      await shot("fits");

      // New show: a listing, the template, Make it a game's review, Looks right, the desk link
      await pg.goto(`${BASE}/desk/new`, { waitUntil: "load" });
      await pg.locator("[data-new-show-q]").fill("ZT Coast");
      await pg.locator("[data-new-show-listing='990018']").waitFor();
      check((await pg.locator("[data-new-show-name]").count()) === 1, "New show: TV listings, and Add by name");
      await shot("new-show-1");
      await wide("New show");
      await pg.locator("[data-new-show-listing='990018']").click();
      await pg.locator("[data-new-show-flow='2']").waitFor();
      await pg.locator(`[data-new-show-template='${T}']`).waitFor();
      check((await pg.locator("[data-new-show-ask]").count()) === 1 && (await pg.locator("[data-new-show-paste]").count()) === 1, "How to start: Ask ChatGPT, copy and paste, or a starting point");
      await shot("new-show-2");
      await pg.locator(`[data-new-show-template='${T}']`).click();
      await pg.waitForURL(/page=make/);
      await pg.locator("[data-make-ok]").waitFor({ timeout: 15000 });
      const reviewText = await pg.locator("[data-make-view='review']").innerText();
      check(/A series/.test(reviewText) && /From a starting point in the library/.test(reviewText), "Make it a game's review: a series, from a starting point");
      await shot("new-show-review");
      await pg.locator("[data-make-ok]").click();
      await pg.waitForURL(/\/desk\/rulebook\//, { timeout: 15000 });
      await pg.locator("[data-desk-rulebook]").waitFor();
      const coastId = pg.url().split("/").pop();
      const coastBook = await rowOf(coastId);
      check(coastBook?.parent_id === T && coastBook.review_status === "reviewed" && coastBook.blocks.show === "ZT Coast Guard", "Looks right comes back to the desk: its rulebook, made from the template, the desk's");
      await shot("new-show-rulebook");
      // Make it a game's Done view, opened again, links to it too.
      await pg.goto(`${BASE}/show/${coastBook.season_id}/games?page=make`, { waitUntil: "load" });
      await pg.locator("[data-make-desk]").waitFor({ timeout: 15000 });
      await shot("new-show-done");
      await pg.locator("[data-make-desk]").click();
      await pg.waitForURL(new RegExp(`/desk/rulebook/${coastId}`));
      check(true, "Make it a game's Done view: Its rulebook on the desk");

      // a show added by name: Looks fine
      r = await as.alex.call("POST", "/api/me/shows", { name: "ZT Pub Quiz Night" });
      const quiz = (await pool.query("SELECT show_id FROM show_seasons WHERE id = $1", [r.body.seasonId])).rows[0].show_id;
      await pg.goto(`${BASE}/desk`, { waitUntil: "load" });
      await pg.locator(`[data-inbox] [data-desk-item='show']`, { hasText: "ZT Pub Quiz Night" }).waitFor();
      check((await pg.locator(`[data-inbox] [data-desk-item='made']`, { hasText: "ZT Speedway" }).count()) === 1, "the Inbox: a new rulebook and a show added by name");
      await shot("inbox");
      await pg.locator(`[data-inbox] [data-desk-item='show']`, { hasText: "ZT Pub Quiz Night" }).click();
      await pg.locator("[data-show-review]").waitFor();
      await shot("show-by-name");
      await wide("a show's page");
      await pg.locator("[data-show-fine]").click();
      await pg.locator("[data-show-review]").waitFor({ state: "detached" });
      check(!!(await pool.query("SELECT reviewed_at FROM shows WHERE id = $1", [quiz])).rows[0].reviewed_at, "Looks fine, from its page");
      const deskErrors = errors.filter((e) => !/Failed to load resource/.test(e)).concat(errors.filter((e) => /Failed to load resource/.test(e)).slice(favicon));
      check(deskErrors.length === 0, "no page errors (the desk)", deskErrors.join(" | "));

      // casey: Looks right to us
      const c = await open({ user: fixture.username("casey"), pass: PASSWORD, width, height: 844, headers, motion: "off" });
      await c.page.context().addInitScript(noBadge);
      closers.push(c.close);
      let caseyFavicon = 0;
      c.page.on("console", (m) => m.type() === "error" && m.location().url.endsWith("/favicon.ico") && caseyFavicon++);
      await c.page.goto(`${BASE}/show/${speedway}/games?page=how-it-works`, { waitUntil: "load" });
      await c.page.locator("[data-rulebook-check]").waitFor({ timeout: 15000 });
      await c.page.locator("[data-rulebook-check]").scrollIntoViewIfNeeded();
      await c.page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-casey-check.png`) });
      await c.page.locator("[data-rulebook-check]").click();
      await c.page.locator("[data-rulebook-checked]").waitFor();
      check((await rowOf((await seasonBook(speedway)).id)).review_status === "checked", "casey: Looks right to us, from How it works");
      await c.page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-casey-checked.png`) });
      const caseyErrors = c.errors.filter((e) => !/Failed to load resource/.test(e)).concat(c.errors.filter((e) => /Failed to load resource/.test(e)).slice(caseyFavicon));
      check(caseyErrors.length === 0, "no page errors (casey)", caseyErrors.join(" | "));
    }

    // ---------- nothing real changed ----------
    const realAfter = (await pool.query(REAL_LEAGUES)).rows;
    // (Games this check started have ordinary slugs: only the leagues that were here before count.)
    const changed = realBefore.filter((y) => realAfter.find((x) => x.slug === y.slug)?.h !== y.h).map((y) => y.slug);
    check(!changed.length, "every real league's state is unchanged", changed.join());
    const after = new Map((await pool.query(RULEBOOKS)).rows.map((x) => [x.id, x]));
    const moved = rulebooksBefore.filter((x) => JSON.stringify(after.get(x.id)) !== JSON.stringify(x));
    check(!moved.length, "every rulebook that was here before is unchanged", moved.map((x) => x.id).join());
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    await tv.close();
    await bot.close();
    await jiti("../../src/lib/server/db.ts").pool.end().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
