// Which AI our bot asks, per run (the bot's throughput, step 1, 2026-11-07). Pure, no imports: ask-bot.ts reads the settings
// and askBot sends the provider; tests/bot-runs.test.js checks it.
//
// The desk's AI (Settings › Which AI our bot asks, app_settings 'bot_ai') answers everything by default. A run kind can be
// sent to its own AI instead (app_settings 'bot_ai_runs', { kind: provider }), so bulk work (the trivia and bingo banks, say)
// can go to Codex, which answers several at once on the bot's computer (llm-browser-api's CODEX_PARALLEL), without a code
// change. Nothing is switched by default: every kind asks the desk's AI, ChatGPT unless the desk says otherwise.

/** The AIs the desk's own choice offers (ChatGPT signed in on the bot's computer, or Claude through the Claude Code CLI). */
export const BOT_PROVIDERS = ["chatgpt", "claude"] as const;
export type BotProvider = (typeof BOT_PROVIDERS)[number];

/** The AIs a run kind can be sent to: the desk's, and Codex (the Codex CLI on the bot's computer, on the ChatGPT plan; the
 *  bot's own fallback when ChatGPT signs it out). */
export const RUN_PROVIDERS = [...BOT_PROVIDERS, "codex"] as const;
export type RunProvider = (typeof RUN_PROVIDERS)[number];
export const BOT_PROVIDER_NAMES: Record<RunProvider, string> = { chatgpt: "ChatGPT", claude: "Claude", codex: "Codex" };

/** The bot's runs, by kind: db/bot-research.js's (quick, full, schedule, trivia, bingo, facts; an asked episode is a full),
 *  the tie-break, the card and call runs, and a rulebook's research (desk-rulebooks.ts: the desk's Run now and Getting it
 *  ready's What scores). */
export const BOT_RUN_KINDS = ["quick", "full", "schedule", "tiebreak", "rulebook", "trivia", "bingo", "facts", "card", "call"] as const;
export type BotRunKind = (typeof BOT_RUN_KINDS)[number];

const isProvider = (v: unknown): v is RunProvider => (RUN_PROVIDERS as readonly unknown[]).includes(v);

/** The desk's AI, from its setting (anything else: ChatGPT). */
export const deskProvider = (botAi: unknown): BotProvider => ((BOT_PROVIDERS as readonly unknown[]).includes(botAi) ? (botAi as BotProvider) : "chatgpt");

/** The kinds sent to an AI of their own, from the 'bot_ai_runs' setting: only known kinds and providers are kept. */
export function runProviders(runs: unknown): Partial<Record<BotRunKind, RunProvider>> {
  const out: Partial<Record<BotRunKind, RunProvider>> = {};
  if (!runs || typeof runs !== "object" || Array.isArray(runs)) return out;
  for (const kind of BOT_RUN_KINDS) {
    const p = (runs as Record<string, unknown>)[kind];
    if (isProvider(p)) out[kind] = p;
  }
  return out;
}

/** The AI a question asks: its run kind's own when the setting names one, else the desk's. */
export function providerFor(botAi: unknown, runs: unknown, kind?: string | null): RunProvider {
  const own = kind ? runProviders(runs)[kind as BotRunKind] : undefined;
  return own ?? deskProvider(botAi);
}

/** Each run kind as Settings history names it. */
export const BOT_RUN_NAMES: Record<BotRunKind, string> = {
  quick: "the quick check",
  full: "full research",
  schedule: "the schedule check",
  tiebreak: "the tie-break",
  rulebook: "rulebook research",
  trivia: "trivia",
  bingo: "bingo squares",
  facts: "the facts check",
  card: "the bot's card",
  call: "the bot's calls",
};

/**
 * A change to the kinds sent to an AI of their own (the desk's PUT `botAiRuns`): `{ kind: provider }` sends a kind there,
 * `{ kind: null }` gives it back to the desk's AI; kinds left out keep theirs. The setting after, and a line for Settings
 * history (null: nothing changed). Throws on a kind or AI it doesn't know.
 */
export function changeRunProviders(was: Partial<Record<BotRunKind, RunProvider>>, change: unknown): { runs: Partial<Record<BotRunKind, RunProvider>>; line: string | null } {
  if (!change || typeof change !== "object" || Array.isArray(change)) throw new Error("botAiRuns is { kind: AI, or null }");
  const runs = { ...was };
  const sent: Partial<Record<RunProvider, string[]>> = {};
  const back: string[] = [];
  for (const [kind, to] of Object.entries(change as Record<string, unknown>)) {
    if (!(BOT_RUN_KINDS as readonly string[]).includes(kind)) throw new Error(`No bot run is called ${kind} (${BOT_RUN_KINDS.join(", ")})`);
    const k = kind as BotRunKind;
    if (to === null) {
      if (runs[k]) back.push(BOT_RUN_NAMES[k]);
      delete runs[k];
    } else if (isProvider(to)) {
      if (runs[k] !== to) (sent[to] ??= []).push(BOT_RUN_NAMES[k]);
      runs[k] = to;
    } else throw new Error(`${kind} asks ${RUN_PROVIDERS.join(", ")} or null`);
  }
  const list = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]);
  const parts = [
    ...RUN_PROVIDERS.filter((p) => sent[p]?.length).map((p) => `${BOT_PROVIDER_NAMES[p]} answers ${list(sent[p]!)}`),
    ...(back.length ? [`${list(back)}: back to the AI our bot asks`] : []),
  ];
  const line = parts.map((p) => p[0].toUpperCase() + p.slice(1)).join(". ");
  return { runs, line: line || null };
}
