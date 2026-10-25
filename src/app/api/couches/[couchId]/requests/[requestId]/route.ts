import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireAuth } from "@/lib/server/auth-helpers";
import { answerRequest } from "@/lib/server/couch-joins";

// A request to join a game (step 9), answered by whoever runs it: body { letIn }. Let in: they join on their own (and
// hear about it); declined: quietly.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ couchId: string; requestId: string }> }) => {
  const { couchId, requestId } = await params;
  const user = await requireAuth(req);
  const { letIn } = (await req.json().catch(() => ({}))) as { letIn?: boolean };
  return NextResponse.json(await answerRequest(user, couchId, requestId, letIn === true));
});
