"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { watchApi, type GifHit } from "../data";
import { Sheet } from "./sheet";

// The GIF picker (docs/PLAN-new-design.md step 13 part 1; shared by Watch along and the couch chat since 2026-10-31): what's
// featured until you type, then a search, KLIPY's through /api/gifs (server/gifs.ts), "Powered by KLIPY" under it (their
// attribution). Only shown where GIFs are set up: the caller hides its GIF button otherwise.

export function GifSheet({ open, subtitle, onOpenChange, onPick }: { open: boolean; subtitle: string; onOpenChange: (o: boolean) => void; onPick: (g: GifHit) => void }) {
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [hits, setHits] = useState<GifHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const words = q.trim();
    const t = setTimeout(
      () => {
        setAsked(words);
        watchApi
          .gifs(words)
          .then((r) => {
            setHits(r.gifs);
            setError(null);
          })
          .catch((e) => setError((e as Error).message));
      },
      words ? 350 : 0
    );
    return () => clearTimeout(t);
  }, [open, q]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Send a GIF" subtitle={subtitle}>
      <label className="flex h-12 items-center gap-2 rounded-[3px] border border-input bg-background px-3">
        <Search className="size-4 text-muted-foreground" aria-hidden />
        <input data-gif-search value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GIFs" autoComplete="off" className="min-w-0 flex-1 bg-transparent text-base outline-0" />
      </label>
      {error ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{error}</p>
      ) : !hits ? (
        <div aria-busy className="mt-3 h-48 animate-pulse rounded-[3px] bg-secondary" />
      ) : !hits.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No GIFs for &ldquo;{asked}&rdquo;</p>
      ) : (
        <div data-gif-grid className="mt-3 grid grid-cols-3 gap-1.5">
          {hits.map((g) => (
            <button key={g.id} type="button" data-gif={g.id} onClick={() => onPick(g)} className="nd-press overflow-hidden rounded-[3px] bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element -- KLIPY's own picture */}
              <img src={g.preview} alt={g.title || "GIF"} className="aspect-[4/3] size-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <p className="mt-2.5 text-center text-[11px] font-semibold text-muted-foreground">Powered by KLIPY</p>
    </Sheet>
  );
}
