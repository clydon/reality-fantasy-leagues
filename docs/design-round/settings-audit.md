# Settings today: the audit

> **Status (2026-11-20): Reference** for [PLAN-settings-overhaul.md](../PLAN-settings-overhaul.md). Read from the code (master
> f56df0ce), not rendered: Round 0 renders every surface here at 390. Four read-only auditors each read one area (you; you on a
> show, couch or game; running a game; the desk), and a pass over the database's preference columns checked what's stored against
> what's shown. Claims that drive a decision were checked by hand and are marked ✓. Line numbers drift; search for the words.

**How it's sorted.** By what a setting is about, because that's how the plan re-files them: you everywhere; you on a show, a couch
or in a game; a game, for whoever runs it; the site, for its admin. Each setting carries a proposed verdict for Round 0 to confirm or
overturn:

| Verdict | Means |
| --- | --- |
| **Keep** | people really change it (it says who and when) |
| **Move** | the right setting in the wrong home |
| **Default** | keep what it does, drop the control: nobody changes it, or the right value is obvious |
| **Drop** | it does nothing useful now, or never did |
| **Merge** | two controls that are really one choice |

The people are [ARCHETYPES.md](../ARCHETYPES.md)'s: Joanna forgets, Andrew drives by, Conor tinkers; the Behind-Watcher, the
Curious Relative, the One-Gamer and the Nosy One.

## The picture

About 25 places to change something, and about 150 controls that act like settings. There are at least five ways to save or
confirm, and four screens called "Settings".

| What it's about | Where it's changed today | Deepest |
| --- | --- | --- |
| You, everywhere | Settings (whose only door is the hub's picture), its five folds, Your profile (Edit), the hub's sheet | 5 taps |
| You on a show | the show's ⋯, its Everything else sheet, its Notifications sheet, Where you are, Settings' "Shows that move along", Add a show, Tonight's questions, a sport's score cards, a team's page | 5 |
| You on a couch | the hub sheet's couch line → Your couches → the couch's sheet; Settings' Your couches fold | 4 + a confirm |
| You in a game | the game's ⋯, the strip's Lock in, joining | 5 |
| A game, for whoever runs it | Backstage (a home and six pages), a game's own settings (from the game's ⋯), the waivers settings sheet, the draft room's gear, two rows of personal Settings | 6 |
| A couch, for its owner | the couch's sheet; one season's Backstage › Results (who fills in results, for the whole couch) | 4 |
| The site and its seasons | the desk: three tabs, 23 pages | 4 levels |

---

## 1. You: Settings, Your profile, the hub's sheet

**Ways in.** Settings opens only from the hub's picture, through the sheet's Settings button (2 taps). The picture is on the hub
alone. Text links (your person sheet, a show's Notifications, the desk's Password row) land at the top with every fold shut.
settings.tsx hasn't changed since 2026-11-09, so the Phase 0 census frame is today's page
(`.ui-atlas/stories/phase0/census/settings-alex.full.jpg`).

