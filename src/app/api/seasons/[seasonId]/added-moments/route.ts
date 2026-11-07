import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { addMoment } from "@/lib/server/added-moments";

// A season's own added moments (docs/PLAN-start-a-game-gpt.md step G1 part 4, added-moments.ts): POST `{ ask, moment? }` takes the
// moment our check offered in one of your own Start-a-game GPT asks (game-words: offers.moments, rated at the bar) and adds it to
// the season's rules as a question research answers after every episode, from the next to air. It answers with the moment and the
// ask's words, to ask again with it on the page. No screen reads it yet (the wizard is U0/U1's).
export const POST = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { ask?: unknown; moment?: unknown };
  return NextResponse.json(await addMoment(user, seasonId, body));
});
