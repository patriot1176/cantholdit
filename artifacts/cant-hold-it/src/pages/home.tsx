import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { MapView } from "@/components/map-view";
import { useLocation } from "@/hooks/use-location";
import { useGetStops } from "@workspace/api-client-react";
import { Search, Loader2, Map as MapIcon, List, Trophy, Plus, LocateFixed } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { FlushRating } from "@/components/flush-rating";

type ViewMode = "map" | "list" | "top";

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

const RADIUS_KM = 800;

export default function Home() {
  const { location } = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const locateMe = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocateError("GPS not available on this device");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setSearchCenter(coords);
        setSearchQuery("Near me");
        setSuggestions([]);
      },
      () => {
        setLocating(false);
        setLocateError("Location access denied — check your browser settings");
        setTimeout(() => setLocateError(null), 4000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Pick a suggestion: set map center, clear dropdown
  const pickSuggestion = useCallback((r: GeoResult) => {
    setSearchCenter({ lat: r.lat, lng: r.lng });
    setSuggestions([]);
  }, []);

  // Geocode: if 1 result auto-select; if multiple show picker
  const runGeocode = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchCenter(null); setSuggestions([]); return; }
    const results = await geocodeSuggest(q);
    if (results.length === 0) return;
    if (results.length === 1) {
      pickSuggestion(results[0]);
    } else {
      setSuggestions(results);
    }
  }, [pickSuggestion]);

  // Debounce timer ref — cancelled on Enter/button tap so it fires immediately
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear suggestions when query changes
  useEffect(() => {
    setSuggestions([]);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!searchQuery.trim()) { setSearchCenter(null); return; }
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

  // Client-side proximity filter: within 800km of searchCenter; no fallback so empty state shows
  const stops = (() => {
    if (!allStops) return undefined;
    const center = searchCenter;
    if (!center) return allStops;
    return allStops.filter(
      (s) => haversineKm(center.lat, center.lng, s.lat, s.lng) <= RADIUS_KM
    );
  })();

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

  const tabs: { id: ViewMode; icon: typeof MapIcon; label: string }[] = [
    { id: "map", icon: MapIcon, label: "Map" },
    { id: "list", icon: List, label: "List" },
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
              onKeyDown={handleSearchKeyDown}
            />
            <button
              type="button"
              onClick={fireSearch}
              className="ml-2 shrink-0 w-8 h-8 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all shadow-sm shadow-primary/30"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
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
              className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm font-medium text-red-700 flex items-center gap-2"
            >
              <LocateFixed className="w-4 h-4 shrink-0" />
              {locateError}
            </motion.div>
          )}
        </AnimatePresence>

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
                stops={stops || []}
                userLocation={location}
                searchCenter={searchCenter}
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
              className="absolute inset-0 bg-background overflow-y-auto pt-24 pb-28 px-4 flex flex-col gap-4"
            >
              <div className="flex items-center justify-center pt-1">
                <span className="text-[11px] font-bold text-muted-foreground/60 tracking-wide">
                  🇺🇸 America's Road Trip Bathroom Rater
                </span>
              </div>

              {stops?.length === 0 ? (
                <div className="text-center py-16 flex flex-col items-center gap-4">
                  <div className="text-6xl grayscale opacity-50">🌵</div>
                  <div>
                    <h3 className="font-display text-xl font-bold text-foreground">
                      {noStopsNearby ? "No stops here yet" : "No stops found"}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {noStopsNearby
                        ? "Be the first to add one in this area!"
                        : "Your bladder will have to wait."}
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
                stops?.map((stop) => (
                  <Link key={stop.id} href={`/stop/${stop.id}`}>
                    <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50 hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98]">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0 pr-3">
                          <h3 className="font-display font-bold text-lg text-foreground leading-tight">
                            {stop.name}
                          </h3>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">
                            {stop.type.replace("_", " ")}
                          </p>
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
                ))
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
