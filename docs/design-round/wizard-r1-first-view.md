# Start a game: first-view requirements (the redo's Round 1)

## The problem

Someone on a couch opens Start a game to turn "let's play along with this" into a game their friends will actually play. Today the
first thing they meet is a settings panel: 17 to 20 controls (`.ui-atlas/stories/wizard-r1/before/wiz-tonight.jpg`), the first
question is how long (not the game they came with), the game sits half a screen down, a later tap can move an earlier answer, and
a game can quietly not be there (Outlast under "Friday"; on the real Survivor 51 the season is "2 eps" and Outlast is gone). The
drive-by wants a good game chosen and one tap; whoever starts for a group with Joanna in it needs to see what the game asks of
everyone each week; the tinkerer needs to trust that every piece exists and is reachable. What they experience is hesitation,
scrolling, and a sheet that moves under the thumb.

## The layers, bottom-up

### L0 · Cognitive load

**Constraint.** Working memory holds about three to five chunks, and visual noise spends that budget even when it isn't attended.

**Violation.** The first view asks for when, the lock, which game and what to change at once: seven groups of controls before the
game is known. Every unanswered control is held in mind while reading the next.

**R1.** The first view MUST carry one decision and no more than four chunks (where this is, the game or the games, the one way to
start, the one way to something else); everything else is either pre-answered and shown as a line of state, or one tap away.
Eight tap targets at most, one of them primary.
**Citations:** Cowan (2001) for the three-to-five-chunk ceiling; Hassin et al. (2009) for unattended visual noise still spending working memory.

### L1 · First impression

**Constraint.** A screen is classified in about 50 ms, and classification ("what is this?") gates everything after it.

