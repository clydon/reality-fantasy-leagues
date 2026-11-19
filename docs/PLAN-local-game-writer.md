# A game writer on our own machines (the user, 2026-11-18)

> **Status (2026-11-19): Active.** W0 is on master. W3 and W4 were measured on branch `writer`, which is unmerged and merges cleanly. A tuned 0.8B model is fast enough for a free VM's 4 cores but right only about half the time when sure. The user picks one of the three ways on (BACKLOG 156).

> "I've always had this big idea to be able to ask gpt to create your game. Right now that process takes forever and costs a bunch.
> Im thinking there must be a local solution; create a semantic llm that knows the recipes of how a game works and can take a
> sentence(s) and create it into a game. Or take an existing game and a modifying sentence to change/add values or parts, etc. I'd
> imagine that solution would be much much faster. Even if that involves spinning up another free vm or some other solution."

**Status:** a plan with a measured first step (the spike below: no AI at all reads a third of the named games, never wrong
when it's sure). Nothing in the app calls it yet. **Where it must run (the user, 2026-11-18):** "i want this ability to parse plain
language into a game to be able to eventually be run on a remote server so it can work directly on prod. if that means setting up
something locally first, so be it. but remember the free servers/vm will be much lower spec than my laptop 4090". So the target is
an always-on server production can call, sized like a free VM (CPU only, a few cores); the PC is where it's built, trained and
measured, never what production depends on. Builds on the Start-a-game redo's
catalog (docs/PLAN-start-a-game-redo.md, Round 2), the start-a-game GPT's checks and eval set (docs/PLAN-start-a-game-gpt.md G1,
"Speedy asks"), and AI access (docs/PLAN-ai-access.md, kind C).

## Today

- **A typed game is one bot ask:** about 12,000 tokens of the engine's manual and the page (docs/HOSTING.md, 2026-11-07), answered
  in 10 to 40 s median depending on the model (U0's "Speedy asks": Sonnet at low 10.6 s for a typed game and 5.6 s for a change,
  ChatGPT's browser 39 s and 35 s), at most 10 a person a day, on the user's own plans (Claude's weekly limit, shared with the
  lanes; ChatGPT's after the Plus trial). The gallery's Describe row says "about 40 seconds".
- **The same queue does research** (results, rulebooks, Make it a game at 2 to 4 minutes), so a typed game can wait behind it.
- **In AI access's terms** it's kind C, "Mine, I wait for it", the kind where tiers would differ by speed, the ad and the daily cap.

## The idea that makes it small: the catalog is a menu

Round 2 gave every value the engine plays a home in the gallery's catalog (`src/lib/game/start-gallery`): 56 show bases (13 a
sport's), the changes in rows, controls with closed ranges. 209 of the 210 values are proven by a game our check passes
(docs/design-round/wizard-r2-coverage.md). So a typed game doesn't need writing. It needs **choosing**: a base, its changes, the
controls' values and a length. This plan calls that choice an **order**.

- **An order is short and closed.** A few dozen tokens from a fixed vocabulary, where a spec is open JSON. A model that only has to
  choose can be small, and a grammar generated from the catalog can hold its output to the menu: it can't name a change that
  isn't there.
- **Our check still decides.** The catalog turns an order into the spec exactly as the gallery's taps do; the engine's check passes
  it or says why.
- **A change to a game is an order too.** "Make it 2 each" sets the size control to 2; "add a captain" turns a change on. Making a
  game and changing one are the same job.
- **Saved games are orders** (the heart beside Start, built 2026-11-18), so a saved game and a written one re-fit to a season the
  same way.
- **Off the menu means the engine can't play it.** A new moment, or a rule nobody has built, goes to the tracker, and the bot keeps
  it.

## Three readers, cheapest first

Each reader returns an order and whether it's sure of it. When it isn't sure, the next reader takes the request.

1. **Words.** The menu's own words (names, plain lines, a synonym list), with numbers bound to their controls ("3 each", "2 lives",
   "first to 50"). Runs in the phone and on the server in milliseconds: free, offline, nothing to host.
2. **Meaning.** The app's own embedding model ranks the menu's entries by what a clause means, so "whoever's castaway lasts longest
   wins" puts Outlast first. It's already in the deployed functions (`db/embeddings.js`: bge-small-en-v1.5, 8-bit, 34 MB, loads in
   about 0.3 s, today used for side bets' suggested answers). No new service. The spike showed it shouldn't settle a game by
   itself (below): it narrows the menu for reader 3 and offers "Did you mean" choices.
3. **Composition.** A small open model (1 to 4 billion parameters) for long requests: several rules in one sentence, conditions
   ("double in the finale"), numbers the first two readers bind to the wrong control. It writes the order, held to the
   catalog's grammar, and it's fine-tuned on pairs we make ourselves (below), so its prompt is the request alone.
4. **The bot keeps the rest:** a moment the show doesn't have (G1's added moments need research), a show that isn't set up yet
   (Make it a game), a rule the engine can't play.

