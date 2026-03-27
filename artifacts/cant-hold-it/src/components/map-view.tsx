import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Link } from "wouter";
import { Navigation, Star } from "lucide-react";
import type { Stop } from "@workspace/api-client-react";

// Component to handle map re-centering
function LocationUpdater({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 14, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

const createMarkerIcon = (rating: number | null) => {
  // Use hardcoded hex colors — CSS vars don't work inside Leaflet's divIcon HTML
  let color = '#94a3b8';
  let shadowColor = 'rgba(148,163,184,0.4)';

  if (rating !== null) {
    if (rating >= 4.0) {
      color = '#22c55e';        // green
      shadowColor = 'rgba(34,197,94,0.4)';
    } else if (rating >= 3.0) {
      color = '#f59e0b';        // yellow/amber
      shadowColor = 'rgba(245,158,11,0.4)';
    } else {
      color = '#ef4444';        // red
      shadowColor = 'rgba(239,68,68,0.4)';
    }
  }

  return L.divIcon({
    className: 'custom-marker',
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
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

export function MapView({ 
  stops, 
  userLocation 
}: { 
  stops: Stop[], 
  userLocation: { lat: number, lng: number } | null 
}) {
  const defaultCenter: [number, number] = [40.2, -87.5]; // Midwest corridor center
  const [activeCenter, setActiveCenter] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (userLocation && !activeCenter) {
      setActiveCenter([userLocation.lat, userLocation.lng]);
    }
  }, [userLocation, activeCenter]);

  return (
    <div className="relative w-full h-full bg-slate-100 z-0">
      <MapContainer 
        center={defaultCenter} 
        zoom={5} 
        zoomControl={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        
        <LocationUpdater center={activeCenter} />

        {/* User Location Marker */}
        {userLocation && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]}
            icon={L.divIcon({
              className: 'user-marker',
              html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg shadow-blue-500/50 animate-pulse"></div>`,
              iconSize: [16, 16],
            })}
          />
        )}

        {/* Stop Markers */}
        {stops.map(stop => (
          <Marker 
            key={stop.id} 
            position={[stop.lat, stop.lng]}
            icon={createMarkerIcon(stop.overallRating)}
          >
            <Popup className="custom-popup">
              <div className="p-3 min-w-[200px]">
                <h3 className="font-display font-bold text-lg leading-tight mb-1">{stop.name}</h3>
                <p className="text-xs text-muted-foreground mb-3">{stop.type.replace('_', ' ').toUpperCase()}</p>
                
                <div className="flex items-center gap-1 bg-slate-50 p-2 rounded-lg mb-3">
                  <span className="text-xl">🚽</span>
                  <span className="font-bold text-foreground ml-1">
                    {stop.overallRating ? stop.overallRating.toFixed(1) : 'N/A'}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({stop.totalRatings} ratings)
                  </span>
                </div>

                <Link href={`/stop/${stop.id}`}>
                  <button className="w-full py-2 bg-primary text-white rounded-xl font-bold shadow-md shadow-primary/20 hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
                    <Navigation className="w-4 h-4" />
                    View Details
                  </button>
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Recenter Button */}
      {userLocation && (
        <button 
          onClick={() => setActiveCenter([userLocation.lat, userLocation.lng])}
          className="absolute bottom-6 right-4 z-[400] bg-white p-3 rounded-full shadow-lg shadow-black/10 border border-border text-primary hover:bg-slate-50 active:scale-95 transition-all"
        >
          <Navigation className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
