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
  let color = 'var(--color-muted-foreground)';
  let shadow = 'rgba(0,0,0,0.1)';
  
  if (rating !== null) {
    if (rating >= 4.0) {
      color = 'var(--color-success)';
      shadow = 'var(--color-success)';
    }
    else if (rating >= 2.5) {
      color = 'var(--color-warning)';
      shadow = 'var(--color-warning)';
    }
    else {
      color = 'var(--color-destructive)';
      shadow = 'var(--color-destructive)';
    }
  }

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color}; 
        width: 32px; 
        height: 32px; 
        border-radius: 50%; 
        border: 3px solid white; 
        box-shadow: 0 4px 10px -2px ${shadow}; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        font-size: 14px;
        transform: translateY(-50%);
        transition: all 0.2s;
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
  const defaultCenter: [number, number] = [39.8283, -98.5795]; // Center of US
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
        zoom={4} 
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
