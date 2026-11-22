# How a couch plays sports: first-view requirements (Perception-First Design, step 2)

On [the journey spec](sports-couch-play-spec.md). PFD `solve`, once, on the league card and the league page's This week.

## The problem

A fan opens the NFL to see their team and their friends' teams, and to get into a game in a tap. The page must say who's playing
whom on the couch before it says anything about the league.

## The layers

**L0, load.** About four chunks at once (Cowan 2001). This week holds a strip, a rivalry, a table of the couch's teams, the couch's
rivalries and games, and the rest of the league.
**R1. The first view holds at most four groups (strip, rivalry, the couch's teams, the start of your games), and each team's game
appears once:** inside its table row, never again in a schedule list. A table row is at most two lines.
*Citations:* Cowan (2001) for the limit; Hassin et al. (2009) for noise spending working memory unattended.

**L1, the first glance.** Faces are detected before words (Lindgaard et al. 2006 for the 50 ms judgement). The couch is what makes
this page different from ESPN's.
**R2. Faces and team marks lead.** The rivalry shows its two people with their teams; the table puts each fan's face beside their
team. No VS slab or slogan (the 2026-11-12 direction): the rivalry is read through records, sides and calls.
*Citations:* Lindgaard et al. (2006) for the first impression; Leder et al. (2004) for classifying before evaluating.

**L2, fluency.** One language everywhere (Reber & Schwarz 1999). The table's rows, the rivalry and the card share round 1's side
line: mark, team, fans' faces, the number in `type-num`.
**R3. The table reads as standings (rank, record, form), the rivalry reads as a matchup, and both use the shared side line.**
Records count a tie as half, as standings do.
*Citations:* Reber & Schwarz (1999); Alter & Oppenheimer (2009) for fluency carrying into trust.

**L3, what people predict.** Fans predict "my team first" and standings; friends predict the group chat: trash talk, sides, a
call (Clark 2013). A spectator with no team predicts nothing for them.
**R4. Your team is findable in a glance (your face on it), and every rivalry offers a spectator's way in (Pick a side) that asks
for nothing but a tap.**
*Citations:* Clark (2013) for prediction; Seckler et al. (2015) for trust from coherence.

**L4, the decision.** Simplify decision points, keep depth for the sweat (Trope & Liberman 2010 for near-action wording).
**R5. One yellow per view (the due move, or the challenge's send); Pick a side is two outlined buttons; the challenge says what
the other person gets before it's sent ("Andrew gets one notification"); refusals are plain ("Not this time").**
*Citations:* Trope & Liberman (2010); Hertwig & Erev (2009) for showing over describing.

## The gap

The person **hiding sports scores**. Every one of the page's social payoffs (the table, the rivalry result, the victory lap) is a
result. They need one place to show the week, and until then each payoff reads "Final · Show".

## First views, in the eye's order

- **Card:** the league and the couch's marks · your team's game with your face · the rivalry line · your games.
- **This week:** the strip · the rivalry (two faces, sides, Pick a side) · the couch's teams by record · your games.
- **Challenge sheet:** the game and the two fans · the duel chosen · your call · what Andrew gets · Challenge.
- **A fan's team page:** the plate · whose team it is on the couch and their record of calls · this week's call with Back and
  Fade · the schedule.
