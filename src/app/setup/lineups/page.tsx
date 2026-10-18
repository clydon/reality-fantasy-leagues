import { redirect } from "next/navigation";

// Lineups moved into Teams & draft (docs/PLAN-settings-order.md); old links still land.
export default function SetupLineupsPage() {
  redirect("/setup/teams");
}
