# Sports as a place you follow: the shape brief (Impeccable, step 3)

On [the spec](sports-space-spec.md) and [the first-view requirements](sports-space-first-view.md). Mode: Operate. The committed
world: Lower Third on Night (DESIGN.md). Idea mocks only; nothing is built. Shape's interview round was skipped because the user
asked for ideas to react to: the open choices are drawn as alternatives instead, and assumptions are marked.

- **Job:** a fan is one tap from their league and teams on the hub, and two taps from a game on anything not yet started.
- **Real content:** the Eagles' 2026 schedule and results as ESPN listed them on 2026-11-16 (2–7, bye in Week 10, Steelers on Sun
  Nov 22, at Cowboys on Thanksgiving); the NFL's real Week 11 slate; the 76ers' December. The scene is Sunday Nov 22, 2:40 PM ET.
  *Assumed and marked:* live scores, the couch's picks and chat lines are made up (no game has been played yet).
- **The shared game row:** two stacked team marks (the TeamMark tile) with short names, scores or the time right-aligned in
  `type-num`, status under the time (Q3 4:12 in live red, Final, 4:25 PM · CBS), then the couch: up to three faces and a chat
  count. Upcoming rows end in an outlined Play. The row is 56 px, two lines.
- **League card on the hub:** a panel like a show poster but without art: the league's caps name and the week, your team's game as
  the shared row, a muted line for your games, a muted line for the rest of today. Live gets the red tag, nothing else is red.
- **League space:** the show space's bar (Home, the name in caps, Follow state, gear), tabs as today's show tabs, Scores' week
  switcher as a quiet segmented row with arrows. Sections are caps headings over hairlines, no boxes (DESIGN.md).
- **Team page:** the team plate (white caption plate, team colour on its slanted end, as today), record and Follow under it, then
  the live game, Up next with Play, and the schedule by month. W is a teal tag, L a quiet outlined tag, Bye a dashed row.
  **Month** view: a seven-column grid, each game day a team mark (outlined for away), today ringed in chyron line, groups (a
  homestand, a road trip, a pair) as a bar under their days and as rows under the grid.
- **Search:** the field, then a three-way segmented scope. The rich card for a strong match is a caption plate in team colour with
  the live or next game row inside and two buttons (Follow outlined, the second the one yellow when it starts something).
- **Play sheet:** the matchup plate, four type tiles in a 2×2 (Pick'em outlined in chyron line as chosen), "Go bigger" rows, the
  couch line with its switch, a footer with the sheet's one yellow, Start Pick'em, and the lock line.
- **Anti-goals:** no new colours; one yellow per view; team colours only on marks and the plate's end; no VS graphics; no
  countdown urgency; no logos (marks are abbreviations, as the app's TeamMark).
