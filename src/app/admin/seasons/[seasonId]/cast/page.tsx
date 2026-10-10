import { SeasonCast } from "@/components/admin/season-cast";

export default async function AdminSeasonCastPage({ params }: PageProps<"/admin/seasons/[seasonId]/cast">) {
  const { seasonId } = await params;
  return <SeasonCast seasonId={seasonId} />;
}
