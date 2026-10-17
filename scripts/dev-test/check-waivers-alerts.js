// Dev-only test bank: waivers' phase 3 end to end (docs/PLAN-midseason-waivers.md; the canvas's board
// 11) -- Nudge, the alert strip's pickup item, and the hourly job (db/waivers.js) processing a week and
// sending its reminders -- as the people in waivers-fixture.js, against the dev server (npm run dev) and
// the dev database. API and job only, no browser (check-waivers-ui.js shoots Overview).
//
//   node scripts/dev-test/check-waivers-alerts.js [--keep]
//
// Brings waivers-fixture.js up at --phase=open itself (Episode 4 airing in 30 hours, so waivers process
// in about 6), then checks, in the Classic league:
//   - Nudge: commissioner only; never a computer player, someone with a claim in, or twice a week
//   - the alert strip (GET /api/me/actions): Sam (owed, no claim) has "Replace Jelly" by processing
//     time; Josie (not revealed) has nothing; once Sam's claim is in, nothing
//   - the job, run in-process on the fixture's leagues only (never a real one), its clock moved:
//     five hours before processing it reminds Sam (no claim) and Josie (not revealed), once each, and
//     names nothing to Josie; after processing time it processes the week, writes it, and announces it,
//     with no names for Josie; an hour later it does nothing
// Then (waivers v2, docs/PLAN-waivers-v2.md phase 3) it brings the fixture up again with --scenarios and,
// in zt-wv-rebuild (manual windows), has Kim open a waiver window, change it so Sam's claim is trimmed,
// and turn it off, through the real route; after each, what "Waiver window open" / "Your claim changed" /
// "Waiver window off" would say to whom (waiver-pushes.js sendWindow, dry, fed the state before and
// after): the rotation but Kim, no names, Josie told to reveal first, a no-op change telling nobody.
// Pushes go nowhere (the fixture's people have no devices); what each would say is in the job's log.
// Prints each check; exits 1 if any fail. Takes the fixture down afterwards unless --keep.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");
const { api } = require("./browser");
const fixture = require("./waivers-fixture");
const { runWaivers } = require("../../db/waivers.js");
const WP = require("../../src/lib/server/waiver-pushes.js");

