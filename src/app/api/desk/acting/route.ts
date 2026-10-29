import { apiRoute } from "@/lib/server/api-route";
import { endActing } from "@/lib/server/desk-person-actions";

// Return to my account (the Viewing as bar, both designs; docs/PLAN-desk-parity.md part 1b): ends acting as someone,
// with its end in their History when the hour began on the desk. Answers `{ back }`: their desk page, or null (the front
// door). Signed in as them, not the desk's admin, so not requireDesk: Better Auth checks it's an hour as them.
export const DELETE = apiRoute(async (req) => endActing(req));
