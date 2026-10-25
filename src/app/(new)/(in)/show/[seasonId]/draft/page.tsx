import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/server/auth-helpers";
import { DraftScreen } from "@/new/show/draft";

export const metadata: Metadata = { title: "Draft room" };

export default async function DraftPage({ params }: PageProps<"/show/[seasonId]/draft">) {
  const { seasonId } = await params;
  if (!isUuid(seasonId)) notFound();
  return <DraftScreen seasonId={seasonId} kind="snake" />;
}