Whatever a reader isn't sure of becomes Describe's questions: each open slot is a choice from the menu, answered with a tap, so the
interview needs no AI either.

## Measured (the spike, 2026-11-18)

`node scripts/dev-test/writer-eval.js --reader=words|meaning|both --set=corpus|tuning|all [--held-out] [--fails] [--json=<out>]`
(the menu, readers and 36 edits in `scripts/dev-test/writer-spike/`). Offline: the model made no network call.

**The held-out corpus.** Of its 104 requests, 39 name a game the engine plays and are scored; 27 leave the game open (the tracker
says the wizard should ask), 22 should be refused, 2 only the resolver can catch, and 14 are sports (no reader was ever sure of one).

| Reader | Sure of the 39 | Right when sure | Best guess right | Refused, of 22 | Edits sure, of 36 | Time |
|---|---|---|---|---|---|---|
| Words, held out | 8 (21%) | 100% | 54% | 20 | 34, all exact | about 1 ms |
| Words, with the corpus's lessons | 13 (33%) | 100% | 59% | 22 | 34, all exact | about 1 ms |
| Meaning | 6 (15%) | 33% | 31% | 22 | 20, all exact | 10 to 20 ms |
| Both (words, then meaning) | 12 to 17 | 75% to 82% | 54% to 59% | 20 to 22 | 35, all exact | about 18 ms |

- **Words is never wrong when it's sure,** and on the requests that leave the game open it asked on 23 of 27 (the 4 it was sure of
  were right). On the tuning sets it was sure of 68 of 161 at 85%. A match is judged on the engine's values and optional parts;
  every sure answer that matched that way matched strictly too (every number and moment).
- **Meaning alone shouldn't decide.** Single words pull it ("traitors" on The Traitors' page reads as the Secret Traitors party
  game) and it can't see "not"; all three of the cascade's wrong sure answers came from it. Its place is ranking the menu for
  reader 3 and offering "Did you mean" choices, not settling a game.
- **What the rest needs.** Of the 39, words settles about 13; about 6 more need only more word rules or arithmetic ("a bench of 2"
  means 5 drafted, 3 start); about 20 need show words mapped to the page's moments ("pick the star baker", "who gets a rose"),
  points bound to a moment ("3 for an idol, 5 for immunity"), or conditions: reader 3's job. About 8 of those also need the menu
  to grow first: points per moment, automatic moments (quit) in the page's facts, how many Traitors reach the end, a top-N
  question, the episode a cut happens at. The 27 open requests need the wizard's question, not a model.
- **Speed.** Words about 1 ms; the embedding model loads in about 0.3 s, embeds the menu once in 0.55 s, and a new show's first
  request takes about 100 ms (its moments). Edits were written from the catalog and tuned on, so their numbers are optimistic.
- **What made the menu hard to read** (for the gallery too): names that collide (Parlay ticket, Build a ticket and A parlay; Solo
  predictions and Just me; "last one standing" for Outlast's win and the lives pool; Prediction sheet, Prop sheet and A new sheet
  each episode), two "Who wins" questions (one open to the finale, one locked at the start), controls that don't exist (which
  moments count, a pickup's multiplier, what chips settle on, a late lock), and one request reaching two games (a survival pool
  head to head is a change that adds a final, or the Head-to-head picks square, which doesn't).

## Training data we make ourselves

- **Orders and their words, by the thousand.** Take a base, turn on changes our check allows, set controls in their ranges, check
  it, and write it in the engine's own words (the base's plain line, Every rule's sentences, `describeSpec`). The catalog knows each
  pair's order, so every pair is labeled for free, and a new catalog entry is in the next run's data.
- **Edits the same way:** an order, one op (a change on or off, a control set), and that op in words (the change's name and line,
  "make it 2 each").
