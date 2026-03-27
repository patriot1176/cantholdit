import { useState, useEffect } from "react";

export function useLocation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Silently attempt GPS on mount — no prompts, no errors, just a bonus blue dot if it works
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}, // silently ignore — GPS is optional
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  return { location };
}
