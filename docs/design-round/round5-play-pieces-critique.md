# Round 5, the play pieces: impeccable critique

Method: dual-agent (A: ada83fd9c24247ecb · B: ae071e2086df89cea). The parent session checked the findings below against the frames and the code, and cut or reworded the ones it couldn't confirm.
Browser overlay: skipped. The caller asked for a read-only review with no servers started, and impeccable's overlay needs its own live server. The critique snapshot under `.impeccable/critique/` was not written either, since this file was the only one the caller allowed.

**Target:** `?play=b2` (`src/new/show/b2.ts`). That covers the seven pieces on a game's page: a captain, a pool's second pick, group slots, an auction's prices, beat the bot, knocked out of a draft, and a pool's lives, mulligans and buy-back.
- **Code:** `git diff -- src`, chiefly `src/new/show/dock.tsx` (CaptainRow, SlotRow, PickPlaces, poolParts), `game-page.tsx` (NightCell, nightKey, AgainstTheBot), `game-sheets.tsx` (NightBadge, nightWord, PickBlock, fateLine, the bot line, TeamBlock), `lineup-sheet.tsx`, `game-week.tsx` and `src/lib/game/game-page/model.ts` (the out strip).
- **Frames:** `.ui-atlas/stories/b2-play-pieces/after/*` and `before/*`, at 390px. All of them are Night; nothing was seen in Studio.
- **Intent:** `round5-play-pieces-spec.md`, `-first-view.md` and `-shape.md`, DESIGN.md and PRODUCT.md.

## Design health score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2 | The out plate says "Cut after Ep 1", but the hero above it still says "0.5 behind Ann", the grid gives Di a SET square for Ep 2, and her sheet says "Yours to change until it airs" (cut-page, cut-you). The captain never shows on the page itself. |
| 2 | Match system / real world | 2 | "Went home" is the big word on a night your own pick stayed (second-you). Also "Their mean, 2 of them", "filled at 1", "Plus a tribe slot" for a pair, and a Light/Dark legend under the bot bars. |
| 3 | User control and freedom | 3 | The second pick can be emptied, the captain changed, and nothing counts until Save. But after your first pick the sheet quietly moves the active place to Second pick (dock.tsx:647). |
| 4 | Consistency and standards | 2 | Bought back is a chyron-line fill and a second yellow. The person's strip, the grid and the episode sheet tell the same night three different ways. "Slot" means an empty starter place and a group in the same sheet. "0 mulligans left" sits beside "no buy-backs left". |
| 5 | Error prevention | 2 | The second pick reads "Optional" and its line says when it counts, never what it risks: a counted second that's wrong ends the streak and uses that castaway up. Good: the same face can't fill both places, and held groups are refused with a reason. |
| 6 | Recognition rather than recall | 3 | Most rules sit beside their choice: "Avery scores double", "Held by Bo", "In your other slot", the second pick's when-it-counts line. The misses are the second pick's stake and decoding Light and Dark. |
| 7 | Flexibility and efficiency | 2 | The captain carries with the lineup, which is good. But nobody else's auction prices can be seen, and the words for a forgiven night are two taps deep and on no frame. |
| 8 | Aesthetic and minimalist design | 3 | The pieces are calm and add only one new section. Against that: "4th of 4" twice in cut-page's first view, a legend sentence under two bars, and a captain multiplier said three times in one sheet. |
| 9 | Error recovery | 2 | The refused taps get plain toasts ("That's your pick: a second pick is someone else"). But the out person gets no "what now", and the bot game's Your moves says "Nothing to set here." with two questions open on the page. |
| 10 | Help and documentation | 2 | How it plays has no captain step (the spec asked for one) and no buy-back step. The bot question still says "2 points if you're right" with the old rider "Beat the bot: score only where it's wrong". |
| **Total** | | **23/40** | **Acceptable** |

## Design specificity verdict

**LLM assessment:**
- **It belongs to this product.** Every piece is made from the app's own parts: the moves sheet's tiles, Plate's angled tag, the season grid's squares, the person sheet's hairline rows and the strip's out plate. None of it could be lifted into another app unchanged.
- **It is timid.** Almost every piece is a 12px badge or a 13px muted line. The round fits the pieces in; it doesn't stage them. A captain's armband, a buy-back and a beaten bot never become a moment, which PRODUCT.md's principle 8 ("bold television graphics… must not turn the app into a clinical utility") asks for.
- **The one broadcast moment is the knocked-out plate.** A quiet "OUT" tag and "CUT AFTER EP 1" in condensed caps on a white plate, in the place a move would go. It is humane and right, and the screen around it undoes it (issue 3).
- **Where it slipped into generic:** Against the bot is a stock two-tone bar with a colour legend, where the shape asked for good and live-red ends on Round 3's record bar. The second pick's places are a generic two-up form field.

