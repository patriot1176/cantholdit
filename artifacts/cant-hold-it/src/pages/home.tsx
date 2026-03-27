import { useState } from "react";
import { Layout } from "@/components/layout";
import { MapView } from "@/components/map-view";
import { useLocation } from "@/hooks/use-location";

import { useGetStops } from "@workspace/api-client-react";
import { Search, Loader2, Map as MapIcon, List, Trophy, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { FlushRating } from "@/components/flush-rating";

type ViewMode = "map" | "list" | "top";

export default function Home() {
  const { location, permission, requestLocation } = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("map");

  const { data: stops, isLoading } = useGetStops(
    {
      lat: location?.lat,
      lng: location?.lng,
      query: searchQuery || undefined,
    },
    { query: { keepPreviousData: true } }
  );

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
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
        <div className="flex-1 bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/5 border border-white/50 flex items-center px-4 py-3 focus-within:ring-2 focus-within:ring-primary/50 transition-all">
          <Search className="w-5 h-5 text-muted-foreground mr-3 shrink-0" />
          <input
            type="text"
            placeholder="Search stops, highways, cities..."
            className="flex-1 bg-transparent border-none outline-none font-medium placeholder:text-muted-foreground text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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

      {/* Floating Add Stop button — left side, above leaderboard FAB */}
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
                locationPermission={permission}
                onRequestLocation={requestLocation}
              />
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
              {/* USA badge */}
              <div className="flex items-center justify-center pt-1">
                <span className="text-[11px] font-bold text-muted-foreground/60 tracking-wide">
                  🇺🇸 America's Road Trip Bathroom Rater
                </span>
              </div>

              {stops?.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-6xl mb-4 grayscale opacity-50">🌵</div>
                  <h3 className="font-display text-xl font-bold text-foreground">
                    No stops found
                  </h3>
                  <p className="text-muted-foreground mt-2">
                    Your bladder will have to wait.
                  </p>
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
              {/* USA badge */}
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
