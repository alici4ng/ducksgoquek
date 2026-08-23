/**
 * One-off setup script: pull the walkable network for Bandar Sunway from the
 * OSM Overpass API and save it locally as public/data/pedestrian_ways.geojson.
 *
 * Fetched once at setup — the app never queries Overpass at runtime.
 *
 * Usage:
 *   node scripts/fetch-pedestrian-ways.mjs
 *   node scripts/fetch-pedestrian-ways.mjs --analyze   (tag report only)
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Covers the whole app area: Setia Jaya BRT (north) to USJ 7 (south).
const BBOX = [3.05, 101.588, 3.088, 101.616] // south, west, north, east

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'pedestrian_ways.geojson')

const QUERY = `
[out:json][timeout:120];
(
  way["highway"~"footway|path|pedestrian|steps|corridor|living_street|residential|service|tertiary|unclassified|cycleway|secondary|primary"](${BBOX});
  way["highway"]["sidewalk"~"both|left|right|yes"](${BBOX});
  way["covered"](${BBOX});
  way["indoor"="yes"]["highway"](${BBOX});
  way["tunnel"]["highway"](${BBOX});
  way["railway"="platform"](${BBOX});
  way["public_transport"="platform"](${BBOX});
);
out body; >; out skel qt;
`

// ------------------------------------------------------------------ classify

function classify(tags) {
  const covered = (tags.covered || '').toLowerCase()
  if (tags.tunnel === 'building_passage' || tags.tunnel === 'yes' || tags.location === 'underground')
    return 'underground'
  if (tags.indoor === 'yes' || tags.highway === 'corridor') return 'indoor'
  if (tags.bridge === 'yes' || tags.bridge === 'viaduct' || tags.location === 'overhead') return 'bridge'
  if (tags.railway === 'platform' || tags.public_transport === 'platform') return 'transit'
  if (covered === 'arcade' || covered === 'colonnade' || tags.colonnade === 'yes') return 'arcade'
  if (covered === 'yes' || covered === 'roof' || tags.shelter === 'yes') return 'bridge'
  return 'openair'
}

// ------------------------------------------------------------------ convert

function toGeojson(data) {
  // 6 decimal places ≈ 10 cm — plenty for pedestrian routing.
  const round = (n) => Math.round(n * 1e6) / 1e6
  const nodes = new Map()
  for (const el of data.elements) {
    if (el.type === 'node') nodes.set(el.id, [round(el.lon), round(el.lat)])
  }
  const features = []
  for (const el of data.elements) {
    if (el.type !== 'way' || !el.nodes) continue
    const coords = el.nodes.map((id) => nodes.get(id)).filter(Boolean)
    if (coords.length < 2) continue
    const tags = el.tags || {}
    features.push({
      type: 'Feature',
      properties: {
        id: el.id,
        name: tags.name || '',
        highway: tags.highway || '',
        coverage: classify(tags),
      },
      geometry: { type: 'LineString', coordinates: coords },
    })
  }
  return { type: 'FeatureCollection', features }
}

// ------------------------------------------------------------------ analyze

function analyze(fc) {
  const byCoverage = {}
  const named = []
  for (const f of fc.features) {
    const p = f.properties
    byCoverage[p.coverage] = (byCoverage[p.coverage] || 0) + 1
    if (p.coverage !== 'openair') named.push(`${p.coverage.padEnd(11)} ${p.name || '(unnamed)'} [${p.highway}]`)
  }
  console.log('\nCoverage tag counts:')
  for (const [k, v] of Object.entries(byCoverage).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${v}`)
  }
  console.log('\nCovered ways (the network the app cares about):')
  for (const line of named.slice(0, 60)) console.log(' ', line)
  if (named.length > 60) console.log(`  ... and ${named.length - 60} more`)
}

// ------------------------------------------------------------------ main

const analyzeOnly = process.argv.includes('--analyze')

if (analyzeOnly && existsSync(OUT)) {
  analyze(JSON.parse(readFileSync(OUT, 'utf8')))
  process.exit(0)
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

console.log(`Querying Overpass for walkable ways in ${BBOX} ...`)
let data = null
for (const endpoint of ENDPOINTS) {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'User-Agent': 'travelero-setup/1.0' },
      body: QUERY,
      signal: AbortSignal.timeout(150_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    data = await res.json()
    console.log(`  via ${new URL(endpoint).host}`)
    break
  } catch (err) {
    console.log(`  ${new URL(endpoint).host} failed (${err.message}), trying next...`)
  }
}
if (!data) throw new Error('All Overpass endpoints failed')

const fc = toGeojson(data)
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(fc))
console.log(`Saved ${fc.features.length} ways -> ${OUT}`)
analyze(fc)
