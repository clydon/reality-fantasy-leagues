# The lone fan (sports-couch C2): the shape brief (Impeccable, step 3)

On [the spec](lone-fan-spec.md) and [the first-view requirements](lone-fan-first-view.md). Mode: **Operate**. The committed world:
Lower Third on Night and Studio. The interview was answered by the spec and the first view (asked once, no answer round: the user
reviews at the story). New parts live in `src/new/sports/fan-call.tsx` (`CallsCard`, `CallRow`, `FanCard`, `WatchingToggle`), built
from C1's parts in `src/new/sports/rivalry.tsx` (`SidesLine`, `FaceStack` exported and shared, not copied). Nothing new in the palette.

- **The thesis: the call is a voice, the couch answers it.** A row reads like a line in the group chat: a face, a name, a bold
  side ("**Jordan** called **Giants**"), then the couch's answer as faces either side of C1's split rule ("2 back · 1 fades"). The
  focal moment is the result line in the caption type, as C1's ("Jordan called it" / "Jordan missed it"), with the backing's checks.
- **The calls card:** B1's card ground (`bg-card`, 4 px radius), C1's head form: a small lucide `Megaphone` muted, "This week's calls"
  in the caption type at 17 px; under it the rows, each parted by a hairline. A row: line one the fan's 18 px face, the name, "called",
  the side in bold, at the right the record ("calls 7–1", 13 px muted, the number in the number type) when shown; line two the team's
  xs mark, the game ("Giants vs Bears") and its time or status at the right (On now with the live dot; Final). Then the backing line
  (only once someone's picked; the fan's own pick isn't backing). Then the action row. Three rows, then "+N more calls" as a 44 px text
  button that unfolds the rest.
- **The action**, one row by who you are, 48 px buttons in a two-up grid:
  - the fan, no call: "Your call" 13 px muted over two buttons, each the team's xs mark and short name; his team first, the chyron
    fill when the page's yellow is free (else outlined); the other outlined; under them "The couch can back or fade it" 13 px muted.
  - the fan, called: one line, "You called Giants" at 14 px semibold left; "Change" a 44 px text button right; once backed or faded,
    "It's backed: your call stands" in muted instead of Change.
  - anyone else: **Back Jordan** · **Fade Jordan**, outlined, each with its team's xs mark (Back: the call's side; Fade: the other);
    picked, the quiet `bg-secondary` fill with a check and "Backing Jordan" / "Fading Jordan"; tap again to clear.
- **The fan card (team's page):** under the follow line, no panel of its own beyond the card ground (a `bg-card` block, 4 px, 14 px
  in): line one the fan's 24 px face, "Jordan's team on the couch" 14 px semibold, "since Sep" muted; then the record row: "Calls"
  13 px muted label, the record big in the number type (28 px), and the ticks to its right filling the row: one 8 × 14 px tick a week
  of the season (the season's games, a call or a gap), right in the good teal, wrong outlined in muted, open (this week's, not yet
  final) a hollow ink outline, no call a 2 px faint dot; the couch's line under at 13 px muted ("Backing Jordan 5–2 · fading him 2–6").
  Hidden: the record and ticks become "Calls: 8 this season · results hidden" and the page's Show the season shows them. Yours:
  "Your team on the couch", "Your calls".
- **The call row under the scorebug** (team's page, Now): the same `CallRow` without its game line (the bug names the game) and
  without the card ground; Play the next game becomes `MoreAction` (outlined) when the viewer is the fan and the call is open.
- **I'm watching (the game sheet):** under the couch line, once the game is within the hour or on: a 44 px toggle button, the lucide
  `Tv` icon, "I'm watching" outlined; on, the quiet fill with a check, "Watching"; beside it the watchers' faces (22 px, four then +N)
  and their names in 13 px muted ("Jordan and Sam are watching"). On This week's table row of a game on now, the watchers' 16 px faces
  after the line's words (three at most). Nothing else.
- **States:** loading (rows' first two lines, a 48 px skeleton for the action); the read failed ("Couldn't load calls · Try again" as
  the card's one row); saving (optimistic: the button turns over, put right by the answer); a save failed ("Didn't save · Try again"
  under the row); postponed (the row's status Postponed, no action); hidden (calls and backing stay; no score, result, checks or
  records).
- **Motion:** the picked button fills from the tap (150 ms, the follow toggle's), the face slides into the backing line (opacity and
  6 px, 200 ms ease-out); nothing under reduced motion.
- **Anti-goals:** no sheet for a call; no VS or team-colour slab; two yellows never; no percentage; no shaming words for a wrong call
  ("missed it", never "blew it"); no push; no score, result, check or record for anyone hiding.