**Deterministic scan:**
- **What ran.** `impeccable detect` (engine 0.1.14, launcher 4.0.0) on dock.tsx, game-page.tsx, game-sheets.tsx, lineup-sheet.tsx and game-week.tsx exited 0 with 90 advisory findings, all `design-system-font-size`. 14 fall in this round's changed hunks; 76 predate it.
- **12 of the 14 are false positives.** Six are initials sized to a face tile with no photo (dock.tsx:559, 595, 727; game-page.tsx:926; lineup-sheet.tsx:285, 311). The rest are sizes DESIGN.md's prose names though its token list leaves them out (12px muted, 14px caps, 18px). Adding those steps to the token list is a DESIGN.md decision for the user, as in Round 4.
- **True positives:**
  - Round 5's only new one: `lineup-sheet.tsx:286`, the week's "Captain ×N" tag at 10px. DESIGN.md's badge is 11px and 10px is named nowhere.
  - `game-sheets.tsx:674`, the night word at 34px. The size predates this round (it was already there at HEAD); only the line was touched.
- **What the detector missed.** It skips decimal sizes, so `text-[12.5px]` on five added lines went unflagged (dock.tsx:502, 554, 600, 749; lineup-sheet.tsx:304); 12.5px is on neither scale. It also missed every copy problem, the chyron-line fill, the 4.2:1 bar numerals, the 36px clear button and the wrong bot count. The review caught those.
- **Agreement.** The review had already flagged the off-scale 10, 12 and 12.5px sizes; the detector adds the exact line of the 10px tag.

## Overall impression

The structure is right and the data work underneath it is honest.
- Each piece sits beside the move it belongs to, as one row or one line, so the lineup sheet still leads with who starts.
- The out state reaches the data: `lineupOf` and `pickOf` return nothing once you're cut, Your moves drops the game's tab (moves.ts), and the strip puts your finish where the refused "Change your lineup" was.

Where it falls down is telling the truth consistently:
- A night the second pick lost is drawn on the first pick's face.
- The bot record counts a tie as a loss.
- Di is told she's out in one place and still playing in four.

These are the exact contradictions the round set out to remove, now moved rather than fixed.

