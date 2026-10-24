import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/server/auth-helpers";
import { ShowPageScreen } from "@/new/screens/show-pages";

export const metadata: Metadata = { title: "Waivers" };

export default async function WaiversPage({ params }: PageProps<"/show/[seasonId]/waivers">) {
  const { seasonId } = await params;
  if (!isUuid(seasonId)) notFound();
  return <ShowPageScreen seasonId={seasonId} page="waivers" />;
}
