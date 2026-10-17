// Mid-season waivers, phase 3 (docs/PLAN-midseason-waivers.md; the canvas's board 11): who hears what
// when a week processes, the reminders six hours before, the hourly job (db/waivers.js), the alert
// strip's pickup item and Overview's status plate. Same league as tests/waivers.test.js: Couch Crew
// after Episode 3, where Sam lost Jelly. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const WP = require("../src/lib/server/waiver-pushes.js");
const { actionItems } = require("../src/lib/game/action-items.js");
const { runWaivers } = require("../db/waivers.js");
const { statusPlate } = jiti("../src/lib/game/status-plate.ts");
const W = S.WaiverLogic;

const HOUR = 3600e3;
const T0 = Date.parse("2026-10-15T14:00:00Z"); // Thursday: Episode 3's results go in
const EP4_AIRS = Date.parse("2026-10-21T00:00:00Z"); // Tuesday 8pm ET; processing is 24h before
const PROCESS_AT = EP4_AIRS - 24 * HOUR;

const TEAMS = {
  kim: ["mike", "k2", "k3"],
  sam: ["jelly", "kilby", "s3"],
  andrew: ["carter", "a2", "a3"],
  josie: ["lewis", "jenna", "sharonda"],
  dee: ["d1", "d2", "d3"],
};
const FREE = ["rob", "maggie", "ori", "patt", "aaliyah", "linnea"];

function league(settings = {}) {
  const owned = Object.entries(TEAMS).flatMap(([p, ids]) => ids.map((id) => [id, p]));
  const ids = [...owned.map(([id]) => id), ...FREE, "x1", "x2"];
  const s = S.migrateLeagueState({
    settings: {
      leagueTypeId: "classic-draft", showFormat: "survivor", ownershipMode: "exclusive",
      teamSize: 3, replenishEnabled: true, tradeEnabled: true, swapEvery: 3, startEpisode: 1, replenishOrderBy: "rolling",
      ...settings,
    },
    players: Object.keys(TEAMS).map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1), color: "#000", active: true })),
    draftOrder: ["dee", "josie", "andrew", "sam", "kim"],
    castaways: ids.map((id) => ({
      id, name: id[0].toUpperCase() + id.slice(1), status: "active", placementOrder: null, exitMethod: null, exitEpisodeId: null,
      ownerIds: owned.filter(([c]) => c === id).map(([, p]) => p),
    })),
    episodes: Array.from({ length: 13 }, (_, i) => ({
      id: `ep${i + 1}`, number: i + 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {},
      ...(i === 3 ? { airsAt: new Date(EP4_AIRS).toISOString() } : {}),
    })),
  });
  // The draft's done (three each).
  s.draftForceStarted = true;
  s.draftPicksMade = s.draftOrder.length * S.rosterSize(s);
  S.addElimination(s, "ep1", "x1", "Voted Out");
  S.addElimination(s, "ep2", "x2", "Voted Out");
  S.addElimination(s, "ep3", "jelly", "Voted Out");
  return s;
}
function opened(settings) {
  const s = league(settings);
  W.open(s, T0);
  return s;
}
const claim = (s, pid, c) => W.checkClaim(s, W.current(s), pid, c).claim;

// Sam revealed (wanted Rob, but Kim is ahead in waiver order and replacements get no priority: Ori,
// then Maggie on the swap); Kim revealed (got Rob); Josie hasn't revealed Episode 3; Dee revealed and
// did nothing; Andrew is a computer.
const PEOPLE = [
  { userId: "u-sam", playerId: "sam", seen: 3 },
  { userId: "u-kim", playerId: "kim", seen: Infinity },
  { userId: "u-josie", playerId: "josie", seen: 2 },
  { userId: "u-dee", playerId: "dee", seen: 3 },
];
function processedCanvas() {
  const s = opened();
  const claims = {
    sam: claim(s, "sam", { pickupIds: ["rob", "ori"], dropId: "kilby", addIds: ["maggie"] }),
    kim: claim(s, "kim", { dropId: "mike", addIds: ["rob", "patt"] }),
  };
  const before = WP.snapshot(s);
  W.process(s, claims, { now: PROCESS_AT });
  return { s, before };
}

