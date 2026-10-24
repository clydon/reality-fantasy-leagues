# Hosting: what runs where, its limits, what uses them, and what more would cost

**Keep this current.** Update it in the same commit as any change that adds or changes polling, a scheduled
job, stored data, or a service, and whenever usage is checked (date the numbers). It exists so that, when a
free plan stops being enough, choosing the cheapest fit is arithmetic, not research. Last updated
**2026-10-24**.

## The stack

| Service | What it does for us | Plan | Cost now |
|---|---|---|---|
| **Vercel** (team `reality-fantasy-leagues`, project `tvleagues`) | The Next.js app, its API routes, `/mock` | Hobby | $0 |
| **Neon** (project `reality-fanatsy-leagues`, AWS us-east-2, Postgres 18) | Every table, auth included | Free | $0 |
| **Oracle Cloud** (`gys-bot`, VM.Standard.E2.1.Micro: x86, 1 GB) | The ChatGPT bot (`C:\Users\conor\llm-browser-api`) and the bot research clock | Always Free | $0 |
| **Cloudflare** tunnels | `bot.gameyourshow.com` (the VM), `bot-home.gameyourshow.com` (the PC fallback) | Free | $0 |
| **GitHub** (`clydon/reality-fantasy-leagues`, **public since 2026-10-24**) | The code; Actions runs the hourly job (`auto-research.yml`: auto-research, reminders, waivers) and the nightly wiki sync | Free; Actions minutes unlimited while public | $0 |
| healthchecks.io | Emails when the bot's daily self-test fails | Free | $0 |
| Resend | Sign-up and password emails | not checked | $0? |
| Anthropic API | Paid auto-research (Claude), only for seasons switched on | Pay per use | per episode researched |
| Domain `gameyourshow.com` | Bought 2026-10-12 | not recorded | yearly |

## Alerts (open problems)

- **Vercel Hobby: "Exceeded free resources"**, Functions Storage 14.52 GB of 10 GB (seen 2026-10-24). Cause not
  looked into; a likely suspect is every retained deployment keeping its function bundles (the embedding
  model under `.models/` is fetched at build). Check Vercel › Usage and deployment retention.
- **The bot's new clock isn't deployed yet** (2026-10-24): until llm-browser-api is redeployed to the VM, its
  old timer still calls every 2 minutes and keeps Neon awake. Deploy steps: llm-browser-api `deploy/README.md`
  (Living with it › Updating the bot); a bundle with Unix line endings is built at `llm-bot.tgz`.

## The repo is public

Public since 2026-10-24, so Actions minutes are free (a private account gets 2,000 a month; GitHub had stopped
the jobs on 2026-10-19 when they ran out). What that means:
- **Anything committed is readable by anyone, history included.** No secrets (they live in Vercel, Neon,
  GitHub secrets and `.env.local`), and **no real people's data**: no screenshots of real leagues or admin
  screens, no real usernames or emails in tests and docs (use the mock's demo names: alex, riley, jordan,
  sam). `.gitignore` covers `backups/` and the screenshot folders (`docs/ux-baseline/`, `docs/screenshots/`,
  `captures/`).
