import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SessionProvider } from "@/new/session";
import { CouchSheets } from "@/new/couch/couch-sheets";
import { WatchingSheets } from "@/new/watching/sheets";
import { paths, START_STEPS } from "@/new/routes";

// The new design's signed-in routes: the hub, show spaces, settings. No session: the new design's sign-in (step 9 part
// 2), which comes back to the hub. Not let in yet (early access): first run's last step, which says you're on the list.
// The endpoints these screens read check the session themselves; this is the door.
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(paths.signin());
  const user = session.user as typeof session.user & { username?: string | null; role?: string | null; approved?: boolean };
  if (user.approved === false && user.role !== "admin") redirect(paths.start(START_STEPS));
  const me = {
    id: user.id,
    name: user.username || user.name,
    isSuperAdmin: user.role === "admin",
    impersonating: !!(session.session as { impersonatedBy?: unknown }).impersonatedBy,
  };
  // The couch sheets (switch, details, invite, start, join, leave: step 9) and the watching ones (Add a show, where you are:
  // step 10) open from anywhere signed in.
  return (
    <SessionProvider me={me}>
      {children}
      <CouchSheets />
      <WatchingSheets />
    </SessionProvider>
  );
}
