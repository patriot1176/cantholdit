import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { MapView } from "@/components/map-view";
import { useLocation } from "@/hooks/use-location";
import { useGetStops } from "@workspace/api-client-react";
import { Search, Loader2, Map as MapIcon, List, Trophy, Plus, LocateFixed, CheckCircle, X, MapPin, PenLine, Route } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { FlushRating } from "@/components/flush-rating";

type ViewMode = "map" | "list" | "route" | "top";

interface GeoResult { lat: number; lng: number; label: string; }

async function geocodeSuggest(q: string): Promise<GeoResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=us&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    return (data as any[]).map((r: any) => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      label: r.display_name
        .split(",")
        .slice(0, 3)
        .join(",")
        .trim(),
    }));
  } catch {
    return [];
  }
}

// Haversine formula — returns distance in km between two lat/lng points
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const RADIUS_KM = 300;
const ROUTE_BUFFER_KM = 24.14; // 15 miles

// Geocode a city/address to lat/lng (single best result)
async function geocodeOne(q: string): Promise<{ lat: number; lng: number } | null> {
  const results = await geocodeSuggest(q);
  if (results.length === 0) return null;
  return { lat: results[0].lat, lng: results[0].lng };
}

// Fetch driving route from OSRM between two points (returns [lat, lng][] polyline)
async function fetchOsrmRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): Promise<[number, number][] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.routes?.[0]?.geometry?.coordinates) return null;
    // GeoJSON coords are [lng, lat] → convert to [lat, lng] for Leaflet
    return data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
  } catch { return null; }
}

// Perpendicular distance from point P to segment AB in km
function pointToSegmentKm(
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number
): number {
  const abLat = bLat - aLat; const abLng = bLng - aLng;
  const apLat = pLat - aLat; const apLng = pLng - aLng;
  const lenSq = abLat * abLat + abLng * abLng;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (apLat * abLat + apLng * abLng) / lenSq));
  const closestLat = aLat + t * abLat;
  const closestLng = aLng + t * abLng;
  return haversineKm(pLat, pLng, closestLat, closestLng);
}

// Filter stops within ROUTE_BUFFER_KM of the polyline
function filterStopsNearRoute(
  stops: { lat: number; lng: number; [k: string]: any }[],
  polyline: [number, number][]
): typeof stops {
  return stops.filter((stop) => {
    for (let i = 0; i < polyline.length - 1; i++) {
      const d = pointToSegmentKm(
        stop.lat, stop.lng,
        polyline[i][0], polyline[i][1],
        polyline[i + 1][0], polyline[i + 1][1]
      );
      if (d <= ROUTE_BUFFER_KM) return true;
    }
    return false;
  });
}

