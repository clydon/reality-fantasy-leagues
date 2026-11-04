# Plan: research on a rulebook, through our bot (Check for changes, What scores)

**Status:** built 2026-11-04 on branch `ccr-dc484e47-2hp97o`, migrations 0432 and 0433. Checked: `tests/rulebook-scores.test.js`,
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
- **Up to an episode** (the user, 2026-11-04, "up to a specific episode": someone watching a season that has already aired would be spoiled by the
  moments it finds): both questions take `through`, an episode, and say "Only Episodes 1 to N of this season have been
  watched: search only those episodes' recaps, treat Episode N as the latest aired, never list anything that first appears
  after it". The sheet has an Up to episode stepper (the app's words, as the couch's "Up to Episode 5"), suggested from where the admin is on the season (`seenThrough`), else
  what's aired, else the lot; the last episode means the whole season and no scope. The run carries it as
  `desk_runs.episode_number` (0: the whole season), the answer as `rulebook_answers.through_episode` (0433), and the card
  and History say "up to Episode N". Past the last episode is refused.
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

- **Pure:** `rulebook-scores.js` (+ `.d.ts`): `LADDER`, `PER_UNIT`, `buildScoresPrompt({ show, season, airing, aired,
  episodeCount, blocks })`, `parseScoresAnswer`, `reviewScores(answer, blocks, { castNames })` → `{ blocks, rows, added,
  skipped, problems, warnings, leftOut, lines, changes }`.
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
