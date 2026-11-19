# Round 4, Game settings: impeccable critique

Method: dual-agent (A: afa91662001484821 · B: a342ffcda0e9a24eb). The parent session checked the findings below against the frames and the code.
Browser overlay: skipped. The caller asked for a read-only review with no servers started, and impeccable's overlay needs its own live server.

**Target:** `?settings=r4`. That covers Backstage › Game settings (the list), a game's own settings page (pushed over the game or Backstage), and the game's ⋯ row.
- **Code:** `src/new/backstage/game-settings.tsx` (new), `settings.tsx` (sections lifted out) and `show/game-page.tsx` (the menu row).
- **Frames:** `.ui-atlas/stories/round4-game-settings/after/*` and `before/*`, at 390px.
- **Intent:** `round4-game-settings-spec.md`, `-shape.md` and `-first-view.md`, DESIGN.md and PRODUCT.md.

## Design health score

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | The lock row states this episode plainly ("Episode 6's lineups: Open · Auto: locks at its start, Sun 8:00 PM"). But list rows drop the lock time ("Ep 6's lineups open"), and the switch's caption "AUTO" names the current mode, not what a tap does. |
| 2 | Match system / real world | 2 | "Lock" means four things (this episode's lock, How moves lock, Lock it down, the padlock "can't change"). Plus "Override", "Stop this game", and "Chosen when a game starts." read as an instruction. |
| 3 | User control and freedom | 3 | Each change has Undo. One line opens at a time. Archive gives an Undo toast; delete is held and restorable for 30 days. Back doesn't say where it goes. |
| 4 | Consistency and standards | 2 | Back is unnamed. The sheet says "WEEKLY LINEUP" and the page "LINEUP LEAGUE". "Ep 6's" vs "Episode 6's"; "a Commissioner" vs "the Commissioner". The page says "Stop this game", the list "Archive or delete a game". Three control grammars, three radii (10/4/3px). |
| 5 | Error prevention | 3 | Fixed lines say why; consequence lines ("Nobody loses points already scored"); delete is held. But "Stop" sits beside How long's end, and locked-down and finished games give the wrong reason (code). |
| 6 | Recognition rather than recall | 3 | Value-first lines let you read the whole setup closed. But list rows lose the game type, and a Game admin loses each line's real detail. |
| 7 | Flexibility and efficiency | 2 | Two ways in (⋯ and Backstage) is right. But no bulk action for "57 finished", and the list's global archive picker lists every game. |
| 8 | Aesthetic and minimalist design | 3 | Closed, it is calm: the busy season fits one view, where today's page runs past 65,000px. Opened, it nests a card, a sunk panel and white plates, with duplicate headings. |
| 9 | Error recovery | 3 | Undo toasts, and "Archive it instead" in the delete hold. Errors surface as raw `e.message` toasts. |
| 10 | Help and documentation | 3 | Inline consequences and reasons are good. The off card's reason replaces what own pace means. |
| **Total** | | **27/40** | **Acceptable (top of band)** |

## Design specificity verdict

**LLM assessment:**
- **What's right.** The restructure is right: a list of games, then one page per game, with the rules as value-first lines. The page's top 330px is this product: the condensed-caps title card "LINEUP LEAGUE" under "ZT SURVIVOR · SEASON 51", the role sentence, and Start a game's pictogram tiles and caption labels.
- **What's generic.** Below that, the rules card and the whole Backstage list are a stock grouped-settings list: a 10px-rounded card, icon tile, label, value, chevron. Any app could ship it unchanged.
- **The list lost the game's identity.** It dropped the game's ink bar and its type. Today's page leads with "OUTLAST · Couch Cup"; Round 4's row says only "COUCH CUP".
- **The opened controls fall back to two other design languages:**
  - legacy Backstage blocks, with an h3, an explainer box and a stepper;
  - Start a game's white option plates with yellow outlines.
  So one line can open into a different system from its neighbour.
- **The missed Lower Third moment.** This episode's lock is the only thing here with a deadline, which is exactly what a quiet caption plate is for. It is a generic toggle card instead.

**Deterministic scan:**
- **What ran.** `impeccable detect` (v0.1.14) on the three files exited 0 with 23 advisory findings, all `design-system-font-size`. By file: game-settings.tsx 2, settings.tsx 5, game-page.tsx 16.
- **20 are false positives.** DESIGN.md's prose names 14, 17, 20 and 28px (tags at 13–15, the wizard footer's 17, the totals' 20, the "You" header's 28), but its typography token list leaves them out. Adding those steps to the token list is a DESIGN.md decision for the user.
- **True positives:**
  - Round 4's only one: `game-settings.tsx:150`. The SettingLine's second line is 14px, while DESIGN.md's index row and the same file's ListRow (line 50) use 13px.
  - Pre-existing: `game-page.tsx:91` (header name 20px vs the documented 22) and `:612` (a 52px button at 20px; weak).
