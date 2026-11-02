# Plan: getting a show ready when it's added

## The ask (the user, 2026-11-01)

Added The Challenge 42 (a finished season of 14) on their phone, up to Episode 1. The Contestants tab said "No contestants
yet", and only Episode 1 got a summary:

> When I add a show we must get the game rulebook data loaded, then the cast. Have a delightful animation while that is being
> added. Keep the animation loading indicator as long as we are getting that data (if they come back later and we aren't done,
> we should show the progress/animation). If we are in progress, we can show a loading indicator on pages such as the cast tab
> if we don't have all info yet.
>
> Secondly, I was able to get a brief episode summary for episode one. However since several episodes are out I should've been
> prompted to get all existing episodes. Same/similar delightful loading/progression animations that shows so long as we (or
> gpt bot) is researching.

## What exists (read 2026-11-01)

- **Add a show** (`src/new/watching/sheets.tsx`, `POST /api/me/shows` → `src/lib/server/add-show.ts addShow`) makes the show and
  season rows and the schedule from TVmaze, then the art after the response. That's all it does: no rulebook, no cast, no
  research. The only feedback is the toast "X added to your shows · not a game yet".
- **Rulebook:** made lazily by `ensureSeasonRulebook` (`db/rulebooks.js`) the first time a game, the desk or the listings job
  touches the season. A show that's already a game (The Challenge: built-in `challenge`) needs no bot for it. A show that isn't
  one ("Not a game yet", `shows.set_up_at` NULL) only gets rules through **Make it a game** (`make-game.ts`): the bot drafts how
  it works, then the cast (TVmaze's for a series or talk show), and a person taps **Looks right**.
- **Cast:** a new season of a show that's already a game has no way to get one but the desk (Backstage's Add the cast:
  `desk-cast-page.ts` `queueCast` → `askCastNow` → `sendCast`). Only sports fill their cast by themselves (ESPN).
- **Episode summaries:** `RecapsCard` (`src/new/show/recaps.tsx`) appears once an episode you've *seen* has none. Its one ask
  (`episode-recaps.ts askRecaps`) already covers **every aired episode** with no recap, seen or not. But the card says "Episode
  1 only says when it aired", so it reads as one episode, and the others stay hidden until you mark them seen. For a show
  that's a game nobody plays, the same tap also queues each episode's **results** (`research-asks.ts`, one at a time on the bot
  clock), and only once the season has a cast.
- **Progress that exists:** Make it a game's `Asking` view, the recaps card's "Filling in what happened", and `ResultsProgress`
  chips. Nothing on Home, in the Add sheet or on the Cast tab.

## Decisions (Claude, 2026-11-01; the look and the brand-new-show call are the user's, asked below)

1. **One job per season: Getting it ready.** Three steps in order, each skipped when it's already there:
   - **How it's played:** a show that's a game → `ensureSeasonRulebook` (instant, no bot). A brand-new show → Make it a game's
     ask, by the bot, applied when our check passes (`review.approvable`, no problems), see Q2. Otherwise it stays staged for
     a person, and Make it a game shows the review.
   - **Who's in it:** TVmaze's cast for a series or talk show, else the bot's cast prompt (`buildCastPrompt` with the season's
     format). Written as the season's cast, the way the desk's Send does. Never over a cast that's there, and never on a season a
     game already plays (its cast is the desk's and the commissioner's).
   - **What happened:** the recap ask for every aired episode, then each episode's results one at a time (research-asks), when
     it's ours to do (a game nobody plays).
2. **Started by** Add a show, by following a season that's missing any of it, and by **the bot clock**, which picks up any
   followed season whose job isn't done. The clock covers a bot that was away and a job cut off by the 300 s request limit, and
   it fills the seasons added before this ships: The Challenge 42 gets ready by itself once it's live. Tries back off (3, then
   "couldn't", with Try again on the page).
3. **One state, read everywhere:** a `season_fills` row (migration 0160: step, asking, message, tries, per-step done). A light
   `GET /api/seasons/[id]/ready` read. A `ready` summary on Home's Your shows and on the space read. Polls only while a job is
   going and the page is visible (the show every 5 s, Home every 15 s). HOSTING.md gets the note.
4. **"Prompted" for the episodes:** Add's Where are you step says it: "14 are out. We'll look up what happened in each", on by
   default, with a switch to leave them. The recaps card's words count every aired episode ("Looking up all 14 episodes · 6
   in"), never just the ones you've seen. Summaries still only show for episodes you've seen (spoiler-safe).
