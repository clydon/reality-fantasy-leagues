import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PreviewStory, type Preview } from "@/new/preview/story";

export const metadata: Metadata = { title: "See it play" };

// TEMP, development only (docs/PLAN-game-preview.md, "The bench's previews"): a game's preview as the bench made it
// (tools/gameplay-bench/preview/preview.cjs), read from the ignored .ui-atlas/previews/<id>/preview.json (it shows real castaways).
// ?preview=<id> picks one (the first there by default). Not linked from anywhere; the gallery's "See it play" comes with P1's build.
export default async function PreviewStoryPage({ searchParams }: PageProps<"/start/preview-story">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { preview } = await searchParams;
  const dir = path.join(process.cwd(), ".ui-atlas/previews");
  const id = typeof preview === "string" && /^[a-z0-9-]{1,64}$/.test(preview) ? preview : (await readdir(dir).catch(() => [] as string[]))[0];
  if (!id) notFound();
  const data = JSON.parse(await readFile(path.join(dir, id, "preview.json"), "utf8").catch(() => "null")) as Preview | null;
  if (!data) notFound();
  // Only what the cards read: each moment's own game and the game itself (the views of the other stages stay on disk).
  const slim: Preview = { ...data, moments: data.moments.map((m) => ({ ...m, views: Object.fromEntries(Object.entries(m.views).filter(([g]) => g === m.game || g === data.game.id)) })) };
  return <PreviewStory preview={slim} />;
}
