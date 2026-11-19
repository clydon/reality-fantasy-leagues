import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { inPath, MOMENT_NAMES } from "@/new/preview/moments";
import type { Preview } from "@/new/preview/story";
import { PreviewSheet, type SheetItem } from "@/new/preview/sheet";

export const metadata: Metadata = { title: "Previews" };

// TEMP, development only (docs/PLAN-game-preview.md, "The bench's previews"): every preview the bench has made in the ignored
// .ui-atlas/previews, side by side at 390 (src/new/preview/sheet.tsx).
export default async function PreviewSheetPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const dir = path.join(process.cwd(), ".ui-atlas/previews");
  const ids = (await readdir(dir).catch(() => [] as string[])).filter((x) => /^[a-z0-9-]{1,64}$/.test(x)).sort();
  const items: SheetItem[] = [];
  for (const id of ids) {
    const p = JSON.parse(await readFile(path.join(dir, id, "preview.json"), "utf8").catch(() => "null")) as Preview | null;
    if (!p) continue;
    const week = p.moments.find((m) => m.kind === "week"), g = week?.views[week.game]?.game;
    const has = [
      p.moments.some((m) => m.kind === "draft") && "A draft",
      g?.lineup && "A lineup each episode",
      g?.pick && "A pick each episode",
      week && !g?.lineup && !g?.pick && "Questions each episode",
      p.game.stages.length > 0 && `${p.game.stages.length} stages`,
      p.moments.some((m) => m.kind === "out") && "Knockouts",
    ].filter((x): x is string => typeof x === "string");
    const bugs = p.moments.flatMap((m) => m.screens.flatMap((s) => s.bugs.map((b) => ({ moment: m.kind === "after" ? `After Episode ${m.episode}` : MOMENT_NAMES[m.kind], screen: s.name, text: b.text }))));
    // Whose view: the couch's owner runs the game (the bench's first person).
    const viewer = p.people.find((x) => x.id === p.viewer);
    const who = p.viewer === p.people[0]?.id ? "As whoever runs it" : `As ${viewer?.name ?? "a player"}, a player`;
    const paths = Object.fromEntries(p.moments.filter((m, i, all) => all.findIndex((x) => x.kind === m.kind) === i).map((m) => [m.kind, inPath(m.kind, m.screens).map((s) => s.name)]));
    items.push({ id, name: p.game.name, who, paths, has, moments: p.moments.map((m) => m.kind), screens: p.moments.reduce((t, m) => t + m.screens.length, 0), bugs });
  }
  return <PreviewSheet items={items} />;
}
