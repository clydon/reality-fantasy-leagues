# Settings, Round 3a: the first views (Perception-First Design, `solve`)

> **Status (2026-11-21): Round 3a, step 2 of the design process.** PFD's Mode 2 derivation on Intent's spec
> ([settings-r3-spec.md](settings-r3-spec.md)), before anything is built. It owns what's noticed first and how much is at once;
> Intent's structure stands. Phone at 390 × 844, one first view ≈ 690 px under the bar, Lower Third (Night).

## Step 1: the problem

Someone who runs a game wants to do one thing to *that game*: lock it early tonight, let someone in, change how replacements work,
take one person out, rename it, end it. Today they must first translate "this game" into a place ("Backstage"), then into a page
named by kind (Results, Waivers, Scoring rules, Members & roles, Game settings), then find the game inside that page, and some of
what they want (rename, remove from one game, Bring it back with everything archived) isn't anywhere. A Helper can't tell which
of the things they see are theirs. So the runner asks the Commissioner, or gives up, or makes the bluntest change in reach.

## Step 2: layer by layer

**Foundation (attention and the entry gesture).** Constraint: the runner arrives holding the game, from wherever they met it
(its page, its card, a job on the strip, a change line), and follows the strongest scent to "this game's setup". Violation:
Backstage is scented by show, not game, and its pages by kind; a job on the strip leads to a page where the job isn't open.
- **R1. Every runner door lands on the one page for that game, and a door that came from a job lands with that job in view and
  open. The show's ⋯ row is an index of games (each row scented by its own state), never a second place where settings live.**
  **Citations:** Pirolli & Card (1999) for information scent deciding the path; Norman (1988) for the door's mapping to its thing.

**L1 (pre-attentive: the first 200 ms).** Constraint: one salient signal wins; colour and position pop before words. Violation:
Backstage's yellow plate, the dot, the "Needs you" heading and six equal rows compete; a Helper's rows look exactly as
changeable as a Commissioner's; Stop and Delete sit among the rules.
- **R2. The game's identity first (its name, its type and show), then the one thing with a deadline in the house's yellow (the
  lock tonight, or a request), and nothing else coloured. A row you can't change loses its chevron, keeping its value at full
  contrast; Stop sits below the first view, quiet.**
  **Citations:** Treisman & Gelade (1980) for one feature popping out; Wolfe (1994) for guided search following the strongest cue.

**L2 (working memory: how much at once).** Constraint: about four chunks at once; a long page is chunked by stable headings.
Violation: Manage this game holds ten sections; How it plays alone has eight rules; a busy season lists 57 games; a couch of 12.
- **R3. A first view holds at most four chunks: the head, the job (only while there is one), the How it plays heading and its
  first three or four rows, each closed. Sections keep one order on every game (a missing one is left out, never moved), so the
  page is learned once. Long lists fold at a held height: running games one row each, Finished folded with its count; Who's
  playing past eight folds.**
  **Citations:** Cowan (2001) for about four chunks; Chase & Simon (1973) for stable chunks being recognised, not reread.

**L3 (meaning: reading it right the first time).** Constraint: a word predicts its consequence only if it's the word people met
before (in Start a game) and says what happens. Violation: two vocabularies (wizard vs Backstage); "Game admin" vs
"Commissioner"; "Lock now" with no state said; "Auto" as a state.
- **R4. One name per fact, Start a game's; every row's value says the consequence ("When your team is short · 1 swap a
  window"); the lock says its state, who set it and when ("Open · locks itself at 8 PM", "Locked early by riley"); a fixed row
  says why ("Fixed: the draft is done"); the head's role line says what's yours in a Helper's case, once.**
  **Citations:** Reber, Schwarz & Winkielman (2004) for fluency read as truth; Hertwig & Erev (2009) for outcomes stated, not
  inferred.

**L4 (decision: choosing without fear).** Constraint: people choose the smallest act whose outcome they can foresee, and avoid
acts they fear are final. Violation: today's only exits are blunt (take someone out of every game; archive in three places with
one Undo); a join request with no "not now".
- **R5. The smallest effective act is first and the final one last: Pick for them before Remove from this game; Archive (Undo)
  before Delete (held); Let them in with Not now beside it. Each act that reaches other people says who it reaches and whether it
  comes back ("Their other games and the couch stay").**
  **Citations:** Johnson & Goldstein (2003) for defaults and ordering carrying choices; Kahneman & Tversky (1979) for loss
  weighting final acts.

## Step 3: the requirements

