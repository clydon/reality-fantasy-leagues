import type { RulebookBlocks } from "@/lib/game/formats/rulebook-schema";
import { getRulebook } from "@db/rulebooks.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import { setWhoFills } from "./community-results";
import { restoreBingoBank, restoreSquare } from "./desk-bingo";
import { pool, HttpError } from "./db";
import { restoreSetting } from "./desk";
import { restoreSeasonBot } from "./desk-bot";
import { restoreCastaway, restoreGroups, restoreHold, setCastawayLock } from "./desk-cast";
import { restoreCastSend } from "./desk-cast-page";
import { restoreCouchRestored } from "./desk-couches";
import { restoreCleared, restoreAnswer, writeTriviaOut } from "./desk-episode";
import { restoreFact, restoreFacts } from "./desk-facts";
import { restoreArchive, restoreRestored } from "./desk-games";
import { restorePerson } from "./desk-person-actions";
import { restoreReport } from "./desk-reports";
import { restoreSeat } from "./desk-seats";
import { restoreSeasonSchedule } from "./desk-schedule";
import { restoreSeasonSetup } from "./desk-setup";
import { restoreShowArchive, restoreShowSeason, restoreShowSites, restoreShowWords } from "./desk-shows";
import { restoreShowArt } from "./desk-show-art";
import { restoreReview, restoreTemplateRow } from "./desk-library";
import { restoreLive, undoRulebook, writePhase } from "./desk-rulebooks";

// History's Undo on the desk (docs/PLAN-new-design.md step 6b part 2): each admin_changes row carries how it's taken
// back; this does it and marks the row undone. A change made since can stand in the way (the rulebook moved on, the
// castaway was renamed again): then it says so and changes nothing.

export async function undoDesk(user: SessionUser, changeId: string): Promise<{ text: string }> {
  if (!isUuid(changeId)) throw new HttpError(404, "That change isn't here");
  const { rows } = await pool.query("SELECT id, text, undo, undone_at, entity, entity_id FROM admin_changes WHERE id = $1", [changeId]);
  const c = rows[0];
  if (!c) throw new HttpError(404, "That change isn't here");
  if (c.undone_at) throw new HttpError(409, "That's already been undone");
  const u = c.undo as Record<string, unknown> | null;
  if (!u) throw new HttpError(409, "That one can't be undone");
  switch (u.type) {
    case "fact":
      await restoreFact(c.entity_id, u.before as Parameters<typeof restoreFact>[1], user.id);
      break;
    case "facts":
      await restoreFacts(u.list as Parameters<typeof restoreFacts>[0], user.id);
      break;
    case "answer":
      await restoreAnswer(String(u.researchId), !!u.back, user.id);
      break;
    case "trivia":
      await writeTriviaOut(user.id, String(u.id), !!u.out);
      break;
    case "bingoBank":
      await restoreBingoBank(u);
      break;
    case "bingoSquare":
      await restoreSquare(u);
      break;
    case "cleared":
      await restoreCleared(u.snapshot as Parameters<typeof restoreCleared>[0], user.id);
      break;
    case "castaway":
      await restoreCastaway(user.id, String(u.id), u.field as "name" | "group" | "photo", (u.value as string | null) ?? null, u.answer as Parameters<typeof restoreCastaway>[4]);
      break;
    case "castawayLock":
      await setCastawayLock(String(u.id), !!u.locked);
      break;
    case "castSend":
      await restoreCastSend(u, c.id);
      break;
    case "group":
      await restoreGroups(String(u.seasonId), [{ group: String(u.group), ids: u.ids as string[] }]);
      break;
    case "groups":
      await restoreGroups(String(u.seasonId), u.groups as { group: string; ids: string[] }[]);
      break;
    case "castHold":
      await restoreHold(user.id, String(u.seasonId), (u.value as number | null) ?? null, u.to as number | null | undefined);
      break;
    case "couchFill": {
      const { rows: gone } = await pool.query("SELECT 1 FROM couches WHERE id = $1 AND deleted_at IS NOT NULL", [u.id]);
      if (gone.length) throw new HttpError(409, "It's deleted: restore it first");
      const { rows: leagues } = await pool.query("SELECT id FROM leagues WHERE couch_id = $1", [u.id]);
      await setWhoFills(user.id, String(u.id), leagues.map((l) => l.id), !!u.anyone);
      break;
    }
    case "setting":
      await restoreSetting(String(u.key), u.value, user.id);
      break;
    case "person":
      await restorePerson(c.entity_id, c.id, u);
      break;
    case "seat":
      await restoreSeat(user, c.id, u);
      break;
    case "seasonSetup":
      await restoreSeasonSetup(user, u);
      break;
    case "seasonSchedule":
      await restoreSeasonSchedule(user, u);
      break;
    case "report":
      await restoreReport(u);
      break;
    case "gameArchive":
      await restoreArchive(user, c.id, u);
      break;
    case "gameRestore":
      await restoreRestored(user, c.id, u);
      break;
    case "couchRestore":
      await restoreCouchRestored(user, c.id, u);
      break;
    case "rulebookBase":
    case "rulebookEdit":
      await undoRulebook(user.id, u as { type: string; id: string; blocks?: RulebookBlocks; editId?: string; from?: number });
      break;
    case "live":
      await restoreLive(user.id, String(u.id), !!u.live);
      break;
    case "templateRow":
      await restoreTemplateRow(u as Parameters<typeof restoreTemplateRow>[0]);
      break;
    case "review":
      await restoreReview(u as Parameters<typeof restoreReview>[0]);
      break;
    case "showArchive":
      await restoreShowArchive(u);
      break;
    case "showSeason":
      await restoreShowSeason(u);
      break;
    case "showWords":
      await restoreShowWords(user, u);
      break;
    case "showSites":
      await restoreShowSites(u);
      break;
    case "showArt":
      await restoreShowArt(u);
      break;
    case "showReviewed":
      await pool.query("UPDATE shows SET reviewed_at = NULL, reviewed_by = NULL, archived = COALESCE($2::boolean, archived), updated_at = now() WHERE id = $1", [
        String(u.id),
        typeof u.archived === "boolean" ? u.archived : null,
      ]);
      break;
    case "bot":
      await restoreSeasonBot(String(u.id), {
        on: !!u.on,
        schedule: u.schedule as Parameters<typeof restoreSeasonBot>[1]["schedule"],
        ...("episodeMinutes" in u ? { episodeMinutes: (u.episodeMinutes as number | null) ?? null } : {}),
      });
      break;
    case "phase": {
      const r = await getRulebook(pool, String(u.id));
      if (!r) throw new HttpError(404, "Rulebook not found");
      await writePhase(user.id, r, String(u.phaseId), (u.episode as number | null) ?? null);
      break;
    }
    default:
      throw new HttpError(409, "That one can't be undone here");
  }
  await pool.query("UPDATE admin_changes SET undone_at = now(), undone_by = $2 WHERE id = $1", [changeId, user.id]);
  return { text: c.text };
}