test("processed: names to those who've revealed, the same words to those who haven't, nothing for a quiet week", () => {
  const { s } = processedCanvas();
  const msgs = Object.fromEntries(WP.processedMessages(s, W.current(s), "Couch Crew", PEOPLE).map((m) => [m.userId, m.message]));
  assert.equal(msgs["u-sam"].title, "You got Ori and Maggie");
  assert.equal(msgs["u-sam"].body, "Couch Crew: waivers processed. Free agency is open until Episode 4 airs.");
  assert.equal(msgs["u-sam"].url, "/waivers/results/3");
  // Kim is ahead of Sam, and a replacement no longer goes first: Kim gets Rob.
  assert.equal(msgs["u-kim"].title, "You got Rob");
  // Josie: no names, no "owed", the same as anyone who hasn't revealed.
  assert.equal(msgs["u-josie"].title, "Waivers processed");
  assert.equal(msgs["u-josie"].body, "Couch Crew: reveal Episode 3 to see every move.");
  assert.doesNotMatch(JSON.stringify(msgs["u-josie"]), /Rob|Maggie|Patt|Jelly|pickup/);
  // Dee: a window with free agency, so the unused swap is still worth a line.
  assert.match(msgs["u-dee"].body, /Your swap is still unused/);

  // Not a window: Dee (untouched) hears nothing.
  const quiet = opened({ swapEvery: 4 });
  W.process(quiet, {}, { now: PROCESS_AT });
  const q = WP.processedMessages(quiet, W.current(quiet), "Couch Crew", PEOPLE).map((m) => m.userId);
  assert.ok(!q.includes("u-dee"));
  // Sam made no claim and is still owed: told to use free agency.
  const samQ = WP.processedMessages(quiet, W.current(quiet), "Couch Crew", PEOPLE).find((m) => m.userId === "u-sam");
  assert.equal(samQ.message.title, "You still have someone to replace");
  assert.ok(q.includes("u-josie"));
});

test("justProcessed: the week that just ran, once; not one that ran and closed in one go", () => {
  const { s, before } = processedCanvas();
  assert.equal(WP.justProcessed(before, s).episode, 3);
  assert.equal(WP.justProcessed(WP.snapshot(s), s), null);
  const later = opened();
  const b = WP.snapshot(later);
  W.process(later, {}, { now: PROCESS_AT });
  W.close(later, EP4_AIRS);
  assert.equal(WP.justProcessed(b, later), null);
});

test("the waiver clock's times read in the season's zone", () => {
  assert.equal(WP.clock(new Date(PROCESS_AT).toISOString(), "America/New_York"), "Mon 8:00 PM EDT");
  assert.equal(WP.clock(new Date(PROCESS_AT).toISOString(), "America/New_York", false), "8:00 PM EDT");
});

// Just enough of pg's Pool for the job and the reminders: the league above, four members, the log.
function fakePool(state, { seen = { sam: 3, kim: 3, josie: 2, dee: 3 } } = {}) {
  const logged = new Set();
  const writes = [];
  const pool = {
    logged,
    writes,
    state,
    async connect() {
      return { query: pool.query, release() {} };
    },
    async query(sql, params) {
      if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] };
      if (sql.includes("air_tz FROM show_seasons")) return { rows: [] };
      if (sql.includes("FROM show_seasons")) return { rows: [] };
      if (sql.includes("SELECT id FROM leagues")) return { rows: [{ id: "L1" }] };
      if (sql.includes("SELECT name, state FROM leagues")) return { rows: [{ name: "Couch Crew", state: pool.state }] };
      if (sql.includes("SELECT name FROM leagues")) return { rows: [{ name: "Couch Crew" }] };
      if (sql.startsWith("UPDATE leagues")) {
        writes.push(JSON.parse(params[0]));
        return { rows: [] };
      }
      if (sql.includes("FROM waiver_claims") && sql.startsWith("SELECT")) return { rows: [] };
      if (sql.includes("waiver_claims")) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM league_memberships")) {
        return { rows: Object.entries(seen).map(([p, n]) => ({ user_id: `u-${p}`, player_id: p, results_seen_through: n, immediate: false })) };
      }
      // No devices: sendPush (with VAPID keys in .env.local) finds nobody to send to.
      if (sql.includes("FROM push_subscriptions")) return { rows: [] };
      if (sql.includes("INSERT INTO reminder_log")) {
        const key = params.join("|");
        if (logged.has(key)) return { rowCount: 0 };
        logged.add(key);
        return { rowCount: 1 };
      }
      throw new Error("unexpected query: " + sql);
    },
  };
  return pool;
}
const quietLog = () => {};