| # | Must |
| --- | --- |
| R1 | Every runner door → the game's one page; from a job, that job in view and open; the ⋯ row an index with each game's state |
| R2 | Identity first; one yellow for the one deadline; unchangeable rows lose the chevron, not contrast; Stop below the first view |
| R3 | ≤ 4 chunks in the first view; one section order everywhere; long lists fold at a held height |
| R4 | Start a game's words; values say consequences; the lock says state, who and when; fixed rows say why; one role line |
| R5 | Smallest act first, final act last and held; reach and return stated |

## Step 4: the solution, view by view

**1. Manage this game, alex (Commissioner), episode night, the lock open**
- **First view, in the eye's order:** (1) the bar: back to the game, "Manage this game"; (2) the head: "LINEUP LEAGUE" at 44 px,
  "Weekly Lineup · ZT Survivor 51", "You run this game" (R2); (3) the job, in yellow: "Ep 6's lineups · Open · lock themselves at
  8 PM" with **Lock now** (R2, R4); (4) HOW IT PLAYS and its first rows: How moves lock (Together · late moves on the honour
  system), Who scores each week (3 of your 5 · 2 on the bench), Team size, Who can join (R3).
- **Below:** the rest of How it plays (How long, Replacing people who leave, Points), Who's playing, The draft (if not done), This
  season's rules on this couch, This game's changes, Rename, then Stop, quiet, after a gap.
- **Not in the first view:** any opened control, Who's playing, Stop, Delete, anything about other games.
- **Five-second test:** "Lineup League; it's open until 8 and I can lock it now; here's how it plays."

**2. The same page, riley (Helper)**
- **First view:** the same head with the role line "You help run this game: the lock, waivers and who's in are yours. alex
  changes the rules." (R4, once); the same job block (hers to act on); How it plays rows with their values and no chevrons (R2).
- **Not:** a note on every row; Rename; Stop; This season's rules' controls (its values only).
- **Five-second test:** "the lock is mine; the rules are alex's."

**3. The show's ⋯ and Games you run here**
- **⋯, first view:** the show's name; **Games you run here** as the first row, its value "3 games · 1 needs you" with the dot only
  while one does (R1, R2); then the doing rows as Round 2 left them; no Backstage, no plate.
- **The sheet, first view:** "Games you run here"; one row a running game: its name, its type, its state in a few words ("Locks at
  8 PM" in yellow when due, else "Weekly Lineup · Ep 6 open"); **Finished · 2** folded, holding Bring it back inside each game's
  page (R3: 57 finished fold to one row with a count).
- **Not:** settings on the sheet; Recent changes (it's its own ⋯ row).
- **Five-second test:** "my three games here; Lineup League needs me."

**4. The strip, with a runner's job**
- **The job:** the strip's grammar, its tag saying it's a runner's job ("You run it"), the title as the state ("Ep 6's lineups
  lock at 8 PM"), the line naming the game and the act ("Lineup League · lock it early"); a join request: "jordan asked to join
  Lineup League". Tapping opens Manage this game with the job open (R1).
- **Order:** by deadline with the person's own moves; when deadlines tie, their own move first. At most one runner job shown, then
  "+1 more in games you run" (R3), so a player-runner's own lineup is never pushed out.
- **Not:** Remind them; any results job on a season the bot settles.

**5. A person's sheet in Who's playing**
- **First view:** their face and name, "Player in Lineup League · on the couch since Oct"; **Role**, value first, collapsed
  (Commissioner · Helper · Player; Commissioner's only); **Pick for them** only while a waiver window is open; then, after a gap,
  **Remove from this game**, quiet, its line "Their team leaves this game. Their other games and the couch stay." (R5).
- **Not:** their roles in other games; Invite; stats.
- **Five-second test:** "sam, a player here; I can make him a Helper, pick for him, or take him out of just this game."

## Step 5: the proposals, tested

| Proposal | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- |
| Today (Backstage home, five pages by kind, a game's settings 4–5 taps down) | fails: scent by show and kind; jobs land closed | fails: plate, dot, heading and rows compete; Helper rows look changeable | fails: Members & roles and Results run long; three archive places | fails: two vocabularies, "Auto", "Game admin" | fails: remove from every game only; no rename |
| Intent's spec | passes, if a job's door opens the job | passes, if Needs you and the lock aren't both yellow | passes, with the folds | passes, with the word table | passes |

## Step 6: the gap

Intent's spec has Needs you **and** This episode's lock as two sections; on an episode night they're the same item, and two yellow
blocks break R2 and R3. **The lock is the job:** while it's due it shows once, in the job block; on other days it's a plain row at
How it plays' head ("This episode's lock · Auto · Tue 8 PM"). Second: the spec doesn't say what the door from a job does on arrival;
it must scroll to the job and open it, or the runner lands on the head and hunts (R1). Third: a Helper who opens a person's sheet
needs to see what's theirs there too (Pick for them yes, Role and Remove no), so the sheet hides what isn't hers rather than
showing it dead.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