- **What the detector missed.** The 10px radius, the yellow plates, the `transition-[left]` and every copy problem. The review caught all of those.

## Overall impression

The information architecture is a clear win.
- The 60-game season reads in one phone view: "RUNNING 3 games", an "EPISODE 20" fold and a "FINISHED 57 games" fold.
- The title card's "You run this game. Each change saves at once, with Undo." tells a commissioner something the old page never did.

Where it falls down is the words and the opened state:
- "Lock" is overloaded, and the one control a Game admin has is an Auto/Override switch.
- How moves lock says two opposite things in one view.
- The opened lines are the old page's blocks and Start a game's plates pasted in.

The single biggest opportunity: make this episode's lock the page's one authored moment, and make every row on the list carry its lock time.

## What's working

1. **The structure scales.** settings-busy fits 3 running, 3 one-episode and 57 finished games in 844px; the old page was more than 65,000px. Alex's list is three rows.
2. **Value-first lines with reasons:**
   - "TEAM SIZE · 3 each · Set at the draft" with no chevron;
   - "WHO SCORES EACH WEEK · 3 of your 5 · 2 on the bench";
   - "Changes start with Episode 6. Nobody loses points already scored." beside the stepper.

   A commissioner can read the whole setup without opening anything.
3. **Ways in phrased per role.** The ⋯ row reads "Game settings · What you set, and what you can still change". The lock row comes first because it is the one thing with a deadline. Delete keeps its hold, with archive offered instead.

## Priority issues (ranked)

### 1. [P1] The lock row's switch: Riley's one job hides behind "AUTO", and "lock" means four things
- **Where:** riley-game, line-pace and list-game; `settings.tsx:431-444`.
  - The switch is `role="switch" aria-checked={overridden}`, with the caption "AUTO" or "OVERRIDE": the mode you're in, not what a tap does.
  - Its off track is `bg-secondary` on `bg-card`, about 1.1:1 with no edge, which fails WCAG 1.4.11's 3:1.
  - When on, it fills chyron.
  - The knob animates `left`, against DESIGN.md's transform/opacity rule.
  - Padlocks also sit on "TEAM SIZE", on every Game admin line, and on "HOW MOVES LOCK · Together" (riley-game), where it reads as "moves are locked".
- **Why it matters:** the title card promises Riley "you open or close this episode's lock". To close it early on a Sunday she must work out that the switch labelled AUTO means "flip me to Override". Joanna's late move depends on that tap.
- **Fix:**
  - Replace the switch with the action in words: a quiet "Lock now" while open, "Open it again" while locked, and "Back to Auto" while overridden. Or use a three-way segmented control, Auto · Open · Locked, with the chosen side in the bone `foreground` fill, never chyron.
  - Keep the padlock for this episode's lock only. A fixed rule loses its chevron and keeps its reason, with no padlock (or a plain dash).
  - If a switch stays, give its track the `border-edge` outline and move the knob with `translateX`.
