// A night with more than one exit keeps the season's order through a correction (season-decisions.ts syncLeagueDecisions,
// decision-apply.ts orderPlacementsByEpisode's `within`): the sync takes a re-decided elimination off and puts it back, and
// put back it used to come after the night's others, swapping their finishing places in every game (and Outlast's points,
// which are the finishing order). The season's order is the decisions' own, as the sync's query sorts them (created_at).
// Found by the season-forward rehearsal (docs/PLAN-researched-survivor.md, its "What's wrong" item 1). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const StateLogic = require("../src/lib/game/state-logic.js");
const { syncLeagueDecisions } = jiti("../src/lib/server/season-decisions.ts");

const CAST = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Edsger Dijkstra", "Barbara Liskov", "Donald Knuth", "Frances Allen"];

function league() {
  const s = StateLogic.defaultState();
  s.settings.showId = "my-show";
  s.settings.wikiSeason = 3;
  s.settings.showFormat = "survivor";
  StateLogic.applyCastImport(s, { castaways: CAST.map((name) => ({ name })) });
  return s;
}

let clock = Date.parse("2026-10-08T12:00:00Z");
const tick = () => new Date((clock += 60_000));
/** One season decision, filed now (created_at: its place in the season's order). */
const out = (id, episode, name, method = "Voted Out") => {
  const at = tick();
  return { id, episode_number: episode, post_merge: false, kind: "elimination", castaway_name: name, method, event_type: "", jury_votes: null, units: null, applied: null, decided_at: at, created_at: at, status: "accepted" };
};
/** The desk's edit (desk-facts.ts decideFact): the row keeps its place, takes what it's corrected to, and a new decided_at. */
const correct = (d, applied) => Object.assign(d, { applied: { ...(d.applied ?? {}), ...applied }, decided_at: tick() });

