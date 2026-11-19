import { readFile } from "node:fs/promises";
import path from "node:path";

// TEMP, development only (docs/PLAN-game-preview.md, "The bench's previews"): the real screens a game's preview shows in its phones,
// shot by the bench's preview maker (tools/gameplay-bench/preview/preview.cjs) into the ignored .ui-atlas (they show real castaways):
// /start/preview-story/shot/<preview id>/<file>. Never served in production.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const parts = (await params).path;
  const ok = parts.length === 2 && /^[a-z0-9-]{1,64}$/.test(parts[0]) && /^[\w-]+\.jpg$/.test(parts[1]);
  if (!ok) return new Response(null, { status: 404 });
  const bytes = await readFile(path.join(process.cwd(), ".ui-atlas/previews", parts[0], "shots", parts[1])).catch(() => null);
  if (!bytes) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
}
