import { NextResponse } from "next/server";
import { readBrief } from "@/lib/server/ai-briefs";

// The same brief as /b/<code>, as JSON for the Game Your Show custom GPT's action (openapi.json here).
// Public for the same reason: the GPT calls it without a session.
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = /^[A-Za-z0-9_-]{16}$/.test(code) ? await readBrief(code, req.headers.get("user-agent"), "action") : null;
  if (body === null) return NextResponse.json({ error: "This brief has expired. Ask the user to start again from Game Your Show." }, { status: 404 });
  return NextResponse.json({ instructions: body }, { headers: { "Cache-Control": "no-store" } });
}
