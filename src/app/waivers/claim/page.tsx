import { SpotPicker } from "@/components/waivers/claim-pickers";
import { WaiversRoute } from "@/components/waivers/waivers-route";

// One spot's claim (docs/PLAN-waivers-v2.md "2A"): `?drop=` is who you'd replace or swap; `?for=` the
// commissioner claiming for someone.
export default async function Page({ searchParams }: PageProps<"/waivers/claim">) {
  const { for: forId, drop } = await searchParams;
  return (
    <WaiversRoute sub="/claim">
      <SpotPicker dropId={typeof drop === "string" ? drop : null} forId={typeof forId === "string" ? forId : null} />
    </WaiversRoute>
  );
}
