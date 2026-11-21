// The "skip the copy" links (memory: ask-ai-brief-links): a question too long for any chat's URL is parked at
// /b/<code> (api/briefs), and the link carries one line asking the chat to read it. ChatGPT follows it (tested in production,
// 2026-10-18; Grok did too, and went in settings Round 1, C8); anything else gets the question copied. Shared by classic's AskAi (components/ask-ai.tsx)
// and the new design's Ask an AI sheet (src/new/backstage/ask-ai.tsx).

const enc = encodeURIComponent;

/** The one line the chat gets: phrased as the user's own request, which is what lets a chat act on the page. */
export function briefLine(url: string, task?: string) {
  return (
    `I'm ${task ?? "setting something up"} in Game Your Show, a fantasy app for reality TV. ` +
    `The app's full instructions for this are at ${url} . Please open that page and follow it closely: ` +
    `it says what to search the web for, and exactly what format to reply in.`
  );
}

export type ChatApp = "chatgpt";

/** A chat opened with that line, for a brief parked at `url`. */
export function chatLink(app: ChatApp, url: string, task?: string): string {
  return `https://chatgpt.com/?hints=search&q=${enc(briefLine(url, task))}`;
}
