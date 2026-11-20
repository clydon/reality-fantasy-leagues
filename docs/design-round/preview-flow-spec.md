# The live preview's flow around the story: page spec (Intent, step 1)

Step 14 of docs/PLAN-preview-release.md. The story's cards are docs/design-round/preview-story-spec.md; this is everything around
them: the way in from the gallery, the wait, moments arriving, every refusal, a preview that stopped or ended, leaving and coming
back, and the desk's switch. Phone first at 390.

## The problem

Someone setting up a game taps Try it to watch a season of it play before they make it. Between that tap and the first real screen
there are a few seconds of making, and around it a set of limits the person never chose: five a day, ten being made at once for
everyone, a monthly budget, a switch on the desk. Today the wait counts seconds with no sense of how long; every refusal is an
`error` string in the same "didn't come together" frame; a copied link opens raw JSON; and nothing tells the person they have a
limited number before they spend one. The job: **get them from Try it to the first moment with confidence, and when it can't, say
in one line why and what they can do instead, never a dead end.**

Success: a person can say, before tapping, how many they have left; during the wait, that it's working and roughly how long; and at
any refusal, whether it's them (none left), everyone (busy, full, off) or the game (can't be previewed yet), and where to go next.

## Who, and in what state of mind

| Who | Coming from | Wants | Carries |
| --- | --- | --- | --- |
| **The organizer, first look** | the gallery's game page, mid-setup | to see if this game is the one | 5 left, no preview yet |
| **The organizer, after a change** | the same page, one change made | to see what the change did | a kept preview of the game before the change; 4 left |
| **Coming back** | Create this game or Go back from the story, then Try it again | the same story, at once | a kept preview (free) |
| **The heavy looker** | the gallery, their fifth game today | one more | 0 left; maybe a kept one |
| **Anyone, a bad moment** | Try it | a preview | the service busy, full, down or switched off |
| **Someone sent a link** | a message from the organizer | to see what they saw | nothing: a preview is never shared |
| **A site admin** | the desk's Settings | to open previews to admins, then everyone, and watch the month | the switch, the month's usage |

## The flow

```
Gallery: game page ── Try it (n left) ──▶ The wait ──▶ The story (first moment) ──▶ more moments land ──▶ last card
     ▲                    │                  │                                                         │
     │                    │                  └─ refused / failed ─▶ The wait, saying why ──┐            ├─ Go back ──────┐
     │                    └─ kept one, same game & mark ─▶ straight to the story (free)    │            └─ Create this game ┤
     └──────────────────────────────── Back to the game (always) ◀────────────────────────┘                             │
     ◀───────────────────────────────── the game's page, the preview kept a day ◀──────────────────────────────────────┘
```

### 1. Try it, on the gallery's game page (the wizard lane builds it: step 15)

- **Where:** where it is today, beside "Everyone: …" on the game's page (`data-gallery-preview`), so the place doesn't move; it
  opens the wait instead of today's steps sheet (PreviewBody goes: its words describe a copy the live preview isn't).
- **What it says:** "Try it" with its play mark, and under the button row a quiet line: **"3 previews left today"**. Never on the
  button itself (a count on a button reads as a badge to clear). One line, the count first.
- **States:**
  - n left (5 to 1): the line as above; "1 preview left today" singular.
  - A kept preview of this game as it's set now: the line says **"Your preview is ready: opens free"**, and Try it opens it at once.
  - 0 left, nothing kept: Try it stays (never hidden or greyed: the way it works should still be findable), the line says **"No
    previews left today: more tomorrow"**; tapping it opens the wait at its refusal (below), which says the same and offers Back.
  - Previews off for this person (the desk's switch): no Try it, no line. Today's page without it; nothing promised.
  - A game the runtime can't play yet: Try it shows; the refusal comes from the server (the verdict needs the season).
- **The count is read** from `GET /api/previews/allowance` when the page opens, and set again from the answer of each preview made.

### 2. The wait (src/new/preview/live-story.tsx, Making)

The few seconds while the service plays the season and writes the first moment. Today: "Playing a season of …", a sweeping bar, a
seconds counter.

- **Keeps:** "Made-up season" tag (never mistaken for the show), the headline in the game's name, the one sentence of what it is.
- **Changes:**
  - **The seconds counter goes.** A rising number with no end reads as "how long will this take?"; the sweep already says "working".
    In its place, after 8 s only, one line: "Still going: a long season takes up to half a minute." (Measured: 2 to 7 s typical.)
  - **No allowance on the wait** (PFD's R4, preview-flow-first-view.md: a count during the wait reads as already paid, before the
    preview exists). The count is read at Try it, and after a failure the refusal says "This one wasn't counted".
  - **Back, always:** a quiet "Back to the game" at the foot. Leaving mid-make costs nothing extra: the preview, if made, is swept
    and its use stays spent (it was made). Said nowhere; it's the rare case.
- **Hands over** to the story on the preview host, replacing itself in history (as now), so Back from the story returns to the game
  page, not to another wait.

### 3. Moments arriving (the story, src/new/preview/story.tsx)

The first moment is there at once; the rest land within seconds.

- **Keeps:** a moment not yet made shows "Getting this moment ready" in its phone; the progress strip shows every moment from the
  start, so the shape of the season is visible before it's all there.
- **Changes:** a moment still being made is **marked in the progress strip** (its segment hatched or pulsing), so someone tapping
  Next knows before they get there. Next to a moment not ready yet still goes; its phone says it's coming.
- A moment that never came (the making stopped partway: `failed`): its phone says "This moment couldn't be made"; the strip marks it
  ended (not pulsing). The rest of the story stays usable. No retry here: the person can Try it again from the game (a new make).

### 4. Refusals: the wait, saying why

All refusals land on the wait's own frame (one place, so the person never wonders where they are), its headline and one line
changed, and always a way back. Each says **whose limit it is** and **what to do**.

| Situation | Headline | Line | Action |
| --- | --- | --- | --- |
| None left today, nothing kept | No previews left today | More tomorrow. You can still make the game. | Back to the game |
| Busy (10 being made) | Lots of previews right now | Try again in a minute. This one wasn't counted. | Try again · Back |
| The month's budget full | Previews are full this month | Back on the 1st. This one wasn't counted. | Back to the game |
| The service not answering | Previews aren't answering | Try again in a minute. This one wasn't counted. | Try again · Back |
| Switched off (between page load and tap) | Previews are off for now | | Back to the game |
| A season that can't be previewed | No preview for this season | Its cast or episodes aren't set up for one yet. | Back to the game |
| A game that can't be previewed yet | No preview for this game yet | Every other part of the game works; only its preview is missing. | Back to the game |
| Not signed in | Sign in to preview | A preview is made for you. | Sign in |
| Made partway, then failed (before the first moment) | The preview didn't come together | This one wasn't counted. | Try again · Back |

- "This one wasn't counted" wherever a use was given back (the server gives it back on every refusal and failure before a preview
  exists): the person's real worry at a failure is "did that cost me one?".
- Never "error", never a status code, never the server's internal reason (the verdict's gap goes to the log and the desk).

