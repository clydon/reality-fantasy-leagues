import { AddDropPicker } from "@/components/waivers/claim-pickers";
import { WaiversRoute } from "@/components/waivers/waivers-route";

// docs/PLAN-midseason-waivers.md. `?for=` is the commissioner claiming for someone.
export default async function Page({ searchParams }: PageProps<"/research/waivers/add-drop">) {
  const { for: forId } = await searchParams;
  return (
    <WaiversRoute sub="/add-drop">
      <AddDropPicker forId={typeof forId === "string" ? forId : null} />
    </WaiversRoute>
  );
}
