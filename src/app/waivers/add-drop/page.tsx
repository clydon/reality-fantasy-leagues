import { MidSeasonRedirect } from "@/components/waivers/waivers-route";

// Pre-v2's add/drop picker: a swap is now picked from the Waivers page's team (docs/PLAN-waivers-v2.md),
// so an old link lands there.
export default function Page() {
  return <MidSeasonRedirect />;
}
