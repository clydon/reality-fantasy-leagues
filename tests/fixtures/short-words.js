// G3 part 3 (the main session's 12:15 PM note): each chip a game's short form can show (describeSpec's `short.line`), with the words
// its sentence must have for it, so a rolled game's sentence says every piece its short line shows. [chip pattern, sentence pattern
// (or a function of the chip's match, for its numbers)], the first chip pattern that matches deciding. Shared by tests/roll.test.js
// and scripts/dev-test/roll-check.js (the taped seasons' seeds).
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PARTS = 'Episode|Week|Game|Race|Day|Tournament|Event';
const CHIP_WORDS = [
  // When it plays. A game in stages says each stage's span ("until Merged starts; then ... from when Merged starts").
  [/^All season$/, /all season|; then /],
  [/^From a format change$/, /format change|big change/i],
  [new RegExp(`^(${PARTS}) \\d+$`), new RegExp(`\\b(${PARTS}) \\d+`)],
  [new RegExp(`^(${PARTS})s \\d+–\\d+$`), new RegExp(`\\b(${PARTS})s \\d+–\\d+`)],
  [new RegExp(`^From (${PARTS}) (\\d+)$`), (m) => new RegExp(`\\b${m[1]} ${m[2]} (to the finale|until)`)],
  [/^From /, /from when|starting with|starts/i],
  [/until /i, /until|ends|before/i],
  // What you do.
  [/^(Draft|Bid for) (\d+), start (\d+)$/, (m) => new RegExp(`(drafts|team of) ${m[2]}\\b.* starts ${m[3]}`)],
  [/^(Draft|Bid for) (\d+), best (\d+) count$/, (m) => new RegExp(`(drafts|team of) ${m[2]}\\b.* their best ${m[3]} count`)],
  [/^Draft (\d+)$/, (m) => new RegExp(`drafts ${m[1]}\\b`)],
  [/^(\d+) from a hat, start (\d+)$/, (m) => new RegExp(`gets ${m[1]} drawn at random.* starts ${m[2]}`)],
  [/^(\d+) from a hat, best (\d+) count$/, (m) => new RegExp(`gets ${m[1]} drawn at random.* their best ${m[2]} count`)],
  // Best ball of the whole team (G1's typed fixes, impeccable's clarify): "all count", said "all 3 count".
  [/^(Draft|Bid for) (\d+), all count$/, (m) => new RegExp(`(drafts|team of) ${m[2]}\\b.* all ${m[2]} count`)],
  [/^(\d+) from a hat, all count$/, (m) => new RegExp(`gets ${m[1]} drawn at random.* all ${m[1]} count`)],
  [/from a hat$/i, /drawn at random/],
  [/^Bid/, /bid/],
  [/^Pick 1 to stay in$/, /to stay in/],
  [/^Pick (\d+) to score$/, /picks (one|two|three|four|five|\d+)/],
  [/^New card each/, /bingo card/],
  [/^Squares$/, /squares/],
  [/^2 calls$/, /two calls/],
  [/^(\d+) questions?$|^Questions$/, /answers (\w+) questions?/],
  // What makes it different.
  [/^Captain scores/, /captain who scores/],
  [/^Finale counts/, /in the finale count/],
  [new RegExp(`^(${PARTS}) \\d+ counts`), /Points in .+ count/],
  [/^Some \w+ count/, /Points (in|from) .+ count/],
  [/^First out scores most$/, /earlier they go home|first one out/],
  [/^Bounties$/, /bount/i],
  [/secret/, /secret/i],
  [/^Top scorer picks a twist$/, /twist/i],
  [/^New objectives each/, /card/],
  [/^Only \d+ moments count$/, /only/i],
  [/slots?$/, /slot/],
  [/^1 from each/, /from across the/],
  // G3 part 3b: a pool of some teams' or positions' players ("Forwards only": "everyone drafts 3, forwards only").
  [/^(.+) only$/, (m) => new RegExp(`, ${esc(m[1])} only`, 'i')],
  [/^(Draftees|Swaps|Pickups|Replacements) score/, /draft|swap|pickup|replacement/i],
  [/^Finale picks$/, /final three and the winner/],
  [/^\d+ (life|lives)$/, /li(fe|ves)/],
  [/wrong picks? forgiven$/, /forgiven|wrong pick/i],
  [/^2nd pick counts if 2 go$/, /a second/],
  [/^No repeats$/, /never the same/],
  [/^Buyback$/, /buy/i],
  [/^Bank of \d+$/, /bank/],
  [/^Split the pot$/, /split/],
  [/^Only unique answers score$/, /nobody else/],
  [/^Unwon points roll over$/, /roll/],
  [/^Double or nothing$/, /double or nothing/],
  [/^Parlay pays/, /together: (double|triple|quadruple|[\d.]+ times) the points/],
  [/^Beat the bot$/, /bot/],
  [/^Match the majority$/, /most of (you|us)/],
  [/^In \d+ teams$/, /teams?/],
  // How you win, when it isn't the game's own.
  [/^Head to head/, /head to head/i],
  [/^Most \w+ won$/, /won|wins the most/i],
  [/^Together/, /together/i],
  [/^Lowest score is cut$/, /lowest scorer( over them)? is out|cut/],
  [/^Last one standing$/, /last one standing/i],
  [/^First to \d+$/, /first (team )?to/i],
  [/^Most right picks$/, /right pick/],
  // A game in stages' next stages (a stage beside: "Plus bingo"), and a draft's own question ("Plus who goes home").
  [/^Redraft at each b/, /each major change|format changes/],
  // A chip cut to fit the line ("Redraft at Charter Sea…") is said by what it starts with.
  [/^Redraft at (.+)$/, (m) => new RegExp(`then (.*from when )?${esc(m[1].replace(/…$/, ''))}`)],
  [/^Then (.+)$/, (m) => new RegExp(`; then ${esc(m[1])}`)],
  [/^Plus /, /answers|; then |beside|alongside|\+/],
  [/^(.+) from (.+)$/, (m) => new RegExp(`then ${esc(m[1])}\\b`)],
];

/** The chips of a short form's line that its sentence has no words for (none: it says every piece), as ["chip", ...]; a chip the
 *  table doesn't know is one too ("?chip"), so a new chip comes with its words. */
function unsaid(short, sentence) {
  const out = [];
  for (const chip of String((short && short.line) || '').split(' · ').filter(Boolean)) {
    const row = CHIP_WORDS.find(([c]) => c.test(chip));
    if (!row) {
      out.push(`?${chip}`);
      continue;
    }
    const want = typeof row[1] === 'function' ? row[1](chip.match(row[0])) : row[1];
    if (!want.test(sentence)) out.push(chip);
  }
  return out;
}

module.exports = { CHIP_WORDS, unsaid };
