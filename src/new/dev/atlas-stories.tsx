"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tv, Users } from "lucide-react";
import { Btn, Chip, EmptyState, GuardChip, Row, SectionHead, Stepper } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { ShowBar } from "../ui/show-bar";
import { Face } from "../show/parts";

/** Explicit prop stories render production components. Add stories here; never duplicate their markup in the atlas. */
export function AtlasStories() {
  const q = useSearchParams(), story = q.get("story") || "buttons", state = q.get("state") || "default";
  const [count, setCount] = useState(state === "empty" ? 0 : 3), [on, setOn] = useState(state === "selected"), [open, setOpen] = useState(state === "open");
  return <main data-atlas-kit={story} className="min-h-dvh bg-background p-4 text-foreground">
    <h1 className="type-caption mb-5 text-[30px]">{story.replace(/-/g, " ")}</h1>
    {story === "buttons" && <div className="flex flex-wrap gap-3">{(["must", "optional", "ink"] as const).map(tone => <Btn key={tone} tone={tone} disabled={state === "disabled"} onClick={() => setCount(n => n + 1)}>{tone} · {count}</Btn>)}</div>}
    {story === "chips" && <div className="flex gap-2"><Chip on={on} onClick={() => setOn(!on)}>Selected: {on ? "yes" : "no"}</Chip><Chip disabled>Unavailable</Chip></div>}
    {story === "empty-state" && <EmptyState icon={Users} title={state === "error" ? "Couldn’t load your couch" : "Your couch is waiting"} line={state === "error" ? "Try again to load your people." : "Invite someone, or watch on your own."} action={<Btn wide onClick={() => setCount(n => n + 1)}>{state === "error" ? "Try again" : "Invite someone"} · {count}</Btn>} />}
    {story === "guard" && <GuardChip seenThrough={state === "off" ? null : count} onChange={() => setCount(n => n >= 13 ? 0 : n + 1)} />}
    {story === "stepper" && <Stepper label="Episode" value={count} max={13} onChange={setCount} />}
    {story === "rows" && <><SectionHead title="Your shows" aside="Current state" /><Row title="Survivor" detail="Watched through Episode 3" icon={Tv} dot={state === "due"} onClick={() => setCount(n => n + 1)} end={<span>{count}</span>} /></>}
    {story === "sheet" && <><Btn onClick={() => setOpen(true)}>Open sheet</Btn><Sheet open={open} onOpenChange={setOpen} title="Your episode" subtitle="The actual shared sheet component" foot={<Btn wide onClick={() => setOpen(false)}>Done</Btn>}><p className="p-4">Review focus, Escape, the footer and the return to the launcher.</p><div className="p-4"><Stepper label="Episode" value={count} max={13} onChange={setCount} /></div></Sheet></>}
    {story === "show-bar" && <ShowBar show={{seasonId:"atlas",name:"Survivor",seasonNumber:49,artUrl:"/mock/showcase/art/survivor.jpg"}} tall={state === "tall"} back={{label:"Home",onClick:()=>setCount(n=>n+1)}} status="Episode 4" below={<span>Friday Crew · {count} games</span>} />}
    {story === "face" && <div className="flex gap-4"><Face name="Alex" src={state === "missing" ? null : "/mock/showcase/img/survivor-51/alexis-levine.jpg"} out={state === "out"} className="h-32 w-28 rounded-[3px]" /><Face name="Riley" src={null} className="h-32 w-28 rounded-[3px]" /></div>}
  </main>;
}