### 5. Ended, and someone else's link

- **Ended** (30 minutes passed, swept, or closed and opened again from history): the story's page shows the wait's frame:
  "This preview has ended" / "Make another from the game: reopening your kept one is free." / Back to the app (the app's host, as the
  preview host has no game page of its own).
- **A copied link** (the way in already spent, or another browser): today the enter route answers raw JSON. It must land on the same
  frame: "This link has been used" / "A preview opens only for whoever made it, from the game." / Open the app. Nothing about whose,
  and nothing that differs between "used", "expired" and "never existed" (so a link can't be probed).

### 6. Leaving, and coming back (decision 6)

- **Go back** and **Create this game** keep it for a day (as built), then go to the game's setup or on to make it.
- **Coming back** to the same game at the same mark: Try it's line says "Your preview is ready: opens free"; it opens straight to
  the story (the wait flashes at most). After a change, the line goes back to the count, and Try it makes a new one.
- **The game created**: the preview goes (the app's half removes it); nothing to say.

### 7. The desk: Settings › People › Game previews

Beside Who gets in, as decision 3 has it, in the same pattern (a row with its value, a sheet of choices, a toast with Undo, a line in
Settings history).

- **The row:** "Game previews" · its value: "Off" / "Site admins only" / "Everyone, 5 a day each", then "· 12 this month" when any.
  A dot when it's on for everyone and the month is past 80% (the only time the row asks for attention).
- **The sheet:** the three choices, each with what it means:
  - **Off:** "Nobody sees Try it. Previews already open run out on their own within a day."
  - **Site admins only:** "Try real seasons and games before anyone else spends the month."
  - **Everyone:** "5 a day each, while the month's budget lasts."
  No "recommended": the right one depends on where the release is (admins first, then everyone).
- **The month, in the sheet,** under the choices, one bar and one line: "This month: 120 previews · 40% of the budget". Past the
  budget: "Full: new previews wait for the 1st." The service not answering: "The preview service isn't answering." (the desk still
  opens). No CPU seconds, no Vercel words: the budget is the desk's own unit.
- **History:** "Game previews: site admins only", with Undo.

## What's left out, and why

- **A preview count anywhere else** (Tonight, the profile): the allowance only matters at Try it.
- **Buying more, or a waitlist:** the free route (decision 2) has nothing to sell; tomorrow is the answer.
- **A "notify me when previews open":** the switch is a release brake, not a feature launch.
- **Per-person usage on the desk:** the desk watches the budget; one person's previews aren't the desk's business.
- **The made-up season's explanation in the wait** beyond one sentence: the story's own "Made-up season" carries it.

## The drill tree (the structural lens)

| Level | Question | Data held | Verdict |
| --- | --- | --- | --- |
| Try it's line | How many do I have? Is mine ready? | allowance (left), a kept preview by game key | **New display** (one line; the wizard lane builds it) |
| The wait | Is it working? How long? Did that cost me one? | the ask's state, a use taken or given back | **Restructure** (no counter; allowance line; Back) |
| A refusal | Whose limit, what now? | the server's status and message | **Restructure** (one frame, a table of states) |
| The progress strip | What's still coming? | each moment's path or none, `complete`, `failed` | **Repaint** (pending marked) |
| Ended / a used link | Why can't I see it? | 401/403/410 from the story and the enter route | **New screen** for the link (today JSON); **repaint** for ended |
| The desk's row and sheet | Who can, and how much of the month is gone? | `live_previews`, the service's month | **New** row and sheet in the Sign-ups pattern |

## How we'll know it works

- Nobody reaches a refusal they couldn't have seen coming from Try it's line (none left is said before the tap).
- The wait's abandon rate (Back before the story) stays under one in ten at typical times.
- No "didn't come together" without "This one wasn't counted" where it wasn't.
- The desk's month line matches the service's ledger (the end-to-end check reads both).

## Open questions

- With none left, should a kept preview of the game *before* a change be offered ("Your last preview is of the game before your
  change: Open that one")? It's free and it's what they had a minute ago, but it needs the service to say what it kept. Not built
  this round.
