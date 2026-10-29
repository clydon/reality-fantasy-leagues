import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SessionProvider } from "@/new/session";
import { ReadOnlyLayer } from "@/new/read-only";
import { CouchSheets } from "@/new/couch/couch-sheets";
import { StartGameSheets } from "@/new/couch/start-game";
import { PlanSheets } from "@/new/couch/watch-plans";
import { BingoSheets } from "@/new/show/bingo";
import { CallSheets } from "@/new/show/calls";
import { PollSheets } from "@/new/show/polls";
import { RateSheets } from "@/new/show/rate";
import { TriviaSheets } from "@/new/show/trivia";
import { WatchingSheets } from "@/new/watching/sheets";
import { paths, START_STEPS } from "@/new/routes";
import { viewAsFor } from "@/lib/server/view-as";

// The new design's signed-in routes: the hub, show spaces, settings. No session: the new design's sign-in (step 9 part
// 2), which comes back to the hub. Not let in yet (early access): first run's last step, which says you're on the list.
// The endpoints these screens read check the session themselves; this is the door.
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(paths.signin());
  const user = session.user as typeof session.user & { username?: string | null; role?: string | null; approved?: boolean };
  if (user.approved === false && user.role !== "admin") redirect(paths.start(START_STEPS));
  // A site admin viewing as a player or a commissioner (view-as.ts) is drawn as one; the profile menu's Admin row goes back.
  const viewingAs = user.role === "admin" ? await viewAsFor(user.id) : null;
  const me = {
    id: user.id,
    name: user.username || user.name,
    isSuperAdmin: user.role === "admin" && !viewingAs,
    viewingAs,
    impersonating: !!(session.session as { impersonatedBy?: unknown }).impersonatedBy,
    impersonatingUntil: (session.session as { impersonatedBy?: unknown }).impersonatedBy ? new Date(session.session.expiresAt).toISOString() : null,
  };
  // The couch sheets (switch, details, invite, start, join, leave: step 9), the watching ones (Add a show, where you are:
  // step 10), Start a game (step 10 part 2b), planned nights (step 11 part 3), Rate it (step 12 part 1), Call it and the couch's
  // polls (part 2), bingo and trivia (part 3) open from anywhere signed in.
  // The Read-only plate over a game a site admin opened from the desk (part 6c of docs/PLAN-desk-parity.md), first.
  return (
    <SessionProvider me={me}>
      <ReadOnlyLayer />
      {children}
      <CouchSheets />
      <WatchingSheets />
      <StartGameSheets />
      <PlanSheets />
      <RateSheets />
      <CallSheets />
      <PollSheets />
      <BingoSheets />
      <TriviaSheets />
    </SessionProvider>
  );
}
