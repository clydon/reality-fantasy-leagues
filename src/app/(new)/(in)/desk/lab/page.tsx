import type { Metadata } from "next";
import { EngineLab } from "@/new/lab/lab";

export const metadata: Metadata = { title: "Engine lab" };

// The engine lab (docs/PLAN-start-a-game-gpt.md step A5): /desk/lab, site admins only, plain, in its own files (the desk's
// other screens are being redesigned). Its reads and writes are /api/desk/lab's, which refuse anyone else.
export default function EngineLabRoute() {
  return <EngineLab />;
}
