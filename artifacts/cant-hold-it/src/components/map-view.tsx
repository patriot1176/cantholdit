import { useEffect, useRef, useState, useCallback, Component, type ReactNode } from "react";
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

class MapErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 600 }}>Map failed to load</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 12,
              padding: "10px 24px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const US_BOUNDS = L.latLngBounds(
  [24.396308, -125.001651],
  [49.384358, -66.93457],
);

const US_CENTER: [number, number] = [39.5, -98.35];
const US_ZOOM = 4;

function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(miles: number, approximate = false): string {
  const prefix = approximate ? "~" : "";
  if (miles < 0.1) return `${prefix}< 0.1 mi`;
  if (miles < 10) return `${prefix}${miles.toFixed(1)} mi`;
  return `${prefix}${Math.round(miles)} mi`;
}

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

function getAmenityIcons(type: string): string {
  switch (type) {
    case "rest_area":
      return "🚻 Restrooms · 🅿️ Parking · 🐕 Pet area";
    case "gas_station":
      return "⛽ Gas · 🚻 Restrooms · 🏪 Store";
    case "truck_stop":
      return "⛽ Gas · 🚿 Showers · 🚻 Restrooms · 🍔 Food";
    case "fast_food":
      return "🍔 Food · 🚻 Restrooms · 📶 WiFi";
    case "walmart":
      return "🛒 Store · 🚻 Restrooms · 🅿️ Parking";
    default:
      return "🚻 Restrooms";
  }
}

function ratingLabel(r: number | null): string {
  if (r === null) return "Not yet rated";
  if (r >= 4.5) return "Royal Flush";
  if (r >= 4.0) return "Clean";
  if (r >= 3.0) return "Decent";
  if (r >= 2.0) return "Rough";
  return "Biohazard";
}

