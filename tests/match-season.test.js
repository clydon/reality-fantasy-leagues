// Making every game match the season (src/lib/game/decision-apply.ts ownResults, season-decisions.ts syncLeagueDecisions'
// `match`; the desk's episode page): a league's own results for an episode, ones no season decision gave it or found there,
// come out, the season's stay; who went home comes out only where the season has settled it. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const StateLogic = require("../src/lib/game/state-logic.js");
const { applyResearchDecisions } = jiti("../src/lib/server/episode-research-apply.ts");
const { syncLeagueDecisions } = jiti("../src/lib/server/season-decisions.ts");
const { ownResults } = jiti("../src/lib/game/decision-apply.ts");

function league() {
  const s = StateLogic.defaultState();
  s.settings.showId = "my-show";
  s.settings.wikiSeason = 3;
  s.settings.showFormat = "survivor";
  StateLogic.applyCastImport(s, { castaways: ["Ada Lovelace", "Grace Hopper", "Alan Turing"].map((name) => ({ name })) });
  return s;
}
const types = (s) => StateLogic.formatOf(s).events.filter((e) => !e.implied).map((e) => e.id);
const decidedAt = new Date("2026-10-08T12:00:00Z");
const decision = (id, kind, name, extra = {}) => ({ id, episode_number: 1, post_merge: false, kind, castaway_name: name, method: "", event_type: "", jury_votes: null, units: null, applied: null, decided_at: decidedAt, ...extra });

// An in-memory season (its accepted decisions), ledger and change log, answering the sync's queries.
function fakeClient(world) {
  return {
    async query(sql, params) {
      const q = sql.replace(/\s+/g, " ").trim();
      if (q.startsWith("SELECT ss.id, ss.results_by")) return { rows: [{ id: "season-3", resultsBy: "admin", adminSince: null }] };
      if (q.includes("FROM season_decisions WHERE season_id=$1 AND status='accepted'")) return { rows: world.decisions };
      if (q.startsWith("SELECT decision_id, decided_at, detail FROM league_applied_decisions")) {
        return { rows: [...world.ledger.entries()].map(([decision_id, v]) => ({ decision_id, ...v })) };
      }
      if (q.startsWith("SELECT detail FROM league_applied_decisions")) return { rows: [...world.ledger.values()].map((v) => ({ detail: v.detail })) };
      if (q.startsWith("DELETE FROM league_applied_decisions")) {
        world.ledger.delete(params[1]);
        return { rows: [] };
      }
      if (q.startsWith("INSERT INTO league_applied_decisions")) {
        world.ledger.set(params[1], { decided_at: params[2], detail: JSON.parse(params[3]) });
        return { rows: [] };
      }
      if (q.startsWith("INSERT INTO league_changes")) {
        world.changes.push(params);
        return { rows: [] };
      }
      if (q.includes("FROM league_rulings")) return { rows: [] };
      if (q.startsWith("SELECT DISTINCT episode_number AS n FROM episode_research")) return { rows: [] };
      if (q.startsWith("SELECT couch_id FROM leagues")) return { rows: [{ couch_id: null }] };
      if (q.startsWith("SELECT id, episode_number, post_merge, kind, castaway_name, method, event_type, jury_votes, units, applied, decided_at FROM season_decisions WHERE id = ANY")) {
        return { rows: world.decisions.filter((d) => params[0].includes(d.id)) };
      }
      if (q.includes("FROM season_cast sc")) return { rows: [] };
      if (/^(SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT)/.test(q)) return { rows: [] };
      if (q.startsWith("SELECT id, name FROM season_cast WHERE season_id")) return { rows: [] };
      throw new Error("unexpected query: " + q.slice(0, 120));
    },
  };
}

const said = (s) => {
  const ep = s.episodes.find((e) => e.number === 1);
  const name = (id) => s.castaways.find((c) => c.id === id).name.split(" ")[0];
  return [...ep.events.map((e) => `out ${name(e.castawayId)}`), ...ep.scoringEvents.map((e) => `${e.type} ${name(e.castawayId)}`)].sort();
};

