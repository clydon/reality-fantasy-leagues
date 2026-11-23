/**
 * An episode's write-up as people read it (season_episodes.summary: episode-recaps.ts). The recap search sometimes ends one with
 * its citation in markdown, "[Source: Paramount+ recap](https://…)", which every place that shows a write-up (Tonight's Last
 * time, the reveal's "In this episode", Episodes) would print as-is. This drops a trailing source, keeps any other link's words
 * without its address, drops bare addresses, and tidies the spaces left behind. Applied where write-ups are saved and where
 * they're read, so rows saved before it read clean too (docs/design-round/tonight-writeup-spec.md).
 */
export function plainRecap(text: string): string {
  let t = text.replace(/\s+/g, " ").trim();
  // A trailing source and any links after it, in brackets or parentheses: "[Source: X](url)", "([Source](url))",
  // "[Sources: A](url) [B](url)", "Source: X (url)".
  const trailing =
    /\s*\(?\[(?:sources?|via|from)\b[^\]]*\]\([^)]*\)(?:[\s,;]*\[[^\]]*\]\([^)]*\))*\)?\.?\s*$|\s*\(?\b(?:sources?|via):\s*[^.()]*\(?https?:\/\/\S+\)?\)?\.?\s*$/i;
  for (let before = ""; before !== t; ) {
    before = t;
    t = t.replace(trailing, "").trim();
  }
  return t
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)\s]+\)/g, "$1")
    .replace(/\s*\(?https?:\/\/[^\s)]+\)?/g, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** A write-up kept within `max` characters by whole sentences (the last one that fits, when that keeps at least half), else by
 *  whole words with an ellipsis: never cut mid-word ("…sided agai"). */
export function capRecap(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max + 1);
  const end = Math.max(...[". ", "! ", "? ", ".” ", '." '].map((m) => head.lastIndexOf(m)));
  if (end >= max / 2) return head.slice(0, end + 1).replace(/\s+$/, "");
  const space = head.lastIndexOf(" ", max - 1);
  return `${head.slice(0, space > 0 ? space : max - 1).replace(/[\s.,;:!?–—-]+$/, "")}…`;
}

/** Whether a write-up names someone who left (by any part of their name, three letters or more, as a whole word; true when
 *  nobody left). Tonight shows a write-up under the Out plates only when it does, so another episode's write-up never sits under
 *  them (tonight-writeup-check.md). Not everyone: production's results put a finale's every finalist, and a Traitors murder told
 *  an episode later, in the episode's leavers, and no write-up names them all (4 of production's 25 would have been hidden). */
export function namesAnyone(text: string, names: string[]): boolean {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !names.length || names.some((name) =>
    name
      .split(/\s+/)
      .map((part) => part.replace(/[^\p{L}'-]/gu, "").replace(/^'+|'+$/g, ""))
      .filter((part) => part.length >= 3)
      .some((part) => new RegExp(`(^|[^\\p{L}])${esc(part)}([^\\p{L}]|$)`, "iu").test(text))
  );
}

/**
 * An episode headline's limit: 45 characters, the one number everything uses (the user, 2026-11-23: "a stated character limit so
 * we aren't struggling with formatting down the line"). The recap search is asked for it (episode-recaps.ts recapPrompt), so is
 * the one-time ask (scripts/headlines-once.js), readHeadlines and the one-time apply drop anything longer, and the database refuses
 * it (season_episodes.headline's check, migration 0456). Last time's caption caps (18 px) hold about 44 characters on the panel's
 * 330 px at a 390 px phone and about 35 on its 260 px at 320, so 45 is one line on an ordinary phone and never more than two (the
 * bolder round's check measured 60 wrapping to two lines at 390: tonight-writeup-bolder.md).
 */
export const HEADLINE_MAX = 45;

/** An episode's headline as people read it: the write-up's cleaning, no full stop at the end, and one line of at most
 *  HEADLINE_MAX characters. A longer one isn't cut (a cut headline reads broken): it's dropped, and the write-up shows without
 *  one. Null for anything that isn't a usable line. */
export function plainHeadline(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const t = plainRecap(text).replace(/[\s.]+$/, "").replace(/^["“]+|["”]+$/g, "").trim();
  return t.length >= 4 && t.length <= HEADLINE_MAX && !/[\n\r]/.test(t) ? t : null;
}

/** The vote counts in a text ("6–5", "13–7–1"), dashes made one kind, so a headline's can be found in its write-up. */
const countsIn = (s: string) => (s.match(/\d+(?:\s*[–-]\s*\d+)+/g) ?? []).map((c) => c.replace(/\s+/g, "").replace(/-/g, "–"));

/** Whether a headline may show over its write-up in Last time (the bolder round's check): it names someone who left, as the
 *  write-up must (namesAnyone), and every count it gives is in the write-up too. A headline that doesn't is left off and the
 *  write-up shows alone, so the loudest AI line on the page never contradicts the accepted results under it. */
export function headlineAgrees(headline: string, summary: string, out: string[]): boolean {
  const inSummary = new Set(countsIn(summary));
  return namesAnyone(headline, out) && countsIn(headline).every((c) => inSummary.has(c));
}

/** A count never breaks across lines at its dash ("8–3–" / "3–1"): a word joiner each side of the dash. */
export const keepCounts = (s: string) => s.replace(/(\d)\s*([–-])\s*(?=\d)/g, "$1⁠$2⁠");
