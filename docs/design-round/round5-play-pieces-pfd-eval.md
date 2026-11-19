# The pieces a game's page couldn't play: PFD evaluation of the built screens (Round 5, Mode 1)

One evaluation of the after frames at 390 px (`.ui-atlas/stories/b2-play-pieces/after/`), against
[the spec](round5-play-pieces-spec.md) and [the first-view requirements](round5-play-pieces-first-view.md); the before frames
for comparison only. The skill's HTML rebuild and insight log were skipped (the fixes go into the app in one batch).
`captain-page`, `slots-page` and `slots-bo-page` are byte-identical before and after, so the page itself didn't change in those
cases; their pieces live in the sheets.

## Scores

| Layer | Score | Why, in one line |
| --- | --- | --- |
| Foundation (L0), cognitive load | 80 | Each sheet keeps one decision first and each piece one row after it; the open slot's groups open in place but push Save out of view |
| L1, first impression | 72 | Di's page leads with Out in the strip's place and a bought-back night pops; the forgiven shield is the faintest mark in the grid |
| L2, processing fluency | 58 | "Captain ×2" is one form throughout; but the second pick's wrong night lands on the face that stayed, "slot" names two things, and the bot's rule reads three ways |
| L3, prediction | 60 | A captain by name on its own row and two places for two picks predict well; Your moves says "Nothing to set here" over two open questions, and Di's views still call Episode 2's lineup hers |
| L4, decision architecture | 64 | Points beside the captain choice, the rule beside the second, the pool's parts above the faces; Against the bot contradicts the sheet, and prices sit apart from points and on no sheet |
| **Overall** | **68** | (80 × 1.5 + 72 + 58 + 60 + 64) / 5.5 |

Before, on the same rubric, L3 would sit near 40 (Di offered a lineup the server refuses; a ticked night that was wrong) and L4
near 35 (five of the seven pieces couldn't be made or seen), for an overall near 54.

## Findings

### Major

**V-L3-001 · Your moves says "Nothing to set here" while two questions are open** (`bot-move`). Behind the sheet the page's strip
reads "2 questions for Episode 2 · Locks Fri 6:57 AM", and the sheet's own header says "change anything until Fri 6:57 AM".
Joanna, who forgets, reads the sheet and closes it with both answers unmade; before, the move went straight to the questions.
**Fix:** Your moves holds the game's questions (the page's own answer cards, Save under them), or at least lists the game as
"2 questions to answer · locks Fri 6:57 AM" and opens them. "Nothing to set" only when nothing is open.

**Citations:** Clark (2013) for a contradicted prediction; Pirolli and Card (1999) for scent that points away from the goal.

**V-L3-002 · Di's own views still speak of a lineup for Episode 2** (`cut-page`, `cut-you`, `cut-move`). The out card is right,
but her grid row keeps a SET square for Episode 2 and stays the bright viewer row, her sheet shows a green "Set" over Ep 2 and an
Episode 2 block saying "Yours to change until it airs", and Your moves opens with "change anything until Fri 6:57 AM". R4 says
nothing she can't do may look like hers. **Fix:** in a knocked-out person's row, Episode 2 is the dim "–" of an unplayed square and
the row is dim (as R2's first view asks); her sheet ends at her last scored episode with "Out · cut after Ep 1"; Your moves reads
"You're out of this game: nothing to set", with no deadline.

**Citations:** Clark (2013); Reber and Schwarz (1999) for one fact said two ways reading as less true.

**V-L2-001 · The second pick's wrong night is told against the face that stayed** (`second-page`, `second-you`). Episode 2's
square and chip show Blake's face (Blake stayed) wearing the red ✗; the counted second appears only as a short white bar under it.
On the sheet, the largest words beside "Picked Blake and Cameron" are "Went home", which reads as both. **Fix:** the square carries
the counted second's own small face beside the pick, with the ✗ on it (the spec's "small second face"); the sheet's outcome names
the night, "Wrong: your second pick went home".

**Citations:** Wertheimer (1923) for a mark grouped with the nearest face; Reber and Schwarz (1999).

**V-L2-002 · "Slot" names two different things on one sheet** (`slots-move`). The dashed tile "Open slot · Start someone" is an
empty starter's place; the row under it, "Slot 1 · Finley Fischer & Cameron Chen", is the group slot. Conor will tap the open slot
expecting groups. **Fix:** the empty starter tile says "Empty · start someone"; "slot" is kept for the group slot alone, named as
the game names it in How it plays ("Tribe slot").

**Citations:** Alter and Oppenheimer (2009) for the cost of a second meaning; Clark (2013).

**V-L2-003 · The bot's rule reads three ways on one page** (`bot-page`). Each question says "2 points if you're right", a grey box
under it says "Beat the bot: score only where it's wrong", and How it plays says "2 points if you're right and the bot named
someone else". The first, in the first view, is false on its own: Ann was right on Cameron and scored 0. **Fix:** one sentence in
the rule's words under each question, replacing both the subline and the box: "2 points if you're right and the bot said
something else".

**Citations:** Reber and Schwarz (1999); Sweller (1988) for redundant text as extraneous load.

**V-L4-001 · Against the bot contradicts the sheet under it** (`bot-page`). Your row shows 1 light and 1 dark, and the legend says
dark is "the bot right, you not", yet your sheet ticks both answers (the bot matched you on Cameron). Dark seems to count the bot's
right calls, which the header already gives ("The bot: 1 of 2 right"). Light and dark are named only in a legend under the bars.
**Fix:** count beaten only where the bot was right and the person wrong (your row: beat 1, beaten 0); say the two numbers in words
at the row's ends ("beat 1 · beaten 0") and drop the Light/Dark legend; keep the bot's right calls once, in the header.

