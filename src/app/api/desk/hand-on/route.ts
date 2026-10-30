import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { handOn, handOnFor } from "@/lib/server/desk-seats";

// Hand on (docs/PLAN-desk-parity.md step 1; the mock's dkHandOn): games whose only Commissioner is going, to whoever plays
// them. GET `?games=<league id>,<league id>&from=<user id>`: the games and who could run them, most active first.
// POST `{ from?, moves: [{ leagueId, to }] }`: each game to its new Commissioner (tier 1), answering
// `{ changeId, text, handed }`. From a person's seat or their Delete (part 1c); a couch nobody runs (step 2) and a game's
// page (step 6) pass no `from`.
export const GET = apiRoute(async (req) => {
  await requireDesk(req);
  const q = new URL(req.url).searchParams;
  return NextResponse.json(await handOnFor((q.get("games") ?? "").split(",").filter(Boolean), q.get("from") || null));
});

export const POST = apiRoute(async (req) => {
  const user = await requireDesk(req);
  const raw: unknown = await req.json().catch(() => null);
  return NextResponse.json(await handOn(user, (raw && typeof raw === "object" ? raw : {}) as { from?: unknown; moves?: unknown }));
});
