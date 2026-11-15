# Episodes and the reveal, first view: requirements (step 4)

Mode 2 derivation on [the page spec](step4-episodes-spec.md), at 390 × 844, building on Phase 0's app-wide
[R1–R5](phase0-first-views.md) and step 3's [Tonight requirements](step3-tonight-first-view.md). Today's frames:
`.ui-atlas/stories/step4-episodes/before/` (the zt couch with real art: `episodes-alex`, `episodes-sam`, `episode-page-alex`,
`progress-chooser-sam`, `watchonly-riley-episodes`, `reveal-sam-1..3`), each with its measures in the `.json` beside it.

## The problem

Someone opens Episodes to see where they are in the season and what they've missed, without being spoiled; or a push lands them
on a reveal; or they tap into one episode for everything that happened. Today Episodes' first view for Sam (two behind) says the
reveal three times (a white plate "Final results are in", and Reveal on rows 5 and 4), the next episode twice (the bar's chip and
"Episode 6 · This week"), and the spoiler mark in a teal banner. An episode's page opens on Replay the reveal, its most
dispensable action. The reveal opens on two text slides on black ("Previously on the couch") and, with no GIFs yet, a slide that
is an empty dashed box.

## L0 · Cognitive load

**Constraint.** Working memory holds three to five chunks, and unattended noise spends it.

**Violation.** `episodes-sam`: 13 controls, 124 words, 11 type sizes in the first view; the reveal is three chunks of its own
(plate, row 5, row 4) and the next episode two (chip, This week block). `episode-page-alex`: 205 words and 18 controls in 1.3
screens, the first chunk a replay button. The reveal's last beat (`reveal-sam-3`) stacks Share, Reveal Episode 5 and Back under a
table: three exits at once.

