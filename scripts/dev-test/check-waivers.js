// Dev-only test bank: the waiver routes end to end (docs/PLAN-midseason-waivers.md), as the three people
// in waivers-fixture.js, against the dev server (npm run dev). API only, no browser.
//
//   node scripts/dev-test/check-waivers.js [--keep]
//
// Brings waivers-fixture.js up at --phase=open itself, then checks, mostly in the Classic league:
//   - claims are private: saved claims never appear in league state, and GET /waivers only ever gives
//     you your own (the commissioner sees who has claims in, not what)
//   - a claim saves by part (the pickup list, or the add/drop), leaving the other as it was
//   - the reveal gate: zt_wlate (seen through 2) can't claim or move in free agency until they reveal,
//     and their copy of the league (GhostLogic.viewFor, as the app builds it) shows no pickup or add/drop
//   - the commissioner can claim for someone, Process now, and Undo last waiver run; nobody else can
//   - processing follows the canvas (Sam's pickup beats Kim's add/drop to Rob), free agency is
//     instant and one add/drop per week, and undo puts everything back with claims reopened
//   - Active Roster (shared): a pickup claim goes through
// Prints each check; exits 1 if any fail. Takes the fixture down afterwards unless --keep.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");
const { api } = require("./browser");
const fixture = require("./waivers-fixture");

