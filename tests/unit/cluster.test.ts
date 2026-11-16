import { describe, expect, it } from "vitest";
import { clusterPoints, mercator } from "@/components/map/cluster";

const pts = [
  { id: "a", lat: 52.37, lng: 4.89 },
  { id: "b", lat: 52.3701, lng: 4.8901 },
  { id: "c", lat: 52.4, lng: 4.95 },
];

describe("clusterPoints", () => {
  it("merges nearby points when zoomed out and splits them when zoomed in", () => {
    const out = clusterPoints(pts, mercator(12));
    expect(out.filter((c) => c.type === "cluster")).toHaveLength(1);
    expect(clusterPoints(pts, mercator(20)).every((c) => c.type === "single")).toBe(true);
  });

  it("never hides the selected point inside a cluster", () => {
    const out = clusterPoints(pts, mercator(12), 46, (p) => p.id === "a");
    expect(out.some((c) => c.type === "single" && c.item.id === "a")).toBe(true);
  });

  it("keeps every point exactly once", () => {
    const out = clusterPoints(pts, mercator(10));
    const ids = out.flatMap((c) => (c.type === "single" ? [c.item.id] : c.items.map((i) => i.id)));
    expect(ids.sort()).toEqual(["a", "b", "c"]);
  });
});
