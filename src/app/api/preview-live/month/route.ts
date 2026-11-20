import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/http-error";
import { previewMonth, serviceOnly } from "@/lib/server/preview-live";
import { signedBy } from "@/lib/server/preview-signature";

// This month's previews and what they've cost the service, against its budget (docs/PLAN-preview-release.md, step 18): the desk's
// line, asked by the app only (signed, as make is), so nobody needs Vercel's or Neon's dashboards to see it.
export const POST = apiRoute(async (req) => {
  serviceOnly();
  const text = await req.text();
  if (!signedBy(req, text)) throw new HttpError(401, "Not the app's");
  return NextResponse.json(await previewMonth());
});
