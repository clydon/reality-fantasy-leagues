# The game page's first view: requirements (step 2, head to head)

Mode 2 derivation on [the page spec](step2-game-page-spec.md), at 390 × 844, building on Phase 0's app-wide
[R1–R5](phase0-first-views.md). Today's page in each situation: `.ui-atlas/situations/<id>.png` and `.txt`.

## The problem

Someone opens one of their games: from the Games tab, from Tonight, from a push ("Bo posted a side bet", "Your lineup locks
tonight"), or after a week away. In one look they want to know who they're playing this week, whether anything is theirs to do
and by when, and how they stand. Today's first view spends a quarter of the screen on the game's name in 64 px caps, then a date
plate, two or three setting chips and a spoiler banner, then the move, then the grid's first rows. The opponent is never named.
The first view reads the same whether the lineup is due, set, locked, scored or two episodes away (`show-set`, `show-locked`,
`show-early` and `show-behind` differ by one 13 px line), so nothing tells Joanna whether this visit has news.

## L0 · Cognitive load

**Constraint.** Working memory holds three to five chunks, and unattended noise spends it.

**Violation.** The census measured 13 type sizes and 32 to 46 controls in today's first view (every grid square is a button). The
date plate restates the rules ("All season · Draft 3, start 2 · Head to head, playoffs"); the chips restate them again (BLIND
DRAFT, WAIVERS); the lock time appears in the plate and the move. Six blocks compete before the season starts.

**R1.** The first view holds four chunks at most, in this order of weight: the bar (where), this week's matchup with the move
inside it (what matters and what to do), one social or secondary row (side bets, or the last result when it's news), and the
season's first rows (where you stand). Each fact once: the lock time once, the record once per person in view, the rules nowhere.
At most five type sizes. The grid's squares stay controls but read as one chunk (a table), not as 30 targets competing for the eye.

**Citations:** Cowan (2001) for the three-to-five chunk ceiling; Hassin et al. (2009) for unattended noise spending working memory.

## L1 · First impression

**Constraint.** Appeal and meaning are judged in about 50 ms, before reading; that judgment is where attention switches on.

**Violation.** Today's 50 ms read is a word ("WEEKLY LINEUP", or "ACTIVE-ROSTER" for the NFL) over art. A name says which game, not
what's happening in it. The two people the week is about are not on the screen.

**R2.** The anchor is the matchup itself: two faces side by side with their records, large enough to read at a glance (40 px or
more), on the show's art. The art is backdrop to the faces, never a title card. A show without art gets the same card on the
show's colour; a sport gets team marks or headshots, never letter tiles at a real pool's size. Solo has one face and its season;
a finished season has the champion's.

**Citations:** Lindgaard et al. (2006) for the 50 ms gate; Kurosu & Kashimura (1995) for the aesthetic-usability effect.

## L2 · Processing fluency

**Constraint.** What's easy to process is judged truer and more trustworthy, and every signal must tell one story.

**Violation.** A matchup has no form anywhere in the app (Phase 0's parts table: 0 forms); a result has six. On this page the
record lives only in the grid's last column, the result only as a W square, the move as a slab with a tag. Sports pages speak a
show's words ("Your Game 3 lineup", "castaways").

**R3.** The matchup card is the one form of the matchup part: the same faces, record format (W–L, a tie as W–L–T only when one
exists) and state words the Games tab row and Tonight's mini will excerpt. Lineup faces on the card are data round 3's A summary,
so the sheet's B comparison opens on the same faces. One accent (yellow) does one job. Words per flavor: Ep and episode for a show,
Week and game for the NFL, players for a sport.

**Citations:** Reber & Schwarz (1999) for fluency judged as truth; Spence (2011) for coherence across signals.

## L3 · Perception bias

**Constraint.** People act on autopilot and explain afterwards; a match with the prediction passes, a mismatch fires attention.

**Violation.** The way in predicts "who I play"; the page answers "the game's name". Yellow fills the due move but also tag slabs
on set moves ("SET" in grey on a white plate looks like the due one), so its absence means nothing. The spoiler banner is on every
page, so the one page where it matters (a sport telling results) goes unread.

**R4.** The card's state line changes with the situation and is the only thing that does in the first view: due, set, locked,
early, result, behind, waiting on a claim, out of the playoffs, champion. Yellow fill appears only when a move is due for this
person, once; with nothing due, no yellow anywhere in view, so its absence says "nothing for you". A result is news only once you
may see it: behind, the card shows your mark and the reveal, never a score.

**Citations:** Clark (2013) for prediction match and violation; Nisbett & Wilson (1977) for behavior diverging from stated reasons.

## L4 · Decision architecture

**Constraint.** Make the right choice the easiest; simplify decision points, not workspaces; show rather than describe; match the
words to how near the commitment is.

**Violation.** The move's lock is described ("Locks Sun 11:26 PM · last week's stands in till then") but the stakes aren't shown:
who you're up against and how they've done. The sweat's facts (the opponent's form, both lineups, why a week went the way it did)
sit three taps deep in a person sheet keyed to the wrong question.

**R5.** The move is one tap from the first view and lands in the editor, with its consequence in near words ("Set your lineup ·
locks Sun 8:00 PM"). Beside it, not a tab away, the comparison a sweat needs: the opponent's record and the last result, and their
lineup once it's locked. The full comparison (B, two lineups on one scale) is one tap from the card and from any grid square, and
returns to the same scroll. Urgency is the real lock said once as a state; no countdowns, no red.

**Citations:** Hertwig & Erev (2009) for decisions from experience over description; Trope & Liberman (2010) for concrete words at
near commitments.

## R1–R5, together

1. **R1** Four chunks: bar, this week (with the move), one secondary row, the season's first rows. Each fact once; five sizes.
2. **R2** The two faces and records on the show's art are the anchor; deliberate forms for no art, solo, sports scale.
3. **R3** One matchup form, excerpted elsewhere; A's faces on the card, B's comparison one tap in; one accent; per-flavor words.
4. **R4** Only the card's state line changes with the situation; yellow only when due; nothing past your mark.
5. **R5** The move one tap away with its lock once; the opponent's form beside it; B one tap from the card or any square.

Lower layers win: when the side bets row (R3's social signal) would push the season's first row out of view, the side bets row
yields its place to a line inside the card ("2 side bets · you've called 1").

## The first view, by situation, in the eye's order

Budget at 390 × 844: the bar 48 px; the card 300–360 px (faces, records, state, the move at 52 px, a starters row); the secondary
row 52 px; the season's header and its first two or three rows below.

| Situation | 1 (first, 50 ms) | 2 | 3 | 4 | Never in view |
| --- | --- | --- | --- | --- | --- |
| Due | You vs Bo, faces and records, Ep 4 | "Your lineup isn't set" + **Set your lineup** · locks Sun 8:00 PM | Side bets row | Season: you and Bo's rows | The lock twice; a chip; a title |
| Set | You vs Bo | "You're set" and your starters' faces; theirs "shows when it locks" | Side bets row | Season | Any yellow |
| Locked | You vs Bo | Both lineups' faces, "Results when they're in" | Side bets: calls now showing | Season | A score |
| Early | You 4 vs Bo 2 **so far** | "Early: final can still change it" | Side bets | Season | The record moved by an early result |
| Results, watched | Next: You vs Di | Last week "Beat Cy 6–2" inside the card + **Set your lineup** | Side bets | Season moved | Last week as its own big block |
| Behind | Your mark: "You're up to Ep 3" over your Ep 4 matchup (no score) | **Reveal Ep 4** (every game, said once) | (nothing) | Season as of Ep 3 | Any later result, record or order |
| Opponent behind | You vs Bo | "Bo hasn't watched Ep 4 yet" | Side bets | Season | |
| Quiet night | You vs Bo, this week | Last week "Counted for nobody" | Side bets | Season | Unexplained dashes |
| Playoffs (in) | "The final" · seeds 1 vs 2 | the move | | Season with the playoff line | OUT on anyone |
| Playoffs (out) | "You missed the playoffs" · your place and record | the final's two faces, small | | Season with the playoff line | A move; OUT |
| Champion | The champion's face, "Won the season" | Your finish | | Final standings | A move; yellow |
| Waivers open (exclusive) | "Blake went home" with his face | **Replace Blake** · claims close Sun 10:57 AM; "Bo has a claim in" | This week's opponent, one line | Season | Who Bo claimed |
| Claims in | "Your claim is in" (your first choice's face) | "Claims run Sun 10:57 AM" | Opponent line | Season | Yellow |
| Waivers ran | "You got Quinn" | **Set your lineup** | Opponent line | Season | |
| Staged, a stage now | Stage line (this stage, the next) under the bar; this stage's You vs Bo | the stage's move | The overall as one line | The stage's season | "All set" while a stage has a move |
| NFL, real pool, due | You vs Bo, 2–0 each, Week 3 | **Set your lineup** · locks at the first kickoff, Thu 8:15 PM | Your nine starters as a row of small faces with positions | Season | Letter tiles; "Ep"; "castaways"; the spoiler banner |

## Today's page and the spec, against R1–R5

| | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- |
| Today's page | fails: six blocks, 13 sizes, the lock twice | fails: a name, not an anchor | fails: no matchup form; the move in its seventh form | fails: identical across situations; yellow on non-due slabs | partly: the editor is one tap; the opponent is missing |
| The page spec | passes if the card holds the move and the last result | passes | passes | passes | passes: B from the card and squares |
| Phase 0's grey box | passes | passes in principle (faces named, not drawn) | passes | passes | passes |

## The gap

The spec places the side bets row and the last result as their own rows; at 390 both can't sit above the season's first rows with
the card at full height in a due week. The minimal fit: the last result folds into the card as one line, and the side bets row
yields to a line in the card whenever it would push the season out of view. The sports check adds one requirement the show case
doesn't test: the card's starters row must hold nine starters without becoming letter tiles or wrapping to a second line.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
