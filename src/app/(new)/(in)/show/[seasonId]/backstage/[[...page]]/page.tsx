import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/server/auth-helpers";
import { isBackstagePage } from "@/new/routes";
import { BackstageScreen } from "@/new/screens/show-pages";

// Games you run (settings Round 3a retired Backstage; its address stays, so old links land here).
export const metadata: Metadata = { title: "Games you run" };

// Backstage, and each of its pages one level deeper.
export default async function BackstageRoute({ params }: PageProps<"/show/[seasonId]/backstage/[[...page]]">) {
  const { seasonId, page } = await params;
  const sub = page?.[0];
  if (!isUuid(seasonId) || (page && (page.length > 1 || !isBackstagePage(sub!)))) notFound();
  return <BackstageScreen seasonId={seasonId} page={sub && isBackstagePage(sub) ? sub : undefined} />;
}
