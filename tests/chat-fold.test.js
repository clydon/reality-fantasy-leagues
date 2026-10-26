// The couch chat's fold (src/lib/game/chat-fold.ts, docs/PLAN-new-design.md step 4): what's folded for someone at
// their episode, what "Show them" unfolds and what folds again once the next episode airs, and who the chat's own
// reveal lines say has revealed. Since step 14 part 2, the fold by progress on a season watched at its own pace (a
// message's author mark) and when a message keeps one. Pure, no database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { foldFor, isFolded, marksAuthor, revealedBy, revealedThrough, SETTLED_MS } = jiti("../src/lib/game/chat-fold.ts");

const DAY = 24 * 3600 * 1000;
const NOW = Date.parse("2026-10-24T12:00:00Z");
// Weekly: episode 1 five weeks ago ... episode 5 four days ago, episode 6 in three days.
const at = (n) => new Date(NOW - (39 - 7 * n) * DAY).toISOString();
const EPISODES = Array.from({ length: 8 }, (_, i) => ({ number: i + 1, airAt: at(i + 1) }));
const msg = (user, when, type = "message") => ({ user_id: user, type, created_at: new Date(when).toISOString() });

test("nothing is folded when you've seen everything that has aired, or see results straight away", () => {
  assert.equal(foldFor(EPISODES, 5, null, NOW), null);
  assert.equal(foldFor(EPISODES, 7, null, NOW), null, "ahead of the schedule");
  assert.equal(foldFor(EPISODES, Infinity, null, NOW), null);
  assert.equal(foldFor([{ number: 1, airAt: null }], 0, null, NOW), null, "no air times: nothing to fold by");
});

test("behind: others' messages from the first unseen episode's airtime on are folded; yours and reveal lines show", () => {
  const fold = foldFor(EPISODES, 3, null, NOW);
  assert.deepEqual(fold, { episode: 4, latest: 5, from: at(4), mark: 3 });
  assert.equal(isFolded(msg("riley", Date.parse(at(4)) - 60_000), fold, "sam"), false, "before episode 4 aired");
  assert.equal(isFolded(msg("riley", Date.parse(at(4)) + 60_000), fold, "sam"), true, "while it was on");
  assert.equal(isFolded(msg("riley", NOW), fold, "sam"), true, "since");
  assert.equal(isFolded(msg("sam", NOW), fold, "sam"), false, "your own");
  assert.equal(isFolded(msg("riley", NOW, "reveal"), fold, "sam"), false, "a reveal line");
  assert.equal(foldFor(EPISODES, 0, null, NOW).episode, 1, "nothing seen: folded from the premiere");
});

test("Show them unfolds through the latest aired episode; what's said once the next airs folds again", () => {
  const unfolded = foldFor(EPISODES, 3, 5, NOW);
  assert.deepEqual(unfolded, { episode: 4, latest: 5, from: at(6), mark: 5 });
  assert.equal(isFolded(msg("riley", NOW), unfolded, "sam"), false, "today's message shows");
  // A week later episode 6 has aired: the same tap doesn't reach it.
  const later = NOW + 7 * DAY;
  const fold = foldFor(EPISODES, 3, 5, later);
  assert.equal(fold.latest, 6);
  assert.equal(isFolded(msg("riley", Date.parse(at(6)) + 60_000), fold, "sam"), true, "said during episode 6");
  assert.equal(isFolded(msg("riley", Date.parse(at(5)) + 60_000), fold, "sam"), false, "said during episode 5");
  assert.deepEqual(foldFor(EPISODES, 3, 2, NOW), { episode: 4, latest: 5, from: at(4), mark: 3 }, "an older unfold doesn't reach episode 4");
  assert.equal(foldFor(EPISODES.slice(0, 5), 3, 5, NOW).from, null, "unfolded through the last episode: nothing folds again");
});

// A streaming season: all 8 dropped ten days ago.
const DROP = new Date(NOW - 10 * DAY).toISOString();
const BINGE = Array.from({ length: 8 }, (_, i) => ({ number: i + 1, airAt: DROP }));
const said = (user, seen, when = NOW - DAY) => ({ ...msg(user, when), author_seen: seen });

