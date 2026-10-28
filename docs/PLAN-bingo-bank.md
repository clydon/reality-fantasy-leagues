# Bingo bank: fun squares, written fresh for every episode, settled on the honour system

**Status:** planned 2026-10-27. **All four steps built 2026-10-27 and pushed to master** (production gets migration 0146 with the deploy; see "As built" at the end). The What's
New entry is drafted for the user, not added: What's New is paused (the user, 2026-10-27), and only classic shows it. Replaces how bingo picks its squares (step 12 part 3 of [PLAN-new-design.md](PLAN-new-design.md)); the card,
ticking, lines and "who got a line first" stay. **Don't deploy step 1 on its own**: see "Noticed, not fixed".

## Why

Today a card's squares are the rulebook's scoring moments (`bingoMoments` → `callMoments`,
src/lib/game/bingo.ts), settled by the season's results. On Survivor that deals squares like "2nd in the
Immunity challenge", "Sat out a challenge" and "Had an idol or advantage used against them":

- written about one castaway, but no castaway is named ("them"),
- tied to the phase: before the merge the individual-immunity squares can't happen, so they settle "no" and
  kill most of a card's lines; after it, they happen every week,
- hard or impossible to see while watching (sat out, a reliability-"usually" stat),
- never balanced: nothing checks a square is visible on screen, or how often it comes up.

Bingo should be its own game, not the stats again: the things a couch actually shouts at the TV.

## The rules (what a person reads)

- Your card is three by three, the centre free. Its squares are things that **might** happen this episode:
  "It rains", "Someone goes fishing", "A chat at the water well", "Jeff says 'I'll go tally the votes'".
- Tick a square when you see it. Changed your mind? Tap it again to untick (undo always works).
- **Three in a row is BINGO.** When a tick finishes a line you're asked to check it: the line's three
  squares, "Sure all three happened?", **Call BINGO** or **Undo**. Only a called line counts and tells the
  couch.
- **If two say it, it's true.** A square counts once two people on the couch say it happened (alone on the
  couch: your word). It's the honour system, the same rule talk shows' calls already use
  (`settleSays`, src/lib/game/calls.ts).

## The bank

Every episode of every season gets its own **bank**: about 24 squares written by the ask-AI bot the day
before it airs, checked by a second prompt, then shared by every couch on the season. Cards are dealt from
it.

### What makes a good square (the prompt's rules, and the check's)

1. **Seen on screen**, by anyone half-watching. Not inferred, not from recaps or exit interviews.
2. **Likely enough**: should come up in roughly every episode or every other one (about 30–80% of
   episodes like this one). Never certain ("Tribal Council happens", "Jeff says 'the tribe has spoken'"),
   never far-fetched ("A medevac").
3. **Not a rulebook stat.** The prompt is given the show's moments (who won immunity, voted out, found an
   idol) as a do-not-use list: those are the game's, settled by research, and Call it already asks them.
4. **No spoilers, no predictions of outcome.** No "X goes home", nothing from leaked or preview footage
   beyond the network's own episode description.
5. **Short and unambiguous**: at most about 40 characters, one obvious tap. "Someone cries" yes; "An
   emotional moment" no.
6. **Varied**: a mix across the show's staples and catchphrases, setting and weather, daily life,
   strategy talk, emotions, and production (a host line, a slow-motion shot, a recap montage).
7. **Names, sparingly**: a square may name someone still in the game ("Kyle talks about his kids"), at
   most a few per bank.
8. Each square carries a **likelihood**: `likely` (most episodes), `maybe` (every other), `longshot`
   (now and then, still not rare).

### Fit to the episode

The prompt is told what kind of episode it is, and the squares lean that way:

| Episode | Where it comes from | Squares lean towards |
|---|---|---|
| Premiere | episode 1 | first impressions, introductions, the first challenge, early alliances |
| Regular | otherwise | the show's staples |
| A milestone | the rulebook's phases (`season.phases`: Survivor's merge at 12 left) when one lands about now | that milestone (the merge feast, new tribe colours) |
| Finale | the last episode (`episode_count`, `finale_date`) or a "part 1/2" title | finale moments: a loved ones' video, a final speech, a jury question, the winner's family, confetti |
| Reunion | a listing title saying so | reunion moments |

