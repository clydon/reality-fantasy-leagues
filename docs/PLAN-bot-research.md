# Bot research (experimental)

The ask-AI bot (a ChatGPT session on our Oracle VM, `C:\Users\conor\llm-browser-api`, served at
`https://bot.gameyourshow.com`) does the copy-paste-ChatGPT loop for us, free. Two halves.

## 1. "Ask ChatGPT for me": built 2026-10-24

Every copy-a-prompt, paste-the-answer step is one component, `AskAi` (`src/components/ask-ai.tsx`):

- **Primary, Experimental:** *Ask ChatGPT for me*. It runs the prompt on the bot (`POST /api/ask-ai`,
  `src/lib/server/ask-bot.ts`) and drops the answer in the page's paste box. Shown to super-admins and
  commissioners of any league, only while the bot's `/health` answers.
- **Secondary:** *Copy prompt* (the fallback that always works) and *Open in ChatGPT* (the prompt
  parked at `/b/<code>`, the link carries one line pointing at it; opens in a new tab).
- Gone: the Claude / Gemini / Google AI Mode / Perplexity / Grok / Copilot test links, the custom-GPT
  link, "Copy short version" and the "Read by" line. Brief reads are still logged
  (`/api/briefs/<code>/fetches`).
- Used on: admin episode paste, commissioner episode results, cast import, both new-show flows,
  season rule check, episode lines.

`LLM_BROWSER_API_URL` takes a comma-separated list, tried in order, sharing one `LLM_BROWSER_API_KEY`.

## 2. The schedule: built 2026-10-24

Per season, in Admin > season > Setup > **Bot research** (`bot-research-settings.tsx`). Off by default;
when on, a list of runs counted from when each episode **ends** (its air time plus the season's **Episode
length**, `show_seasons.episode_minutes`, 0066, an hour when blank; Survivor's are 90), every one editable
(kind, minutes or hours after the end, on/off, add, remove, reset). Until 2026-10-24 they counted from the
air time, so the default quick check ran 5 minutes into a live episode and gave up before it ended:

| Run | Default | What it does |
|---|---|---|
| quick | 5 min | Who left the game and the episode's headline. Kept on the run row, shown on the admin episode page. "No source yet" counts as a failed try and is retried |
| full | 60 min | The whole checklist through the paste import: stored in `episode_research`, staged for review |
| full | 540 min | The checklist again, merged field by field into the first (`merge` + `fill`) |

- **The schedule check (0068), a third kind of run:** asks only when the next episode airs, its start and its
  length (`buildSchedulePrompt` / `parseScheduleAnswer`), and files it through `recordNextEpisode`. It stages no
  results, so there's nothing to review: the run to use when only the schedule matters (Survivor 51, since the
  user won't review staged results). Three tries, 20 minutes apart. Admin episode page: "Check the next episode's
  schedule".
- **The next episode, confirmed (0067):** every full research answer (the bot's, a paste, paid auto-research)
  also says when the NEXT episode airs and how long it runs, from the "next time" preview or the network
  (`nextEpisode` in the research schema; `recordNextEpisode` -> `season_episodes`). The `season_air_dates`
  view lays those exact starts over the wiki's dates, so a week off or a special moves every air time:
  lineup locks, reminders, waivers, the bot clock (which also uses that episode's own length). An admin's
  value (`source = 'admin'`) is never overwritten. Setup shows "Next: Episode N, ..." under the length.
- Tables: migration `0065_bot_research.sql` adds `show_seasons.bot_research_on / _schedule / _since`
  and the `bot_research_runs` table (one row per attempt).
- Logic: `db/bot-research.js`. `dueRuns` is pure and unit-tested in `tests/bot-research.test.js`.
- Retries (`nextTryAt`): a quick check every 5 min for its first half hour, then every 15, until 3 hours
  after it was due (at least three tries; at most 20): recaps land 5-30 minutes after an episode ends,
  later when it runs long. A full run three times, 20 min apart. A quick run is stale after 12 h, a full one
  after 3 days. Runs timed before the switch-on are never picked up.
- The clock: the VM's `llm-browser-tick.timer` runs llm-browser-api's `deploy/tick.py` every minute, which
  POSTs `https://www.gameyourshow.com/api/cron/bot-research` (Bearer `CRON_SECRET`) **only when a run is
  due**: every answer carries `next` (`planRuns` / `nextRunAt`, the same rules as what's due), plus a
  check-in every 6 hours. When an admin saves anything that can bring a run earlier (schedule, air time,
  status, length), the app tells the bot's `POST /tick` straight away (`tellBotClock`, production only).
  Each call runs at most one due run. Vercel Hobby cron can't do minutes. Until 2026-10-24 the tick called
  every 2 minutes, which kept the database awake around the clock (docs/HOSTING.md).
- Admin episode page: the runs so far, the quick answer with sources, *Run quick now* / *Run full now*
  (`/api/admin/seasons/[id]/bot-research`).
- Paid Claude auto-research (`auto_research`, the GitHub Actions job) is separate and untouched.

Check: `node scripts/dev-test/check-bot-research.js up | run <out> 390 5 | down`. It copies a real season
into a `zt-bot-*` show and drives the schedule with a test clock against the real bot. Last run: quick
34s, full 111s (35 results), the 9 h re-run merged 15 more.

## In the new design (step 6c, on the `new-design` branch)

- **The bot's answers are sources** (`src/lib/server/bot-results.ts`, `runJob`'s injected `send`): a quick check that can
  be trusted and every full run go in as submissions (source `autopilot`), reaching every league on the season on their
  own; a quick check that can't be sure waits in every couch's Backstage (`quick_waits`) and counts as a failed try, so it's
  asked again. A full run's answer about another episode is a failed try. Without `send` (a dry run) it's as above.
- **One tap** ("Ask ChatGPT for me" for a couch, `src/lib/server/results-ways.ts`) is a run of its own (slot `tap`, with the
  couch and who asked), so the admin's runs list shows it too.
- A dev server can be pointed at a stand-in bot per request (`x-gys-bot`, `ask-bot.ts` `botFor`; `scripts/dev-test/fake-bot.js`).

## Next

- Per-show research checks as data (memory: research-checks-as-data) applies to the quick prompt too.
