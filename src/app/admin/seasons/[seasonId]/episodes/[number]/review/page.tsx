import { EpisodeReview } from "@/components/admin/episode-review";

// One episode's results, reviewed once for every league on the season (the canvas's Admin-Approve).
export default async function AdminEpisodeReviewPage({ params }: PageProps<"/admin/seasons/[seasonId]/episodes/[number]/review">) {
  const { seasonId, number } = await params;
  return <EpisodeReview seasonId={seasonId} episode={parseInt(number, 10)} />;
}
