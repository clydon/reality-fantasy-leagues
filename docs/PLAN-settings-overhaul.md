# Settings: the overhaul

> **Status (2026-11-20): Round 1 built on branch settings-plan (lane rfl-settings) and reviewed: the user took all four picks.**
> PFD 82 and Impeccable 33/40 after one batch of fixes (the bar: 80 and 32). Next, before it merges: the browser halves of
> check-new-settings, -notify and -sharing for the new screens. Not merged; migration 0447 not on production.
>
> **Round 0 (2026-11-20): done and decided.**
> - **The cuts and adds:** approved. The user took every recommendation, added A5, and settled C8 (Grok goes too).
> - **Round 0's choices**, on its story https://claude.ai/artifact/UkbTP7G4f7uQhVqp32UMNm:
>   - Shape 1, with Your settings' first view as groups;
>   - one gear on every bar;
>   - all four names.
> - **Round 1's bar:** PFD 80 or more and Impeccable 32 or more out of 40.
>
> "What you decided", below, and design-round/decisions.md have them. Nothing in the app is built yet. Every setting, where it lives and a verdict on each are in the audit:
> [design-round/settings-audit.md](design-round/settings-audit.md). The proposals page the user answered on:
> https://claude.ai/artifact/3VjAovJaVsBkfZcLEqoY4V. The lane: `rfl-settings` (port 3018, database rfl_settings, branch
> settings-plan).

## What you asked (2026-11-20)

- "a full settings overhaul": your settings, Backstage and the admin's. "We need them to be much much much more intuitive than it
  is today... dont feel locked into the design we have today if we can figure out something better."
- "a full audit of the settings menus", and "identify if theres any 'missing' settings, or settings that really arent needed... we
  want all options on the table... whether that means reducing or just organizing... we must make this feel a whole lot better."
- "rename backstage. i think its too cheeky of a name. we can be more literal. same for any other settings name."
- The backend changes only where a design calls for it. The admin's comes last ("its just me"), with an eventual pass.
- The philosophy: UIUX Studio's "Eight steps to improve app settings UX", minus its user testing.

## The guideline this follows

It's the same guideline the whole app's game screens went through (the design round, 2026-11-14 to 11-17):
- **[DESIGN-PROCESS.md](DESIGN-PROCESS.md):**
  - Intent, then Perception-First Design, then Impeccable, once each per page; then one check and one batch of fixes.
  - The structural lens: every surface, and every level you can drill to, gets a verdict (keep, repaint, restructure, new display,
    new screen).
  - A disagreement goes to you as a named choice.
  - A screenshot story at 390, then a pause.
- **[DESIGN-ROUND-PACKET.md](DESIGN-ROUND-PACKET.md), "The round's frame":**
  - the five lenses and three flavors;
  - the lay-of-the-land and busy tests;
  - soul, not sterile;
  - borrowing patterns from apps that already solve our problems.

  Its order put this work last, as step 12 ("the wizard, game settings, onboarding, couches, account settings"). The wizard and
  game settings have since been redone (Start a game, 2026-11-19), and step 4 handed this track "Where you are's eight controls"
  (decisions.md, 2026-11-15).
- **[APP-REVIEW-DESIGN-BRIEF.md](APP-REVIEW-DESIGN-BRIEF.md):**
  - Overview first, depth on demand.
  - Serve the watcher, the occasional player, the solo player, the group, the serious player, and "commissioners and operators...
    without the management workflow overwhelming ordinary watching and playing".
  - No casual/expert switch.
