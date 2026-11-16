# The hub and the TV guide: page spec (step 7, competition shows first)

## The job

**The hub** (`/home`) is where you land between everything else: it says the one next thing across all your shows (watch, play,
or reveal), where your people are, and what's on. It answers, in this order: is anything waiting for me, and on which show; when
is my next episode on; where is everyone; what are my shows. Every deeper answer is one tap into a show, a person, or the guide.

**The TV guide** is what's on when, for you and your couch: tonight first, then the week, with the rest of TV and sports a switch
away. It answers: what's on now and tonight; what airs this week of mine and the couch's; what else is on that someone might add.
It is its own place (Phase 0 decision 7), opened from an **On TV** row near the top of the hub that is really animated and
noticeable (the brief: "a tiny unlabeled icon or a static generic schedule is not an equivalent substitute").

People: Joanna opens the app after a week away, sees "Results are in · Reveal" on Survivor's art, reveals, and leaves; Andrew sees
"Make your Ep 6 pick" on the plate, taps it, picks, and leaves (two taps); Conor checks where Riley is before texting about the
episode, then opens On TV to see if Traitors is on Thursday and adds a show from All TV.

Ways in: opening the app; the bar's Home from any show; a push. The guide: the hub's On TV row; the solo hub's.

## The hub, top to bottom (a couch, mid-season, a move due: Alex)