**Citations:** Reber and Schwarz (1999) for numbers that disagree reading as untrue; Cowan (2010) for a colour key held in working
memory while reading bars.

**V-L4-002 · Prices sit apart from points and appear on no sheet** (`auction-page`, `auction-you`). On Your team the price is grey
small print in the status line ("Still in · filled at 1") while points are the large number at the right, so price and return
never meet in one column (R5). The person's sheet, the only place to see anyone else's team, shows no price and no "Spent", so
Conor can't check what anyone paid. **Fix:** price beside points in the right-hand column on Your team ("1 → 2"), and the same rows
on every person's sheet ("Won at 5", "Filled at 1") under "Spent 7 of 100".

**Citations:** Thaler and Sunstein (2008) for comparisons the layout makes easy or hard; Alter and Oppenheimer (2009) for the same
team in two forms.

### Minor

**V-L0-001 · The open slot's list pushes Save out of view** (`slots-bo-open`). Five groups open in place; Save falls below the
fold and the sheet's instruction line slides half under its header ("over unless you change it" cut through). **Fix:** Save fixed
at the sheet's foot while a list is open, and the header stops overlapping text.

**V-L1-001 · The forgiven shield is the faintest mark in the grid** (`pool-mulligan-page`). It's dark on dark beside teal ticks
and red crosses, while the bought-back glyph wears the action yellow (`pool-buyback-page`): the good news reads last and the
paid-for night reads like a call to act. **Fix:** a filled badge for each, at the tick's weight, neither in the action yellow.

**V-L1-002 · Di's standing line still frames a chase** (`cut-page`). "4th of 4 · 2 pts · 0.5 behind Ann" sits over the out card,
which says "4th of 4" again. **Fix:** for a knocked-out person the line above the card goes; the card holds the finish.

**V-L3-003 · The cut line Di sees is the next one** (`cut-page`). "The cut · bottom 1 · after Ep 2" runs above Cy, while Di's card
says cut after Ep 1, and the dashes strike through the label. **Fix:** label it "Next cut · after Ep 2", draw Di's own cut under
her row, and stop the dashes before the label.

**V-L3-004 · A full-width Save under "Nothing to set"** (`auction-move`). The sheet's strongest element does nothing. **Fix:** no
Save where nothing can be set; the line and the team only.

**V-L4-003 · The open slot's groups differ in nothing but names** (`slots-bo-open`). Every row says "2 still in", so the one fact
beside each choice decides nothing, where the captain row shows points. **Fix:** each group's points so far at the game's
scoring beside "2 still in".

**V-L4-004 · The captain's carry and rule are said only in passing** (`captain-move`, `captain-page`). The row says "Avery scores
double" but not that it carries, and How it plays still has no captain step. **Fix:** "Captain carries to Episode 4 unless you
change it" under the row; the step "Name one starter your captain: they score double".

**V-L2-004 · A slot game's season table doesn't add up to its total** (`slots-you`). The table's points sum to −1.5 against
"0 pts" in the header, because the slot's +1.5 has no row. **Fix:** a Slot 1 row in the season table.

**V-L2-005 · The same pair is named in two orders and cut short** (`slots-move`, `slots-you`, `slots-bo-open`). "Finley Fischer &
Cameron Chen" in Your moves, "Cameron Chen & Finley F…" on the week, faces C F in one place and F C in another; the riding rule
truncates ("…stay toget…"). **Fix:** one order everywhere, first names where width is short ("Finley & Cameron"), the rule on its
own line.

**V-L2-006 · The same group choice in two forms** (`slots-bo-page` against `slots-bo-open`). The page's picker is five strip-styled
cards each labelled "Slot 1"; the sheet's is rows of faces and names. **Fix:** the page's picker takes the sheet's rows under one
"Slot 1 · pick a group" label.

**V-L2-007 · The pool's parts said in mixed forms** (`pool-buyback-move`, `pool-mulligan-move`, `pool-buyback-page`). "no buy-backs
left" beside "0 mulligans left", and the page's lone heart under the grid has no words. **Fix:** "No buy-backs left", "No
mulligans left"; the heart says "1 life left", as the sheet does.

**V-L2-008 · Craft** (`second-both`, `captain-you`, `bot-you`). Indigo's selected outline is clipped at the bottom of the pick
grid's last row; the captain's started tile sits higher than its neighbour (inherited across week rows); "1 pts" (inherited).
**Fix:** let the last row show its ring; align started tiles to the top; "1 pt".

## Requirements check

| Requirement | Met |
| --- | --- |
| R1, one decision first, each piece one row | yes, but for V-L0-001 |
| R2, the finish leads for someone out; marks apart at a glance | the out card and the buy-back mark yes; not for V-L1-001, V-L1-002 or the second pick's bar (V-L2-001) |
| R3, one form per fact | "×2" and the pool's words yes; not for V-L2-001 to V-L2-003, V-L4-002 |
| R4, taps do what they look like | the captain row, the two places and the slot row yes; not for V-L3-001, V-L3-002, V-L2-002 |
| R5, what decides it beside each choice | the captain, the second and the pool's parts yes; not for V-L4-001 to V-L4-003 |

Not seen in the frames, so not judged: no captain named, or a benched captain clearing the row; a second pick that didn't count;
the words on a forgiven or bought-back episode (each pool sheet opens on Episode 2); an exclusive game's holders on groups; a void
slot; someone else's sheet with a captain, prices or the bot's calls; a 30-episode grid with the new marks.

> *Initial findings. Ralph Loop a layer score, cite further, switch to solve / analyze, or ask any follow-up to dig deeper.*
