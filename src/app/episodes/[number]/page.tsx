import { EpisodeDetail } from "@/components/episodes/episode-detail";

// One episode's own page (docs/PLAN-ux-redesign.md, 2e), so back works and the list stays short.
export default async function EpisodePage({ params }: PageProps<"/episodes/[number]">) {
  const { number } = await params;
  return <EpisodeDetail number={parseInt(number, 10)} />;
}
