import { EpisodePage } from "@/components/admin/episode-page";

// One episode's sources: the wiki, research, and the free paste path (the canvas's Admin-Episode).
export default async function AdminEpisodePage({ params }: PageProps<"/admin/seasons/[seasonId]/episodes/[number]">) {
  const { seasonId, number } = await params;
  return <EpisodePage seasonId={seasonId} episode={parseInt(number, 10)} />;
}
