# The site admin's desk, Round 0: the grey boxes' brief (Impeccable `shape`)

> **Status (2026-11-22): Round 0, step 3 of the design process.** Impeccable's shape, on Intent's structure
> ([desk-r0-spec.md](desk-r0-spec.md)) and PFD's first views ([desk-r0-first-view.md](desk-r0-first-view.md)). The user confirms
> at the screenshot story, as DESIGN-PROCESS.md has it, not mid-round. Assumptions are marked.

1. **Job and audience.** An Operate surface for one person, the site's owner. Mostly at a desk, sometimes on the couch on an
   episode night. Most visits are a check-in ("anything waiting on me?"), then a lookup, then set-up a few times a season. Round 0's
   own job is narrower: let the owner pick a structure. So the frames compare three shapes on the same situations, with real words.
2. **Outcome and proof.** Frame by frame, the owner can see:
   - which shape answers the check-in at a glance;
   - which puts a split's decision nearest;
   - which uses a wide screen.

   The proof is the same data in every frame.
3. **Direction.**
   - **The visual authority is DESIGN.md's "Lower Third":** the night ground, bone text, dusk-muted values, hairline rows, Archivo's
     condensed heads. Chyron yellow appears only on the one real thing waiting (a split on Episode 9), as a chyron line, never a
     fill.
   - **The thesis:** a workspace that fills the screen with structure, a rail and list and detail (Shape 2). Set against today's tabs
     widened (Shape 1) and a desk that opens on the season on air (Shape 3).
   - **Implementation:** none. These are mock pages, rendered at 1280 and 390 for the story.
4. **Scope.** 12 frames, low fidelity: real labels and values, real hierarchy, simple glyphs, no final styling.
   - **Shape 1 (3):** To do at 1280 (episode night), To do at 390 (quiet week), Search's lists at 1280.
   - **Shape 2 (6):**
     - To do at 1280, episode night;
     - To do at 1280, quiet week;
     - To do at 390 with the Menu;
     - the split decided in place at 1280;
     - the Research bot page at 1280;
     - a season's set-up with its what's-left strip at 1280.
   - **Shape 3 (3):** home at 1280 (the season on air as a card), home at 390, Site at 1280.

   **Anti-goals:** a polished look that reads as approved; invented features beyond the spec; counts with no action; cheeky names.
5. **States and ranges.** The local data's own zt season, made-up and safe to show: **ZT Survivor 51**, Episodes 1–8 settled,
   Episode 9 last night. Every frame uses the same state:
   - *Assumed, to show a split:* Episode 9's "Jelly voted out" split between two answers;
   - two sign-ups waiting, one report;
   - the bot last ran 2 h ago;
   - Episode 10 on Wednesday at 8 PM.

   The quiet week has nothing waiting. The rail's lists show plausible zt counts (*assumed*).
6. **Interaction and layout.**
   - **To do:** urgency first, at most five rows, an evidence line under "Nothing needs you" (R4).
   - **The rail** is grouped in three by dividers (Now · Things · Site), and only To do has a count (PFD's advice).
   - **Search** sits above the content.
   - **A split:** both answers side by side on one scale, then Keep this · Use that · Correct it.
   - **A season:** its rail of pages, and the what's-left strip under its name.
   - **The Research bot:** status first; its Actions below the fold, behind holds.
   - **At 390:** To do is home; the rail is a Menu sheet; Search stays in the header.
7. **Constraints and open decisions.** The shell's 390 px cap (new.css:15) has to lift for the desk's routes (an implementation
   consequence for the build round). The choices the frames leave to the owner are the spec's ten (desk-r0-spec.md, "Your
   choices").
