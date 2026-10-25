// Couch verdicts, from the mock (couchpages.js verdictsPage): how the couch rated the latest episode you've seen of each
// show, and your taste twin. They need the couch's ratings (episode_ratings), which step 12 (Rate it) builds.
import { art, type Demo } from "./people";

export const STEP = "12";

/** Couch verdicts: how the couch rated the latest episode you've seen of each show. */
export const VERDICTS: { show: string; episode: number; art: string; position: string; score: string; from: number; ratings: [Demo, number][]; take: { who: Demo; text: string }; byEpisode: number[] }[] = [
  { show: "Survivor 51", episode: 4, art: art("survivor"), position: "100% 50%", score: "4.0", from: 4, ratings: [["riley", 4.5], ["jordan", 3.5], ["sam", 3.5]], take: { who: "riley", text: "Kristin is SO calm, love it" }, byEpisode: [3.6, 3.4, 3.8, 4.0] },
  { show: "Traitors 5", episode: 3, art: art("traitors"), position: "74% 35%", score: "4.2", from: 4, ratings: [["riley", 4.7], ["jordan", 3.7], ["sam", 3.7]], take: { who: "riley", text: "the turret scenes are unhinged this season" }, byEpisode: [3.9, 4.1, 4.2] },
  { show: "Challenge 37", episode: 4, art: art("challenge"), position: "62% 30%", score: "3.7", from: 2, ratings: [["sam", 3.2]], take: { who: "sam", text: "this daily is chaos" }, byEpisode: [3.5, 3.8, 3.4, 3.7] },
  { show: "Below Deck Med", episode: 6, art: art("below-deck"), position: "50% 25%", score: "3.6", from: 3, ratings: [["riley", 4.1], ["sam", 3.1]], take: { who: "riley", text: "Already chaos and they haven't left the dock" }, byEpisode: [3.2, 3.9, 3.3, 3.5, 3.8, 3.6] },
];

/** Your taste twin: who rates episodes most like you (the verdicts page's footnote and your profile's line). */
export const TASTE = { title: "Taste twin: riley.", line: "You two rate within half a star 8 times in 10. jordan rates a star off the couch most weeks.", short: "You rate episodes within half a star 8 times in 10" };