test("by progress: someone else's message is folded while its author had seen more than you", () => {
  const fold = foldFor(BINGE, 3, null, NOW);
  assert.deepEqual(fold, { episode: 4, latest: 8, from: DROP, mark: 3 });
  assert.equal(isFolded(said("riley", 6), fold, "alex"), true, "riley was on 6 when she wrote");
  assert.equal(isFolded(said("jordan", 3), fold, "alex"), false, "jordan was where alex is");
  assert.equal(isFolded(said("sam", 0), fold, "alex"), false, "sam hadn't started");
  assert.equal(isFolded(said("alex", 8), fold, "alex"), false, "your own");
  assert.equal(isFolded({ ...said("riley", 6), type: "reveal" }, fold, "alex"), false, "a reveal line");
  assert.equal(isFolded(msg("riley", NOW - DAY), fold, "alex"), true, "no mark (from before): the airtime fold, everything since the drop");
  assert.equal(isFolded({ ...msg("riley", NOW - DAY), author_seen: null }, fold, "alex"), true, "a null mark: the same");
  assert.equal(isFolded(msg("riley", NOW - 11 * DAY), fold, "alex"), false, "said before the drop");
  assert.equal(isFolded(said("riley", 6), foldFor(BINGE, 6, null, NOW), "alex"), false, "once alex is on 6 it shows");
  assert.equal(foldFor(BINGE, 8, null, NOW), null, "finished: nothing folds");
  assert.equal(foldFor(BINGE, Infinity, null, NOW), null, "spoiler protection off: nothing folds");
});

test("by progress: Show them unfolds through the latest; an older unfold only through itself", () => {
  const all = foldFor(BINGE, 3, 8, NOW);
  assert.equal(all.mark, 8);
  assert.equal(isFolded(said("jordan", 8), all, "alex"), false, "unfolded through the last: everything shows");
  assert.equal(all.from, null, "and nothing by airtime either");
  const some = foldFor(BINGE, 3, 5, NOW);
  assert.equal(isFolded(said("riley", 5), some, "alex"), false);
  assert.equal(isFolded(said("riley", 6), some, "alex"), true, "past the unfold");
});

test("a message keeps its author's mark only on a season watched at its own pace, a finale's week aside", () => {
  assert.equal(marksAuthor({ release: "binge", status: "completed", played: false }, BINGE, NOW), true, "a drop");
  assert.equal(marksAuthor({ release: "binge", status: "completed", played: true }, BINGE, NOW), true, "a drop with a game on it");
  assert.equal(marksAuthor({ release: "binge", status: "upcoming", played: false }, [], NOW), true, "before the drop");
  assert.equal(marksAuthor({ release: "weekly", status: "airing", played: false }, EPISODES, NOW), false, "a weekly season on the air");
  const ended = EPISODES.map((e) => ({ ...e, airAt: new Date(Date.parse(e.airAt) - 60 * DAY).toISOString() }));
  assert.equal(marksAuthor({ release: "weekly", status: "completed", played: false }, ended, NOW), true, "a finished weekly season nobody plays here");
  assert.equal(marksAuthor({ release: "weekly", status: "completed", played: true }, ended, NOW), false, "one with a game in the conversation");
  const finale = Date.parse(ended[ended.length - 1].airAt);
  assert.equal(marksAuthor({ release: "weekly", status: "completed", played: false }, ended, finale + SETTLED_MS - 60_000), false, "its finale's week: airtime");
  assert.equal(marksAuthor({ release: "weekly", status: "completed", played: false }, ended, finale + SETTLED_MS), true, "a week on");
  assert.equal(marksAuthor({ status: "completed", played: false }, [{ number: 1, airAt: null }], NOW), true, "no air times known");
});

test("reveal lines say who has revealed what", () => {
  assert.equal(revealedThrough("riley revealed episode 5"), 5);
  assert.equal(revealedThrough("sam revealed episodes 4–6"), 6);
  assert.equal(revealedThrough("riley revealed Episode 12"), 12);
  assert.equal(revealedThrough("revealed nothing"), null);
  const lines = [
    { ...msg("riley", NOW, "reveal"), author_name: "riley", text: "riley revealed episode 5" },
    { ...msg("jordan", NOW, "reveal"), author_name: "jordan", text: "jordan revealed episode 4" },
    { ...msg("alex", NOW, "reveal"), author_name: "alex", text: "alex revealed episodes 4–5" },
    { ...msg("sam", NOW, "reveal"), author_name: "sam", text: "sam revealed episode 5" },
    { ...msg("riley", NOW), author_name: "riley", text: "I revealed episode 5" },
  ];
  assert.deepEqual(revealedBy(lines, 5, "sam"), ["riley", "alex"]);
});
