// The "Import a cast" paste flow (docs/PLAN-cast-import-prompt.md): formats/cast-prompt.js's prompt and
// parser, and StateLogic.applyCastRoles, composed with the existing applyCastImport the way the route
// composes them. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../src/lib/game/formats/cast-prompt.js");
const Formats = require("../src/lib/game/formats/index.js");
const StateLogic = require("../src/lib/game/state-logic.js");

const survivor = Formats.formatFor("survivor");
const traitors = Formats.formatFor("traitors");
const generic = Formats.formatFor("generic");

const league = (showFormat) => {
  const s = StateLogic.defaultState();
  s.settings.showFormat = showFormat;
  return s;
};

// What the route does: people/photos/groups first, then roles, which match by name.
function apply(state, answer, format) {
  const parsed = C.parseCastImport(answer, format);
  const added = StateLogic.applyCastImport(state, C.toCastImport(parsed));
  const roles = StateLogic.applyCastRoles(state, C.toCastRoles(parsed, format));
  return { parsed, added, roles };
}

test("prompt: groups only for a show with groups, roles only for a show with roles, neither for generic", () => {
  const s = C.buildCastPrompt(survivor, { seasonName: "Season 50", showName: "Survivor" });
  assert.match(s, /Season 50 of "Survivor"/);
  assert.match(s, /startingGroup/);
  assert.match(s, /starting tribe/);
  assert.doesNotMatch(s, /startingRole/);

  const t = C.buildCastPrompt(traitors, { seasonName: "Season 4" });
  assert.match(t, /startingRole/);
  assert.match(t, /Only give "Traitor" or "Recruited Traitor".*everyone else is "Faithful"/);
  assert.doesNotMatch(t, /startingGroup/);

  const g = C.buildCastPrompt(generic, {});
  assert.doesNotMatch(g, /startingGroup|startingRole/);
  assert.match(g, /photoUrl/);
});