// An in-memory season (its decisions, every status), the league's ledger and rulings, answering the sync's queries.
function fakeClient(world) {
  const seasonOrder = (a, b) => a.episode_number - b.episode_number || Number(b.kind === "elimination") - Number(a.kind === "elimination") || a.created_at - b.created_at;
  return {
    async query(sql, params) {
      const q = sql.replace(/\s+/g, " ").trim();
      if (q.startsWith("SELECT ss.id, ss.results_by")) return { rows: [{ id: "season-3", resultsBy: "admin", adminSince: null }] };
      if (q.includes("FROM season_decisions WHERE season_id=$1 AND status='accepted'")) {
        return { rows: world.decisions.filter((d) => d.status === "accepted").sort(seasonOrder) };
      }
      if (q.includes("FROM league_rulings")) {
        return { rows: world.rulings.map((r) => ({ ...r, placed: world.decisions.find((d) => d.id === r.decision_id).created_at })) };
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
      if (q.startsWith("SELECT id, episode_number, post_merge, kind, castaway_name, method, event_type, jury_votes, units, applied, decided_at FROM season_decisions WHERE id = ANY")) {
        return { rows: world.decisions.filter((d) => params[0].includes(d.id)) };
      }
      if (q.startsWith("INSERT INTO league_changes")) return { rows: [] };
      if (q.startsWith("SELECT DISTINCT episode_number AS n FROM episode_research")) return { rows: [] };
      if (q.startsWith("SELECT couch_id FROM leagues")) return { rows: [{ couch_id: null }] };
      if (q.includes("FROM season_cast sc")) return { rows: [] };
      if (q.startsWith("SELECT id, name FROM season_cast WHERE season_id")) return { rows: [] };
      if (/^(SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT)/.test(q)) return { rows: [] };
      throw new Error("unexpected query: " + q.slice(0, 120));
    },
  };
}

const world = (decisions) => ({ decisions, rulings: [], ledger: new Map() });
const sync = (s, w) => syncLeagueDecisions(fakeClient(w), "league-a", s);
const first = (name) => name.split(" ")[0];
/** Who's out, first out first: "Ada 1 Voted Out". */
const places = (s) =>
  s.castaways
    .filter((c) => c.status === "eliminated")
    .sort((a, b) => a.placementOrder - b.placementOrder)
    .map((c) => `${first(c.name)} ${c.placementOrder} ${c.exitMethod}`);
/** An episode's list of exits, in its order. */
const exits = (s, n) => s.episodes.find((e) => e.number === n).events.map((e) => first(s.castaways.find((c) => c.id === e.castawayId).name));
const castaway = (s, name) => s.castaways.find((c) => c.name === name);

test("a double boot, the first corrected: both keep their places, and Outlast's points", async () => {
  const s = league();
  const w = world([out("e1", 1, "Ada Lovelace"), out("e2a", 2, "Grace Hopper"), out("e2b", 2, "Alan Turing")]);
  await sync(s, w);
  assert.deepEqual(places(s), ["Ada 1 Voted Out", "Grace 2 Voted Out", "Alan 3 Voted Out"]);

  correct(w.decisions[1], { method: "Medically Evacuated" });
  const r = await sync(s, w);
  assert.equal(r.undone, 1);
  assert.equal(r.applied, 1);
  assert.deepEqual(places(s), ["Ada 1 Voted Out", "Grace 2 Medically Evacuated", "Alan 3 Voted Out"]);
  assert.deepEqual(exits(s, 2), ["Grace", "Alan"]);
  // Outlast scores the finishing order: out 2nd is 2 points, out 3rd 3.
  assert.equal(StateLogic.EliminationOrderScoringStrategy.castawayPoints(s, castaway(s, "Grace Hopper")), 2);
  assert.equal(StateLogic.EliminationOrderScoringStrategy.castawayPoints(s, castaway(s, "Alan Turing")), 3);

  // Again changes nothing.
  const again = await sync(s, w);
  assert.deepEqual([again.applied, again.undone], [0, 0]);
  assert.deepEqual(places(s), ["Ada 1 Voted Out", "Grace 2 Medically Evacuated", "Alan 3 Voted Out"]);
});

test("a double boot, the second corrected (and then the first): the night's order holds", async () => {
  const s = league();
  const w = world([out("e1", 1, "Ada Lovelace"), out("e2a", 2, "Grace Hopper"), out("e2b", 2, "Alan Turing"), out("e3", 3, "Edsger Dijkstra")]);
  await sync(s, w);
  correct(w.decisions[2], { method: "Quit" });
  await sync(s, w);
  assert.deepEqual(places(s), ["Ada 1 Voted Out", "Grace 2 Voted Out", "Alan 3 Quit", "Edsger 4 Voted Out"]);
  correct(w.decisions[1], { method: "Medically Evacuated" });
  await sync(s, w);
  assert.deepEqual(places(s), ["Ada 1 Voted Out", "Grace 2 Medically Evacuated", "Alan 3 Quit", "Edsger 4 Voted Out"]);
  assert.deepEqual(exits(s, 2), ["Grace", "Alan"]);
});

test("a triple: the middle one corrected, then corrected to someone else; the later episode stays after", async () => {
  const s = league();
  const w = world([out("e2a", 2, "Grace Hopper"), out("e2b", 2, "Alan Turing"), out("e2c", 2, "Edsger Dijkstra"), out("e3", 3, "Barbara Liskov")]);
  await sync(s, w);
  correct(w.decisions[1], { method: "Medically Evacuated" });
  await sync(s, w);
  assert.deepEqual(places(s), ["Grace 1 Voted Out", "Alan 2 Medically Evacuated", "Edsger 3 Voted Out", "Barbara 4 Voted Out"]);
  // Who it was, corrected: Donald went out second, not Alan.
  correct(w.decisions[1], { castawayName: "Donald Knuth" });
  await sync(s, w);
  assert.deepEqual(places(s), ["Grace 1 Voted Out", "Donald 2 Medically Evacuated", "Edsger 3 Voted Out", "Barbara 4 Voted Out"]);
  assert.equal(castaway(s, "Alan Turing").status, "active");
  assert.deepEqual(exits(s, 2), ["Grace", "Donald", "Edsger"]);
});

test("rejected and accepted again: back in its place, not after the night's others", async () => {
  const s = league();
  const w = world([out("e2a", 2, "Grace Hopper"), out("e2b", 2, "Alan Turing")]);
  await sync(s, w);
  Object.assign(w.decisions[0], { status: "rejected", decided_at: tick() });
  await sync(s, w);
  assert.deepEqual(places(s), ["Alan 1 Voted Out"]);
  Object.assign(w.decisions[0], { status: "accepted", decided_at: tick() });
  await sync(s, w);
  assert.deepEqual(places(s), ["Grace 1 Voted Out", "Alan 2 Voted Out"]);
  assert.deepEqual(exits(s, 2), ["Grace", "Alan"]);
});

test("a house ruling going on and coming off keeps the night's order", async () => {
  const s = league();
  const w = world([out("e1", 1, "Ada Lovelace"), out("e2a", 2, "Grace Hopper"), out("e2b", 2, "Alan Turing")]);
  await sync(s, w);
  // The desk corrects Grace to a medical evacuation; this league keeps her voted out (its ruling).
  correct(w.decisions[1], { method: "Medically Evacuated" });
  const keeps = { episode_number: 2, post_merge: false, kind: "elimination", castaway_name: "Grace Hopper", method: "Voted Out", event_type: "", jury_votes: null, units: null, applied: null };
  w.rulings.push({ decision_id: "e2a", keeps, created_at: tick() });
  await sync(s, w);
  assert.deepEqual(places(s), ["Ada 1 Voted Out", "Grace 2 Voted Out", "Alan 3 Voted Out"]);
  assert.deepEqual(exits(s, 2), ["Grace", "Alan"]);
  // The ruling comes off: the season's version, in the same place.
  w.rulings.length = 0;
  await sync(s, w);
  assert.deepEqual(places(s), ["Ada 1 Voted Out", "Grace 2 Medically Evacuated", "Alan 3 Voted Out"]);
  assert.deepEqual(exits(s, 2), ["Grace", "Alan"]);
});

test("a league's own exit that night keeps its place; a night nobody corrected isn't reordered", async () => {
  const s = league();
  // This game's commissioner had Frances out first in Episode 2, by hand (no season decision gave it).
  const ep2 = StateLogic.ensureEpisodeNumber(s, 2, false);
  StateLogic.addElimination(s, ep2.id, castaway(s, "Frances Allen").id, "Voted Out");
  // Episode 3's two exits reached this game the other way round (the second was accepted first): the season says Barbara
  // went first.
  const b3 = out("e3a", 3, "Barbara Liskov");
  const w = world([out("e2a", 2, "Grace Hopper"), out("e2b", 2, "Alan Turing"), out("e3b", 3, "Donald Knuth")]);
  await sync(s, w);
  w.decisions.push(b3);
  // Synced on its own, Barbara's arrival puts Episode 3 in the season's order.
  await sync(s, w);
  assert.deepEqual(places(s), ["Frances 1 Voted Out", "Grace 2 Voted Out", "Alan 3 Voted Out", "Barbara 4 Voted Out", "Donald 5 Voted Out"]);

  // Hand Episode 3 back the other way round (as an older sync could have left it), then correct Episode 2's first exit:
  // Episode 2 is put in the season's order around Frances, and Episode 3, which nobody corrected, is left as it is.
  const [barbara, donald] = [castaway(s, "Barbara Liskov"), castaway(s, "Donald Knuth")];
  [barbara.placementOrder, donald.placementOrder] = [5, 4];
  correct(w.decisions[0], { method: "Medically Evacuated" });
  await sync(s, w);
  assert.deepEqual(places(s), ["Frances 1 Voted Out", "Grace 2 Medically Evacuated", "Alan 3 Voted Out", "Donald 4 Voted Out", "Barbara 5 Voted Out"]);
  assert.deepEqual(exits(s, 2), ["Frances", "Grace", "Alan"]);
});
