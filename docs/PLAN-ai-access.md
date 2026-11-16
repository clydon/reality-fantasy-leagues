# AI access: free, do-it-yourself, and paid (the structure, before the mocks)

The user, 2026-11-16: "we want the cost to run this website low. That means using the chatgpt bot whenever we can. eventually
if and when app traffic raises we will need the codex option as the default and paid methods for app users ... we need an
accurate structure, table, and mock out where and how users are prompted with either the DIY chatgpt link (reads a shorthand
temp url), a limited paid, and a full access paid." And: long waits (the slow bot, the do-it-yourself round trip) get "a fake
loading bar (or as real as it can be) while also serving a windowed ad for monetization."

Builds on: the fast-AI paywall decision (2026-11-08, docs/PLAN-start-a-game-gpt.md "The fast AI is paid; free waits carry an
ad"), paid services contained (no flow anyone can reach spends a paid key), the /b/<code> brief links, Results ways' One tap
and Autopilot (src/lib/server/results-ways.ts, prices in cents, charged 0 "free during beta"). **Status: a draft structure for
the user's review. Nothing here is built; the mocks are the next step (the design process, below).**

## What asks an AI today (inventory, 2026-11-16; file references in the lane's chat, all re-checkable by grep)

Four kinds, by who pays the wait and whether one answer serves everyone:

| Kind | Actions | Who starts it | One answer serves everyone? | Someone waits on screen? | DIY link today |
|---|---|---|---|---|---|
| **A. Automatic** | Scheduled research (quick, full, facts), trivia, bingo, the tie-break, the bot's card and calls, a season's bingo bank, the catch-up | Nobody: the bot's clock | Yes (the season) | No | n/a |
| **B. Shared, someone starts it** | Who went home (One tap), full results (Fill in Episode N), Make it a game, Getting it ready (rules, scores, cast, recaps), Fill in what happened, Fill in who's playing (sports), Look them up again, the show changed | A player, a couch's maker or commissioner | **Yes**: the season's, every couch gets it; a second tap joins the first | Optional: a minute or three, they may leave | Yes for results, Make it a game, Getting it ready; copy-only for recaps and rosters; none for Look them up again |
| **C. Mine, I wait for it** | Describe a new game, a typed change, More creative moments, Add a moment › Ask, What scores on our own rulebook copy | A player on the couch (10 a day) or a commissioner | **No**: each ask is one person's | **Yes**: ~40 s on ChatGPT (measured), ~10 s on a fast model | None (What scores has one) |
| **D. The desk** | Run now (every kind), cast, rulebook check, made-for games, the catch-up | Site admins | Season-wide | Queued | Paste for most |

The money is in C: B's answers are shared (one ask serves a whole season's couches), and A has nobody waiting. So:

- **A and D stay free and invisible** (our bot, ChatGPT by default; Codex only for one-offs the user okays).
- **B stays free for everyone**, always: results are the game. The bot asks once for the whole season; the DIY link is the
  instant way for whoever doesn't want to wait. A paid plan only adds Autopilot (asked on schedule, nobody taps).
- **C is where the tiers differ**: speed, the ad, and how many a day.

## The ways (columns)

