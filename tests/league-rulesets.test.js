// Scoring rules as data, phase 2 (docs/PLAN-scoring-rules-as-data.md, scoped to db/league-rulesets.js's
// actual migration 0052): a league's own ruleset copy, forked from a built-in, an approved show_format,
// or another league's shared copy. The database itself isn't needed for most of this -- `db` is a
// stand-in that answers the one query each helper makes. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const LR = require("../db/league-rulesets.js");
const Formats = require("../src/lib/game/formats/index.js");
const StateLogic = require("../src/lib/game/state-logic.js");

const survivorData = Formats.FORMATS.survivor.data;

test("rulesetProblems accepts a data-only built-in, refuses one with secret roles", () => {
  assert.deepEqual(LR.rulesetProblems(survivorData), []);
  assert.deepEqual(LR.rulesetProblems(Formats.FORMATS.challenge.data), []);
  assert.deepEqual(LR.rulesetProblems(Formats.FORMATS.generic.data), []);
  const problems = LR.rulesetProblems(Formats.FORMATS.traitors.data);
  assert.ok(problems.some((p) => p.includes("roles")), "Traitors' secret roles are refused, not silently dropped");
  assert.ok(LR.rulesetProblems({}).length > 0, "a broken data object is refused with a reason");
});

test("setLeagueRuleset mirrors setLeagueFormat: present data caches, falsy clears", () => {
  const s = {};
  LR.setLeagueRuleset(s, survivorData);
  assert.deepEqual(s, { leagueRulesetData: survivorData });
  LR.setLeagueRuleset(s, null);
  assert.deepEqual(s, {});
});

test("sourceDataFor: builtin branch resolves from the registry, refuses roles and unknown ids", async () => {
  const db = { query: async () => assert.fail("builtin never touches the database") };
  const got = await LR.sourceDataFor(db, { kind: "builtin", id: "survivor" });
  assert.equal(got.data, survivorData);
  assert.equal(got.parentVersion, null);
  await assert.rejects(() => LR.sourceDataFor(db, { kind: "builtin", id: "traitors" }), /secret roles/);
  await assert.rejects(() => LR.sourceDataFor(db, { kind: "builtin", id: "not-a-format" }), /isn't a built-in format/);
});

test("sourceDataFor: show_format branch requires an approved row with data", async () => {
  const approved = { name: "Big Brother", data: { id: "big-brother" }, version: 3, status: "approved" };
  const db = {
    query: async (sql, [id]) => {
      assert.match(sql, /FROM show_formats WHERE id=\$1/);
      if (id === "big-brother") return { rows: [approved] };
      if (id === "a-draft") return { rows: [{ name: "Draft", data: null, version: 1, status: "draft" }] };
      return { rows: [] };
    },
  };
  const got = await LR.sourceDataFor(db, { kind: "show_format", id: "big-brother" });
  assert.deepEqual(got, { data: approved.data, parentVersion: 3, defaultName: "Big Brother" });
  await assert.rejects(() => LR.sourceDataFor(db, { kind: "show_format", id: "a-draft" }), /isn't an approved show format/);
  await assert.rejects(() => LR.sourceDataFor(db, { kind: "show_format", id: "missing" }), /isn't an approved show format/);
});

test("sourceDataFor: league_ruleset branch requires visibility='shared'", async () => {
  const shared = { name: "Dana's Rules", data: { id: "survivor" }, version: 2, visibility: "shared" };
  const db = {
    query: async (sql, [id]) => {
      assert.match(sql, /FROM league_rulesets WHERE id=\$1/);
      if (id === "shared-id") return { rows: [shared] };
      if (id === "private-id") return { rows: [{ ...shared, visibility: "private" }] };
      return { rows: [] };
    },
  };
  const got = await LR.sourceDataFor(db, { kind: "league_ruleset", id: "shared-id" });
  assert.deepEqual(got, { data: shared.data, parentVersion: 2, defaultName: "Dana's Rules" });
  await assert.rejects(() => LR.sourceDataFor(db, { kind: "league_ruleset", id: "private-id" }), /isn't shared/);
  await assert.rejects(() => LR.sourceDataFor(db, { kind: "league_ruleset", id: "missing" }), /isn't shared/);
});

test("deleteIfUnreferenced: deletes only when nothing else forks from it", async () => {
  let lastSql;
  const dbFree = { query: async (sql, params) => { lastSql = sql; assert.deepEqual(params, ["ruleset-1"]); return { rows: [{ id: "ruleset-1" }] }; } };
  assert.equal(await LR.deleteIfUnreferenced(dbFree, "ruleset-1"), true);
  assert.match(lastSql, /DELETE FROM league_rulesets WHERE id=\$1/);
  assert.match(lastSql, /NOT EXISTS/);
  const dbReferenced = { query: async () => ({ rows: [] }) };
  assert.equal(await LR.deleteIfUnreferenced(dbReferenced, "ruleset-1"), false);
});

test("formatOf honors leagueRulesetData even when its data.id matches a built-in's id", () => {
  // The direct proof that editing a Survivor-derived copy actually changes scoring, not just
  // storage: formatFor's own isBuiltInFormat shortcut would otherwise win and silently ignore it.
  const edited = JSON.parse(JSON.stringify(survivorData));
  edited.name = "Dana's House Rules";
  const withCustom = { settings: { showFormat: "survivor", leagueRulesetData: edited } };
  assert.equal(StateLogic.formatOf(withCustom).name, "Dana's House Rules");
  // Unedited would still report Survivor's own name -- this isn't just "any object with that shape".
  assert.equal(StateLogic.formatOf({ settings: { showFormat: "survivor" } }).name, survivorData.name);
});

test("abandoning a league ruleset reverts formatOf byte-identically", () => {
  const withoutCustom = { settings: { showFormat: "survivor", showFormatData: null } };
  const before = StateLogic.formatOf(withoutCustom);

  const edited = JSON.parse(JSON.stringify(survivorData));
  edited.name = "Temporary House Rules";
  const settings = { showFormat: "survivor", showFormatData: null };
  LR.setLeagueRuleset(settings, edited);
  assert.equal(StateLogic.formatOf({ settings }).name, "Temporary House Rules");

  // What abandonLeagueRuleset does to settings: clear the cache slot, nothing else.
  LR.setLeagueRuleset(settings, null);
  assert.deepEqual(settings, { showFormat: "survivor", showFormatData: null });
  assert.equal(StateLogic.formatOf({ settings }).name, before.name);
});

test("a league with no custom ruleset scores exactly as it did before this change", () => {
  // No leagueRulesetData key at all -- every league in production today. formatOf's new line is an
  // `if` that's never true for these, so the existing branch is the only one ever taken.
  const state = { settings: { showFormat: null, showFormatData: null } };
  assert.equal(StateLogic.formatOf(state).id, "survivor");
  assert.equal(StateLogic.formatOf({ settings: { showFormat: "challenge" } }).id, "challenge");
  assert.equal(StateLogic.formatOf(null).id, "survivor");
});
