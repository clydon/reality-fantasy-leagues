import { WeekResults } from "@/components/waivers/week-results";
import { WaiversRoute } from "@/components/waivers/waivers-route";

// One past waiver week's results (docs/PLAN-midseason-waivers.md).
export default async function Page({ params }: PageProps<"/research/waivers/results/[episode]">) {
  const { episode } = await params;
  return (
    <WaiversRoute sub={`/results/${episode}`}>
      <WeekResults episode={parseInt(episode, 10)} />
    </WaiversRoute>
  );
}
