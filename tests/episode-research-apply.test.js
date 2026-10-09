// A commissioner applying staged research to their own league (src/lib/server/episode-research-apply.ts,
// docs/PLAN-episode-research-compiled-cache.md piece 4), and -- the plan's named risk -- that it and the
// admin's season-wide accept (src/lib/server/season-decisions.ts syncLeagueDecisions, run for real here
// against an in-memory ledger) never double-score one decision, in either order. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const StateLogic = require("../src/lib/game/state-logic.js");
const { applyResearchDecisions, inLeague } = jiti("../src/lib/server/episode-research-apply.ts");
const { syncLeagueDecisions } = jiti("../src/lib/server/season-decisions.ts");

function league() {
  const s = StateLogic.defaultState();
  s.settings.showId = "my-show";
  s.settings.wikiSeason = 3;
  s.settings.showFormat = "survivor";
  StateLogic.applyCastImport(s, { castaways: ["Ada Lovelace", "Grace Hopper", "Alan Turing"].map((name) => ({ name })) });
  return s;
}
const eventType = (s) => StateLogic.formatOf(s).events[0].id;

// The season's decisions as season_decisions holds them, and an in-memory league_applied_decisions.
function season(s) {
  const decidedAt = new Date("2026-10-08T12:00:00Z");
  const decisions = [
    { id: "d-elim", episode_number: 1, post_merge: false, kind: "elimination", castaway_name: "Ada Lovelace", method: "Voted Out", event_type: "", jury_votes: null, applied: null, decided_at: decidedAt },
    { id: "d-event", episode_number: 1, post_merge: false, kind: "event", castaway_name: "Grace Hopper", method: "", event_type: eventType(s), jury_votes: null, applied: null, decided_at: decidedAt },
  ];
  return { decisions, accepted: new Set(), ledger: new Map() };
}

function fakeClient(world) {
  return {
    async query(sql, params) {
      const q = sql.replace(/\s+/g, " ").trim();
      if (q.startsWith("SELECT ss.id FROM show_seasons ss JOIN shows s")) return { rows: [{ id: "season-3" }] };
      if (q.includes("FROM season_decisions WHERE season_id=$1 AND status='accepted'")) {
        return { rows: world.decisions.filter((d) => world.accepted.has(d.id)) };
      }
      if (q.startsWith("SELECT decision_id, decided_at, detail FROM league_applied_decisions")) {
        return { rows: [...world.ledger.entries()].map(([decision_id, v]) => ({ decision_id, ...v })) };
      }
      if (q.startsWith("DELETE FROM league_applied_decisions")) {
        world.ledger.delete(params[1]);
        return { rows: [] };
      }
      if (q.startsWith("INSERT INTO league_applied_decisions")) {
        world.ledger.set(params[1], { decided_at: params[2], detail: JSON.parse(params[3]) });
        return { rows: [] };
      }
      if (q.includes("FROM season_cast sc")) return { rows: [] };
      throw new Error("unexpected query: " + q.slice(0, 120));
    },
  };
}

// What the commissioner's panel sends for the two staged rows.
const items = (s) => [
  { kind: "elimination", castawayName: "Ada Lovelace", method: "Voted Out" },
  { kind: "event", castawayName: "Grace Hopper", eventType: eventType(s) },
];

// Everything that could be counted twice.
function tally(s) {
  const ep = s.episodes.find((e) => e.number === 1);
  const ada = s.castaways.find((c) => c.name === "Ada Lovelace");
  return {
    eliminationsInEp1: ep ? ep.events.length : 0,
    eventsInEp1: ep ? ep.scoringEvents.length : 0,
    episodes: s.episodes.map((e) => e.number),
    ada: { status: ada.status, placementOrder: ada.placementOrder, exitMethod: ada.exitMethod },
    eliminatedCount: s.castaways.filter((c) => c.status === "eliminated").length,
  };
}

