// Survivor 51's episodes as the couch saw them, from the mock (show.js tabEpisodes, episodePage): what you scored
// in Weekly Lineup each episode, what happened, and the waiver window after Episode 4. Who went home comes from
// fixtures/cast.ts. Step 2 reads applied results per episode (and the reveal); step 6a the waiver row.

export const STEP = "2";

/** Your Weekly Lineup score by episode (index = episode). */
export const YOUR_LINEUP = [0, 0, 12.5, 1.5, 6];
/** The season's first episode the couch's games scored. */
export const GAMES_FROM = 2;
export const FINALE = "finale in December";

/** Each episode's challenges and vote, by tribe. */
export const HAPPENED: Record<number, [string, string][]> = {
  1: [["Reward", "Savu"], ["Immunity", "Savu"], ["Tribal", "Toka"]],
  2: [["Reward", "Toka"], ["Immunity", "Toka"], ["Tribal", "Savu"]],
  3: [["Reward", "Dina"], ["Immunity", "Dina"], ["Tribal", "Toka"]],
  4: [["Reward", "Toka"], ["Immunity", "Dina"], ["Tribal", "Savu"]],
};

/** Each episode's Weekly Lineup line: who scored for you. */
export const YOUR_SCORERS: Record<number, string> = {
  2: "Kristin +4 · Mike +5 · Jenna +5",
  3: "Kristin +5 · Mike +1.5 · Jenna −4",
  4: "Kristin +5 · Mike +5 · Jenna −4",
};

/** The fixture reader's Survival Pool picks from GAMES_FROM on, and Outlast team (first names), for an episode's page. */
export const YOUR_PICKS = ["Kristin", "Maggie", "Brady"];
export { YOUR_TEAM } from "./cast";

/** The waiver window between Episodes 4 and 5 (Simple waivers, step 6a). */
export const WAIVERS = { after: 4, due: "Tue 8:05 PM", replace: "Jenna" };
