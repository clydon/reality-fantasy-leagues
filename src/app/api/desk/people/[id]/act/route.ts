import { apiRoute } from "@/lib/server/api-route";
import { requireDesk } from "@/lib/server/desk";
import { startActing } from "@/lib/server/desk-person-actions";

// Act as them (docs/PLAN-desk-parity.md decision 1, part 1b): an hour as this person, through Better Auth's impersonation,
// its start a line in their History. Answers `{ go, until }` with the session swapped in its cookies.
export const POST = apiRoute(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireDesk(req);
  return startActing(req, user, (await params).id);
});
