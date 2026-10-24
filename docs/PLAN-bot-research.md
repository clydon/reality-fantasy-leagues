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
when on, a list of runs counted from each episode's air time, every one editable (kind, minutes or
hours after airing, on/off, add, remove, reset):

| Run | Default | What it does |
|---|---|---|
| quick | 5 min | Who left the game and the episode's headline. Kept on the run row, shown on the admin episode page. "No source yet" counts as a failed try and is retried |
| full | 60 min | The whole checklist through the paste import: stored in `episode_research`, staged for review |
| full | 540 min | The checklist again, merged field by field into the first (`merge` + `fill`) |

- Tables: migration `0065_bot_research.sql` adds `show_seasons.bot_research_on / _schedule / _since`
  and the `bot_research_runs` table (one row per attempt).
- Logic: `db/bot-research.js`. `dueRuns` is pure and unit-tested in `tests/bot-research.test.js`.
- Retries: three tries per run, quick every 5 min, full every 20 min. A quick run is stale after 12 h,
  a full one after 3 days. Runs timed before the switch-on are never picked up.
- The clock: the VM's `llm-browser-tick.timer` POSTs `https://www.gameyourshow.com/api/cron/bot-research`
  (Bearer `CRON_SECRET`) every 2 minutes. Each call runs at most one due run. Vercel Hobby cron can't
  do minutes.
- Admin episode page: the runs so far, the quick answer with sources, *Run quick now* / *Run full now*
  (`/api/admin/seasons/[id]/bot-research`).
- Paid Claude auto-research (`auto_research`, the GitHub Actions job) is separate and untouched.

Check: `node scripts/dev-test/check-bot-research.js up | run <out> 390 5 | down`. It copies a real season
into a `zt-bot-*` show and drives the schedule with a test clock against the real bot. Last run: quick
34s, full 111s (35 results), the 9 h re-run merged 15 more.

## Next

- Show the quick check to players: the "who went home" stage in PLAN-couch-and-episode-night.md and
  PLAN-new-design.md (Backstage I). It's on `bot_research_runs.result` today, admin-only.
- Maybe stage a quick check's exits as pending season decisions, so an admin can accept who left early.
- Per-show research checks as data (memory: research-checks-as-data) applies to the quick prompt too.