- **Command:** /impeccable clarify, then /impeccable harden

### 2. [P1] The Game admin view breaks the spec and DESIGN.md
- **Where:**
  - **settings-riley.** The chip says "You run this"; the spec's bar row says "You run this (or Game admin)". Below it, a dimmed "Lock it down" switch (greyed help text at about 2.8:1) and "Only a Commissioner changes these."
  - **riley-game.**
    - "Only the Commissioner changes this" appears four times, replacing each line's real detail. Riley loses "late moves on the honour system", the one fact she needs to decide whether to reopen a lock.
    - Four padlocks.
    - "REPLACING PEOPLE WHO LEAVE" still has a live chevron into Backstage › Waivers.
- **Why it matters:**
  - The spec says "the lines without chevrons, 'Only the Commissioner changes these' once".
  - DESIGN.md says read-only is "plain text … never a greyed-out control".
  - She is told no five times, right under a sentence that already said it.
- **Fix:**
  - Chip "Game admin".
  - Competitive mode as plain text ("Off · the Commissioner's call"), or leave it out for her.
  - Every line keeps its real second part, with no padlock and no chevron (Replacing included). The title card's sentence is the one notice.
  - One article throughout: "the Commissioner".
- **Command:** /impeccable harden

### 3. [P1] How moves lock contradicts itself in one view
- **Where:** line-pace.
  - The chosen card says "Together: Everyone's move for each episode locks when it airs."
  - Directly under it, also chosen: "On the honour system: Open after an episode airs until you watch it, or the next one airs."
  - Then: "None: Everything locks when the episode starts."
  - The off own-pace card reads "Chosen when a game starts." That replaces its meaning (`off` replaces `line`, `game-settings.tsx:199`) and reads as an instruction.
  - The verbs "airs" and "starts" are both used for the same moment.
- **Why it matters:** this is the rule commissioners most often misread, and the redesign exists to make it plain. Together is only true as written when late moves are None.
- **Fix:**
  - Together: "One deadline for everyone: airtime. Late moves below."
  - Own pace, when it's off: keep its line ("Your move locks when you start watching."), with the reason under it: "Picked when a game starts: this one started Together."
  - Choose one verb, "airs", everywhere on the page.
  - Bring back "Recommended" on the honour-system card; today's page has it.
- **Command:** /impeccable clarify

### 4. [P1] Locked-down and finished games give the Commissioner the wrong reason (verified in code; no frame)
- **Where:**
  - **`game-settings.tsx:237`.** The pace line is fixed only when `frozen && !g.commissioner`. So for a commissioner whose game is locked down or over, "How moves lock" keeps its chevron and opens. In `PaceCards` (`:204-205`), `can` is false, so the unchosen card says "Only the Commissioner changes this", to the Commissioner.
  - **`:257`.** "Replacing people who leave" ignores `frozen` and `span.over`, and always links out.
- **Why it matters:** the spec says locked down is "Locked down for the season" on every line, and finished is "It's over". Telling the Commissioner "Only the Commissioner changes this" is an outright error message aimed at the wrong person.
- **Fix:**
  - `fixed={g.pace.mode === "own" ? "Chosen when the game started" : frozen}` on the pace line.
  - Pass the `frozen` reason into PaceCards in place of the hard-coded words.
  - Freeze the waivers line when `frozen` is set or `span.over`.
  - Add story frames: competitive mode on, a finished game's page, mid-draft, a one-episode game, and The questions, Who can join and How long opened.
- **Command:** /impeccable harden

### 5. [P2] The opened controls are loud and grafted on
- **Where (yellow, line-pace):**
  - The two chosen options are white OptionCards with 3px chyron-line outlines and ticks; with the Override switch on, the page would have a third yellow.
  - This breaks the One Chyron Rule, Plates Are For Single Moments, and the round's own R5: "No yellow on this screen except this episode's lock when it's due to close today."
  - A chosen setting is a state, not a "now", yet it is the brightest thing on screen, louder than the game's name.
