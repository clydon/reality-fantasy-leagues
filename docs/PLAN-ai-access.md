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

## Ask only the difference (the user's rule, 2026-11-16)

"If an episode is already researched a separate couch's research will either be simulated, or just search their additional
custom research questions ... If there was a third couch that was exactly the same as the first, it wouldn't need to reach out
and research at all, it'll just simulate the wait so it incentivizes moving to a paid tier."

| Couch | Asks the AI | What it sees (free) | What it sees (paid) |
|---|---|---|---|
| The first on an episode | The full research (or joins the bot's scheduled run already going) | The wait, real progress, the ad | Fast, no ad |
| Same rules + its own extra questions (the weather each episode) | **Only its extra questions**, with the episode's stored answer as context | The wait for the short ask, the ad | Fast, no ad |
| Exactly the same as one already answered | **Nothing** | A simulated wait (as long as the real one was, at most ~40 s) with the ad, then the shared answer | Instant |

**Built already:** one research per season's episode, shared by every couch (results are the season's facts); asking only what a
stored answer lacks (`only: "missing"`, db/episode-research.js); a season's added moments' own short ask for what the full
answer left unsure (db/moments-research.js `askUnsure`); a second tap on an episode already being asked joins the first
(results-ways.ts). **To build:** a couch's own extra questions per episode, **batched**: one short ask a season's episode with
every couch's unasked questions together (not one a couch); the identical couch's simulated wait (free) and instant answer
(paid); every served answer logged with how it was served (asked, the difference, shared) for the numbers below.

## What it costs (estimates, 2026-11-16)