Plus what's public before it airs: the episode's title and the network's description, and who's still in.
Works the same for every kind of show (competition, series, talk, live event): the rulebook's `kind` and
cast terms go in the prompt.

### Made and checked like trivia's questions

The bank is a new bot research run kind, **`bingo`**, built like `trivia` (db/trivia-research.js,
db/bot-research.js):

- **Due** 1440 minutes (editable, like trivia's) **before episode n airs**, so it's about the episode
  coming up, not the one that aired. Never once n has aired.
- **Two asks in one run**: write (30 squares, so the check can drop some), then check in a chat of its own:
  is each square seen on screen, about as likely as it says, not a stat, not a spoiler, not a near-duplicate
  of another. Only squares every check passes go live; the rest are kept as dropped with why, shown on the
  admin episode page.
- **A failed run** (too few live squares: under 16) is tried again, like any run.
- **No bot, no schedule?** Copy/paste like everything else: the admin episode page has the bingo prompt
  with Ask ChatGPT for me / Open in ChatGPT / Copy and a paste box (AskAi).

### Fallback: the season's own bank

An episode bank can be missing (the bot's down, a season without the schedule switched on, a show that
drops every episode at once). Then the card draws from the **season bank**: the same prompt once per
season, for "a regular episode", with no episode-specific squares. Made with the season's first `bingo` run,
or by an admin. Without either, there's no bingo yet (as a show with too few moments today).

Rulebook moments are **no longer** a bingo source at all.

## Dealing

- A card is eight squares from the bank round the free centre, seeded per person, season and episode, as
  now (`dealCard`), but **by likelihood**: three `likely`, four `maybe`, one `longshot` (`DEFAULT_MIX`,
  decided 2026-10-27; a show's own mix later, `dealCard` already takes one). Short of one, the nearest tier
  fills in, so every card has a fair chance of a line and nobody's card is all long shots.
- Shown from when the bank lands; kept as dealt from your first tick (from airtime), as now. If the bank
  is replaced before then, an unticked card is dealt again.
- **Everyone has their own card** (decided 2026-10-27). Two cards on a couch share some squares but not
  all; see "If two say it" below.
- **Two rerolls.** Until your first tick you can deal yourself a new card, twice: **New card** asks "Sure?
  You can't get this one back (1 new card left)". A reroll keeps the card (a `bingo_cards` row with no
  marks, `rerolls` counting them) and deals from the seed plus the count, so it's the same card on every
  device. Once you've ticked, or used both, the button goes.

## Settling: "if two say it, it's true"

A tick is your say that it happened. Cards differ, so the people who could back you up might not have your
square. So:

- **After the episode** (once you've seen it), the couch is shown the squares in **called lines** that
  still need a second say, as a quick list: "Sam says it rained. Did it?" **Yes / No / Didn't notice**.
  Anyone on the couch who's seen the episode can answer, whatever's on their own card. Their answer is a say.
- Another person ticking the same square on their own card is also a say.
- `settleSays` decides: two agreeing (and more yes than no) settles it; alone on the couch, your word.
- A called line counts once all three squares settle yes; one that settles no comes off ("Didn't count:
  nobody else saw rain"). A line nobody backs up stays **waiting**, as lines waiting on results do now.

## What a line is worth: bragging rights

No points (decided 2026-10-27). A called line tells the couch: **"Sam called BINGO · Look at their card"**
(the push and the couch feed, as bingo lines notify today, push-events.ts notifyBingoLines, but on the
call, not when it settles). The link opens Sam's card: their squares, their ticks, which line, and how
each square stands (backed up, waiting, didn't count), with the "Did it?" buttons right there for the
squares that need a second say. Their ticks say what happened, so the card shows only to someone who's
seen the episode or is watching it with them (the together session, step 13 part 3), as the couch's
cards are today; anyone else sees "Sam called BINGO" and "Catch up on Episode n to see it". The episode
keeps "who got a line first".

Storage: the says go in the table talk shows' calls use (`saysOn`, src/lib/server/calls.ts), keyed by the
square's bank id.

## Flags

"This square's unfair" (too vague, can't happen this season): hidden from new deals once two people (or an
admin) say so, like trivia_flags. Cards already dealt keep it.

## Schema (migration 0146; 0145 was taken by cast_stats)

```
bingo_squares (
  id UUID PK, season_id UUID → show_seasons, episode INTEGER NULL  -- NULL: the season bank
  label TEXT (≤ 60), likelihood TEXT CHECK IN ('likely','maybe','longshot'),
  status TEXT CHECK IN ('live','dropped'), note TEXT, run_id UUID → bot_research_runs,
  created_at TIMESTAMPTZ
)
bingo_square_flags (square_id, user_id, flagged_at, PK (square_id, user_id))
bingo_cards + rerolls INTEGER NOT NULL DEFAULT 0 CHECK (rerolls BETWEEN 0 AND 2), called_lines JSONB  -- lines called (index into LINES) and when
bot_research_runs kind check + 'bingo'
```

A card's squares keep their shape (`{ key, label }`), with keys `b:<square id>`, so cards already dealt from
rulebook moments (`m:<event>`) still read and settle as they did.

## Steps

1. **The bank and dealing.** (Built 2026-10-27.) Migration 0146; `bingo_squares` read and dealt by likelihood; cards from the
   episode bank, else the season bank, else no bingo; rulebook moments out. The admin episode page's prompt
   + paste (no bot yet) so a bank can be made by hand. The two rerolls. Fixture: a `zt-` season with a pasted bank.
2. **The bot run.** (Built 2026-10-27.) `bingo` run kind, write + check prompts (pure, tested like tests/trivia-research.test.js),
   the schedule entry, the admin page's dropped squares and why. Checks with scripts/dev-test/fake-bot.js.
3. **Settling and BINGO.** (Built 2026-10-27.) The "Sure all three happened?" sheet with Call BINGO / Undo; ticks as says; the
   after-the-episode "Did it?" list; lines that count, wait or come off; notices only on a called line.
4. **Flags**, and the What's New entry (user approves). (Flags built 2026-10-27; What's New drafted, paused.)

Browser checks at 390px for steps 1 and 3 (scripts/dev-test/, reusing the headless helper).

## Decided (2026-10-27)

- **Own cards** from one bank, with **two rerolls** behind an "are you sure?", before your first tick.
- **Three by three**, the centre free, as now.
- **Bragging rights** for now: "X called BINGO · Look at their card". No points, no season table yet.

## As built: step 1 (2026-10-27)

- **Migration 0146** (`db/migrations/0146_bingo_bank.sql`): `bingo_squares`, `bingo_square_flags`, `bingo_cards.rerolls` and
  `called_lines` (unused until step 3), and `'bingo'` in `bot_research_runs`' kinds (unused until step 2). Applied locally.
- **Dealing** (`src/lib/game/bingo.ts`): `dealCard(bank, seed, mix = DEFAULT_MIX)`, likelihoods and their stand-ins, `seedOf`
  with the reroll count (the first deal's seed is the one cards always had). `bingoMoments` is gone.
- **Reading and ticking** (`src/lib/server/bingo.ts`): `bankFor` (the episode's own bank of four or more live squares, else
  the season's, else no card). **A card is kept once it has a tick**; until then it's dealt afresh each read from the current
  bank, so a replaced bank deals everyone again and kept cards never change. Unticking a card you haven't kept does nothing.
  `rerollBingo` (`POST .../bingo/[n] { reroll: true }`): until your first tick, before or after airtime, at most two; a row
  with no ticks holds the count. `EpisodeBingo.rerollsLeft` is new.
- **Settling** had to come forward from step 3 a little: a bank square (`b:` key) is settled by the couch's says on every kind
  of show (the says query already counted every bingo tick from someone who's seen the episode). A card from before the banks
  (`m:` keys) settles as it did. Weekly Bingo's table and the bingo-line notices follow the same split.
- **The prompt and parse** (`db/bingo-research.js` + `.d.ts`, CommonJS so step 2's bot run can require it): the episode's kind
  (premiere, regular, finale, reunion, from where it falls and its title or note), the phase lines (the phase it's in; one
  starting about now, from who's still in), who's still in by name (at most 3 named squares), the scoring moments as a
  do-not-use list, 30 squares with likelihoods; the season's own prompt names nobody. The parse keeps every square, live or
  dropped with why (too long over 48 characters, a question, no likelihood, twice, a scoring moment, too many names).
- **The admin episode page** (`src/components/admin/bingo-bank.tsx`, `src/lib/server/bingo-bank.ts`,
  `GET/POST /api/admin/seasons/[id]/bingo`, super admins): a Bingo section with "This episode" and "The season" rows (what
  the cards use), Write/Again opening the AskAi prompt and a paste box, Save squares (refused under 8 passing), and See for
  the list with what was dropped and why.
- **The card** (`src/new/show/bingo.tsx`): **New card · 2 left** under an unticked card; it turns into "Sure? You can't get this
  card back" with Keep this one / Deal a new card (ink, not yellow: it's optional); toasts say one more, then the last.
- **Checks**: `tests/bingo.test.js` (the mix, stand-ins, rerolls), `tests/bingo-research.test.js` (kinds, phases, both
  prompts, the parse, names). `scripts/dev-test/bingo-fixture.js` (canned answers, banks filed through the real parse and store,
  zt seasons only) and **`scripts/dev-test/check-bingo-bank.js <outDir> [--width=390] [--keep] [--api]`** (67 PASS at 390). new-fixture.js and
  talk-fixture.js now file an eight-square season bank, so every card holds the same eight squares (two people can back each
  other up); check-new-episode-games.js (283), check-new-notify.js (94 API) and check-new-watch-along.js (276) were adapted and
  pass, as do check-backup-restore.js and `npm test` (690).

## As built: step 2 (2026-10-27)

- **The run** (`db/bot-research.js`, kind `bingo`, in `DEFAULT_SCHEDULE` at 1440): its minutes count back from when the
  episode itself airs (`dueAt(run, ends, nextAt, starts)`), and each bingo slot carries `until` (its air time), which both
  `dueRuns` and `nextRunAt` keep to: no try, and no "come back then", once the episode is on. `STALE_MS.bingo` is the longest a
  run can be set (14 days), so the air time is the only cut-off. Three tries, 20 minutes apart, as trivia.
- **The season's own bank**: while a season has none (`planRuns` asks `Bingo.hasBank` only of a season whose schedule has
  bingo on), each bingo slot gets a twin, `bingo@season` with `forSeason`, due with it and sorted after it, so the episode's
  squares come first and the season's on the VM's next call; each call stays one write and one check inside the route's 300 s.
  Once the season has a bank, the twin isn't planned.
- **`bingoJob`**: the write (`buildBingoPrompt`, 160 s), the parse (fewer than `BOT_MIN` = 16 kept fails before the check, one
  ask), the check in its own ask (`buildCheckPrompt`, the rest of 280 s), `judged`, then `storeBank` with the run's id only at 16
  or more live; fewer is a failed try and the bank there stays. A scheduled run for an episode (or season) that already has live
  squares finishes without asking ("written already, left as they are"), so a hand-written bank is never replaced on schedule;
  Write squares now (slot `now`) always writes. Every run's result keeps all its squares, live or dropped with why.
- **The check** (`db/bingo-research.js`): seen on screen, likely but not certain, not a scoring moment, not a spoiler, `sameAs` an
  earlier square, and a likelihood it can correct; each must be given outright to pass. A square the same as one the check
  dropped is kept.
- **Admin**: the Bingo section has **Write squares now** and **The season's now** (`POST .../bot-research { kind: "bingo",
  scope? }`, allowed before airtime; the route now honours a dev server's `x-gys-bot` stand-in as the cron route does). Bot
  research's run list shows a bingo run as Bingo squares with every square. Both schedule editors (classic Setup, the desk's
  Autopilot trial) and the desk's line say "before it airs".
- **Checks**: `tests/bot-research.test.js` (bingo's timing, the air-time cut-off in both functions, the season's twin; the older
  tests keep a schedule without bingo), `tests/bingo-research.test.js` (the check prompt, its parse, `judged`).
  `check-bingo-bank.js` grew the bot's half (planner on a test clock, `runNext` for the fixture season only, the admin route
  through `fake-bot.js`, the browser on Episode 11); `fake-bot.js` knows `bingo` and `bingoCheck`.
  `check-new-settling.js` now takes the usual runs from `DEFAULT_SCHEDULE` (it still expected the three from before trivia).

## As built: step 3 (2026-10-27)

- **Only a called line counts** (`src/lib/game/bingo.ts`): `countLines(squares, marked, truth, called)` counts the called lines
  still ticked (`called` null: a card from before the banks, every ticked line, as before) and says how many count, wait or came
  off (`LineCount` grew `called` and `off`); `fullLines`, `lineState`; `firstLineAt` takes the calls, so "who got a line first"
  is who called first, of a line that didn't come off.
- **The server** (`src/lib/server/bingo.ts`): `POST { call: 0-7 }` (`callBingo`: from airtime, a kept bank card, the line all
  ticked; calling it again changes nothing) appends `{ line, at }` to `bingo_cards.called_lines`; unticking a square of a called
  line takes its call off. `POST { said }` (`sayBingo`: once you've seen it; squares on a card for the episode, since a kept
  card keeps squares its bank no longer has) writes `episode_call_says`, the table talk shows' says use, so a square settles for
  every card that has it. `EpisodeBingo` grew `calls`, `called`, `order` (ticks in order, for Undo), `didIt` (the couch's called
  squares waiting on a second say, with whose lines and your say) and `of`. `GET ?of=<user>` (`theirBingo`): someone's card on a
  couch you share, once you've seen it (with truth and their "Did it?" squares) or while you're both in a together session of
  it (no truth); else no squares, only `catchUp`. Weekly Bingo's table counts called lines on bank cards.
- **The notice** (`push-events.ts notifyBingoCall`, on the call): couch-mates who follow the show and have seen the episode or
  have a card on it, and share their games with the caller, hear "riley called BINGO" · "ZT Survivor 51 · Episode 5 · Look at
  their card", once per caller and episode, never the caller; its link `/show/<season>/tonight?bingo=<n>&of=<user>` opens the card
  (Tonight's `BingoLink`, which then leaves the URL). It rides the `bingoLine` setting, renamed "Bingo". Cards from before the
  banks keep the old line notice (`notifyBingoLines`).
- **The card** (`src/new/show/bingo.tsx`): a line made on a bank card shows **Sure all three happened?** (its squares, Undo for the
  last tick in it, **Call BINGO** in yellow: the one thing it's asking), and the call is the Bingo!; called squares are outlined.
  Once seen: each called line (Counts / Waiting, "waiting on a second say" / Came off, "The couch says ... didn't happen"),
  **Did it happen?** (Yes / No / Didn't notice; Didn't notice is kept on the phone only), and the couch's cards each open theirs.
  Someone else's card is read-only, with their called lines and "Did it?" squares; behind, "See X's card once you've caught up on
  Episode n". Tell the couch (the chat line) shows once a line is called.
- **Checks**: `tests/bingo.test.js` (calls, states, first by call). `check-bingo-bank.js` (147 at 390) grew step 3: refusals,
  calling twice, untick taking the call off, the notice (who hears, once), "Did it?" end to end, their card (seen, behind,
  together via a watch plan + session, 404s), a card from before the banks; browser: jordan's Sure / Undo / Call BINGO, alex
  through the notice's link to jordan's card answering Yes and Didn't notice, sam told to catch up. check-new-episode-games.js
  (285) calls its lines (Episode 6, Weekly Bingo, the on-air card); check-new-notify.js (145) hears the call, not the line;
  check-new-watch-along.js (276) unchanged and passing.

## As built: step 4 (2026-10-27)

- **Flags** (`bingo_square_flags`, from 0146): `FLAGGED_OUT` (bingo.ts) is a square flagged by two people or by an admin (`"user"
  .role = 'admin'`); `bankFor` deals neither those nor, for you, a square you flagged. So your flag takes a square off your own
  card at once if you haven't ticked it (it's dealt afresh), and two (or an admin's) take it out of everyone's new cards; a
  ticked card keeps it. `POST { flag: square, on? }` (`flagBingo`): a square on your card; `on: false` takes your flag back
  wherever the square went. A square whose bank was written again can't be flagged (409). `EpisodeBingo.flagged`.
- **The card**: under any bank card, "A square that can't happen? Flag it" opens **This square's unfair**: the card's squares,
  each Flag / Flagged · Undo; flagging on a card you haven't ticked says "a new square in its place", with Undo in the toast.
- **The admin**: each live square in the Bingo section says how many flagged it and whether it's out, with **Hide** (an admin's
  flag, out at once) and **Unhide**; the row counts "N flagged out"; the list's toggle is See / Close. `POST .../bingo { episode,
  flag, on }` (`adminFlagSquare`).
- **Two leftovers from step 3's Noticed**: the bingo row's "Did it happen? N squares to say about", and the couch feed's BINGO
  line (`couch-hub.ts`, kind `bingo`, opening their card through Tonight's `?bingo=&of=`).
- **Checks**: `check-bingo-bank.js` 176 at 390 (flags end to end, the admin's Hide, the feed line for alex and not sam, the
  Tonight nudge, riley flagging and undoing from the toast, the admin hiding and unhiding).

## Noticed, not fixed
- ~~**"Did it?" only lives in the sheet**~~: built with step 4: Tonight's (and the episode page's) bingo row says "Did it happen?
  2 squares to say about" while any wait on you.
- ~~**No couch feed line for a call**~~: built with step 4: "riley called BINGO on Episode 5 · look at their card" on the hub's
  On the couch, as the notice goes (a show you follow, an episode you've seen or have a card on, someone who shares their games).
- **Unhide takes back only the admin's flag** (for later): two people's flags keep a square out; there's no "keep it anyway".
- **A flag says no why** (for later): trivia's flags don't either. If flags pile up, a reason (can't happen / can't be seen / too
  certain) would tell the bot's prompt what to avoid.
- **Tell the couch** (the chat line) is partly redundant now that calling tells the couch; kept for a chat-first couch.
- **Didn't notice is per phone** (localStorage): on another device the square asks again. A stored "pass" would need a column.
- **A premiere gets no bingo run while its season isn't "airing"** (for later): `planRuns` skips seasons that aren't, and a
  season usually turns "airing" at its premiere. The season's own bank covers it, or Write squares now.
- **Switched on less than a day before an episode, that episode's bingo run never comes** (bot research's rule: runs timed before
  it was switched on never run). Write squares now covers it.
- **The real ChatGPT has never written or checked bingo squares** (for the deploy): every check here uses stand-ins. Before
  relying on it, run Write squares now once on a real season (or point `check-rulebook-prompt.js`'s pattern at the bingo prompt)
  and read what comes back.
- **The admin episode page treats an episode far ahead as aired** (pre-existing, for the admin's polish): `episodeRows` doesn't
  list it, so `aired` falls back to true and Bot research shows Run quick/full now on Episode 11 (the route still refuses them).
- **The check ask runs in the bot's one persistent chat profile** (ask-ai-bot memory's context leak): if the VM hasn't moved to
  temporary chats, a check could see the write. The parse is structural, so the risk is a lenient check, not a wrong bank.

- ~~**Step 1 alone would make bingo worse on a couch**~~: settled by step 3's "Did it?" list (anyone who's seen it can back a
  called square up). Still ship 1-3 together.
- **No bank, no bingo** (for the deploy): once this ships, every live season's cards disappear until a bank is written.
  Step 2's run writes them only for seasons with the bot's schedule on and bingo in it (Survivor 51's saved schedule runs only
  the schedule check): add bingo to the couch's live seasons in the desk, or tap Write squares now (and the season's) on each,
  before deploying.
- **On a talk show, a bingo tick no longer settles a Call it call** (by design here: the squares aren't the show's moments).
  Call it's own "say what happened" still settles them. check-new-episode-games.js now asserts the split.
- **The phase line trusts recorded exits** (for step 2): with no results in, "who's still in" is the whole cast, so the phase
  line can lag (Tribes after the merge). The AI searches anyway; step 2's check prompt could flag a phase that doesn't match.
- **The Weekly Bingo rules line** (`game-rules.ts`) still says a square settles by "two of you ticking it, or saying so": true
  now, but step 3's "Did it?" list is the way to say so (word it there).
- **Fixed 2026-10-28: a finale's squares failed their check.** The writer was told "It's the finale. Lean towards finale moments",
  but the check judged every square against regular episodes, so finale moments read as rare: Survivor 49's finale passed 12 and
  then 4 of 30 in the recorder (a bank needs 16). `buildCheckPrompt` now judges a premiere, finale or reunion against others of its
  kind (episodeKind, from the count, title and note the bot already passed). The same squares, re-checked through the local bot:
  24 and 22 of 30. **Noticed, left:** the finale's lean suggests "a crowd, confetti" and loved ones, which modern Survivor finales
  don't have (an on-location after-show). The check drops them, so it costs a few squares, not a bank. The writer could be told
  to lean on what this show's own finales have.