- **Where (duplication, line-lineup):** "WHO SCORES EACH WEEK · 3 of your 5" opens to:
  - a second heading, "HOW WEEKLY LINEUP WORKS";
  - an explainer box repeating "3 of your 5";
  - a stepper labelled "Who scores each week" again, wrapping "week" alone onto its own line;
  - "On the bench" as a bare "2" that doesn't line up with the stepper's value.

  Who can join and How long carry their own h3s the same way. That makes three nesting levels with three radii: the 10px card, the 3px sunk panel, then 4px cards.
- **Fix:**
  - In settings, show "chosen" as a bone tick on the panel or the segmented control's `foreground` side. Keep the white-plate and chyron treatment for Start a game, where choosing is the task.
  - Give `LineupControl`, `JoinControl` and `HowLong` a `compact` prop that drops the h3 and the explainer inside a line. Leave only the control (Starters − 3 +), the bench as a fixed sub-line, and the consequence line.
- **Command:** /impeccable quieter, then /impeccable distill

### 6. [P2] Wayfinding and naming between list, page and menu
- **Where:**
  - **The pushed page's back.** It says "‹ Back" from both ways in; `PushedPage`'s `back` prop is unused. DESIGN.md: "Back always says where it goes".
  - **The bar title.** It stays "GAME SETTINGS" after the title card scrolls away, so a long opened page loses which game it is.
  - **The sheet and the page disagree.** game-menu's sheet is titled "WEEKLY LINEUP"; the page it opens says "LINEUP LEAGUE".
  - **List rows.**
    - They carry only the custom name, with no type or ink (today's "OUTLAST" is gone).
    - "Ep 6's lineups open" has no lock time.
    - "COUCH CUP · Together · Ask me first" never says what kind of game it is.
  - **The folds (settings-busy).** "EPISODE 20" and "FINISHED" are styled like the game rows, in their own cards, so they read as two more games. "Split t…" truncates mid-word.
- **Why it matters:** Conor's Saturday job is "check each game's lock before Sunday". Today he opens three pages to learn three times.
- **Fix:**
  - Back named for where you came from ("‹ Backstage" or "‹ Lineup League").
  - The bar takes the game's name once the card leaves.
  - Name the game the same in the sheet and the page.
  - Each row gets the game's ink dot, the name, then "Weekly Lineup · Ep 6 lineups lock Sun 8 PM".
  - The folds use the Running section's heading form ("EPISODE 20 · 3 games") over plain rows; let the kinds wrap or drop them.
- **Command:** /impeccable layout

### 7. [P2] "Stop this game": wrong word, wrong icon
- **Where:** list-game and settings-game. `KeyRound` is the same key as the "You run this" chip. The verb "Stop" invites an end-of-season archive when the person meant "end after Episode 10" (How long). The list keeps "Archive or delete a game", whose picker lists every game you run (60+ on the busy season).
- **Why it matters:** two names for one action, and the key signals ownership, not ending. Archiving is one tap after the fold opens, with Undo only in a transient toast, so Casey, interrupted, loses it.
- **Fix:**
  - "Archive or delete Lineup League", with the Archive icon, under a hairline at the page's foot.
  - One line inside: "To end it after an episode, change How long ›", jumping to that line.
  - On the list, replace the global row with "Archive all 57" on the Finished fold.
- **Command:** /impeccable clarify

### 8. [P3] Craft nits
- **Detector true positive.** The SettingLine second line is 14px (`game-settings.tsx:150`); make it 13px like ListRow and DESIGN.md's index row.
- **Radius.** The 10px card radius (Round 3's block) conflicts with DESIGN.md's "Don't round graphics past 4px". Either document the block in DESIGN.md or bring it to 4px.
- **Kicker.** The title card's kicker sits about 10px under the bar's hairline; give it the bar's breathing room.
- **Case.** "late moves on the honour system" is lowercase where its siblings ("Set at the draft", "Replace right away") are sentence case.
- **Pictograms.** They borrow base games' drawings: Live calls' stopwatch for How moves lock, co-op for Who can join, halves for How long. In Start a game the same drawings mean games.
- **Focus.** SettingLine and ListRow get the browser's default focus ring; OptionCard gets the designed 3px chyron-line ring. Use the designed ring everywhere.
- **Pre-existing, not Round 4.** The "ZT SURVIVOR" watermark in the Backstage bar reads half-legible, like a glitch. The Backstage index row's detail, "Lineup size and who can join", is now stale.

## Persona red flags

**Casey (one thumb, interrupted):**
- The lock switch is the top-right target, and "AUTO" doesn't say what a tap does.
- Opening How moves lock pushes the page down about 370px.
- "Stop this game", then "Archive Lineup League", archives on the second tap, and the Undo toast is gone by the time Casey looks back.

**Jordan (first-timer):**
- "Override", "late moves on the honour system" (unexplained until opened), the value "When someone's out", "Set at the draft: more starters come off the bench", "Chosen when a game starts." and "Stop this game" all need translating.
- The four meanings of "lock" are the worst of these.

**Sam (screen reader, keyboard, low vision):**
- **Names and headings.** The PushedPage dialog has no accessible name. The bar title and the game's name are both `h3`, and "The rules" is a `<p>`, not a heading.
- **Contrast.** The lock switch track is about 1.1:1, and Riley's dimmed help text about 2.8:1.
- **Focus.**
  - Focus isn't returned to the row after closing.
  - The padlock is an svg with `aria-label` but no `role="img"`, so it may be skipped.
  - Rows get the browser's default ring while OptionCard gets the designed one.

**Conor (tinkers, runs three games):**
- No lock times on the list.
- 57 finished games, archived one at a time.
- No game types on the rows.
- A "Changed" tag on a line and the old yellow dot inside it mark the same fact twice.

**Andrew (drive-by, one game):**
- "Let a friend in" works: ⋯, Game settings, Who can join, choose (4 taps). But the opened panel repeats "WHO CAN JOIN".
- "Stop this game" is the tempting end-of-season wrong turn.

**Riley (Game admin):** the chip says "You run this", then "Only a Commissioner changes these", then four padlocks, then a live chevron on Replacing. Her one control is phrased in a different verb from her role sentence.

**Joanna (forgets):** she never comes here, but her late move waits on Conor or Riley decoding the Auto/Override switch.

## Questions to consider (for the user)

1. **Make the lock the moment?** If this episode's lock is the only deadline here, should it be the page's one Lower Third moment: a quiet plate, "EP 6 · Lineups lock Sun 8 PM", with Lock now and Keep open late? The same lock time would then sit on every list row.
   - **Options:** (a) a quiet plate with two worded actions; (b) a three-way Auto · Open · Locked control; (c) keep the switch, relabelled.
2. **Changing vs making:** should changing a running game look like making one?
   - **Options:** (a) keep Start a game's white plates, without the yellow; (b) a calmer settings grammar (segmented control, or a tick on the panel); (c) plates for pace only.
3. **The Game admin's page:** does a Game admin need a settings page at all?
   - **Options:** (a) the full read-only page, fixed as in issue 2; (b) only the lock row, on the game page she's already on; (c) both.
4. **What "Stop" means:** is "Stop" really two questions?
   - **Options:** (a) the page's foot asks "End it after an episode, or archive it now?"; (b) keep archive or delete at the foot, with a link to How long; (c) leave "Stop this game" as the spec named it.

Note: "Stop this game" and "Auto or Override" are the spec's own words (spec rows 40 and 49), so issues 1 and 7 question the spec, not the build. Issues 2 and 4 are where the build departs from the spec (spec rows 26 and 59, and the locked-down/finished states).
