"use client";
import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MapMarker } from "./types";
import { MarkerPin } from "./marker-pin";

/**
 * A stylised, dependency-free map used when no Google Maps key is configured.
 * Projects lat/lng into the viewport (equirectangular is fine at city scale) and
 * supports drag-to-pan and zoom.
 */
export function DemoMap({ markers, center, selectedId, hoverId, onSelect }: { markers: MapMarker[]; center: { lat: number; lng: number }; selectedId: string | null; hoverId: string | null; onSelect: (id: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit all markers when the city changes (or the viewport is resized).
  const [fit, setFit] = useState({ lat: center.lat, lng: center.lng, pxPerDeg: 10000 });
  const lngScale = Math.cos((center.lat * Math.PI) / 180);
  useEffect(() => {
    const mobile = size.w < 640;
    const pad = { top: mobile ? 170 : 70, bottom: mobile ? 90 : 70, x: mobile ? 40 : 80 };
    const pts = markers.length ? markers : [{ lat: center.lat, lng: center.lng }];
    const lats = pts.map((m) => m.lat);
    const lngs = pts.map((m) => m.lng);
    const latSpan = Math.max(0.004, Math.max(...lats) - Math.min(...lats));
    const lngSpan = Math.max(0.004, (Math.max(...lngs) - Math.min(...lngs)) * lngScale);
    const pxPerDeg = Math.min((size.w - pad.x * 2) / lngSpan, (size.h - pad.top - pad.bottom) / latSpan);
    setFit({ lat: (Math.max(...lats) + Math.min(...lats)) / 2, lng: (Math.max(...lngs) + Math.min(...lngs)) / 2, pxPerDeg });
    setView({ zoom: 1, x: 0, y: (pad.top - pad.bottom) / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, size.w, size.h]);

  const pxPerDeg = fit.pxPerDeg * view.zoom;
  const project = (lat: number, lng: number) => ({
    x: size.w / 2 + view.x + (lng - fit.lng) * lngScale * pxPerDeg,
    y: size.h / 2 + view.y - (lat - fit.lat) * pxPerDeg,
  });

  // Keep the selected marker in view.
  useEffect(() => {
    const m = markers.find((x) => x.id === selectedId);
    if (!m) return;
    const p = project(m.lat, m.lng);
    if (p.x < 60 || p.x > size.w - 60 || p.y < 80 || p.y > size.h - 220) {
      setView((v) => ({ ...v, x: v.x + (size.w / 2 - p.x), y: v.y + (size.h / 2.6 - p.y) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const zoomBy = (f: number) =>
    setView((v) => {
      const zoom = Math.max(0.4, Math.min(6, v.zoom * f));
      const k = zoom / v.zoom;
      return { zoom, x: v.x * k, y: v.y * k };
    });

  return (
    <div
      ref={ref}
      className="relative h-full w-full touch-none select-none overflow-hidden bg-[#E6E3DC]"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY, moved: false };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const dx = e.clientX - drag.current.x;
        const dy = e.clientY - drag.current.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
        drag.current.x = e.clientX;
        drag.current.y = e.clientY;
        setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      }}
      onPointerUp={(e) => {
        const wasClick = drag.current && !drag.current.moved;
        drag.current = null;
        if (wasClick && e.target === e.currentTarget) onSelect(null);
      }}
      onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12)}
    >
      {/* Decorative cartography */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <pattern id="streets" width={64 * view.zoom} height={64 * view.zoom} patternUnits="userSpaceOnUse" x={view.x % (64 * view.zoom)} y={view.y % (64 * view.zoom)}>
            <path d={`M0 ${32 * view.zoom}H${64 * view.zoom}M${32 * view.zoom} 0V${64 * view.zoom}`} stroke="#F2F0EB" strokeWidth={Math.max(2, 5 * view.zoom)} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#streets)" />
        <g transform={`translate(${size.w / 2 + view.x} ${size.h / 2 + view.y}) scale(${view.zoom})`}>
          <path d="M-900 120 C -500 40, -250 220, 0 140 S 500 -40, 900 60 L 900 200 C 500 120, 250 300, 0 260 S -500 160, -900 260 Z" fill="#CFD3D2" opacity="0.9" />
          <ellipse cx="-220" cy="-160" rx="130" ry="80" fill="#D8D9CF" />
          <ellipse cx="260" cy="-60" rx="90" ry="120" fill="#D8D9CF" />
          <path d="M-900 -260 L 900 -180" stroke="#F2F0EB" strokeWidth="14" />
          <path d="M-120 -600 L 80 600" stroke="#F2F0EB" strokeWidth="12" />
        </g>
      </svg>

      {markers.map((m) => {
        const p = project(m.lat, m.lng);
        if (p.x < -60 || p.y < -60 || p.x > size.w + 60 || p.y > size.h + 60) return null;
        const active = m.id === selectedId || m.id === hoverId;
        return (
          <button
            key={m.id}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: p.x, top: p.y, zIndex: active ? 30 : m.friend ? 20 : 10 }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onSelect(m.id)}
            aria-label={m.name}
          >
            <MarkerPin {...m} active={active} />
          </button>
        );
      })}

      <div className="absolute bottom-4 right-4 hidden flex-col overflow-hidden rounded-xl bg-white shadow-lift sm:flex">
        <button className="grid h-10 w-10 place-items-center hover:bg-paper-200" onClick={() => zoomBy(1.4)} aria-label="Zoom in">
          <Plus className="h-4 w-4" />
        </button>
        <button className="grid h-10 w-10 place-items-center border-t border-paper-200 hover:bg-paper-200" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out">
          <Minus className="h-4 w-4" />
        </button>
      </div>
      <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/80 px-3 py-1 text-[11px] text-muted backdrop-blur max-sm:hidden">
        Demo map — add a Google Maps key for live maps
      </p>
    </div>
  );
}
