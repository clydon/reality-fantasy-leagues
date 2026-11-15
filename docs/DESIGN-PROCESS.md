# How a design is made here: the three skills, in order, and the screenshot story

The user, 2026-11-14. Every session (Claude Code or Codex) follows this for UI design work. It exists so the three design skills
never contradict each other or argue in a loop, and so every design reaches the user as something they can look through. The
round's frame (what's covered, the five lenses, the three flavors, inspiration, the lay-of-the-land and busy tests) is in
[the packet](DESIGN-ROUND-PACKET.md), "The round's frame".

## The three skills

Installed 2026-11-14 as user-level Claude Code plugins: `intent@intent` (ghaida/intent, v1.7.4) and
`perception-first-design@perception-first-design` (skovalik/perception-first-design, v0.7.0), beside `impeccable` (a user skill).
They load in a new session; check they're listed before claiming one was used, and if one isn't, say so.

Each owns one question, runs at one point, and hands one thing to the next:

| Step | Skill | Owns | Use | Hands on |
| --- | --- | --- | --- | --- |
| 1 | **Intent** | Structure: the page's one job, its situations and lenses, what's on the overview and what goes deeper, the flows and return paths, no dark patterns | `/intent` to set context, then `journey`, `organize` and `specify` as the page needs (not `wireframe` or `present`: Impeccable draws, and the story presents) | **A page spec**: the job; per situation, the content in rank order; each drill-down and its return; what's left out and why |
| 2 | **Perception-First Design** | Perception: what's noticed first, cognitive load, the five-second test, the casual path against the sweat's | `/perception-first-design:solve` on the spec (before building) | **First-view requirements**: what must be in the first phone view, what must not, the order the eye takes |
| 3 | **Impeccable** | Visual and interaction craft, and the code | `shape`, then build in the committed visual world, then `critique` | **The page**, built on the real app |
| 4 | **Check** | | PFD `evaluate` and Impeccable `critique` on the built page, **once each**; the bench's situations and page checks | **Findings**, fixed in **one** batch |
| 5 | **The user** | Judgement | The screenshot story (below) | Their decision |

**Not a repaint: the structural lens** (the user, 2026-11-15). Every round asks of every surface it touches, and of every level
you can drill to from it, "will repainting be enough, or does this need new sections, new screens, new ways to display the
data?" It's Intent's question, answered in the page spec before anything is drawn:
- **The drill tree, to its deepest level.** From the page down: a matchup, a person, a cast member or athlete, an episode, a
  stat. For each level: the questions people bring to it (the casual player's and the sweat's), the data the engine and the
  views already hold for it, the form it takes today, and a verdict: **keep**, **repaint**, **restructure**, **new display** (a
  chart, a table, a comparison) or **new screen**. "Keep" needs a reason, never a default.
- **Data shown with joy is designed, not inherited.** Weekly graphs of a person's points, a cast member's or athlete's stats by
  week, a season's matrix and trend are first-class parts (the chart part, Phase 0's decision), drawn where they live.
- **The story shows the drill levels too,** not only first views: each level the round touched, before and after, and the ones
  it kept with why.

**What every round carries** (the user, 2026-11-15, reviewing the game page's steps 2 to 2c). These are intent, like the round's
frame: open to pushback with the reasoning, never quietly designed around.
- **Data first, compared side by side.** A game is read through its numbers, and a number means most beside the one it competes
  with: "think typical fantasy football; a person may want to see their matchup and see how their QB compares against their
  opponent's." Wherever two things compete (two lineups, two players in a slot, two people's seasons, this week against the
  last), the comparison is a designed display: read across, on one scale, in one pair of colours. Never two lists to reconcile in
  your head. Expressive data, not decorative slogans or VS graphics (the 2026-11-12 direction).
- **Show the whole game, not only your part.** "Is there any view into the starters/bench? Don't you think there's game value in
  seeing that aspect. Include other head to head matchups across the league?" Starters and bench on both sides (theirs from the
  lock), and the league's other games that week: the game lives in what everyone else did too.
- **Drill down from everything, each level with its weekly graph.** "I could drill down into a player and see their total points
  graphed weekly. Or click into a cast member/athlete and see their relevant stats graphed weekly. And so on." Every person, cast
  member, athlete, matchup and episode opens a level, and each level graphs its numbers week by week (the drill tree above).
- **A game's scoring lives inside the game.** "The main show's tab shouldn't have scoring from a particular game, but within a
  game we may need tables with the game's scoring." The show's tabs show the show's own facts; inside a game, tables in that
  game's scoring: one stat table with three lenses, the show, the game and the matchup (`docs/design-round/step2c-compare-and-scoring.md`).
- **Judge a design on a real game.** "So I can see what a real game would look like": a round's frames carry real content
  wherever it exists, for each game type: a real season's cast and photos, the show's art, and real athletes with their
  headshots, teams and box scores. The bench's generated worlds still cover the situations real data can't reach (a champion,
  a tie, a long name, someone behind).

**What wins when they disagree:**
1. The user's own words and settled decisions (the frame, the brief, recorded decisions) beat any skill.
2. Then each skill wins inside the question it owns, and only there:
   - Intent on what's on the page and where things live;
   - PFD on what comes first and how much is at once;
   - Impeccable on how it looks and moves.

   A skill's opinion outside its question is advice, not a veto.
3. A disagreement that would change what the user experiences, and that the rules above don't settle, goes to the user as a named
   choice with both sides. It isn't settled by running another pass.

**Bounded: no loops.**
- Each skill runs once per page per round, in that order.
- The check (step 4) runs once, the fixes once, and at most one confirming look.
- No skill re-reviews another's output to settle an argument, and a skill is never run again because the last run disagreed.
- If the confirming look still finds a problem, it's listed in the story as open, not chased.

**When not to use them.** Intent's and PFD's descriptions match almost any design or writing task, but they're for design work on
a page or flow. A small UI change (words, a fix, a TEMP-UI screen) goes through Impeccable alone, as CLAUDE.md asks. Don't invoke
Intent or PFD for docs, code reviews or backend work. `ui-ux-pro-max` is also installed: keep it out of the round, so two visual
rulebooks don't conflict.

## The screenshot story (every design, for the user)

A full UI is never set and moved on from. Besides the bench's checks, every design reaches the user as a **screenshot story** they
can review on their own, phone or desk:
- **Before and after**, side by side where there's a before (the bench's situations give today's page in each: `.ui-atlas/situations/`).
- **Each situation that matters**, at 390 px first: the lenses (own pace, shared, exclusive, stages, spoilers) and the flavors
  (competition, sports, story) the design claims to handle.
- **The flows as sequences**: tap, sheet, back, the same unsaved choice still there; a move made; a reveal.
- **A caption on each frame**: what you're looking at, which situation and lens, what changed and why, and what was judged there
  (the lay-of-the-land and busy tests: what's first, taps to what matters, the casual path and the sweat's).
- **What's open**: findings not fixed, choices for the user, anything simulated rather than real.

Build it from real renders (the bench's live tier, the app at 390), never mocked pixels. Save the frames under
`.ui-atlas/stories/<design>/`, and publish the story as a private Artifact page for the user, with the link in the reply. Then
pause for their review before extending the design (the brief's rule).
