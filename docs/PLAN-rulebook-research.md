# Plan: research on a rulebook, through our bot (Check for changes, What scores)

**Status:** built 2026-11-04 and 2026-11-05 on branch `ccr-dc484e47-2hp97o`, migrations 0432 to 0434. Checked: `tests/rulebook-scores.test.js`,
`scripts/dev-test/check-desk-rulebook-research.js` (ALL PASS at 390), `check-new-desk.js` (101 PASS; its Check for changes
step moved to the new sheet, and its rulebook versions read from the database: confirming a phase and undoing it each move
the version, so the hard-coded 2, 3 and 4 had drifted). **Live 2026-11-04** (`ae013ef`, pushed to master as a fast-forward with the user's go-ahead).

## Why

The user, 2026-11-04, from their phone: the desk's rulebook page still had a copy-and-paste-only sheet (Check for changes:
Copy the question, paste the answer, Review it) when everything with that ability should offer our bot too. And they wanted
a second, narrower pass: **What scores**, a look at the rulebook's list of moments that (1) finds what's missing and (2)
scores every moment so that strong players score high, poor players score low, a poor player never sinks a team, and
weekly totals differ instead of bunching, and that gives **the same value for the same moment every time** unless we
decide it should change: "more of a mathematical approach rather than a randomized prompt".

Their own ask to Grok, which this turns into a prompt we can repeat: "I'm making a fantasy league for The Challenge season
42 Cutthroat. I have some moments/events that individuals can do to earn or lose points. Am I missing any? And, if you could
rescore the values what would you do so strong players are identified and poor players hurt people but don't sink their
fantasy team."

## Decided

- **One sheet per question, our bot first.** The rulebook page gets a Research section with two rows, Check for changes
  and What scores (`src/new/desk/rulebook.tsx` ResearchSheet). Each opens the same sheet: **Ask our bot** (the yellow
  button, when the rulebook is a season's) with Paste it under it (the shared Ask an AI sheet, `AskAiPasteSheet`: Open in
  ChatGPT or Grok, copy the question, paste the answer back). The copy-only sheet is gone. A library rulebook (no season)
  takes a paste only and says so: the desk's queue is per season.
