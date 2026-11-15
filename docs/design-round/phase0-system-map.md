# Game Your Show: the system map (Phase 0, 2026-11-14)

The whole app as one system read at several distances. Every row below was rendered at 390 × 844 on 2026-11-14: frames,
page words and first-view measures in `.ui-atlas/stories/phase0/census/` (`index.json`; made by
`node scripts/dev-test/census-app.js --up --atlas --bench`). "Type sizes" counts the distinct font sizes in the first phone view
(tab bar, chips and a sheet's dimmed background included); "screens" is the page's height in phone views.

## The layers and each surface's one job

Distance runs from the farthest (a line on the lock screen) to the deepest (one game, all the way down). Each nearer layer should
be an excerpt of a deeper one, never a new invention.

| Layer | Surface | Its one job | What today's first view holds | Screens · sizes | Status |
| --- | --- | --- | --- | --- | --- |
| 0 · a line | Notifications: the push and the bell | Say the one thing that changed or is due, without spoiling | The bell's sheet repeats the hub's strip line and says "Nothing new" above it | (sheet) | today's |
| 1 · a tap | Quick moves: the hub's strip, Tonight's Your moves, the dock, the Your moves sheet | Make the due move in a tap or two, from wherever you are | Strip: "2 moves due · your pick locks Wed 8:00 PM". Sheet: a tab per game and a face grid that works on instinct | 2.6 · 12 | today's |
| 2 · a glance | Tonight's game section ("Your night", Standings) | How each of your games went last episode | Starts at 730 px, just under the first view; Standings at 1,830 px | 2.6 · 12 | today's |
| 3 · a list | The Games tab | Every game's standing and its one action; start a game | Placing chips, then each game's rules line, move row and table; extras and Start a game 1,600 px down | 2.9–4.0 · 11 | today's |
| 4 · a story | The reveal | Catch up on one episode across all your games | Full screen beats: "Previously on the couch", the couch reacts, each game, the table moving | 1.0–2.2 · 8–14 | today's |
| 5 · all the way down | The game page and its sheets (lineup, person, matchup) | One game: your move, who you play, the season, why the score is what it is | A two-line title, a time slab, setting chips, the spoiler line, the move, then the season grid | 1.8–2.2 · 13 | today's (17 bench situations) |
| 6 · a room | The draft room, waivers | Whose turn and who's free; take one | Draft: the order, Start, a 3-across face grid. Waivers: Replace Carter, your team, the picking order | 1.3–2 · 8–11 | today's |
| watching | The hub | Your next thing to watch or do, across your shows and people | Strip, couch faces, the Up next plate with its move, then posters | 2.7–3.6 · 15–17 | today's |
| watching | The TV guide | What's on when, for you and your couch | Inline on the hub 1,200 px down; a time grid whose columns are cut at 390 | (in hub) · 12 | today's |
| watching | Tonight (its top) | Your next episode and what to do about it | Show title, the couch's faces with marks, the next episode, Your moves | 1.3–3.1 · 6–14 | today's |
| watching | Episodes and an episode's page | Where you are in the season; what happened in each episode you've seen | Spoiler line, the next episode, every episode with faces at each person's mark | 1.0–1.3 · 9–14 | today's |
| watching | Players / Cast | Who's in it and what they've done | Faces / Rank / By episode, a range slider, a dropdown, then photo tiles with points | 1.5–4.0 · 8–10 | today's |
| watching | Chat | Talk about the episode you're on | Spoiler line, messages by day, the fold for later episodes, GIF and composer | 1.0–1.5 · 5–7 | today's |
| watching | Watch along | Keep a clock beside the TV and see the couch's reactions in step | "Watch Episode 6 with the couch", two clock kinds, opens at airtime | 2.6–3.0 · 16 | today's |
| watching | Where everyone is (pace sheet), a person's sheet | Who's where, and what each person watches | Caught up / up to N, each row a person and their games | (sheet) · 14 | today's |
| ways in | Welcome, sign in, first run, the tour, Add a show, couches (start, join), settings | Get in, follow shows, find your people, control your account | Welcome is 9.3 screens of character; sign in is one screen | 1.0–9.3 · 5–8 | today's (own track) |
| running it | Backstage | Run a game without the work spilling onto play | Needs you, reminders, then each game's pages | 1.3 · 6 | today's (own track) |

## How it's navigated today

- **The hub** (`/home`): the strip opens a show's Tonight; a face opens that person's sheet; Up next and every poster open a show; Add
  a show is a sheet; the guide's cards open their show; Start / Join a couch at the foot; the bell and your picture's menu at the
  top.
- **A show** (`/show/:id/:tab`): five tabs (Tonight, Episodes, Games, the people, Chat), a back to Home, a status chip and a menu.
  Pushed over it: a game's page, the draft, the blind draft, waivers, scoring, Backstage. Tonight hosts watch along and the reveal
  as pages of its own (`?page=watch`, `?page=reveal`).
- **A game's page** opens from the Games tab's section title and from Tonight's "Your games" tiles (1,865 px down). Its sheets: the
  lineup (the Your moves sheet), a person's sheet (week by week), a matchup (a square of the grid).
- **No way from the dock, the strip or Your moves to a game's page** (B40). The nearest layer can't hand you to the deepest.

## Said more than once (say each thing once)

| The fact | Where one first view says it | Times |
| --- | --- | --- |
| When the next episode airs and the move locks | Tonight: the header chip "Ep 6 · in 4 days", "EPISODE 6 · Wed 8:00 PM · in 4 days", the move card's "Picks close at airtime · Wed 8:00 PM". Hub: the strip, "WED 8:00 PM · IN 4 DAYS", the plate's "Locks Wed 8:00 PM · in 4 days" | 3 on each |
| Results are waiting to reveal (two behind) | Episodes: the plate, two rows marked Reveal, the dock. Tonight: the move card's "Reveal Episode 4" and the "You're 2 behind" plate. Chat: "Reveal Episode 4" | 4 on Episodes |
| The due move | Hub: the strip and the Up next plate, in one view. Then Tonight's card, the dock on every other tab, the Games tab's row, the game page's plate, the bell | 2 in the hub's view; 7 forms app-wide |
| Your viewing boundary | "Spoiler-safe · you're up to Ep N · Change" on Episodes, Games, the people, Chat, the game page; the header chip; your own face's mark on Tonight | on 5 tabs |
| The show's name | A two-line display title with a ghost copy of itself behind it (every show header), then "Season 51", then "<couch> · 3 games" | 2 per header |
| A game's settings as badges | "BLIND DRAFT", "WAIVERS", "ONE OWNER EACH" chips under the game page's title, beside "Draft 5, start 3 · Head to head, playoffs" | 2–3 chips |
| Per-game reveal buttons on an own-pace Tonight | "I've watched it · Reveal" on each game's card, though one reveal covers every game | 1 per game |

## Buried or missing

| What matters | Where it is today | Taps |
| --- | --- | --- |
| Who you play this week (head to head) | Nowhere: `matchups.next` is read by no surface (DN 3) | missing |
| Last episode's result for your games | Tonight's "Your night" at 730 px; Episodes' rows say "You +1 in Weekly Lineup" | 1 tap and a scroll |
| Why your score is what it is | Games › a row › the person's sheet › a week | 3–4 |
| A game's own page, from where the move is | The Games tab's section title; Tonight's "Your games" tiles, 2.2 screens down | 1 and a long scroll on Tonight; none from the dock or the move |
| The TV guide | Inline on the hub, 1.4 screens down; columns cut at 390 | a scroll |
| Watch along | The hub's button; Tonight at 1,570 px; the show menu | 1 from the hub, a scroll on Tonight |
| Where friends are | Tonight's faces carry marks (first view); the hub's faces don't | 0 on Tonight, 1 from the hub |
| Which game's points a Players tile shows | "7.5 pts" on a cast tile, and "3 pts" on a show with no game | not said |
| A failed read | A skeleton that never says it failed (after 15 s) | never |

## The shared parts

Each part is decided once and used at every distance. "Forms today" counts the distinct visual forms one meaning takes.

| Part | Forms today, and where | Forms |
| --- | --- | --- |
| **The move** | Hub plate (yellow tag slab), Tonight's numbered card with a yellow button, the dock bar, the Games tab's row (Claim / Pick / Edit), the game page's slab, the Your moves sheet, Episodes' "Outlast waivers · Open" row | 7 |
| **The result** | Tonight's red "OUT" slab, "Your night" rows, an episode page's "Your games" rows, the reveal's beats, the grid's squares, a poster's "BEST 1ST" | 6 |
| **The matchup** | Only the grid's W / L / T squares; no opponent card anywhere | 0 |
| **The person (cast or athlete) row** | Photo tile (Players), compact row (sheets), face chip (tables), picker tile (Your moves), draft tile, letter placeholder | 6 |
| **The episode card** | Hub's Up next plate, Tonight's "Up next for you", Episodes' "Airs Wed" card and its rows, the guide's cards, the reveal's opener | 6 |
| **The viewing-progress control** | Header chip, the spoiler line and Change (a "Where you are" sheet that, for a player, explains instead of choosing), Watch along / I watched it, your face's mark | 4, in 4 places |
| **A friend's face and position** | Hub couch row (no marks), Tonight's row (marks), the pace sheet, the person sheet ("Up to Episode 25 of 29"), Episodes' faces at each row, "0 of 4 picked", chat avatars | 7 |
| **The stat table** | Stat of the week and two leaderboards, Players' Rank, a game's TEAM / POINTS table, the season grid, a person's bars | 6 |
| **The person sheet** | Hub (what they watch), Games (one game's week by week), the game page's "Your sheet": three sheets for one person | 3 |

## The words, per flavor

The app already reads a show's own words for its unit and its people (`src/lib/game/show-words.ts`; `termsOf` in
`src/lib/server/add-show.ts`): a competition says Episode and Contestant (Survivor: Castaway), a sport says Event, Game or Race and
Player, any other kind says Episode and Cast member. The tabs follow. What the rest of each part says doesn't yet.

| Part | Competition (Survivor, The Traitors) | Sports (NFL, NBA, golf, F1) | Story (dramas, sitcoms, talk, Below Deck) |
| --- | --- | --- | --- |
| Tabs | Tonight · Episodes · Games · Castaways · Chat | Tonight · Schedule · Games · Players · Chat | Tonight · Episodes · Games · Cast · Chat |
| The unit | Episode 6, "Ep 6" | Game 3, Week 12, Race 4, a round; "G3", "Wk 12" | Episode 6; a season dropped at once |
| The result | Carter out · voted out · finished 14th | A stat line, a place ("T14", "2nd"), a score; points by stat | A moment the couch or research confirms: called, settled, still open |
| The move | Pick who survives, set your lineup, draft, claim a replacement | Set the lineup by position, before each game's kickoff or the week's | Call it, a prediction, a bingo card, a poll |
| Out | Out · Ep 4; the one who left the team | Inactive, injured, on a bye, postponed (never "out of the show") | Nobody is out |
| Standing | 1st of 4, T2, a W–L record, a streak | A W–L record, a division, a place in a field | Calls right, a streak; often no table at all |
| The reveal's opener | "Previously on Survivor" | "Last week in the NFL" (only when scores are hidden) | "Previously on", and what got settled |
| Progress | "You're up to Episode 5" | Scores told live by default; "seen through Game 3" when hidden | "Up to Episode 5 of 8" across a binge |
| Today's slips | (the reference) | "You're set for Episode 3", "Who went home usually lands…", "No one out", "49 still in", "+4 still to air", a game titled "ACTIVE-ROSTER", "Spoiler protection is off" on every page | "Locked at 10:12 PM" on a series with no game; stat leaderboards from competition moments |

## Open questions

- Is the people tab one surface with a flavor (faces for a cast of 18, a searchable list for 300 athletes, characters and
  relationships for a story), or are those different surfaces that share a name?
- Does the hub keep the TV guide inline, or does the guide become its own place opened from the hub's top?
- Does the dock stay once the strip and Your moves exist, or is one quick-move surface enough at every distance?