- Before going public the history was scanned and rewritten (git-filter-repo): the `docs/ux-baseline`
  screenshots (their admin screens showed real accounts' emails) removed from every commit, two real usernames
  and two partial emails replaced with demo ones, and commit emails moved to GitHub's private noreply address
  (this repo's `user.email` is set to it). The old history is kept, locally only, in
  `C:\Users\conor\rfl-history-before-scrub-2026-10-24.bundle`: it still holds that personal data, so it never
  goes anywhere public. GitHub can keep old commits reachable by their old hashes until it cleans up; nobody
  outside had them while the repo was private, and GitHub Support can purge them on request.
- **Going private again later** (a paid app): one switch (Settings › Danger zone, or `gh repo edit --visibility
  private`). Actions then counts minutes again: about 775 a month for these jobs (a run takes 35-50 s, billed as
  a minute; 24 a day plus the nightly sync), inside the free 2,000 unless other private repos share them.
  Anything public in the meantime may have been copied.

## Limits and usage

Snapshot **2026-10-24**. Neon's numbers are since its period start (Sep 30); Vercel's are its current cycle.

| Limit | Free allowance | Used | Notes |
|---|---|---|---|
| Neon query results sent ("network transfer") | 5 GB a month per project | **4.73 GB** | Running out suspends the database until the month resets. Was the chat polls (see Changelog) |
| Neon compute | 100 CU-hours a month per project | 35.38 CU-h | Running out suspends the database. Free computes sleep after 5 minutes idle and can't be kept awake |
| Neon storage | 1 GB per project (the billing page; one FAQ says 0.5) | 38.77 MB | Plus 254 kB of history |
| Neon history (point-in-time restore) | 6 hours | | So the JSON backups (`scripts/backup-leagues.js`) and named branches are the real safety nets |
| Neon branches | 10 per project | 2 | `production`, and `pre-new-design-2026-10-24` (made before migration 0066 shipped; never auto-deletes) |
| Vercel function invocations | 1M | 92K | |
| Vercel Fluid Active CPU | 4 h | 1 h 24 m | |
| Vercel CDN requests | 1M | 168K | |
| Vercel Functions Storage | 10 GB | **14.52 GB** | See Alerts |
| Vercel cron | once a day on Hobby | unused | Why the bot clock lives on the VM |
| Vercel Preview builds | | off | Ignored Build Step = "Only build production" since 2026-10-24: Preview shared production's database and every build runs migrations |
| GitHub Actions | unlimited while public (2,000 min a month if private) | ~775 min a month | See The repo is public |
| Oracle VM | 1 GB RAM, 1/8 OCPU burstable | | One question at a time: ~48 s with web search, ~114 s for a full research prompt |

## What uses each limit (for estimating)

**Neon compute** is about 0.25 CU × the hours in which any query ran in the previous 5 minutes (more when it
scales up under load). So what matters is how often something wakes it, not how much it does:

| Waker | Awake time | CU-hours a month |
|---|---|---|
| Hourly GitHub job (when it runs) | ~6 min an hour | ~18 |
| Bot research clock, after 2026-10-24 | each episode night's runs, plus a check-in every 6 h | ~3 per show airing |
| Bot research clock, before (a call every 2 min) | around the clock | ~180 (over the allowance) |
| People with the app open | while they're on it, plus 5 minutes | the rest: ~20 in Oct 1-24 (35.4 total, less ~11 for the hourly job until it stopped and ~3 for the clock's first night) |
| Admin bot-research runs panel | polls every 60 s while open | admin only |

**Neon transfer** is bytes queries send back. Polls dominate it. Per screen open on a league (estimates, not
measured; measure from Neon's usage a week after a change):

| Poll | Every | Read from Neon |
|---|---|---|
| League state (`/state`) | 15 s | ~2 KB (a hash check; the full 20-40 KB state only when it changed) |
| Unread chat (`/chat/unread`) | 15 s | under 1 KB (a count) |
| Your moves (`/api/me/actions`) | 30 s | ~1-2 KB (hashes; full states only when changed) |
| Open chat (`/chat?v=`) | 5 s | under 1 KB when nothing changed |
| **Per open screen** | | **~1 MB an hour** (it was ~70 MB an hour before 2026-10-24) |

**Vercel invocations** are one per poll: about 10 a minute per open screen (600 an hour); 18 a minute on the
chat page (its 5-second poll replaces the badge's).

**Rough scale, so the first wall is visible:** 100 couches of 4, each person with a screen open 3 hours a week,
is about 5,200 screen-hours a month: ~5 GB of Neon transfer (the free limit) and ~3M Vercel invocations (three
times Hobby's). Polling is the first thing growth hits; see Levers.

**Bot capacity:** each episode needs a quick check (usually 2-4 tries of ~48 s) and two full runs (~2 min each),
so about 5-8 minutes of bot time per show per episode, one at a time. Ten shows ending at the same hour would
push the last one's results about an hour back; a second bot (the PC fallback, or a second free VM) halves that.

## Levers, cheapest first

1. **Poll less** (free): one combined poll instead of three; stop polling when the window isn't focused (today
   only a hidden tab stops); slow down when nothing has changed for a while; push for the rare events.
2. **Free capacity elsewhere**: the bot clock already runs on the VM; the hourly job could too. Oracle's Always
   Free also offers Arm A1 machines (up to 4 OCPU / 24 GB) when the region has capacity: a bigger or second bot.
3. **Neon Launch** (prices from the Neon billing page, 2026-10-24): usage-based, $0.106 per CU-hour and $0.35 per
   GB-month, 500 GB of transfer per project, longer point-in-time restore, and compute can stay awake. At
   today's ~50 CU-hours that's about $5 a month; kept always awake at 0.25 CU, about $19.
4. **Vercel Pro**: per member per month with larger included usage (check current pricing and inclusions before
   deciding; not verified here).
5. **The bot tiers** (One tap $1 a season, Autopilot $5) are meant to pay for the research they trigger.

## How to check usage

- **Neon**: console › project › Overview (compute, storage, history, transfer since the period started);
  Monitoring › Query performance (top queries, but only since the compute last woke). A banner warns near a limit.
- **Vercel**: dashboard › Usage; Settings › Build and Deployment for the Ignored Build Step.
- **GitHub**: `gh run list --workflow=auto-research.yml --limit 5` (green hourly; `gh workflow list --all` shows if one
  was disabled); Settings › Billing and plans for minutes once private.
- **The bot clock**: on the VM, `journalctl -u llm-browser-tick -n 20` (one line per call; nothing between).

## Changelog

- **2026-10-24.** Neon transfer was at 95% with a week left: every chat fetch read each linked league's full
  state once per member (~240 KB for 12 KB of chat). Fixed in 31294fd: `src/lib/server/league-states.ts`
  (hash check, cached copies), `/chat/unread`, `/chat?v=`; checked by `scripts/dev-test/check-chat-polls.js`.
  Vercel set to build production only. The bot clock's 2-minute tick kept Neon awake around the clock (~180
  CU-hours a month); now the app tells the VM when the next run is due (`db/bot-research.js` `nextRunAt`,
  llm-browser-api `deploy/tick.py`, `POST /tick` for schedule changes), runs count from the episode's end
  (0066 `episode_minutes`), and the quick check retries for 3 hours; checked by `tests/bot-research.test.js`
  and `scripts/dev-test/check-bot-clock.js`. Found GitHub Actions stopped since 2026-10-19 (Alerts).
  Then: the repo went public (history scrubbed first: see The repo is public) so Actions minutes are free; the
  hourly workflow, found disabled by hand on 2026-10-22, was re-enabled and both workflows ran green. Neon
  branch `pre-new-design-2026-10-24` created before 0066 shipped.
