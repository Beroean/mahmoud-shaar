/**
 * The mini map's projection: equirectangular, with longitudes scaled by cos(25°) so shapes look right
 * around the middle of the Arab world. Shared by the map generator (tools/arabiyyat/map.ts) and the
 * pins, so a book's coordinates land exactly on the drawn coastline.
 */
export const BOUNDS = { west: -18, east: 60, south: 8, north: 39 };
export const WIDTH = 600;
const K = Math.cos((25 * Math.PI) / 180);
const SCALE = WIDTH / ((BOUNDS.east - BOUNDS.west) * K);
export const HEIGHT = Math.round((BOUNDS.north - BOUNDS.south) * SCALE);

/** [x, y] in the map's viewBox for a latitude/longitude. */
export function project(lat: number, lon: number): [number, number] {
  return [(lon - BOUNDS.west) * K * SCALE, (BOUNDS.north - lat) * SCALE];
}
