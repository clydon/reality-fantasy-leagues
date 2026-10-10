import { SeasonRulesPage } from "@/components/admin/season-setup";

export default async function AdminSeasonRulesPage({ params }: PageProps<"/admin/seasons/[seasonId]/rules">) {
  const { seasonId } = await params;
  return <SeasonRulesPage seasonId={seasonId} />;
}