export default function Home() {
  const { location } = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [filterMinRating, setFilterMinRating] = useState(0);
  const [filterHighway, setFilterHighway] = useState("");

  const locateMe = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocateError("GPS not available on this device");
      return;
    }
    setLocating(true);
    setLocateError(null);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        skipGeocodeRef.current = true; // prevent debounce from geocoding "Near me" text
        setSearchCenter(coords);
        setSearchQuery("Near me");
        setSuggestions([]);
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          setLocateError(
            isIOS
              ? "Location blocked on iPhone. Fix: Settings → Privacy & Security → Location Services → Safari → While Using"
              : "Location blocked — tap your browser's address bar lock icon and allow Location, then try again"
          );
        } else if (err.code === 2) {
          setLocateError(
            isIOS
              ? "Location unavailable. Make sure Location Services is ON: Settings → Privacy & Security → Location Services"
              : "Couldn't get your location — check your GPS and try again"
          );
        } else {
          setLocateError("Location timed out — search by city name instead");
        }
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
    );
  }, []);

  // Pick a suggestion: set map center, clear dropdown
  const pickSuggestion = useCallback((r: GeoResult) => {
    setSearchCenter({ lat: r.lat, lng: r.lng });
    setSuggestions([]);
  }, []);

  // Geocode: always activate proximity filter with the top result immediately;
  // if multiple results, also show disambiguation dropdown so user can refine
  const runGeocode = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchCenter(null); setSuggestions([]); return; }
    const results = await geocodeSuggest(q);
    if (results.length === 0) return;
    // Always lock in the best (first) result so proximity filter activates
    setSearchCenter({ lat: results[0].lat, lng: results[0].lng });
    if (results.length > 1) {
      setSuggestions(results); // let user optionally pick a different one
    }
  }, []);

  // Debounce timer ref — cancelled on Enter/button tap so it fires immediately
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set to true when GPS locateMe sets the query — prevents Nominatim overriding GPS coords
  const skipGeocodeRef = useRef(false);

  // Clear suggestions when query changes
  useEffect(() => {
    setSuggestions([]);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!searchQuery.trim()) { setSearchCenter(null); return; }
    if (skipGeocodeRef.current) { skipGeocodeRef.current = false; return; }
    debounceTimer.current = setTimeout(() => runGeocode(searchQuery), 700);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [searchQuery, runGeocode]);

  const fireSearch = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    runGeocode(searchQuery);
  }, [searchQuery, runGeocode]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") fireSearch();
    if (e.key === "Escape") setSuggestions([]);
  };

  // Always fetch ALL stops — no text filter (search drives map pan, not stop filtering)
  const { data: allStops, isLoading } = useGetStops(
    {},
    { query: { keepPreviousData: true } }
  );

  // Route search state — declared after allStops so callback can reference it
  const [routeFrom, setRouteFrom] = useState("");
  const [routeTo, setRouteTo] = useState("");
  const [routeSearching, setRouteSearching] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routePolyline, setRoutePolyline] = useState<[number, number][] | null>(null);
  const [routeStops, setRouteStops] = useState<NonNullable<typeof allStops> | null>(null);

  const findStopsAlongRoute = useCallback(async () => {
    if (!routeFrom.trim() || !routeTo.trim()) {
      setRouteError("Enter both a start and end city.");
      return;
    }
    if (!allStops || allStops.length === 0) {
      setRouteError("Stop data not loaded yet — try again in a moment.");
      return;
    }
    setRouteSearching(true);
    setRouteError(null);
    setRoutePolyline(null);
    setRouteStops(null);
    try {
      const [start, end] = await Promise.all([geocodeOne(routeFrom), geocodeOne(routeTo)]);
      if (!start) { setRouteError(`Couldn't find "${routeFrom}" — try a city + state.`); return; }
      if (!end) { setRouteError(`Couldn't find "${routeTo}" — try a city + state.`); return; }
      const polyline = await fetchOsrmRoute(start, end);
      if (!polyline) { setRouteError("Couldn't compute a driving route between those cities."); return; }
      const nearby = filterStopsNearRoute(allStops, polyline);
      setRoutePolyline(polyline);
      setRouteStops(nearby);
    } catch {
      setRouteError("Something went wrong. Please try again.");
    } finally {
      setRouteSearching(false);
    }
  }, [routeFrom, routeTo, allStops]);

  // Client-side proximity filter: within 300km of searchCenter; sorted nearest-first when searching.
  // Falls back to GPS location for sort-by-distance in list/leaderboard views even without explicit search.
  const stops = (() => {
    if (!allStops) return undefined;
    const center = searchCenter;
    if (center) {
      return allStops
        .filter((s) => haversineKm(center.lat, center.lng, s.lat, s.lng) <= RADIUS_KM)
        .sort((a, b) =>
          haversineKm(center.lat, center.lng, a.lat, a.lng) -
          haversineKm(center.lat, center.lng, b.lat, b.lng)
        );
    }
    // Sort by GPS location when available (no radius filter applied — show all stops)
    if (location) {
      return [...allStops].sort((a, b) =>
        haversineKm(location.lat, location.lng, a.lat, a.lng) -
        haversineKm(location.lat, location.lng, b.lat, b.lng)
      );
    }
    return allStops;
  })();

  // Apply type + rating + highway filters on top of proximity-filtered stops
  const filteredStops = stops?.filter((s) => {
    if (filterType !== "all" && s.type !== filterType) return false;
    if (filterMinRating > 0 && (s.overallRating === null || s.overallRating < filterMinRating)) return false;
    if (filterHighway.trim()) {
      const h = filterHighway.trim().toLowerCase();
      if (!s.highway || !s.highway.toLowerCase().includes(h)) return false;
    }
    return true;
  });

  // True when user searched a location but no stops exist nearby
  const noStopsNearby = !!searchCenter && !!stops && stops.length === 0;

  // Leaderboard data derived from stops
  const royalFlushStops = [...(stops || [])]
    .filter((s) => s.overallRating !== null && s.overallRating >= 4.0)
    .sort((a, b) => (b.overallRating ?? 0) - (a.overallRating ?? 0))
    .slice(0, 5);

  const biohazardStops = [...(stops || [])]
    .filter((s) => s.overallRating !== null)
    .sort((a, b) => (a.overallRating ?? 0) - (b.overallRating ?? 0))
    .slice(0, 5);

  // Quick-rate prompt: check sessionStorage for a stop visited without rating
  const [pendingRate, setPendingRate] = useState<{ id: number; name: string } | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("cantholdit_pending_rate");
      if (raw) setPendingRate(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  const dismissPendingRate = () => {
    setPendingRate(null);
    try { sessionStorage.removeItem("cantholdit_pending_rate"); } catch { /* ignore */ }
  };

  const tabs: { id: ViewMode; icon: typeof MapIcon; label: string }[] = [
    { id: "map", icon: MapIcon, label: "Map" },
    { id: "list", icon: List, label: "List" },
    { id: "route", icon: Route, label: "Route" },
    { id: "top", icon: Trophy, label: "Top" },
  ];

  return (
    <Layout>
      {/* Search bar + tab switcher */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="flex-1 bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/5 border border-white/50 flex items-center px-3 py-3 focus-within:ring-2 focus-within:ring-primary/50 transition-all min-w-0">
            {/* Near Me button */}
            <button
              type="button"
              onClick={locateMe}
              disabled={locating}
              className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all mr-2 ${
                locating
                  ? "bg-primary/10 text-primary"
                  : "bg-slate-100 text-slate-500 hover:bg-primary/10 hover:text-primary active:scale-95"
              }`}
              aria-label="Find stops near me"
            >
              {locating
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <LocateFixed className="w-4 h-4" />
              }
            </button>
            <input
              type="text"
              inputMode="search"
              enterKeyHint="search"
              placeholder="City, highway, or state..."
              className="flex-1 bg-transparent border-none outline-none font-medium placeholder:text-muted-foreground text-sm min-w-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchQuery === "Near me") setSearchQuery(""); }}
              onKeyDown={handleSearchKeyDown}
            />
            {searchQuery.trim() ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchCenter(null);
                }}
                className="ml-2 shrink-0 w-8 h-8 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={fireSearch}
                className="ml-2 shrink-0 w-8 h-8 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all shadow-sm shadow-primary/30"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 3-tab switcher */}
          <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/5 border border-white/50 flex overflow-hidden shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
                  className={`px-3 py-3 flex items-center justify-center transition-all ${
                    active
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
                  }`}
                  aria-label={tab.label}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Location error toast */}
        <AnimatePresence>
          {locateError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm font-medium text-red-700 flex items-start gap-2"
            >
              <LocateFixed className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="flex-1 leading-snug">{locateError}</span>
              <button
                type="button"
                onClick={() => setLocateError(null)}
                className="shrink-0 text-red-400 hover:text-red-600 font-bold text-base leading-none mt-0.5"
                aria-label="Dismiss"
              >×</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active search banner — tap to clear */}
        {searchCenter && searchQuery && searchQuery !== "Near me" && (
          <button
            type="button"
            onClick={() => { setSearchQuery(""); setSearchCenter(null); }}
            className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary rounded-2xl px-3 py-2 text-xs font-semibold w-full"
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left truncate">Showing near "{searchQuery}"</span>
            <X className="w-3.5 h-3.5 shrink-0" />
          </button>
        )}

        {/* Filter chips — shown in list + map views */}
        {viewMode !== "top" && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {[
              { value: "all", label: "All Types" },
              { value: "rest_area", label: "🛣️ Rest Area" },
              { value: "gas_station", label: "⛽ Gas" },
              { value: "truck_stop", label: "🚛 Truck" },
              { value: "fast_food", label: "🍔 Food" },
            ].map((chip) => (
              <button
                key={chip.value}
                onClick={() => setFilterType(chip.value)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  filterType === chip.value
                    ? "bg-primary text-white shadow-sm"
                    : "bg-white/90 backdrop-blur-sm text-slate-600 border border-white/50 shadow-sm"
                }`}
              >
                {chip.label}
              </button>
            ))}
            <div className="w-px bg-white/40 shrink-0 self-stretch my-0.5" />
            {[
              { value: 0, label: "Any ★" },
              { value: 3, label: "3★+" },
              { value: 4, label: "4★+" },
            ].map((chip) => (
              <button
                key={chip.value}
                onClick={() => setFilterMinRating(chip.value)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  filterMinRating === chip.value
                    ? "bg-primary text-white shadow-sm"
                    : "bg-white/90 backdrop-blur-sm text-slate-600 border border-white/50 shadow-sm"
                }`}
              >
                {chip.label}
              </button>
            ))}
            <div className="w-px bg-white/40 shrink-0 self-stretch my-0.5" />
            <div className="shrink-0 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-white/50 shadow-sm rounded-full px-2 py-1 focus-within:ring-2 focus-within:ring-primary/40">
              <span className="text-xs leading-none select-none">🛣️</span>
              <input
                type="text"
                value={filterHighway}
                onChange={(e) => setFilterHighway(e.target.value.toUpperCase())}
                placeholder="I-40…"
                className="w-16 bg-transparent outline-none text-xs font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-normal uppercase"
              />
              {filterHighway && (
                <button
                  type="button"
                  onClick={() => setFilterHighway("")}
                  className="text-slate-400 hover:text-slate-600 leading-none"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}

        {/* Disambiguation dropdown — shown when multiple results match */}
        {suggestions.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-border overflow-hidden"
          >
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-4 pt-3 pb-1">
              Which one?
            </p>
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pickSuggestion(s)}
                className="w-full text-left px-4 py-3 text-sm font-medium text-foreground hover:bg-primary/5 active:bg-primary/10 border-t border-border/40 first:border-0 transition-colors"
              >
                {s.label}
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Quick-rate prompt banner */}
      <AnimatePresence>
        {pendingRate && (
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ type: "spring", stiffness: 280, damping: 25 }}
            className="absolute bottom-6 left-4 right-4 z-[450] pointer-events-auto"
            style={{ bottom: viewMode !== "top" ? "5.5rem" : "1.5rem" }}
          >
            <div className="bg-white rounded-2xl shadow-xl border border-border p-4 flex items-center gap-3">
              <div className="text-2xl shrink-0">🚽</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium">Just visited?</p>
                <p className="text-sm font-bold text-foreground truncate">{pendingRate.name}</p>
              </div>
              <Link href={`/stop/${pendingRate.id}/rate`} onClick={dismissPendingRate}>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="shrink-0 flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm shadow-primary/30"
                >
                  <PenLine className="w-3.5 h-3.5" /> Rate it
                </motion.button>
              </Link>
              <button
                onClick={dismissPendingRate}
                className="shrink-0 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Add Stop button */}
      {viewMode !== "top" && (
        <Link href="/add-stop">
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="absolute bottom-6 left-4 z-[400] bg-primary text-white w-14 h-14 rounded-full shadow-xl shadow-primary/40 flex items-center justify-center border-2 border-white"
            aria-label="Add a new stop"
          >
            <Plus className="w-7 h-7" />
          </motion.button>
        </Link>
      )}

      <div className="flex-1 relative overflow-hidden">
        {isLoading && !stops && (
          <div className="absolute inset-0 z-20 bg-background/50 backdrop-blur-sm flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="font-display font-medium text-lg text-foreground animate-pulse">
              Finding nearest thrones...
            </p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* MAP VIEW */}
          {viewMode === "map" && (
            <motion.div
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              <MapView
                stops={routeStops && routePolyline ? routeStops : (filteredStops || [])}
                userLocation={location}
                searchCenter={searchCenter}
                routePolyline={routePolyline}
              />

              {/* Empty state overlay — no stops within 800km of search */}
              {noStopsNearby && (
                <div className="absolute bottom-24 left-4 right-4 z-[400] pointer-events-auto">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-border p-5 flex flex-col items-center text-center gap-3"
                  >
                    <div className="text-4xl">🌵</div>
                    <div>
                      <p className="font-display font-bold text-foreground text-base leading-snug">
                        No stops here yet
                      </p>
                      <p className="text-muted-foreground text-sm mt-0.5">
                        Be the first to add one!
                      </p>
                    </div>
                    <Link href="/add-stop" className="w-full">
                      <motion.div
                        whileTap={{ scale: 0.97 }}
                        className="w-full bg-gradient-to-r from-primary to-blue-500 text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-primary/30 text-sm"
                      >
                        <Plus className="w-4 h-4" /> Add a Stop
                      </motion.div>
                    </Link>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* LIST VIEW */}
          {viewMode === "list" && (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0 bg-background overflow-y-auto pt-36 pb-28 px-4 flex flex-col gap-4"
            >
              <div className="flex items-center justify-center pt-1">
                <span className="text-[11px] font-bold text-muted-foreground/60 tracking-wide">
                  🇺🇸 America's Road Trip Bathroom Rater
                </span>
              </div>

              {filteredStops?.length === 0 ? (
                <div className="text-center py-16 flex flex-col items-center gap-4">
                  <div className="text-6xl grayscale opacity-50">🌵</div>
                  <div>
                    <h3 className="font-display text-xl font-bold text-foreground">
                      {noStopsNearby ? "No stops here yet" : "No stops match your filters"}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {noStopsNearby
                        ? "Be the first to add one in this area!"
                        : "Try relaxing your type or rating filter."}
                    </p>
                  </div>
                  {noStopsNearby && (
                    <Link href="/add-stop" className="w-full max-w-xs">
                      <motion.div
                        whileTap={{ scale: 0.97 }}
                        className="w-full bg-gradient-to-r from-primary to-blue-500 text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-primary/30"
                      >
                        <Plus className="w-4 h-4" /> Add a Stop
                      </motion.div>
                    </Link>
                  )}
                </div>
              ) : (
                filteredStops?.map((stop) => {
                  const isVerified = stop.totalRatings >= 10;
                  return (
                    <Link key={stop.id} href={`/stop/${stop.id}`}>
                      <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50 hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98]">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0 pr-3">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-display font-bold text-lg text-foreground leading-tight">
                                {stop.name}
                              </h3>
                              {isVerified && (
                                <CheckCircle className="w-4 h-4 text-primary shrink-0" title="Community Verified" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {stop.type.replace("_", " ")}
                              </p>
                              {stop.highway && (
                                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">🛣️ {stop.highway}</span>
                              )}
                            </div>
                          </div>
                          <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 flex flex-col items-center shrink-0">
                            <span className="text-sm font-bold text-foreground">
                              {stop.overallRating?.toFixed(1) || "—"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {stop.totalRatings} rev
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-foreground/70 truncate mb-3">
                          {stop.address}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {stop.badges.map((badge) => (
                            <span
                              key={badge}
                              className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-md uppercase tracking-wider"
                            >
                              {badge.replace("_", " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </motion.div>
          )}

          {/* ROUTE SEARCH */}
          {viewMode === "route" && (
            <motion.div
              key="route"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0 bg-background overflow-y-auto pt-24 pb-8 px-4 flex flex-col gap-4"
            >
              <div className="flex items-center justify-center pt-1">
                <span className="text-[11px] font-bold text-muted-foreground/60 tracking-wide">
                  🗺️ Stops Along Your Drive
                </span>
              </div>

              {/* Route inputs */}
              <div className="bg-white rounded-3xl p-4 shadow-sm border border-border flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 shrink-0 border-2 border-white shadow" />
                  <input
                    type="text"
                    placeholder="Start city (e.g. Nashville, TN)"
                    value={routeFrom}
                    onChange={(e) => setRouteFrom(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && findStopsAlongRoute()}
                    className="flex-1 bg-slate-50 rounded-xl px-3 py-2.5 text-sm font-medium border border-border focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div className="w-0.5 h-4 bg-slate-200 ml-[5px]" />
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500 shrink-0 border-2 border-white shadow" />
                  <input
                    type="text"
                    placeholder="End city (e.g. Atlanta, GA)"
                    value={routeTo}
                    onChange={(e) => setRouteTo(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && findStopsAlongRoute()}
                    className="flex-1 bg-slate-50 rounded-xl px-3 py-2.5 text-sm font-medium border border-border focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={routeSearching || !routeFrom.trim() || !routeTo.trim()}
                  onClick={findStopsAlongRoute}
                  className="w-full bg-gradient-to-r from-primary to-blue-500 text-white py-3 rounded-xl font-bold text-sm shadow-md shadow-primary/30 flex items-center justify-center gap-2 disabled:opacity-50 mt-1"
                >
                  {routeSearching
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Finding stops...</>
                    : <><Route className="w-4 h-4" /> Find Stops Along Route</>
                  }
                </motion.button>
                {routeError && (
                  <p className="text-sm text-red-500 font-medium text-center">{routeError}</p>
                )}
              </div>

              {/* Results */}
              {routeStops !== null && !routeSearching && (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-base text-foreground">
                      {routeStops.length} stop{routeStops.length !== 1 ? "s" : ""} within 15 miles
                    </h3>
                    <button
                      onClick={() => setViewMode("map")}
                      className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full"
                    >
                      View on Map
                    </button>
                  </div>

                  {/* Highway filter chips derived from route stops */}
                  {(() => {
                    const highways = [...new Set(routeStops.map((s) => s.highway).filter(Boolean) as string[])].sort();
                    if (highways.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-muted-foreground font-medium self-center">Filter by highway:</span>
                        {highways.map((hw) => (
                          <button
                            key={hw}
                            onClick={() => setFilterHighway(filterHighway === hw ? "" : hw)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                              filterHighway === hw
                                ? "bg-primary text-white border-primary shadow-sm"
                                : "bg-white text-slate-700 border-slate-200 hover:border-primary/40"
                            }`}
                          >
                            🛣️ {hw}
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  {routeStops.length === 0 ? (
                    <div className="text-center py-12 flex flex-col items-center gap-3">
                      <div className="text-5xl grayscale opacity-40">🌵</div>
                      <p className="font-display font-bold text-foreground">No stops along this route</p>
                      <p className="text-muted-foreground text-sm">Be the first to add one!</p>
                      <Link href="/add-stop">
                        <motion.div whileTap={{ scale: 0.97 }} className="bg-primary text-white px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2">
                          <Plus className="w-4 h-4" /> Add a Stop
                        </motion.div>
                      </Link>
                    </div>
                  ) : (
                    routeStops.map((stop) => (
                      <Link key={stop.id} href={`/stop/${stop.id}`}>
                        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50 hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98]">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-display font-bold text-base text-foreground leading-tight flex-1 pr-2">{stop.name}</h3>
                            <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 flex flex-col items-center shrink-0">
                              <span className="text-sm font-bold text-foreground">{stop.overallRating?.toFixed(1) || "—"}</span>
                              <span className="text-[10px] text-muted-foreground">{stop.totalRatings} rev</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{stop.type.replace("_", " ")}</p>
                            {stop.highway && (
                              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">🛣️ {stop.highway}</span>
                            )}
                          </div>
                          <p className="text-sm text-foreground/70 truncate">{stop.address}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </>
              )}

              {/* Hint when no search yet */}
              {routeStops === null && !routeSearching && !routeError && (
                <div className="text-center py-12 flex flex-col items-center gap-3 text-muted-foreground">
                  <Route className="w-12 h-12 opacity-20" />
                  <p className="font-medium text-sm">Enter a start and end city above to find restrooms, rest areas, and gas stations along your route.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* TOP STOPS LEADERBOARD */}
          {viewMode === "top" && (
            <motion.div
              key="top"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0 bg-background overflow-y-auto pt-24 pb-8 px-4 flex flex-col gap-6"
            >
              <div className="flex items-center justify-center pt-1">
                <span className="text-[11px] font-bold text-muted-foreground/60 tracking-wide">
                  🇺🇸 America's Road Trip Bathroom Rater
                </span>
              </div>

              {/* Royal Flush Top 5 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">👑</span>
                  <div>
                    <h2 className="font-display font-black text-lg text-foreground leading-tight">
                      Royal Flush
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Top 5 highest rated stops nationwide
                    </p>
                  </div>
                </div>

                {royalFlushStops.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center text-sm text-amber-700 font-medium">
                    No royalty yet — be the first to rate! 🚽
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {royalFlushStops.map((stop, idx) => (
                      <Link key={stop.id} href={`/stop/${stop.id}`}>
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/60 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-all active:scale-[0.98]"
                        >
                          <div className="w-8 h-8 rounded-full bg-amber-400 text-white flex items-center justify-center font-display font-black text-sm shrink-0 shadow-sm">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-display font-bold text-foreground text-base leading-tight truncate">
                              {stop.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {stop.address}
                            </div>
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            <div className="font-display font-black text-amber-600 text-xl leading-none">
                              {stop.overallRating?.toFixed(1)}
                            </div>
                            <FlushRating
                              rating={stop.overallRating}
                              size="sm"
                              showNumber={false}
                            />
                          </div>
                        </motion.div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Biohazard Bottom 5 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">☣️</span>
                  <div>
                    <h2 className="font-display font-black text-lg text-foreground leading-tight">
                      Biohazard Zone
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Proceed with extreme caution
                    </p>
                  </div>
                </div>

                {biohazardStops.length === 0 ? (
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center text-sm text-red-700 font-medium">
                    No horror stories yet — give it time. ☣️
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {biohazardStops.map((stop, idx) => (
                      <Link key={stop.id} href={`/stop/${stop.id}`}>
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/60 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-all active:scale-[0.98]"
                        >
                          <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-display font-black text-sm shrink-0 shadow-sm">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-display font-bold text-foreground text-base leading-tight truncate">
                              {stop.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {stop.address}
                            </div>
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            <div className="font-display font-black text-red-600 text-xl leading-none">
                              {stop.overallRating?.toFixed(1)}
                            </div>
                            <FlushRating
                              rating={stop.overallRating}
                              size="sm"
                              showNumber={false}
                            />
                          </div>
                        </motion.div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Add stop CTA */}
              <Link href="/add-stop">
                <div className="bg-primary/5 border-2 border-dashed border-primary/30 rounded-2xl p-4 text-center hover:bg-primary/10 transition-all active:scale-[0.98]">
                  <div className="text-2xl mb-1">🚽</div>
                  <div className="font-display font-bold text-primary text-sm">
                    Know a stop that's missing?
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Add it to the map
                  </div>
                </div>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
