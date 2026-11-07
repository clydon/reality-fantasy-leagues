// Timers on a virtual clock, for the phone's pollers' tests (tests/sports-live.test.js's LiveGame, tests/sports-live-event.test.js's
// LiveEvent): pass `now`, `setTimer` and `clearTimer` to a poller, then `advance()` runs its next ask.
//
//   const { virtual } = require("./harness/virtual-time");
//   const vt = virtual(Date.parse("2026-10-22T23:00:00Z"));
//   new LiveGame({ ..., now: vt.now, setTimer: vt.setTimer, clearTimer: vt.clearTimer }); await vt.advance();
/** Timers on a virtual clock: `advance()` runs the next one, the time jumping to it, and lets its promises settle. */
function virtual(start) {
  let now = start;
  const timers = [];
  const settle = () => new Promise((r) => setImmediate(r));
  return {
    now: () => now,
    set: (t) => (now = t),
    timers,
    setTimer: (run, ms) => {
      const t = { at: now + ms, ms, run };
      timers.push(t);
      return t;
    },
    clearTimer: (t) => {
      const i = timers.indexOf(t);
      if (i >= 0) timers.splice(i, 1);
    },
    async advance() {
      timers.sort((a, b) => a.at - b.at);
      const t = timers.shift();
      if (!t) return false;
      now = Math.max(now, t.at);
      t.run();
      await settle();
      return true;
    },
    settle,
  };
}

module.exports = { virtual };
