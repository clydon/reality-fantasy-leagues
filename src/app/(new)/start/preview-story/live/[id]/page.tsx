import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LiveStoryShow } from "@/new/preview/live-story";

export const metadata: Metadata = { title: "See it play" };

// TEMP, development only (docs/PLAN-game-preview.md, "On demand"): a made preview's story, on the preview host, signed in there as the
// preview's own viewer (its enter route sends it here with its pass); each screen the real app on this same host, live.
export default async function LivePreviewStoryPage({ params }: PageProps<"/start/preview-story/live/[id]">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  return <LiveStoryShow id={id} />;
}
