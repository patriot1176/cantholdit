import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { useLocation as useWouterLocation } from "wouter";
import type { Stop } from "@workspace/api-client-react";

// Continental US bounds
const US_BOUNDS = L.latLngBounds(
  [24.396308, -125.001651],
  [49.384358, -66.93457]
);

const US_CENTER: [number, number] = [39.5, -98.35];
const US_ZOOM = 4;

function getStopEmoji(type: string, name?: string): string {
  if (name && /buc-ee|bucee/i.test(name)) return "🦫";
  switch (type) {
    case "rest_area":   return "🛣️";
    case "gas_station": return "⛽";
    case "truck_stop":  return "🚛";
    case "fast_food":   return "🍔";
    case "walmart":     return "🛒";
    default:            return "🚽";
  }
}

const createMarkerIcon = (rating: number | null, type: string, name?: string) => {
  let color = "#94a3b8";
  let shadowColor = "rgba(148,163,184,0.4)";

  if (rating !== null) {
    if (rating >= 4.0) {
      color = "#22c55e";
      shadowColor = "rgba(34,197,94,0.4)";
    } else if (rating >= 3.0) {
      color = "#f59e0b";
      shadowColor = "rgba(245,158,11,0.4)";
    } else {
      color = "#ef4444";
      shadowColor = "rgba(239,68,68,0.4)";
    }
  }

  const emoji = getStopEmoji(type, name);

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background-color: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 4px 12px -2px ${shadowColor};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        cursor: pointer;
      ">
        ${emoji}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

// Cluster layer using leaflet.markercluster directly (react-leaflet isn't needed)
function ClusterLayer({ stops, onNavigate }: { stops: Stop[]; onNavigate: (id: number) => void }) {
  const map = useMap();
  const navigateRef = useRef(onNavigate);
  useEffect(() => { navigateRef.current = onNavigate; }, [onNavigate]);

  useEffect(() => {
    const group = (L as any).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="background:#3b82f6;color:white;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;border:3px solid white;box-shadow:0 2px 12px rgba(59,130,246,0.45)">${count}</div>`,
          iconSize: [40, 40] as [number, number],
          iconAnchor: [20, 20] as [number, number],
          className: "",
        });
      },
    });

    stops.forEach((stop) => {
      const stopEmoji = getStopEmoji(stop.type, stop.name);
      const marker = L.marker([stop.lat, stop.lng], {
        icon: createMarkerIcon(stop.overallRating, stop.type, stop.name),
      });

      const el = L.DomUtil.create("div");
      el.style.cssText = "padding:4px;min-width:190px;font-family:system-ui,sans-serif";
      el.innerHTML = `
        <div style="font-weight:700;font-size:15px;line-height:1.2;margin-bottom:2px">${stop.name}</div>
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">${stop.type.replace("_", " ")}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
          <span style="font-size:18px">${stopEmoji}</span>
          <span style="font-weight:700;font-size:16px">${stop.overallRating ? stop.overallRating.toFixed(1) : "—"}</span>
          <span style="font-size:12px;color:#64748b">(${stop.totalRatings} ratings)</span>
        </div>
        <button style="background:#3b82f6;color:white;border:none;padding:10px;border-radius:10px;font-weight:700;width:100%;cursor:pointer;font-size:13px">View Details →</button>
      `;
      el.querySelector("button")?.addEventListener("click", () => {
        navigateRef.current(stop.id);
        map.closePopup();
      });

      marker.bindPopup(el, { maxWidth: 240 });
      group.addLayer(marker);
    });

    map.addLayer(group);
    return () => {
      group.clearLayers();
      map.removeLayer(group);
    };
  }, [map, stops]);

  return null;
}

const mapBtnClass =
  "bg-white w-12 h-12 rounded-full shadow-lg shadow-black/10 border border-border flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all";

export function MapView({
  stops,
  userLocation,
  searchCenter,
  routePolyline,
}: {
  stops: Stop[];
  userLocation: { lat: number; lng: number } | null;
  searchCenter: { lat: number; lng: number } | null;
  routePolyline?: [number, number][] | null;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const [, navigate] = useWouterLocation();

  // Fly to geocoded search result when it changes
  useEffect(() => {
    if (searchCenter && mapRef.current) {
      mapRef.current.flyTo([searchCenter.lat, searchCenter.lng], 7, {
        duration: 1.2,
      });
    }
  }, [searchCenter]);

  // Fit map to route polyline when route is computed
  useEffect(() => {
    if (routePolyline && routePolyline.length > 1 && mapRef.current) {
      const bounds = L.latLngBounds(routePolyline);
      mapRef.current.flyToBounds(bounds, { padding: [40, 40], duration: 1.2 });
    }
  }, [routePolyline]);

  // Silently fly to GPS location once if it comes in and no search has been done
  const hasFlewToUser = useRef(false);
  useEffect(() => {
    if (userLocation && mapRef.current && !hasFlewToUser.current && !searchCenter) {
      hasFlewToUser.current = true;
      mapRef.current.flyTo([userLocation.lat, userLocation.lng], 7, {
        duration: 1.5,
      });
    }
  }, [userLocation, searchCenter]);

  return (
    <div className="relative w-full h-full bg-slate-100 z-0">
      <MapContainer
        ref={mapRef}
        center={US_CENTER}
        zoom={US_ZOOM}
        minZoom={4}
        maxBounds={US_BOUNDS}
        maxBoundsViscosity={1.0}
        zoomControl={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Silent GPS bonus — blue dot if location is available */}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={L.divIcon({
              className: "user-marker",
              html: `<div style="width:14px;height:14px;background:#3b82f6;border-radius:50%;border:2.5px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.25)"></div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            })}
          />
        )}

        {/* Route polyline */}
        {routePolyline && routePolyline.length > 1 && (
          <Polyline
            positions={routePolyline}
            pathOptions={{ color: "#3b82f6", weight: 4, opacity: 0.75, dashArray: undefined }}
          />
        )}

        {/* Clustered stop markers */}
        <ClusterLayer
          stops={stops}
          onNavigate={(id) => navigate(`/stop/${id}`)}
        />
      </MapContainer>

      {/* Zoom controls */}
      <div className="absolute bottom-6 right-4 z-[400] flex flex-col gap-2">
        <button
          onClick={() => mapRef.current?.zoomIn(1)}
          className={mapBtnClass}
          aria-label="Zoom in"
        >
          <span className="text-xl font-bold text-slate-700 leading-none select-none">+</span>
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut(1)}
          className={mapBtnClass}
          aria-label="Zoom out"
        >
          <span className="text-2xl font-bold text-slate-700 leading-none select-none">−</span>
        </button>
      </div>
    </div>
  );
}
