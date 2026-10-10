import { SeasonEpisodes } from "@/components/admin/season-episodes";

// A season's page opens on its episodes, the weekly job (docs/PLAN-ux-redesign.md 3b).
export default async function AdminSeasonPage({ params }: PageProps<"/admin/seasons/[seasonId]">) {
  const { seasonId } = await params;
  return <SeasonEpisodes seasonId={seasonId} />;
}