| # | Block | Holds | Opens |
| --- | --- | --- | --- |
| 1 | **The bar** | The brand, the bell, you | as today |
| 2 | **The next thing**, one plate on the show's art | The show and its episode with when, said once ("Ep 6 · Wed 8 PM · in 4 days"); then the one thing it needs from you, needs-you first: results to reveal (Reveal), else your due move ("Make your Ep 6 pick", its lock in words only when it isn't the airtime), else on now (live), else all set ("All set for Ep 6", quiet). When moves are due on other shows too, one line under it: "1 more move · Traitors 5" | The move: **its editor** (one tap: the show opens with the move's sheet open, or the draft room, waivers, the blind draft). Reveal: the reveal. The show's name: the show |
| 2a | **Who's set**, inside the plate, only beside a due move | "2 of 4 picked" with the faces, those not in yet dimmed | nothing (it's a line) |
| 2b | **A planned night**, inside the plate, only when the couch planned one for this episode | "Watch along · 3 going · Join" (as today) | the plan |
| 3 | **On TV**, a row of its own | Labeled "On TV" with a live dot when something of yours or the couch's is on; a small reel of this week's airings rolling by (the guide's cards in miniature, art first, today's first, the time on each); a friend watching along shows as their face on that card | **The guide**, at the day of the card tapped (anywhere else on the row: today) |
| 4 | **Your people**, one row | The couch's name, then each person's face, you first and ringed, each with their mark on the plate's show beneath it ("5", "6 ✓" when caught up, nothing when they don't share or don't watch it); a dot on whoever's watching along now | A face: that person's sheet (every show they share, how far, Watch along with them when they're on) |
| 5 | **Your shows**, the shelf | A poster each: the art, the name, "Season 51 · Wed", one status line (your best place: "Best 1st"), a dot when a move is due there; the flip to your games and places | A poster: the show. The flip: your place in each game there |
| 6 | **You both watch**, the nudge (below the first view; only when there's a match) | as today: once, with Not now | Start a game |
| 7 | **The couch is watching** | as today: shows the couch watches, each person's mark | The show; Add to my shows |
| 8 | **On the couch**, the feed | as today | its item |
| 9 | **More on the couch** | as today | its page |
| 10 | **The foot** | Start a game · Join a couch | |

Removed from the hub: the status line (the plate says what's waiting, and "1 more move" says the rest: R1, each fact once); the
**On now** row (its show is On TV's live card, its person is a face with a live dot, and joining them is on their sheet); the guide
inline (it's its own place); **Streaming on the couch** (a drop's day and a show at your own pace are the guide's: it moves there,
as "At your own pace"); the game chips on the posters' fronts (the flip lists the games with your place); "Tap to open".

The shapes keep their own extras: a **new couch** keeps Get the couch going under the plate; **a new member's first week** keeps
the note of what shows up as the couch plays; **solo** (no couch) keeps Welcome and Watching solo (Start a couch), then the plate,
On TV, Your shows, Play on your own, On your own, Better with friends.

## The plate, by situation

| Situation | The plate | Who's set | Below it |
| --- | --- | --- | --- |
| A move due (Alex) | Survivor's art, "Ep 6 · Wed 8 PM · in 4 days", **Make your Ep 6 pick** (yellow) | "0 of 4 picked" | "1 more move · Weekly Lineup" when it's on another show |
| Results waiting (Sam, two behind) | "Results are in · Ep 4", **Reveal Ep 4** (yellow); "and 1 move after it" when the move waits on the reveal | none | |
| Early results in | "Early results · Ep 4", Reveal; "Final results at noon" | none | |
| Final results the next morning | "Final results · Ep 5" in teal (good news), Reveal | none | |
| A draft turn | "Your pick now" in the draft's game, **Draft** (yellow), opens the room | none | |
| On now (live) | "On now · Ep 6", Watch along; a move can't be due (it locked) | none | |
| All set | "Ep 6 · Wed 8 PM · in 4 days", "All set for Ep 6" quiet, no yellow | the couch's count, quiet | |
| A show with no game (watching only) | the art, the episode and when; Watch along when it's out and unseen | none | |
| Own pace, an aired episode unseen | "Ep 4 aired · Watch it, then reveal", Watch along | none | |
| Nothing airs again (all seasons over) | no plate; Your shows leads | | |

The plate never names who went home, a score or a result: "Results are in" only (spoilers lens).

## The guide (its own place, `?page=guide` over the hub, so back closes it)

| # | Block | Holds | Opens |
| --- | --- | --- | --- |
| 1 | **The bar** | Back ("Home"), "On TV", Add a show | Add a show's sheet |
| 2 | **The switch** | Couch (My shows when solo) · Competitions · All TV · Sports, kept per phone as today | |
| 3 | **The week** | Seven days, today first, each a day cell with its name and date and the art of your shows that day in small (the week at a glance); the day shown is marked | That day, below |
| 4 | **The day** | That day's airings in time order: on now first with its live tag, then the Now line, then what's to come and (today) what aired earlier; each card the show's art, the time, the name, the episode, the faces of who on the couch watches it, a controller when a game's on it (a dot when a move's due), a planned night's teal tag. Same time slots grouped. A day with nothing of yours: "Nothing tonight · Next up" and its card | Your show: the show. A couch show: its sheet (Add to my shows, Plan a watch along, Hide). A planned night: the plan |
| 5 | **Also on**, under the day (Competitions and All TV) | The evening's most watched few, faded, and "N more on TV" | A listing's sheet; the evening's sheet |
| 6 | **At your own pace** | Streaming drops and finished seasons the couch watches (moved from the hub's rail), each with who's waiting and how far | The show, or Add |
| 7 | **The foot** | "N hidden" | The hidden sheet |

Swiping across the day moves to the next or previous day. Sports (the switch): the week's cells are the same; the day holds the
couch's teams' games first as cards (the two teams, who follows each, the time, or the score once begun unless Hide scores is on),
then every other game counted by league.

## The drill tree

| Level | Questions brought to it | Holds today | Verdict |
| --- | --- | --- | --- |
| Hub | Is anything for me; what's next | Status line, couch faces, the Up next plate, On now, Your shows, the nudge, the guide, Streaming, The couch is watching, the feed, More, foot: 3.5 screens | **Restructure**: plate, On TV, people, shows in the first view; the guide and Streaming out |
| The status line | What's waiting | "2 moves due · your ZT Survivor pick locks Wed 8 PM": the plate's move again | **Remove**: folded into the plate and its "1 more move" line |
| The next thing | What's on next; what do I do | The show's art, "Up next · Season 51 · Ep 6 · Wed 8 PM", the name, "Wed 8:00 PM · in 4 days", a PICK plate "Locks Wed 8:00 PM · in 4 days", who's set, Watch along. The time three times; the plate opens the show, not the move | **Restructure**: the time once; the move opens its editor; Watch along only when there's something to watch |
| The move from the plate | Make it | Two taps (the show, then Tonight's strip) | **Restructure**: one tap (the show opens with the move's sheet; a draft, the room) |
| On TV | What's on | Nothing near the top: the guide 1.4 screens down | **New display**: a labeled row with a rolling reel of this week's cards |
| The guide | What's on when | A seven-column reel inline, columns cut at 390, its switch at the foot | **New screen**: its own page; the week as cells, the day as a list; the switch at the top |
| A day in the guide | What's on tonight | A 165-px column, cards 104 px, Also on under | **Restructure**: the day full width, cards larger, Now line kept |
| A guide card | What's this; is it mine | Art, time, name, episode, faces, controller | **Keep**: it reads (the fade ladder: yours full, the couch's faded) |
| A couch show's sheet, a listing's, the evening's, hidden | Add it; hide it | Sheets | **Keep**: each already does one job |
| Streaming on the couch | What drops; what's waiting | A rail on the hub | **Restructure**: into the guide as At your own pace |
| On now (a friend watching along) | Who's on; can I join | A row with the first person and "and N more" | **Restructure**: the face's live dot, the On TV card's face, Watch along on their sheet |
| Your people | Where is everyone | Faces with no marks | **New display**: each face's mark on the plate's show |
| A person | What do they watch; how far | Their sheet: each show, "Up to Episode 25 of 30 · 5 ahead of you", Add | **Keep**, plus Watch along with them when they're on |
| Your shows | My shows | Posters with Best, three game chips, a flip | **Repaint**: one status line; the chips off the front |
| A poster's back | My place in each game | Each game, its couch, your place | **Keep**: it's the sweat's glance |
| The nudge, The couch is watching, the feed, More on the couch | Social, the couch's numbers | as today | **Keep**: below the first view, where Phase 0 puts them |
| The solo hub | Same, with no couch | Welcome, Watching solo, Up next, the guide, Streaming, Your shows, Play on your own... | **Restructure** to match: the plate, On TV, the guide out |

## The five lenses

- **Own pace:** the plate is at your mark (results you haven't revealed say "Results are in"; an aired episode you haven't seen
  says "Ep 4 aired"); each person's mark is theirs; the guide is the broadcast schedule and never says what happened ("aired" only).
- **A shared draft** and **an exclusive draft:** a draft turn is the plate's move ("Your pick now"), opening the room.
- **Stages:** the plate's move names its game when two games on a show have moves; nothing else changes on the hub.
- **Spoilers:** no result, name or score on the hub or in the guide; a sport's score only when Hide scores is off.

## Sports (the short check)

A live game day: On TV's reel leads with the live game ("On now · Eagles 14–10 Jets", or "Eagles at Jets · started 8:15 PM" with
scores hidden); a sports game's move on the plate reads as any move (Pick'em's pick, its lock at kickoff). The guide's Sports is the
same week and day: the couch's teams first, other games counted by league. A sport's season on the plate never names a score when
scores are hidden.

## Open questions

- On TV above the plate (a crawl under the bar, the Lower Third world's own form) or under it (the plate first): the first view's
  order is PFD's.
- The guide's rolling reel moves to the On TV row; the guide page itself pages by day. Is the page's own motion (the live tag, the
  Now line, cards entering) enough of "the animated guide"?
