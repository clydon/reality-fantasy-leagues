# Following a league (sports-couch A3): the page spec (Intent, step 1)

## The job

Put a league on your shows in one tap, from wherever you meet it (search's league row, the league's sheet), with no team needed;
and, for a fan of two teams in one league, say which is **your team**. A follow's payoff is the league's card in Your shows (A2),
where people already look ([sports-space-first-view.md](sports-space-first-view.md), R4: every follow shows its result there).

## The rules the screens rest on

1. **Following a team follows its league.** A team follow already put its league's card on your shows (A2); now it does so by
   following the league, so one thing answers "is the NFL on my shows?": whether you follow the NFL. Existing team follows are
   carried over as league follows (the migration).
2. **A league follow stands alone.** Follow the NFL with no team and its card is on your shows: the couch's teams there as marks
   (none ringed), A2's line.
3. **Unfollowing a league takes its card off your shows; its teams stay followed** (their games stay on the scores strip and lead
   the guide). One tap back on. No confirm: it's one tap to undo and loses nothing.
4. **A game you play keeps its league's card** whether you follow the league or not: a game lives where it's played (A2).
5. **Your team** in a league is the first team you followed there. With two or more followed there, the team's sheet says which is
   yours and offers the others "Make them your team". Unfollow your team and the next you followed becomes it. With one team,
   nothing says "your team": it's the only one, and saying so adds a line with no choice behind it.
6. **A follow sends nothing** to anyone: no push, no feed line. The couch sees it as your face on the league and its teams.

## Situations, in rank order

| # | Who, when | What they need first | The screen |
| --- | --- | --- | --- |
| 1 | Andrew types "nfl" in Add a show, wants it on his hub, done | Follow on the row itself, no second screen | search's league row |
| 2 | Conor opens the NFL card's sheet from Your shows | that he follows it, who else does, and how to stop | the league sheet, top |
| 3 | A fan of the Eagles and the Lions, the Lions the one he cares about | which is his team, one tap to change it | the team's sheet |
| 4 | Joanna, who followed the Eagles weeks ago and never the NFL | nothing changes: her card stays (carried over) | the card (A2, unchanged) |
| 5 | Someone who follows the NFL with no team | a card that says something without a team | the card (A2's line) |
| 6 | Unfollowing the NFL while following the Eagles, or while playing a Pick'em there | what leaves and what stays | the toast; the sheet's line |
| 7 | Off-season (MLB in November) | the follow works the same; the card is A2's one line | search, sheet, card |

Hiding sports scores changes nothing here: nothing in a follow says a score or a record.

## Each surface and its verdict

**Search's league row (restructure).** Today one button opening the league. It becomes the row (open the league, as today) with a
**Follow** toggle at its end, a separate 44 px target, not nested in the row: Follow, or Following once you do (you follow it
directly or through a team). The row's line says what following gives ("Every game, week by week" today): the line stays, and the
toggle's own state carries the follow. A league search's row is where Andrew decides (situation 1); a second screen to follow is
the step he skips.

**The league's sheet (restructure).** It opens with a follow row, the team sheet's pattern (faces, a line, the toggle), above Your
games:
- the faces: the couch's people who follow the league (directly or through a team), three, yours first;
- the line, the first that holds:
  - following, with your team there: "On your shows · your team, the Eagles" (with two or more of yours there; one: "On your
    shows · you follow the Eagles");
  - following, others too: "On your shows · you and Riley follow it" (two others: "you, Riley and Sam"; more: "you and 3 others");
  - following, alone: "On your shows";
  - not following, a game of yours here: "Your game here keeps it on your shows";
  - not following, others do: "Riley and Sam follow it";
  - nobody: "Follow it to keep it on your shows".
- the toggle: Follow / Following.

**The team's sheet (repaint).** Its follow row gains your team, only when you follow two or more teams in its league: on your team
the line reads "Your NFL team" (with the couch's others: "Your NFL team · Riley follows them too"); on another you follow, under the
line, a text button **Make them your team** (44 px tall). The toast: "The Lions are your NFL team".

**The league card (keep).** A2's design, approved: nothing on it changes. What changes is which leagues get one (your league
follows and the leagues of games you play, instead of your teams' leagues and those games), your team's mark first among yours,
and its "Followed by" line counting the league's followers as well as its teams'.

**Feedback.** Follow and unfollow answer at once on the toggle and with a toast in the team sheet's voice:
- "Following the NFL: it's on your shows";
- "Unfollowed: the NFL leaves your shows" (with a team followed there: "… The Eagles stay followed"; with a game of yours there:
  "Unfollowed. Your game keeps the NFL on your shows").
A failure puts the toggle back and says why, quietly (the team sheet's way).

## Flows and their return paths

1. **Search → Follow:** type, tap Follow on the row; the row now says Following; close the sheet; the NFL's card is in Your shows
   in its place. Back to search keeps the words typed.
2. **Search → the league → Follow:** tap the row; the league's step in Add a show (Back to search above it), Follow at its top.
3. **The card → the sheet → Unfollow:** tap the card; the sheet; tap Following; the toast; close; the card is gone (or stays, a
   game of yours keeping it, as the toast said).
4. **Your team:** the team's sheet (from search, the guide, a game row); Make them your team; the line now says "Your NFL team";
   the league's sheet and card put them first.

## What's left out, and why

- **The league's page** (B1): the sheet stays a sheet; its follow row moves onto the page's bar when B1 builds it.
- **The couch's table by team, rivalries** (B1, C1): they will read your team; nothing here draws them.
- **Event sports' leagues** (golf, F1, UFC): not followable yet; search already shows only team sports' leagues.
- **Following from the strip or the card itself:** the card is the follow's result, and the strip's games are your teams'; neither
  is where someone decides to follow a league.
- **A confirm on unfollow:** one tap undoes it and nothing is lost (rule 3).
