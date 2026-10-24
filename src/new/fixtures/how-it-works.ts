// How it works for Survivor, the real view model (R1's rulebook-describe.js) on the built-in Survivor rulebook, as
// the fixture's reader sees it (on Episode 4 of 14), with the mock's updates and lineage. Step 1 serves it per
// season from the rulebook the couch's games play by, through the server's guard (seenThrough, phase starts).
import { howItWorks } from "@/lib/game/formats/rulebook-describe.js";
import { BUILT_IN_BLOCKS } from "@/lib/game/formats/blocks/index.js";
import { FORMATS } from "@/lib/game/formats/index.js";
import { CAST, SEEN } from "./cast";

export const STEP = "1";

const survivor = BUILT_IN_BLOCKS.survivor;

export const HOW = howItWorks(survivor.blocks, {
  compiled: FORMATS.survivor.data,
  aliases: survivor.aliases,
  seen: SEEN,
  episodeCount: 14,
  castCount: CAST.length,
  updates: [
    { episode: 1, kind: "start", detail: "Started from Survivor 50's rulebook." },
    { episode: 4, kind: "fix", detail: '"Sat out" only counts in individual challenges now. Every couch was rescored.' },
    { episode: 8, kind: "showChanged", detail: "Block a Vote added." },
  ],
  lineage: "Started from Survivor 50's rulebook · checked by 14 couches",
});
