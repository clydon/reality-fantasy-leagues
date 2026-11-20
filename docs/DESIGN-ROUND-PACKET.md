# The design round's packet

> **Status (2026-11-19): Reference.** The round's frame still holds. Its "Decisions you owe" were all settled 2026-11-14 (design-round/decisions.md). Steps 10–12 are in PLANS.md.

Prepared 2026-11-14 for the game UI/UX overhaul. It merges three lists into one, ranked and grouped by the page each item lands on:
the explorer plan's [Designs needed](PLAN-GAMEPLAY-SCENARIO-EXPLORER.md) (39 items, "DN" below), the backlog's UI items
([BACKLOG.md](BACKLOG.md), "B"), and the overhaul index and ideas in [UX-IDEAS.md](archive/UX-IDEAS-2026-11-19.md) (archived 2026-11-19; its ideas are in BACKLOG.md). Nothing here is designed or
approved. The round follows the [fresh-start brief](APP-REVIEW-DESIGN-BRIEF.md): one page with its situation variants, through
impeccable (shape, then critique) at 390 px first, then a pause for your review before anything else is redesigned.

**Evidence.** Each item names where it was seen:
- screenshots and recorded page words are in `.ui-atlas/explorer-page/` (local, not in git): `05h-h2h-week.png`, or
  `sports-page.json` for the words the page showed;
- each capability's section of [GAMEPLAY-EXPLORER.md](GAMEPLAY-EXPLORER.md) says how it was found;
- "specimens" is how many of the matrix's 1,312 generated show games use the mechanic (`.ui-atlas/gameplay-matrix.json`). It
  measures breadth across possible games, not how often real couches play them.