test("six hours before: owed with no claim, and not revealed; once each; not after an undo", async () => {
  const s = opened();
  const pool = fakePool(s);
  const lg = { id: "L1", name: "Couch Crew", state: s };
  assert.equal(await WP.remindWaivers(pool, lg, PROCESS_AT - 7 * HOUR, { log: quietLog }), 0);
  assert.equal(await WP.remindWaivers(pool, lg, PROCESS_AT - 5 * HOUR, { log: quietLog }), 2);
  assert.deepEqual([...pool.logged].sort(), ["u-josie|L1|waiverReveal|3", "u-sam|L1|waiverPickup|3"]);
  assert.equal(await WP.remindWaivers(pool, lg, PROCESS_AT - 4 * HOUR, { log: quietLog }), 0);

  // Sam's claim is in: nothing for Sam.
  const s2 = opened();
  W.setClaimsIn(s2, W.current(s2), ["sam"]);
  const p2 = fakePool(s2);
  await WP.remindWaivers(p2, { id: "L1", name: "Couch Crew", state: s2 }, PROCESS_AT - 5 * HOUR, { log: quietLog });
  assert.deepEqual([...p2.logged], ["u-josie|L1|waiverReveal|3"]);

  // Held after an undo: no time to remind about.
  W.current(s2).hold = true;
  assert.equal(await WP.remindWaivers(fakePool(s2), { id: "L1", name: "Couch Crew", state: s2 }, PROCESS_AT - 5 * HOUR, { log: quietLog }), 0);
});

test("the hourly job processes a week whose time has come, writes it, and announces it once", async () => {
  // No catalog season here, so its times run from opening: processing 24h after.
  const s = league();
  delete s.episodes[3].airsAt;
  W.open(s, T0);
  const pool = fakePool(s);
  const lines = [];
  const early = await runWaivers(pool, { now: T0 + 2 * HOUR, log: (l) => lines.push(l) });
  assert.equal(early.steps, 0);
  assert.equal(pool.writes.length, 0);

  const r = await runWaivers(pool, { now: T0 + 25 * HOUR, log: (l) => lines.push(l) });
  assert.equal(r.steps, 1);
  assert.equal(pool.writes.length, 1);
  assert.equal(W.current(pool.writes[0]).phase, "processed");
  assert.ok(r.announced >= 2, "Sam (still owed) and Josie (not revealed) hear about it");
  assert.ok(lines.some((l) => l.includes("u-josie -- Waivers processed")));

  // Nothing new an hour later: no second announcement.
  pool.state = pool.writes[0];
  const again = await runWaivers(pool, { now: T0 + 26 * HOUR, log: quietLog });
  assert.deepEqual([again.steps, again.announced], [0, 0]);
});

test("--dry changes nothing", async () => {
  const s = league();
  delete s.episodes[3].airsAt;
  W.open(s, T0);
  const pool = fakePool(s);
  const r = await runWaivers(pool, { now: T0 + 25 * HOUR, dry: true, log: quietLog });
  assert.equal(r.steps, 1);
  assert.equal(pool.writes.length, 0);
  assert.equal(pool.logged.size, 0);
});

test("the alert strip: someone to replace with no claim in, never before you've revealed", () => {
  const s = opened();
  const [it] = actionItems(s, "sam", 3).filter((x) => x.kind === "pickup");
  assert.equal(it.text, "Replace Jelly");
  assert.equal(it.href, "/waivers/claim?drop=jelly");
  assert.equal(it.by, new Date(PROCESS_AT).toISOString());
  assert.equal(it.detail, "first choice, then backups");
  assert.equal(actionItems(s, "sam", 2).filter((x) => x.kind === "pickup").length, 0, "not revealed");
  assert.equal(actionItems(s, "sam", null).filter((x) => x.kind === "pickup").length, 1, "sees results as they come");
  assert.equal(actionItems(s, "kim", 3).filter((x) => x.kind === "pickup").length, 0, "owed nothing");
  W.setClaimsIn(s, W.current(s), ["sam"]);
  assert.equal(actionItems(s, "sam", 3).filter((x) => x.kind === "pickup").length, 0, "claim in");

  // Free agency, still owed: until airtime.
  const fa = opened();
  W.process(fa, {}, { now: PROCESS_AT });
  const [f] = actionItems(fa, "sam", 3).filter((x) => x.kind === "pickup");
  assert.equal(f.href, "/waivers/free-agency?drop=jelly");
  assert.equal(f.by, new Date(EP4_AIRS).toISOString());
});

