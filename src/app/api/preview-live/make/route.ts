import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { HttpError } from "@/lib/server/http-error";
import { makeFromDefinition, type MakeRequest } from "@/lib/server/preview-live";
import { signedBy } from "@/lib/server/preview-signature";

// The preview service makes a preview (docs/PLAN-preview-release.md, step 9): asked only by the app, signed (preview-signature.ts),
// with the definition it built from the real season and the person as an opaque key. The first moment's copy is written before it
// answers, the rest after, inside this route's time.
export const maxDuration = 120;

export const POST = apiRoute(async (req) => {
  const text = await req.text();
  if (!signedBy(req, text)) throw new HttpError(401, "Not the app's");
  const o = JSON.parse(text) as MakeRequest;
  if (typeof o.owner !== "string" || typeof o.key !== "string" || !o.definition || typeof o.definition !== "object") throw new HttpError(400, "Not a preview to make");
  return NextResponse.json(await makeFromDefinition({ owner: o.owner, key: o.key, definition: o.definition, rates: o.rates ?? {}, exits: o.exits ?? null, canMake: !!o.canMake }));
});
