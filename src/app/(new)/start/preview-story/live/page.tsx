import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LiveStory } from "@/new/preview/live-story";

export const metadata: Metadata = { title: "See it play" };

// TEMP, development only (docs/PLAN-game-preview.md, "On demand"): a game's preview made now, for whoever's signed in, with no
// screenshots: a made-up season played on the server, each moment's screens the real app, live (src/new/preview/live-story.tsx).
// ?game=fantasy|sheet|pool (the first slice's three). The gallery's preview button comes to it once the wizard lane wires it.
export default async function LivePreviewPage({ searchParams }: PageProps<"/start/preview-story/live">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { game } = await searchParams;
  return <LiveStory game={typeof game === "string" && /^(fantasy|sheet|pool)$/.test(game) ? game : "pool"} />;
}
