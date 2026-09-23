<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

For project-specific architecture, current behavior, verification commands, and unresolved connectivity, read the handoff in the repository-root `AGENTS.md` before changing this web app. In particular: the original Next.js web/SQLite/TTS run locally for development; the selected free deployment splits static Cloudflare Pages frontend from the Render API-only backend; Pi 5 runs Ollama and ESP32 controls the LED.
