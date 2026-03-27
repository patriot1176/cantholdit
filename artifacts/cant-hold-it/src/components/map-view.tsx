import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Link } from "wouter";
import { Loader2, MapPin } from "lucide-react";
import type { Stop } from "@workspace/api-client-react";
import type { LocationPermission } from "@/hooks/use-location";

// Continental US bounds
const US_BOUNDS = L.latLngBounds(
  [24.396308, -125.001651],
  [49.384358, -66.93457]
);

const US_CENTER: [number, number] = [39.5, -98.35];
const US_ZOOM = 4;

// iOS-safe GPS options — avoids high-accuracy GPS chip, uses WiFi/cell instead
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 300000,
};

const createMarkerIcon = (rating: number | null) => {
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
        🚽
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

const mapBtnClass =
  "bg-white w-12 h-12 rounded-full shadow-lg shadow-black/10 border border-border flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all";

export function MapView({
  stops,
  userLocation,
  locationPermission,
  onRequestLocation,
}: {
  stops: Stop[];
  userLocation: { lat: number; lng: number } | null;
  locationPermission: LocationPermission;
  onRequestLocation: () => void;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const hasFlewToUser = useRef(false);

  // Fly to user location once when it first becomes available
  useEffect(() => {
    if (userLocation && mapRef.current && !hasFlewToUser.current) {
      hasFlewToUser.current = true;
      mapRef.current.flyTo([userLocation.lat, userLocation.lng], 9, {
        duration: 1.5,
      });
    }
  }, [userLocation]);

  const showToast = (msg: string, autoDismiss = 0) => {
    setToast(msg);
    if (autoDismiss > 0) setTimeout(() => setToast(null), autoDismiss);
  };

  // Recenter button: always triggered by user gesture, safe on all platforms
  const handleRecenter = () => {
    if (!navigator.geolocation) {
      mapRef.current?.flyTo(US_CENTER, US_ZOOM, { duration: 1.2 });
      return;
    }
    setIsLocating(true);
    showToast("Locating you...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo(
          [pos.coords.latitude, pos.coords.longitude],
          9,
          { duration: 1.5 }
        );
        setIsLocating(false);
        setToast(null);
        hasFlewToUser.current = true;
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          showToast("Location blocked — enable in browser settings", 3500);
        } else if (err.code === err.TIMEOUT) {
          showToast("Location timed out — try again", 2500);
        } else {
          showToast("GPS unavailable — showing full US", 2500);
          mapRef.current?.flyTo(US_CENTER, US_ZOOM, { duration: 1.2 });
        }
      },
      GEO_OPTIONS
    );
  };

  // Show banner when permission hasn't been asked yet and user hasn't dismissed it
  const showLocationBanner =
    locationPermission === "idle" && !bannerDismissed;

  // Show a denied hint (subtle, not a modal)
  const showDeniedHint =
    locationPermission === "denied" && !bannerDismissed;

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

        {/* User location dot */}
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

        {/* Stop markers */}
        {stops.map((stop) => (
          <Marker
            key={stop.id}
            position={[stop.lat, stop.lng]}
            icon={createMarkerIcon(stop.overallRating)}
          >
            <Popup className="custom-popup">
              <div className="p-3 min-w-[200px]">
                <h3 className="font-display font-bold text-lg leading-tight mb-1">
                  {stop.name}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {stop.type.replace("_", " ").toUpperCase()}
                </p>

                <div className="flex items-center gap-1 bg-slate-50 p-2 rounded-lg mb-3">
                  <span className="text-xl">🚽</span>
                  <span className="font-bold text-foreground ml-1">
                    {stop.overallRating
                      ? stop.overallRating.toFixed(1)
                      : "N/A"}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({stop.totalRatings} ratings)
                  </span>
                </div>

                <Link href={`/stop/${stop.id}`}>
                  <button className="w-full py-2 bg-primary text-white rounded-xl font-bold shadow-md shadow-primary/20 hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                    View Details
                  </button>
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Location permission banner — shown when never asked, dismissed on tap */}
      {showLocationBanner && (
        <div className="absolute top-20 left-3 right-3 z-[500]">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/10 border border-border/50 px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <p className="flex-1 text-sm font-medium text-foreground leading-snug">
              Allow location to find stops near you 📍
            </p>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setBannerDismissed(true)}
                className="text-xs text-muted-foreground font-medium px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Not now
              </button>
              <button
                onClick={() => {
                  setBannerDismissed(true);
                  onRequestLocation();
                }}
                className="text-xs font-bold text-white bg-primary px-3 py-1.5 rounded-lg active:scale-95 transition-all shadow-sm"
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Denied hint — subtle pill below search bar */}
      {showDeniedHint && (
        <div className="absolute top-20 left-3 right-3 z-[500]">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-lg">🔒</span>
            <p className="flex-1 text-xs font-medium text-amber-800 leading-snug">
              Location blocked. Enable it in your browser settings to see nearby stops.
            </p>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-amber-600 text-xs font-bold shrink-0"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Toast overlay */}
      {toast && (
        <div className="absolute bottom-20 right-4 z-[500] bg-black/75 text-white text-xs font-semibold px-3 py-2 rounded-full shadow-lg pointer-events-none whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Right-side controls: + / − / 📍 stacked top-to-bottom */}
      <div className="absolute bottom-6 right-4 z-[400] flex flex-col gap-2">
        {/* Zoom in */}
        <button
          onClick={() => mapRef.current?.zoomIn(1)}
          className={mapBtnClass}
          aria-label="Zoom in"
        >
          <span className="text-xl font-bold text-slate-700 leading-none select-none">+</span>
        </button>

        {/* Zoom out */}
        <button
          onClick={() => mapRef.current?.zoomOut(1)}
          className={mapBtnClass}
          aria-label="Zoom out"
        >
          <span className="text-2xl font-bold text-slate-700 leading-none select-none">−</span>
        </button>

        {/* Re-center */}
        <button
          onClick={handleRecenter}
          disabled={isLocating}
          className={`${mapBtnClass} disabled:opacity-60`}
          aria-label="Re-center map"
        >
          {isLocating ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <span className="text-xl leading-none">📍</span>
          )}
        </button>
      </div>
    </div>
  );
}