test("Overview's status plate: claim in, a waiver window, free agency with your swap unused", () => {
  const s = opened();
  W.setClaimsIn(s, W.current(s), ["sam", "kim"]);
  const sam = statusPlate(s, { me: "sam", isCommissioner: false, now: T0 });
  assert.equal(sam.tag, "Waivers");
  assert.match(sam.title, /^Claims due /);
  assert.equal(sam.detail, "Your claim is in · 2 of 5 in");
  assert.equal(sam.href, "/waivers");

  const dee = statusPlate(s, { me: "dee", isCommissioner: false, now: T0 });
  assert.equal(dee.tag, "Window");
  assert.equal(dee.title, "Waiver window open");

  W.process(s, {}, { now: PROCESS_AT });
  const fa = statusPlate(s, { me: "dee", isCommissioner: false, now: PROCESS_AT });
  assert.equal(fa.tag, "FA");
  assert.equal(fa.detail, "Your swap is unused · first come");
  assert.equal(fa.href, "/waivers/free-agency");

  // Not a window, nothing owed, no claim: the usual weekly plate.
  const quiet = opened({ swapEvery: 4 });
  assert.notEqual(statusPlate(quiet, { me: "dee", isCommissioner: false, now: T0 }).tag, "Waivers");
});

test("the spoiler view drops who was nudged", () => {
  const s = opened();
  W.current(s).nudged = ["sam"];
  const view = S.SpoilerLogic.viewThrough(s, 2);
  assert.equal(W.periods(view)[0].nudged, undefined);
});

// ---- Waivers v2, phase 3: Open a waiver window (docs/PLAN-waivers-v2.md) ----

// Kim is the commissioner: she opened it, so she hears nothing.
const TZ = "America/New_York";
const byUser = (msgs) => Object.fromEntries(msgs.map((m) => [m.userId, m.message]));
const NAMES = /Rob|Maggie|Ori|Patt|Jelly|Kilby|Mike|Lewis/;
function manual(settings = {}) {
  return league({ replaceRule: "windows", waiverWindows: { schedule: "manual", every: 3, swaps: 0 }, ...settings });
}

test("window open: the sheet's line to the rotation, no names, reveal first if you haven't, not the commissioner", () => {
  const s = manual();
  const before = WP.windowSnapshot(s);
  assert.equal(before, null, "no window yet");
  const { period } = W.openWindow(s, 2, T0, { replace: true });
  const line = require("../src/lib/game/waiver-words.js").windowLine(s, period);
  assert.equal(line, "Replace who's out · Swap up to 2");
  const msgs = byUser(WP.windowMessages(s, before, period, "Couch Crew", PEOPLE, [], TZ, { actorUserId: "u-kim" }));
  assert.deepEqual(Object.keys(msgs).sort(), ["u-dee", "u-josie", "u-sam"]);
  assert.equal(msgs["u-sam"].title, "Waiver window open: Replace who's out · Swap up to 2");
  assert.equal(msgs["u-sam"].body, "Couch Crew: optional · claims due Mon 8:00 PM EDT.");
  assert.equal(msgs["u-sam"].url, "/waivers");
  assert.equal(msgs["u-josie"].title, msgs["u-sam"].title, "the same line, revealed or not");
  assert.equal(msgs["u-josie"].body, "Couch Crew: claims due Mon 8:00 PM EDT. Reveal Episode 3 first to make yours.");
  assert.doesNotMatch(JSON.stringify(msgs), NAMES);
  // The sheet (and the commissioner's plate) say it the same way: waivers-words.ts re-exports this line.
  assert.equal(jiti("../src/components/waivers/waivers-words.ts").windowLine(s, period), line);
});

