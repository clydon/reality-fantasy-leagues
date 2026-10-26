// Fixtures for the new design (docs/PLAN-new-design.md, "The Preview system"): the mock's data ported to typed
// modules, for the parts of a screen that aren't on real data yet. Anything drawn from a fixture sits inside a
// <Preview> (src/new/preview.ts), so nobody mistakes it for their own couch.
//
// One module per area, each starting with the step that deletes it:
//
//   export const STEP = "8";
//
// `node scripts/dev-test/check-preview.js` lists every module by its STEP and fails once that step is marked done
// in the plan's Status. At step C this folder is empty and goes. (The last fixtures, the streaming rail's and the demo
// people they shared, went in step 14 part 1.)
export {};
