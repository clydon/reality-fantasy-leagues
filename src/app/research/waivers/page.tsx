import { WaiversBoard } from "@/components/waivers/waivers-board";
import { WaiversRoute } from "@/components/waivers/waivers-route";

// The Waivers page (docs/PLAN-midseason-waivers.md). Active Roster keeps it under Research.
export default function Page() {
  return (
    <WaiversRoute>
      <WaiversBoard />
    </WaiversRoute>
  );
}
