# League art: first-view requirements (Perception-First Design, Mode 2, on league-art-spec.md)

## 1. The problem

Someone opening the hub scans Your shows to decide where to go. Every show is a 126 px band of photographic art with its season as
a ruler; the sports rows are short, artless plates (72 px, the off-season 48 px) that read as a different kind of thing, closer to a
footer or a settings row than a show. The eye either skips them or has to re-read them. On the league's own page nothing lets a
person make the league look like theirs, and nothing there looks like the band they tapped.

## 2. The layers, bottom up

**L0, cognitive load.** *Constraint:* working memory holds 3 to 5 chunks; a list is cheap to scan only while every row keeps one
schema, so a row costs one chunk instead of a fresh parse. *Violation:* two row schemas in one list (bands, then plates with their
own grammar: marks at the top right, the due dot inside the line). A 126 px band also invites stuffing: name, week, line, tag, games
mark, ruler, marks, numbers. *Requirement R1:* the league band reuses the show band's slots one for one (name top left, one line,
signs top right, ruler at the foot) and adds no slot of its own; one line of words; four marks then +N; the week in at most two
places (the title row and under the marks). The art page asks one question (which art) and nothing else.
**Citations:** Cowan (2001) for the 3-5 chunk ceiling; Hassin et al. (2009) for unattended clutter still spending working memory.

**L1, first impression.** *Constraint:* a list's quality is judged in about 50 ms from its visual rhythm, and a row that breaks the
rhythm reads as lesser. *Violation:* flat plates under photo bands look unfinished (the user's "they also need artwork"). The fix
has its own risk: drawn art beside photographs reads as clip art if it's flat or crude, a quality mismatch the eye catches before
any word is read. *Requirement R2:* every league band carries art with the show band's luminance structure (dark calm left under
the words, the interest on the right, the same fade), and drawn art reaches a photograph's finish: real material colour (turf,
clay, hardwood, ice), depth (a broadcast camera's perspective, light falloff, grain), quiet line weight. It must say the sport
(gridiron, diamond, court) before the name is read.
**Citations:** Lindgaard et al. (2006) for 50 ms judgements; Kurosu & Kashimura (1995) for appeal read as function.

**L2, processing fluency.** *Constraint:* one form meaning one thing is what makes a screen feel true; a familiar form with a new
meaning is misread at autopilot speed. *Violation risks:* the ruler means "how far through the season" on a show; on a league it
must mean the same, never a standings scale. Drawn field lines (yard lines, foul lines) can be mistaken for the ruler's ticks at the
foot. The due signal lives in two places across the list today (the games mark's dot on shows, the line's dot on leagues).
*Requirement R3:* the ruler is time through the season on both (episodes, weeks), numbered the same way; the couch's team marks
stay visibly teams (square badges, never round faces); the art darkens under the foot so no drawn line can pass for a tick; the
due dot has one home, the games mark. On the art page, a choice looks exactly like its result.
**Citations:** Reber & Schwarz (1999) for ease read as truth; Spence (2011) for every element telling one story.

**L3, perception bias.** *Constraint:* people keep defaults and act on autopilot; they say they want to customise and mostly never
do. Predictions that match pass unnoticed; mismatches cost attention. *Violation:* a weak default (a team's flat colour, which also
makes two navy teams in two sports look alike) is what most people would live with. A picture icon would be a new place to look
when the show bar has taught "the gear is where a thing's settings for me live". *Requirement R4:* the default needs no action and is
the strongest, most sport-identifying art there is (the photo where one exists, else the drawn surface); the setting sits behind the
gear, where the show bar's habit already goes.
**Citations:** Kahneman (2011) for autopilot defaults; Clark (2013) for prediction match passing unnoticed.

**L4, decision architecture.** *Constraint:* choices made by seeing beat choices made from a description; a near, small action
wants concrete words. *Violation:* a list of names ("The diamond") describes; a row that opens a sheet adds a step to a one-tap
choice. *Requirement R5:* the choice is made by seeing: the person's own band, with their league's name, week and teams, shown in
the art in use, and the choices as swatches beside it; a tap applies at once with Undo (nothing to confirm, nothing lost); the one in
use is marked; the words say plainly who sees it ("Only you see it").
**Citations:** Hertwig & Erev (2009) for experience over description; Trope & Liberman (2010) for concrete words at near actions.

## 3. The requirements, all non-negotiable

- **R1** The show band's slots, one for one; one line; four marks then +N; one question on the art page.
- **R2** Art on every band with the show band's dark-left structure; drawn art at a photograph's finish that says the sport first.
- **R3** One meaning per form: the ruler is the season's time; marks are teams; no drawn line at the foot; the due dot on the games
  mark only; a choice looks like its result.
- **R4** A default that needs no action and is the strongest art there is; the setting behind the bar's gear.
- **R5** Choose by seeing your own band; a tap applies with Undo; who sees it, said plainly.

## 4. What satisfies all five

**The band's first view, the order the eye takes:**
1. **The sport, from the art** (pre-attentive: colour and material on the right half), so a football band and a baseball band part
   before anything is read.
2. **The name,** top left, as large as a show's, white on the dark left.
3. **The couch's teams at now on the ruler,** the band's one cluster of colour on its foot; yours ringed.
4. **The line,** muted, under the name.
5. **The signs,** top right, only when they exist; the due dot is the band's only yellow.

**Must not compete:** the art's detail behind the words (the fade's left stop as dark as the show band's, .94); field lines at the
foot (a bottom fade under the ruler); a team-colour field against that team's own mark (the mark's edge from the foreground stays,
as the check of A2 required); the week said a third time.

**The off-season band:** the same height and art; the name, then "Off-season · back Mar 26"; the marks at the foot's left. Nothing
to place on a ruler, so no ruler.

**The art page's first view** (under the gear, over the league):
1. **Its title:** the league's name, and that this is yours ("Your settings for the NFL" in the bar's words).
2. **Your band, live:** the real band, at full width, in the art in use. This is the demonstration.
3. **The swatches:** each choice as a small tile of the art itself with its name under it, two to a row, the one in use ringed and
   ticked. A tap repaints the band above at once and saves, with Undo in the toast.
4. **One quiet line:** "Only you see it. It's on your NFL band and this page."

Nothing else on the page: no second setting, no paragraph about where art comes from (Settings › Credits holds that).

## 5. The proposals tested

- **A settings cog with maybe only this one setting** (the user's first idea): meets R4 (the gear is the bar's habit). Meets R5 only
  if the gear opens straight onto the choices; a row that opens a sheet would add a step.
- **A picture icon on the league page** (the user's second idea): meets R5 (one tap to the choice) but fails R4 (a second vocabulary
  beside the show bar's gear, and a gear needed beside it the day a second league setting arrives).
- **The spec as written** (a gear, a page whose Art section lays out tiles): meets R1 to R4. R5 needs one change: the tiles alone are
  too small to show the result (a band scaled to half has an 11 px name), so the page leads with the person's own band at full size
  and the tiles become swatches that repaint it.

## 6. The gap

R5's "choose by seeing your own band" is the part no proposal had: the page must render the real band (the same component, the
person's own data) above the choices, so what you pick is what Your shows will look like.
