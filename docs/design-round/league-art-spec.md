# League art: the league band in Your shows, and where its art is set (Intent's page spec)

The user, 2026-11-23, on a screenshot of the hub's Your shows (four show bands, then the 72 px NFL and 48 px MLB cards): "Sports
need to have the same static height as shows. They also need artwork. Allow this to be set by user in settings. (We don't have a
settings cog yet afaik so maybe it's just this one setting. Or maybe there's a picture icon once you're into the sport that'll allow
you to set the artwork.)"

This overrules settled call 3 of PLAN-sports-couch.md ("the league card is shorter and a smidge subtler: 72 px, no live score, no
red", 2026-11-22) on height and art only. "No live score, no red" stands: live is the scores strip's job.

## The constraints this works inside

- **The site never supplies a league or team logo** (PLAN-team-logos.md, the user, 2026-11-22). A couch's own uploaded team pictures
  are the only logos, and only that couch sees them. So no league art can be a league's logo or official key art.
- **Member uploads wait** for L4 and L5 (the takedown button) and the safety step (PLAN-team-logos.md: "no uploads without the
  takedown button"). Your own picture is therefore not a choice in this round.
- **Image generation is blocked today:** Gemini answers 403, "Your billing account has an outstanding balance" (tried 2026-11-23,
  04:15). The generated library has one sport photo (football-night-v1) and one neutral one (event-night-v1). Every other sport's
  art is drawn in code until photos can be made, and the choice list takes a new photo as one file and one manifest entry.

## The drill tree

| Level | Questions people bring | Today | Verdict |
| --- | --- | --- | --- |
| Your shows, a league's row | Which league is this? Where's its season? Whose teams are in it? Anything of mine? | 72 px card, no art; off-season a 48 px line | **Restructure** into a band: the show band's frame and grammar |
| The league's page, its bar | Where am I? | Compact dark bar, no art ("a league has none") | **Repaint**: the chosen art behind it, as the show bar has its show's |
| The league's settings for you | How does this league look and treat me? | Doesn't exist | **New screen**, small: under a gear on the bar |
| A piece of art | What will it look like? | Doesn't exist | **New display**: a tile showing the art as the band will |

Everything under the bar (This week, Scores, Games, Standings, Chat) is **kept**: nothing in this request reaches it.

## 1. The league band in Your shows

**Its one job:** among the shows, say "this is the NFL, here's where its season is and the couch's teams in it", and open the league.

**Its frame is the show band's,** so the list reads as one kind of thing: 126 px always (in season, off-season, any number of teams),
the same 4 px corners, the art behind under the same left-dark fade, the name at the top left, one line under it, signs at the top
right, a ruler along the foot. A tap anywhere opens the league's page (as today).

**Content, in rank order (in season):**
1. **The league's name** ("NFL"), as large as a show's, with its week beside it in quiet caps ("WEEK 12": what the user saw, kept).
2. **One line:** what the couch has going there, the A2 rule unchanged (your games and your place, else the couch's games, else who
   leads the couch's teams by record, never for anyone hiding scores, else who follows them). Where a Best tag says your place, the
   line doesn't say it again.
3. **Top right, the show band's signs:** the games mark when you play a game in this league, carrying the due dot (the card's own due
   dot in the line goes: one place for "a move is due" across shows and leagues), and **Best 1st** when you rank in a game there.
4. **The foot, the season as a ruler:** where the season is, the way a show's ruler says where its episodes are. The played part
   solid, the rest faint; **the couch's teams stand at now** (marks, yours ringed, four then +N), with the week's number under them;
   the ends numbered (1 and the last regular week). Football by its own weeks; a daily sport by its Monday-to-Sunday weeks; a league
   cut by rounds (soccer) and a daily sport's playoffs by the date, without numbers. In the playoffs the ruler is full and the marks
   stand at its end, the stage named in the week's place ("WILD CARD").

**Off-season:** the same 126 px band and art. The line says "Off-season · back Mar 26" (with who follows, as now). No ruler (there's
no season to place): the couch's teams' marks stand at the foot's left, where a ruler's start would be.

**Left out, with why:** a game's time, score or live state (the strip's, and spoilers for anyone hiding scores); the league's logo
(never ours to show); the couch's faces (a band's faces mean "how far each person has watched", and nobody is behind on a live sport).

**Its place:** unchanged. Sports last, a band a league, by the league's name (the user, 2026-11-22).

**Situations to render:** in season with two teams and a line (the user's NFL); a game of yours with a move due and a place; off-season
(the user's MLB); a league followed with no team (no marks: the ruler's now alone); five teams (+1); hiding sports scores (no record
line); a soccer league (no numbers); the solo hub (the same band above its posters); a long name (NCAA Men's Basketball); art that
fails to load (the show band's dark plate); Studio (the light theme: a band is its own dark plate there, as a show band is).

## 2. Where the art is set: a gear on the league's bar

**Structure:** the league's bar gains the gear every show bar already has (settings Round 0's "one gear on every bar"), beside Follow.
It opens **Your settings for this league**: a page pushed over the league (`?page=you`, the show's own address pattern), titled with
the league's name. For now it holds one section, **Art**, with its choices laid out right there (no extra sheet to open), so a change
is one tap after the gear. More of the league's own settings join this page later (its room's notifications, say); a lone picture icon
would have been a second vocabulary for the same idea, and would need a gear beside it the day a second setting arrives.

**Why not Settings' main page:** a league's look belongs to the league, as a show's settings belong to its gear. Your settings' map
(Your shows, couches and games) can list leagues later; not in this round.

**The Art section:**
- A line: "On your NFL band and this page. Only you see it." (It's yours alone: the user said "set by user".)
- The choices, as tiles that show each art the way the band will (a band's proportion, the name over its fade), the one in use ringed
  and ticked. A tap saves at once, with Undo in the toast (every setting here does).
- **The order (the taxonomy):**
  1. **The sport's own art:** its photo where the app has one ("Under the lights", football), then its surface, drawn ("The field",
     "The diamond", "The court", "The rink", "The pitch", "The course", "The track", "The cage").
  2. **Your teams' colours:** each of the couch's teams in this league, yours first ("Patriots colours": the team's colour with the
     sport's surface drawn over it). Solo: your teams.
  3. **Arena:** the neutral photo, last, for any sport.
- **With nothing chosen,** the band shows the first choice: the sport's photo if it has one, else its surface. A team's colours are
  never assumed: two navy teams in two sports would look alike, and the sport's own art says which league a band is before its name
  is read.

**Return path:** the page's Back (and the phone's back gesture) returns to the league, its bar now in the new art. The hub's band
shows it on the next visit (the hub reads it with the profile).

## What this round doesn't decide (for the user, named)

1. **Your own picture** as a choice: built when member uploads ship (L4 with L5 and the safety step), into the couch's own store,
   couch-only. Recommend waiting with team pictures, as the plan says.
2. **Photos for every sport:** once Gemini's billing is paid, one photo per sport (baseball, basketball, hockey, soccer first) goes
   first in its list. Nothing else changes.
3. **Per person or per couch:** built per person, as asked. A couch-wide art would need "who set it" and takedowns like team pictures.
