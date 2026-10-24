import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SessionProvider } from "@/new/session";

// The new design's signed-in routes: the hub, show spaces, settings. No session: sign in (classic's screen, which
// comes back to "/", which sends the new design's people on to /home). Not yet approved (early access): classic's
// "/" shows the waiting screen. The endpoints these screens read check the session themselves; this is the door.
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  const user = session.user as typeof session.user & { username?: string | null; role?: string | null; approved?: boolean };
  if (user.approved === false) redirect("/");
  const me = {
    id: user.id,
    name: user.username || user.name,
    isSuperAdmin: user.role === "admin",
    impersonating: !!(session.session as { impersonatedBy?: unknown }).impersonatedBy,
  };
  return <SessionProvider me={me}>{children}</SessionProvider>;
}
