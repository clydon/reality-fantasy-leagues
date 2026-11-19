// The made-up season's own clock for code that reads the computer's (docs/PLAN-game-preview.md, "The bench's previews"). The engine's
// actionItems and the computer players' moves (bot-logic.js, through state-logic.js) read Date.now() and new Date(): asked on the
// runtime's state, they must read the runtime's clock, or a season dated by the real calendar (Survivor 51's Episode 9 airs on its
// real day) goes stale the moment the real day passes it. `atClock(at, fn)` runs `fn` with time fixed at `at`, then puts it back.
// Synchronous calls only.
function atClock(at, fn) {
  const t = typeof at === 'number' ? at : Date.parse(at);
  if (!Number.isFinite(t)) throw Error('atClock needs a time: ' + at);
  const Real = global.Date;
  class Fixed extends Real {
    constructor(...a) { if (a.length) super(...a); else super(t); }
    static now() { return t; }
  }
  global.Date = Fixed;
  try { return fn(); } finally { global.Date = Real; }
}

module.exports = { atClock };
