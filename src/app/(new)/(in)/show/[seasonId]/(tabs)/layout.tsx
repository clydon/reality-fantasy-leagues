import { notFound } from "next/navigation";
import { isUuid } from "@/lib/server/auth-helpers";
import { SpaceFrame } from "@/new/screens/show-space";

// A show space's tabs share one frame: the show bar above, the tab bar below, both still while you move between
// tabs (src/new/screens/show-space.tsx).
export default async function ShowTabsLayout({ params, children }: LayoutProps<"/show/[seasonId]">) {
  const { seasonId } = await params;
  if (!isUuid(seasonId)) notFound();
  return <SpaceFrame seasonId={seasonId}>{children}</SpaceFrame>;
}