The single biggest opportunity: make each outcome sit on whoever caused it, in one form everywhere (the first-view paper's R3), and give the two emotional peaks, being knocked out and being rescued, the weight they deserve.

**Cognitive load:** 4 of 8 checklist items fail (moderate).
- **Pass:** chunking (the parts line holds at most three items), grouping (each piece under its move behind a hairline), at most four options per decision (the captain pills, the two places), and progressive disclosure (a slot's groups open in place).
- **Fail:**
  - Single focus, in part: on pool-buyback-page the yellow bought-back badges compete with the yellow "Your pick" strip.
  - Visual hierarchy: forgiven is the quietest mark on the grid and bought back the loudest, and "Went home" is the biggest word on a night your pick stayed.
  - One thing at a time: after your first pick the sheet moves you to the second place without asking.
  - Working memory: the second pick's stake and the bars' Light and Dark both have to be carried in from elsewhere.

**The emotional journey:**
- **Knocked out (Di) is the valley.** The plate is dignified. But directly above it "0.5 behind Ann" says she's still chasing, the grid hands her a SET square for Ep 2 under a cut line labelled "AFTER EP 2", and her sheet says "Yours to change until it airs". Nothing tells her what is still hers.
- **A rescue reads as a loss.** A mulligan saving your streak is good news, yet it renders as the faintest grey shield. A buy-back costs 3 points and gets the celebratory yellow. The emotional colour is inverted.
- **Beating the bot is a footnote.** "The bot said Yes: you beat it" is the right sentence, at 13px muted.

## What's working

1. **The out state goes to the data, not just the paint.** No lineup or pick is offered once you're cut (game-view.ts), the game's tab leaves Your moves (moves.ts:195), and `stripOf` (model.ts:362-370) writes "Cut after Ep 1 · 4th of 4 · your 2 pts stand · Ann, Bo and Cy play on" with no move under it. The quiet tag rather than live red is a humane call.
2. **The captain is chosen on its own row.**
   - It is a radiogroup of 44px pills under the tiles, never a second tap on a tile, which is the first-view paper's L3.
   - The tile's tag turns bone, "CAPTAIN ×2", so yellow keeps meaning "due".
   - Benching the captain clears it, the engine carries it over, and the week puts the captain first with "Individual immunity win ×2" (captain-you). One "×2" form everywhere, as R3 asked.
3. **Answers at the point of doubt.**
   - The bot's call under each settled answer, "The bot said Cameron too, so it doesn't score", explains the baffling tick beside a 0 in one plain sentence (bot-page).
   - The slot picker's refused groups say "Held by Bo" or "In your other slot".
   - The refused face taps get a toast that names the rule.

## Priority issues (ranked)

### 1. [P1] A night the second pick lost is blamed on the first pick
- **Where:**
  - second-page and second-you, Ep 2. Blake, your pick, stayed. Cameron, your counted second, went home. The grid and the strip show Blake's face greyed out with a red ✗.
  - The sheet's big word for that night is "Went home", directly beside "Blake Brooks · Your pick · Stayed in ✓".
  - In code, `NightCell` (game-page.tsx:926) and `StripCell` (game-sheets.tsx:598) grey the first face whenever the night is "home", and the badge sits on that face. `nightWord` (game-sheets.tsx:687) maps "home" to "Went home".
  - The only sign of the second is a 3px pip whose key says "a second pick counted", not that it was the one that sank the night.
- **Why it matters:**
  - The before frame showed a green tick next to "streak now 0". The after flips that contradiction rather than removing it.
  - DESIGN.md: red means someone went home. Here it lands on someone who didn't.
  - Andrew, glancing, concludes Blake was voted out.
- **Fix:**
  - Put the outcome on whoever caused it. Keep the first face with its own ✓. On a night a counted second sank, show the second's face as the square's face, or make the pip a tiny second face carrying the ✗.
  - Make the night's word read the night, not a person: "Wrong", with "Your second pick went home" under it. Keep "Went home" for a night the first pick left.
- **Command:** /impeccable clarify, then /impeccable layout

### 2. [P1] Against the bot counts a tie as a loss, and its legend says so
- **Where:**
  - bot-page. Ann's bar shows a dark "1" for the Cameron question, where she and the bot both named Cameron and Cameron went home. Her own sheet, a few hundred pixels lower, says "The bot said Cameron too, so it doesn't score".
  - `botLine` (answer-points.ts:452) counts `beaten` as "the bot was right and you scored nothing", and that includes both being right.
  - The legend (game-page.tsx:981) says "Dark: the bot right, you not", which is false for Ann.
  - The shape asked for beat in good and beaten in live red. The build uses bone and grey, which forces the legend sentence.
  - The bar's `aria-label` sits on a bare `<span>` (game-page.tsx:971), so a screen reader reads "1 1".
- **Why it matters:** this is the round's only new comparison display, and it misreports the record. Conor will read it as a bug in the game.
- **Fix:**
  - Count three outcomes per person: beat it (you right, it wrong), level (both right, nobody scores), and it beat you (it right, you wrong).
  - Label the bar's ends in words ("Beat it 1 · It beat you 0"), with level as a hairline gap between them, and drop the Light/Dark sentence.
  - Give the bar `role="img"` with its label. Its numerals then need 4.5:1: the grey segment is bone on #75708a, about 4.2:1 at 13px.
- **Command:** /impeccable clarify (the view model's count is an engine-side fix)

### 3. [P1] Knocked out: everywhere but the plate says you're still playing
- **Where:**
  - **cut-page:**
    - The hero line "4th of 4 · 2 pts · 0.5 behind Ann" sits directly above the plate's "4th of 4 · your 2 pts stand", so "4th of 4" appears twice and "behind" implies a chase.
    - The grid gives Di a SET square for Ep 2. Her row isn't dimmed as the spec asked.
    - The cut line reads "THE CUT · BOTTOM 1 · AFTER EP 2", with its dashes striking through "1 · AFTER EP 2", so "was I cut after 1 or 2?" (the strike-through predates this round).
  - **cut-you:** "Episode 2 · Set · Yours to change until it airs. Nobody sees it before then." The week pane has no out branch (lineup-sheet.tsx:206).
  - **cut-move:** "Episode 2 · change anything until Fri 6:57 AM · Nothing to set here." (dock.tsx:56-63).
  - **Missing:** the spec's "what's still yours: your people still in the show". Kai, Logan and Marlowe are still in, and the page doesn't say so.
- **Why it matters:** the first-view paper's R2 says the out person's first impression is their finish, with no move. This is the round's highest-stakes moment, and four places contradict the one that's right.
- **Fix:**
  - One out state everywhere:
    - The hero line becomes the finish ("Finished 4th of 4 · 2 pts") or goes, since the plate carries it.
    - Di's grid row is dimmed, with "–" from Ep 2 on.
    - Her sheet's next pane says "Out after Ep 1: nothing more to set".
    - Your moves names no episode deadline for someone with nothing to set.
  - Label the grid's rule as the next cut ("Next cut · bottom 1 · after Ep 2") and keep the dashes off the words.
  - Add one line of what's still hers to the plate or under it: "Kai, Logan and Marlowe are still on the show".
- **Command:** /impeccable harden

### 4. [P1] The second pick slides in on its own and never says what it risks
- **Where:**
  - dock.tsx:647. After the first tap, `setPlace("second")` moves the outline to Second pick (second-both). Someone changing their mind taps another face and gets a second pick instead of a replacement. That breaks how every pick sheet before it behaved, and L3's "the same gesture never does two things".
  - The places read "Optional", and the line under them (dock.tsx:749) says only when it counts: "The second pick counts only on a night two or more go home."
  - The engine (state-logic.js:5243-5245, 5325) also uses up a counted second's castaway and ends the streak if it's wrong.
- **Why it matters:** "Two shots" plus "Optional" reads as a free extra chance. Casey, interrupted, can end up with a second pick she never meant to make, which can end her streak and spend a castaway she wanted later.
- **Fix:**
  - Keep Your pick active after a tap, so a tap replaces the pick as it always has. Filling the second takes its own act: a tap on the Second pick place, or an "Add a second pick" in it.
  - State the stake where the second is chosen: "Counts only if two or more go home. Then, if they go home, your streak ends; either way you've used them."
- **Command:** /impeccable clarify

### 5. [P2] The new grid marks invert the loudness and break the colour rules
- **Where:**
  - **pool-buyback-page:**
    - The bought-back badge is `bg-chyron-line text-chyron-foreground` (game-sheets.tsx:697). DESIGN.md's Fill Not Line rule forbids chyron-line as a fill. On Night it is a second yellow beside the "Your pick" strip (the One Chyron Rule). On Studio it would be #845800 under ink, about 3:1.
    - The key's arrow is a muted outline that doesn't match the yellow mark.
  - **pool-mulligan-page:** the forgiven badge is a `quiet-tag` circle (#2a2633) on the card (#221f2c), close to invisible, and the face beside it isn't dimmed. A forgiven night reads like "no result yet".
  - **Size:** the shape and R2 asked for one glyph at 14px, distinct at a glance. The grid's badges are 12px (`size-3`, game-page.tsx:927), with glyphs of about 7px.
- **Why it matters:**
  - A rescue is good news, and it gets the faintest mark. A buy-back cost 3 points, and it gets the brightest.
  - "Was my pick forgiven?" is Andrew's whole visit, and the answer is the hardest mark on the page to see.
- **Fix:**
  - Forgiven gets a filled, legible mark the size of ✓ and ✗: good-tinted, the shield in good-foreground.
  - Bought back gets a neutral bone fill with ink, or a live outline, since it was a loss that cost points. Never yellow.
  - Draw each key entry with the identical mark.
  - Badges at 14px, as the shape said, at least on the person's strip where there's room.
- **Command:** /impeccable colorize, then /impeccable polish

### 6. [P2] Three places tell the same night three ways
- **Where:**
  - **The episode sheet's list of everyone's picks** (game-sheets.tsx:1001-1009) still uses the old right/wrong. It shows a red ✗ and "who went home" for a forgiven or bought-back night, "No pick · missed" for a skipped one, and no second picks at all. The grid and the person's strip now use `nightKind`.
  - **fateLine** (game-sheets.tsx:802-803) appends today's counts to an old night: "· none left", "It cost a life · 1 life left".
  - **No frame shows the night's words** for a forgiven or bought-back night, a skipped night, or a second pick that didn't count. The person's sheets open on Ep 2.
- **Why it matters:** the first-view paper's R3 is "one word per pool outcome, the same on the grid's key and the sheet". Conor, drilling from the grid to the episode, gets a different verdict for the same night.
- **Fix:**
  - Put the episode sheet on `nightKind` and `NightBadge`, with second picks.
  - State a night's counts as of that night ("your last mulligan"), or leave the counts to the pick sheet's parts line.
  - Add story frames: Ep 1 opened on pool-mulligan-you and pool-buyback-you, a skipped night, and a void second pick.
- **Command:** /impeccable harden

### 7. [P2] Auction prices show only on your own team on the page
- **Where:**
  - auction-page: "Still in · filled at 1" and "Out · Ep 1 · won at 5" in the 13px status line, with "Spent 7 of 100" run together with "Only you have them: one owner each."
  - auction-you: "The team now" (SeasonBlock, game-sheets.tsx:961) has no prices; only TeamBlock got them, and an auction-drafted Outlast doesn't render TeamBlock.
  - No view anywhere shows what anyone else paid.
- **Why it matters:**
  - The spec's job for this piece is "anyone's team on their sheet: each castaway's price", and Conor "checks what everyone paid".
  - The first-view paper's R5 asked for price in the same column as points, so "paid 5 for a 1-pointer" reads at a glance. In a status line it doesn't.
- **Fix:**
  - Prices on every team list a sheet renders, with "Spent X of 100" in each person's sheet header.
  - On Your team, the price as a small number beside the points column ("5 → 1 pt").
  - "Spent 7 of 100" as the section's aside, on its own.
- **Command:** /impeccable layout

### 8. [P2] The pieces aren't taught or surfaced where people look
- **Where:**
  - **How it plays:**
    - captain-page has no captain step; the spec asked for "Name one starter your captain: they score double". It is in the summary only, as before.
    - pool-buyback-page's steps never mention the buy-back.
  - **The bot question form** (bot-page) still says "2 points if you're right", with "Beat the bot: score only where it's wrong" in a box that looks like a button. The spec's rider was "2 points if you're right and the bot said something else". Only How it plays was rewritten (describe.js).
  - **The captain is never on the page.**
    - The strip says "Change your lineup" whether or not you have one.
    - The Captain row (dock.tsx:497-526) never says it carries; the spec's Left column was "Captain carries to Episode 4 unless you change it".
    - Joanna, whose captain was benched, isn't told until she opens the sheet.
  - **bot-move:** "Nothing to set here." while two questions are open on the page.
- **Fix:**
  - Add the captain and buy-back steps.
  - Rewrite the question's points line in the rule's words, and make the rider plain text, not a button-shaped box.
  - Show "Captain: Avery ×2" or "No captain yet" in the strip's line.
  - Add "Carries to Episode 4 unless you change it" to the Captain row's aside.
  - In a questions-only game, Your moves says "Your answers are on the page" and links there.
- **Command:** /impeccable onboard, then /impeccable clarify

### 9. [P2] Words, and messages cut mid-sentence
- **Where:**
  - **slots-move:** "OPEN SLOT · Start someone" (an empty starter place) sits in the same sheet as "SLOT 1" (a group), so "slot" means two things. How it plays says "Plus a tribe slot" for a game whose groups are pairs (slots-page).
  - **Cut mid-message:**
    - "Riding into Ep 3: it scores if they stay toget…" (dock.tsx:554, `truncate`).
    - "Cameron Chen & Finley F…" on the week (lineup-sheet.tsx:303).
    - DESIGN.md's strip rule is that a message never truncates.
  - **Other words:**
    - "Their mean, 2 of them" (lineup-sheet.tsx:305).
    - "filled at 1".
    - "0 mulligans left" next to "no buy-backs left" (dock.tsx:713-714).
    - "with one life from the next one" (game-sheets.tsx:801).
- **Fix:**
  - Name the group slot with the show's group word ("Your pair", "Pair 1"), so "slot" keeps its lineup meaning.
  - Let state lines wrap to two lines.
  - "Average of the two"; "given at random for 1" (or the spec's "Filled at 1" with that explained once in the aside); one count form ("0 buy-backs left"); "back in from Ep 3 with one life".
- **Command:** /impeccable clarify

### 10. [P3] Craft and accessibility nits
- **Sizes:** the 10px week captain tag (lineup-sheet.tsx:286; detector true positive) should be the 11px badge. 12.5px appears on five new lines and is on neither scale.
- **Touch target:** the second pick's clear × is 36px (`size-9`, dock.tsx:736); DESIGN.md's floor is 44px.
- **The captain radiogroup:**
  - It has no arrow-key handling.
  - A second tap on the chosen pill clears the captain (dock.tsx:515), which a radio never does. Joanna can lose her armband with one stray tap.
- **Labels on non-elements:** `aria-label` sits on bare `<i>` elements for NightBadge and the second-pick pip (game-sheets.tsx:700, game-page.tsx:928), so the grid reads names with no outcome.
- **Sport lineups:** a captain's tag replaces a sport starter's position tag, "QB" becoming "Captain ×2" (dock.tsx:453-456). The position and the armband should both show.
- **Frames:**
  - second-both: Indigo's teal outline is clipped at the grid's foot.
  - cut-page: the plate's line orphans "on".
  - captain-you: "Individual immunity win ×2" wraps and pushes Blake's tile down (that layout predates this round).
- **The multiplier, three times:** captain-move says it as "CAPTAIN ×2" on the tile, "CAPTAIN ×2" as the row's label, and "Avery scores double" in the aside. The row's label can be "Captain".

## Persona red flags

**Casey (one thumb, interrupted):**
- Back on the pick sheet, she taps a different face to change her mind and gets a second pick (dock.tsx:647).
- A second tap on her captain pill clears the captain.
- The 36px × that empties the second pick is under the 44px floor.

**Jordan (first-timer):**
- "Open slot" and "Slot 1" in the same sheet.
- "Optional" read as a free extra shot.
- A red ✗ on Blake, who stayed.
- How it plays never mentions the captain.
- "mean", "filled at 1", and a Light/Dark legend to decode.

**Sam (screen reader, keyboard, low vision):**
- **Outcomes go unread.** The grid's outcome labels sit on bare `<i>` elements, so names are read with no outcome. The bot bar reads "1 1".
- **Keyboard.** The captain radiogroup has no arrow keys.
- **Contrast and size.**
  - The bar's grey numerals are about 4.2:1.
  - Grid glyphs are about 7px.
  - The forgiven badge is near the card's own colour.

**Joanna (forgets):**
- A benched or missing captain is silent on the page; the strip just says "Change your lineup".
- A second pick never carries, and nothing on the page says it's open. The spec asked for both.

**Andrew (drives by, one game):**
- "Was my pick forgiven?" The shield is the faintest mark on the grid, and the sheet opens on the latest episode, not the forgiven night.
- On the cut page, "0.5 behind Ann" above "OUT" leaves "am I still in?" open.

**Conor (tinkers, several games):**
- He can't see what anyone else paid.
- The bot record misreports ties.
- The episode sheet disagrees with the grid.
- A riding slot has no line saying when it can change.
- The slot's two pickers look unrelated: white plates on the page (slots-bo-page, unchanged from today), a dark list in the sheet (slots-bo-open).

## Questions to consider (for the user)

1. **How deliberate should a second pick be?**
   - (a) Two places, but a tap never moves to the second on its own.
   - (b) An "Add a second pick" action that reveals the second place, with the stake stated.
   - (c) A yes/no "Take a second shot tonight?" before the second place appears.
2. **How loud should a rescue be beside a loss?**
   - (a) Forgiven gets a filled good mark; bought back is neutral and shows its cost.
   - (b) Both neutral and equal, with the night's words doing the work.
   - (c) A rescue becomes a beat in the episode reveal, not just a grid mark.
3. **What is a knocked-out player's game from now on?**
   - (a) A spectator view: the standings, their castaways still on the show, reactions.
   - (b) A small consolation, such as calling who's cut next for bragging rights only.
   - (c) A shareable finish card, after which the game moves to their archive.
4. **When nobody is captain (the spec's open question):**
   - (a) Name the top-scoring starter for them.
   - (b) Leave it empty, but make "No captain" a due move in the strip.
   - (c) Carry the last captain whenever they start again.

Note: "Filled at 1" and "Counts if two or more go home" are the spec's own words, so issue 9's "filled" and issue 4's stake question the spec, not only the build. "Held by Bo" (game-twists.ts:79) shows another seat's slot choice for the next episode before its lock. The spec asks for it in an exclusive game, where the route refuses a held group, but it is an exception to the spec's "from the lock" rule that the user should know about. Issues 1, 2, 3, 6 and 8 are where the build departs from the spec's own rows or the first-view paper's R2, R3 and R5.