| | **Ask ChatGPT yourself** (DIY) | **Our bot asks** (free) | **Plus** (limited paid) | **Pro** (full access paid) |
|---|---|---|---|---|
| How | The /b/<code> link opens ChatGPT (or Grok) on your own account with one line; paste the answer back | The shared ChatGPT browser bot | A fast AI (paid API) for your asks | The same, more of it |
| Cost to us | ~0 (a brief row, 7 days) | ~0 money; the bot's time is the limit (one question at a time a bot) | Per ask (API) | Per ask (API) |
| Your wait | ChatGPT's own (~30-60 s) + a paste; we read it instantly | ~40 s for C, ~2 min for B, plus anyone ahead in the queue | ~10 s, no queue | ~10 s, first in queue |
| Ad | None (you're in ChatGPT; nothing to wait on here) | **A windowed ad on every wait**, even when the answer's ready (the 2026-11-08 decision) | None | None |
| C asks a day | Unlimited (your account) | 10 (today's cap) | e.g. 50 a month fast, then the free bot without the ad | Fair use (e.g. 300 a month), then the free bot without the ad |
| B (results etc.) | Instant paste | Free, shared | Free, shared, + Autopilot on **one couch** for its seasons | + Autopilot on **every couch you run** |
| Who pays | Nobody | Nobody | A person, monthly (or a couch, a season: decision 1) | A person, monthly |

A paid ask is gated on the server by the person's plan and counted; the paid key is reached only through that gate (paid
services contained still holds for everyone else, and the fast path is never reachable without an entitlement).

## Where people are asked (one sheet, three moments)

1. **The Ask sheet** (one component everywhere an AI is needed: today's AskAiSheet / AskAiPasteSheet, grown):
   - Free person: **"Our bot asks for you"** (the default button: free, about 40 seconds, an ad while you wait) and **"Ask
     ChatGPT yourself"** (free, your account, instant once you paste). A quiet line under them: "Plus: about 10 seconds, no ad."
   - Plus/Pro: one button, **"Ask"** (fast), and "Ask ChatGPT yourself" as the quiet alternative.
   - For B (results), the DIY link leads, since the bot may already be on it ("Someone's bot ask is on its way · 1 min").
2. **The wait** (free only; the screen the ad pays for):
   - A progress bar as real as we can make it (below), the step in words ("Reading the episode's recaps"), the ad in a
     window under it (labelled "Ad", muted, 15 s, counting down), and **Keep going** (it finishes in the background, a toast
     brings you back).
   - A quiet **"Skip the wait: Plus"** under the ad. Never a nag before the ask; only here and at the cap.
3. **The cap** (free, the 11th C ask today): "That's today's 10. Tomorrow, or ask ChatGPT yourself (free), or Plus." DIY is
   always offered as the free way through, so the cap never walls anyone off.

Plus and Pro themselves live in Settings › Your plan (what you have, this month's asks, Autopilot's couches), and the upgrade
sheet opens from the three moments above only.

## The progress bar, as real as it can be

| Signal | Where it comes from | Used for |
|---|---|---|
| Queue position | The bot's /health (`busy`, what it's answering) | "1 ahead of you" before it starts |
| Stage | The bot's stream "progress" (opening, sending, writing) | The bar's first third |
| How much is written | Stream progress: characters, and the asker's pattern counted (one per person answered: research already does it) | Research and cast: real (people answered / cast size) |
| Elapsed vs typical | Measured medians (game words ~40 s on ChatGPT; EXPECT_MS for Getting it ready) | C asks: an eased curve to 90% at the median, then a slow crawl, never a fake 100% |
| The ad | Its own countdown | The answer shows when it's in **and** the ad has run (decision 2) |

DIY has no server wait to fill: the paste is read at once. Its three-step track (Open · It answers · Paste it back) stays.

## Data (when it's built)

- `ai_plans` (a person's plan: free, plus, pro; since, until; the payment's reference) and today's `results_plans` (a couch's
  season: One tap, Autopilot) kept for B.
- `ai_asks` (a row an ask: who, kind A-D and the action, way (diy, bot, fast), provider, seconds, cached or not, ad shown and
  for how long, the answer's id): the counts for caps and allowances, and the numbers for pricing.
- Payments: Stripe, and charging needs Vercel Pro (docs/HOSTING.md); the ad network: not chosen (the 2026-11-08 call).

## Decisions for the user (each a named choice)

1. **Limited paid: a person's monthly plan, or a couch's season pass?** Recommend a person's monthly Plus (C is one person's
   asks), keeping the couch's season unlock for Autopilot (B) as today's One tap/Autopilot already price it.
2. **Does a free answer wait for the ad to finish?** The 11-08 decision says yes, even when cached. Recommend yes, 15 s at
   most, with Keep going so nobody's stuck on the screen.
3. **An ad on the DIY way?** Recommend none: there's no wait on our side, and DIY is what keeps costs near zero.
4. **What's free forever?** Recommend: every result (B), the DIY link everywhere, 10 C asks a day on the bot.
5. **The fast AI for paid asks:** a paid API (the 11-08 test: Sonnet-class ~10 s, best score; an OpenAI model via its API is
   the other). Not the user's own Codex or ChatGPT plan: a personal plan serving paying customers is a different use, and its
   limits are the user's own. Price it from current rates when it's built.

## Next: the mocks (the design process)

Through docs/DESIGN-PROCESS.md (Intent, then Perception-First, then Impeccable, one check, a screenshot story at 390, then
pause): the Ask sheet (free, paid; for C and for B), the free wait (progress, the windowed ad, Skip the wait), the paid wait,
the cap, Settings › Your plan, and the upgrade sheet. Real renders, not pictures: built as a mock route with fixtures, so the
same parts become the product.
