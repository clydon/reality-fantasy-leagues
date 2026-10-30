import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { answerQuestions, gameQuestions } from "@/lib/server/answers";

// A game's questions (step A4 of docs/PLAN-start-a-game-gpt.md; answers.ts), for one of your games on the season (`?league=`):
//   GET   ?episode=n (optional, a past one's for how it went; else this week's): the questions, yours, how many have answered;
//         once each locks, everyone's answers and how it stands as far as you've seen
//   POST  { episode?, answers: { [question]: answer | null } }: answer, change or take back yours before each locks
// 404 for a game you don't play, 409 for a question that's locked (or an episode that isn't this week's), 403 to name
// someone while you haven't seen the episode before it, 400 for an answer its question doesn't take.
type Params = { params: Promise<{ seasonId: string }> };

export const GET = apiRoute(async (req, { params }: Params) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const q = new URL(req.url).searchParams;
  return NextResponse.json(await gameQuestions(user, seasonId, q.get("league"), q.get("episode")));
});

export const POST = apiRoute(async (req, { params }: Params) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const body = (await req.json().catch(() => ({}))) as { episode?: unknown; answers?: unknown };
  return NextResponse.json(await answerQuestions(user, seasonId, new URL(req.url).searchParams.get("league"), body));
});