5. **Where the progress shows** (whatever the look):
   - **Add sheet:** it doesn't close on Add. It plays the getting-ready animation, with "Go to the show" and "Done: it keeps
     going".
   - **Home poster:** marked while its show is getting ready.
   - **Show header:** a progress line in the show's colour that opens the steps.
   - **Contestants tab:** a loading look while the cast is coming, in place of "No contestants yet". If it fails: "Couldn't find
     the cast" with Try again.
   - **Episodes tab:** each episode still being looked up shows it on its row.
6. **Found on the way:** an episode that aired more than a week ago says only its weekday ("Aired Wed 8:00 AM"). It gets the
   date too ("Aired Jul 30"), as `lockTime` does.

## The look (the user's pick)

Gut feelings, in the Lower Third language (Tags Not Fills; yellow stays "now/you"; transforms only, no clip-path while a page
renders: tune-in.tsx's lesson):

- **A. Call sheet.** Three lower-third slates (HOW IT'S PLAYED, THE CAST, EPISODES 0/14) slam in as each step starts, a red tally
  light pulsing on the one working and a check stamped as it lands. The cast step fills a strip of empty headshot frames as
  faces come in, and the episodes step lights a filmstrip of numbered tiles 1→14. The same pieces are the loading looks
  elsewhere: the Contestants tab is the empty frames, and an Episodes row lights its tile.
- **B. Test pattern.** The show's poster starts as a no-signal card (static, then colour bars) and comes into focus as each step
  lands. A chyron ticker along the bottom says what's happening ("Finding the 34 challengers…", "Catching up on Episode 6 of
  14…"). On Home, the poster itself is the indicator.
- **C. Casting wall.** People first: a grid of silhouettes that flip one by one to faces and names as the cast lands. The rulebook
  is a first card leafing through pages, then the episode tiles. It's at its best with a big cast and weakest with a talk show's
  three.

Recommended: **A, with B's no-signal poster on Home.**

**The user's picks (2026-11-01):** A, the Call sheet (with B's poster on Home). A brand-new show's drafted rulebook and cast are
**applied automatically** when our check passes (unreviewed for the desk; otherwise it waits in Make it a game). **Build now, no
mock** (the week was at 88%): built in lane `rfl-ready` (port 3008, branch `ready`), checked at 390, the user looks on their phone
before any push.

## Steps

1. Backend: migration 0160 `season_fills`, `src/lib/server/getting-ready.ts`, hooks in add-show/follows, the bot clock's slot,
   the `ready` read. Tests: the step planning (pure), and what's skipped when.
2. The look on the Add sheet and Home.
3. The show: header line, Contestants loading, Episodes rows, the recaps card's words, the aired date.
4. Checks: `scripts/dev-test/check-getting-ready.js` (a `zt-` show with a fake bot answer, up/down; at 390 wide), npm test,
   next build. Then the merge routine (migration → Neon rehearsal), off an episode night.

## The user's asks while it was built (2026-11-01)

- **"Don't forget the DIY copy and paste ChatGPT approach. Since that will be the 100% free model that will be offered to
  everyone"**, then: "not strictly the copy and paste. We had a short url, and open prompt in chatgpt, then paste." Every step can be
  asked yourself through Ask an AI's sheet (the question parked at `/b/<code>`, Open in ChatGPT or Grok, paste the answer back,
  Copy for any other AI). It's the main button whenever our bot is away. The episodes' version warns that the answer tells what
  happens in every episode that's out.
