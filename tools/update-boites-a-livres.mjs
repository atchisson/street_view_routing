// Downloads the "boîtes à livres sans photo" GPX dump from boites-a-livres.fr
// and converts it to GeoJSON for the map overlay.
// The upstream dump has no CORS headers, so the data must be bundled with the app.
//
// Usage: node tools/update-boites-a-livres.mjs
// Output: data/boites-a-livres-sans-photo.geojson
//
// Data © OpenStreetMap contributors (ODbL), via https://www.boites-a-livres.fr

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://www.boites-a-livres.fr/dumps/boites-sans-images.gpx';
const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'boites-a-livres-sans-photo.geojson');

const decodeEntities = s => s
  .replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>')
  .replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&#039;', "'");

// The upstream GPX declares UTF-8 but the text is double-encoded (e.g. "PlÃ©sidy").
// Decoding the code points back to bytes and re-reading them as UTF-8 fixes it;
// strings that are not mojibake are left untouched.
const fixEncoding = s => {
  try {
    const bytes = Uint8Array.from([...s].map(c => c.codePointAt(0)));
    if (bytes.some(b => b > 255)) return s; // genuine unicode, not mojibake
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return decoded;
  } catch {
    return s;
  }
};

const res = await fetch(SOURCE_URL);
if (!res.ok) {
  console.error(`Download failed: HTTP ${res.status}`);
  process.exit(1);
}
const gpx = await res.text();

const features = [];
const wptRe = /<wpt lat="([-\d.]+)" lon="([-\d.]+)">([\s\S]*?)<\/wpt>/g;
for (const [, lat, lon, body] of gpx.matchAll(wptRe)) {
  const name = body.match(/<name>([\s\S]*?)<\/name>/)?.[1] ?? '';
  const desc = body.match(/<desc>([\s\S]*?)<\/desc>/)?.[1] ?? '';
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [Number(lon), Number(lat)] },
    properties: {
      name: fixEncoding(decodeEntities(name)),
      address: fixEncoding(decodeEntities(desc))
    }
  });
}

if (features.length === 0) {
  console.error('No waypoints parsed — upstream format may have changed.');
  process.exit(1);
}

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`Wrote ${features.length} features to ${OUT_PATH}`);
