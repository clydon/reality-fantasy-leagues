import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PreviewStory, type StoryData } from "@/new/preview/story";

export const metadata: Metadata = { title: "See it play" };

// TEMP, development only (docs/PLAN-game-preview.md, decision 3; docs/design-round/preview-story-spec.md): the game preview's
// visual story as a mock on the app's own parts, fed by the made-up seasons scripts/dev-test/preview-story-data.js writes into the
// ignored .ui-atlas (it names real castaways). Not linked from anywhere; the gallery's "See it play" comes with P1's build.
export default async function PreviewStoryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const file = path.join(process.cwd(), ".ui-atlas/preview-proof/story-data.json");
  const data = JSON.parse(await readFile(file, "utf8").catch(() => "null")) as StoryData | null;
  if (!data) notFound();
  return <PreviewStory data={data} />;
}
