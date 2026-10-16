import { WaiversBoard } from "@/components/waivers/waivers-board";
import { WaiversRoute } from "@/components/waivers/waivers-route";

// The Waivers page (docs/PLAN-midseason-waivers.md).
export default function Page() {
  return (
    <WaiversRoute>
      <WaiversBoard />
    </WaiversRoute>
  );
}