function ratingColor(r: number | null): string {
  if (r === null) return "#94a3b8";
  if (r >= 4.0) return "#22c55e";
  if (r >= 3.0) return "#f59e0b";
  return "#ef4444";
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

  const color = ratingColor(rating);
  const emoji = getStopEmoji(type, name);
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="background-color: ${color}; width: 36px; height: 36px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px -2px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer;">
        ${emoji}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

function buildPopupHtml(
  stop: Stop,
  userLat: number | null,
  userLng: number | null,
): string {
  const emoji = getStopEmoji(stop.type, stop.name);
  const typeName = stop.type.replace(/_/g, " ");
  const rColor = ratingColor(stop.overallRating);
  const rLabel = ratingLabel(stop.overallRating);
  const rText =
    stop.overallRating !== null
      ? `${stop.overallRating.toFixed(1)} — ${rLabel}`
      : rLabel;

  let distHtml = "";
  if (userLat !== null && userLng !== null) {
    const d = haversineDistanceMiles(userLat, userLng, Number(stop.lat), Number(stop.lng));
    distHtml = `<div style="font-size:12px;color:#3b82f6;font-weight:600;margin-bottom:6px">📍 ${formatDistance(d)} away</div>`;
  }

  const addressLine = stop.address || "";
  const amenities = getAmenityIcons(stop.type);
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`;

  return `
    <div style="padding:6px 2px;min-width:220px;max-width:260px;font-family:system-ui,-apple-system,sans-serif">
      <div style="font-weight:700;font-size:15px;line-height:1.3;margin-bottom:2px">${stop.name}</div>
      <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">${emoji} ${typeName}</div>
      ${addressLine ? `<div style="font-size:12px;color:#475569;margin-bottom:6px;line-height:1.3">📌 ${addressLine}</div>` : ""}
      ${distHtml}
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="font-weight:700;font-size:18px;color:${rColor}">${stop.overallRating !== null ? stop.overallRating.toFixed(1) : "—"}</span>
        <span style="font-size:13px;color:#475569">${rText}</span>
        <span style="font-size:11px;color:#94a3b8">(${stop.totalRatings})</span>
      </div>
      <div style="font-size:11px;color:#64748b;margin-bottom:10px;line-height:1.5;border-top:1px solid #e2e8f0;padding-top:6px">${amenities}</div>
      <div style="display:flex;gap:6px">
        <button data-action="details" style="flex:1;background:#3b82f6;color:white;border:none;padding:10px 8px;border-radius:10px;font-weight:700;cursor:pointer;font-size:13px">View Details</button>
        <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="flex:1;background:#22c55e;color:white;border:none;padding:10px 8px;border-radius:10px;font-weight:700;cursor:pointer;font-size:13px;text-decoration:none;text-align:center;display:flex;align-items:center;justify-content:center;gap:4px">🧭 Directions</a>
      </div>
    </div>
  `;
}

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
        const childMarkers = cluster.getAllChildMarkers();

        let totalRating = 0;
        let ratedCount = 0;
        childMarkers.forEach((marker: any) => {
          const rating = marker._stopRating ?? null;
          if (rating !== null && typeof rating === "number") {
            totalRating += rating;
            ratedCount++;
          }
        });

        const avgRating = ratedCount > 0 ? totalRating / ratedCount : null;
        let bgColor = "#3b82f6";
        if (avgRating !== null) {
          if (avgRating >= 4.0) bgColor = "#22c55e";
          else if (avgRating >= 3.0) bgColor = "#f59e0b";
          else bgColor = "#ef4444";
        }

        const size = count > 100 ? 56 : count > 30 ? 50 : 46;
        const fontSize = count > 100 ? 16 : count > 30 ? 15 : 14;

        return L.divIcon({
          html: `<div style="background:${bgColor};color:white;width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${fontSize}px;border:3px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.4)">${count}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          className: "",
        });
      },
    });

    stops.forEach((stop) => {
      const marker = L.marker([stop.lat, stop.lng], {
        icon: createMarkerIcon(stop.overallRating, stop.type, stop.name),
      });
      (marker as any)._stopRating = stop.overallRating ?? null;
      (marker as any)._stopData = stop;

      marker.on("click", () => {
        try {
          const userLat = window.__cantholdit_gps_lat ?? null;
          const userLng = window.__cantholdit_gps_lng ?? null;
          const html = buildPopupHtml(stop, userLat, userLng);
          const el = L.DomUtil.create("div");
          el.innerHTML = html;
          el.querySelector('[data-action="details"]')?.addEventListener(
            "click",
            () => {
              navigateRef.current(stop.id);
              map.closePopup();
            },
          );
          marker.unbindPopup();
          marker.bindPopup(el, { maxWidth: 280, minWidth: 220 });
          marker.openPopup();
        } catch {
          navigateRef.current(stop.id);
        }
      });

      marker.bindPopup("Loading...", { maxWidth: 280, minWidth: 220 });
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

declare global {
  interface Window {
    __cantholdit_gps_lat?: number;
    __cantholdit_gps_lng?: number;
  }
}

interface NearbyStop extends Stop {
  distanceMiles: number;
}

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
  const [locatingNearMe, setLocatingNearMe] = useState(false);
  const [nearbyData, setNearbyData] = useState<NearbyStop[] | null>(null);
  const [userMarkerPos, setUserMarkerPos] = useState<[number, number] | null>(
    null,
  );

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

  const handleNearMeClick = useCallback(() => {
    if (locatingNearMe) return;
    if (!navigator.geolocation) {
      alert("Your browser does not support location services.");
      return;
    }
    setLocatingNearMe(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          window.__cantholdit_gps_lat = lat;
          window.__cantholdit_gps_lng = lng;

          const map = mapRef.current;
          if (map) {
            map.setView([lat, lng], 11);
          }

          setLocatingNearMe(false);
          setUserMarkerPos([lat, lng]);

          setTimeout(() => {
            try {
              if (mapRef.current) mapRef.current.invalidateSize();
              const QUALITY_GAS = /buc-?ee|sheetz|wawa|quiktrip|racetrac|casey|kwik/i;
              const TRAVEL_CENTER = /pilot|love'?s|flying\s*j|ta\b|travel\s*(center|america)|petro/i;

              function stopTier(s: Stop): number {
                if (s.type === "rest_area") return 0;
                if (s.type === "truck_stop") return 1;
                if (TRAVEL_CENTER.test(s.name)) return 1;
                if (s.type === "gas_station") {
                  if (QUALITY_GAS.test(s.name)) return 2;
                  if (s.overallRating !== null && s.overallRating >= 3.0) return 2;
                  return 4;
                }
                return 5;
              }

              const INCLUDE_TYPES = ["rest_area", "truck_stop", "gas_station"];
              const HWY_RE = /\b(I-?\d+|US-?\d+|SR-?\d+|Hwy\s*\d+|Interstate\s+\d+|Route\s+\d+)/i;
              const DIR_RE = /\b(northbound|southbound|eastbound|westbound|[ns]b|[ew]b)\b/i;
              const GENERIC_NAMES = ["WELCOME CENTER", "REST AREA", "REST STOP", "SERVICE PLAZA"];

              function enrichName(s: Stop): string {
                const hwy = s.address?.match(HWY_RE);
                const dir = s.address?.match(DIR_RE);
                const upper = s.name.toUpperCase().trim();
                const isGeneric = GENERIC_NAMES.some((g) => upper === g || upper.startsWith(g));
                if (isGeneric || (s.type === "rest_area" && !hwy)) {
                  const dirTag = dir ? ` ${dir[1].toUpperCase()}` : "";
                  if (hwy) return `${hwy[1]}${dirTag} Rest Area`;
                  return `Rest Area${dirTag}`;
                }
                if (s.type === "rest_area" && hwy && !s.name.match(HWY_RE)) {
                  const dirTag = dir ? ` ${dir[1].toUpperCase()}` : "";
                  return `${hwy[1]}${dirTag} ${s.name}`;
                }
                if (s.type === "truck_stop" && hwy && !s.name.match(HWY_RE)) {
                  return `${s.name} - ${hwy[1]}`;
                }
                return s.name;
              }

              function dedupeKey(s: Stop): string {
                const latR = Number(s.lat).toFixed(2);
                const lngR = Number(s.lng).toFixed(2);
                return `${s.type}|${latR}|${lngR}`;
              }

              const seen = new Set<string>();
              const allWithDist = stops
                .filter((s) => INCLUDE_TYPES.includes(s.type))
                .map((s) => {
                  const dist = haversineDistanceMiles(lat, lng, Number(s.lat), Number(s.lng));
                  const tier = stopTier(s);
                  const displayName = enrichName(s);
                  return { ...s, name: displayName, distanceMiles: dist, _tier: tier };
                })
                .sort((a, b) => a.distanceMiles - b.distanceMiles)
                .filter((s) => {
                  const key = dedupeKey(s);
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });

              const closest = allWithDist.slice(0, 4);
              const closestIds = new Set(closest.map((s) => s.id));
              const rest = allWithDist
                .filter((s) => !closestIds.has(s.id) && s._tier <= 3)
                .sort((a, b) => {
                  if (a._tier !== b._tier) return a._tier - b._tier;
                  return a.distanceMiles - b.distanceMiles;
                });
              const nearby = [...closest, ...rest].slice(0, 8);
              setNearbyData(nearby);
            } catch (e) {
              console.error("Nearby calculation failed:", e);
            }
          }, 500);
        } catch (e) {
          console.error("Near Me failed:", e);
          setLocatingNearMe(false);
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
        setLocatingNearMe(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 },
    );
  }, [locatingNearMe, stops]);

  const markerPos = userMarkerPos || (userLocation ? [userLocation.lat, userLocation.lng] as [number, number] : null);

  const btnRef = useCallback((el: HTMLButtonElement | null) => {
    if (el) {
      L.DomEvent.disableClickPropagation(el);
      L.DomEvent.disableScrollPropagation(el);
    }
  }, []);

  const panelRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      L.DomEvent.disableClickPropagation(el);
      L.DomEvent.disableScrollPropagation(el);
    }
  }, []);

  return (
    <MapErrorBoundary>
      <div className="relative w-full h-full bg-slate-100 z-0">
        <button
          ref={btnRef}
          onClick={handleNearMeClick}
          disabled={locatingNearMe}
          style={{
            position: "absolute",
            top: "250px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2000,
            backgroundColor: locatingNearMe ? "#60a5fa" : "#2563eb",
            color: "white",
            padding: "16px 36px",
            borderRadius: "9999px",
            fontSize: "18px",
            fontWeight: "700",
            boxShadow: locatingNearMe
              ? "0 10px 30px rgba(96, 165, 250, 0.4)"
              : "0 10px 30px rgba(37, 99, 235, 0.6)",
            border: "none",
            cursor: locatingNearMe ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            minWidth: "200px",
            justifyContent: "center",
            touchAction: "manipulation",
            WebkitTapHighlightColor: "rgba(37, 99, 235, 0.3)",
            transition: "background-color 0.2s, box-shadow 0.2s",
          }}
        >
          {locatingNearMe ? (
            <>
              <span
                style={{
                  display: "inline-block",
                  animation: "spin 1s linear infinite",
                }}
              >
                ⏳
              </span>
              Locating…
            </>
          ) : (
            <>📍 Near Me</>
          )}
        </button>

        {nearbyData && nearbyData.length > 0 && (
          <div
            ref={panelRef}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 2000,
              background: "white",
              borderTopLeftRadius: "16px",
              borderTopRightRadius: "16px",
              boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
              maxHeight: "40vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px 4px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <span
                style={{ fontWeight: 700, fontSize: "15px", color: "#1e293b" }}
              >
                📍 Nearby Stops
              </span>
              <button
                onClick={() => setNearbyData(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#94a3b8",
                  padding: "4px 8px",
                }}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                padding: "4px 16px 6px",
                lineHeight: 1.3,
              }}
            >
              Distances are approximate. Tap Directions for real route.
            </div>
            {nearbyData.map((s) => (
              <div
                key={s.id}
                onClick={() => navigate(`/stop/${s.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 16px",
                  borderBottom: "1px solid #f1f5f9",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "22px" }}>
                  {getStopEmoji(s.type, s.name)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "14px",
                      color: "#1e293b",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {s.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>
                    {(() => {
                      const hwy = s.address?.match(/\b(I-?\d+|US-?\d+|SR-?\d+|Hwy\s*\d+|Interstate\s+\d+|Route\s+\d+)/i);
                      const hwySuffix = hwy ? ` · ${hwy[1]}` : "";
                      const typeLabel = s.type.replace(/_/g, " ");
                      const ratingText = s.overallRating !== null
                        ? `${s.overallRating.toFixed(1)} ⭐`
                        : "No rating";
                      return `${typeLabel} · ${ratingText}${hwySuffix}`;
                    })()}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "14px",
                      color: "#3b82f6",
                    }}
                  >
                    {formatDistance(s.distanceMiles, true)}
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      fontSize: "11px",
                      color: "#22c55e",
                      fontWeight: 600,
                    }}
                  >
                    Directions →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <MapContainer
          ref={mapRef}
          center={US_CENTER}
          zoom={US_ZOOM}
          minZoom={4}
          maxBounds={US_BOUNDS}
          maxBoundsViscosity={0.8}
          zoomControl={false}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          {markerPos && (
            <Marker
              position={markerPos}
              icon={L.divIcon({
                className: "user-marker",
                html: `<div style="width:16px;height:16px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 0 0 5px rgba(59,130,246,0.25)"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
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

        <div className="absolute bottom-6 right-4 z-[400] flex flex-col gap-2">
          <button
            onClick={() => mapRef.current?.zoomIn(1)}
            className="bg-white w-12 h-12 rounded-full shadow-lg shadow-black/10 border border-border flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all"
          >
            +
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut(1)}
            className="bg-white w-12 h-12 rounded-full shadow-lg shadow-black/10 border border-border flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all"
          >
            −
          </button>
        </div>
      </div>
    </MapErrorBoundary>
  );
}
