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
No environment variables or build settings needed.

## Routing data (Bandar Sunway pedestrian network)

The app routes on real OSM pedestrian ways, served as a static file
(`public/data/pedestrian_ways.geojson`). To refresh it:

```powershell
node scripts/fetch-pedestrian-ways.mjs      # 1. pull ways from Overpass API
node scripts/merge-verified-coverage.mjs    # 2. apply verified coverage verdicts
```

Step 2 overlays the hand/agent-verified coverage decisions from the Hermes
pipeline (`scripts/01..08*.py`, output in `data/output/pedestrian_ways.geojson`)
onto the fetched ways — verified verdicts always win over tag heuristics.
