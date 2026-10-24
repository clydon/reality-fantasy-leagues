import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isShowTab } from "@/new/routes";
import { TabScreen } from "@/new/screens/show-space";

export const metadata: Metadata = { title: "Show" };

export default async function ShowTabPage({ params }: PageProps<"/show/[seasonId]/[tab]">) {
  const { seasonId, tab } = await params;
  if (!isShowTab(tab)) notFound();
  return <TabScreen seasonId={seasonId} tab={tab} />;
}
