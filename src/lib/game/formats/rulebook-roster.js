// Whom an episode's research asks about, by the rulebook (decided with the user 2026-10-24): only the people still
// in the game, where the show's ways out say "still in" means something.
//
//   whoToAsk(blocks, people, episode) -> { ask, skipped, asksArrivals }
//
// `people` is [{ name, left?: { episode, means } }]: when someone left and what that way out means (from confirmed
// results; never a single unreviewed answer, or one wrong "left" silently drops a person from every later
// episode). Someone is left out of an episode's questions once they've left for good before it: a way out that
// means out, or a finish (finalist, winner, an ending). Never for a race or event they missed (`outForOne`: they're
// back the next time), and never while the rulebook has a comeback from people who left (they're still playing,
// in a Redemption Island or a Last Chance Kitchen). `asksArrivals`: the rulebook has new people arriving, so the
// research has to ask who's new, or a new hire is never asked about.
//
// Plain CommonJS, browser-safe, like everything in formats/.

const list = (v) => (Array.isArray(v) ? v : []);
const GONE = ['out', 'finalist', 'winner', 'ending'];

/** True when people who left can still play: a comeback twist from people who left. */
function comebackFromLeft(blocks) {
  return list(blocks && blocks.twists).some((t) => t && t.type === 'comeback' && t.who === 'peopleWhoLeft');
}

/** True when new people arrive partway through: an arrivals twist, or a phase that brings them. */
function hasArrivals(blocks) {
  return (
    list(blocks && blocks.twists).some((t) => t && t.type === 'comeback' && t.who === 'newPeople') ||
    list(blocks && blocks.season && blocks.season.phases).some((p) => p && list(p.changes).includes('arrivals'))
  );
}

function whoToAsk(blocks, people, episode) {
  const keepLeft = comebackFromLeft(blocks);
  const ask = [];
  const skipped = [];
  for (const p of list(people)) {
    const left = p && p.left;
    const goneBefore = left && Number.isInteger(left.episode) && left.episode < episode && GONE.includes(left.means);
    if (goneBefore && !keepLeft) skipped.push({ name: p.name, why: `left in episode ${left.episode}` });
    else ask.push(p.name);
  }
  return { ask, skipped, asksArrivals: hasArrivals(blocks) };
}

module.exports = { whoToAsk, comebackFromLeft, hasArrivals };
