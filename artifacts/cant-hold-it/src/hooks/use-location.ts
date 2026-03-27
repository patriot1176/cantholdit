import { useState, useEffect } from "react";

const GPS_KEY = "cant_hold_it_gps";

export function saveGpsToSession(lat: number, lng: number) {
  try { sessionStorage.setItem(GPS_KEY, JSON.stringify({ lat, lng })); } catch {}
}

export function readGpsFromSession(): { lat: number; lng: number } | null {
  try {
    const raw = sessionStorage.getItem(GPS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function useLocation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        saveGpsToSession(loc.lat, loc.lng); // persist so other pages can read it instantly
        setLocation(loc);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  return { location };
}