Measured: a full research ask takes a median **154 s** on the ChatGPT bot and answers ~19,500 characters (this lane's runs); a
"Describe a game" ask is ~43,000 characters (~12,000 tokens, ~10,000 of them the fixed manual) and ~40 s on ChatGPT (the
11-08 test); quick ~30 s, trivia ~120 s, bingo ~220 s, facts ~60 s (desk-research.ts). Prices: Claude API list prices of
2026-11-03 (Sonnet 5.5 $2 / $10 a million tokens in / out, cached reads $0.10; Haiku 5.5 $0.10 / $0.50; web search $10 a
thousand searches); hosting from docs/HOSTING.md "Cost by size". Re-measure tokens with count_tokens before setting prices.

**The assumptions** (change them and the rows follow):

| | Today | Later |
|---|---|---|
| People | 5-15 | 300-1,000 |
| Couches (about 5 people each) | 1-3 | 60-200 |
| Seasons airing that someone plays (distinct shows, a week) | 2-4 | 15-30 |
| Couches with their own extra questions | 0-1 | 20-60 (about 30%) |
| "Mine" asks (describe, change, more moments) a person a week | ~2 (tinkering) | ~1 (most join a game someone made) |
| New seasons added a month (Make it a game, Getting it ready) | 1-2 | 20-50 |

**Asks a week, with the rule** (the automatic research is ~9 asks a season's episode: quick, two full, facts, trivia and bingo
two each, the schedule check):

| | Today | Later |
|---|---|---|
| A. Automatic research (seasons x ~9) | 18-36 | 135-270 |
| Extra questions, the difference only, batched an episode | 0-4 | 15-30 (unbatched, a couch each: 20-60) |
| B. New seasons (~10 asks each), a week | 2-5 | 50-125 |
| C. Mine | 10-30 | 300-1,000 |
| **Total** | **30-75** | **500-1,425** |
| Without sharing (every couch researching its own episodes: couches x ~1.5 seasons x 9) | 14-40 for A | **810-2,700 for A alone** |

**The bot's time** (ChatGPT, one question at a time a bot; A ~110 s on average, extras ~60 s, B ~90 s, C ~40 s):

| | Today | Later |
|---|---|---|
| A week | 45-100 minutes (about 1% of one bot) | 9-23 hours (5-14% of one bot) |
| The evening peak (about 40% of C in ~6 hours a week) | nothing queues | 22-75% busy: one bot at 300 people, a second free VM by ~1,000 (Oracle's Always Free gives two) |
| Without sharing | still small | A alone 25-80 hours a week: queues every episode night |

**Money a month:**

| Line | Today | Later, 300 | Later, 1,000 |
|---|---|---|---|
| Hosting (Vercel, Neon, domain: HOSTING.md) | ~$6 (Neon Launch ~$5, domain ~$1) | $35-60 | $60-200 |
| Vercel Pro: required from the first charge or ad, whatever the size | $0 until then, then $20 | in the row above | in the row above |
| The bot (Oracle Always Free VM, Cloudflare tunnel) | $0 | $0 | $0 (two VMs) |
| Codex for one-offs (needs the ChatGPT Plus plan: the Free plan has no Codex CLI, HOSTING.md) | the plan's price while it's kept | same | same |
| TMDB (show art): its free key is non-commercial; charging or ads need its licence | n/a | price on request | price on request |
| **Total, everything on the free bot** | **~$6 (~$26 once charging)** | **~$35-60** | **~$60-200** |

**What a paid person costs us** (the fast AI on the API; C ask ~12,000 tokens in, ~10,000 cached after the first, ~2,000-3,000
out with low effort):

| Model | A C ask | Plus at 50 a month | Pro at 300 a month |
|---|---|---|---|
| Sonnet 5.5 (the 11-08 test's best) | ~$0.03-0.05 | up to ~$2.50 | up to ~$15 |
| Haiku 5.5 | ~$0.003 | ~$0.15 | ~$1 |

**The risk line: if ChatGPT stops answering the signed-out bot** (blocked, rate-limited), the same asks on the API:

| | Today | Later, 300 | Later, 1,000 |
|---|---|---|---|
| A + extras (full research with web search ~$0.15-0.25 on Sonnet 5.5; the rest ~$0.05; ~$0.10 on average) | ~$8-15 | ~$60-80 | ~$120-130 |
| B (~$0.10 an ask) | ~$1-2 | ~$20 | ~$55 |
| C (Haiku 5.5 / Sonnet 5.5) | ~$0.15 / $5 | ~$4 / $50 | ~$13 / $170 |
| **Total on top of hosting** | **~$10-20** | **~$85-135** | **~$190-350** |

So: on the free bot the AI costs nothing in money at either size, and sharing is what keeps it inside one or two free bots
(without it, research alone would queue every episode night by a few hundred people). The real exposure is the bot being
blocked: up to ~$150 a month at 300 people, ~$350 at 1,000, which is what Plus, Pro and the ads are there to cover. Ad revenue
isn't estimated here: it depends on the network (not chosen) and fill; one input to add when it's chosen.

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

## The DIY link: ChatGPT only, once, and an answer that comes back by itself (the user, 2026-11-16)

"Prevent our short url from being viewed by anyone but the chatgpt itself ... once it's viewed by the gpt it self destructs.
I don't think there's a way a gpt can post back, if there was I'd love to do that."

**Stage 1, the link only ChatGPT reads, once** (small; src/app/b/[code]/route.ts, src/lib/server/ai-briefs.ts):
- Served only to a request that says it's ChatGPT (`ChatGPT-User`) **and** comes from OpenAI's published addresses for it
  (openai.com/chatgpt-user.json, read and kept a day; OpenAI calls the list best effort). A browser gets a plain page: "This
  question is for ChatGPT: open it from the app."
- A new random code each time it's asked for (today it's the prompt's hash, the same for everyone asking the same thing), alive
  30 minutes, and **gone after ChatGPT's first read** but for a 2-minute grace (ChatGPT can fetch twice, and Regenerate fetches
  again); after that, 410 Gone, and the sheet makes a new link with one tap.
- Grok is dropped (no published addresses found), and "Copy the question" for other chats becomes the desk's and the
  commissioner's only (decision 6).
- **What it can't do:** once ChatGPT has read it, the words are in that person's chat, and they can ask ChatGPT to repeat them.
  It stops anyone opening, sharing or scraping the link; the value that can't be copied is ours on the server (the rulebooks,
  the parsing, the checks, the scoring).

**Stage 2, the answer comes back with no copy and paste: our own GPT** (the custom GPT the code half-has already:
`GET /api/briefs/<code>` as JSON and `/api/briefs/openapi.json`, docs/custom-gpt.md):
- A "Game Your Show" GPT with two Actions: **read the question** (our API, with a key only the GPT holds, so the question is
  never on an open URL at all: stronger than stage 1's address check) and **send the answer** (`POST /api/briefs/<code>/answer`;
  the code is a one-time pass for exactly one answer, then it's spent). The app's sheet, already waiting, sees it arrive and
  checks it as a paste is checked today.
- To try before building on it: whether a ChatGPT Free account can use a GPT's Actions (sources disagree), whether a link can
  open the GPT with the code already typed, and how the one-time "Allow gameyourshow.com?" prompt reads. A GPT also needs the
  person signed in to ChatGPT (today's link works signed out). The plain chat link with copy and paste stays as the fallback.
- Heavier, later if wanted: a ChatGPT app (OpenAI's Apps SDK) does the same with screens of its own inside ChatGPT.

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

6. **The DIY link: ChatGPT only?** Recommend yes (stage 1), with "Copy the question" kept for the desk and commissioners, and
   stage 2 (our GPT posting the answer back) tried with a Free account before it's designed in.

## Next: the mocks (the design process)

Through docs/DESIGN-PROCESS.md (Intent, then Perception-First, then Impeccable, one check, a screenshot story at 390, then
pause): the Ask sheet (free, paid; for C and for B), the free wait (progress, the windowed ad, Skip the wait), the paid wait,
the cap, Settings › Your plan, and the upgrade sheet. Real renders, not pictures: built as a mock route with fixtures, so the
same parts become the product.