- **The settings philosophy you picked** ([uiux.studio/blog/app-settings-ux](https://uiux.studio/blog/app-settings-ux), minus step 8,
  testing with users):
  1. Audit every setting.
  2. Group by what people want to do, not how the product is built.
  3. Label the outcome in plain words.
  4. Choose smart defaults, so fewer people need settings at all.
  5. Use the right control for each setting.
  6. Add search when the list is long.
  7. Confirm changes clearly, with Undo.

### The settings rules

The rules for this plan, merged from the sources above and your earlier decisions. Each round's Intent spec applies them, and any
of them can be argued with:

1. **A setting lives on the thing it's about:** you, a show, a couch or a game, with one door to each that works the same
   everywhere. Inside a home, group settings by what people want to do (the article's step 2). *(Round 4, 2026-11-19: "people think
   of a game, not of Backstage". You approved it.)*
2. **Each setting earns its place, or it goes.** A control stays only if people really disagree about the right value, the wrong one
   would cost them something they'd notice, and they'd think to look for it. Otherwise the app picks well and says so. *(Your ask;
   the article's steps 1 and 4.)*
3. **Plain, literal names, saying the outcome; a short line under anything that could be misread; no double negatives.** *(The site
   mock's settings principles, 2026-10-22; "rename backstage", 2026-11-20; the article's step 3.)*
4. **Value first.** A row says its current value; a tap opens its control in place; a fixed setting says why it's fixed. *(Settings
   D, 2026-10-31; Round 4.)*
5. **Recommended, marked the same way everywhere;** a changed setting keeps a dot and offers Reset to recommended. *(The site mock;
   the desk's regroup, 2026-10-28.)*
6. **One way to save, set by how far a change reaches:**
   - Just you: it applies at once, with a real Undo.
   - Others, but reversible: at once, with Undo and a line in the change history.
   - It moves standings: a preview, then confirm, then Undo until the next episode.
   - Hard to undo: a sentence saying what happens, hold to confirm, restorable for 30 days.

   *(Guards by blast radius, 2026-10-22; the article's step 7.)*
7. **Deleting comes last, in red, named for its thing;** never among everyday settings. *(The desk, 2026-10-28; the article's
   anti-patterns.)*
8. **Settings use ordinary controls.** A switch for on or off, a list for one of several, a confirmed button for anything
   destructive (the article's step 5; Impeccable's Operate mode). The Lower Third look comes in through type, colour and density,
   never as costume. A runner's options never spill onto a player's screen.
9. **Every lens and flavor:** own pace and live, spoilers (what a setting's words reveal, and when), sports' words and scale, story
   shows, someone solo, someone who only watches, someone on two couches.
10. **Phone first at 390:** 44 px targets and 3:1 edges (BACKLOG 34, 105).

Two of the article's defaults would overturn decisions you've already made, so yours hold:
- **Sharing.** Seeing what your couch watches is the app's purpose, so sharing stays on by default (2026-10-22).
- **Theme.** Everyone is on Night (2026-11-01), rather than following the phone.

## What's wrong today

1. **Settings are filed by when they were built, not by what they're about.**
   - One show's settings for you sit in three homes: the show's menu, Where you are, and Settings' folds.
   - A game runner's sit in six: Backstage's pages, the game's ⋯, the draft room, the waivers sheet, the couch's sheet, and two rows
     of your own Settings.
   - There are about 25 places in all, with about 150 controls that act like settings.
2. **The same choice appears in several places, under different names.**
   - Turning this phone's notifications on: six places, four wordings.
   - "Don't hide results from me": three controls in three vocabularies. The main one, Hide scores, does nothing on a show you only
     watch ✓.
   - "Settings" names four different screens, and "Admin" is both the site's area and a game role.
3. **Many controls no longer do much.** Results now settle on their own. That leaves Backstage's Results page, its results jobs,
   "Who can fill in results", "Your AI for results", the Backstage notification switch ✓ and the desk's "Who decides results" with
   little or nothing to do. Others are presets over switches (sharing's three levels), or one choice split in two (early and final
   results).
4. **Things people expect are missing.**
   - For you: an email to reset a password, deleting your account, seeing or turning off your other phones.
   - For a show or a couch: settings per couch (chat, privacy), muting a show for a while, leaving one game rather than every game
     on a show.
   - For whoever runs a game: renaming it, removing one person from it, changing its safe options after the start.
5. **Saving behaves differently from control to control.** Some Undos are real, some only re-send the old value, and some are
   missing. There are four ways to confirm. "Recommended" is a badge, a word or "Suggested", and its hard-coded values mark some
   unchanged games as Changed ✓.
6. **The names are playful or insider:** Backstage, Quiet nights, Shows that move along by themselves, What your couch sees, Keep me
   live, Make it ours, Lock it down, waivers' "feel" and Fine-tune, Our bot, Act as them.
7. **Things are deep.**
   - Settings opens only from the hub's picture, and every fold is 4 taps away.
   - Links into Settings land with the folds shut.
   - Waivers' Fine-tune is about 6 taps.
   - A game's settings open only from the game's ⋯: not from its card, Tonight, or a change in the history.
8. **Bugs turned up along the way.**
   - Signing out leaves the phone getting your notifications ✓.
   - A Game admin can undo a Commissioner's setting changes ✓.
   - The results-to-fill-in push still tells runners to copy and paste ✓.
   - A pointer leads to a heading that doesn't exist ✓.

   They go to the backlog now (below), apart from the redesign.

✓ = checked by hand in the code, not only by an auditor.

## The direction: cut, re-home, rename

**1. Cut.** Every setting gets a verdict (the cut list below). The aim is fewer settings, not just tidier ones. If every
recommendation holds:
- your Settings drops from about 30 controls to about 15, before any of the additions below;
- a show's settings for you, from about 20 to about 10;
- running a game loses its results controls and its duplicate homes.

**2. Re-home.** Four homes, each with one door, opened the same way everywhere:

| Home | Its door | What lives there |
| --- | --- | --- |
| **You** | your picture | your account; when results reach you; notifications on this phone, and which ones; privacy; appearance; help. Grouped by what you want to do, the most-used first |
| **This show** | the show's ⋯ | the episodes you've watched; what happens when a new one airs; this show's notifications (including mute it, for a while or for good); hiding it from your couch; removing it; leaving its games |
| **This couch** | the couch's name, wherever it shows | who's on it; invite; this couch's chat notifications; what it sees about you; leave. For its owner: rename, a new code, hand it on |
| **This game** | its ⋯, its card, Tonight's line, a change in the history | for a player: How it plays, your sheet, leave this game. For whoever runs it, everything about it: Round 4's page grown to take in who's playing and their roles, waivers, points, computer players, the draft's settings, the change history, and stopping the game |
| **The site** | its own pass, last | |

**Decided in Round 0 (2026-11-20): one gear on every bar** (the hub, a show, a couch, a game) opens that thing's own page above,
replacing the doors in this table. The ⋯ keeps only things to do.

**You** also gets a short **"Changed elsewhere"** list: every show, couch or game where you've changed something, each a link.
"Where did I turn that off?" then has one answer.

**3. Rename, and settle how things behave.**
- Literal names: the audit's list of proposals, put through Impeccable's clarify.
- One way to save, by how far a change reaches.
- Recommended and Reset everywhere.
- Every link into settings opens the exact setting, already unfolded.
- Search, if a list is still long after the cuts (the article's step 6). It's probably needed only for whoever runs games and the
  desk.

### What happens to Backstage (a named choice for you, in Round 0)

- **A. Retire it (my recommendation).**
  - Everything about one game moves to **Manage this game**, on the game itself.
  - The few things that cover a couch's whole season (its own copy of the rulebook; freezing rules and joining) become one short
    section, reached from any game you run there.
  - A runner's jobs (start the draft, answer a join request) come to the strip like any other move.
  - Each game keeps its change history, and the couch-wide one stays on the show's ⋯.

  Why: results settle themselves now, its remaining jobs are per game, and it sits three taps under a ⋯ behind a name Joanna won't
  guess.
- **B. Keep a thin hub, renamed** (say, "Games you run"): a list of the games you run on a show, with their jobs, each row opening
  the game's own page. It suits the Tinkerer, who runs three games at once.
- **Either way the word goes.** "Manage this game" and "Games you run" are the leading candidates. The roles need clearer names too:
  Commissioner and Game admin are hard to tell apart, and "Admin" collides with the site's. Round 3 settles those words.

### The shapes Round 0 shows you

Grey boxes at 390, on the same situations, so they compare fairly:
1. **Homes by subject (my lean):** the four homes above, each opened from its subject.
2. **One Settings, scoped:** a single Settings screen for everything. It opens on the part for wherever you came from, with You ·
   This show · This couch · This game as tabs.
3. **Ask, don't file:** Settings leads with the questions people come with ("Fewer notifications", "Avoid spoilers", "I'm behind on
   a show", "Change my name", "Leave a game or couch", "Run my game"). Each opens just the controls that answer it, wherever they
   live.

The shapes can combine: for example, 1, with 3's questions at the top of You.

## The proposed cuts

Numbered so you can approve them by number ("yes to all" is fine). Each round's Intent spec confirms its own. The audit has every
setting's reasoning.

**Approved 2026-11-20**, all as proposed. The user's answer: "Settings proposals: yes to your recommendations, except yes to A5.
Let's talk about C8." C8 was then settled: drop the setting and Grok too, leaving one ChatGPT link (its row). C1 and C29 still get
pictures in Round 0 before they're built.

**You**

| # | Today | Proposal |
| --- | --- | --- |
| C1 | Hide scores until I reveal · Shows that move along by themselves · Keep me live | **One choice**, "When results show": an account default (wait until I've watched / straight away), with exceptions per show. Sports scores too becomes its sports line. *Backend: the guard reads one setting; today Hide scores only works on shows you play* |
| C2 | Early results · Final results notifications | **Merge** into one "Results" switch |
| C3 | Invites and join requests notifications | **Default** on, with no switch: someone's waiting on you |
| C4 | The Backstage notifications switch | **Drop**, and stop its push (BACKLOG 235) |
| C5 | Lineup reminders | **Keep**, named for everything it covers (your draft turn and waivers too) |
| C6 | What your couch sees: three levels and four switches | **Drop** the levels. **Keep** "how far I've watched", with the live preview. **Merge** "when I'm watching" into it. **Default** GIFs and reactions on (posting one is the choice) |
| C7 | Settings' Your couches fold | **Drop** from Settings: the couch gets its own home, and the hub keeps its switcher |
| C8 | Your AI for results | **Drop** the setting, and **drop Grok** (the user, 2026-11-20: "We've pretty consistently been using ChatGPT, so i think we should drop grok and just have the chatgpt link"). The Ask an AI sheet has one link, Open in ChatGPT, with "Copy the question" kept as the quiet fallback for any other AI. Its reach: the Settings fold (settings.tsx); the sheet's APPS and choice logic (ask-ai.tsx, data.ts `useAiChoice`); `chatLink`'s Grok branch (src/lib/ai-brief.ts); the profile route's `ai` (profile.ts `AI_CHOICES`); check-new-settings.js's AI cases. `user_settings.ai` is then unread: drop it with BACKLOG 199's tidy. Built in Round 1 |
| C9 | How each game works | **Move** to each game's How it plays |
| C10 | Back to the classic design | **Drop** with step C, after Dec 16 (BACKLOG 45) |
| C11 | The full design (a link to the old mock) | **Drop** |
| C12 | Appearance in Quick settings | **Keep**, as one row with its value |
| C13 | Take the tour in two places | **Keep** one |

**This show**

| # | Today | Proposal |
| --- | --- | --- |
| C14 | Where you are: a row per episode, I'm up to date, Keep me live, Save | **Keep** one list of episodes with "I've watched them all" at its top, and Save with Undo. I'm up to date stops switching anything else on |
| C15 | Keep me live, and Settings' Move along | **Merge** (C1's per-show part): "When a new episode airs: ask me · mark it watched · nothing" |
| C16 | This show's six notification switches | **Merge** with Settings' list into one list (each moment off for this show), and **add** Mute this show, for a while or for good |
| C17 | Watch privately, a sheet inside a sheet | **Keep**, one level up. Offer it in Add a show; hide it when you're on no couch |
| C18 | Leave these games (every game on the show) | **Move** to "Leave this game" on each game, keeping "Leave all my games here" on the show |
| C19 | Where you are on a game's ⋯ | **Drop**: it's the show's |
| C20 | Where you are on a sport whose scores show live | **Drop**: it does nothing there. Say "Scores show live" |
| C21 | Add a show's "Look up all N that are out" | **Default** on |
| C22 | "You both watch"'s Not now, which lasts for good | **Default**, renamed, with Undo |
| C23 | Following a team, and Add to my shows (sports) | **Merge**: one way to follow |
| C24 | Watch it as if live, only on the hub's card, for 36 hours | **Keep**, on every finished game, with a list to end any |

**This couch**

| # | Today | Proposal |
| --- | --- | --- |
| C25 | Which couch the hub shows, kept per phone | **Keep**, in the hub's header, saved for your account |
| C26 | Couch chat notifications, one choice for every couch | **Move** to each couch, with an account default (new storage) |
| C27 | Who can fill in results | **Drop** (default: anyone). The desk keeps its override |
| C28 | Hand it on, with no confirm | **Keep**, with a confirm |

**Running a game**

| # | Today | Proposal |
| --- | --- | --- |
| C29 | Backstage | **Retire it or thin it** (the named choice above), and rename |
| C30 | The Results page, its results jobs, and How results get in (Copy and paste, One tap, Autopilot) | **Drop** where the bot runs the season. **Keep** "enter who went home yourself" and house rulings as the runner's override, on the episode's page. One tap and Autopilot return with the paywall (BACKLOG 113) |
| C31 | Remind them | **Merge** into the runner's jobs, or **Default** (the hourly reminders already go) |
| C32 | Waivers' settings sheet, and the game's "Replacing people who leave" | **Merge** into one control on the game. **Keep** the preset, when waivers start, the rule, the windows and the swaps. **Default** the fallback pick on. Make the timing rows real controls (the server takes them), or **Drop** them |
| C33 | What players see (waivers) | **Merge** into How it plays |
| C34 | Change the points; Make it ours and the rest of the rulebook copy | **Move** the points to the game. **Move** the rulebook copy to the couch-and-season section, for the Tinkerer only |
| C35 | Members & roles | **Per game**: who's playing, their role, and remove from this game. **Drop** the Invite and Leave duplicates |
| C36 | Computer players | **Move** to the game |
| C37 | Competitive mode / Lock it down | **Move** to the couch-and-season section, renamed (say, "Freeze rules and joining"), off by default |
| C38 | Archive and delete, in three places | **One** Stop on the game. The Finished fold keeps "Archive all" |
| C39 | Together or own pace | **Keep** as is: shown, and fixed |
| C40 | Team size | **Keep**, as a real control before the draft (the server takes it) |
| C41 | Recent changes | **Keep**, renamed. Each line opens its game's settings |
| C42 | Draft settings | **Keep** in the room, linked both ways with the game, in the wizard's words |
| C43 | BACKLOG 198 ("Tick all" for held results) | **Close**: there's nothing left to tick |

**The site admin's desk** (its own pass, last)

| # | Today | Proposal |
| --- | --- | --- |
| C44 | Who decides results | **Drop** (BACKLOG 168), after its data step |
| C45 | Sources to confirm; When answers disagree; Who fills in on new couches | **Default** (2; on; anyone), and fix the words that still describe the old rules |
| C46 | Autopilot, our usual schedule, which AI the bot asks | **One** "Research bot" page, with the per-run choices that have no screen today |
| C47 | The Gemini card; Leagues play by it; the library row in Settings | **Drop** |
| C48 | The rulebooks flag | **Move** to a script, as the game-specs flag is |
| C49 | Episode length; Its words; No art or photos; View as | **Move** to Setup's schedule; **Merge** with the rulebook's cast words; one switch, worded positively; a labelled row |

## Missing settings to consider

**Approved 2026-11-20:**
- **Each in its round:** A3, A5 (the user's addition), A6, A7 (with C1), A8 (with C17), A9, A11, A13–A17.
- **In the admin round:** A19 and A20.
- **Not now:** A4, A10, A12 and A18.
- **Waiting on BACKLOG 185** (account recovery, before strangers sign up): A1 and A2.

| # | Missing | Home |
| --- | --- | --- |
| A1 | An email to add or change, so you can reset your own password (username accounts can't today) | You |
| A2 | Delete my account: the desk's deletion, made self-serve, held, restorable for 30 days | You |
| A3 | My phones: which get notifications; turn one off; sign out everywhere (a password change leaves other phones signed in) | You |
| A4 | Send a test notification (the route exists) | You |
| A5 | Install the app: help for each kind of phone | You |
| A6 | Mute this show, for a while or for good | This show |
| A7 | Hide results for one show only (C1's exception) | This show |
| A8 | Add a show privately | This show |
| A9 | This couch's chat notifications (C26) | This couch |
| A10 | What this couch sees about you, with an account default | This couch |
| A11 | Leave one game (a route; the server's takeOut already works game by game) | This game |
| A12 | Notifications per game, for the One-Gamer (or through the show's list) | This game |
| A13 | Rename a game | Running a game |
| A14 | Remove one person from one game | Running a game |
| A15 | The options that are safe to change after the start: team size before the draft, waiver timing, lineups hidden until the lock, when the draft opens, ending at a phase | Running a game |
| A16 | BACKLOG 164 (replacements on by default), 165 (an empty slot fills from the bench), 166 (make a missing move for someone, merged with waivers' Pick for them) | Running a game |
| A17 | BACKLOG 230 (a new moment mid-season: count it from the start, from the next episode, or let the players vote) and 231 (the players vote on a change): the general way a running game changes | Running a game |
| A18 | Hand a seat to someone else (classic had it) | Running a game |
| A19 | A game's settings on its desk page | The desk |
| A20 | Settle again, and releasing the catch-up hold, as desk actions instead of scripts | The desk |

## The rounds

Each round is one session (sometimes two). It runs the design process once and ends with a screenshot story at 390 and a pause
for you. The order goes by reach: everyone first, then runners, then the admin. After Round 0's cuts, small rounds can merge.

**Where they run.** The sports lane holds the main folder (branch `sports-playoffs`, step 2.7). Round 0 builds nothing but needs
the app running with fixtures, so it gets a lane of its own (scripts/lane.js). Round 3 waits for 2.7 to merge, because 2.7 edits
Backstage's settings files (src/new/backstage/settings.tsx, game-settings.tsx, src/lib/server/backstage-games.ts).

### Round 0: the map, the cuts and the shape (no build)

**Done 2026-11-20.** Story: https://claude.ai/artifact/UkbTP7G4f7uQhVqp32UMNm.
- **What it made:**
  - Intent's structure: [design-round/settings-r0-spec.md](design-round/settings-r0-spec.md).
  - PFD's first views: [design-round/settings-r0-first-view.md](design-round/settings-r0-first-view.md). Its new finding: a
    "what you'll still get" line under every notification choice.
  - Impeccable's brief: [design-round/settings-r0-shape.md](design-round/settings-r0-shape.md).
  - The names: [design-round/settings-r0-names.md](design-round/settings-r0-names.md).
  - The capture: `scripts/dev-test/story-settings.js`, 31 situations.
  - 12 grey boxes (`.ui-atlas/stories/settings-r0/`, local).
- **The check:**
  - PFD scored today 48, Shape 1 69, Shape 2 59, Shape 3 70.
  - Impeccable scored Shape 1 28/40, Shape 2 25, Shape 3 27.
  - One batch of fixes followed.
- **The reviewers split** on Your settings' first view (Impeccable: groups; PFD: questions) and on the way in (the structure's doors
  against PFD's one gear on every bar). Both go to the user as named choices, with my recommendations: groups, and the gear.

The round's original steps:
- **Render today.** Every surface in the audit, at 390, in each role and situation below, as the "before" frames. Extend
  census-app.js's settings set, or write story-settings.js after story-game-settings.js.
- **The system map.** Every setting by subject, home, name and verdict (from the audit). Plus the shared parts: the settings row,
  the switch row, a choice, a fold, a sheet, the Undo toast, the guards, the dot and Reset.
- **Show the options.** The three shapes as grey boxes on the same situations, and the cut list as before and after wherever it
  changes a screen.
- **Names.** The literal-name candidates, through Impeccable's clarify (Backstage's replacement, the roles, the fold titles).
- **Skills.** Intent (organize, journey) for the map and the shapes; PFD solve on the shapes' first views; Impeccable shape for the
  grey boxes; one check.
- **You decide:** the shape, Backstage's fate, the cuts (by number), the adds, the names and the order of the rounds.

### Round 1: You, and notifications as one system

**Built 2026-11-20 (branch settings-plan); reviewed the same day: the user took all four picks and asked for the sheet's ring
fixed, both built** (decisions.md, 2026-11-20). Story: https://claude.ai/artifact/97sfST4Ut41ib5HUHJPpjH.
- **The design process:** Intent's spec [design-round/settings-r1-spec.md](design-round/settings-r1-spec.md); PFD's first views
  [-first-view.md](design-round/settings-r1-first-view.md); Impeccable's brief [-shape.md](design-round/settings-r1-shape.md); the
  check, the fixes, what's open and the choices [-check.md](design-round/settings-r1-check.md).
- **Built:**
  - Your settings (/settings): you, the plate only while nothing reaches you, then five groups each with its value
    (Notifications, When results show, Privacy, Appearance in place, Your shows couches and games), then Account and help, Site
    admin and Sign out. Each group is a page (`?page=notifications|results|privacy|yours|account|phones`).
  - The hub's gear opens it; your picture's sheet keeps a quiet Your settings row and lost Take the tour (C13).
  - Notifications: this phone; the kinds as outcomes (C2 one Results switch, C3 invites always, C4 Backstage gone and its push
    stopped, C5 renamed), read as off while nothing reaches you; Couch chat on every couch; what's set on a show or a couch, each a
    link. A show's Notifications: Mute (a day, a week, until I turn it back on; reminders still come) and its kinds. A couch's page:
    its own chat choice (My default first). A push's Notification settings button (public/sw.js v4). The bell's foot links here.
  - C1: "Straight away" now means every show (guard.ts progressFrom). C6: one Privacy switch; GIFs and reactions show when posted.
    C7–C11 as decided; C8 removes Grok and the AI setting. A3 Your phones; A5 Install the app; Allow notifications for a blocked
    browser. BACKLOG 232: signing out turns this phone's notifications off. Acting as someone can't change their phones or push.
  - Migration 0447: `notification_prefs.muted`, `couch_members.chat_notify`.
- **Checks:** `npm test` (2513, all pass after updating the three tests the round changes); the API halves of check-new-settings,
  check-new-notify and check-new-sharing pass, updated for the round. **Left:** their browser halves still drive the old Settings
  (folds, Grok, the old show sheet) and are rewritten after the user's review, since the review may move things;
  check-keep-up's Settings part is updated, but its where-sheet half was already stale (BACKLOG 70).
- **The original scope:**
  - Your settings as Round 0 decided: groups with their values, plus "Your shows, couches and games". The hub's gear opens it.
  - Notifications everywhere they're set: on You, a show, a couch, a game, the push itself and the bell. Each choice carries its
    "what you'll still get" line, and the kinds read as off while this phone is.
  - C1's "When results show" at the account level.
  - C2–C13, and the additions A3 and A5.
  - BACKLOG 232: signing out turns off this phone's notifications.
  - Round 0's names throughout.
- **The bar:** PFD 80 or more and Impeccable 32 or more out of 40, on the built screens. Both checks run once, with independent
  reviewers, then one batch of fixes.
- **Situations.** A player on one couch (alex), on two couches (alex and casey), solo, someone who only watches, a runner, the site
  admin. Notifications off, on, blocked, and an iPhone without the app installed. An account that only uses Google. Someone who
  follows a sport.
- **Backend, if the design calls for it.**
  - The guard reading C1's one setting.
  - Chat notifications per couch (A9).
  - Muting a show (A6).
  - My phones (A3), and deleting your account (A2).
  - "Changed elsewhere": a read gathering what you've changed.
- **Checks.** check-new-settings.js, check-new-notify.js, check-new-sharing.js, check-keep-up.js.

### Round 2: a show and a couch, for you
- **Scope.**
  - This show: its ⋯, the episodes you've watched, "When a new episode airs".
  - Add a show's "where are you" step.
  - Sports: Show the score (say what it moves: today it moves your mark for the whole week, on every season with that game ✓),
    Watch it as if live, following a team.
  - This couch: its home, and the hub's switcher.
  - C14–C28; A6–A12 as picked.
  - Mute's first choice: "Until the next episode" (the user's pick on Round 1's story, 2026-11-20), then the clock's three.
- **Situations.**
  - The lenses: own pace, live, a sport whose scores show live, a story show, solo.
  - Behind, caught up, a finished season, a 30-episode season.
  - Two couches; an owner and a member.
- **Backend, if the design calls for it.** C15's choice (per season, or per show across seasons). Leaving one game (A11). The hub's
  couch saved per account. Privacy per couch (A10).
- **Checks.** check-keep-up.js, check-new-couches.js, check-where-everyone.js, check-sports-couch.js.

### Round 3: running a game
- **Scope.**
  - Backstage's fate, carried out and renamed.
  - Manage this game: Round 4's page, grown.
  - The couch-and-season section, and a runner's jobs on the strip.
  - Changing a game once it's under way: A17's setting and vote, over the tier-2 preview.
  - BACKLOG 157 (the lock's three states) and A13–A18.
  - Start a game's words, matched to these (with the redo plan's E3 lane).
- **Situations.**
  - People: the Commissioner of three games (alex); a Game admin (riley); a casual starter with one game.
  - Seasons: a busy season of short games (57 finished); a game mid-draft; a finished game.
  - Shapes: own pace with exclusive teams; a sport; a staged game.
- **Backend, if the design calls for it.**
  - Real Undo for the lock, pace, the questions, the freeze, who fills in results and computer players (typed undos instead of
    plainChange).
  - A read of one game's settings: today it reads every game.
  - A15's options after the start; A11's route.
- **Checks.** check-game-settings.js, check-new-backstage.js and -ii, check-backstage-remind.js, check-new-couches.js (join
  requests), story-game-settings.js.

### Round 4: the words and the ripple
- **One set of words.** Start a game and a running game use the same words. One Recommended tag. Every confirm moves to the one
  pattern.
- **Everything that pointed at the old homes follows.** How it works, the tour, and the pushes and toasts that use the old names
  ("…from Backstage", draft-words.ts's "Add it in Backstage").
- **A ripple check.** Re-render whatever uses a part that changed.

Rounds 1–3 do their own words, so this is the sweep for whatever's left.

### Round 5: the site admin's desk (later)

When you want it:
1. One results model, explained once (C44–C45).
2. One Research bot page (C46).
3. Rare switches out of Settings (C47–C48).
4. Literal names ("Site admin", "To do", "Search", "Site settings").
5. One way to save.
6. Hidden things made findable (A20, View as).
7. A game's settings on its desk page (A19).
8. Then the desktop layout (BACKLOG 197).

## Backend that may be called for

Each only if its round's design needs it:

| Change | For | Round |
| --- | --- | --- |
| A per-show results choice (a `show_follows` column), read by the guard alongside or in place of `show_results_immediately` and `keep_up` | C1, C15, A7 | 1–2 |
| Chat notifications per couch (a column on `couch_members`, or a key in `notification_prefs`) | C26, A9 | 1 |
| Mute a show until a time (`notification_prefs.shows` with an until) | C16, A6 | 1 |
| Your phones: list them, delete one, sign out everywhere (Better Auth's sessions, `push_subscriptions`) | A3 | 1 |
| Delete my account, self-serve (the desk's deleteAccount, with a hold) | A2 | 1 |
| Leave one game (a route over the existing takeOut) | C18, A11 | 2 |
| The hub's couch saved per account (`user_settings`) | C25 | 2 |
| Privacy per couch (a table, with the account's switches as its default) | A10 | 2 |
| Typed undos for the lock, pace, questions, freeze, who fills in results and computer players | rule 6 | 3 |
| A read of one game's settings; rename a game; remove one person from one game | A13, A14 | 3 |
| The safe options after the start, through settingsWrite's whitelist and the engine's change rules | A15 | 3 |
| Drop columns: `share_ratings` (BACKLOG 199); `ui` and `ai` after their controls go; `results_by` after 168 | C8, C10, C44 | any migration that's going out anyway |

## Fix now, apart from the redesign

These went to the backlog's "Now" as 232–236. Any session can take them:
- 232: signing out leaves the phone getting your notifications.
- 233: a Game admin can undo a Commissioner's settings and role changes.
- 234: Game settings' Recommended is hard-coded.
- 235: the results-to-fill-in push is moot.
- 236: Where you are points to a heading that doesn't exist.

## Checks, fixtures and the story

- **Fixtures.** Every row is zt-keyed, with an up and a down.
  - new-fixture.js: alex owns the couch and runs the three Survivor games; riley is a Game admin; jordan plays; sam is behind;
    casey is on a second couch with alex.
  - solo-fixture.js, streaming-fixture.js, hub-fixture.js (finished seasons), guide-fixture.js, notes-fixture.js.
  - short-games-fixture.js: a busy season.
  - A sports couch: check-sports-couch.js's fixture, or nfl-slate-fixture.js.
- **The frames.** census-app.js already shoots settings-alex, settings-notify, hub-profile-menu and backstage-alex. Extend it with
  a settings set, or write story-settings.js after story-game-settings.js: situations by id, `--only`, before and after, a missing
  selector skipped rather than failed.
- **The checks:** each round lists its own. Never run two checks on the zt_nd fixture at once. Run the long checks once a round,
  last.

## What you decided (2026-11-20)

You took every recommendation, added A5, and settled C8 after a talk:
1. **The cuts:** all of them. C8 goes further than proposed: Grok goes too, so the Ask an AI sheet has one ChatGPT link plus
   "Copy the question". C1 (the one results choice) and C29 (Backstage) are still shown in Round 0 before they're built.
2. **Backstage:** A. Retire it, so each game has Manage this game.
3. **The order:** You, then a show and a couch, then running a game, then the words, then the desk.
4. **The adds:** as listed under "Missing settings to consider" (A5 added).
5. **The names:** Round 0 proposed them, and you took all four (below).

**And on Round 0's story (2026-11-20):**
- Shape 1, with Your settings' first view as groups.
- One gear on every bar.
- The names: Manage this game (Games you run); Helper; Relaxed · Standard · Strict; Skip possible spoilers.
- Polish belongs to the built screens, not another grey-box pass, so Round 1 carries the bar.

The record is design-round/decisions.md, 2026-11-20.

## Not in this plan

- The Start a game wizard (redone 2026-11-19), except that its words should match a running game's (Round 4).
- The tour and first run, beyond their words and defaults where they set something Settings also holds (where you are, your
  account's name and email).
- Studio, the light theme, as a design (BACKLOG 196).
- AI access and money (BACKLOG 113, tabled), and so One tap and Autopilot.

## Noticed, not fixed

Left for their round:
- **Round 1:** all four done in Round 1 (the classic line and the bell's line rewritten; a switch reads on only while every
  type is; the push, phones, mute and couch-chat routes refuse while acting as someone, the follows and /api/me/settings routes
  left for Round 2; the lab's pointer gone).
- **Found in Round 1, left:**
  - check-keep-up.js's where-sheet half looks for `[data-following]`, gone since the one-episode-at-a-time rebuild (BACKLOG 70).
  - check-new-notify expected one push for a settled flag; results-settle (live) also tells players their results changed. The
    check now picks the flag's own push.
  - `npx eslint src` has four errors in files Round 1 didn't touch (ui/use-sheet-swipe.ts, game/formats/format-timeline.js,
    show/game-page.tsx, show/lineup-sheet.tsx).
  - The hub picture sheet's "Your best show" draws a show with no art with its name twice (story-situations' OVERLAP), as before.
- **Round 2:**
  - Where you are's Save has no Undo (the step 4 spec asked for one).
  - Leave the pool deletes for good behind a plain confirm.
  - "Watch privately… under Everything else" (sharing.tsx:71), when it's often in the menu itself.
  - Watch privately offered with no couch.
- **Round 3:**
  - "Every N" waiver windows with no N.
  - "Set in the draft room" for a team size the room can't set.
  - "The draft needs its cast · Add it in Backstage".
  - A "Till <phase>" game reading "to the season's end".
  - A runner whose games are all archived can't reach Bring a game back.
  - Needs you asking for results on seasons the bot runs.
  - The results captions naming three fixed games.
- **Round 5:**
  - "ChatGPT" written in when the bot asks Claude.
  - Three Undos the server keeps but no toast offers.
  - Date pickers forced dark in Studio.
  - Three Inbox rows that lead nowhere useful.
- **Docs (whoever next touches them):** HANDOFF.md's Production list and BACKLOG 185 said the desk's tie-break stays off. It has
  been on in production since 2026-11-20 (PLAN-results-settle.md, decision 3). 185 is corrected in this change; HANDOFF's line
  waits for its next edit.

## Keeping this plan true

- Each round records its decisions in design-round/decisions.md, and updates this Status line and its own section.
- A cut or add that's decided gets its result in its table ("done in Round N", or "kept: why").
- When the plan finishes: its row in PLANS.md moves to Done, and live leftovers go to the backlog with new numbers.
