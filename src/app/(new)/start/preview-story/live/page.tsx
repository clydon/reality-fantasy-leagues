import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LiveStory, LiveStoryAsk } from "@/new/preview/live-story";

export const metadata: Metadata = { title: "See it play" };

// A game's preview made now, for whoever's signed in (docs/PLAN-preview-release.md, step 15): the wait while a made-up season is
// played, then its story on the preview service (src/new/preview/live-story.tsx). From the gallery's Try it (?from=gallery: the
// game in the tab's session storage, asked through /api/previews, which the desk's switch and the allowance guard). In development
// also ?game=fantasy|sheet|pool (the first slice's three) or any gallery game by its base's id, through the development route.
// Never on the preview service itself.
export default async function LivePreviewPage({ searchParams }: PageProps<"/start/preview-story/live">) {
  if (process.env.PREVIEW_SERVICE === "1") notFound();
  const { game, from } = await searchParams;
  if (from === "gallery") return <LiveStoryAsk />;
  if (process.env.NODE_ENV === "production") notFound();
  return <LiveStory game={typeof game === "string" && /^[a-z][a-z0-9]{1,30}$/.test(game) ? game : "pool"} />;
}