- **"Once this is finished, make sure we completely remove challenge 42 so we can test a real user flow"**: production, after the
  merge (the desk's Delete season; The Challenge itself and its other seasons stay).

- **"We are doing the future paid route. The DIY approach is the default free path"** (the user, at the go to ship). Our bot running
  it all by itself is what a paid plan will be. Asking ChatGPT yourself is what everyone gets free. When paid plans arrive, a free
  account's job runs as it does while our bot is away (`run`'s `ask` false): what needs no bot goes in (a game's rulebook, the
  results' queue, anything pasted), and each step waits with Ask ChatGPT yourself leading (`away`). So the switch is one check in
  `run` (the account's plan, before `botUp`) and the call sheet's words, never a second flow.

## As built (branch `ready`, lane `rfl-ready`, 2026-11-01)

- **Migration 0160** `season_fills`: one row per season, holding the step it's on, the ask going now, tries, stuck/done.
- **`src/lib/season-fill.ts`** (pure, `tests/season-fill.test.js`): `stepAction` (skip, now, or the bot, per step), `stepsShown`,
  `tileState` and `fillLine`.
- **`src/lib/server/season-fill.ts`**: `run` takes the steps in order within 280 s. `startFill`, `goFill` and `fillState` are the
  route's. `fillPrompt` and `fillPaste` are the free way. `fillsNextAt` and `runDueFill` are the bot clock's.
  - **What it reuses:** `make-game.ts autoMake` (Make it a game with no daily limit, applied as whoever added it, never as the
    desk's: `confirmMake(..., { auto: true })`, "by itself, as it was added" in History, `provenance.auto`). `desk-cast-page.ts
    castByItself` and `castPastedByItself` (the desk's ask, then Send). `episode-recaps.ts recapsByItself`. `research-asks.ts
    askResults`.
  - **When the bot is away:** pasted answers still go in (a brand-new show is set up from its pasted answers with no bot), and
    the rest waits with the message "Our bot's away".
  - **In checks:** stand-in TV listings without a stand-in bot never reach the real bot (as add-show.ts keeps checks off ESPN).
- **Route** `/api/seasons/[seasonId]/fill`:
  - GET returns the state; `?prompt=1` returns the step's question.
  - POST takes `start`, `retry`, `go` or `paste`.
  - **Who can start it:** someone who follows the season or plays it.
  - **The episodes switch:** Try again keeps what was chosen for the episodes.
- **The bot clock** (`cron/bot-research`): a call that ran no research runs one due job, and `next` counts the jobs.
- **Season headers carry `filling`:**
  - `going`: a job open, or results asked for.
  - `stuck`.
  - `missing`: a show that's a game, a season with no cast and no job. That's The Challenge 42's case: the show's page starts the job
    for someone who follows it.
  - A brand-new show gets ready as it's added. One added before stays Make it a game's.
- **UI** (`src/new/show/getting-ready.tsx`, motion in `new.css`):
  - **Add's sheet:** Where are you has "Look up all N that are out" (on). After Add, the sheet plays the call sheet (Go to the
    show, Done). Added from the guide's listing sheet, it gets ready silently.
  - **Home's poster:** the no-signal card with a Getting ready tag.
  - **The show's header:** the chip (opens the sheet) and the line in the show's colour.
  - **Contestants:** the casting wall in place of "No contestants yet". If it's stuck: Try again.
  - **Episodes:** the filmstrip card in place of Fill in what happened while it goes, and "Looking up what happened…" on a row
    you've seen.
  - **Fill in what happened's card** counts every episode that's out ("All 14 episodes that are out…", "Ask ChatGPT for all 14").
  - **Aired dates:** an episode aired over a week ago says its date ("Aired Oct 22").
- **Checks:**
  - `scripts/dev-test/check-getting-ready.js <out> [--width=390] [--api] [--keep]`: 36 PASS, its screenshots looked at.
  - `tests/season-fill.test.js`.
  - Updated for the new flow and words: check-new-watching, check-new-listings, check-show-words.

## After it went live (2026-11-01, the user re-adding The Challenge)

- **A linked show's newer season** (`86d5ba9c`): search hid a show's TV listing once any season here was linked to it, so a season
  newer than any here couldn't be added. Now the listing is offered as "Latest season" when every season here is finished.
- **"Season not found"** (`a567e424`): the show list is kept for up to 15 minutes (5 at the edge, 10 more while it refreshes, and
  5 on the phone), so a season deleted on the desk was still offered. Following it now falls back to adding it from its TV listing.
- **The desk couldn't delete World Series** (`d014016b`): two games deleted within their 30 days still held it, by design. With
  their season gone, the refusal's one row led nowhere; it now lists each game, each opening its page with Delete it for good.

## Noticed, not fixed

- Each episode's **results** for a show nobody plays are bot-only (one clock run an episode). Asking ChatGPT yourself covers the
  summaries, not the stats. Doing those by hand would be one paste an episode: a step for the free model if stats matter there.
- The Challenge's built-in format (`challenge`) reads its rules from the built-in, so "How it's played" is instant for it. A cast
  answer for The Challenge's 34 people is one long ask; the bot's ~2-3 min fits in a run.
