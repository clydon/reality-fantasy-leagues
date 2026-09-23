import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { Fragment } from "react";

// Port of annotateMentions() (public/app.js): wraps any mention of a currently-owned castaway's
// name with a small colored initial badge, so the chat feed shows at a glance whose pick it is.
// React auto-escapes text content, so unlike the original this needs no esc() calls -- it just
// returns React nodes instead of an HTML string.
export function MentionText({ state, text }: { state: LeagueState; text: string }) {
  const owned = state.castaways.filter((c) => c.ownerIds.length > 0);
  if (owned.length === 0) return <>{text}</>;

  const names = [...owned].map((c) => c.name).sort((a, b) => b.length - a.length);
  const pattern = new RegExp("(" + names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "g");

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>);
    const c = owned.find((cc) => cc.name === match![0]);
    // Exclusive-ownership leagues have at most one owner per castaway.
    const owner = c?.ownerIds[0] ? StateLogic.getPlayer(state, c.ownerIds[0]) : null;
    parts.push(
      <Fragment key={key++}>
        {match[0]}
        {owner && (
          <span
            className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[0.55rem] font-bold text-white"
            style={{ background: owner.color }}
            title={owner.name}
          >
            {owner.name[0]}
          </span>
        )}
      </Fragment>
    );
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) parts.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
  return <>{parts}</>;
}
