import { readFile } from "node:fs/promises";
import path from "node:path";

// TEMP, development only (docs/PLAN-game-preview.md, decision 6): the real screens the game preview's story shows in its phone frames,
// shot by scripts/dev-test/preview-story-shots.js into the ignored .ui-atlas (they show real castaways). Never served in production.
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const { file } = await params;
  if (!/^[\w-]+\.jpg$/.test(file)) return new Response(null, { status: 404 });
  const bytes = await readFile(path.join(process.cwd(), ".ui-atlas/preview-proof/shots", file)).catch(() => null);
  if (!bytes) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
}
