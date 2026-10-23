// ================= the spoiler guard: the rules every surface showing show data follows =================
// Decided 2026-10-23 (the user: "we need a spoiler guard, for many things in the app"). Three rules:
//   1. Time: nothing past the episode you're on. Stats, recaps, verdicts, chat, reactions, standings, the explorer
//      all count only to seen(s). If we don't know where you are, that's Episode 0: nothing (fail closed).
//   2. Secrets: some facts are secret until the show reveals them (Traitors' factions: who's a Traitor). They appear
//      only once revealed on screen by your episode (here: when that person leaves), and never as a filter.
//   3. Live: during an episode, other people's reactions arrive 30s after the moment, never before (watch along).
// Every guarded surface says so with the same chip, which also lets you change where you are.
const GUARD={secretFaction:{trt:true}};
const seen=s=>Math.max(0,whereOf(s,'alex')||0);
const factionSecret=s=>!!GUARD.secretFaction[s.id];
// a castaway's faction as you're allowed to know it: current tribe, or a secret one only once they've left
const factionOf=(s,c)=>factionSecret(s)?(c.exitEp&&c.exitEp<=seen(s)?c.tribe:null):(c.tribeNow||c.tribe);
const guardChip=s=>`<button class="gd-chip" data-gdwhere="${s.id}">${svg('shield')}<span>Spoiler-safe · through Episode ${seen(s)}</span><b>Change</b></button>`;
function wireGuard(){app.querySelectorAll('[data-gdwhere]').forEach(b=>b.onclick=()=>{const s=SHOWS.find(x=>x.id===b.dataset.gdwhere);whereSheet({...s,aired:airedOf(s),onEp:Math.max(1,seen(s))})})}
