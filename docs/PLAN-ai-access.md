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

## Money: what we pay, what it could earn (estimates, 2026-11-16; the user asked for it plainly)

Three separate questions, three tables: what **we pay** each month, what **wait ads earn**, and what **paid options could
earn**. Prices checked 2026-11-16 (sources at the end); usage follows the user's picture: most people never ask an AI, only a
couch's game maker does it often, and adding a show is a one-time ask.

**The usage this assumes** (change these and everything follows):

| | Today | 300 people | 1,000 people |
|---|---|---|---|
| Couches (about 5 people, one maker each) | 1-3 | 60 | 200 |
| Seasons airing that someone plays | 2-4 | 15 | 30 |
| Maker asks a month (describe a game, changes, more moments: ~10 a couch) | 10-30 | 600 | 2,000 |
| New seasons added a month (~10 asks each, once) | 1-2 | 20 | 50 |
| Automatic research asks a month (seasons x ~9 an episode x ~4.3 episodes; shared by every couch) | 80-155 | ~580 | ~1,160 |

### 1. What we pay each month

| Service | Today | 300 people | 1,000 people | Why |
|---|---|---|---|---|
| **Vercel** (the app) | $0 (Hobby) | $20 | $20-50 | Hobby is non-commercial: **ads or any charge need Pro, $20 a seat** (it includes a $20 usage credit; past it, e.g. $0.60 a million calls) |
| **Neon** (the database) | ~$5 | $15-40 | $40-120 | Usage only: ~$0.106 an hour awake (0.25 CU), $0.35 a GB-month; it's awake more hours as more people use the app |
| **ChatGPT, our bot** | $0 | $0 | $0 | Signed out, on Oracle's Always Free VM (a second free VM at 1,000 for evening peaks) |
| **ChatGPT Plus** (Codex, for one-offs like the catch-up) | $0, or $20 for a month it's needed | same | same | Optional; the Free plan has no Codex |
| Domain | ~$1 | ~$1 | ~$1 | |
| **Total** | **~$6** (**~$26** once ads or charging start) | **~$36-61** | **~$61-171** | |

**The one risk to budget for: ChatGPT stops answering the signed-out bot** (blocked or rate-limited). The same asks on a paid
API (research ~$0.10 an ask with web search, a maker ask ~$0.003 on a small model) would add **~$10-20 today, ~$85-105 at 300,
~$180-255 at 1,000** a month. Sharing research across couches is what keeps this small: without it, research alone would be
5-10 times as many asks.

### 2. What wait ads earn

An ad plays only while someone waits on our bot: a maker's ask, someone watching a new show get set up, and (the user's
convenience barrier) a free couch tapping "Get Episode 5's results" for results that are already in, with a short simulated
wait. Web video ads pay about **$4-15 for every 1,000 views** in the US (vendors' 2026 benchmarks; fill under 100%).

| | Today | 300 people | 1,000 people |
|---|---|---|---|
| Wait ad views a month (maker asks + set-up waits + results taps) | ~50-100 | ~1,000 | ~3,400 |
| **Earned** | **under $2** | **~$5-15** | **~$15-50** |

So the wait ad is a convenience barrier, not an income: it covers a fraction of the bills, because waits are rare when only
makers ask.

### 3. What paid options could earn (illustrations, not forecasts)

| Option | What it gives | Assumes | 300 people | 1,000 people |
|---|---|---|---|---|
| **Couch Pass**, ~$5 a season, one person buys it for the couch | Results arrive by themselves (no tap, no wait), the maker's asks fast, no wait ads for anyone on the couch | 15% of couches | ~$15 a month | ~$50 a month |
| **Supporter**, ~$3 a month, a person | No ads anywhere, fast asks, a little flair (a badge, a theme) | 3% of people | ~$27 | ~$90 |
| **One quiet ad slot** where people linger (the hub, the end of a recap), never in a reveal | Pays for free users | ~40 views a person a month at ~$1-3 per 1,000 (display) | ~$12-36 | ~$40-120 |

Card fees take a bite out of small charges (roughly 30 cents plus a few percent each): a season pass or yearly supporter beats
monthly $3 charges. **Net at 1,000 people:** costs ~$61-171 against ~$195-310 with all three, or ~$65-140 with the pass and the
supporter alone. Today it's a ~$6-26 hobby whichever way.

### Brainstorm: profitable, not annoying, still free (for the user's reaction)

- **The free promise:** everything plays free, always. Paying only buys convenience (no tap, no wait, no ad) and a little
  flair. The DIY ChatGPT link is the free way past every barrier, instantly, with no ad.
- **Charge the couch, not the person.** The maker is the one who asks, and the couch benefits together: a season pass one
  friend buys (or splits) feels like chipping in for snacks, not a subscription. It also matches today's One tap / Autopilot
  (results_plans, per couch and season).
- **Results by tap is the gentle barrier:** free couches tap "Get Episode 5's results" (15 seconds, an ad, or ask ChatGPT
  yourself); a passed couch's results simply arrive. Nobody is locked out, it's one tap a week.
- **Ads only at natural pauses:** an AI wait, a results tap, one quiet slot in the hub. Never in a reveal, a recap's moment or
  the chat.
- **Cut the bill before charging more:** polling is what grows with people (docs/HOSTING.md, Levers): one combined poll, only
  while the window is in front, push for rare events, roughly halves Vercel and Neon at any size.
- **Later, if wanted:** a "Where to watch" link per show (streaming affiliate programs, where they exist) is useful rather
  than annoying; not priced here.

Sources: Vercel's Pro pricing (vercel.com/docs/plans/pro-plan; third-party 2026 summaries agree on $20 a seat with a $20
credit, and $0.60 a million invocations); Neon's plans (neon.com/docs/introduction/pro-plan: $0.106 a CU-hour, $0.35 a
GB-month, no minimum); OpenAI's Codex pricing (developers.openai.com/codex/pricing: Plus $20 a month); web video ad
benchmarks (Applixir's 2026 posts: $4-15 blended, ~$7 for US/tier-1; a Playgama guide: higher). Check each before deciding.

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
