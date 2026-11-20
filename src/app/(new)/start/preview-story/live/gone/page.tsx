import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LiveStoryGone } from "@/new/preview/live-story";

export const metadata: Metadata = { title: "See it play" };

// Where the enter route sends a way into a preview it won't open (used, ended, or never one: the same page, so a link can't be
// probed): docs/design-round/preview-flow-spec.md §5. In development, and on the preview service.
export default function LivePreviewGonePage() {
  if (process.env.NODE_ENV === "production" && process.env.PREVIEW_SERVICE !== "1") notFound();
  return <LiveStoryGone />;
}
