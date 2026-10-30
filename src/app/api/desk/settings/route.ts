import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { deskSettings, requireDesk, setDeskSetting, settingsLines } from "@/lib/server/desk";

// The desk's Settings (step 6b part 2): GET them (with their History); PUT `{ confirmAt?, newCouchesAnyone?, tiebreak?, signups? }`
// (the tie-break run's switch, 6c part 2; who gets in, 9 part 2), answering with the changes it made (`changeIds`, for
// the toast's Undo: docs/PLAN-desk-parity.md step 1).
export const GET = apiRoute(async (req) => {
  await requireDesk(req);
  return NextResponse.json({ settings: await deskSettings(), history: await settingsLines() });
});

export const PUT = apiRoute(async (req) => {
  const user = await requireDesk(req);
  const body = await req.json().catch(() => ({}));
  const { changeIds, ...settings } = await setDeskSetting(user, body);
  return NextResponse.json({ settings, history: await settingsLines(), changeIds });
});
