# Generated visual asset library

Generated study images are saved as versioned project assets so implementation reuses the approved pixels. Do not regenerate an image simply to transfer a study into the app. A deliberate visual change should produce a new version while retaining the previous one.

| Asset | Purpose | Stable application URL |
| --- | --- | --- |
| [Island night](../public/art/generated/island-night-v1.png) | Original atmospheric alternative around the show's real data | `/art/generated/island-night-v1.png` |
| [Football night](../public/art/generated/football-night-v1.png) | Generic NFL/football viewing atmosphere; no claim about a specific venue | `/art/generated/football-night-v1.png` |
| [Event night](../public/art/generated/event-night-v1.png) | Neutral fallback without a sport-specific field or equipment | `/art/generated/event-night-v1.png` |
| [TV companion](../public/art/generated/tv-companion-v1.png) | Original decorative illustration for a future TV Guide treatment; saved pending page review | `/art/generated/tv-companion-v1.png` |

All four are 1024 × 1024 PNGs, generated through Nano Banana MCP using `gemini-2.5-flash-image` on 2026-11-10. They remain candidates until the user selects a direction; saving them does not approve every proposed layout. The first three images were copied byte for byte from the successful study generation, without another provider call or image transformation. The TV companion was generated separately for a distinct decorative role and saved directly into this library; it does not replace functional vector icons.

The [manifest](../public/art/generated/manifest.json) records full prompts, model/server provenance, dimensions, SHA-256 hashes and file sizes. It contains no credentials or private user data. These files are eligible for normal version control; unlike the ignored `captures/` directory, they travel with the project when committed.

Real show key art, cast photos and team logos are distinct source assets. Keep their source and attribution records separate from generated atmosphere; do not regenerate identities or factual graphics. The review's public source URLs remain in its local `media-sources.json`.

## Start a game's pictograms (pending)

Round 2 of the Start-a-game redo (2026-11-18) needs one solid pictogram per base (56 on a show, five a sport's own). nano-banana
couldn't generate them that day (the MCP server's key didn't expand, and the Gemini account's billing was paused), so the gallery draws
vector stand-ins in `src/new/couch/gallery/icons.tsx`. The user is making the sheets from the brief in that session (seven 3×3 sheets,
black on white, an id per cell); once they arrive, each cell is sliced, turned into a mask, and saved as
`public/art/generated/gallery-icons/v1/<id>.png` with an entry in the manifest (the prompt, the source, size and SHA-256).
