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
export async function askBotStatus(): Promise<{ available: boolean; busy: boolean }> {
  if (!askBotConfigured) return { available: false, busy: false };
  const all = await Promise.all(URLS.map(health));
  const up = all.filter((h) => h !== null);
  return { available: up.length > 0, busy: up.length > 0 && up.every((h) => h.busy) };
}

export async function askBot(prompt: string): Promise<{ answer: string; seconds: number }> {
  if (!askBotConfigured) throw new HttpError(404, "The ask-AI bot isn't set up here.");
  const deadline = Date.now() + BUDGET_MS;
  const failures: string[] = [];
  for (const url of URLS) {
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
        body: JSON.stringify({ provider: "chatgpt", prompt, search: true, max_wait: Math.floor((left - 15_000) / 1000) }),
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
