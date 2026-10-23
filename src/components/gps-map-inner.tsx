import { useEffect, useRef } from "react";
import L from "leaflet";

// Fix Leaflet default marker icon not showing with bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface GpsMapInnerProps {
  coords: [number, number];
}

export function GpsMapInner({ coords }: GpsMapInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: coords,
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      keyboard: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://osm.org/copyright">OSM</a>',
    }).addTo(map);

    L.marker(coords).addTo(map).bindPopup("Vị trí chấm công").openPopup();

    // Force recalculate after layout
    setTimeout(() => map.invalidateSize(), 200);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [coords]);

  return (
    <div
      ref={containerRef}
      style={{ height: "176px", width: "100%", position: "relative", zIndex: 0 }}
      className="rounded-xl border border-line"
    />
  );
}
