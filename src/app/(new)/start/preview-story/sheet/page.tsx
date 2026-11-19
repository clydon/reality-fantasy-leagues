import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MOMENT_NAMES } from "@/new/preview/moments";
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
    items.push({ id, name: p.game.name, has, moments: p.moments.map((m) => m.kind), screens: p.moments.reduce((t, m) => t + m.screens.length, 0), bugs });
  }
  return <PreviewSheet items={items} />;
}
