import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { backstageScope } from "@/lib/server/backstage";
import { gameSettings, lockDownWrite, lockWrite, questionsWrite, settingsWrite } from "@/lib/server/backstage-games";

// Backstage › Game settings (docs/PLAN-new-design.md step 6a): each game's lineup size, who can join and its waivers' line,
// with what's recommended. PATCH `{ leagueId, set }` or `{ leagueId, reset: "lineup" | "team" | "joining" }` (a
// Commissioner's): one batch in Recent changes with Undo. `{ lockDown: true | false }` (step 15 part 4): Lock it down for every
// game you run here, one batch. `{ leagueId, lock: true | false }` (2026-10-27, whoever runs it): its current episode's lineups or
// picks locked or unlocked by hand, past its start too (backstage-games.ts lockWrite). `{ leagueId, questions: [ids] }` (step A4 part 2
// of docs/PLAN-start-a-game-gpt.md, a Commissioner's, until it starts): a Prediction Sheet's questions (questionsWrite).
export const GET = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  return NextResponse.json(await gameSettings(scope));
});

export const PATCH = apiRoute(async (req, { params }: { params: Promise<{ seasonId: string }> }) => {
  const { seasonId } = await params;
  const user = await requireAuth(req);
  const scope = await backstageScope(user, seasonId, new URL(req.url).searchParams.get("couch"));
  const body = (await req.json().catch(() => ({}))) as { leagueId?: unknown; set?: Record<string, unknown>; reset?: "lineup" | "team" | "joining"; text?: string; lockDown?: unknown; lock?: unknown; questions?: unknown };
  if ("lockDown" in body) return NextResponse.json(await lockDownWrite(scope, body.lockDown));
  if ("lock" in body) return NextResponse.json(await lockWrite(scope, body.leagueId, body.lock));
  if ("questions" in body) return NextResponse.json(await questionsWrite(scope, body.leagueId, body.questions));
  return NextResponse.json(await settingsWrite(scope, body.leagueId, body));
});
