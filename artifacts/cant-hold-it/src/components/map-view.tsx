import { useEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { useLocation as useWouterLocation } from "wouter";
import type { Stop } from "@workspace/api-client-react";

// Continental US bounds
const US_BOUNDS = L.latLngBounds(
  [24.396308, -125.001651],
  [49.384358, -66.93457],
);

const US_CENTER: [number, number] = [39.5, -98.35];
const US_ZOOM = 4;

// ==================== NEAR ME BUTTON ====================
const handleNearMe = (mapRef: React.RefObject<L.Map | null>) => {
  if (!navigator.geolocation) {
    alert("Your browser does not support location services.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      if (mapRef.current) {
        mapRef.current.flyTo([latitude, longitude], 12, { duration: 1.5 });
      }
    },
    (error) => {
      let message = "Unable to get your location.";
      if (error.code === 1)
        message =
          "Location access was denied. Please allow it in your browser settings.";
      if (error.code === 2) message = "Location information is unavailable.";
      if (error.code === 3) message = "Location request timed out.";
      alert(message);
    },
  );
};

function getStopEmoji(type: string, name?: string): string {
  if (name && /buc-ee|bucee/i.test(name)) return "🦫";
  switch (type) {
    case "rest_area":
      return "🛣️";
    case "gas_station":
      return "⛽";
    case "truck_stop":
      return "🚛";
    case "fast_food":
      return "🍔";
    case "walmart":
      return "🛒";
    default:
      return "🚽";
  }
}

const createMarkerIcon = (
  rating: number | null,
  type: string,
  name?: string,
) => {
  const isBucees = name ? /buc-ee|bucee/i.test(name) : false;
  if (isBucees) {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return L.divIcon({
      className: "custom-marker",
      html: `
        <div style="width: 44px; height: 44px; border-radius: 50%; border: 3px solid #FFD700; box-shadow: 0 4px 14px -2px rgba(0,0,0,0.45); overflow: hidden; background: #FFD700; cursor: pointer;">
          <img src="${base}/images/bucees-beaver.png" style="width:100%;height:100%;object-fit:cover;display:block;" alt="Buc-ee's" />
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 44],
      popupAnchor: [0, -44],
    });
  }

  let color = "#94a3b8";
  let shadowColor = "rgba(148,163,184,0.4)";
  if (rating !== null) {
    if (rating >= 4.0)
      ((color = "#22c55e"), (shadowColor = "rgba(34,197,94,0.4)"));
    else if (rating >= 3.0)
      ((color = "#f59e0b"), (shadowColor = "rgba(245,158,11,0.4)"));
    else ((color = "#ef4444"), (shadowColor = "rgba(239,68,68,0.4)"));
  }

  const emoji = getStopEmoji(type, name);
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="background-color: ${color}; width: 36px; height: 36px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px -2px ${shadowColor}; display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer;">
        ${emoji}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

function ClusterLayer({
  stops,
  onNavigate,
}: {
  stops: Stop[];
  onNavigate: (id: number) => void;
}) {
  const map = useMap();
  const navigateRef = useRef(onNavigate);
  useEffect(() => {
    navigateRef.current = onNavigate;
  }, [onNavigate]);

  useEffect(() => {
    const group = (L as any).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 60,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="background:#3b82f6;color:white;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;border:3px solid white;box-shadow:0 2px 12px rgba(59,130,246,0.45)">${count}</div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          className: "",
        });
      },
    });

    stops.forEach((stop) => {
      const marker = L.marker([stop.lat, stop.lng], {
        icon: createMarkerIcon(stop.overallRating, stop.type, stop.name),
      });

      const el = L.DomUtil.create("div");
      el.style.cssText =
        "padding:4px;min-width:190px;font-family:system-ui,sans-serif";
      el.innerHTML = `
        <div style="font-weight:700;font-size:15px;line-height:1.2;margin-bottom:2px">${stop.name}</div>
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">${stop.type.replace("_", " ")}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
          <span style="font-size:18px">${getStopEmoji(stop.type, stop.name)}</span>
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

  useEffect(() => {
    if (searchCenter && mapRef.current) {
      mapRef.current.flyTo([searchCenter.lat, searchCenter.lng], 7, {
        duration: 1.2,
      });
    }
  }, [searchCenter]);

  useEffect(() => {
    if (routePolyline && routePolyline.length > 1 && mapRef.current) {
      const bounds = L.latLngBounds(routePolyline);
      mapRef.current.flyToBounds(bounds, { padding: [40, 40], duration: 1.2 });
    }
  }, [routePolyline]);

  return (
    <div className="relative w-full h-full bg-slate-100 z-0">
      {/* BIG NEAR ME BUTTON - Moved below category chips */}
      <button
        ref={useCallback((el: HTMLButtonElement | null) => {
          if (el) {
            L.DomEvent.disableClickPropagation(el);
            L.DomEvent.disableScrollPropagation(el);
          }
        }, [])}
        onClick={() => handleNearMe(mapRef)}
        style={{
          position: "absolute",
          top: "170px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2000,
          backgroundColor: "#2563eb",
          color: "white",
          padding: "18px 40px",
          borderRadius: "9999px",
          fontSize: "20px",
          fontWeight: "700",
          boxShadow: "0 10px 30px rgba(37, 99, 235, 0.6)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          minWidth: "200px",
          justifyContent: "center",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "rgba(37, 99, 235, 0.3)",
        }}
      >
        📍 Near Me
      </button>

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

        {routePolyline && routePolyline.length > 1 && (
          <Polyline
            positions={routePolyline}
            pathOptions={{ color: "#3b82f6", weight: 4, opacity: 0.75 }}
          />
        )}

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
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut(1)}
          className={mapBtnClass}
        >
          −
        </button>
      </div>
    </div>
  );
}
