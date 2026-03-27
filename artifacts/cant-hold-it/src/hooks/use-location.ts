import { useState, useEffect, useCallback } from "react";

export type LocationPermission = "idle" | "loading" | "granted" | "denied" | "unavailable";

// iOS-safe options — enableHighAccuracy:false uses WiFi/cell tower (faster, more reliable on iOS)
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 300000,
};

export function useLocation() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [permission, setPermission] = useState<LocationPermission>("idle");

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setPermission("unavailable");
      return;
    }
    setPermission("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPermission("granted");
      },
      () => {
        setPermission("denied");
      },
      GEO_OPTIONS
    );
  }, []);

  // On mount: check if permission was previously granted → auto-fetch silently.
  // If "prompt" (never asked) → leave as "idle" so the banner can request via user gesture.
  // iOS Safari silently blocks getCurrentPosition() in useEffect without prior grant.
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setPermission("unavailable");
      return;
    }
    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((result) => {
          if (result.state === "granted") {
            requestLocation(); // Already allowed — safe to call without user gesture
          } else if (result.state === "denied") {
            setPermission("denied");
          }
          // "prompt" → stay "idle", banner will prompt with a user gesture
        })
        .catch(() => {
          // Older Safari without permissions API — stay "idle", banner handles it
        });
    }
    // No permissions API → stay "idle"
  }, [requestLocation]);

  return { location, permission, requestLocation };
}