- **How people really type it:** a few hundred of those paraphrased once through the bot (casual, short, typos, "lets play
  survivor"), a one-time ask on the user's plan.
- **Held out:** the tracker's 104 requests "as people would type them" (`tests/fixtures/engine-capabilities.json` corpus), its
  examples and stretch requests, and the spike's 30 edits. They're for measuring only, never training.

## Where it runs

| | Readers 1 and 2 | Reader 3, the small model |
|---|---|---|
| **In the app** (the phone and the Vercel functions) | Yes: reader 1 is plain code, reader 2's model ships with the functions already | No: no GPU, and the functions' size and time limits |
| **The user's PC** (RTX 4090 Laptop, 16 GB; Core Ultra 9; 31 GB) | Not needed | A 1 to 4B model answers in well under a second; but only while the PC is on, as the bot's PC side is today |
| **A free Oracle Arm VM** (A1: up to 4 cores and 24 GB, when the region has capacity) | Not needed | Always on; a fine-tuned 1 to 2B model on its CPU in a few seconds (to be measured). Today's `gys-bot` VM (1 GB, 1/8 core) can't run any model |
| **Both** | | The PC first and the VM when it's off: the bot's own pattern, behind the same tunnel and key |

The serving target is the always-on row: production calls a server, never the PC. So reader 3 is chosen by how it does on a free
VM's CPU (W4 measures with the PC's GPU off and its threads capped to the VM's cores), and the 4090 only trains and tests it.

Not recommended: free hosted model APIs. They rate-limit, some train on what's sent (Gemini's free tier, docs/HOSTING.md
2026-11-08), and they're another outside service (paid services contained).

## What it changes

- **Describe answers at once** for most requests, with no daily cap and no queue behind research.
- **A game's screen can take a change in words** ("make it head to head with playoffs"), applied as taps would be, each change
  marked with its Undo.
- **AI access's kind C keeps its shape (the user, 2026-11-18: "Yes, keep the direction").** Typed games and typed changes stay in
  the 2026-11-08 split, free with a short ad or paid and fast, even once the answer is instant; research stays slow either way.
  How the split looks when the answer takes a second (the ad before the result, or a daily count) is W6's to design.
- **The bot's queue** is left to research.

## Steps

- **W0. The menu and the eval (the spike, done 2026-11-18).** `scripts/dev-test/writer-spike/` (the menu, readers 1 and 2, 30 edits)
  and `scripts/dev-test/writer-eval.js` (scores any reader on the held-out sets).
- **W1. Reader 1 in the catalog,** wired to the gallery's field: a sentence it's sure of opens that game's screen at once ("Build it
  from your words" in under a second); unsure goes to today's path. Proof: when sure, right at least 95% of the time on the corpus
  (the spike: 100% on 13 of 39); no edit read wrong. With it, the menu's missing controls (points per moment, automatic moments,
  a cut's episode, a top-N question) and its colliding names.
- **W2. Reader 2 on the server,** one route using `db/embeddings.js`: "Did you mean" choices when reader 1 isn't sure, and the
  short list of menu entries reader 3 is given. Never a game by itself.
- **W3. The training data,** generated from the catalog (orders and edits in the engine's words), plus the one-time paraphrase.
  Proof: every generated pair's order passes our check; the held-out sets aren't in it.
- **W4. Reader 3, measured for a free VM (the user's okay, 2026-11-18):** install a runtime on the PC (llama.cpp, which also
  builds for an Arm VM's CPU; or Ollama) and download two or three small open models (about 0.5B to 3B, 4-bit, 2 to 8 GB in
  total). Prompt each with the menu and the grammar, then fine-tune the best on the 4090. Score each on `writer-eval.js` for
  accuracy, and for speed on CPU only with 4 threads (an A1 VM's 4 cores) and with 1 (the smallest host). Proof: a model and a
  quantization that's right when sure at least 95% of the time and answers in about 3 seconds or less on 4 CPU threads, or a
  measured reason none does.
- **W5. Serving:** an always-on VM sized by W4 (an Oracle A1 if a region has capacity), behind the bot's tunnel and key; the PC
  only as a faster fallback while it's on. The app's route runs readers 1, 2, 3, then the bot for what's left.
- **W6. The screens,** through docs/DESIGN-PROCESS.md: Describe's instant result and its tap-to-answer questions, and "Change it in
  your words" on a game's screen.

## Decided (the user, 2026-11-18)

1. **Set it up locally first, for a remote server.** W4 may install a runtime and download two or three models on the PC; what's
   chosen must run on a low-spec, always-on server production can call.
2. **Kind C keeps its direction:** typed games stay free with a short ad, or paid and fast.

## Open (the user's)

1. **The always-on host,** asked once W4 has measured: an Oracle Arm VM (free when a region has capacity) or another server.