test("commissioner applies first, then the admin accepts season-wide: nothing double-applies, and a later reject leaves the commissioner's results", async () => {
  const s = league();
  const world = season(s);

  const applied = applyResearchDecisions(s, 1, items(s));
  assert.equal(applied.eliminations.length, 1);
  assert.equal(applied.events.length, 1);
  const once = tally(s);
  assert.equal(once.eliminationsInEp1, 1);
  assert.equal(once.eventsInEp1, 1);
  assert.equal(once.ada.placementOrder, 1);

  // Admin accepts both; the season sync runs over this league.
  world.accepted = new Set(["d-elim", "d-event"]);
  const r = await syncLeagueDecisions(fakeClient(world), "league-a", s);
  assert.deepEqual(tally(s), once, "the admin's accept added nothing on top");
  assert.equal(r.skipped.length, 0);
  assert.equal(world.ledger.get("d-elim").detail.preexisting, true);
  assert.equal(world.ledger.get("d-event").detail.preexisting, true);
  // Run again (a reveal, another admin click): still nothing.
  await syncLeagueDecisions(fakeClient(world), "league-a", s);
  assert.deepEqual(tally(s), once);

  // The admin later rejects both: the sync undoes only what IT added -- which is nothing here.
  world.accepted = new Set();
  await syncLeagueDecisions(fakeClient(world), "league-a", s);
  assert.deepEqual(tally(s), once, "a season-wide reject doesn't take back what this league's commissioner applied");
  assert.equal(world.ledger.size, 0);
});

test("the admin's accept reaches the league first, then the commissioner applies: the commissioner's apply is a no-op", async () => {
  const s = league();
  const world = season(s);
  world.accepted = new Set(["d-elim", "d-event"]);
  await syncLeagueDecisions(fakeClient(world), "league-a", s);
  const once = tally(s);
  assert.equal(once.eliminationsInEp1, 1);
  assert.equal(once.eventsInEp1, 1);
  assert.equal(world.ledger.get("d-elim").detail.preexisting, undefined, "applied by the sync itself");

  const r = applyResearchDecisions(s, 1, items(s));
  assert.deepEqual(r.eliminations, []);
  assert.deepEqual(r.events, []);
  assert.equal(r.skipped.length, 2);
  assert.deepEqual(tally(s), once);
});

test("applying the same rows twice is a no-op the second time", () => {
  const s = league();
  applyResearchDecisions(s, 1, items(s));
  const once = tally(s);
  const again = applyResearchDecisions(s, 1, items(s));
  assert.deepEqual(again.eliminations, []);
  assert.deepEqual(again.events, []);
  assert.deepEqual(tally(s), once);
});

test("a correction is held to the league's own format; a name that doesn't resolve is reported", () => {
  const s = league();
  const r = applyResearchDecisions(s, 1, [
    { kind: "elimination", castawayName: "Ada Lovelace", method: "Murdered" },
    { kind: "event", castawayName: "Grace Hopper", eventType: "notARealEvent" },
    { kind: "elimination", castawayName: "Nobody Atall", method: "Voted Out" },
  ]);
  assert.deepEqual(r.eliminations, []);
  assert.deepEqual(r.events, []);
  assert.ok(r.skipped.some((x) => /Murdered/.test(x)));
  assert.ok(r.skipped.some((x) => /notARealEvent/.test(x)));
  assert.deepEqual(r.unresolved, ["Nobody Atall"]);
  assert.equal(s.castaways.every((c) => c.status === "active"), true);
});

test("inLeague: true once a row's result is in the episode, by whichever path", () => {
  const s = league();
  const row = { kind: "event", castawayName: "Grace", eventType: eventType(s) };
  assert.equal(inLeague(s, 1, row), false);
  applyResearchDecisions(s, 1, items(s));
  assert.equal(inLeague(s, 1, row), true);
  assert.equal(inLeague(s, 1, { kind: "elimination", castawayName: "Ada Lovelace", eventType: "" }), true);
  assert.equal(inLeague(s, 1, { kind: "elimination", castawayName: "Alan Turing", eventType: "" }), false);
});
