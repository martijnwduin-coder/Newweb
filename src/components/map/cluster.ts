/** Greedy screen-space clustering: pins closer than `radius` px merge into one cluster. */
export interface Point {
  id: string;
  lat: number;
  lng: number;
}

export type Clustered<T extends Point> =
  | { type: "single"; item: T }
  | { type: "cluster"; id: string; items: T[]; lat: number; lng: number };

export function clusterPoints<T extends Point>(
  items: T[],
  project: (lat: number, lng: number) => { x: number; y: number },
  radius = 44,
  keepSingle: (item: T) => boolean = () => false,
): Clustered<T>[] {
  const out: Clustered<T>[] = [];
  const groups: { x: number; y: number; items: T[] }[] = [];
  for (const item of items) {
    if (keepSingle(item)) {
      out.push({ type: "single", item });
      continue;
    }
    const p = project(item.lat, item.lng);
    const g = groups.find((gr) => Math.hypot(gr.x - p.x, gr.y - p.y) < radius);
    if (g) {
      g.items.push(item);
      // keep the group anchored at its centroid
      g.x += (p.x - g.x) / g.items.length;
      g.y += (p.y - g.y) / g.items.length;
    } else groups.push({ x: p.x, y: p.y, items: [item] });
  }
  for (const g of groups) {
    if (g.items.length === 1) out.push({ type: "single", item: g.items[0] });
    else
      out.push({
        type: "cluster",
        id: `cluster-${g.items.map((i) => i.id).sort().join("|")}`,
        items: g.items,
        lat: g.items.reduce((a, i) => a + i.lat, 0) / g.items.length,
        lng: g.items.reduce((a, i) => a + i.lng, 0) / g.items.length,
      });
  }
  return out;
}

/** Web-Mercator projection to world pixels at a Google Maps zoom level. */
export function mercator(zoom: number) {
  const scale = 256 * 2 ** zoom;
  return (lat: number, lng: number) => {
    const s = Math.sin((lat * Math.PI) / 180);
    return { x: ((lng + 180) / 360) * scale, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale };
  };
}
