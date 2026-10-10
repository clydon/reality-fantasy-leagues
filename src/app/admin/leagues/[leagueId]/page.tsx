import { LeaguePage } from "@/components/admin/leagues-pages";

export default async function AdminLeaguePage({ params }: PageProps<"/admin/leagues/[leagueId]">) {
  const { leagueId } = await params;
  return <LeaguePage leagueId={leagueId} />;
}
