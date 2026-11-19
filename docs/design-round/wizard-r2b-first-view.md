# Start a game, the bold pass: first-view requirements (Perception-First Design, Mode 2)

Input: [wizard-r2b-spec.md](wizard-r2b-spec.md). Screens whose first phone view (390 × 844) matters: the gallery, a base's screen, a
sport's gallery.

## The problem

Someone on the couch wants a game for tonight or the season. To get one they must recognise what each kind of game is, find the one
they mean (by name or by look), bend it to what they want, and start it. In Round 2 every kind of game looked the same (an icon, a
name, a line: 56 times), so recognising meant reading; bending it meant knowing which engine row held the change.

## The layers

**L0, cognitive load.** Working memory holds about four chunks, and visual noise spends it unattended.
- Violation: a shelf of 13 same-shaped squares asks for each name to be read; a base's changes sat behind rows named for the
  engine.
- **R1.** The gallery's first view holds at most five chunks: the field, the ready plate, the saved row, the chips, and one lead
  tile (the squares under it start below the fold). A lead tile is one composition with one name (ten faces read as one strip,
  never ten names). A base's first view holds three: the title card, How long, When moves lock; Make it… is one chunk of three
  buttons, below.
- Citations: Cowan (2001) for the four-chunk limit; Hassin et al. (2009) for unattended noise spending working memory.

**L1, first impression.** The look is judged in 50 ms, and that judgement colours everything after it.
- Violation: the gallery read as a settings grid (the Round 2 critique: "the shelf's frame was stock"); nothing in it said this
  show.
- **R2.** The gallery's first view shows this season's own faces, and a base's first view opens on the show's art with the game's
  name in title-card caps: the look the game's own page will have once started. Nothing on either first view may look like a
  form before a game is chosen.
- Citations: Lindgaard et al. (2006) for the 50 ms judgement; Kurosu and Kashimura (1995) for beauty read as usability.

**L2, processing fluency.** What's easy to process feels true; inconsistency erodes trust.
- Violation: names that collide (Prop sheet and Prediction sheet; Parlay ticket and A parlay); plain lines in muted grey; a lead
  tile could add a new visual dialect.
- **R3.** One grammar: a lead tile is built from the app's own parts (a caption plate for its name, cast tiles for faces, the
  season strip, condensed caps for numbers), one name per thing, reading text at 15 px or more in plain ink, yellow on Start
  alone, a team's colour only as a tag.
- Citations: Reber and Schwarz (1999) for fluency read as truth; Alter and Oppenheimer (2009) for its reach to trust and liking.

**L3, perception bias.** People recognise a game by what playing it looks like, and say they read labels when they don't.
- Violation: a pictogram and a name ask for recall of what "Survival pool" means; the names fans use (eliminator pool, best ball,
  props) weren't findable.
- **R4.** Each category's lead tile shows the game's action made of this season's things (a face picked safe, the next episode's
  questions, a card of its moments, the couch paired off), so the game is recognised before its name is read. The names fans
  use are found by search and said once on the base's screen.
- Citations: Nelson, Reed and Walling (1976) for pictures over words in recognition; Nielsen (1994) for recognition over recall.

**L4, decision architecture.** The right choice should be the easy one; risk is understood from experience, not description.
- Violation: changes were found by engine row; a change's effect was only seen after making it.
- **R5.** Changes are offered by the person's goal (More competitive, More casual, Different scoring), each naming its next step
  before the tap, each undone in one tap where it lands; every rule is a visible line; Try it sits in the first view; Start stays
  the one primary action.
- Citations: Hertwig and Erev (2009) for demonstrating over describing; Thaler and Sunstein (2008) for choice architecture.

## Requirements

R1 five chunks, a lead tile is one. R2 the season's faces in the gallery's first view; the show's art and a title card on a base's.
R3 one grammar from the app's own parts, one name per thing, 15 px plain-ink reading text. R4 lead tiles show the action with the
season's things; known names found and said. R5 goal-level changes that name their next step and undo in one tap; rules visible;
Try it early; Start alone in yellow.

## The solution, against them

The spec's gallery passes R1 to R4 when each lead tile stays one composition: at most one strip of faces (no names under them), at
most three questions, a 3 × 3 card, one pair line. Its base screen passes R2 and R5 when the title card carries Try it (so Make it…
can sit below How long and When moves lock without losing R5's "Try it early"). Round 2's gallery fails R2 and R4 (no faces, no
show); Round 2's base screen fails R5's goal-level changes (rows only, Popular changes unnamed as steps).

## The gap

Sports: a face per player doesn't scale (the round's frame), so a sport's lead tile draws R4's action from what a fan reads first
(the next game's matchup line with each team's tag, a stat line for a top player, a corner of the squares grid). Its R2 is the
team's identity as a tag and its schedule, not photos alone.
