import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { deskSettings, requireDesk, settingsLines } from "@/lib/server/desk";
import { flagCheck, startFlagCheck, switchFlag } from "@/lib/server/desk-rulebooks-flag";

// Settings › Games on their rulebook › Every season at once (docs/PLAN-desk-parity.md part 7c): GET the latest check (its
// progress while it runs, then its tally); POST `{ check: true }` starts one (it runs after the answer, so the route keeps
// its budget for it), `{ on }` switches the flag for every season, answering with Settings and the change (for Undo).
export const maxDuration = 300;

export const GET = apiRoute(async (req) => {
  await requireDesk(req);
  return NextResponse.json({ check: await flagCheck() });
});

export const POST = apiRoute(async (req) => {
  const user = await requireDesk(req);
  const body = await req.json().catch(() => ({}));
  if (body.check === true) return NextResponse.json({ check: await startFlagCheck(user) });
  const { changeId, leagues } = await switchFlag(user, body.on);
  return NextResponse.json({ settings: await deskSettings(), history: await settingsLines(), changeIds: [changeId], leagues });
});