const c = fixture.slugId;
let failed = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || detail === undefined ? "" : `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)})`}`);
  if (!ok) failed++;
}
const week = (state) => S.WaiverLogic.periods(state).slice(-1)[0];
const HOUR = 3600e3;

async function main() {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    const made = await fixture.up(pool, ["--phase=open", "--airs-in=30"]);
    const classic = made.find((m) => m.slug === "zt-wv-classic").leagueId;
    const ids = made.map((m) => m.leagueId);
    const [kim, sam, josie] = await Promise.all(["zt_wcomm", "zt_wplayer", "zt_wlate"].map((user) => api({ user, pass: fixture.PASSWORD })));
    const L = `/api/leagues/${classic}`;
    // The job's log names people by user id.
    const [samId, josieId] = await Promise.all(["zt_wplayer", "zt_wlate"].map((u) => userId(pool, u)));

    // The alert strip.
    let r = await sam.call("GET", "/api/me/actions");
    const pickup = (r.body.items || []).find((it) => it.kind === "pickup" && it.leagueId === classic);
    let st = (await sam.call("GET", `${L}/state`)).body.state;
    check("alert: Sam's pickup item", pickup?.text === "Replace Jelly" && pickup?.href === `/waivers/claim?drop=${c("Jelly")}` && pickup?.detail === "first choice, then backups", r.body.items);
    check("alert: due by processing time", pickup?.by === week(st).processAt, { by: pickup?.by, processAt: week(st).processAt });
    r = await josie.call("GET", "/api/me/actions");
    check("alert: nothing for Josie, who hasn't revealed", !(r.body.items || []).some((it) => it.kind === "pickup"), r.body.items);

    // Nudge.
    r = await sam.call("POST", `${L}/waivers/nudge`, { playerId: "p-josie" });
    check("nudge: only the commissioner", r.status === 403, r);
    r = await kim.call("POST", `${L}/waivers/nudge`, { playerId: "p-andrew" });
    check("nudge: never a computer player", r.status === 400, r);
    r = await kim.call("POST", `${L}/waivers/nudge`, { playerId: "p-josie" });
    check("nudge: Kim nudges Josie", r.status === 200 && week(r.body).nudged?.includes("p-josie"), r);
    r = await kim.call("POST", `${L}/waivers/nudge`, { playerId: "p-josie" });
    check("nudge: once a week", r.status === 409 && /nudged Josie/.test(r.body.error), r);
    const view = S.SpoilerLogic.viewThrough((await josie.call("GET", `${L}/state`)).body.state, 2);
    check("nudge: Josie's own copy doesn't say who was nudged", week(view).nudged === undefined, week(view));

    // The job, five hours before processing.
    st = (await sam.call("GET", `${L}/state`)).body.state;
    const processAt = Date.parse(week(st).processAt);
    let lines = [];
    let job = await runWaivers(pool, { now: processAt - 5 * HOUR, leagueIds: ids, log: (l) => lines.push(l) });
    const samRem = lines.find((l) => l.startsWith(`${samId} `));
    const josieRem = lines.find((l) => l.startsWith(`${josieId} `));
    check("job 6h out: nothing processed", job.steps === 0, job);
    check("job 6h out: Sam is told there's someone to replace", /you have someone to replace/.test(samRem || ""), lines);
    check("job 6h out: Josie is told to reveal first, no names", /reveal Episode 3 before then/.test(josieRem || "") && !/Jelly|Rob/.test(josieRem || ""), lines);
    lines = [];
    job = await runWaivers(pool, { now: processAt - 4 * HOUR, leagueIds: ids, log: (l) => lines.push(l) });
    check("job: no reminder twice", !lines.some((l) => l.includes(" -- Claims due at")), lines);

    // Sam's claim goes in: the alert goes.
    r = await sam.call("PUT", `${L}/waivers/claims`, { pickupIds: [c("Rob"), c("Maggie")] });
    check("Sam claims Rob, then Maggie", r.status === 200, r);
    r = await sam.call("GET", "/api/me/actions");
    check("alert: gone once the claim's in", !(r.body.items || []).some((it) => it.kind === "pickup" && it.leagueId === classic), r.body.items);
    r = await kim.call("POST", `${L}/waivers/nudge`, { playerId: "p-sam" });
    check("nudge: not someone whose claim is in", r.status === 409, r);

    // The job after processing time: the week processes, is written, and is announced.
    lines = [];
    job = await runWaivers(pool, { now: processAt + 5 * 60e3, leagueIds: ids, log: (l) => lines.push(l) });
    st = (await sam.call("GET", `${L}/state`)).body.state;
    check("job: processed on schedule", job.steps >= 1 && week(st).phase === "processed" && week(st).run?.by === "schedule", { job, phase: week(st).phase });
    const classicLine = (id) => lines.find((l) => l.startsWith(`${id} -- `) && l.includes("Waivers Classic:"));
    const samLine = classicLine(samId);
    const josieLine = classicLine(josieId);
    check("job: Sam hears who he got", /You got Rob/.test(samLine || ""), lines);
    check("job: Josie hears 'Waivers processed', no names", /Waivers processed: .*reveal Episode 3/.test(josieLine || "") && !/Rob|Jelly|Maggie/.test(josieLine || ""), lines);
    job = await runWaivers(pool, { now: processAt + HOUR, leagueIds: ids, log: () => {} });
    check("job: an hour later, nothing new", job.steps === 0 && job.announced === 0, job);

    await windowChecks(pool);
  } finally {
    if (!process.argv.includes("--keep")) await fixture.down(pool);
    await pool.end();
  }
  console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed");
  process.exit(failed ? 1 : 0);
}

// ---- Waivers v2: the "Waiver window open" push and trimmed-claim notices ----

async function windowChecks(pool) {
  const made = await fixture.up(pool, ["--phase=open", "--airs-in=30", "--scenarios"]);
  const leagueId = made.find((m) => m.slug === "zt-wv-rebuild").leagueId;
  const [kim, sam] = await Promise.all(["zt_wcomm", "zt_wplayer"].map((user) => api({ user, pass: fixture.PASSWORD })));
  const [kimId, samId, josieId] = await Promise.all(["zt_wcomm", "zt_wplayer", "zt_wlate"].map((u) => userId(pool, u)));
  const L = `/api/leagues/${leagueId}`;
  const pair = (add, drop) => ({ addId: c(add), dropId: c(drop) });
  const state = async () => (await kim.call("GET", `${L}/state`)).body.state;
  const samPairs = async () => ((await sam.call("GET", `${L}/waivers`)).body.claim?.pairs || []).length;

  // One commissioner change through the route, then what its push says, from the same before/after.
  async function change(body, trimmedFrom) {
    const before = WP.windowSnapshot(await state());
    const samBefore = trimmedFrom ? await samPairs() : 0;
    const r = await kim.call("POST", `${L}/waivers/window`, body);
    const after = r.body;
    const trimmed = trimmedFrom && (await samPairs()) < samBefore ? ["p-sam"] : [];
    const lines = [];
    const p = S.WaiverLogic.periods(after).slice(-1)[0];
    await WP.sendWindow(pool, leagueId, after, before, p.id, trimmed, { actorUserId: kimId, dry: true, log: (l) => lines.push(l) });
    const to = (id) => lines.find((l) => l.startsWith(`(dry) ${id} -- `)) || "";
    return { r, p, lines, to, trimmed };
  }

  let x = await change({ swaps: 1, replace: true });
  check("window: Kim opens one (replace + 1 swap)", x.r.status === 200 && x.p.window && x.p.swaps === 1 && x.p.replace === true, x.p);
  check("window push: Sam hears the sheet's line", /^\(dry\) \S+ -- Waiver window open: Replace who's out · Swap 1: Waivers Rebuild: optional · claims due /.test(x.to(samId)), x.lines);
  check("window push: Josie hears it too, told to reveal first", /Waiver window open: Replace who's out · Swap 1: .*Reveal Episode 3 first/.test(x.to(josieId)), x.lines);
  check("window push: not Kim, who opened it", !x.to(kimId), x.lines);
  check("window push: no names", !x.lines.some((l) => /Jelly|Rob|Maggie|Kilby|Mike/.test(l)), x.lines);

  x = await change({ swaps: 1, replace: true });
  check("window push: the same window again tells nobody", x.r.status === 200 && x.lines.length === 0, x.lines);

  let r = await sam.call("PUT", `${L}/waivers/claims`, { pairs: [pair("Rob", "Jelly"), pair("Maggie", "Kilby")] });
  check("Sam claims Rob for Jelly and Maggie for Kilby", r.status === 200 && (await samPairs()) === 2, r);
  x = await change({ swaps: 1, replace: false }, true);
  check("window: replacements off trims Sam's claim to the swap", x.r.status === 200 && x.trimmed.length === 1 && (await samPairs()) === 1, { trimmed: x.trimmed, pairs: await samPairs() });
  check("window push: Sam hears his claim changed", /Your claim changed: Waivers Rebuild: the waiver window changed, so claims it no longer allows came out\. Check yours before /.test(x.to(samId)), x.lines);
  check("window push: Josie hears the new line", /Waiver window open: Swap 1: Waivers Rebuild: claims due/.test(x.to(josieId)), x.lines);

  x = await change({ swaps: null }, true);
  check("window: turned off, the week ends (manual, nothing else to run)", x.r.status === 200 && x.p.phase === "closed" && x.p.turnedOff, x.p);
  check("window push: Sam's claims came out", /Your claims came out: Waivers Rebuild: the waiver window was turned off/.test(x.to(samId)), x.lines);
  check("window push: Josie hears it's off", /Waiver window off: Waivers Rebuild: your commissioner turned it off\. Nothing to claim this week\./.test(x.to(josieId)), x.lines);
  check("window push: still not Kim", !x.to(kimId), x.lines);
}

async function userId(pool, username) {
  return (await pool.query(`SELECT id FROM "user" WHERE username=$1`, [username])).rows[0]?.id;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
