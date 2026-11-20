import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LiveStoryShow } from "@/new/preview/live-story";

export const metadata: Metadata = { title: "See it play" };

// A made preview's story (docs/PLAN-game-preview.md, "On demand"), on the preview host, signed in there as the preview's own viewer
// (its enter route sends it here with its pass); each screen the real app on this same host, live. In development, and on the
// preview service (PREVIEW_SERVICE=1, a production build): never on the app's own production host.
export default async function LivePreviewStoryPage({ params }: PageProps<"/start/preview-story/live/[id]">) {
  if (process.env.NODE_ENV === "production" && process.env.PREVIEW_SERVICE !== "1") notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  return <LiveStoryShow id={id} />;
}
