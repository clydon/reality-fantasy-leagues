# Sports as a place you follow: first-view requirements (Perception-First Design, step 2)

On [the spec](sports-space-spec.md). PFD `solve`, once, bottom-up. Each requirement is a must; lower layers win a conflict.

## The problem

A fan wants their team's game, the couch's talk about it, and a game on it. Sports wearing a show's clothes make them read words
to find that: a follow that shows nothing, a game that becomes a poster, a team that comes back as a listing.

## The layers

**L0, load.** Working memory holds about four chunks (Cowan 2001, 2010), and noise costs bandwidth even unattended (Hassin et al.
2009). Today one Eagles game can be in three places on the hub, and each added game is another poster.
**R1. Each league is one chunk on the hub, and a game appears once on any screen.** A league card holds at most three lines inside
it (your team's game, your games, the rest of today). Any sports screen's first view holds at most four groups.
*Citations:* Cowan (2001) for the four-chunk limit; Hassin et al. (2009) for unattended noise spending working memory.

**L1, the first glance.** A screen is classified in about 50 ms (Lindgaard et al. 2006), before any word is read. The team sheet
opens on "A team", a big yellow plate and eight W/L tiles; the league sheet opens on a sentence about episodes.
**R2. Sports screens lead with the schema sports fans already read: two team marks, score or time in a fixed right column, live as
the only red.** The title is the team or league's own name.
*Citations:* Lindgaard et al. (2006) for the 50 ms judgement; Leder et al. (2004) for classification before evaluation.

**L2, fluency.** What's easy to process feels true and trustworthy (Reber & Schwarz 1999; Alter & Oppenheimer 2009). A game is an
episode in one place and a game in another; a final looks different on the hub, the guide and the team sheet.
**R3. One game row everywhere** (hub card, Scores, a team's schedule, search, the Play sheet): the same layout, the same spoiler
treatment ("Final · Show score" when hiding), the sport's own words (Week 11, game, series, bye), never "episode".
*Citations:* Reber & Schwarz (1999) for fluency read as truth; Alter & Oppenheimer (2009) for fluency's spread to trust.

**L3, what people predict.** People act on prediction and notice violations (Clark 2013); trust is a perceptual output (Seckler et
al. 2015). Fans predict a sports app: favourites up top, a scoreboard by day, a team's page with its schedule. "Add a show" predicts
shows, so a fan won't try a team there; Follow changes nothing they can see.
**R4. Every follow shows its result where people predict it (the hub's list), and every entry names sports** ("Add a show or team",
search placeholder naming teams). Team and league pages keep the convention's order: name, live or next game, schedule or scores,
then depth.
*Citations:* Clark (2013) for prediction and violation; Seckler et al. (2015) for trust from visual coherence.

**L4, the decision.** Simplify the decision point, not the workspace; match words to how near the commitment is (Trope & Liberman
2010). Starting a game on Thursday's game means choosing a scope and a type across two screens.
**R5. From any game row, the game is the scope: one sheet, Pick'em chosen, Start two taps from the row.** Other types beside it,
bigger sizes one row below, what the couch hears said before Start, concrete words ("Picks lock at kickoff, Thu 4:30 PM"). No
countdown pressure. The Scores and Players tabs stay dense for the sweat.
*Citations:* Trope & Liberman (2010) for concrete words for near actions; Hertwig & Erev (2009) for showing over describing.

## What satisfies all five

A league card on Your shows (R1, R4), a shared game row (R2, R3), a league space that opens on Scores (R2, R4), a search whose first
result for a sports query is a card in the same row language (R2, R4), and the Play sheet from any row (R5).

## The proposals against R1–R5

- League card: passes, unless both a sports section and the cards exist (R1). Alternative B's rail fails R1 by adding a section.
- League space: passes with Scores as the default tab; five tabs match the show space's count.
- Team page: passes with List as the default; a month grid alone fails R1 at 30 cells of small marks, so it's the second view.
- Search: passes when the rich card leads only for strong sports queries; shows lead otherwise.
- Play sheet: passes.

## The gap

None of the proposals put **the couch** on a game row: who's watching it and how much they're saying. The product's social third
needs it (R4: follow's payoff is also people). Every game row carries up to three faces and a chat count, and the count opens that
game's thread.

## First views, per surface (in the eye's order)

- **Hub card:** league name and week · your team's game (marks, score or time) · your games in one line · the rest of today.
  Not: standings, other teams' records, a second yellow.
- **Scores:** week or day switcher · your team · live · later today. Not: your games' detail (that's Games), odds.
- **Team page:** plate and record · live or next game with Play · the month's schedule. Not: the season's first half (folded).
- **Search, sports query:** the card (plate, live or next, Follow or Play) · other matches. Not: shows above a strong team match.
- **Play sheet:** the matchup and time · the game types · Start with its lock line. Not: settings (they're in Game settings).
