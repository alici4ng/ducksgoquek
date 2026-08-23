#!/usr/bin/env bash
# Download z19 Esri World Imagery tiles for the low-priority review batch.
set -u
cd "$(dirname "$0")"
mkdir -p tiles
i=0
total=$(grep -c 'https' tile_urls.txt)
while read -r x y url; do
  [ -z "${x:-}" ] && continue
  i=$((i+1))
  out="tiles/${x}_${y}.jpg"
  if [ -s "$out" ]; then
    echo "[$i/$total] exists $out"
    continue
  fi
  curl -fsS --retry 3 --retry-delay 2 -A "Mozilla/5.0 (review-tile-fetch)" "$url" -o "$out" \
    && echo "[$i/$total] ok  $out" || echo "[$i/$total] FAIL $url"
  sleep 0.4
done < tile_urls.txt
echo done; ls -la tiles | head -40
