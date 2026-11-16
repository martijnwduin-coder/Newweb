"use client";
import { AdvancedMarker, APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";
import { ClusterPin } from "./cluster-pin";
import { clusterPoints, mercator } from "./cluster";
import { config } from "@/lib/config";
import type { MapMarker } from "./types";
import { MarkerPin } from "./marker-pin";

// Advanced markers need a Map ID. Style the map (warm, desaturated) in Google Cloud
// Console and set NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID; "DEMO_MAP_ID" is Google's default.
function CameraController({ center, selected }: { center: { lat: number; lng: number }; selected?: MapMarker }) {
  const map = useMap();
  useEffect(() => {
    if (map) map.panTo(center);
  }, [map, center.lat, center.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (map && selected) map.panTo({ lat: selected.lat, lng: selected.lng });
  }, [map, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function BoundsReporter({ onIdle }: { onIdle?: (c: { lat: number; lng: number }) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !onIdle) return;
    const l = map.addListener("idle", () => {
      const c = map.getCenter();
      if (c) onIdle({ lat: c.lat(), lng: c.lng() });
    });
    return () => l.remove();
  }, [map, onIdle]);
  return null;
}

export function GoogleMapView({
  markers,
  center,
  selectedId,
  hoverId,
  onSelect,
  onCenterChange,
}: {
  markers: MapMarker[];
  center: { lat: number; lng: number };
  selectedId: string | null;
  hoverId: string | null;
  onSelect: (id: string | null) => void;
  onCenterChange?: (c: { lat: number; lng: number }) => void;
}) {
  return (
    <APIProvider apiKey={config.googleMapsBrowserKey}>
      <Map
        mapId={config.googleMapId || "DEMO_MAP_ID"}
        defaultCenter={center}
        defaultZoom={14}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        clickableIcons={false}
        onClick={() => onSelect(null)}
        className="h-full w-full"
      >
        <CameraController center={center} selected={markers.find((m) => m.id === selectedId)} />
        <BoundsReporter onIdle={onCenterChange} />
        <ClusteredMarkers markers={markers} selectedId={selectedId} hoverId={hoverId} onSelect={onSelect} />
      </Map>
    </APIProvider>
  );
}

function ClusteredMarkers({ markers, selectedId, hoverId, onSelect }: { markers: MapMarker[]; selectedId: string | null; hoverId: string | null; onSelect: (id: string | null) => void }) {
  const map = useMap();
  const [zoom, setZoom] = useState(14);
  useEffect(() => {
    if (!map) return;
    const l = map.addListener("zoom_changed", () => setZoom(map.getZoom() ?? 14));
    setZoom(map.getZoom() ?? 14);
    return () => l.remove();
  }, [map]);
  const groups = clusterPoints(markers, mercator(zoom), 46, (m) => m.id === selectedId);
  return (
    <>
      {groups.map((c) => {
        if (c.type === "cluster")
          return (
            <AdvancedMarker
              key={c.id}
              position={{ lat: c.lat, lng: c.lng }}
              zIndex={15}
              title={`${c.items.length} places`}
              onClick={() => {
                map?.panTo({ lat: c.lat, lng: c.lng });
                map?.setZoom(zoom + 2);
              }}
            >
              <ClusterPin count={c.items.length} friend={c.items.some((i) => i.friend)} />
            </AdvancedMarker>
          );
        const m = c.item;
        const active = m.id === selectedId || m.id === hoverId;
        return (
          <AdvancedMarker key={m.id} position={{ lat: m.lat, lng: m.lng }} onClick={() => onSelect(m.id)} zIndex={active ? 30 : m.friend ? 20 : 10} title={m.name}>
            <MarkerPin {...m} active={active} />
          </AdvancedMarker>
        );
      })}
    </>
  );
}
