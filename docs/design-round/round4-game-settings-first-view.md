# Changing a game later, first view: requirements (Round 4)

Mode 2 derivation on [the page spec](round4-game-settings-spec.md), at 390 × 844, building on Phase 0's app-wide
[R1–R5](phase0-first-views.md) and Round 2b's game screen ([wizard-r2b-first-view.md](wizard-r2b-first-view.md): the title card,
rules as lines). Today's frames: `.ui-atlas/stories/round4-game-settings/before/`: `settings-alex`, `settings-riley`, `settings-busy`
(the busy season), `game-menu` (a game's ⋯ menu).

## The problem

Someone who runs a game wants to change one thing about it (let a friend in, start one more player, open this episode's lineups for
a late couch) or to stop it.
- **Backstage › Game settings** (`settings-alex`) opens on Outlast's "When moves lock": two radio tiles in the engine's words ("When
  the next one airs", "At airtime"). The first view is one game's first setting.
- **The other games:** each is a further 1,100 px of always-open radios and steppers. The page is 3,385 px for three games, and
  on the busy season it is past 65,000 px, too tall to capture.
- **From the game:** its ⋯ menu (`game-menu`) has no way to its settings.
- **A Game admin** (`settings-riley`) sees the same page in full, every control dimmed, before the one thing she can do.

## L0 · Cognitive load

**Constraint.** Working memory holds three to five chunks; always-open controls each claim one.

**Violation.** Every setting of every game is an open control group. The first view holds one game's lock choice and half of
another, and nothing says how many games are below.

**R1.** Each view holds at most four chunks:
- **The list:** the bar, then one row per game (name, a single line of what's notable), so three running games and the folded
  groups fit in the first view.
- **A game's screen:** the title card, this episode's lock (when it has one), then the rules as single lines, at least five of them
  in the first view, each 52 px or less.
- **One control at a time:** a line opens its control in place, and opening another closes the first.

**Citations:** Cowan (2001) for the chunk ceiling; Sweller (1988) for extraneous load from controls not in use.

## L1 · First impression

**Constraint.** Meaning is judged in about 50 ms, from the largest, most distinct element.

**Violation.** The largest elements on today's page are radio tiles, so the first impression is "a form". Neither the game's
identity nor its state leads.

**R2.**
- **A game's screen opens on the game:** its title card over the show's art, as Start a game made it. That reads as "this game",
  continuous with how it was made (the user's call on the title card, 2026-11-18).
- **The list leads with each game's name,** in caption caps.

**Citations:** Lindgaard et al. (2006) for the 50 ms judgement; Tractinsky et al. (2000) for perceived usability following the first
impression.

## L2 · Processing fluency

**Constraint.** One form per fact; the same thing said in the same words everywhere.

**Violation.**
- **How moves lock** is "Together" and "At your own pace" in Start a game, but "When the next one airs" and "At airtime" here.
  Own pace is a paragraph of prose.
- **A fixed setting** ("Set at the draft") looks like a stepper with a number.

**R3.** Start a game's forms, unchanged:
- **The rules as lines,** value first.
- **How moves lock** as the two cards (Together, At your own pace); Together's late-moves choice sits under it, in the same
  words Start a game's card uses.
- **A fixed line:** a lock glyph and its reason in place of a chevron.
- **A changed line:** the existing dot.

**Citations:** Reber and Schwarz (1999) for one form reading as true; Alter and Oppenheimer (2009) for the cost of a second form.

## L3 · Prediction

**Constraint.** People act on prediction; a line that looks tappable must open something.

**Violation.**
- **The game's ⋯ menu** promises the game's things and leaves out its settings.
- **A Game admin's controls** look tappable and refuse with a toast.
- **Archive or delete** sits at the foot of a shared page, so it's unclear which game it acts on.

**R4.**
- **"Game settings" in the game's ⋯ menu,** for whoever runs it.
- **Every line with a chevron opens its control;** a line without one says why.
- **A Game admin sees one sentence** ("Only the Commissioner changes these") and no dead controls, with the lock's Override live.
- **Stop sits on the game's own screen** and names the game ("Archive Couch Cup").

**Citations:** Clark (2013) for prediction and its violations; Norman (2013) for signifiers.

## L4 · Decision

**Constraint.** One decision per view, with what decides it beside it; destructive actions guarded in proportion.

**Violation.** Every decision is offered at once, and the destructive ones are a tap below them.

**R5.**
- **One decision at a time:** the open line. Its consequence sits beside it ("from Episode 6; nobody loses points already
  scored").
- **Archive** is one tap, with Undo.
- **Delete** keeps today's hold, last, folded under Stop this game.
- **No yellow** on this screen except this episode's lock when it's due to close today.

**Citations:** Iyengar and Lepper (2000) for one decision at a decision point; Thaler and Sunstein (2008) for safe defaults and
guarded irreversible actions.

## The first views, then

**Backstage › Game settings (alex):**
- The bar, then **Running:** Outlast, Weekly Lineup, Survival Pool, a row each. Each row has its name and one line, for example
  "Episode 6's lineups open · Together · Anyone joins".
- **On the busy season:** Episode 20's games folded to a line, and "57 finished" folded to a line.
- **Then:** Competitive mode, Archive or delete.
- Must not: an open control, a game's settings in full.

**A game's settings (alex, Weekly Lineup):**
- The title card.
- This episode's lock row (Open · Auto).
- Lines: How moves lock, Together; Who scores each week, 3 of 5; On the bench, 2 (fixed: set at the draft); Who can join,
  Anyone on the couch; How long, Episode 1 to the season's end; Replacing people who leave, Only when short.
- Stop this game at the foot.
- The eye's order: the game → its deadline → the line to change → its consequence.

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
