// Dev-only: a clock of its own for one process (scripts/dev-test/season-forward.js plays a season forward through weeks that
// haven't aired yet). Once installed, Date.now() and `new Date()` with no arguments read the time last set, moving on in real
// time from it; a Date made from a value is untouched. App code loaded in the same process (jiti, as the unit tests load it)
// sees the scenario's moment: a lineup locks at the episode's air time, a waiver week processes when it's due, the final
// results' time passes. Nothing outside this process sees it: the database's own now() stays real.
//
//   const Clock = require("./sim-clock"); Clock.install();     before the app's code is loaded (a module that keeps its own
//                                                              copy of Date keeps the real one)
//   Clock.set("2026-11-04T23:55:00Z");  Clock.now();  Clock.reset();  Clock.real();
//
// A server can carry it too: NODE_OPTIONS="--require <this file>" with SIM_CLOCK_FILE=<path> installs it at start and reads
// the time from that file (an ISO time, or empty for the real one) at most once a second, so a dev server and the run that
// writes the file keep the same moment. Pure apart from that file.
const fs = require("fs");

const Real = globalThis.__realDate || globalThis.Date;
globalThis.__realDate = Real;
let offset = 0;
let installed = false;

class SimDate extends Real {
  constructor(...a) {
    if (a.length) super(...a);
    else super(SimDate.now());
  }
  static now() {
    if (FILE) fromFile();
    return Real.now() + offset;
  }
}
// Date's other statics as its own (a server's sandbox copies a global's own properties: inherited ones go missing there).
SimDate.UTC = Real.UTC;
SimDate.parse = Real.parse;

function install() {
  if (installed) return;
  installed = true;
  globalThis.Date = SimDate;
}
/** The clock to `at` (an ISO time, a Date or ms), moving on from there. */
function set(at) {
  offset = new Real(at instanceof Real ? at.getTime() : at).getTime() - Real.now();
}
const reset = () => (offset = 0);
const now = () => Real.now() + offset;
const real = () => Real.now();

// The server side: the time from a file the run writes.
const FILE = process.env.SIM_CLOCK_FILE || null;
let readAt = 0;
function fromFile() {
  const t = Real.now();
  if (t - readAt < 1000) return;
  readAt = t;
  try {
    const text = fs.readFileSync(FILE, "utf8").trim();
    offset = text ? new Real(text).getTime() - t : 0;
    if (!Number.isFinite(offset)) offset = 0;
  } catch {
    offset = 0;
  }
}
/** Writes the time a server carrying this clock reads (SIM_CLOCK_FILE): `at`, or null for the real one. */
function share(file, at) {
  fs.writeFileSync(file, at == null ? "" : new Real(at instanceof Real ? at.getTime() : at).toISOString());
}

if (FILE) install();

module.exports = { install, set, reset, now, real, share, RealDate: Real };