**How it's ranked.** Pages by how much of the list lands on them. Within a page, in this order:
1. your stated priority;
2. something wrong on screen today (a false fact, or a control that can't be reached while the rule is on);
3. what a default game meets (the app's own Weekly Lineup, the sports defaults);
4. breadth (specimens);
5. words-only fixes, which can ship any time because the overhaul keeps them.

---

## The round's frame (the user, 2026-11-14)

**How to read this frame.** These are the user's general thoughts and intent, not rules set in stone. They're always open to
pushback: when a design reason argues against one, raise it with the reasoning (as with UX flaws: say it head on), and the user
decides. Don't quietly design around it, and don't treat it as settled beyond what they said.

**What's covered: one system at several distances.** Each surface reads the same game model (what's due, what's locked, what each
person has been told), so a move or a result looks the same at every layer, only closer or farther:
- notifications (the one line);
- quick moves on Tonight (the strip, the dock, Your moves);
- Tonight's game section (a mini per game);
- the Games tab;
- the reveal;
- the game page and its sheets;
- the draft room and the waivers screen;
- and, as a second track sharing the same words, the create-a-game wizard and game settings (Backstage).

The deepest layer is designed first, so the shallower ones are excerpts of it rather than new inventions.

**The whole app, not only games** (the user, 2026-11-14). Every tab is redesigned and reviewed:
- the hub and the TV guide;
- a show's Tonight, Episodes, Games and Players / Cast;
- Chat, which needs the least;
- the connected flows: couches, following, onboarding, settings.

The shared parts (the move, the result, the matchup, the player or cast row, the episode card, the viewing-progress control, a
friend's face and position, the stat table, the person sheet) are decided once and used everywhere.

**The order:**
1. **Phase 0, a wide scan of the whole app:** a census of today in every situation, the system map, the shared parts, the
   vocabulary per flavor, grey-box first views at 390, and the user's identity decision (keep the current visual world and reopen
   density, or reopen the look).
2. **The game page.**
3. **Tonight**, the whole tab.
4. **Episodes and the reveal.**
5. **Players / Cast.**
6. **The Games tab**, with the draft room.
7. **The hub and TV guide.**
8. **Notifications**, then **waivers**.
9. **Chat**, a light review.
10. **Sports in full**: a pass across the pages above, reusing parts already proven at sports scale.
11. **Story-show flavor** across all of it.
12. **A separate track:** the wizard, game settings, onboarding, couches, account settings.

**Competition shows come first** (the user, 2026-11-14: the app was reality competition first). Each round from step 2:
- leads with competition shows, designed, storied and reviewed as the priority;
- then runs a short **sports check** of the same parts at sports scale (a few hundred athletes, a slate week), proving they hold
  without polishing a sports design (sports run all year, an easy hook, so the parts mustn't break there). Anything that breaks
  is fixed in the competition design before the user approves it.

The full sports design is step 10. The bench's real-size sports pools are built before step 2's sports check.

Why wide first, then focused (the user): so honing in on one page never loses the context of the others, whether finalized or
newly drafted. Each step is one session, with a screenshot story and a pause. A living board lists every surface's status (today's, drafted,
approved) and its latest story, and after each round a ripple check re-renders whatever uses a part that round changed.

**Soul, not sterile** (the user, 2026-11-14). The redesign must not sterilize the app's character: no AI slop, nothing clinical,
and not wacky either.
- **What the app is:** a third social ("what's everyone up to, let's chat about what I just saw") and two thirds game ("let's make
  a game out of this"). The games should be entertaining.
- **Data, shown with joy:** the app displays data, and it should be fun and informative, with many data visuals for the nerds:
  charts, comparisons, trends, a season told in graphics. The season grid is the kind of thing that works.
- **Social that's easy and fun:** reacting to an episode with a GIF is the model, light and expressive, with no effort to join in.
- **How this squares with "not busy":** character comes from the show's art, the faces, the GIFs, the data visuals and one good
  moment of motion. It doesn't come from piling elements on. The surface stays calm, and the depth behind it is rich, playful and
  dense where the nerds go looking.

**Every design is checked through five lenses:**
1. playing at own pace (each person's own now; the waits said up front);
2. a shared draft (no scarcity);
3. an exclusive draft (scarcity: order, who's left, waivers, losing a player);
4. stages (a game made of games);
5. spoilers (every layer, push wording included).

**Three flavors, the same brand, different approaches:**

| Flavor | The cast | The screen leads with |
| --- | --- | --- |
| **Competition shows** (Survivor, The Traitors) | About 18 faces, leaving one by one | Faces and the boot story; results are official |
| **Sports** | Usually four times the players or more: hundreds of athletes, positions, a schedule | Lists, search, filters, sort, position slots, stat tables and who plays when (a face per player doesn't scale) |
| **Story shows**: dramas, sitcoms, long-form series, and non-competition reality (Below Deck, Love Is Blind; may become its own category) | Characters and relationships; nobody is out | The episode, and what people called, settled or still open |

Story shows' results are moments the couch or research confirms, and the natural games are predictions, theories, bingo and calls.
Spoilers and pace are at their extreme there (a binge drop spreads a couch across a season). Long-form series need memory across
seasons.

**Live games**, real-time prompts during watch-along (A15, live calls), are a future mode. The designs leave room for them: a move
whose lock is seconds away, nothing mid-episode in notifications, the night's calls in the reveal. See archive/UX-IDEAS-2026-11-19.md, "Live games" (now BACKLOG 179, A15).

**Inspiration from apps that already solve our problems** (the user). Borrow patterns; don't copy any app's look:
- fantasy football (Sleeper, ESPN, Yahoo): the matchup screen, setting a lineup, the draft room with its queue and auto-pick,
  waivers, player cards with recent stats;
- best ball and DFS (Underdog, DraftKings, FanDuel): drafting fast from a long list, contests at a glance;
- sportsbooks (bet slips, parlays, live bets): a pick's worth before you commit, a slip of today's picks, live prompts with a
  countdown (A15);
- prediction markets and pick'em apps: a question's odds or consensus, settled and open calls.

Not borrowed: a casino's pressure patterns (manufactured urgency, chasing losses, dark nudges). Points aren't money, and Joanna
should never feel hustled.

**Every test judges the lay of the land, not just correctness** (the user). For each surface, in each situation:
- **Would someone be confused?** What they'd think each thing means, and where they'd look for what they came for.
- **Is it organized logically and not buried?** Count the taps to what matters: who you play, when it locks, what's due, why the
  score is what it is. Anything needed now sits in the first phone view.
- **Can a casual player play on instinct?** A move in a tap or two, from wherever they are, with no jargon and nothing to learn
  first. Judge by Joanna (forgets) and Andrew (drives by).
- **Does the competitive player ("sweat") have the stats to decide?** The numbers sit beside the decision, not on another tab:
  recent lines, matchups, ownership and trends, with comparisons one tap away. Judge by Conor (tinkers).

- **Is it busy or overwhelming?** This is the criticism early designs got most, and a design that draws it fails, however
  correct it is:
  - **One thing first.** Each screen has one job and one primary action. A five-second look says what it is and what to do;
    if a tester names three things, it's busy.
  - **Calm on the surface, depth on demand.** The sweat's stats are a tap away and dense where they live (a table, a sheet),
    never spread across every card. Calm and deep aren't a trade-off: they're two layers.
  - **Say each thing once.** No fact repeated in a chip, a banner and a plate; no badge that names a setting rather than
    what's happening (the "Waivers" chip on a game with none, Designs needed 32).
  - **Earn every element.** For each block in the first phone view, ask what someone would lose without it. Few type sizes,
    few colours, one accent doing one job.

  Today's game page, for comparison (`show-due.png` in `.ui-atlas/situations/`): a huge title, two setting chips, a spoiler
  line, the move and a grid all compete for the first view, while the one thing a head-to-head player wants (who they play) is
  missing.

The bench's page checks record what they can measure (taps to each key fact, what the first phone view holds, the page's words); a
person, or a blind tester, judges the rest.

**What the bench needs for the frame, recorded and not yet built:**
- the pilot with an exclusive draft and waivers;
- a staged variant;
- sports worlds with real-size pools (300+ athletes) for the draft, waivers and lineup sheets (the runtime takes up to 1,000);
- a story-show world (today every generated show is competition-shaped: people go home on a schedule).

---

## Decisions you owe (before or at the start of the round)

1. **The first page** (since settled by the order above: Phase 0 first, then the game page; this was the reasoning, kept for the
   record). **The game page, or Tonight?** The brief's default pilot is Tonight. **I recommend the game page** (a
   generated game's own page with its sheets):
   - 36 of the 39 explorer findings land on it, and so do your priority (head to head, B46/DN 3) and every sports finding;
   - Tonight's components are mid-review (no choice from the [data round 3](show-soul-review/tonight-data-round3-2026-11-12.md)
     is recorded yet), and Tonight's game section is a summary of this page, so it's better designed after it;
   - the bench can already drive this page on the real routes for shows and sports (part 4 below).

   Tonight second, composing the chosen round 3 components with the game page's new mini.
2. **The pilot game for that page.** I recommend head to head on a Weekly Lineup, with its sports twin:
   - Survivor: draft 3, start 2, head to head with a two-seat playoff;
   - its sports twin: the NFL's own season game (head to head, a weekly lock, a lineup of nine).

   Why: head to head is your priority, the most common ranking among generated games (146 specimens), and it carries the most
   states (this week's opponent, a record, quiet nights, playoffs, a champion). The other families (points totals, pools,
   questions, Outlast, categories, fields) are variants to check the design against, not separate designs.
3. **Round 3's lineup component, chosen or not?** The game page's week reuses one of: A (expandable ledger), B (contribution
   comparison on a shared scale) or C (lineup matrix and trend). Choose one, or let the round propose fresh with all three as
   references.
4. **Side bets in the new app (DN 1).** Weekly Lineup has them on by default and the new app lets players guess, but not post or
   settle. Is posting and settling part of this round (it lives on the game page's week and in Backstage), or deferred?
5. **Rule questions that change what a screen says.** Each is waiting on you already:
   - B54: group slots on a finale played in pairs are void unless research says the pairs split;
   - B58: a waiver window opened by hand about a day ahead runs within minutes;
   - B62: an Outlast stage that starts mid-season starts everyone on points;
   - DN 32: a waiver window turned off can't be opened again for that episode. A rule to change, or a state to say?
6. **B81 (new today): fix it now?** A slate week whose first game is postponed still locks at that game's start. It's a small
   engine fix, and nothing scores wrong.

---

## 1. The game page (and its sheets): 36 of 39 findings

The page: `src/new/show/game-page/`, its model `game-page/model.ts` and `game-view.ts`, and the sheets in `game-sheets.tsx` and
`lineup-sheet.tsx`. The brief keeps its season grid, graphs and data layout as a strong reference ("the user likes them").

### 1a. Head to head (your priority)

| # | What | Evidence |
| --- | --- | --- |
| 1 | **Who you play this week.** `matchups.next` is in every game view and read nowhere, on a show or a sport. | DN 3, B46. `05h-h2h-week.png`. NFL: `sports-locks-page.json`, `05zzl`. 146 specimens. |
| 2 | **The playoffs.** No bracket, no champion named. The losing finalist is marked OUT like those who missed the playoffs. The final's square is unmarked in the grid. A champion with a worse record is ranked above a better one with no reason shown. | DN 3, B46. `05i-h2h-final.png`. |
| 3 | **A quiet night.** It's counted for nobody and shown as unexplained dashes. A cancelled sports game now gives the same quiet night (today's slice). Under weeks won, a shared week's half point looks like a whole win. | DN 3, DN 39. `05j-weeks.png`. 98 specimens of weeks won. |
| 4 | **Categories head to head.** No category's values or which ones a week was won on (the record shows since B77's fix). Roto's season grid shows 0 every week (roto has no weeks). A seat at its own pace has no record and isn't told why. | DN 35. `05zzo` to `05zzq`, `sports-categories-page.json`. |

### 1b. Wrong on screen today, or a control that can't be reached

| # | What | Evidence |
| --- | --- | --- |
| 5 | **A captain can't be named.** "Captain scores double" is on the page, but nothing in the new app sends `captainId`. | DN 24. `05zn`, `05zo`, `captain-page.json`. 24 specimens. |
| 6 | **A pool's second pick can't be made.** The sheet takes one pick. | DN 27. `05zu`, `05zv`. 5 specimens. |
| 7 | **A group slot can't be filled.** Nothing sends the route's PUT. | DN 28. `05zw`, `05zx`. 17 specimens. |
| 8 | **Someone knocked out is still asked for a lineup**, and the server refuses it. The out state itself is undesigned. Design it with #19. | DN 10, B47. `05r-cut.png`, `cut-page.json`. 54 specimens of cuts, 63 of races. |
| 9 | **Outlast in reverse says "Fewest points wins"**, and its week reads a running value as points scored. | DN 22, B51. `05zi`. 31 specimens. |
| 10 | **Hits counted once each don't add up** to the standings on the grid and the week. | B49. 109 specimens of hits. |
| 11 | **A pool's skipped night reads "No pick · missed".** | DN 29, B55. `05zy`. 11 specimens. |
| 12 | **The weekly card calls itself a Survival Pool** ("Who survives… Streak 1"), and names no card. | DN 20. `05zf`, `05zg`. 74 specimens. |
| 13 | **Weekly Calls' How it plays tells a talk show's rule** on a show whose results settle it. | DN 18. `05zc`, `05zd`. 11 specimens. |
| 14 | **A sport's game in a show's words**: "contestant", "episode", "Airtime", "castaways", "All safe · 3 of 3 still in", and its table as stat keys ("2 a 2PT, -1 an INT"). | B75, DN 34. `sports-page.json` and every sports word file. |
| 15 | **"Spoiler protection is off" on every sports page**, for someone who turned nothing off. | DN 34. `sports-page.json`. |
| 16 | **The reveal doesn't open over a game's own page.** | B66. |

### 1c. The week and the season grid: where points came from

| # | What | Evidence |
| --- | --- | --- |
| 17 | **Multipliers**: which episodes count extra, the squares that did, and lines at their own points with the factor shown once. | DN 15. `05x`, `05y`. 45 specimens. |
| 18 | **Bounties**: who took what from whom; the grid's squares don't add up to the total. | DN 12. `05u`. 57 specimens. |
| 19 | **Whole-game and season-long answers once settled**: where they live through the season and at its end (the person sheet says "Nothing was asked that episode"). | DN 2, DN 17. `05e`, `05f`, `05g`, `05za`, `05zb`. 152 specimens asked once. |
| 20 | **Parlays**: each leg saying it's one; a paid parlay marked. | DN 14. `05w`. 51 specimens. |
| 21 | **A survival pool's mulligans and buyback**: a forgiven pick, a bought-back night and its cost, what's left. | DN 26. `05zs`, `05zt`. 8 specimens of buybacks, 6 of mulligans. |
| 22 | **Beat the bot**: the bot's call beside each settled answer, and the couch against the bot. | DN 21. `05zh`. 75 specimens. |
| 23 | **The top scorer's twist**: who chose it, and the doubled week marked. | DN 23. `05zj` to `05zm`. 35 specimens. |
| 24 | **An auction**: what each castaway cost and what's left of the budget. | DN 30. `05zz`. 12 specimens. |
| 25 | **Teams of players**: each team's points and place, and when a late joiner joins one. | DN 13. `05v`. 49 specimens. |

### 1d. Sports on the game page (the defaults every sports couch meets)

| # | What | Evidence |
| --- | --- | --- |
| 26 | **An athlete's line**: what they did, what each stat paid at this table, their position and opponent on the lineup tile. "Your sheet" has no week by week. | DN 34, B74's rest, B43. `05zzi` to `05zzk`. |
| 27 | **A week of several games**: when each of your players plays, against whom, done or to come, and each game's points for whoever was in the lineup then. | DN 38, B80 (TEMP-UI). `05zzz` to `05zzz3`, `sports-slate-page.json`. |
| 28 | **A field's places**: "T14", "2nd", "Missed the cut", and F1's three places a weekend. The natural view is a leaderboard. | DN 36. `05zzr` to `05zzt`, `sports-places-page.json`. |
| 29 | **A card's matches**: who a player played, the score in sets, best of five, a retirement. | DN 37. `05zzx`, `05zzy`, `sports-tennis-page.json`. |
| 30 | **A game called off, and a week in progress** (today): "Postponed · free to move" on the tile, and "2 of 3 games final · counts when Thursday's is in". | DN 39. `check-sports-explorer.js --case=calledoff`. |
| 31 | **A lock by the week or the day**: when it fell, when the next lineup opens. A locked lineup can't be opened to look at. | DN 34. `05zzl` to `05zzn`. |

### 1e. Rules and words in How it works, and the sheets (small; can ship any time)

| # | What | Evidence |
| --- | --- | --- |
| 32 | What scores, when only some moments count or hits are counted. | DN 4. `05k`, `only-hits-how-it-works.json`. 109 specimens. |
| 33 | Shared points' worth ("4 points, split between everyone right"). | DN 6. `05m`, `05n`. 117 specimens. |
| 34 | Stakes: quick amounts for big banks. | DN 8. `05p`. 79 specimens. |
| 35 | Rollovers' total, and confidence picks' worth. | DN 16, DN 19. `05z`, `05ze`. 43 specimens of rollovers. |
| 36 | Settled by the couch: the rider's words. | DN 9. 25 specimens. |
| 37 | Phases' names ("From merged") and a first week with no last week. | DN 11. `05s`, `05t`. |
| 38 | A drawn game's chip ("Order drawn"), and a draft spread across tribes. | DN 7, DN 25. `05o`, `05zr`. |
| 39 | Co-op's lives left beside the rule. | DN 5. `05l`, `coop-page.json`. 48 specimens. |

### 1f. A game in stages (one page reading several leagues)

| # | What | Evidence |
| --- | --- | --- |
| 40 | The game's page says "All set" while a stage has a move due; the overall is one number; a stage waiting for the merge invites a draft that can't open; the next stage's draft mid-season; words. | DN 33, UX-IDEAS ("A game in stages carries its stages' moves", "The next stage's draft announces itself"). `05zzc` to `05zzi`, `stages-page.json`. 32 specimens. |

## 2. Tonight, the dock and Your moves

| # | What | Evidence |
| --- | --- | --- |
| 41 | This week's head-to-head opponent on Tonight. | DN 3. |
| 42 | A replacement you're still owed, while free agency is open. | DN 31. `05zz2`, `05zz3`. |
| 43 | The own-pace plate leads with what's safe, not what you've missed. | UX-IDEAS ("Tonight says the game is waiting for you"). |
| 44 | The waivers result offers the new one the empty slot. | UX-IDEAS, B69. |
| 45 | No way from the dock or Your moves to a game's page. | B40. |
| 46 | "You're all set" confirmation. | B3. |

Tonight's own composition (identity, viewing progress, friends, recap, game updates, the top strip) is the data round 3's (no choice
recorded yet).

## 3. Waivers and Backstage

| # | What | Evidence |
| --- | --- | --- |
| 47 | A held week after Undo still gives its old time. | DN 32, B59. `05zza`. |
| 48 | A window turned off, how long people get, a game with none. | DN 32, B58 (a question). `05zz4` to `05zzb`. |
| 49 | The lock row's three states after airtime. | UX-IDEAS ("The lock row says who it's open for"). |
| 50 | Side bets: where one is posted, where the commissioner settles it. | DN 1 (decision 4 above). `05c`, `05d`. Weekly Lineup's default. |

## 4. Start a game (the wizard: its own redesign, "another time")

| # | What | Evidence |
| --- | --- | --- |
| 51 | The whole flow: when before what, silent changes, settings above their subject, the rail, about fifty controls. | UX-IDEAS "Start a game, redone" (first-hand, 2026-11-14), B42. |
| 52 | Own pace says where it will wait (a draft with turns, exclusive waivers). | UX-IDEAS. |
| 53 | A game in stages can't start from here, and so has no own pace. | DN 33. |

## 5. App-wide (do once, on the new screens)

| # | What | Evidence |
| --- | --- | --- |
| 54 | The phone's back closes an open sheet. | B12. |
| 55 | Optional buttons' faint edge and 40 px height; the welcome page's faint "Nothing on". | B34, B35. |
| 56 | What's New has no place; the tour follows the screens it teaches. | B22, B38. |
| 57 | One leaderboard across linked games. | B4. |

---

## The recommended first page, and what its redesign must show

**The game page, piloted on head to head**, shows first and its NFL twin beside it. The fresh-start brief's variants for it, and
whether the bench produces each today, are in [docs/GAME-PAGE-SITUATIONS.md](GAME-PAGE-SITUATIONS.md) (part 4: each situation
opened in one click from the explorer page's Open menu, with what's still a gap).
