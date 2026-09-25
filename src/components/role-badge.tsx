import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";

// Someone's secret role, shown next to their name (The Traitors: "Traitor"). Nothing for the default
// role (Faithful), and nothing at all for a show without roles. Reads the league's own state, which
// only holds a role once the league has reached the episode that revealed it -- so a league catching
// up never sees one early.
export function RoleBadge({ state, castawayId }: { state: LeagueState; castawayId: string }) {
  const format = StateLogic.formatOf(state);
  if (!format.roles) return null;
  const role = StateLogic.roleOf(state, castawayId);
  if (!role || role === format.roles.default) return null;
  return (
    <span className="ml-1 inline-block rounded bg-[#b0563f] px-1 py-px align-middle text-[0.6rem] font-bold leading-tight text-white">
      {role}
    </span>
  );
}
