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
