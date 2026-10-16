import { FreeAgencyPicker } from "@/components/waivers/claim-pickers";
import { WaiversRoute } from "@/components/waivers/waivers-route";

// docs/PLAN-midseason-waivers.md. `?for=` is the commissioner claiming for someone.
export default async function Page({ searchParams }: PageProps<"/waivers/free-agency">) {
  const { for: forId } = await searchParams;
  return (
    <WaiversRoute sub="/free-agency">
      <FreeAgencyPicker forId={typeof forId === "string" ? forId : null} />
    </WaiversRoute>
  );
}