test("parse: chatter around the JSON is fine; garbage is a clear error", () => {
  const p = C.parseCastImport('Here you go:\n```json\n{"castaways":[{"name":"A","photoUrl":""}],"sources":["x"]}\n```', generic);
  assert.equal(p.castaways[0].name, "A");
  assert.deepEqual(p.sources, ["x"]);
  assert.throws(() => C.parseCastImport("no json here", generic), /no JSON object/);
  assert.throws(() => C.parseCastImport("{not json}", generic), /doesn't parse/);
});

test("parse: bad rows are kept with a reason; stray fields are dropped out loud", () => {
  const p = C.parseCastImport({
    castaways: [
      { name: "  Jo   Smith ", photoUrl: "https://x/jo.jpg", startingGroup: "Kele" },
      { name: "", photoUrl: "" },
      { name: "jo smith", photoUrl: "" },
      { name: "Sam", photoUrl: "not a url", startingRole: "Traitor" },
    ],
  }, survivor);
  assert.equal(p.castaways[0].name, "Jo Smith");
  assert.deepEqual(p.castaways[0].problems, []);
  assert.deepEqual(p.castaways[1].problems, ["No name"]);
  assert.deepEqual(p.castaways[2].problems, ["Listed twice"]);
  assert.equal(p.castaways[3].photoUrl, "");
  assert.equal("startingRole" in p.castaways[3], false, "no roles on a show without them");
  assert.ok(p.repairs.some((r) => /isn't a web address/.test(r.message)));
  assert.ok(p.repairs.some((r) => /no hidden roles/.test(r.message)));
});

test("parse: a role must be one of the format's values -- an unknown one is dropped, never kept verbatim", () => {
  const p = C.parseCastImport({
    castaways: [
      { name: "A", photoUrl: "", startingRole: "traitor" },
      { name: "B", photoUrl: "", startingRole: "Seer" },
      { name: "C", photoUrl: "", startingGroup: "Red" },
    ],
  }, traitors);
  assert.equal(p.castaways[0].startingRole, "Traitor", "case repaired to the canonical value");
  assert.equal(p.castaways[1].startingRole, "Faithful");
  assert.ok(p.repairs.some((r) => /Dropped the role "Seer"/.test(r.message)));
  assert.equal("startingGroup" in p.castaways[2], false);
  assert.deepEqual(C.toCastRoles(p, traitors).castaways, [{ name: "A", role: "Traitor" }], "the default records nothing");
});

test("groups-only show: applyCastImport creates tribes, people and photos; no role facts", () => {
  const s = league("survivor");
  const { added, roles } = apply(s, {
    castaways: [
      { name: "Jo", photoUrl: "https://x/jo.jpg", startingGroup: "Kele" },
      { name: "Sam", photoUrl: "", startingGroup: "Hina" },
      { name: "Ann", photoUrl: "", startingGroup: "kele" },
    ],
  }, survivor);
  assert.deepEqual(added.tribes, ["Kele", "Hina"]);
  assert.deepEqual(added.castaways, ["Jo", "Sam", "Ann"]);
  const kele = s.tribes.find((t) => t.name === "Kele");
  assert.equal(s.castaways.find((c) => c.name === "Ann").tribeId, kele.id);
  assert.equal(s.castaways.find((c) => c.name === "Jo").photoUrl, "https://x/jo.jpg");
  assert.equal(s.castaways.find((c) => c.name === "Sam").photoUrl, "");
  assert.deepEqual(roles.recorded, []);
  assert.equal(s.episodes.every((e) => !(e.roles || []).length), true);
});

test("roles show: applyCastRoles records episode-1 role facts after applyCastImport creates the people", () => {
  const s = league("traitors");
  const answer = {
    castaways: [
      { name: "Rob", photoUrl: "", startingRole: "Traitor" },
      { name: "Maura", photoUrl: "", startingRole: "Faithful" },
    ],
  };
  const { added, roles } = apply(s, answer, traitors);
  assert.deepEqual(added.castaways, ["Rob", "Maura"]);
  assert.deepEqual(added.tribes, []);
  assert.deepEqual(roles.recorded, ["Rob"]);
  const ep1 = s.episodes.find((e) => e.number === 1);
  const rob = s.castaways.find((c) => c.name === "Rob");
  assert.deepEqual(ep1.roles, [{ castawayId: rob.id, role: "Traitor" }]);
  assert.equal(StateLogic.roleOf(s, rob.id), "Traitor");
  assert.equal(StateLogic.roleOf(s, s.castaways.find((c) => c.name === "Maura").id), "Faithful");

  // Re-running changes nothing: nobody re-added, the role left alone.
  const again = apply(s, answer, traitors);
  assert.deepEqual(again.added.castaways, []);
  assert.deepEqual(again.roles.recorded, []);
  assert.deepEqual(again.roles.unchanged, ["Rob"]);
  assert.equal(ep1.roles.length, 1);
});

test("applyCastRoles: by name, a role already at that episode stays, unknown names and roles are refused", () => {
  const s = league("traitors");
  const a = StateLogic.addCastaway(s, "Ann");
  StateLogic.addCastaway(s, "Bo");
  const ep1 = StateLogic.ensureEpisodeNumber(s, 1, false);
  StateLogic.addRole(s, ep1.id, a.id, "Recruited Traitor");
  const r = StateLogic.applyCastRoles(s, {
    castaways: [
      { name: "ann", role: "Traitor" },
      { name: "BO", role: "Traitor" },
      { name: "Nobody", role: "Traitor" },
      { name: "Bo", role: "Seer" },
    ],
  });
  assert.deepEqual(r, { recorded: ["Bo"], unchanged: ["Ann"], unresolved: ["Nobody"] });
  assert.equal(ep1.roles.find((x) => x.castawayId === a.id).role, "Recruited Traitor");
  // A show without roles records nothing at all (and creates no episode for it).
  const g = league("generic");
  StateLogic.addCastaway(g, "Ann");
  assert.deepEqual(StateLogic.applyCastRoles(g, { castaways: [{ name: "Ann", role: "Traitor" }] }).recorded, []);
  assert.equal(g.episodes.some((e) => (e.roles || []).length), false);
});

test("an imported role is spoiler-gated like a wiki one: hidden from a viewer who hasn't seen episode 1", () => {
  const s = league("traitors");
  apply(s, { castaways: [{ name: "Rob", photoUrl: "", startingRole: "Traitor" }] }, traitors);
  const rob = s.castaways.find((c) => c.name === "Rob");
  const unseen = StateLogic.SpoilerLogic.viewThrough(s, 0);
  assert.equal(StateLogic.roleOf(unseen, rob.id), "Faithful");
  const seen = StateLogic.SpoilerLogic.viewThrough(s, 1);
  assert.equal(StateLogic.roleOf(seen, rob.id), "Traitor");
});

// The route's write (src/lib/server/cast-import.ts), without the database: it re-parses against the
// LEAGUE's format, so a role the client sent for a show without roles never lands.
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { importCast } = jiti("../src/lib/server/cast-import.ts");

test("route write, traitors league: people then roles, in one call", () => {
  const s = league("traitors");
  const r = importCast(s, '```json\n{"castaways":[{"name":"Rob","photoUrl":"https://x/r.png","startingRole":"Traitor"},{"name":"Eric","photoUrl":"","startingRole":"Faithful"},{"name":"Zed","photoUrl":"","startingRole":"Mole"}]}\n```');
  assert.deepEqual(r.added.castaways, ["Rob", "Eric", "Zed"]);
  assert.deepEqual(r.roles.recorded, ["Rob"]);
  assert.equal(s.episodes.flatMap((e) => e.roles || []).length, 1);
});

test("route write, survivor league: groups only, a stray startingRole never reaches state", () => {
  const s = league("survivor");
  const r = importCast(s, { castaways: [{ name: "Jo", photoUrl: "", startingGroup: "Kele", startingRole: "Traitor" }] });
  assert.deepEqual(r.added.tribes, ["Kele"]);
  assert.deepEqual(r.roles.recorded, []);
  assert.equal(s.episodes.flatMap((e) => e.roles || []).length, 0);
  assert.throws(() => importCast(s, "nope"), /no JSON object/);
});
