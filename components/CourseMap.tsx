"use client";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";

export type MapPoint = {
  id: string;
  rank: number;
  name: string;
  location: string;
  lat: number | null;
  lng: number | null;
};

type Props = {
  points: MapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number | string;
};

export default function CourseMap({ points, selectedId, onSelect, height = 520 }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // (Re)build markers whenever points change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !divRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(divRef.current, {
          worldCopyJump: true,
          scrollWheelZoom: true,
          zoomControl: false,
        });
        L.control.zoom({ position: "bottomright" }).addTo(mapRef.current);
        mapRef.current.attributionControl?.setPrefix(false);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap contributors",
        }).addTo(mapRef.current);
      }
      const map = mapRef.current;

      Object.values(markersRef.current).forEach((m) => m.remove());
      markersRef.current = {};

      const located = points.filter((p) => p.lat != null && p.lng != null);
      located.forEach((p) => {
        const icon = L.divIcon({
          className: "pin",
          html: `<span><i>${p.rank}</i></span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
          popupAnchor: [0, -26],
        });
        const m = L.marker([p.lat!, p.lng!], { icon, title: `#${p.rank} ${p.name}`, riseOnHover: true })
          .addTo(map)
          .bindPopup(
            `<div class="popup-rank">RANKED #${p.rank}</div>` +
              `<div class="popup-name">${escapeHtml(p.name)}</div>` +
              `<div class="popup-loc">${escapeHtml(p.location)}</div>`
          );
        m.on("click", () => onSelectRef.current?.(p.id));
        markersRef.current[p.id] = m;
      });

      if (located.length > 0) {
        map.fitBounds(
          L.latLngBounds(located.map((p) => [p.lat!, p.lng!] as [number, number])),
          { padding: [40, 40] }
        );
      } else {
        map.setView([30, -20], 2);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [points]);

  // Highlight + fly to selection.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    Object.entries(markersRef.current).forEach(([id, m]) => {
      const el = m.getElement();
      if (el) el.classList.toggle("hl", id === selectedId);
    });
    if (selectedId && markersRef.current[selectedId]) {
      const m = markersRef.current[selectedId];
      map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 11), { duration: 0.8 });
      m.openPopup();
    }
  }, [selectedId]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={divRef} style={{ height, width: "100%", borderRadius: 16, overflow: "hidden" }} />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}
