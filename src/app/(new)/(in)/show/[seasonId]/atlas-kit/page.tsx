import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AtlasStories } from "@/new/dev/atlas-stories";

// Local development only; never an authenticated production feature.
export default async function AtlasKitPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const host = (await headers()).get("host") || "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) notFound();
  return <Suspense fallback={<p className="p-4">Loading component story…</p>}><AtlasStories /></Suspense>;
}
