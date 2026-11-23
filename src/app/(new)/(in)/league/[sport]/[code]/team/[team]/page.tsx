import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TeamPageScreen } from "@/new/screens/team-page";

// A team's page (docs/PLAN-sports-couch.md B2; the design: docs/design-round/team-page-spec.md), a level under its league's tabs,
// with a bar of its own and no tab bar. The league as its provider names it ("football/nfl"), the team by its provider's id.
export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params, searchParams }: PageProps<"/league/[sport]/[code]/team/[team]">) {
  const { sport, code, team } = await params;
  const league = `${sport}/${code}`.toLowerCase();
  const id = decodeURIComponent(team);
  if (!/^[a-z0-9-]+\/[a-z0-9.-]+$/.test(league) || league.length > 80 || !/^[\w.-]{1,40}$/.test(id)) notFound();
  const against = (await searchParams).against;
  return <TeamPageScreen league={league} team={id} against={typeof against === "string" ? against : null} />;
}