- **Asked the way the cast is asked.** Ask our bot queues a desk run (`desk_runs`, kinds `rulebook` and `scores`, episode 0
  of the rulebook's season, `rulebook_id` set; `desk-research.ts queueRulebook`), behind whatever else is asking. The queue's
  driver asks the bot (`desk-rulebooks.ts askRulebookNow`), reads the answer (an answer with no JSON object is a failed run,
  History says so, nothing staged), and stages it in **`rulebook_answers`** (0432). The page polls every 4 s while a run is
  open; the sheet can be closed meanwhile ("it carries on, and its answer shows here").
- **What scores' answer is a pick list** (the user, 2026-11-04, after the first version showed it as lines): the moments it
  adds first, each with its proposed value, then every existing moment with its value now and the proposed one; a row that
  changes something has a check to accept or decline (accepted to start), a row the answer leaves as it is has nothing to
  pick, and the button counts what's accepted ("Use 7 changes"). Only the accepted rows go into the draft
  (`rulebook-scores.js pickScores(blocks, review, declined)`: declined ids stay as the rulebook has them; tested). Check for
  changes still goes in whole: its answer is a rulebook, not a list.
- **The answer waits on its row.** The latest unsettled answer of each kind is reviewed on every read of the page (the
  review is pure and cheap) and shown as what it would change: the row carries the title and a dot; the sheet shows the card
  with **Use these changes** (the blocks go into the draft, to save as a fix or a show change as any edit; the answer is
  settled `used`) and **Put away** (`dismissed`). A paste is staged the same way, so it survives leaving the page.
- **Scoring is a ladder, not a number the AI picks.** `src/lib/game/formats/rulebook-scores.js` LADDER: eleven rungs, each
  with a test and a fixed number of points, top to bottom: wonSeason +6, wonAlone +4, bigPlay +3, earned +2, edge +1,
  along +0.5, nothing 0, slip -0.5, lost -1, out -2, ownFault -3; plus perUnit for a moment counted per amount (the AI gives
  points per unit between 0.01 and 2, so a typical best total lands on earned or wonAlone). The AI only says **which rung**
  each moment stands on; the review takes the rung's points and ignores any number it wrote. The ladder obeys the user's
  three wants by construction, and the prompt says why so the AI never "adjusts":
  - *strong players stand out:* wonAlone (4) beats any two edges (1 + 1) and an earned plus an edge, so the week's winner is
    the week's top earner;
  - *a bad week hurts, never sinks:* the worst a week can cost (ownFault -3 plus a slip) is under one wonAlone, and whoever
    leaves earns nothing more, so one bad week is at most one good week undone;
  - *totals differ:* what most of the field gets each week (along, edge) is 0.5 or 1; what one or two people get (earned
    and up) is 2 or more.
  The test checks the arithmetic (`tests/rulebook-scores.test.js`). Changing a value means changing the ladder here, once,
  on purpose: that's the "unless we truly believe it should change".
- **What's missing joins as custom moments.** The answer's `add` list becomes `customMoments` (the same shape as Add a
  moment in the editor: label, counted, answered by, reliability, during, except winners) with the rung's points in
  `points`. Left out, with why, on the card: a repeat of a moment the rulebook has (content words mostly the same), a label
  that names someone in the cast, a rung that isn't on the ladder, no description.
- **Not scored means unchanged.** A moment the answer skipped, or put on a rung that doesn't exist, keeps its points, with a
  warning on the card. An unknown id is a warning. A split value (`{ exclusive, shared }`, The Challenge's finalist 3/5)
  takes the rung's number for both, as the editor's stepper does.
- **Rarity, a second axis, fixed like the ladder** (the user, 2026-11-05: a rare advantage scores a smidge higher than a
  common one): research says for every moment how often the show produces it, mostEpisodes (+0), someEpisodes (+0.5) or
  onceOrTwice (+1), on top of the rung for moments on earned and above. A small edge gains nothing (it's still a small
  edge) and a negative moment gains nothing (a rare disaster is no worse than a common one), so the ladder's promises hold
  at every rarity (tested). **Never fluid:** a value is set once, from the show's history, when the moment is scored; what
  actually happened this season never moves a value in play. Real counts are for a note at the season's end, when saving the
  rulebook as next season's starting point, for a person to act on.
- **Spoilers: held, not scoped** (the user, 2026-11-05, after "up to an episode": a row saying "sealed until Episode 9" is
  itself a tell). What scores reads the whole season, so nothing is missed, and what it adds carries `known`
  (pastSeasons: the show's own repertoire, which anyone who's watched before expects, never a spoiler; thisSeason) and
  `firstEpisode` (the first episode it could apply from under the show's rules, never when it first happened). A
  new-this-season moment past the reader's Where I am mark is held: not a row, not in the counts, the title, History, the
  blocks or the lines, with no trace of it, until they're past that episode; "didn't fit" notes carry a first episode too.
  No mark (or seeing results straight away) holds nothing. The sheet carries one fixed line whatever is held, so its being
  there says nothing. The desk is the one place this applies: the admin plays too.
- **Outcomes, not moments** (the user, 2026-11-05/06: drafting the winner mustn't take a poor team from rags to riches;
  "reach the final" and "win" stacked to 11 where a best week is 4 or 5). Where one moment always brings another with it
  for the same person in the same episode, the engine pays both, so the review prices the bigger one as its rung minus
  what comes along: the pair is worth the rung. Chains come from the structure first (`chainsOf`: a winner way out brings
  a finalist way out the winner reaches too; a safety segment's win brings zero votes at the vote by the cast it protects)
  and from research's `implies` second (the prompt asks for it and says never to lower a rung for it). A row priced this
  way says so ("3 · 7 in all with Finalist"). **The fourth promise**, tested with the other three in both ownership modes:
  everything the winner collects in the last episode (the wonSeason rung, finalist and all) is under two of the biggest
  weekly wins, so a season of ordinary scoring always outweighs the title. `SHARED_RARITY` (2): in a shared league the
  rarity step counts double, and the review writes both halves of a value (a pair where they differ, or where the rulebook
  kept a pair; priced through the same chains per half), shown as "· 5 shared" on the sheets; a commissioner's accepted row
  keeps the pair unless adjusted.
- **A per-amount moment says per how much** (step four; the Below Deck tip scored per dollar, 2,083 points a share): a custom
  moment counted per amount carries `per` (1, 10, 100 or 1,000; `OPT.per`, the editor's "Per how much?"), the moment and the
  compiled event carry it (`per`, `unit`), and the engine divides the amount research answers by it before it scores
  (state-logic `eventPoints`: $2,083 at +1 per $1,000 is 2.083). Existing moments have no `per`, which is 1, today's
  behaviour: the Below Deck tip moves only when its `per` is set to 1,000 and the rulebook saved as a fix. What scores'
  question says each per-amount moment's per how much, and an added per-amount moment may say it.
- **The survivoR check (step five) wasn't run:** the dataset (`dev/xlsx/survivoR.xlsx`, from the October research) isn't in
  the repo. The four promises hold the arithmetic in tests; the check is rerunnable from docs/RESEARCH-scoring-values.md's
  method whenever the dataset is to hand.
- **How the scoring is playing** (step six, read-only): the desk rulebook's third Research row, from the season's accepted
  results as the admin may see them (`scoringPlay`, over `seasonStats` by their mark): each moment that fired, how often,
  what it scored in all and its share of all points moved; each week how many people share a total with someone; and plain
  notes when something stands out (one moment carrying 40% or more; a moment scoring more than two best weeks a time, its
  per how much to check; most weeks most people tied; once the season is done, the last episode's best against a best
  earlier week, the fourth promise as it played). By the standing rule it moves nothing: what stands out is for next
  season's starting point, by hand.
- **The numbers come out of the first prompt; What scores is a step of getting a show ready** (the user, 2026-11-06): the
  rulebook prompt names the moments (it must: describing the show is one job) and never a number (its `points` field is
  gone; custom moments start unscored). Getting it ready gains **what scores** after how it's played (`FILL_STEPS`,
  season_fills.step widened, 0435): our bot asks the scores question for the season's rulebook and the answer is applied
  whole (`applyScores` with no mark: nobody plays it yet), or pasted the free way; `rulebooks.provenance.ladderAt` marks
  it priced and the step skips from then on. An answer with a problem is left staged for the desk's card.
- **Use saves straight away, and new-this-season moments land from their episode.** The desk's What scores Save (and the
  getting-ready apply) go through `applyScores`: the rows picked are saved as a fix, except a moment new to this season
  that first applies from Episode 2 or later, saved as "the show changed from Episode N" (one per episode), which How it
  works already keeps from anyone who hasn't reached N. So an added moment never reaches a player's How it works before
  their place in the season, whoever added the show and whenever. The draft isn't involved; History has Undo for each
  save. (A later change already in force past that episode folds the moment into a fix instead, said in History.) The
  commissioner's settle still writes the copy's base: a held row only shows them once reached, so the gap is other couch
  members behind them; noted, not built.
- **A moment belongs to one person** (the user, 2026-11-05, Below Deck 13's first research had "the tip is revealed" and
  "a guest complains" as moments): the rulebook prompt says every custom moment is something one cast member did or had
  done to them, with a line for a reality series beside the talk-show and scripted ones. What scores says such a moment
  stands on nothing, and when it was added by hand the review proposes **dropping** it (`drop` on its row: "drop" in place
  of a value, accept or decline like the rest; in Backstage, Drop it or Keep it), so research isn't asked about it every
  episode for nothing. A moment a segment builds is never dropped, only worth 0.
- **Settled a row at a time.** Use marks the accepted rows used and the declined ones put away (`rulebook_answers.settled`,
  0434); an answer stays open while anything is left, seen or held, and leaves the research row for a reader once nothing
  they can see is left. A held moment surfaces later from the same answer, reviewed against the rulebook as it is then.
- **Check for changes keeps Up to episode** (0433): its answer is a whole rulebook, not rows, so scoping the question is
  still the way to keep it spoiler-free; the stepper suggests where the admin is on the season. What scores ignores
  `through`.
- **The current episode isn't an input to scoring; the season so far is.** The ladder judges what a moment *is*, never how a season is
  going, so nothing about the week goes into scoring (the user asked whether it should). The prompt does carry how far the
  season has got ("5 of 14 episodes have aired", "recaps of this season's first 5 episodes") and the airing line, read from
  the schedule: that's for finding what's missing (what this season's recaps actually report) and for not inventing what
  hasn't aired. No names, no results, as the rulebook prompt: people read the rulebook before they've watched.
- **The question is deterministic in form.** Every moment is listed with its id, where it comes from, how it's counted, who
  answers it and what it's worth now; the AI must answer for every id; ids are fixed, so the same rulebook asks the same
  question. The parse is strict (one JSON object, chatter around it fine); the review is pure and has no randomness, so the
  same answer reviews the same way (tested).

## As built

- **Pure:** `rulebook-scores.js` (+ `.d.ts`): `LADDER`, `RARITY`, `RARITY_FROM`, `PER_UNIT`, `KNOWN`, `buildScoresPrompt({ show, season,
  airing, aired, episodeCount, blocks })`, `parseScoresAnswer`, `reviewScores(answer, blocks, { castNames, mark, episodeCount,
  settled })` → `{ blocks, rows, added, skipped, held, problems, warnings, leftOut, lines, changes }`, `pickScores`.
- **Server:** `desk-rulebooks.ts`: `DeskRulebook.research` (`bot`, and per kind `asking` and `answer`, a `RulebookAnswerCard`:
  title, lines, problems, warnings, leftOut, changes, blocks or null, and for scores rows/added/skipped);
  `rulebookPrompt(id, kind)` (`{ prompt, task }`), `askRulebookNow`, `pasteRulebookAnswer`, `settleRulebookAnswer`,
  `researchKind`. `desk-research.ts`: `queueRulebook`, and `drainDeskRuns`' branch for the two kinds. Route
  `api/desk/rulebooks/[id]`: GET `?prompt=check|scores` (`1` is `check`), the page takes over a cut-off queue while asking;
  POST `ask`, `paste`, `answer`; `review` is gone (the paste stages and the page reviews). `maxDuration = 300`.
- **Data:** 0432 `rulebook_answers` (rulebook, kind, source, answer, by, settled at/by/as) and `desk_runs.rulebook_id`, the
  kind check widened.
- **Client:** `rulebook.tsx`: the page polls while asking; the Research section; `ResearchSheet` (the card, asking, or Ask
  our bot and Paste it); `ScoresPicks` (the pick list: Added, then Moments, columns Now and New, a check per changing row;
  Left out under it). `data.ts` re-exports the types.
- **Stand-in bot:** `fake-bot.js` knows the scores question (`kind: "scores"`); Check for changes is `setup` (the rulebook
  prompt with a template, no change).
- **Browser helper:** `browser.js` runs off Windows too (Playwright from `require`, Chromium from `PLAYWRIGHT_CHROME` or
  `/opt/pw-browsers/chromium`, else Playwright's own).

## Checks

- `node --test tests/rulebook-scores.test.js` (in `npm test`): the ladder's arithmetic, the question, the review's rules,
  determinism.
- `node scripts/dev-test/check-desk-rulebook-research.js <outDir> [--width=390] [--keep]`: its own fixture (zt_rr_, the ZT RR
  Show on The Challenge's rules, a library rulebook), the stand-in bot: refusals, both questions, pastes (refused, staged,
  settled), Ask our bot for both (queued, asked, landed; the bot down; a library rulebook; an unreadable answer), and the
  browser (the rows, the sheet, asking, the card landing as a pick list, two rows declined, Use 7 changes, Paste it).
- `check-new-desk.js`'s Check for changes step goes through the new sheet and Ask an AI's paste.

## Open

- **The real bot hasn't been asked yet** (no bot in this session). `scripts/dev-test/check-rulebook-prompt.js` is the model
  for a prompt check against ChatGPT; a `--scores` variant would send `buildScoresPrompt` for the presets and keep each
  answer, to see how consistently it lands on the rungs across runs.
- The first real pass on The Challenge 42 is the user's to run from the desk (What scores → Ask our bot), then Use these
  changes and save as a fix.
- `check-new-desk.js` still has no bot step for rulebooks (the rulebook research check has it).

## Stage two: the commissioner's own What scores (built 2026-11-05)

The user: commissioners shouldn't rely on the admin. The same question, ladder, rarity and holding, on the couch's own copy
of the rulebook (Make it ours), from Backstage › Scoring rules.
- **Server:** `src/lib/server/our-scores.ts`: `ourScores` (the state: copy, mark, asking, the answer as this commissioner may
  see it), `ourScoresPrompt`, `askOurScores` (desk-research.ts `queueRulebook` with the copy as the rulebook, a commissioner's
  Ask ChatGPT for me), `pasteOurScores`, `settleOurScores` (Accept, the default for any row not named; Adjust, a value;
  Decline: what's accepted goes into the copy's base, a changed moment's points and an added moment as one the couch
  answers each episode, as the couch's own are; the games scored again, previewed first; one batch with Undo; the rows
  settled), `putAwayOurScores`. Route `api/seasons/[seasonId]/backstage/rules/scores`. The shared pieces work on any
  rulebook now: `seasonOf` resolves a league copy's season, and `researchFor`, `stagePaste`, `settleRows` are exported
  (desk-rulebooks.ts); `ruleGames`, `preview`, `syncGames` are exported (ours.ts).
- **Client:** Backstage › Scoring rules, under What counts (only with a copy, for a Commissioner): the What scores row (a dot
  while an answer waits) and `OurScoresSheet`: Ask our bot or Paste it, the fixed line about where you are; an answer as
  rows (added, then changed) each with Accept · Adjust (a stepper) · Decline, Save N through the preview guard, Put away.
  Players see nothing.
- **Not built, on purpose:** a setting for whether moments the season's rulebook adds mid-season join the league by
  themselves (today the copy asks Add it or Skip, as before). One toggle at most, if it's ever wanted.
- **Check:** `node scripts/dev-test/check-new-our-scores.js <outDir> [--width=390] [--keep]` (new-fixture.js; the stand-in bot).
