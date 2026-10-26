import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth, requireAuthSession } from "@/lib/server/auth-helpers";
import { HttpError } from "@/lib/server/http-error";
import { readProfile, rename, saveSettings } from "@/lib/server/profile";
import { withThemeCookie } from "@/lib/server/appearance";

// Your profile and account settings in the new design (docs/PLAN-new-design.md step 15 part 1; profile.ts): read when Settings,
// the profile sheet or an Ask an AI sheet first opens. Keeps this device's Appearance cookie in step (appearance.ts).
export const GET = apiRoute(async (req) => {
  const user = await requireAuth(req);
  const profile = await readProfile(user);
  return withThemeCookie(NextResponse.json(profile), profile.theme, req);
});

// Body: any of { name, colour, ai, hideScores, notify: { moment, on } | { chat }, sharing: { preset } | { where?, now?, ratings?,
// reactions? }, theme: night | studio | phone }; only what's sent changes (a theme is this device's cookie too). A new name is your
// username (checked as sign-up checks it), your seat's name in every league you play and the name on your messages. Answers the
// profile as it now is.
export const PUT = apiRoute(async (req) => {
  const session = await requireAuthSession(req);
  const body = (await req.json().catch(() => ({}))) as { name?: unknown; colour?: unknown; ai?: unknown; hideScores?: unknown; notify?: unknown; sharing?: unknown; theme?: unknown };
  const { name, ...rest } = body;
  if (name === undefined && !Object.keys(rest).length) throw new HttpError(400, "Nothing to change");
  if (name !== undefined) await rename(req, session, name);
  if (Object.keys(rest).length) await saveSettings(session, rest);
  const profile = await readProfile(session.user);
  return withThemeCookie(NextResponse.json(profile), profile.theme, req);
});
