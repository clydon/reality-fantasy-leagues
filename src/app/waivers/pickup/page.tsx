import { FirstReplacementPicker } from "@/components/waivers/claim-pickers";
import { WaiversRoute } from "@/components/waivers/waivers-route";

// Old links, pushes and the guided tour: the claim picker for the first castaway you can replace
// (docs/PLAN-waivers-v2.md). `?for=` is the commissioner claiming for someone.
export default async function Page({ searchParams }: PageProps<"/waivers/pickup">) {
  const { for: forId } = await searchParams;
  return (
    <WaiversRoute sub="/pickup">
      <FirstReplacementPicker forId={typeof forId === "string" ? forId : null} />
    </WaiversRoute>
  );
}
