"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";

export type Pin = { lat: number; lng: number; label: string; me?: boolean };

const SIZE = "h-56 w-full rounded-xl lg:h-96";

// OpenStreetMap with a dot per pickup. Circle markers avoid Leaflet's image icons,
// which break when bundled. Load this with next/dynamic and ssr: false (Leaflet needs window).
export default function BatchMap({ pins }: { pins: Pin[] }) {
  // Next keeps a page alive in the background when you switch tabs. Leaflet can't re-attach
  // to its old map when the page comes back, so we drop the map while hidden and draw a new one.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(frame);
      setShown(false);
    };
  }, []);

  if (!shown) return <div className={`${SIZE} bg-slate-100`} />;
  const center = pins.find((p) => p.me) ?? pins[0];
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={11} scrollWheelZoom={false} className={`z-0 ${SIZE}`}>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
      {pins.map((p, i) => (
        <CircleMarker key={i} center={[p.lat, p.lng]} radius={p.me ? 9 : 7}
          pathOptions={{ color: "#fff", weight: 2, fillColor: p.me ? "#111827" : "#047857", fillOpacity: 1 }}>
          <Tooltip>{p.label}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
