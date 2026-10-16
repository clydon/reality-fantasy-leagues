import { WaiversBoard } from "@/components/waivers/waivers-board";
import { WaiversRoute } from "@/components/waivers/waivers-route";

// The Waivers page's old home in Active Roster: kept so old links and pushes land on /waivers.
export default function Page() {
  return (
    <WaiversRoute>
      <WaiversBoard />
    </WaiversRoute>
  );
}