test("a game's own results beyond the season's come out; the season's, found there or given, stay", async () => {
  const s = league();
  const [t1, t2] = types(s);
  // This game's commissioner applied research of its own: Ada out, Grace and Alan scoring.
  applyResearchDecisions(s, 1, [
    { kind: "elimination", castawayName: "Ada Lovelace", method: "Voted Out" },
    { kind: "event", castawayName: "Grace Hopper", eventType: t1 },
    { kind: "event", castawayName: "Alan Turing", eventType: t2 },
  ]);
  // The season says Ada went home and Grace scored, not Alan.
  const world = { decisions: [decision("d-out", "elimination", "Ada Lovelace", { method: "Voted Out" }), decision("d-grace", "event", "Grace Hopper", { event_type: t1 })], ledger: new Map(), changes: [] };

  await syncLeagueDecisions(fakeClient(world), "league-a", s);
  const ledger = [...world.ledger.values()].map((v) => v.detail);
  assert.deepEqual(
    ownResults(s, ledger, 1).map((o) => o.kind),
    ["event"],
    "before matching, Alan's moment is the game's own"
  );

  const r = await syncLeagueDecisions(fakeClient(world), "league-a", s, { match: [1] });
  assert.deepEqual(said(s), [`${t1} Grace`, "out Ada"].sort());
  assert.equal(r.undone, 1);
  assert.deepEqual(r.episodes, [1]);
  assert.equal(world.changes.length, 1, "an Episode 1 corrected line");
  // Run again: nothing more to take out.
  const again = await syncLeagueDecisions(fakeClient(world), "league-a", s, { match: [1] });
  assert.equal(again.undone, 0);
  assert.deepEqual(said(s), [`${t1} Grace`, "out Ada"].sort());
});

test("who went home stays where the season hasn't settled it; it comes out once the season says someone else", async () => {
  const s = league();
  const [t1] = types(s);
  applyResearchDecisions(s, 1, [
    { kind: "elimination", castawayName: "Ada Lovelace", method: "Voted Out" },
    { kind: "event", castawayName: "Grace Hopper", eventType: t1 },
  ]);
  // The season has only Grace's moment: nobody's said who went home.
  const world = { decisions: [decision("d-grace", "event", "Grace Hopper", { event_type: t1 })], ledger: new Map(), changes: [] };
  await syncLeagueDecisions(fakeClient(world), "league-a", s, { match: [1] });
  assert.deepEqual(said(s), [`${t1} Grace`, "out Ada"].sort(), "Ada stays out: the season hasn't said who went home");

  // The season settles it: Alan went home, not Ada.
  world.decisions.push(decision("d-alan", "elimination", "Alan Turing", { method: "Voted Out" }));
  await syncLeagueDecisions(fakeClient(world), "league-a", s, { match: [1] });
  assert.deepEqual(said(s), [`${t1} Grace`, "out Alan"].sort());
  assert.equal(s.castaways.find((c) => c.name === "Ada Lovelace").status, "active");
  assert.equal(s.castaways.find((c) => c.name === "Alan Turing").placementOrder, 1);
});

test("a kind the season says nothing about stays: a tribe swap only the game has", async () => {
  const s = league();
  const [t1] = types(s);
  StateLogic.addTribe(s, "Toka");
  const toka = s.tribes.find((t) => t.name === "Toka");
  const ep = StateLogic.ensureEpisodeNumber(s, 1, false);
  StateLogic.addGroupChange(s, ep.id, s.castaways[0].id, toka.id);
  applyResearchDecisions(s, 1, [{ kind: "event", castawayName: "Alan Turing", eventType: t1 }]);
  // The season has a moment for Grace and nothing about groups.
  const world = { decisions: [decision("d-grace", "event", "Grace Hopper", { event_type: t1 })], ledger: new Map(), changes: [] };
  await syncLeagueDecisions(fakeClient(world), "league-a", s, { match: [1] });
  assert.deepEqual(said(s), [`${t1} Grace`], "Alan's moment, a kind the season settled, came out");
  assert.equal(s.episodes.find((e) => e.number === 1).groups.length, 1, "the swap stayed");
});

test("without `match`, a game's own results are left alone", async () => {
  const s = league();
  const [t1, t2] = types(s);
  applyResearchDecisions(s, 1, [{ kind: "event", castawayName: "Alan Turing", eventType: t2 }]);
  const world = { decisions: [decision("d-grace", "event", "Grace Hopper", { event_type: t1 })], ledger: new Map(), changes: [] };
  await syncLeagueDecisions(fakeClient(world), "league-a", s);
  assert.deepEqual(said(s), [`${t1} Grace`, `${t2} Alan`].sort());
});
