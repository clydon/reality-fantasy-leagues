import { SeasonRulesPage } from "@/components/admin/season-setup";

// ?check=1 opens "Check for rule changes" straight away: research's rules tripwire links here.
export default async function AdminSeasonRulesPage({ params, searchParams }: PageProps<"/admin/seasons/[seasonId]/rules">) {
  const { seasonId } = await params;
  const { check } = await searchParams;
  return <SeasonRulesPage seasonId={seasonId} startCheck={check === "1"} />;
}