| Control, as named | What it changes | Default | Stored | Saves | Verdict |
| --- | --- | --- | --- | --- | --- |
| This phone: Turn on notifications / Not now | whether this phone gets pushes | off until asked | `push_subscriptions`, a row a phone; Not now in localStorage | at once, no Undo | **Keep**, first: Joanna needs it most |
| Couch chat notifications: Every message · Quiet nights · Never | chat pushes on every couch | Quiet nights (Recommended) | `notification_prefs.disabled.chat` and `.chat` | Undo | **Keep**; per couch is missing (§5) |
| Hide scores until I reveal | results wait for your reveal | on | `user_settings.show_results_immediately`, inverted | Undo; asks before turning off | **Merge** with Move along and Keep me live (below). It only works on shows you play ✓ (guard.ts:28-37) |
| Sports scores too | sports results wait too | off | `user_settings.hide_sports_scores` | Undo; never asks | **Merge**, as the same choice's sports line |
| Appearance: Night · Studio · Match phone | the theme | Night (everyone was moved to it, migration 0159) | `user_settings.theme`, and a cookie | Undo | **Keep**, as one row out of Quick settings (Studio waits: BACKLOG 196) |
| Which notifications: six switches | groups of push types | all on | `notification_prefs.disabled`, by type | Undo | the next table |
| Shows that move along by themselves: a switch a show | marks a followed show's new episodes watched as they air | off | `show_follows.keep_up = 'auto'` | asks first; Undo | **Move** to the show, merged with Keep me live |
| What your couch sees: Everything · Just my games · Only what games need; four switches; a live preview | what your couches see about you | Everything | `user_settings.share_*` | Undo | **Drop** the three levels (presets over the switches). **Keep** "Where I am" with the preview. **Merge** "When I'm watching" into it. **Default** GIFs and reactions on (posting one is the choice) |
| Your couches: a row each, Switch couches, Start, Join | opens each couch; which couch the hub shows | the busiest couch | localStorage `gys.couch`, per phone | | **Drop** here: the couch gets its own home and the hub its switcher |
| Your AI for results: ChatGPT · Grok · Ask each time · I'll copy and paste (runners only) | which app Backstage's Ask an AI opens | ChatGPT | `user_settings.ai` | no Undo | **Drop** as a setting. Results settle on their own; the sheet can remember the last app used |
| Take the tour | replays it | | | | **Keep** in one place (the hub's sheet has it too) |
| How each game works | a sheet of six fixed games in Survivor's words | | | | **Move** to each game's How it plays |
| Report a problem | sends a report | | `reports` | | **Keep** |
| Your account: Change password · Link Google · Back to the classic design · The full design | | | | | **Keep** the password and Google, with words that suit an account that only uses Google. **Drop** classic with step C (BACKLOG 45). **Drop** The full design (it opens the 2026-10-22 mock) |
| Sign out | | | | at once | **Keep**, and make it turn off this phone's notifications: it doesn't ✓ (BACKLOG 232) |
| Credits | | | | | **Keep** as a quiet link: TMDB and TVmaze require it |
| Your profile: picture · name · colour | | | `user_pictures`; the username (also every seat and old chat); `user_settings.colour` | the picture at once with no Undo, and Remove doesn't ask; the name with Save; the colour with Undo | **Keep** behind Edit, and say the name is also how you sign in |

**Which notifications, switch by switch** (src/lib/moments.js):

| Switch | Covers | Verdict |
| --- | --- | --- |
| Lineup reminders | reminders before the lock, waiver reminders, your draft turn, waivers' results | **Keep**, named for all it covers |
| Early results are in | who went home, minutes after | **Merge** with Final into one "Results" switch, unless Round 1 finds a reason for two |
| Final results are in | noon the next day, later corrections, predictions graded, flags settled, results you asked for | **Merge** (above). "Flags" is jargon |
| Invites and join requests | invites, someone joined, someone asked to join | **Default** on: someone's waiting on you |
| On the couch | a new game, watch alongs, polls, predictions, bingo | **Keep**: it's the noisy one |
| Backstage (runners only) | results still to fill in the morning after; wiki results to review | **Drop** ✓. Its push tells runners to copy and paste results (db/reminders.js:351-358), which is moot since results settle on their own; `wikiReview` is never sent (BACKLOG 24); it shows to Game admins but goes only to Commissioners (BACKLOG 235) |
| A show's own switches | the same six, off for one show (every season of it) | **Merge** into one list (§2) |

**Problems.**
- **One choice, three controls.** Hide scores (on shows you play ✓), Shows that move along (shows you follow and don't play) and Keep
  me live (the where sheet) all answer "when do results reach me?". With Hide scores off, Settings says results show "everywhere"
  (settings.tsx:117), which isn't true for a show you only follow.
- **One action, many places.** Turning this phone on is in six places with four wordings: "Turn on notifications", "Turn on",
  "Want a nudge?" and "Turn on reminders".
- **Many names.** "Settings" names four screens (yours, Backstage's, the desk's tab, a section of the desk's couch page). "Your
  profile" names two sheets. Your name has five labels: Username, Pick a username, Your name, Signed in as, Name and email.
- **The wrong level.** What your couch sees is one choice for every couch, and so is chat. The hub's couch is kept per phone, but
  Settings words it as yours.
- **Deep.** Every fold is 4 taps. Links land with the folds shut; folds have no anchors.
- **Untrue words.** "Your games are the same in both" (classic lacks Weekly Calls, Bingo and question games). "The bell keeps
  everything" (chat isn't kept). The engine lab's "make one in Settings › Test couch" (gone since 2026-10-31).
- **Saving differs.** The colour has Undo, the picture none. The name needs Save. Your AI has no Undo. Hide scores asks before
  turning off; Sports scores too never asks. "Recommended" is a badge in one place and a word in another.
- **A switch can lie.** It reads On if any of its push types is on, so a type turned off in classic shows On, with no way to see
  or fix it (moments.js:60-64).
- **Acting as someone.** The profile route refuses changes while a site admin acts as you, but /api/me/follows and
  /api/me/push-subscriptions don't check, and /api/me/settings only drops What's New. One rule should cover all four.

---

## 2. You on a show, a couch or in a game

**The show's ⋯ menu** (show-space.tsx, about 526-732; 2 taps). Backstage (runners) · This season in Admin (site admin) ·
Notifications · Invite a friend · How it works · Where you are (players) · then Everything else, a sheet of its own when three or
more of these apply: Plan a watch along, the drafts, Recent changes, Watch privately, Remove from my shows, Leave these games.

**Where you are's "eight controls"** (where.tsx:196-339). On 2026-11-15 the design record handed them to this track
(decisions.md). On a show you watch:
- Close, which throws the draft away.
- A row per aired episode: a tap moves "You're here", as a draft until Save.
- I'm up to date, which silently also turns Keep me live on.
- Keep me live, a switch that waits for Save, unlike every other switch.
- Save · through Ep N, with no Undo.

"Eight" was counted on a 3-episode frame. The real count is 4 plus a row per aired episode: 34 on a 30-episode season. On a show
you play the sheet is a fixed ledger and "Reveal Ep N · every game", because your mark moves only by revealing. Tonight moves the
mark too:
- I watched Ep N (Undo).
- Seen Ep N? Yes / Not yet / Up to… (Yes has Undo).
- Live's Seen it? (no Undo).

| Control | Default | Stored | Saves | Verdict |
| --- | --- | --- | --- | --- |
| Notifications for this show: six switches (every season of the show) | on | `notification_prefs.shows[showId]` | Undo | **Merge** with Settings' list: one list, each moment off for this show. Add **Mute this show**, for a while or for good |
| Watch privately (this season) | off | `show_follows.private` | a toast, no Undo | **Keep**, out of the sub-sheet; offer it in Add a show; hide it when you're on no couch |
| Remove from my shows | | `show_follows.following` | no Undo | **Keep** |
| Leave these games: every game of yours here | | league seats (takeOut) | hold; restorable for 30 days | **Move**: Leave this game on each game; keep Leave all here |
| The episode rows and Save | | `show_follows.seen_through` | Save, no Undo | **Keep**, with Undo |
| I'm up to date | | | | **Merge** into the list as "I've watched them all", turning nothing else on |
| Keep me live, and Settings' Move along | off | `show_follows.keep_up`: ask / auto | Save in one, at once in the other | **Merge**: "When a new episode airs: ask me · mark it watched · nothing" |
| Not yet; Seen it? | | `show_follows.not_yet` | | **Default**: these are answers, not settings |
| Where you are on a game's ⋯ | | the show's mark | | **Drop**: it's the show's. Its line says "Results show as they come" at episode 0 |
| Where you are on a sport whose scores show live | | | | **Drop**: it does nothing there (guard.ts:81-90). Say "Scores show live" |
| Add a show: "Look up all N that are out" | on | | | **Default** on |
| Add a show: the season picker | | | | **Keep** |
| Hide from guide; the guide's filter | | `guide_hidden`; localStorage | Undo; Show again has none | **Keep** where they are |
| "You both watch" Not now | | `show_follows.nudge_off_at`, for good | no Undo | **Default**, renamed, with Undo |
| Sports: Show the score | hidden | sessionStorage, and it moves your mark ✓ | | **Keep**, but say what it moves: every season you follow with that game, through its whole week, never back (api/sports/shown). A question for Round 2 |
| Sports: Watch it as if live | | `sports_recordings` | no Undo | **Keep**, on every finished game, with a list to end any; today it's only the hub's card, for 36 hours |
| Sports: Follow a team | | `team_follows` | no Undo | **Merge** with Add to my shows |

**The couch** (the hub's picture → the couch line → Your couches → the couch's sheet; couch-sheets.tsx):

| Control | Who | Stored | Saves | Verdict |
| --- | --- | --- | --- | --- |
| Which couch the hub shows | anyone on two or more | localStorage, per phone | | **Keep**; **Move** to the hub's header, saved per account |
| Copy or send the invite link; Get a new code | anyone | `couch_invites` | an inline confirm | **Keep** |
| Rename the couch | its owner | `couches.name` | Save, Undo | **Keep** |
| Hand it on | its owner | `couch_members.role` | no confirm, no Undo | **Keep**, with a confirm |
| Leave this couch | anyone | | hold; restorable for 30 days | **Keep** |
| Start a couch; Join a couch | anyone | | | **Keep** on the hub and the switcher. **Drop** the Settings copies: Join is in three places |
| Who can fill in results (couch-wide, set in one season's Backstage) | runners | `couches.results_by_anyone` | an "Undo" that re-sends | **Drop** (default: anyone) or **Move** to the couch (§3) |

**A game, as a player.**
- The game's ⋯: How it plays, Your sheet, Where you are, and Game settings for runners.
- Lock in (every game on the season; Undo for 60 seconds).
- I've watched Ep N · Reveal (that game's seat).
- Join / Ask to join / Take back.
- Leave the pool: a plain confirm, though your picks and streak go for good.

Verdict: **Keep** all, and Leave the pool gets a hold.

**Problems.**
- **Where you are has four names on screen:** Where you are, Where are you?, "Spoiler-safe · you're up to Ep N" and "Through Ep N".
  Sharing calls it "Where I am", and toasts say "you're up to" and "You're through" (BACKLOG 103).
- **One column, two editors that save differently.** keep_up 'ask' is set in the where sheet (with Save); 'auto' only in Settings
  (at once).
- **Levels that don't match.** A show's notifications cover every season. Watch privately and keep-up go back to the defaults each
  season. Leaving is per season, though the server takes you out one game at a time.
- **Deep.** Watch privately, Remove and Leave are a sheet inside a sheet (4 taps). A game's Where you are is 5.
- **Pointers to nowhere.** "Change it in Settings, under Keeping you spoiler-free" ✓ (where.tsx:303; BACKLOG 236). "Watch
  privately… under Everything else", when it's often in the menu itself (sharing.tsx:71).
- **Misleading lines.** The Notifications row's line describes this phone even when the show's switches are all off. Watch privately
  is offered to someone on no couch, with nobody to hide from.
- **Save and Undo differ.** The where sheet's Save has none, though the step 4 spec asked for one. Leave the pool deletes for good
  behind a plain confirm, while restorable leaves are held. Hand it on has no confirm.

---

## 3. Running a game: Backstage, a game's settings, the draft room

**Ways in.**
- **Backstage:** the show's ⋯ → Backstage (3 taps). A yellow plate and a dot on the ⋯ show when a job waits. The strip's and the
  hub's draft plates also lead there.
- **A game's settings:** the game's ⋯ → Game settings (4 taps), or Backstage › Game settings → the game (5). There's no way in from
  the game's card on the Games tab, Tonight's line or a change line.
- **Who:** a Commissioner or Game admin of a game on this couch's season.

**Roles.**
- **The couch's owner** has no Backstage power as owner (the couch is renamed and handed on elsewhere).
- **A Commissioner** does everything.
- **A Game admin:**
  - Results, including the couch-wide Who can fill them in, and One tap;
  - the week's waiver actions, this episode's lock, computer players, join requests and Remind;
  - Undo in Recent changes. By a gap, that includes a Commissioner's settings and role changes ✓ (league-changes.ts:94-105;
    BACKLOG 233).
- **A player** has no Backstage, and reads Recent changes.

| Page | Holds today | Verdict |
| --- | --- | --- |
| **Home** | Needs you's jobs: start the draft, invite people, a join request, who went home, full scores. Reminders: "Remind them" pushes everyone with an open move, at most every 4 hours, unlogged. Six fixed rows, shown whether they apply or not: Results, Waivers, Scoring rules, Members & roles, Game settings, Recent changes | Retire or thin the place (below); jobs to the strip. **Drop** the results jobs where the bot runs the season. Remind: **Merge** into the jobs, or **Default** (the hourly reminders already go) |
| **Results** | The quick check: Ask an AI, or enter who went home yourself → preview → apply to N games. How results get in: Copy and paste (not really a choice), One tap ($1 a season, free in beta), Autopilot ("Coming soon"). Who can fill them in (couch-wide). Corrections kept as house rulings; flags | **Drop** for seasons the bot runs. **Keep** "Enter who went home yourself" and house rulings as the runner's override, **Move**d to the episode's page. **Drop** How results get in until the paywall is designed (BACKLOG 113). Who can fill them in: **Drop** (default: anyone) or **Move** to the couch |
| **Waivers** | The week's window: open, change or turn off, with three presets and Something else. Pick for them. Run now (with a preview). The last run's Undo. The settings sheet (Commissioner): when they start; the feel (Casual · Balanced "Suggested" · Competitive); Fine-tune (when someone's out, the windows, optional swaps, timing rows that look like settings but are read only, the fallback pick). What players see | **Keep** the week's actions, **Move**d onto the game. **Merge** the settings sheet with the game's "Replacing people who leave" into one control. Make the timing rows real, or **Drop** them. **Default** the fallback pick on. **Merge** What players see into How it plays |
| **Scoring rules** | How it works. Make it ours (the couch's copy of the rulebook for every game on the season). The show changed: add or skip. What counts; own moments; What scores (the bot's suggestions); Add a moment. Each game's points (only games scored by moments) | **Move** the points to the game. **Move** the rulebook copy to a couch-and-season section, for the Tinkerer only. **Merge** How it works with the ⋯'s |
| **Members & roles** | Who runs what: a Game admin switch per person per game. Players, with a role sheet that applies to all their games you run. Invite. Remove from this show's games, or Leave (hold; 30 days). Computer players: add one before the draft, change its level, take it out (a hold that can't be restored) | Per game: who's playing, their role, and **remove from this game**, which is missing. **Drop** Invite and Leave (duplicates). **Move** computer players to the game |
| **Game settings, the list** | Running rows; a night's games folded; Finished folded, with Archive all. Competitive mode ("Lock it down"): one switch for every game you run. Archive or delete | **Keep** only as an index, if Backstage stays. **Move** Competitive mode to the couch-and-season section, renamed and off by default. **Merge** archive/delete into the game's Stop |
| **A game's settings** (Round 4, 2026-11-19) | The title card. This episode's lock: Lock now / Open it again / Back to Auto. How moves lock: Together or At your own pace (fixed), and late moves. Who scores each week; On the bench. Team size (display only). The questions. Who can join. How long. Replacing people who leave (a link). Archive or delete | **Keep** as the main home. Team size becomes a real control before the draft (the server takes it). Put the lock on the strip too (BACKLOG 157) |
| **Recent changes** | Everyone on the couch reads it. Undo on a line, for whoever runs every game the change touched | **Keep**, renamed. Each line should open its game's settings (Round 4's spec; not built) |
| **Draft settings** (the room's gear; the Commissioner's until the draft is done) | When it starts; the pick timer; when the timer runs out; Shuffle order and Undo last pick, neither of which can be undone | **Keep** in the room. Link it both ways with the game's page, in the wizard's words |

**Backstage as a place.**
- **For keeping it:** a few things sit above one game: the couch's copy of the rulebook, who fills in results, One tap,
  competitive mode, roles across games, the change log, join requests. And the Tinkerer, running three games, wants one private
  place.
- **Against it:**
  - Results settle themselves now.
  - Round 4 moved each game's settings onto the game ("people think of a game, not of Backstage").
  - It's three taps under a ⋯, behind a name a casual starter won't guess (BACKLOG 164: "Joanna won't find Backstage").
  - What's left of its jobs is per game.

**Problems.**
- **One setting, two homes.**
  - Waivers' settings sheet and the game's "Replacing people who leave". The line's link opens Waivers on whichever game Waivers
    picks, and it isn't tappable for a Game admin or while the game is locked down, though waivers aren't frozen.
  - Archive is in three places: the list, the game's settings, and the Games tab. Only the Games tab's has Undo.
  - Invite, Leave and How it works are each in two places. Two different screens are titled "Game settings".
- **The wizard and Backstage name the same things differently.**

  | Start a game says | Backstage says |
  | --- | --- |
  | They ask first | Ask me first |
  | Whenever one goes home · When your team is short · In set windows | Replace right away · Only when short · Wait for a waiver window |
  | Fewest points; Claims close 24 h before | Lowest score first; Picks due 1 day before |
  | A clock on each pick: None · 1 min · 2 min; Someone away: Use their list | Pick timer: Off · 2 min · 60 sec; When the timer runs out: Pick from their queue |
  | Together: "when it airs on TV", over an honour-system default | Together: "One deadline… when it airs", over the same default |

  The default is called "Recommended", "Suggested" and "(recommended)". One switch has three names: Competitive mode, Lock it down,
  Locked down.
- **Untrue or dead.**
  - Recommended is hard-coded at 3 starters, 2 on the bench and a team of 3 ✓ (backstage-games.ts:494; BACKLOG 234), so a
    Salary cap game shows Changed.
  - A game made "Till <phase>" reads "to the season's end".
  - Waiver windows "Every N" have no way to set N.
  - Autopilot is priced and "Coming soon"; Copy and paste is a choice that isn't one; the results captions name three fixed games.
  - "Points are always the couch's to change" (only games scored by moments); "rules of its own from the classic app".
  - "The draft needs its cast · Add it in Backstage", though Backstage can't add a cast.
  - Needs you asks for results on seasons the bot runs.
  - A runner whose games here are all archived can't reach Bring a game back.
  - Team size says "Set in the draft room", where there's no such control.
- **Undo that isn't.** The lock, pace, the questions, Lock it down, who fills in, Bring back, computer players, Drop the ruling,
  Shuffle and Undo last pick: the toast re-sends the old value or offers nothing, and their change lines carry no Undo. Taking out
  computer players is held but can't be restored. Start the draft is tier 2 with no preview. Remind pushes other people and leaves
  no line.
- **Missing.** Renaming a game. Removing someone from one game only. Changing after the start what safely could change (below).
  BACKLOG 164, 165 and 166.

**Options the engine reads that no screen can change after the start:**
- **Safe to offer:**
  - team size (before the draft); lineups hidden until the lock; when the draft opens;
  - waiver timing: claims close, who goes first, free agency, the "when short" threshold, windows every N, own and daily waivers;
  - the late lock's hours; ending at a phase.

  (`allowLateJoiners` is already Who can join.)
- **Would move standings** (a preview, then confirm, or BACKLOG 231's vote):
  - points for picks, lines and bets;
  - captain, multipliers, a joiner's handicap; bounties, parlays, reverse order, best ball;
  - a pool's lives, buybacks, mulligans and second pick;
  - the finale predictions, secret roles, twists, stages.
- **Moot after the draft:** the draft's draw, picking across groups, needs, IR, slots, auction and budget, keepers, group slots.
- **Fixed by design:** ownership (shared or exclusive), own pace, calls, a pool's survival rule.

**Only in classic** (src/components/setup). They go with step C unless a round brings one over:
- **The game:** its name; roster size, ownership, and hiding starters until airtime.
- **Waivers:** "down to", episodes between windows, the claim deadline, waiver order, free agency.
- **Points:** pick'em points; predictions on or off and their points; finale predictions.
- **Seats:** handing a seat over (a computer seat to a person too); Activate for a late joiner; placeholders; seat names and colours.
- **The rest:** cast and tribes, linked leagues, backup and restore, results live or catch-up.

---

## 4. The site admin's desk

**Map.** Three tabs (Inbox, Find, Settings) and 23 pages. Each thing has a page:
- a person, a couch, a game, a report, a show (with its research sites and art), a season;
- a season's own pages: Setup, Research and the bot, Cast, Bingo bank, an episode, a castaway;
- a fact, a rulebook, the library, and New show.

The ways in are the hub sheet's Admin row and the show menu's "This season in Admin". A season is Admin › Find › Shows › the show ›
the season, deeper than its route's depth says.

| # | Setting | Where | Default | Verdict |
| --- | --- | --- | --- | --- |
| S1 | Who gets in: approve · invites · open | Settings | invites | **Keep** |
| S2 | Game previews: off · admins · everyone | Settings | off in production | **Keep**. Its budget warning should get its own mark, not the "changed" dot |
| S3 | Sources to confirm a result: 2 · 3 · 4 | Settings | 2 | **Default** 2. Undisputed results reach games whatever it says now, and its words describe the old rules |
| S4 | When answers disagree (a second look an hour later) | Settings | off in code; on in production since 2026-11-20 | **Default** on. Flip the code's default. HANDOFF's Production list still says it's off (BACKLOG 185 was corrected 2026-11-20) |
| S5 | Who fills in results on new couches | Settings | anyone | **Default** |
| S6 | Autopilot: a list of the seasons whose bot is on | Settings | | **Merge** into one Research bot page |
| S7 | Which AI our bot asks: ChatGPT · Claude, and a dimmed Gemini | Settings | ChatGPT | **Keep**, on that page, with the per-run choices that have no screen today. **Drop** the Gemini card |
| S8 | Rulebooks for every season at once | Settings | on | **Move** to a script, as the game-specs flag is |
| S9 | Our usual bot schedule | only from inside one season's Research | six runs | **Move** to the Research bot page |
| | The library row | Settings, and Find | | **Drop** from Settings |
| S10–S11 | A season's status, airing, episodes, TV listing | Setup | | **Keep** |
| S12 | Who decides results: sources that agree · you decide | Setup | sources | **Drop** (BACKLOG 168) after its data step: Survivor 51 is on You decide, and `results_admin_since` still filters |
| S13–S14 | Runs on its own; its runs | Research | off; our usual | **Keep**, and list them on the Research bot page |
| S15 | Episode length | the Research rail | 60 minutes | **Move** to Setup's schedule |
| S16 | Hold starting groups until Episode N | Cast | off | **Keep**: it guards a spoiler |
| S17 | Leagues play by it (a season's rulebook) | the rulebook | off | **Drop**: it's disabled while the flag is on, and the server ignores it |
| S18 | Its words | the show | | **Merge** with the rulebook's cast words |
| S19–S20 | Research sites; art and framing | the show | | **Keep**, and drop "Its wiki" as a source |
| S21 | No art or photos | art | off | **Merge** its two controls into one, worded positively |
| S22–S24 | A rulebook's Lock; a starting point; a castaway's Lock | | | **Keep** |
| S25 | A couch's Who fills in results | the couch | anyone | **Keep** as the override, in the couch's words, with Undo |
| S26–S27 | A person's signing in; a seat's role | the person; seats | | **Keep** |
| S28 | View as: an unlabelled eye | the tabs' header | | **Move** to a labelled row |

**Problems.**
- **The old rules, still on screen.** Results are described by the old rules in four places: S3's sheet, Setup's line
  (setup.tsx:319), the episode page's "nothing reaches the games until you accept it" (episode.tsx:182), and the Inbox's
  "confirmed by 2+ sources" (desk.tsx:299).
- **Scattered.** The bot's settings sit in five places.
- **Names.**
  - "Settings" and "Admin" each name two or more things.
  - "League" is used for games.
  - "canonical", "house rulings" and "Holdings check" are engine words.
  - "ChatGPT" is written in even when the bot asks Claude.
- **Saving.** Three Undos the server keeps aren't offered in any toast. There are four ways to confirm. A season's Delete sits at the
  foot of five pages. The changed-dot is reused for a budget warning.
- **Dead controls:** the Gemini card, Leagues play by it, and the library's proposed shapes (which look like buttons).
- **Hidden.**
  - View as, the engine lab and New show are hard to find.
  - Settle again and the catch-up hold are reachable only by API or script.
  - Three Inbox rows lead nowhere useful.
- **Phone and theme.** Date pickers are forced dark in Studio, and there's no wide layout (BACKLOG 197).

**Stored but unreachable.**
- Read by the server, set by no desk control:
  - the per-run AIs (`bot_ai_runs`);
  - `tiebreak_from` (only Settle again's route sets it);
  - `catchup_hold` and the game-specs flag (scripts);
  - Google sign-in (environment keys).
- Set on the desk, read by nothing that matters now: `rulebook_live` while the flag is on; `results_by` (words, and one sync clause);
  `confirm_at` (nearly).

**What an admin pass would most improve** (the auditor's eight):
1. One results model, explained once.
2. One Research bot page.
3. One-time switches out of Settings.
4. Plain words, one name per thing.
5. One way to save.
6. Hidden things made findable.
7. A game's settings on its desk page.
8. Then a desktop layout.

---

## 5. Across the app

### One thing, many homes

| The thing | Its homes today |
| --- | --- |
| Turn this phone's notifications on | Settings (two buttons), a show's Notifications, the bell, the reminder ask, the tour |
| Results wait for me, or don't | Hide scores and Sports scores too (Settings); Shows that move along (Settings); Keep me live (Where you are) |
| Notification switches | Settings' six; each show's six |
| Your couches, Start, Join | the hub's sheet, Settings' fold, the hub's foot (Join is in three places) |
| Leave these games | the show's ⋯; Members & roles |
| Invite | the show's ⋯, Members & roles, a Needs-you job, the couch's sheet |
| How it works | the show's ⋯, Scoring rules, Settings' How each game works |
| Replacing people who leave | the game's settings, Waivers' settings sheet, the wizard (two rows) |
| Archive a game | the list, the game's settings, the Games tab |
| Who fills in results | Backstage › Results, the desk's couch page, the desk's Settings (for new couches) |
| Who settles results, in the old rules' words | the desk's Settings, Setup, the episode page, Backstage |
| Seat roles | Members & roles; the desk's seat sheet |

### One thing, many names

| The thing | Its names today |
| --- | --- |
| How far you've watched | Where you are, Where are you?, Spoiler-safe · you're up to Ep N, Through Ep N, Where I am, You're up to, You're through |
| Settings | your Settings; Backstage's Game settings (two screens); the desk's Settings tab; a section of the desk's couch page |
| Admin | the desk (on screen); the Game admin role |
| Your name | Username, Pick a username, Your name, Signed in as, Name and email |
| The default | Recommended (a badge), recommended (in a line), Suggested, (recommended) |
| Freezing rules and joining | Competitive mode, Lock it down, Locked down, Back to casual |
| A game | game; league (on the desk, and in old words) |

### Saving and Undo, as they are

- At once, with a real Undo: most switches.
- At once, with an "Undo" that only re-sends the old value: the lock, pace, the questions, Lock it down, who fills in.
- At once, with no Undo: the picture, Your AI, Watch privately, Remove from my shows, Hand it on, Follow a team.
- A Save button: your name, Where you are, and on the desk Name, When it airs, Its words and run timings.
- A preview, then confirm (tier 2): rescoring, Run now, applying results.
- Hold to confirm (tier 3), a GuardSheet, a second tap within 5 seconds, or nothing at all (a library rulebook's Delete, mid-page).

### Stored with no control, or a control nothing reads

- **No control in the new design:**
  - single push types (classic's 22 switches and its test push);
  - `user_settings.tz` (set from the phone, silently);
  - a display name apart from the username (classic only; the new rename overwrites it);
  - `whats_new_seen` and `explainer_seen_at` (classic);
  - `nudge_off_at` (nothing clears it);
  - `keep_up = 'ask'`, set only from the where sheet;
  - per-phone memories with no reset (Not now, the reminder ask, the hub's couch);
  - and the desk's four in §4.
- **Read by nothing:**
  - `user_settings.share_ratings` (BACKLOG 199);
  - `rulebook_live` while the rulebooks flag is on;
  - `results_by` (words, and one clause);
  - the Gemini card, Hide names and the Autopilot row store nothing.

### Missing: settings people would expect

- **You:**
  - an email to add or change, for resetting a password: username accounts can't reset their own today (BACKLOG 185);
  - delete my account (the desk can);
  - my phones: which get notifications, turn one off, sign out everywhere (a password change leaves other phones signed in);
  - a test notification (the route exists); installing the app; unlinking Google.
- **You on a show:**
  - mute a show, for a while or for good; hide results for one show only; add a show privately;
  - turn a kind of notice off from the bell; a push for Keep me live (BACKLOG 189);
  - change your mark from Where everyone is.
- **You on a couch:** chat notifications per couch; what this couch sees about you.
- **You in a game:** leave one game; notifications per game (the One-Gamer).
- **A game, for whoever runs it:**
  - rename it; remove one person from one game; hand a seat to someone;
  - the safe options after the start (§3); BACKLOG 164, 165 and 166;
  - BACKLOG 230 (a new moment mid-season: count it from the start, from the next episode, or let the players vote) and 231 (the
    players vote on a change to the game's settings).
- **The desk:** a game's settings on its page; Settle again and the catch-up hold as actions.

### Names to make literal

The suggestions are the auditors'. They go through Impeccable's clarify in their round.

**Running a game**

| Today | What it is | Suggested |
| --- | --- | --- |
| Backstage | the controls for whoever runs a game | Manage this game · Games you run |
| Needs you | jobs waiting on you | To do |
| Recent changes | a log of changes, with Undo | Change history |
| Commissioner / Game admin | runs everything / helps with results, waivers and this episode's lock | Commissioner / Helper (or Co-commissioner): Round 3 decides |
| Make it ours / Follow it again | the couch's own copy of the show's rulebook | Customize the rulebook / Use the show's rulebook |
| Competitive mode / Lock it down | freezes the rules and joining for the season | Freeze rules and joining |
| Waivers' feel: Casual · Balanced · Competitive | a preset bundle of waiver rules | Lenient · Standard · Strict |
| Fine-tune | every waiver rule | All waiver rules |
| Fallback pick | the top free player, for anyone who forgets | Auto-pick if someone forgets |
| Free agency | open pickups until airtime | Open pickups |
| House ruling / Drop the ruling | keep your result after a correction / take the correction | Keep our result / Use the corrected result |
| Hand it on | give the couch or the game to someone | Make someone else the owner / the Commissioner |

**Your settings**

| Today | What it is | Suggested |
| --- | --- | --- |
| Quiet nights | no push for a chat message that might spoil an episode you haven't seen | Skip possible spoilers |
| Hide scores until I reveal | results wait until you've marked the episode watched | Hide results until I've watched |
| Sports scores too | | Hide sports scores |
| Night · Studio · Match phone | | Dark · Light · Same as my phone |
| Lineup reminders | reminders before moves lock, your draft turn, waivers | Reminders before moves lock |
| On the couch | new games, polls, predictions, bingo, watch alongs | Your couch's activity |
| What your couch sees | | Privacy: what your couch sees about you |
| Everything else (Settings; the show's menu) | | More settings / More for this show |

**A show**

| Today | What it is | Suggested |
| --- | --- | --- |
| Shows that move along by themselves | new episodes marked watched as they air | Mark new episodes watched automatically |
| Keep me live | asks after each new episode whether you've seen it | Ask me after each new episode |
| I'm up to date | | I've watched them all |
| Where you are / Spoiler-safe · you're up to Ep N | how far you've watched | Episodes I've watched / Watched through Ep N |
| Watch privately | your couch doesn't see this show or how far you are | Hide this show from my couch |
| Leave these games | every game of yours on this show | Leave all my games on this show |
| Watch it as if live / Keep hiding | | Hide the score until I've watched / Keep it hidden |
| Not now (You both watch) | for good | Don't suggest this again |
| Follow (a team) | puts their games in your guide | Show their games in my guide |

**The site admin's desk**

| Today | Suggested |
| --- | --- |
| The desk / Admin | Site admin |
| Inbox · Find · Settings (its tabs) | To do · Search · Site settings |
| Our bot · Autopilot · Run now · Our usual | Research bot · Automatic research · Research now · Default schedule |
| Act as them · View as | Sign in as <name> · Preview as a player |
| Who gets in · Let in | Sign-up approval · Approve |
| Take it over · Its words · Running it · Made-for games | Make official · Show terms · Manage season · Suggested games |

"Couch" and "game" stay: they're the product's own agreed words. The show's TV-flavoured content headings (Previously on, Up next,
On TV) are content, not settings, and stay unless the user says otherwise.

---

## 6. Found along the way

These go to the backlog to be fixed apart from the redesign (BACKLOG 232–236, "Now"):
- 232: signing out leaves the phone getting your notifications ✓.
- 233: a Game admin can undo a Commissioner's changes ✓.
- 234: Recommended is hard-coded ✓.
- 235: the results-to-fill-in push is moot ✓.
- 236: Where you are points to a heading that doesn't exist ✓.

The smaller ones wait for their round and are listed in the plan's "Noticed, not fixed".