test("window changed: told again only if the line or the deadline moved", () => {
  const s = manual();
  W.openWindow(s, 2, T0);
  let before = WP.windowSnapshot(s);
  let { period } = W.openWindow(s, 2, T0 + HOUR);
  assert.deepEqual(WP.windowMessages(s, before, period, "Couch Crew", PEOPLE, [], TZ), [], "nothing changed, nobody told");
  before = WP.windowSnapshot(s);
  ({ period } = W.openWindow(s, 3, T0 + HOUR));
  const msgs = byUser(WP.windowMessages(s, before, period, "Couch Crew", PEOPLE, [], TZ));
  assert.equal(msgs["u-dee"].title, "Waiver window open: Replace who's out · Swap any");
  assert.equal(msgs["u-dee"].body, "Couch Crew: changed · claims due Mon 8:00 PM EDT.");
});

test("trimmed claims: their owners hear their claim changed instead, and nothing names a castaway", () => {
  const s = manual();
  const { period } = W.openWindow(s, 1, T0, { replace: true });
  const sam = claim(s, "sam", { pairs: [{ addId: "rob", dropId: "jelly" }, { addId: "maggie", dropId: "kilby" }] });
  const before = WP.windowSnapshot(s);
  W.openWindow(s, 1, T0 + HOUR, { replace: false });
  const t = W.trimClaim(s, period, "sam", sam);
  assert.equal(t.removed, 1, "the replacement came out");
  const msgs = byUser(WP.windowMessages(s, before, period, "Couch Crew", PEOPLE, ["sam"], TZ));
  assert.equal(msgs["u-sam"].title, "Your claim changed");
  assert.equal(msgs["u-sam"].body, "Couch Crew: the waiver window changed, so claims it no longer allows came out. Check yours before Mon 8:00 PM EDT.");
  assert.equal(msgs["u-dee"].title, "Waiver window open: Swap 1");
  assert.doesNotMatch(JSON.stringify(msgs), NAMES);
});

test("turned off: the rotation hears it's off; a trimmed claim's owner hears theirs came out", () => {
  // Replacements every week: the week goes on, only the swaps go.
  const s = opened();
  const p = W.current(s);
  assert.equal(W.isWindow(p), true);
  let before = WP.windowSnapshot(s);
  W.openWindow(s, null, T0 + HOUR);
  let msgs = byUser(WP.windowMessages(s, before, p, "Couch Crew", PEOPLE, ["dee"], TZ, { actorUserId: "u-kim" }));
  assert.deepEqual([msgs["u-dee"].title, msgs["u-dee"].body], ["Your swaps came out", "Couch Crew: the waiver window was turned off, so your swaps came out."]);
  assert.deepEqual([msgs["u-sam"].title, msgs["u-sam"].body], ["Waiver window off", "Couch Crew: your commissioner turned it off. No swaps this week."]);
  assert.equal(msgs["u-kim"], undefined);

  // Nothing else to run: the week ends, and so does every claim.
  const m = manual();
  W.openWindow(m, 2, T0);
  before = WP.windowSnapshot(m);
  const r = W.openWindow(m, null, T0 + HOUR);
  assert.equal(r.closed, true);
  msgs = byUser(WP.windowMessages(m, before, r.period, "Couch Crew", PEOPLE, ["sam"], TZ));
  assert.equal(msgs["u-sam"].title, "Your claims came out");
  assert.equal(msgs["u-dee"].body, "Couch Crew: your commissioner turned it off. Nothing to claim this week.");

  // A plain week (never a window) has nothing to turn off, and its changes tell nobody.
  assert.deepEqual(WP.windowMessages(m, null, r.period, "Couch Crew", PEOPLE, [], TZ), []);
});

test("sendWindow: one push each, to the right people, linked to the league; never throws", async () => {
  const s = manual();
  const { period } = W.openWindow(s, 2, T0, { replace: true });
  const lines = [];
  const sent = await WP.sendWindow(fakePool(s), "L1", s, null, period.id, [], { actorUserId: "u-kim", log: (l) => lines.push(l) });
  assert.equal(sent, 3);
  assert.ok(lines.some((l) => l === "u-josie -- Waiver window open: Replace who's out · Swap up to 2: Couch Crew: claims due Mon 8:00 PM EDT. Reveal Episode 3 first to make yours."));
  assert.ok(!lines.some((l) => l.startsWith("u-kim ")));
  assert.equal(await WP.sendWindow({ query: async () => { throw new Error("down"); } }, "L1", s, null, period.id, []), 0);
});
