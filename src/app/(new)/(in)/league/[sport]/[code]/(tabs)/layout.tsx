import { notFound } from "next/navigation";
import { LeagueFrame } from "@/new/screens/league-page";

// A league's tabs share one frame: the league's bar above, the tab bar below, both still while you move between tabs
// (src/new/screens/league-page.tsx; docs/PLAN-sports-couch.md B1). The league as its provider names it ("football/nfl").
export default async function LeagueTabsLayout({ params, children }: LayoutProps<"/league/[sport]/[code]">) {
  const { sport, code } = await params;
  const league = `${sport}/${code}`.toLowerCase();
  if (!/^[a-z0-9-]+\/[a-z0-9.-]+$/.test(league) || league.length > 80) notFound();
  return <LeagueFrame league={league}>{children}</LeagueFrame>;
}
