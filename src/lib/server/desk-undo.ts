import type { RulebookBlocks } from "@/lib/game/formats/rulebook-schema";
import { getRulebook } from "@db/rulebooks.js";
import { isUuid, type SessionUser } from "./auth-helpers";
import { setWhoFills } from "./community-results";
import { pool, HttpError } from "./db";
import { restoreSetting } from "./desk";
import { restoreSeasonBot } from "./desk-bot";
import { restoreCastaway, restoreGroup, setCastawayLock } from "./desk-cast";
import { restoreFact } from "./desk-facts";
import { restorePerson } from "./desk-person-actions";
import { restoreReport } from "./desk-reports";
import { restoreSeat } from "./desk-seats";
import { restoreSeasonSchedule } from "./desk-schedule";
import { restoreSeasonSetup } from "./desk-setup";
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
    case "castaway":
      await restoreCastaway(user.id, String(u.id), u.field as "name" | "group" | "photo", (u.value as string | null) ?? null);
      break;
    case "castawayLock":
      await setCastawayLock(String(u.id), !!u.locked);
      break;
    case "group":
      await restoreGroup(String(u.seasonId), String(u.group), u.ids as string[]);
      break;
    case "couchFill": {
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
    case "showReviewed":
      await pool.query("UPDATE shows SET reviewed_at = NULL, reviewed_by = NULL, archived = $2, updated_at = now() WHERE id = $1", [String(u.id), !!u.archived]);
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
