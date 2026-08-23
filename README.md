# ducksgoquek
submission for devin clawcollective qwen ai agent hackathon 2026

## Run locally (one command)

```powershell
.\dev.cmd
```

Bootstraps pnpm via corepack if missing, installs dependencies on first run,
then starts the Next.js dev server at http://localhost:3000.

Requires only Node.js 18+ (uses the pnpm-lock.yaml lockfile; do not use npm
install — it would create a conflicting package-lock.json).

## Deploy

Push to the repo and import into Vercel — it auto-detects Next.js + pnpm.
No environment variables or build settings needed for the current UI
(the map is a mocked SVG canvas, no Mapbox token required yet).
