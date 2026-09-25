import type { ModelUsage } from "@/lib/game/types";

// What the admin's AI calls cost, for the small price hints in Admin > Shows & Seasons. Anthropic's
// published per-million-token prices; web search is billed per search on top of tokens. Cache reads
// are 0.1x input and 5-minute cache writes 1.25x -- the prompt-caching discount the connectors ask
// for. Kept deliberately rough: these hints are there to make "this click costs money" visible, not
// to be an invoice.
export const AI_MODELS = [
  { id: "claude-haiku-4-5", label: "Haiku 4.5", input: 1, output: 5 },
  { id: "claude-sonnet-5", label: "Sonnet 5", input: 2, output: 10 },
  { id: "claude-opus-5", label: "Opus 5", input: 5, output: 25 },
] as const;

export type AiModelId = (typeof AI_MODELS)[number]["id"];

const PER_SEARCH = 10 / 1000;

/** Dollars for one call's usage, or null when the model isn't one we price (another provider). */
export function costOf(model: string | null | undefined, usage: ModelUsage | null | undefined): number | null {
  const m = AI_MODELS.find((x) => x.id === model);
  if (!m || !usage) return null;
  const perTok = (usd: number) => usd / 1_000_000;
  return (
    (usage.input_tokens || 0) * perTok(m.input) +
    (usage.cache_read_input_tokens || 0) * perTok(m.input) * 0.1 +
    (usage.cache_creation_input_tokens || 0) * perTok(m.input) * 1.25 +
    (usage.output_tokens || 0) * perTok(m.output) +
    (usage.web_search_requests || 0) * PER_SEARCH
  );
}

/** "<1¢", "4¢", "$0.27". */
export function formatCost(usd: number): string {
  if (usd < 0.01) return "<1¢";
  if (usd < 1) return `${Math.round(usd * 100)}¢`;
  return `$${usd.toFixed(2)}`;
}

// Typical token counts per action, measured roughly off real runs of a Survivor season. Research's
// input is mostly the pages its searches pull in, which is why it dwarfs the checklist itself.
const TYPICAL: Record<"cast" | "episodes" | "research", ModelUsage> = {
  cast: { input_tokens: 20_000, output_tokens: 3_000 },
  episodes: { input_tokens: 60_000, output_tokens: 12_000 },
  research: { input_tokens: 50_000, output_tokens: 6_000, web_search_requests: 5 },
};

/** "≈4¢" for what an action usually costs on this model. */
export function estimate(action: keyof typeof TYPICAL, model: string): string {
  const usd = costOf(model, TYPICAL[action]);
  return usd == null ? "" : `≈${formatCost(usd)}`;
}
