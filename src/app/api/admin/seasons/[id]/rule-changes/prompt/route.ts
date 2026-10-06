import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { checkPrompt } from "@db/season-rule-changes.js";

// The "check for rule changes" prompt for a season: its rules as they stand (format plus approved
// changes), and what to report. Free -- the admin pastes it into their own web-searching chat.
export const GET = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  await requireSuperAdmin(req);
  if (!isUuid(id)) throw new HttpError(404, "Season not found");
  const prompt = await checkPrompt(pool, id);
  if (prompt === null) throw new HttpError(404, "Season not found");
  return NextResponse.json({ prompt });
});
