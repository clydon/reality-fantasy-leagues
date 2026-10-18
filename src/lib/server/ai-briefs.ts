import { createHash } from "crypto";
import { pool } from "./db";

// AI briefs (db/migrations/0064_ai_briefs.sql): a long prompt parked at /b/<code> so a chat link can
// carry one line pointing at it. The code is a hash of the prompt, so asking twice for the same prompt
// reuses one row (and pushes its expiry out) rather than piling up copies. Knowing a code tells you
// nothing you didn't already have: you'd need the prompt to work it out.

export const BRIEF_MAX_CHARS = 200_000;
const LIFETIME = "7 days";

export function briefCode(body: string): string {
  return createHash("sha256").update(body).digest("base64url").slice(0, 16);
}

export async function saveBrief(body: string, userId: string): Promise<string> {
  const code = briefCode(body);
  await pool.query(
    `INSERT INTO ai_briefs (code, body, created_by, expires_at) VALUES ($1, $2, $3, now() + $4::interval)
     ON CONFLICT (code) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
    [code, body, userId, LIFETIME]
  );
  // Housekeeping rides along with a save rather than needing a cron.
  pool.query("DELETE FROM ai_briefs WHERE expires_at < now()").catch(() => {});
  return code;
}

/** The brief's text, logging who asked; null when there's no such brief or it's expired. */
export async function readBrief(code: string, userAgent: string | null, via: "page" | "action"): Promise<string | null> {
  const { rows } = await pool.query("SELECT body FROM ai_briefs WHERE code=$1 AND expires_at > now()", [code]);
  if (!rows.length) return null;
  pool
    .query("INSERT INTO ai_brief_fetches (code, user_agent, via) VALUES ($1, $2, $3)", [code, userAgent?.slice(0, 500) ?? null, via])
    .catch(() => {});
  return rows[0].body;
}

export interface BriefFetch {
  reader: string;
  userAgent: string | null;
  via: "page" | "action";
  at: string;
}

export async function briefFetches(code: string): Promise<BriefFetch[]> {
  const { rows } = await pool.query(
    "SELECT user_agent, via, fetched_at FROM ai_brief_fetches WHERE code=$1 ORDER BY fetched_at DESC LIMIT 50",
    [code]
  );
  return rows.map((r) => ({ reader: readerOf(r.user_agent, r.via), userAgent: r.user_agent, via: r.via, at: r.fetched_at.toISOString() }));
}

// Which chat a fetch came from, by the user agents the vendors publish for their fetchers. Anything
// else that looks like a browser is a person opening the link themselves.
const READERS: [RegExp, string][] = [
  [/ChatGPT|OAI-SearchBot|GPTBot|OpenAI/i, "ChatGPT"],
  [/Claude|Anthropic/i, "Claude"],
  [/Perplexity/i, "Perplexity"],
  [/Google|Gemini/i, "Google"],
  [/Grok|xAI/i, "Grok"],
  [/bing|Copilot|Microsoft/i, "Copilot"],
];

export function readerOf(userAgent: string | null, via: "page" | "action"): string {
  if (via === "action") return "Custom GPT";
  if (!userAgent) return "Unknown";
  for (const [re, name] of READERS) if (re.test(userAgent)) return name;
  if (/Mozilla\//.test(userAgent)) return "A browser";
  return "Unknown";
}
