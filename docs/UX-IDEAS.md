# UX ideas, with reasons

Started 2026-11-13 at the user's invitation: ideas for UI/UX that doesn't exist yet, each with why, so they can be weighed
together later. Not decisions, and not flaws (a flaw in something already built or planned is raised with the user directly, with
reasoning, instead of being listed here). Gaps the gameplay explorer finds are listed in
[the explorer plan's "Designs needed"](PLAN-GAMEPLAY-SCENARIO-EXPLORER.md); an idea here may answer one of those, and says which.

Each entry: the idea, who it's for and what they're doing, the reason, and what it would cost or risk.

## Start a game says when moves lock

- **Idea.** The wizard's summary carries one short line ("Moves stay open until you've watched") that opens the choice, instead of
  the rule living only in Backstage › Game settings.
- **Who, when.** Whoever starts a game, at the moment they're deciding what kind of game this is. Also Joanna, who forgets: the
  line tells her nothing bad happens if she's late.
- **Why.** The rule changes how the whole season feels (does a missed lineup cost you?), and it's now on by default for new
  games. A default nobody was told about reads as a bug the first time someone sets a lineup after the episode.
- **Cost.** One more thing on the densest sheet in the app; it has to stay one line. Waits on BACKLOG 63 (the third choice).
- **Built 2026-11-13** with BACKLOG 63: "When moves lock" on the sheet, one line, Change behind it.

## A game in stages carries its stages' moves

- **Idea.** The game's own page shows the move that's due in whichever stage is on now, and each seat's points stage by stage
  beside the overall.
- **Who, when.** Anyone opening "the game" from Tonight or the Games tab: they think of it as one game.
- **Why.** Today the game's page says "All set · Nothing to do before Ep 3" while its first stage asks for an Episode 3
  lineup, and the overall is one number with nothing saying what each stage gave. Answers Designs needed item 33.
- **Cost.** The game page model reads one league; this reads its stages too (the server already does, for the overall).

## The next stage's draft announces itself

- **Idea.** When the merge opens a stage's draft, everyone in the game gets one plain moment: "The merge is here: draft your
  Merged team by Friday 8 PM", on Tonight and as a push, with what happens if they don't.
- **Who, when.** Everyone in a staged game, mid-season, most of them not thinking about the game that day.
- **Why.** A draft that opens by itself in the middle of a season is the one moment a staged game has that no other game does,
  and nothing designs it yet (the explorer makes that draft itself). Someone who misses it has no team for the stage. Answers
  Designs needed item 33; BACKLOG 60 (too few left to draft) and 61 (what someone behind is shown) sit beside it.
- **Cost.** A new notification kind and a state on Tonight; has to stay spoiler-safe for someone who hasn't watched the merge.

## Own pace says where it will wait

- **Idea.** When the game on the sheet has a part everyone does together (a draft with turns, waivers on exclusive teams), the
  When moves lock line names it: "The game waits for each of you. Everyone's together for the draft, and for waivers."
- **Who, when.** Whoever starts the game, and later anyone who's ahead and meets "Wait for everyone else before watching more".
- **Why.** Own pace is now the default, and its two sync points are the only places it makes someone wait for someone else.
  Met cold in week 4, the waiver moment reads as the app being stuck. Said at the start, it's a rule they chose.
- **Cost.** The line has to stay short; needs the spec read for its sync points (the plan's `paceOf(spec)`, not built).

## Tonight says the game is waiting for you, not that you're behind

- **Idea.** For a game at its own pace on a season still airing, the plate for an episode you haven't revealed leads with what's
  safe ("Episode 7 is here when you've watched it · your lineup is still open") rather than a count of what you've missed.
- **Who, when.** Joanna, three days after the episode, opening the app with some dread.
- **Why.** The same plate was written for a couple working through a finished season, where "catching up" is the activity. On
  a live season the same words can read as a telling-off, and the point of own pace is that being late costs nothing.
- **Cost.** Words and one state on the own-pace plate; needs a look at the plate on a live season first (step 2 only checked
  that it renders).

## The lock row says who it's open for

- **Idea.** Backstage's lock row for an episode that has started shows three states, in words, instead of a switch: "Open to
  whoever hasn't watched" (the game's rule), "Open to everyone" and "Locked for everyone", with the game's rule marked as such.
- **Who, when.** Whoever runs the game, the morning after an episode, deciding whether to let a latecomer in or to call time.
- **Why.** The pace made an aired episode a three-state thing and the row still shows two: it can open one to everyone, but can't
  close one for people who haven't watched (only a lock set before it started does that). "Auto: locked at its start, still open
  to anyone who hasn't watched it" under a switch reading Locked is true and hard to read. Not needed at own pace, where waiting
  is the point.
- **Cost.** A small control change and one more stored state after airtime (`ep.lineupsLocked` already means it); the words need
  care so "Locked for everyone" doesn't read as the default.

## Start a game, redone (the user, 2026-11-14: "we desperately need to redo the wizard for creating a game. The user flow, intuitive-ness, everything needs a lot of help")

Not scheduled ("that's another time"); ideas are welcome until it is. When it's taken up it goes through impeccable's shape,
phone first at 390, and is tried on someone who has never seen it (the friend-group archetypes: Joanna forgets, Andrew drives
by, Conor tinkers). The current wizard stays the baseline until then (AGENTS.md).

**What's wrong, seen first-hand on 2026-11-14** (while checking BACKLOG 68 on its screens; flaws, so raised with the user that day):
- **It asks when before what.** "When it runs" (Friday / Rest of season / Custom) comes first, and the list of games below
  depends on it. On "Friday" Outlast isn't offered at all, with nothing saying it exists or why it's missing. A check written
  that day looked for Outlast and couldn't find it; a person would give up the same way.
- **Changing one answer silently changes another.** Tapping Rest of season swapped the chosen game (a toast: "Now Weekly
  Lineup, the classic for the rest of the season"). Since BACKLOG 68, picking a game can also change the "When moves lock" line
  above it. Each is right by its rule; together the sheet moves under your thumb.
- **A setting sits above the thing it's a setting of.** "When moves lock" is asked before the game is chosen, and its default
  follows the game.
- **The games are a sideways rail of small cards.** Three abstract pictograms, a name, half a line ("A team"). The next card
  is cut off at the edge; "Every game · 7" is a link. Nothing compares two games, and "Weekly Lineup: A team" and "Best Ball:
  A team" read the same.
- **A rule that decides a lot is invisible.** Whether two people can hold the same castaway (shared or exclusive) drives who
  can join, how waivers work and which pace is safe, and the sheet neither says it nor asks it. Every standard game here is
  shared, Outlast included; someone from fantasy football will assume the opposite.
- **One sheet holds everything.** Game, length, pace, twists, ways to win, scoring, moments, bets, bots, a name, Tell the
  couch, Surprise me, Describe a game, made-for games: about fifty distinct controls behind one scroll.
- **There are two of them.** A season that's aired and a sport's season still start from the older list (BACKLOG 42).
- **Kept from today's, because it works:** the footer that says what happens next in the game's own words ("Next: everyone
  answers 2 questions, before Fri 8 PM · tells the couch") above one button; a recommended choice already made, with Change.

**Ideas** (each to be weighed, none decided):

- **Ask what, then how long.** Choose the game first; each game then says the lengths it can run ("tonight only", "the rest of
  the season"), and a length it can't run is shown and says why. *Why:* people arrive with a game in mind or with none, never
  with a span. *Cost:* a one-night game needs to stay one tap for tonight's quick start (U0's decision), so tonight keeps a
  shortcut of its own.
- **Ask by effort, in the couch's words, for someone with no game in mind.** "How much should everyone have to do each
  week?": nothing (draft once, then watch) · one pick · set a lineup · answer a few questions. That narrows eight kinds to one or
  two. *Who:* whoever starts a game for a group that includes Joanna. *Why:* effort is what decides whether a couch finishes a
  season, and it's the thing game names hide. *Cost:* a made-for or described game needs an honest effort tag from its spec.
- **The game as one sentence you can edit.** "Everyone drafts 3 castaways (shared). Set 2 starters each episode. Most points
  wins. Moves lock when you've watched it. Runs the rest of the season." Each clause is the control for itself: tap it to
  change it. *Why:* it's the whole game on one screen, in order, and a setting can't sit above its subject. The engine already
  writes the sentence (`describeSpec`). *Cost:* clauses that depend on each other must say so when one changes another, in
  place, not in a toast.
- **Say what changed and why, where it changed.** When one choice moves another, mark the moved line ("Changed with the game:
  was When you've watched it") with an undo on it. *Why:* silent changes are the least intuitive thing on the sheet today.
- **Shared or all yours is a question.** For a game with teams: "Can two of you have the same castaway?" with what each answer
  brings (anyone can join late / a real draft with turns, waivers, nobody new at own pace). *Why:* it's the biggest rule a
  team game has, and the one outsiders assume wrongly. *Cost:* one more question; it only shows for team games.
- **Show the first week before you start.** Under the game: what each person does and by when, with the real dates ("Fri 8 PM:
  lineups lock · Sat noon: results"). *Why:* the footer's "Next:" line already does this for one step and is the clearest thing
  on the sheet; a week of it answers "what am I signing my friends up for".
- **A list to compare, not a rail to scroll.** Games down the page, one line each of what you do, an effort tag, the
  recommended one first and marked. *Why:* nothing is cut off and two games can be read against each other.
- **Two doors, clearly apart.** "Start one" (a recommended game, one tap, everything changeable after) and "Make your own"
  (twists, scoring, moments, bets, Describe a game, Surprise me). *Why:* Andrew wants the first and Conor the second, and
  today each wades through the other's controls. *Cost:* the tinkerer's door needs its own shape; it's most of the work.
- **Every option says what it closes.** As "Nobody can join once the draft starts" does since BACKLOG 68: a consequence that
  can't be undone later is said at the moment it's chosen, never discovered. *Cost:* words, kept to one line each.
- **One wizard.** The older list's cases (a season that's aired, a sport's season, Run it back) move in (BACKLOG 42), so there's
  one way to start anything.
- **Measure it blind.** Before building: three people who haven't seen it each try to start a named game ("Outlast for the
  rest of the season") and a vague one ("something easy for tonight"); count taps, wrong turns and what they say aloud.

## The waivers' result offers the new one the empty slot

- **Idea.** When a move you made leaves a gap in a lineup you'd saved (BACKLOG 69: someone let go leaves the lineups set for the
  weeks after), the result that tells you the move went through also says "Start <the one you got> in their place?", one tap.
- **Who, when.** Anyone whose swap or replacement just ran, reading its result; most of all Joanna, who won't go back to the
  lineup page.
- **Why.** The gap is right (the one brought in shouldn't start by itself: you may want someone else from the bench), but it's
  a second errand created by the first. Today it shows only as a lineup that's due.
- **Cost.** A waiver run is read later, by people who weren't there when it ran: the offer has to work from the result's line,
  for the episode that's open then, and say nothing once the lineup's been set again.

## For the game UI/UX overhaul: what's already waiting (the user, 2026-11-14: "I certainly plan on a big game UIUX overhaul")

An index, so the overhaul starts from what's known and nothing here is patched onto screens that are about to change. The
inputs live in four places:
- **The explorer plan's "Designs needed"** ([PLAN-GAMEPLAY-SCENARIO-EXPLORER.md](PLAN-GAMEPLAY-SCENARIO-EXPLORER.md)): 34 screens
  or states the generated games need and the app doesn't have, each found by playing a game through. Head to head first (item 3).
- **This file:** the ideas above; "Start a game, redone" is the wizard's share of the overhaul.
- **The fresh-start brief** ([APP-REVIEW-DESIGN-BRIEF.md](APP-REVIEW-DESIGN-BRIEF.md)) and AGENTS.md's "UI/UX review direction":
  the intended experience, and the rule of one page with its states, then a pause for review.
- **The backlog**, read on 2026-11-14 for what's UI/UX. Sorted by what an overhaul means for each:

**Wrong on screen today: fix whenever, the overhaul keeps the fix.** These are facts and words that come from the page's
model (`game-page/model.ts`, `game-view.ts`, `game-sheets.tsx`'s lines), which a redesign reuses; none is a layout.
- 51: an Outlast in reverse says "Fewest points wins" beside a table the most points lead.
- 49: with hits counted once each, the season grid and the week add up to more than the standings.
- 47: someone cut from a draft is still asked for a lineup (the move is the fix; what the page shows in its place is design).
- 55: a pool's skipped night reads "No pick · missed".
- 59: after Undo, Backstage and the players are still told when the week will run.
- 66: the reveal doesn't open over a game's own page.
- 61: someone behind is shown when the next stage starts and who's on their team there. A spoiler, and data not layout: first.
- (53, a pool's mulligans counted backwards: fixed 2026-11-13.)

**The overhaul's own: don't patch these onto today's screens.**
- 46 (PRIORITY): head to head's missing screens: who you play this week, the playoffs' bracket and champion, quiet nights.
- 40: what the generated game page left: no screen names a captain; an auction's spend; a game in stages shows no block for
  the stage that's on; the bracket control; the engine's words reading wrong on the page; no way from the dock or Your moves to
  a game's page.
- 42 and "Start a game, redone": the wizard, and Start a game being the same everywhere (three starts still use the old list).
- 43: sports' screens (the quick changes "Coming for sports", a sport's own words for an episode, Watch along on a team).
- 33 (a, b): sheets that draw a slot's group; a pool's sheet stepping through episodes; an Outlast's what-if.
- 67: a draft that opens mid-season while someone's behind (a flow, and the user's to rule on).
- App-wide, to do once on the new screens, not twice: 12 (the phone's back closes an open sheet), 34 (the optional button's
  faint edge and 40px height), 35 (the welcome page's faint "Nothing on"), 22 (where What's New lives), 38 (the tour follows
  the screens it teaches), 3 (a "you're all set" confirmation), 4 (one leaderboard across linked games).

Everything else in the backlog is engine, data or operations, and doesn't wait on a design.
