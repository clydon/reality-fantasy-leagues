// Moment tags (docs/PLAN-start-a-game-gpt.md S2): what a moment says about someone's place in the game, as data on a
// format's events (`events[].tags`). The computer players (bot-logic.js) and research's Safety ranking
// (research-rows.tsx) read these rather than a list of Survivor's, The Traitors' and The Challenge's event ids, so they
// work for any show. The compiler derives them from a rulebook's structure (rulebook-moments.js), a rulebook can set a
// moment's own (`momentNotes[id].tags`, [] for none), and the built-ins' data carries them by hand.
//
//   danger            in the firing line and lived: votes against them at a vote that sends someone home, targeted
//                     there and survived, in the bottom, put at risk
//   safe              safely with the numbers: no votes against them at that vote, voted with the majority
//   threat            a win that makes them a target once they can't win their way out (after a merge): won safety
//   protectionGained  got protection carried into a later vote (an advantage that keeps them safe until it's played)
//   protectionUsed    used it up: played one, or the votes it cancelled
//   safety            kept them off the chopping block this episode (the Safety ranking): won safety, no votes against
//                     them, votes against them survived
//
// Plain CommonJS with nothing to require, browser-safe, like everything in formats/.
const MOMENT_TAGS = ['danger', 'safe', 'threat', 'protectionGained', 'protectionUsed', 'safety'];

/** Why `tags` isn't a moment's tags (a list of MOMENT_TAGS, each once), or null when it is. */
function tagsProblem(tags) {
  if (!Array.isArray(tags)) return `tags: a list of ${MOMENT_TAGS.join(', ')}`;
  const odd = tags.find((t) => !MOMENT_TAGS.includes(t));
  if (odd !== undefined) return `tags: "${odd}" isn't one of ${MOMENT_TAGS.join(', ')}`;
  if (new Set(tags).size !== tags.length) return 'tags: a tag is listed twice';
  return null;
}

module.exports = { MOMENT_TAGS, tagsProblem };
