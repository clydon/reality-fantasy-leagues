# Archetypes and paths

Who uses the app today, how they arrive, what they do each week, and what success looks like for each of them.
Set on 2026-10-26 from the friend group the app targets now; the first four are real people, named here by role.

**How to use this.** Before a UX change, name the archetypes it touches and walk their path at 390px. In a
critique (`/impeccable critique`), use these instead of generic personas. The blind test at the end is how we find
out whether the app explains itself.

## The archetypes

Ordered by how much they matter right now.

### 1. The Fan Who Forgets
- **Who:** loves the show more than the game and knows the cast cold. Low tech confidence. Skips instructions and
  won't take a tour ("I don't like tours"). Before the redesign they needed a reminder every week to set lineups
  and picks.
- **Comes back:** only when something pings them.
- **Success:** sets their move from a nudge in 30 seconds, without hunting.
- **Watch for:** anything that relies on them remembering, reading or finding a setting; reminders that look on
  but aren't; two screens naming different "first" moves.

### 2. The Picture-First Partner
- **Who:** knows only that the app is "fantasy leagues and reality TV". Very low tech confidence; won't read;
  expects graphics that explain instead of instructions. Usually on the same couch as someone who runs a game.
- **Success:** understands their one weekly move from a picture, or the person beside them can make it for them.
- **Watch for:** paragraphs where a picture would do; anything only the signed-in player can do.
- **Graphics:** Claude writes an image prompt for each one; the owner designs it or generates it from the branding
  and app screenshots.

### 3. The Drive-By
- **Who:** technically fluent (works in IT, fine with walkthroughs) but rarely on their phone. In and out once a
  week, about a minute, unless something excites them.
- **Success:** the first screen says what changed since last time and whether they owe anything; one hook (their
  rank moved, a rival's pick went home) keeps them.
- **Watch for:** a hub built for browsing when they want a delta; any inconsistency, which costs their trust.

### 4. The Tinkerer
- **Who:** runs the games. A power user who likes simple design; researches the stats and wants to learn the whole
  system.
- **Lives in:** Cast (Rank, By episode), How it works, Backstage, the admin desk.
- **Success:** any stat or rule within two taps, and nobody else ever sees those taps.
- **Watch for:** their depth leaking onto everyone else's screens.

### 5. The Curious Relative
- **Who:** older, invited "to see what this is"; may never play. Arrives by a texted link.
- **Success:** joins without phoning anyone, and understands the hub's first screen with nothing explained.
- **Watch for:** password friction, small text, the dark default, jargon (T2, Best 1st, waivers, Exclusive).

### 6. The One-Gamer
- **Who:** plays one game with friends and ignores the social side. Includes the plus-one who was talked into it.
- **Success:** the app feels like "my game"; nothing else gets in the way or pings them.
- **Watch for:** social sections between them and their game; notifications they never wanted.

### 7. The Nosy One
- **Who:** wants to see what everyone's up to: who set what, who's watching what, who's winning, what was said.
  Reads far more than they post.
- **Success:** one place answers "what's going on with everyone", and anything hidden says why (the spoiler guard,
  What your couch sees).
- **Watch for:** silent gaps where the guard or a privacy setting hides something.

### 8. The Behind-Watcher
- **Who:** streams a day or three late; spoiler-phobic. Every group has one.
- **Success:** never spoiled, never punished for watching late.
- **Watch for:** pushes, chat and share cards; moves whose deadline comes before they've watched (a Survival Pool
  pick needs the previous episode revealed first).

### 9. The Late Recruit
- **Who:** hears about it mid-season and arrives cold by link. The next wave of friends: the blind test.
- **Success:** in a game and set for the next episode within 3 minutes, with no help.
- **Watch for:** jargon at the first decision; joining a game where they're already last; arriving without a link
  (the waiting list).

### 10. The Group-Chat Captain
- **Who:** lives in the friends' existing group chat and won't move the banter into the app.
- **Success:** the app's moments (the reveal's share card, the standings) show up in the group chat every week.
- **Watch for:** in-app chat competing with the group chat; moments that don't screenshot or share well.

