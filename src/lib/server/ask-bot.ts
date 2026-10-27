import { pool, HttpError } from "./db";
import { isSuperAdminUser, type SessionUser } from "./auth-helpers";

// The ask-AI bot: a separate service (C:\Users\conor\llm-browser-api, deployed per its deploy/README.md)
// that drives ChatGPT in a real browser. It pastes one of our prompts in, waits for the answer and hands
// it back, which is the copy, open, paste-back loop an admin does by hand, minus the hands. Free (no API
// key), but slow (30-60s for an episode with web search) and one at a time. Off unless
// LLM_BROWSER_API_URL and LLM_BROWSER_API_KEY are set.
//
// LLM_BROWSER_API_URL can list several bots, comma-separated, tried in order: the VM, then a fallback
// (your own PC through its own tunnel). Every bot shares the one key. When all are down, the button hides
// and copy/paste is what's left, which always works.

const URLS = (process.env.LLM_BROWSER_API_URL ?? "")
  .split(",")
  .map((u) => u.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const KEY = process.env.LLM_BROWSER_API_KEY;

export const askBotConfigured = URLS.length > 0 && !!KEY;

/** Which bot to ask: `bot` (a development server's stand-in, from botFor) instead of the configured list. */
export interface BotChoice {
  bot?: string;
  /** How long this ask may take, at most (default: the route's whole budget): two asks in one request share it. */
  budgetMs?: number;
}

const urlsFor = (o: BotChoice = {}) => (o.bot ? [o.bot] : URLS);
const configured = (o: BotChoice = {}) => !!o.bot || askBotConfigured;

/**
 * A development server's bot for one request, named by its `x-gys-bot` header: a check's own stand-in
 * (scripts/dev-test/fake-bot.js) or the PC's bot, so a check never queues behind production's runs on the VM.
 * `next dev` only, and only a loopback address; production never reads it.
 */
export function botFor(req: Request): string | undefined {
  if (process.env.NODE_ENV !== "development") return undefined;
  const asked = req.headers.get("x-gys-bot");
  if (!asked) return undefined;
  try {
    const u = new URL(asked);
    if (u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) return u.origin;
  } catch {
    /* not a URL: the configured bots, as for anyone */
  }
  return undefined;
}

/** Who gets "Ask ChatGPT for me" (experimental): super-admins, and anyone who commissions a league. */
export async function canUseAskBot(user: SessionUser): Promise<boolean> {
  if (isSuperAdminUser(user)) return true;
  const { rows } = await pool.query("SELECT 1 FROM league_memberships WHERE user_id=$1 AND role='commissioner' LIMIT 1", [user.id]);
  return rows.length > 0;
}

// Vercel stops the route at 300s (its maxDuration); this leaves room to say what went wrong.
const BUDGET_MS = 285_000;
// Cloudflare sits in front of the bot and blocks some default user agents (error 1010), so name ours.
const UA = { "User-Agent": "GameYourShow/1.0 (+https://gameyourshow.com)" };

async function health(url: string): Promise<{ busy: boolean } | null> {
  try {
    const res = await fetch(`${url}/health`, { headers: UA, signal: AbortSignal.timeout(2500), cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { busy?: string[] };
    return { busy: !!body.busy?.length };
  } catch {
    return null;
  }
}

/** Whether any bot answers right now (a quick health check), so the button only shows when it'll work. */
export async function askBotStatus(o: BotChoice = {}): Promise<{ available: boolean; busy: boolean }> {
  if (!configured(o)) return { available: false, busy: false };
  const all = await Promise.all(urlsFor(o).map(health));
  const up = all.filter((h) => h !== null);
  return { available: up.length > 0, busy: up.length > 0 && up.every((h) => h.busy) };
}

export async function askBot(prompt: string, o: BotChoice = {}): Promise<{ answer: string; seconds: number }> {
  if (!configured(o)) throw new HttpError(404, "The ask-AI bot isn't set up here.");
  const deadline = Date.now() + Math.min(BUDGET_MS, o.budgetMs ?? BUDGET_MS);
  const failures: string[] = [];
  for (const url of urlsFor(o)) {
    const left = deadline - Date.now();
    // A fallback that can't finish in time isn't worth starting.
    if (left < 60_000) break;
    if (!(await health(url))) {
      failures.push(`${new URL(url).host}: not answering`);
      continue;
    }
    try {
      const res = await fetch(`${url}/ask`, {
        method: "POST",
        headers: { ...UA, "Content-Type": "application/json", "X-API-Key": KEY! },
        // keepalive: the bot sends spaces while ChatGPT works, then the JSON (a failure as { detail }, still status 200), so
        // Cloudflare's tunnel doesn't cut off an answer that takes over 100 s (error 524): a full episode's research does.
        body: JSON.stringify({ provider: "chatgpt", prompt, search: true, max_wait: Math.floor((left - 15_000) / 1000), keepalive: true }),
        signal: AbortSignal.timeout(left),
        cache: "no-store",
      });
      const body = (await res.json().catch(() => ({}))) as { response?: string; seconds?: number; detail?: string };
      if (res.ok && body.response) return { answer: body.response, seconds: body.seconds ?? 0 };
      failures.push(`${new URL(url).host}: ${body.detail ?? `HTTP ${res.status}`}`);
    } catch (e) {
      failures.push(`${new URL(url).host}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }
  throw new HttpError(502, `ChatGPT didn't answer. ${failures.join(" · ")}`);
}

/**
 * Tells the bot's clock when bot research next has a run due (null: none left), so it calls
 * /api/cron/bot-research then instead of waiting for its next check-in (llm-browser-api's deploy/tick.py;
 * docs/HOSTING.md). For a change that can bring a run earlier: a schedule, an air time, a season switched
 * on. Every bot is told; one without a clock (the home PC) just answers 404. Best effort, never throws.
 * Production only: the clock calls production, and a dev machine (whose .env.local can point at the same
 * bot) telling it a time from its own database would make it miss real runs.
 */
export async function tellBotClock(next: Date | null): Promise<void> {
  if (!askBotConfigured || process.env.VERCEL_ENV !== "production") return;
  await Promise.all(
    URLS.map((url) =>
      fetch(`${url}/tick`, {
        method: "POST",
        headers: { ...UA, "Content-Type": "application/json", "X-API-Key": KEY! },
        body: JSON.stringify({ next: next ? next.toISOString() : null }),
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      }).catch(() => null)
    )
  );
}
