import { FreeAgencyPicker } from "@/components/waivers/claim-pickers";
import { WaiversRoute } from "@/components/waivers/waivers-route";

// docs/PLAN-waivers-v2.md. `?drop=` is who goes (Replace or Swap on the Waivers page); `?for=` the
// commissioner moving for someone.
export default async function Page({ searchParams }: PageProps<"/waivers/free-agency">) {
  const { for: forId, drop } = await searchParams;
  return (
    <WaiversRoute sub="/free-agency">
      <FreeAgencyPicker forId={typeof forId === "string" ? forId : null} dropId={typeof drop === "string" ? drop : null} />
    </WaiversRoute>
  );
}