### 11. The Different-Show Friend
- **Who:** on the couch for the people; watches other shows (Traitors, Love Island, Drag Race), not the one the
  couch plays.
- **Success:** within a week the hub feels like theirs.
- **Watch for:** a hub shaped by one show; watch-only shows treated as second class.

### 12. The Rival
- **Who:** takes it seriously, reads the scoring, checks and disputes results.
- **Success:** every point can be explained from the screen it's on.
- **Watch for:** totals without a why; rules hidden behind ⋯.

## The paths

What broke on each, as of the 2026-10-26 critique (`.impeccable/critique/`, local only), is in the last column;
update it as fixes land.

| Path | Route | Matters most to | Breaks (2026-10-26) |
|---|---|---|---|
| **1. Arrive by link** | `/join/CODE` → Join → account → where you are → hub | Late Recruit, Picture-First Partner, Curious Relative, One-Gamer | A username as the headline; Shared/Exclusive chips; after joining, three Joins and the way on below the fold; never asks about notifications |
| **2. Arrive with no link** | `/welcome` → Start free → pick shows → where you are → account | Anyone told the domain, not sent a link | "You're on the list" with only Sign out, unless sign-ups are open |
| **3. The weekly move** | reminder → hub → Tonight → Your moves → Save | Fan Who Forgets, Picture-First Partner, Drive-By, One-Gamer | ~~No reminder unless push was turned on in Settings~~ (fixed 2026-10-26: asked after the first save, PLAN-new-design's archetype As built); hub, Tonight, dock and bell disagree on what's due; the second move hides in a carousel |
| **4. After the episode** | results (push, bell) → Tonight → reveal → Games → share | Behind-Watcher, Group-Chat Captain, Drive-By, Nosy One | The behind-watcher's next pick opens only after revealing the last episode |
| **5. Between episodes** | hub feed, Games, Cast, Chat, profiles | Nosy One, Rival, Tinkerer | Games and Stats are strong; the hub buries the feed under rails |
| **6. Join mid-season** | invite → game list → catch up, or start from episode N | Late Recruit | Exclusive games wait for the commissioner; "catch up or start fresh" asked before they can judge it |
| **7. Run a game** | Start a game → invite → draft → Backstage | Tinkerer | Can't set someone's lineup, pool pick or predictions for them (draft and waivers can) |

## Facts the paths rest on (checked 2026-10-26)

- **Reminders are web push only**, about 24 hours and 2 hours before airtime (`db/reminders.js`, on the hourly job).
  Email is used only for sign-up and passwords.
- **Push is switched on in Settings › What we notify you about, or from the reminder ask** (since 2026-10-26: once, right
  after the first save in Your moves, while no phone of yours gets them; a row on Tonight after Not now or a missed move).
  The way in never asks. On iPhone it works only once the app is on the Home Screen; the ask shows how, in three pictures.
- **Forgetting:** Weekly Lineup carries last week's lineup over; a missed Survival Pool pick ends your streak; a
  missed prediction scores nothing.
- **Behind on results:** the next Survival Pool pick waits until the previous episode is revealed.
- **Who gets in** (the desk's Settings): a sign-up without an invite waits for approval unless sign-ups are open.
- **Helping someone:** whoever runs a game can pick for them in the draft and in waivers. Weekly moves have no
  "for them" screen; the API lets a commissioner (not a Game admin) make a pick or lineup for someone, logged to
  Recent changes.

## The blind test

- Testers need the new design live (after the merge) and **a link** (`/join/CODE`), never the bare domain.
- Say nothing. Ask three things:
  1. After 30 seconds: "What is this?"
  2. After joining: "What do you have to do, and by when?"
  3. The morning after the episode: "What happened, and how did you do?"
- Note whether they turn on notifications themselves, whether they find How it works, and where they stopped or
  asked for help.
- Record each tester against the archetype closest to them, and update the paths table.
