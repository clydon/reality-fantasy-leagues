import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLeagueTab } from "@/new/routes";
import { LeagueTabScreen } from "@/new/screens/league-page";

export const metadata: Metadata = { title: "League" };

export default async function LeagueTabPage({ params }: PageProps<"/league/[sport]/[code]/[tab]">) {
  const { sport, code, tab } = await params;
  if (!isLeagueTab(tab)) notFound();
  return <LeagueTabScreen league={`${sport}/${code}`.toLowerCase()} tab={tab} />;
}
