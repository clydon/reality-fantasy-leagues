// Rulebook edits (src/lib/game/formats/rulebook-patch.js, docs/PLAN-new-design.md step 6b part 2): ops between two
// versions of a rulebook's blocks and back, in plain words, and the rules when the show changed from an episode on.
// Pure, no database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const { diffBlocks, applyOps, blocksAt, opLines, mergeAtEpisode, sameBlocks } = require("../src/lib/game/formats/rulebook-patch.js");
const { compileRulebook, formatForRulebook } = require("../src/lib/game/formats/rulebook-compile.js");
const { rulebookFor } = require("../src/lib/game/formats/blocks/index.js");
const { formatProblems } = require("../src/lib/game/formats/define.js");

const survivor = () => JSON.parse(JSON.stringify(rulebookFor("survivor")));
const compile = (r, blocks) => compileRulebook(blocks, { aliases: r.aliases, reader: r.reader });
const BLOCK_A_VOTE = {
  id: "blockAVote", type: "advantage", name: "Block a Vote", oneIsCalled: "a Block a Vote", gotBy: "found", does: ["hurtsSomeone"], lasts: "oneUse",
  summary: "Played at Tribal Council to take away someone's vote.",
};

test("diffBlocks and applyOps take one version to the other, in order", () => {
  const r = survivor();
  const a = r.blocks;
  const b = JSON.parse(JSON.stringify(a));
  b.twists = [b.twists[0], BLOCK_A_VOTE, ...b.twists.slice(1)];
  const reward = b.segments.find((s) => /reward/i.test(s.name));
  reward.often = reward.often === "someEpisodes" ? "everyEpisode" : "someEpisodes";
  b.waysOut = b.waysOut.filter((w) => w.id !== b.waysOut[b.waysOut.length - 2].id);
  b.cast = { ...b.cast, usualSize: 20 };
  const ops = diffBlocks(a, b);
  assert.ok(ops.some((o) => o.op === "add" && o.block === "twists" && o.at === 1));
  assert.ok(ops.some((o) => o.op === "update" && o.block === "segments" && o.id === reward.id));
  assert.ok(ops.some((o) => o.op === "remove" && o.block === "waysOut"));
  assert.ok(ops.some((o) => o.op === "set" && o.block === "cast"));
  assert.ok(sameBlocks(applyOps(a, ops), b), "applying the ops gives the new version");
  assert.deepEqual(diffBlocks(a, a), [], "nothing changed: no ops");
});

test("opLines says what changed in the editor's words", () => {
  const r = survivor();
  const a = r.blocks;
  const b = JSON.parse(JSON.stringify(a));
  b.twists.push(BLOCK_A_VOTE);
  const reward = b.segments.find((s) => /reward/i.test(s.name));
  reward.often = reward.often === "someEpisodes" ? "everyEpisode" : "someEpisodes";
  const gone = b.waysOut.pop();
  const lines = opLines(diffBlocks(a, b), a, b);
  assert.ok(lines.includes("+ New advantage: Block a Vote"), lines.join(" | "));
  assert.ok(lines.includes(`~ ${reward.name}: how often`), lines.join(" | "));
  assert.ok(lines.includes(`− ${gone.name}`), lines.join(" | "));
});

test("blocksAt: the base, then each edit from its episode", () => {
  const r = survivor();
  const after = JSON.parse(JSON.stringify(r.blocks));
  after.twists.push(BLOCK_A_VOTE);
  const edit = { fromEpisode: 6, ops: diffBlocks(r.blocks, after) };
  assert.equal(blocksAt(r.blocks, [edit], 5).twists.length, r.blocks.twists.length);
  assert.equal(blocksAt(r.blocks, [edit], 6).twists.length, r.blocks.twists.length + 1);
  assert.equal(blocksAt(r.blocks, [edit], Infinity).twists.length, r.blocks.twists.length + 1);
});

test("the show changed from episode 6: a new twist awards from 6, a dropped moment stops at 5, points from the start", () => {
  const r = survivor();
  const before = compile(r, r.blocks).data;
  const blocks = JSON.parse(JSON.stringify(r.blocks));
  blocks.twists.push(BLOCK_A_VOTE);
  // Exile goes from episode 6 (a twist the show dropped).
  const exile = blocks.twists.find((t) => t.type === "sideTrip");
  if (exile) blocks.twists = blocks.twists.filter((t) => t !== exile);
  const compiled = compile(r, blocks);
  assert.deepEqual(compiled.problems, []);
  const merged = mergeAtEpisode(before, compiled.data, 6);
  assert.deepEqual(formatProblems(merged), [], "the merged rules are a usable format");

  const added = compiled.data.events.filter((e) => !before.events.some((x) => x.id === e.id)).map((e) => e.id);
  assert.ok(added.length >= 1, "the new twist builds moments");
  const awarding = (id) => [...merged.rules.research, ...merged.rules.implied].filter((rule) => JSON.stringify(rule).includes(`"${id}"`));
  for (const id of added) assert.ok(awarding(id).length && awarding(id).every((rule) => rule.fromEpisode >= 6), `${id} only from episode 6`);
  if (exile) {
    const dropped = before.events.filter((e) => !compiled.data.events.some((x) => x.id === e.id));
    assert.ok(dropped.length >= 1);
    for (const e of dropped) {
      assert.equal(merged.events.find((x) => x.id === e.id).retiredFrom, 6, `${e.id} retired from 6`);
      assert.ok(awarding(e.id).every((rule) => rule.untilEpisode === 5), `${e.id}'s rules stop at 5`);
    }
  }
  // An unchanged rule runs all season, ungated.
  const immunity = merged.rules.research.find((rule) => rule.award === "individualImmunity");
  assert.ok(immunity && immunity.fromEpisode === undefined && immunity.untilEpisode === undefined);

  // The engine reads it: the new twist's answer scores in episode 7, not in episode 5.
  const format = formatForRulebook(merged, "survivor");
  const key = merged.research.checklist.find((q) => !before.research.checklist.some((x) => x.key === q.key) && q.type === "answer");
  if (key) {
    const entry = { name: "Ada", leftTheGame: "no", confidence: "high", sources: ["x"], [key.key]: "yes" };
    const awarded = (episode) => {
      const out = [];
      format.research.items(entry, (kind, eventType) => out.push(eventType), { payload: { castaways: [entry] }, same: (a, b) => a === b, episode });
      return out;
    };
    assert.ok(added.some((id) => awarded(7).includes(id)), "awarded from episode 7");
    assert.ok(!added.some((id) => awarded(5).includes(id)), "not before episode 6");
  }
});

test("from the premiere, the show changing is just the new rules", () => {
  const r = survivor();
  const before = compile(r, r.blocks).data;
  const blocks = JSON.parse(JSON.stringify(r.blocks));
  blocks.twists.push(BLOCK_A_VOTE);
  const after = compile(r, blocks).data;
  assert.ok(sameBlocks(mergeAtEpisode(before, after, 1), after));
});
