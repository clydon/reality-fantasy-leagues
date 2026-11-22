# The hub's scores strip and the league card: the shape brief (Impeccable)

Idea round 3, 2026-11-22. The user, on round 2's hub: "I do not want to rename the hub's section to your shows and sports, it
should just be your shows as is. I also want the hub's section to be less tall, and a smidge more subtle. A game/team you're
following will show up as upcoming and live right below the guide. But it won't be taller than the guide bar. So if there's
multiple it'll be swipable or scrollable and an indication there's more. Use impeccable to design a bold sports app-like scorebug."
Impeccable, extending an existing surface (new-work.md §3: inherit the world, no concept tournament). The structure is the
user's own words, so Intent and PFD weren't rerun. The confirmation round was skipped: assumptions are marked below and in the story.

## Job

Your teams' games, live and coming up, readable in a glance from the hub: score, clock and where the game stands, like a
broadcast's scorebug, without pushing Your shows down.

## Where

- **Right below the guide bar** (`OnTvRow`, src/new/hub/guide.tsx:722), before Your shows, in `Middle` (src/new/screens/home.tsx).
- **88 px tall, exactly the guide bar's height.** It never grows: more games scroll sideways.
- It replaces the Scoreboard inside Your shows (src/new/hub/bands.tsx:215, the "Games" row of 164 px cards), and the On TV reel
  drops its sports minis (`SportsMini`, guide.tsx:670) so a game appears once.
- No games to show: the strip isn't drawn.

## The strip

A panel like the guide bar (`bg-card`, 4 px corners) with the guide bar's own composition:
- **A lead tile, 84 px**, its right edge slanted like On TV's: "SCORES" in caption caps (20 px) and a count line, "2 live · 5"
  (the live part in live red, with its dot). The count is the "there's more" the user asked for. A tap opens all your games in a
  sheet, by league. *Assumed:* "Scores" over "Games", because Games already means the games you play.
- **The bugs**, a scroll-snap row behind the tile's slant (as the guide reel runs), the next bug peeking about 40 px past the
  edge under a fade. Swipe, or scroll with a keyboard; each bug is one button.
- **Which games:** games of the teams you follow, games you play (a pick, a lineup, a draft: the couch's Pick'em puts its games
  here), and your team's rivalries. Order: live, then just finished, then today's by kickoff, then each of your teams' next game.
  A final stays until you've seen it (the 2026-11-15 rule: Show the score or Watch it as if live), at most 36 hours.

## The scorebug (196 × 72 px)

A broadcast bug in the app's own graphics: the raised panel, two team rows and a status column.
- **Team row (30 px):** a 4 px slab of the team's colour down the row's left edge (a tag, never a fill); the abbreviation in
  caption caps (18 px); up to two couch faces (16 px) of who follows that side; the score in caption numerals (26 px), the
  trailing side muted. **Possession** (football) is a small bone triangle beside the score.
- **Status column (56 px)**, behind a hairline: live is the period and clock ("Q3", "6:41") over the situation ("2nd & 7");
  coming up is the time ("4:05", "PM") over the network ("FOX"); a later day is the day and date over the time; over is "FINAL".
- **Live** gets a 2 px live-red rule along the bug's top edge and a pulsing dot (still under reduced motion). Nothing else is red.
- **Coming up** shows each team's record where the score goes, muted, and the line in words under the network ("LAC by 3").
- **Yours:** your face on your team's row; a 2 px chyron underline under the team you picked; the games mark (the controller)
  with its due dot when a move is due.
- **Hidden** (Hide sports scores, or watching as if live): no numbers; the status keeps the clock or "FINAL", and a "Show" chip
  sits where the scores were. A tap asks first, as today.
- **By sport:** baseball's status shows the inning (▲7) with outs and the bases; hockey's the period and a power play; soccer's the
  minute; basketball's the quarter and clock. Golf and tennis get their own bug later (a leaderboard slice, a set score).
- **The words for a screen reader:** "Titans at Cowboys, 10 to 24, third quarter, 6:41, Cowboys' ball, 2nd and 7. Your pick:
  Cowboys."

## The league card in Your shows (less tall, a smidge subtler)

The section keeps its name, **Your shows**. A league you follow, directly or through a team, is one card among the show bands:
- **72 px** (a show band is 126): no art; the league's caps (22 px, smaller than a band's), the week, and the couch's team marks on
  the right; one muted line under it, the couch's headline or your pool ("Pick'em: you're 2nd · 2 picks left today", with the due
  dot when one is due).
- No live score and no red here: live is the strip's job.
- Off-season, one quiet line ("MLB · off-season · Yankees").
- A tap opens the league's page.

## Anti-goals

No new colours, fonts or primitives (team colours as slabs and marks only; live red only for live; chyron only for you); no
sportsbook names, logos or links; no VS slabs; nothing taller than the guide bar; no auto-scrolling ticker (the user, 2026-11-15:
the hub's widgets don't animate on their own).