**Violation.** The glance today reads "a form": a segmented control, a readout bar, a section called WHEN MOVES LOCK. The fun thing
(a game for tonight's episode) is below the fold, so the drive-by classifies it as work.

**R2.** The first view MUST classify as "a game, ready to play": a game's name in the largest type, the show's art or faces as the
setting, what it asks of everyone in one line. A configuration control never leads the sheet.
**Citations:** Lindgaard et al. (2006) for 50 ms visual judgements; Leder et al. (2004) for classification as the stage before evaluation.

### L2 · Processing fluency

**Constraint.** What's easy to process reads as true and trustworthy, and consistency is what makes it easy.

**Violation.** One game is drawn four ways (a rail card with pictograms, the white card's three steps, the footer, How it plays),
in three vocabularies ("BEFORE IT STARTS", "1 EP JUST FRIDAY", "The classic · A team"). "Weekly Lineup · A team" and "Best Ball ·
A team" read the same. A yacht crew's game is called "The classic" in a competition's words.

**R3.** A game MUST be said the same way wherever it appears: the same parts in the same order and words (what you do · how long ·
how you win), in the show's own nouns. Where two games are compared, the line that differs MUST be the line shown.
**Citations:** Reber & Schwarz (1999) for ease of processing read as truth; Alter & Oppenheimer (2009) for fluency carrying into trust and confidence.

### L3 · Perception bias

**Constraint.** People run on prediction and take the default; a broken prediction fires attention, and attention spent on "what
just moved?" becomes distrust.

**Violation.** Tapping the season swaps the game; a game changes the lock above it; a game that exists isn't listed, so the starter
concludes it doesn't exist. Someone from fantasy football expects a draft to be exclusive, and nothing says it isn't.

**R4.** The default MUST be the right game for this moment (the season's state, the couch's size and the flavor decide it); a
choice MUST stay where the starter left it, a moved line marked in place; and nothing the engine can make may be absent from
view: what can't apply here is shown with what it needs, so the starter's picture of what's possible matches the engine's.
**Citations:** Clark (2013) for prediction error as the trigger of attention; Kahneman (2011) for decisions made by the default.

### L4 · Decision architecture

**Constraint.** The environment makes the decision; what's ahead is underweighted when described and weighed properly when shown;
near commitments want concrete words.

**Violation.** Start it commits friends to weeks of moves while the game's weeks are described abstractly ("Rest of season"); the
"Next:" line is the one concrete demonstration and it works. The tinkerer's palette is spread over step screens, quick changes,
bets and scoring, and the casual decision point carries all of it.

**R5.** At the commitment, the first view MUST show the game's first week concretely (what each person does, by which day and
time, what happens after) beside the one primary action. The casual decision point MUST stay sparse, while the full palette sits
one tap away in one place that lists everything the engine can add to this game, each with its effect in a line. Nothing may
press: no countdowns, streaks or "only now".
**Citations:** Hertwig & Erev (2009) for demonstration over description; Trope & Liberman (2010) for concrete language at near-term commitments.

## R1 to R5

| | The requirement |
|---|---|
| R1 | One decision, at most four chunks and eight targets in the first view, one primary |
| R2 | It reads as a game ready to play: the game's name biggest, the show as setting, configuration never first |
| R3 | One way of saying a game everywhere, in the show's nouns; the differing line is the one shown |
| R4 | The right default; choices stay put; everything possible is visible, what can't apply says what it needs |
| R5 | The first week shown concretely beside one primary action; the whole palette one tap away in one place; no pressure |

## What satisfies all five

The first view is **the game** (or, where a list leads, each row is the game collapsed), in this order:

1. **Where this is** (one line, small): the show, the next episode or game with its day ("Survivor 51 · Episode 9, Wed 8 PM").
2. **The game**: its name, largest; the line of what it asks of everyone ("Three calls, before Wed 8 PM"); for a made-for game, its
   one-line hook.
3. **The parts**, as statements in one block: what you do · how long · how you win (the same words everywhere; each tappable,
   reading as text, not as buttons).
4. **The first week**, concretely: "Wed 8 PM · everyone's calls lock" · "Thu noon · results, then the night's winner".
5. **One primary action** (Start it, saying who's told), at the foot.
6. **One way to everything else**, one line under the game: the existence line, naming the space in a breath with its counts ("Or:
   6 more for tonight · 18 for the season · make your own"), so everything possible is perceived without being processed (R1 and
   R4 together).
7. Describe a game and Surprise me as two quiet text links, never above the game.

Below the fold, never in the first view: twists, bets, scoring, who can join, waivers, the draft room, the pace's other values (the
pace is one line of state in the parts block or the first week).

**The five-second test.** Shown the first view for five seconds, a tester says what it is ("a game for tonight's Survivor") and
what they'd do ("start it, or pick another"). Naming three things fails it.

**The casual path against the sweat's.** Andrew: the first view's game and Start it, one tap. The starter for Joanna: the line of
what it asks of everyone, read before anything else; another game one tap away, ranked by that line. Conor: the existence line, then
the one place that lists everything the engine can add, each with its effect, every change marked where it lands.

## The four structures against R1 to R5

| | R1 | R2 | R3 | R4 | R5 | At risk |
|---|---|---|---|---|---|---|
| Today | fails (17-20 targets) | fails (a form leads) | fails (four renderings, pictograms) | fails (silent moves, missing games) | half (the Next line) | everything above |
| A · The menu | holds if the list shows the recommended game as a plate and at most four rows | holds (games lead) | holds only if a row is the plate collapsed, not a second card language | holds with the "needs more episodes" line under a length's list | the plate carries the first week | a list invites "which one?"; length chips must read as a heading, not a setting |
| B · The sentence | holds (the sentence is one chunk) | at risk: a sentence reads as text; the game's name must sit over it, largest | strongest: one rendering by construction | strong: a clause changes only itself | holds | discoverability of the tappable clauses; twisty games make long sentences |
| C · The interview | holds (one question a screen) | holds only if each answer is a game ("One pick a week · Survival Pool"), not an abstraction | holds | holds if tonight's game sits above the question | the game arrives after the answers; the first week on it | the named game must be findable among the first answers; three screens for task 2 |
| D · The slip | at risk: tiles, ready slips and the slip are three zones | holds (reads as play) | the slip is the one rendering | strong: legs only add | the slip's foot is the first week | the casual path has more to read; a sportsbook's look must not carry its pressure |

## The gap

- **Everything visible against one decision** (R4 against R1): the engine makes thousands of games and a phone shows five. The
  existence line is what no structure has yet: one line naming the whole space with counts, under the default game.
- **One rendering against a list** (R3 for A and D): a list row is a second way of saying a game unless the row is the plate's
  first lines; rows and plate share their words and order.
- **A concrete first week at your own pace** (R5): with own pace the lock is per person, so the first week says both ("Wed 8 PM,
  or whenever you watch").