const c = fixture.slugId;
let failed = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || detail === undefined ? "" : `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)})`}`);
  if (!ok) failed++;
}
const week = (state) => S.WaiverLogic.periods(state).slice(-1)[0];
const owners = (state, name) => (S.getCastaway(state, c(name)) || {}).ownerIds || [];

async function main() {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    const made = await fixture.up(pool, ["--phase=open"]);
    const classic = made.find((m) => m.slug === "zt-wv-classic").leagueId;
    const roster = made.find((m) => m.slug === "zt-wv-roster").leagueId;
    const [kim, sam, josie] = await Promise.all(["zt_wcomm", "zt_wplayer", "zt_wlate"].map((user) => api({ user, pass: fixture.PASSWORD })));
    const L = `/api/leagues/${classic}`;

    let r = await sam.call("GET", `${L}/state`);
    check("the week is open after episode 3, an add/drop week", r.status === 200 && week(r.body.state)?.phase === "open" && week(r.body.state)?.addDrop, r.body);

    // The reveal gate.
    r = await josie.call("PUT", `${L}/waivers/claims`, { dropId: c("Lewis"), addIds: [c("Rob")] });
    check("not revealed: claims refused", r.status === 409 && /Reveal episode 3/.test(r.body.error), r);
    r = await josie.call("GET", `${L}/waivers`);
    check("not revealed: your claim is held back", r.status === 200 && r.body.hidden === true && r.body.claim === null, r);

    // Claims, and their privacy.
    const samClaim = { pickupIds: [c("Rob"), c("Maggie")], dropId: c("Kilby"), addIds: [c("Maggie"), c("Patt")] };
    r = await sam.call("PUT", `${L}/waivers/claims`, samClaim);
    check("Sam saves the canvas's claims", r.status === 200 && week(r.body)?.claimsIn.includes("p-sam"), r);
    check("the saved league carries who, not what", r.status === 200 && !JSON.stringify(r.body).includes("pickupIds"));
    r = await sam.call("GET", `${L}/waivers`);
    check("Sam reads his own claim back", JSON.stringify(r.body.claim) === JSON.stringify(samClaim), r.body);
    // By part: the pickup picker and the add/drop picker each save their own part, and leave the other.
    await sam.call("PUT", `${L}/waivers/claims`, { pickupIds: [c("Maggie"), c("Rob")] });
    r = await sam.call("GET", `${L}/waivers`);
    check("saving only the pickups keeps the add/drop", r.body.claim?.pickupIds[0] === c("Maggie") && r.body.claim?.dropId === c("Kilby") && r.body.claim?.addIds.length === 2, r.body);
    await sam.call("PUT", `${L}/waivers/claims`, { dropId: null, addIds: [] });
    r = await sam.call("GET", `${L}/waivers`);
    check("withdrawing the add/drop keeps the pickups", r.body.claim?.pickupIds.length === 2 && r.body.claim?.dropId === null, r.body);
    await sam.call("PUT", `${L}/waivers/claims`, samClaim);
    r = await kim.call("GET", `${L}/waivers`);
    check("the commissioner can't read Sam's claim", r.status === 200 && r.body.claim === null && !JSON.stringify(r.body).includes(c("Patt")), r.body);
    r = await kim.call("GET", `${L}/state`);
    check("league state never holds claim contents", !JSON.stringify(r.body.state.midSeason).includes("addIds"));
    r = await sam.call("PUT", `${L}/waivers/claims`, { playerId: "p-josie", dropId: c("Lewis"), addIds: [c("Rob")] });
    check("a player can't claim for someone else", r.status === 403, r);
    r = await kim.call("PUT", `${L}/waivers/claims`, { playerId: "p-josie", dropId: c("Lewis"), addIds: [c("Rob")] });
    check("the commissioner claims for Josie (not held to Josie's reveal)", r.status === 200 && week(r.body).claimsIn.includes("p-josie"), r);
    r = await sam.call("PUT", `${L}/waivers/claims`, { pickupIds: [c("Mike")] });
    check("a claim on someone owned is refused", r.status === 400 && /free agents only/.test(r.body.error), r);
    r = await sam.call("POST", `${L}/waivers/free-agency`, { addId: c("Ori") });
    check("no free agency before waivers process", r.status === 400 && /isn’t open/.test(r.body.error), r);

    // Processing.
    r = await sam.call("POST", `${L}/waivers/process`);
    check("only the commissioner can Process now", r.status === 403, r);
    r = await kim.call("POST", `${L}/waivers/process`);
    const run = r.body && week(r.body)?.run;
    const res = (pid, kind) => (run?.results || []).find((x) => x.playerId === pid && x.kind === kind) || {};
    check("Process now: the week is in free agency", r.status === 200 && week(r.body).phase === "processed", r);
    check("Sam's pickup is Rob, for Jelly", res("p-sam", "pickup").castawayId === c("Rob") && res("p-sam", "pickup").droppedCastawayId === c("Jelly"), run);
    check("Sam's add/drop is Kilby for Maggie", res("p-sam", "addDrop").castawayId === c("Maggie"), run);
    check("Josie's claim for Rob lost to a pickup", res("p-josie", "addDrop").outcome === "missed" && res("p-josie", "addDrop").passed[0]?.reason === "pickupFirst", run);
    check("rolling order: Sam to the back", run?.orderAfter.slice(-1)[0] === "p-sam", run?.orderAfter);
    r = await sam.call("PUT", `${L}/waivers/claims`, samClaim);
    check("claims are closed once processed", r.status === 400 && /closed/.test(r.body.error), r);

    // Free agency.
    r = await sam.call("POST", `${L}/waivers/free-agency`, { addId: c("Linnea"), dropId: c("Eric") });
    check("free agency: only your own castaway can be dropped", r.status === 400, r);
    r = await sam.call("POST", `${L}/waivers/free-agency`, { addId: c("Linnea"), dropId: c("Thien An") });
    check("free agency: one add/drop a week", r.status === 400 && /made this week/.test(r.body.error), r);
    r = await josie.call("POST", `${L}/waivers/free-agency`, { addId: c("Kilby"), dropId: c("Lewis") });
    check("not revealed: free agency refused too", r.status === 409, r);
    r = await josie.call("GET", `${L}/state`);
    const v = S.GhostLogic.viewFor(r.body.state, "p-josie", r.body.membership.resultsSeenThrough);
    check("Josie's copy: Sam still has Jelly and Kilby, no Rob", owners(v, "Jelly").includes("p-sam") && owners(v, "Kilby").includes("p-sam") && !owners(v, "Rob").length);
    check("Josie's copy: the week shows no claims or results", week(v).hidden === true && week(v).run === null && !week(v).claimsIn.length, week(v));
    r = await josie.call("POST", `${L}/results-seen`, { through: 3 });
    r = await josie.call("POST", `${L}/waivers/free-agency`, { addId: c("Kilby"), dropId: c("Lewis") });
    check("revealed: Josie adds Kilby (just dropped) in free agency", r.status === 200 && owners(r.body, "Kilby").includes("p-josie"), r);
    r = await sam.call("POST", `${L}/waivers/free-agency`, { addId: c("Kilby") });
    check("first come: Kilby's gone", r.status === 409 || r.status === 400, r);

    // Undo.
    r = await sam.call("POST", `${L}/waivers/undo`);
    check("only the commissioner can undo", r.status === 403, r);
    r = await kim.call("POST", `${L}/waivers/undo`);
    const u = r.body;
    check("undo: Rob is a free agent again", r.status === 200 && !owners(u, "Rob").length, r);
    check("undo: Kilby back with Sam, Lewis with Josie, Jelly with Sam", owners(u, "Kilby").includes("p-sam") && owners(u, "Lewis").includes("p-josie") && owners(u, "Jelly").includes("p-sam"));
    check("undo: claims reopen, held", week(u)?.phase === "open" && week(u)?.hold === true, week(u));
    r = await sam.call("GET", `${L}/waivers`);
    check("undo: Sam's claim is still there", JSON.stringify(r.body.claim) === JSON.stringify(samClaim), r.body);
    r = await kim.call("POST", `${L}/waivers/process`);
    check("process again after undo", r.status === 200 && owners(r.body, "Rob").includes("p-sam"), r);

    // Active Roster, shared ownership.
    const R = `/api/leagues/${roster}`;
    r = await sam.call("PUT", `${R}/waivers/claims`, { pickupIds: [c("Rob")] });
    check("Active Roster: Sam claims a pickup", r.status === 200, r);
    r = await kim.call("POST", `${R}/waivers/process`);
    check("Active Roster: the pickup goes through", r.status === 200 && owners(r.body, "Rob").includes("p-sam"), r);
  } finally {
    if (!process.argv.includes("--keep")) await fixture.down(pool);
    await pool.end();
  }
  console.log(failed ? `\n${failed} failed` : "\nall passed");
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
