import { useState } from "react";
import { Layout } from "@/components/layout";
import { MapView } from "@/components/map-view";
import { useLocation } from "@/hooks/use-location";
import { useGetStops } from "@workspace/api-client-react";
import { Search, Loader2, Map as MapIcon, List, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { FlushRating } from "@/components/flush-rating";

export default function Home() {
  const { location } = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"map" | "list">("map");

  const { data: stops, isLoading } = useGetStops(
    { 
      lat: location?.lat, 
      lng: location?.lng, 
      query: searchQuery || undefined 
    },
    { query: { keepPreviousData: true } }
  );

  return (
    <Layout>
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
        <div className="flex-1 bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg shadow-black/5 border border-white/50 flex items-center px-4 py-3 focus-within:ring-2 focus-within:ring-primary/50 transition-all">
          <Search className="w-5 h-5 text-muted-foreground mr-3" />
          <input
            type="text"
            placeholder="Search stops, cities..."
            className="flex-1 bg-transparent border-none outline-none font-medium placeholder:text-muted-foreground"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setViewMode(v => v === "map" ? "list" : "map")}
          className="bg-white/90 backdrop-blur-xl rounded-2xl p-3 shadow-lg shadow-black/5 border border-white/50 text-foreground hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center aspect-square"
        >
          {viewMode === "map" ? <List className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />}
        </button>
      </div>

      {/* Floating Add Stop button */}
      <Link href="/add-stop">
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="absolute bottom-6 left-4 z-[400] bg-primary text-white w-14 h-14 rounded-full shadow-xl shadow-primary/40 flex items-center justify-center border-2 border-white"
          aria-label="Add a new stop"
        >
          <Plus className="w-7 h-7" />
        </motion.button>
      </Link>

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
          {viewMode === "map" ? (
            <motion.div 
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              <MapView stops={stops || []} userLocation={location} />
            </motion.div>
          ) : (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0 bg-background overflow-y-auto pt-24 pb-8 px-4 flex flex-col gap-4"
            >
              {stops?.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-6xl mb-4 grayscale opacity-50">🌵</div>
                  <h3 className="font-display text-xl font-bold text-foreground">No stops found</h3>
                  <p className="text-muted-foreground mt-2">Your bladder will have to wait.</p>
                </div>
              ) : (
                stops?.map(stop => (
                  <Link key={stop.id} href={`/stop/${stop.id}`}>
                    <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50 hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98]">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-display font-bold text-lg text-foreground leading-tight">{stop.name}</h3>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">
                            {stop.type.replace('_', ' ')}
                          </p>
                        </div>
                        <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 flex flex-col items-center">
                          <span className="text-sm font-bold text-foreground">{stop.overallRating?.toFixed(1) || '-'}</span>
                          <span className="text-[10px] text-muted-foreground">{stop.totalRatings} rev</span>
                        </div>
                      </div>
                      <p className="text-sm text-foreground/70 truncate mb-4">{stop.address}</p>
                      <div className="flex gap-2 flex-wrap">
                        {stop.badges.map(badge => (
                          <span key={badge} className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-md uppercase tracking-wider">
                            {badge.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