**R1.** Episodes' first view holds four chunks at most: the show and your place (the bar with the compact control), what's yours
to set (the strip), what's next or waiting (one row each), and the top of what you've seen. Each fact once: the reveal in the
control only (a waiting row may open the same reveal, but says no second "Reveal"); the next episode in its row only. At most
five type sizes and 60 words above the fold on Episodes (a list carries more words than Tonight's header; names on faces aside).
An episode's page leads with the episode (who left), never a control. A reveal beat is one chunk; the end offers one primary
action and at most two quiet ones.

**Citations:** Cowan (2001) for the three-to-five chunk ceiling; Sweller (1988) for split attention across repeated forms.

## L1 · First impression

**Constraint.** Appeal and meaning are judged in about 50 ms, and that judgment switches attention on or leaves it off.

**Violation.** The reveal's first 50 ms is black with white type: nothing says which show or that something good is coming, on
the app's one showcase moment (PRODUCT.md 13: "a visual 'last time on' recap"). On Episodes the brightest thing for Sam is the
white reveal plate, but for Alex (caught up) it's the show's art thumbnail in a block that repeats the next episode's time.

**R2.** The reveal opens on the show's art, full bleed, with its name and the episode: identity first, then the moment. Each game
beat's anchor is its result drawn as data (signed bars, a face that survived, a team still in), not a sentence. On Episodes the
brightest element is the one waiting reveal when there is one (the control's yellow), else the faces of who left on your latest
row: people, not a block of metadata.

**Citations:** Lindgaard et al. (2006) for the 50 ms judgment; Reber, Schwarz and Winkielman (2004) for beauty as fluency.

## L2 · Processing fluency

**Constraint.** What is easy to process feels true and trustworthy, and inconsistency across one surface erodes that.

**Violation.** Progress has a third form on Episodes (the teal "Spoiler-safe · up to Ep 3 · Change" line) beside step 3's
control. "Final results are in" is a white plate at the top and a striped row lower down: the same state, two looks. Top scorers'
"+4.5" on the episode's page is one game's scoring shown as the show's fact. Where you are is a stepper on a show you watch and a
paragraph on a show you play: one place, two forms.

**R3.** One form per fact across tabs and depths: the compact control is the show's mark on every tab but Tonight; an episode is
the same row on Episodes and in Where you are, and the same card (who left, your night) on Tonight's Last time and the episode's
page. A game's points appear only labeled as that game's. Words follow the step 3 template: "Ep N" then what's true.

**Citations:** Reber, Schwarz and Winkielman (2004) for fluency read as truth; Alter and Oppenheimer (2009) for disfluency
signalling error.

## L3 · Prediction

**Constraint.** People act on what they expect; a surface that breaks its entry's promise costs a re-read.

**Violation.** A push "Ep 5 results are in" opens a reveal that begins "Previously on the couch", not the show or the episode. A
row reading "Final results are in · Reveal" predicts a per-episode reveal; it is really the season's next reveal, every game, Ep 4
first. Where you are on a played show answers "change your mark" with "you can't", and no way on.

**R4.** Every way in meets its promise in the first view: Episodes → your place and what's waiting; a results push → that
episode, named, with every game it covers said before the first result; an episode's row → that episode's page with who left on
top; Where you are → your mark and how it moves (the boundary; or, on a played show, the reveal that moves it).

**Citations:** Clark (2013) for prediction error drawing attention; Bar (2007) for the proactive brain matching gist to
expectation.

## L4 · Decision

**Constraint.** A decision costs effort in proportion to its options and their ambiguity; defaults and named consequences cut it.

**Violation.** On Episodes Sam has three ways to reveal and no word of their consequence at the point of choice (every game, Ep 4
first). The reveal's end puts Share, Reveal Ep 5 and Back as three buttons of near-equal weight. Where you are (watched show)
moves the mark one step at a time with no preview of what will show.

**R5.** Each decision offers one instinct path and names its consequence: Reveal Ep 4 says "every game" on it; the reveal's end
has one primary (Reveal Ep 5 when it's out, else Back to the show) with Add your GIF and Share quiet; Where you are's Save names
the result ("Save · through Ep 5") before it's tapped, and a row tap moves the boundary to that row in one step.

**Citations:** Iyengar and Lepper (2000) for choice overload; Johnson and Goldstein (2003) for defaults carrying decisions.

## R1–R5

- **R1** Four chunks; each fact once (the reveal in the control); ≤5 sizes, ≤60 words on Episodes; a page leads with content;
  a beat is one chunk; the end has one primary.
- **R2** The reveal opens on the show's art; game beats lead with drawn data; Episodes' brightest is the waiting reveal or
  who left.
- **R3** One form per fact: the compact control on every tab; the shared episode row and card; a game's points always labeled.
- **R4** Each way in meets its promise in the first view; the reveal says every game it covers before the first result.
- **R5** One instinct path per decision with its consequence named; Save says the result.

## The solution these require

- **Episodes:** the compact bar with the control's line ("Through Ep 3 · 2 behind" · Reveal Ep 4 · every game), the strip, a
  Next row (number, when, readiness), one folded Waiting row with no button word, then Seen rows. No spoiler banner, no This week
  block, no plate. Rows keep their face, result word and couch faces; the legend sentence goes.
- **The episode's page:** the OUT plate first, then what happened, the couch (GIFs, Discuss), your games each in its own measure
  (top scorers under Weekly Lineup, labeled), Replay at the foot.
- **The reveal:** beat 1 the show's art with "Last time on", the episode, and "Every game: …"; the GIF beat only when there are
  GIFs; a beat per game with its result drawn (signed bars for a lineup on one scale); the table moving; the end with one primary.
- **Where you are:** the ledger: grouped rows, the boundary a line, a tap moves it, Save names the result; on a played show the
  boundary fixed and the reveal as its one action.

## Tested against today, and against the spec

| | R1 | R2 | R3 | R4 | R5 |
| --- | --- | --- | --- | --- | --- |
| Episodes today | fails: the reveal ×3, the next episode ×2, 124 words | partly: the plate is bright, the art block isn't news | fails: a third progress form (teal banner) | partly: the rows promise a per-episode reveal | fails: three reveals, no consequence |
| Episode page today | fails: opens on Replay | passes: the OUT plate's photo | fails: a game's points as the show's | passes | passes |
| Reveal today | passes per beat; fails at the end (three equal exits) | fails: text on black | passes | fails: "every game" is never said | fails at the end |
| Where you are today | passes | partly | fails: two forms | fails on a played show | partly: no preview |
| The spec | passes | passes | passes | passes | passes, with Save's words |

## The gap

Nothing today says what a reveal covers before it plays, and nothing draws a game's result at the reveal; the spec adds both.
What no design here closes: a head-to-head beat can't show the opponent's lineup until the reveal's data carries it (the spec's
open question).

> *Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
