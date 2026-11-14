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
