# Add a show or team: first-view requirements (Perception-First Design, step 2)

On [the spec](search-spec.md). PFD `solve`, once, bottom-up. Each requirement is a must; lower layers win a conflict. The first
view is the sheet at 390 × 844 with the keyboard down: the title, the field, the scopes and roughly 420 px of results.

## The problem

Someone types a name and wants the thing they meant. Today the sheet answers a different question ("which TV listings hold these
words?"), so a fan reads ten rows of shows before learning the app knows teams at all, and nothing tells them what a result will do.

## The layers

**L0, load.** Working memory holds three to five chunks (Cowan 2001, 2010), and repeated noise is paid for even when it's not read
(Hassin et al. 2009). Today's "eagles" first view is ten rows, each with a poster, two lines and the same "NOT A GAME YET" chip:
ten chunks and ten identical tags, none of them the answer.
**R1. The first view of results holds at most four chunks: one card or none, then the start of one group. A label said by every
row of a group is said once, as the group's name** ("From the TV listings", not a chip on each). Groups under a card show three rows
before "More"; the scope switch is chrome, quiet enough not to count as a chunk.
*Citations:* Cowan (2010) for the three-to-five chunk limit; Hassin et al. (2009) for unattended noise spending working memory.

**L1, the first glance.** A screen is classified in about 50 ms, before a word is read (Lindgaard et al. 2006), and classification
precedes evaluation (Leder et al. 2004). A team that comes back as a text row looks like a TV listing; nothing pre-verbal says
"sports".
**R2. A sports result is recognisable before it's read: team marks and the scorebug's fixed right column (time, or the score
through its ask), live as the only red. At most one card, no taller than 40% of the results area** (about 190 px), so the eye
sees that more results follow. Team colour only on the marks.
*Citations:* Lindgaard et al. (2006) for the 50 ms judgement; Leder et al. (2004) for classification before evaluation.

**L2, fluency.** What's easy to process reads as true and trustworthy (Reber & Schwarz 1999; Alter & Oppenheimer 2009); felt
consistency matters more than any single row's polish (Forster, Leder & Ansorge 2013). Today a game's time is "Thu, Mar 25 12:00
AM" here and "TBD" on the team's page; Follow is a pill on a league row and absent on a team's; "v" here, "at" and "vs" elsewhere.
**R3. One form per kind everywhere it appears: the card's game is the shared scorebug, Follow is A3's toggle, a game's words are
the team page's ("TBD" for an unset time, "Season starts Mar 26" off-season, "at" and "vs"), a league is named as its page names it.
First run and Add draw the same rows.**
*Citations:* Reber & Schwarz (1999) for fluency read as truth; Alter & Oppenheimer (2009) for its spread to trust.

**L3, what people predict.** People act on prediction and attend to violation (Clark 2013), and trust is a perceptual output
(Seckler et al. 2015). Every search a fan has used (their phone, a sports app) puts the Eagles first for "eagles"; a Swedish drama
first is a violation that reads as "this app doesn't do sports", and the prior sticks for every later result. "Add a show" predicts
shows only, so the fan never types a team.
**R4. The first result is what most people typing those words mean: a show here (on the app) first for a show's words, a strong
team, matchup or league first for theirs, never a TV listing above a strong sports meaning. The entry and the field name teams
("Add a show or team", "Shows, teams, leagues"). The scopes are never needed to get the right first result.**
*Citations:* Clark (2013) for prediction and violation; Seckler et al. (2015) for trust as a perceptual output.

**L4, the decision.** Simplify the decision point, not the workspace; match the words to how near the commitment is (Trope &
Liberman 2010); show rather than describe (Hertwig & Erev 2009). Search is a finding step: the commitments (start a game, add a show
with where you are) belong to the screens it leads to, which already ask them well (B4's sheet, Where are you).
**R5. A result has one way in (the card or row opens its place) and at most one reversible action (Follow, or first run's Pick).
No yellow fill in search: nothing here commits. The card shows the next game itself (the bug), so "should I follow / play?" is
answered by what's on, not by a description. Nothing in a result that can't be done (an event tour has no action until it has a
place).**
*Citations:* Trope & Liberman (2010) for concrete words at near commitments; Hertwig & Erev (2009) for showing over describing.

## R1 to R5

1. At most four chunks in the first view; a group's shared label said once; three rows under a card before More.
2. Sports read as sports pre-verbally (marks, the bug's right column); one card, at most 190 px.
3. One form per kind across the app (bug, Follow, game words, league names); first run the same.
4. The first result is the likeliest meaning; never a listing over a strong sports meaning; entries name teams; scopes optional.
5. One way in and at most one reversible action per result; no yellow; the card shows the game; no dead actions.

## What satisfies all five

A card for a strong sports meaning built from parts the app already draws (the mark, the bug, A3's Follow), its own tap opening the
place and its bug opening the game's sheet (R2, R3, R5); ranking that puts shows here, then strong sports, then TV listings (R4);
TV listings under their own name with the chip gone (R1); three rows under a card (R1); the scope switch as quiet text tabs (R1).

## The spec's proposals against R1–R5

- **The card**: passes, if it stays one card with the couch line on one line (R2's height). Two Follow-like controls on it (Follow
  and Play) would fail R5: Play lives in the bug's sheet, as the spec has it.
- **Five shows under a card**: fails R1 (the first view ends after three). Three, then "More shows · 7".
- **"NOT A GAME YET" on every listing** (kept by the spec as step 10's rows): fails R1. The listing group's name carries it.
- **Scopes as a segmented switch**: passes if it's quiet (text tabs with an ink rule on the chosen one, B1's chosen-chip rule), not
  three filled pills competing with the card.
- **Sports' league tiles before typing**: passes at eight tiles in a 2 × 4 grid (one chunk: "the leagues"), with the couch's teams
  as the second chunk.
- **The matchup card's Play**: the card opening B4's sheet passes R5 (one way in); a Play button on the card would duplicate it.
- **Event tours listed with no action**: passes R5 only if the row doesn't look tappable (no chevron, no press state) and says why
  in its second line.

## The gap

The spec's empty state ranks the couch's shows first and teams second in All; for a person whose couch is mostly sports, the
teams group would sit under four posters. **The couch's own mix decides the order** (whichever the couch has more of first), so
the first chunk is the likeliest one. And the spec says nothing of **ESPN not answering mid-typing**: the sports part must say so in
one line rather than silently ranking shows first (R4's trust prior).

## First views, per situation (in the eye's order)

- **"eagles"**: the field · the Eagles' card (mark, name, NFL, couch line, the bug, Follow) · Shows: three, More · (Teams below).
- **"eagles cowboys"**: the matchup card (both marks, "Their next meeting · Thu Nov 26", the bug) · each team as a row.
- **"nfl"**: the league card (mark, name, "Week 12 · 4 on now", Follow) · From the TV listings: three, More.
- **"survivor"**: Survivor 51 (here, Ready) · the rest of the shows · no sports.
- **Empty, Sports**: Leagues, eight tiles · Your couch follows, three rows.
- **First run, "eagles"**: the card with Pick instead of Follow, no couch line.
- Not in any first view: a score in a row, a record while hiding, a second card, a yellow fill.
