import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { startActing } from "@/lib/server/desk-person-actions";

// Act as them (docs/PLAN-desk-parity.md decision 1, part 1b): an hour as this person, through Better Auth's impersonation,
// its start a line in their History. `{ from: "test-couch" }` for Settings › Test couch's switches, whose return goes home.
// Answers `{ go, until }` with the session swapped in its cookies.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  const body = (await req.json().catch(() => null)) as { from?: unknown } | null;
  return startActing(req, user, (await params).id, body?.from === "test-couch" ? "test-couch" : undefined);
});
