// Which AI our bot asks, per run (src/lib/bot-runs.ts; the bot's throughput, step 1): every kind asks the desk's AI unless
// 'bot_ai_runs' sends it to its own, Codex too; only known kinds and AIs count; the desk's change and its Settings history line.
const test = require("node:test");
const assert = require("node:assert");
const R = require("../src/lib/bot-runs.ts");

test("by default every run asks the desk's AI: ChatGPT, or Claude when the desk says so", () => {
  for (const kind of R.BOT_RUN_KINDS) {
    assert.equal(R.providerFor(undefined, undefined, kind), "chatgpt", kind);
    assert.equal(R.providerFor("claude", {}, kind), "claude", kind);
  }
  assert.equal(R.providerFor(undefined, undefined), "chatgpt", "an ask that isn't a run");
  assert.equal(R.providerFor("gemini", null, "full"), "chatgpt", "an AI the desk doesn't offer is ChatGPT");
  assert.equal(R.providerFor("codex", null, "full"), "chatgpt", "Codex is a run's, not the desk's own choice");
});

test("a kind sent to an AI of its own asks that one; the rest, and asks that aren't runs, the desk's", () => {
  const runs = { trivia: "codex", bingo: "codex", full: "claude" };
  assert.equal(R.providerFor("chatgpt", runs, "trivia"), "codex");
  assert.equal(R.providerFor("chatgpt", runs, "bingo"), "codex");
  assert.equal(R.providerFor("chatgpt", runs, "full"), "claude");
  assert.equal(R.providerFor("chatgpt", runs, "quick"), "chatgpt");
  assert.equal(R.providerFor("claude", runs, "quick"), "claude");
  assert.equal(R.providerFor("chatgpt", runs), "chatgpt");
  assert.equal(R.providerFor("chatgpt", runs, "cast"), "chatgpt", "not a run kind");
});

test("the setting read loosely: only known kinds and AIs", () => {
  assert.deepEqual(R.runProviders({ trivia: "codex", bingo: "gemini", nope: "codex", full: 3 }), { trivia: "codex" });
  for (const bad of [null, undefined, "codex", ["codex"], 7]) assert.deepEqual(R.runProviders(bad), {}, String(bad));
});

test("the desk's change: sends kinds, gives them back, keeps the rest; its history line; nothing changed is no line", () => {
  let c = R.changeRunProviders({}, { trivia: "codex", bingo: "codex" });
  assert.deepEqual(c.runs, { trivia: "codex", bingo: "codex" });
  assert.equal(c.line, "Codex answers trivia and bingo squares");
  c = R.changeRunProviders(c.runs, { trivia: null, full: "claude" });
  assert.deepEqual(c.runs, { bingo: "codex", full: "claude" });
  assert.equal(c.line, "Claude answers full research. Trivia: back to the AI our bot asks");
  assert.equal(R.changeRunProviders(c.runs, { bingo: "codex", quick: null }).line, null, "already so");
  assert.throws(() => R.changeRunProviders({}, { cast: "codex" }), /No bot run is called cast/);
  assert.throws(() => R.changeRunProviders({}, { trivia: "gemini" }), /trivia asks chatgpt, claude, codex or null/);
  assert.throws(() => R.changeRunProviders({}, "codex"));
});

test("every run kind has a name, and Codex one too", () => {
  for (const kind of R.BOT_RUN_KINDS) assert.ok(R.BOT_RUN_NAMES[kind], kind);
  for (const p of R.RUN_PROVIDERS) assert.ok(R.BOT_PROVIDER_NAMES[p], p);
});
