// Who's watching right now, for the hub's "On now" strip (the mock's hubplus.js). Step 13 makes Watch along real.
import type { Demo } from "./people";

export const STEP = "13";

export const ON_NOW: { who: Demo; show: string; episode: number } = { who: "riley", show: "Below Deck Med", episode: 7 };
