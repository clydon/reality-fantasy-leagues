import { readBrief } from "@/lib/server/ai-briefs";

// A brief as plain text, for a chat to read when the user's one-line message points it here. Public
// on purpose (a chat's fetcher has no session) but unlisted: a code is a hash of the prompt, and
// noindex keeps search engines from keeping a copy. Not disallowed in robots.ts, since some fetchers
// (Claude's among them) honour robots.txt even when a user asks them to open a link.
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const headers = { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" };
  const body = /^[A-Za-z0-9_-]{16}$/.test(code) ? await readBrief(code, req.headers.get("user-agent"), "page") : null;
  if (body === null) return new Response("This brief has expired. Go back to Game Your Show and ask again.\n", { status: 404, headers });
  return new Response(body, { headers });
}
