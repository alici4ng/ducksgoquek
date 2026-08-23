/**
 * Applies the verified coverage decisions (data/output/pedestrian_ways.geojson,
 * produced by the Hermes review pipeline in scripts/*.py) onto the app's
 * walkable network (public/data/pedestrian_ways.geojson).
 *
 * For every way the pipeline verified, its verdict wins over the tag
 * heuristic. Verified ways missing from the base file are added.
 *
 * Usage:
 *   node scripts/fetch-pedestrian-ways.mjs     (refresh base from Overpass)
 *   node scripts/merge-verified-coverage.mjs   (then apply verified coverage)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = join(ROOT, 'public', 'data', 'pedestrian_ways.geojson')
const VERIFIED = join(ROOT, 'data', 'output', 'pedestrian_ways.geojson')

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

const base = JSON.parse(readFileSync(BASE, 'utf8'))
const verified = JSON.parse(readFileSync(VERIFIED, 'utf8'))

let overridden = 0
let added = 0
const seen = new Set()

for (const vf of verified.features) {
  const p = vf.properties
  const wayId = Number(p.osm_way_id)
  seen.add(wayId)
  const coverage = p.covered === 'yes' ? classify({ ...p.osm_tags, covered: 'yes' }) : 'openair'
  const name = p.osm_tags?.name || ''

  const existing = base.features.find((f) => f.properties.id === wayId)
  if (existing) {
    if (existing.properties.coverage !== coverage) overridden++
    existing.properties.coverage = coverage
    if (name) existing.properties.name = name
  } else {
    base.features.push({
      type: 'Feature',
      properties: { id: wayId, name, highway: p.osm_tags?.highway || 'footway', coverage },
      geometry: vf.geometry,
    })
    added++
  }
}

writeFileSync(BASE, JSON.stringify(base))

const counts = {}
for (const f of base.features) counts[f.properties.coverage] = (counts[f.properties.coverage] || 0) + 1
console.log(`verified ways: ${verified.features.length} (${overridden} reclassified, ${added} added, ${seen.size - overridden - added} already correct)`)
console.log('final coverage counts:', counts)
console.log(`-> ${BASE}`)
