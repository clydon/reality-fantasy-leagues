# Nano Banana in Codex and Claude Code

Verified 2026-11-10. The UI study uses Nano Banana at the user's request; it complements Impeccable, Intent and Perception-First Design.

## Working configuration

Use `npx -y @seungmanchoi/nano-banana-mcp@1.2.1` with `GEMINI_MODEL=gemini-3.1-flash-image` and a private `GEMINI_API_KEY`. The package release is pinned and the model was confirmed in Google's live model list for the configured key.

Codex uses `~/.codex/config.toml`. The machine's existing key was preserved; a private backup of the previous config sits beside it. Startup timeout is 90 seconds and tool timeout is 240 seconds. Claude Code uses the shared `.mcp.json`; this machine supplies its key through ignored `.claude/settings.local.json`. Claude's separate project-server approval does not control Codex's MCP connection.

## What failed and what was fixed

The original unscoped `nano-banana-mcp@1.0.3` connected successfully but hardcoded `gemini-2.5-flash-image-preview`. Google rejected generation with HTTP 404. The maintained implementation accepts a configurable model. Its own older default is also unsuitable, so the model environment override is required.

The replacement connected and exposed nine tools. The next generation attempt reached Google but returned HTTP 429, with a free-tier quota limit of zero. The user enabled billing on the key's Google project. A subsequent generation through the repaired **Codex configuration**, without a candidate-package or model override, succeeded. The diagnostic saved and visually inspected an actual 1024px test image. No Claude model or agent generated it.

## Verify and use

`node scripts/dev-test/check-nano-banana.js` checks MCP initialization, tool discovery and redacted configuration status. `--models` lists available image models. `--generate` makes one image-generation request and saves returned image bytes under ignored `captures/nano-banana-check/`. This check reads the private Codex settings, not Claude's credentials. Provider requests may incur normal API usage charges.

The final connection reported `generate_image`, `edit_image`, `continue_editing`, `get_status`, `list_history`, the configuration tools, and video tools. Only image generation was tested in this repair. No video request was made. Credentials and image base64 are withheld from diagnostic output. No key belongs in committed files.

The Codex CLI read-back confirmed the repaired server is enabled. This already-running agent's native tool list predates the configuration change. Reload the Codex client to discover its native Nano Banana tools; a local MCP client can use the working server from Codex in the meantime. Configuration alone is not evidence of successful generation—check the saved report and returned image.

Source: [server repository](https://github.com/seungmanchoi/nano-banana-mcp). The actual repair used npm registry metadata, the installed package source, a live provider model listing, MCP calls and a successful generation, rather than assuming the README's defaults work.
