// Fixtures for the new design (docs/PLAN-new-design.md, "The Preview system"): the mock's data ported to typed
// modules, for the parts of a screen that aren't on real data yet. Anything drawn from a fixture sits inside a
// <Preview> (src/new/preview.ts), so nobody mistakes it for their own couch.
//
// One module per area (people.ts, guide.ts, ...), each starting with the step that deletes it:
//
//   export const STEP = "8";
//
// `node scripts/dev-test/check-preview.js` lists every module by its STEP and fails once that step is marked done
// in the plan's Status. At step C this folder is empty and goes. Step 0c's shells use none: 0d ports the mock's hub
// and show space data here.

/** Names fixtures use, the mock's demo people (never a real username: the repo is public). */
export const DEMO_NAMES = ["alex", "riley", "jordan", "sam", "casey"] as const;
