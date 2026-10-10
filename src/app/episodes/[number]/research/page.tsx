import { EpisodeResultsPage } from "@/components/episodes/episode-results-page";

// A commissioner's results for one episode: check what research found, then apply it.
export default async function EpisodeResultsRoute({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return <EpisodeResultsPage number={parseInt(number, 10)} />;
}
