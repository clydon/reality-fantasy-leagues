import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/server/auth-helpers";
import { DraftScreen } from "@/new/show/draft";

export const metadata: Metadata = { title: "Blind draft" };

export default async function BlindPage({ params }: PageProps<"/show/[seasonId]/blind">) {
  const { seasonId } = await params;
  if (!isUuid(seasonId)) notFound();
  return <DraftScreen seasonId={seasonId} kind="blind" />;
}
