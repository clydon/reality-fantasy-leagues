import { PickupPicker } from "@/components/waivers/claim-pickers";
import { WaiversRoute } from "@/components/waivers/waivers-route";

// docs/PLAN-midseason-waivers.md. `?for=` is the commissioner claiming for someone.
export default async function Page({ searchParams }: PageProps<"/waivers/pickup">) {
  const { for: forId } = await searchParams;
  return (
    <WaiversRoute sub="/pickup">
      <PickupPicker forId={typeof forId === "string" ? forId : null} />
    </WaiversRoute>
  );
}
