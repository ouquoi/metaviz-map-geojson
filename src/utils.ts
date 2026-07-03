export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return [235, 237, 240];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

export function lerpColor(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  return `rgb(${Math.round(ra[0] + (rb[0] - ra[0]) * t)},${Math.round(ra[1] + (rb[1] - ra[1]) * t)},${Math.round(ra[2] + (rb[2] - ra[2]) * t)})`;
}

export function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toLocaleString();
}

export function isNumericCol(col: { base_type?: string }): boolean {
  return /Integer|Float|Decimal|BigInteger|Number/i.test(col.base_type ?? "");
}

export function isTextCol(col: { base_type?: string }): boolean {
  return /Text|Name|String|UUID/i.test(col.base_type ?? "");
}

export const TILE_SIZE = 256;

export function lonToTileX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * Math.pow(2, zoom);
}

export function latToTileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom);
}

export function tileXToLon(tileX: number, zoom: number): number {
  return (tileX / Math.pow(2, zoom)) * 360 - 180;
}

export function tileYToLat(tileY: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * tileY) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export type MapState = { zoom: number; lat: number; lon: number };

export function autoFit(
  points: { lat: number; lon: number }[],
  vpW: number,
  vpH: number,
): MapState {
  if (points.length === 0) return { zoom: 5, lat: 48, lon: 2 };

  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  if (minLat === maxLat) { minLat -= 0.5; maxLat += 0.5; }
  if (minLon === maxLon) { minLon -= 0.5; maxLon += 0.5; }

  const centerLat = (minLat + maxLat) / 2;
  const centerLon = (minLon + maxLon) / 2;

  for (let z = 14; z >= 0; z--) {
    const spanX = (lonToTileX(maxLon, z) - lonToTileX(minLon, z)) * TILE_SIZE;
    const spanY = (latToTileY(minLat, z) - latToTileY(maxLat, z)) * TILE_SIZE;
    if (spanX <= vpW * 0.75 && spanY <= vpH * 0.75) {
      return { zoom: z, lat: centerLat, lon: centerLon };
    }
  }
  return { zoom: 0, lat: centerLat, lon: centerLon };
}

export function buildTileList(state: MapState, vpW: number, vpH: number) {
  const { zoom, lat, lon } = state;
  const n = Math.pow(2, zoom);

  const centerPxX = lonToTileX(lon, zoom) * TILE_SIZE;
  const centerPxY = latToTileY(lat, zoom) * TILE_SIZE;
  const pxMin = centerPxX - vpW / 2;
  const pyMin = centerPxY - vpH / 2;

  const txMin = Math.max(0, Math.floor(pxMin / TILE_SIZE));
  const txMax = Math.min(n - 1, Math.floor((pxMin + vpW) / TILE_SIZE));
  const tyMin = Math.max(0, Math.floor(pyMin / TILE_SIZE));
  const tyMax = Math.min(n - 1, Math.floor((pyMin + vpH) / TILE_SIZE));

  const tiles: { tileX: number; tileY: number; x: number; y: number }[] = [];
  for (let ty = tyMin; ty <= tyMax; ty++) {
    for (let tx = txMin; tx <= txMax; tx++) {
      tiles.push({
        tileX: tx,
        tileY: ty,
        x: tx * TILE_SIZE - pxMin,
        y: ty * TILE_SIZE - pyMin,
      });
    }
  }
  return tiles;
}

export function projectPoint(lat: number, lon: number, state: MapState, vpW: number, vpH: number): [number, number] {
  const centerPxX = lonToTileX(state.lon, state.zoom) * TILE_SIZE;
  const centerPxY = latToTileY(state.lat, state.zoom) * TILE_SIZE;
  const px = lonToTileX(lon, state.zoom) * TILE_SIZE - (centerPxX - vpW / 2);
  const py = latToTileY(lat, state.zoom) * TILE_SIZE - (centerPxY - vpH / 2);
  return [px, py];
}
