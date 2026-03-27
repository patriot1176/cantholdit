import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateStop, getGetStopsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { ArrowLeft, Loader2, MapPin, CheckCircle2, Search, X } from "lucide-react";
import { Link, useLocation as useWouterLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { readGpsFromSession } from "@/hooks/use-location";

const stopTypes = [
  { value: "rest_area", label: "🛣️ Rest Area", desc: "State/highway rest area" },
  { value: "gas_station", label: "⛽ Gas Station", desc: "Fuel stop with bathrooms" },
  { value: "fast_food", label: "🍔 Fast Food", desc: "Restaurant bathroom" },
  { value: "truck_stop", label: "🚛 Truck Stop", desc: "Full service truck plaza" },
  { value: "other", label: "🏪 Other", desc: "Park, store, or anywhere else" },
] as const;

interface GeoSuggestion {
  lat: number;
  lng: number;
  label: string;
  address: string;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function searchPlaces(
  q: string,
  userLocation?: { lat: number; lng: number } | null
): Promise<GeoSuggestion[]> {
  try {
    // Fetch more results so we have a good pool to sort from
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=12&countrycodes=us&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data: any[] = await res.json();
    const results: (GeoSuggestion & { distKm: number })[] = data.map((r) => {
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      const parts = r.display_name.split(",").map((s: string) => s.trim());
      const shortLabel = parts.slice(0, 3).join(", ");
      const fullAddress = parts.slice(0, 5).join(", ");
      // Compute distance to user (if available) for client-side sorting
      const distKm = userLocation
        ? haversineKm(userLocation.lat, userLocation.lng, lat, lng)
        : Infinity;
      return { lat, lng, label: shortLabel, address: fullAddress, distKm };
    });
    // Sort by distance when we have a GPS fix — closest first
    if (userLocation) results.sort((a, b) => a.distKm - b.distKm);
    return results.slice(0, 6).map(({ lat, lng, label, address }) => ({ lat, lng, label, address }));
  } catch {
    return [];
  }
}

const addStopSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  address: z.string().min(1),
  type: z.enum(["rest_area", "gas_station", "fast_food", "truck_stop", "other"]),
  hours: z.string().optional().nullable(),
  lat: z.number(),
  lng: z.number(),
});

type AddStopValues = z.infer<typeof addStopSchema>;

export default function AddStop() {
  const [, setLocation] = useWouterLocation();
  const queryClient = useQueryClient();
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  // Location search state
  const [locationQuery, setLocationQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<GeoSuggestion | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createStop = useCreateStop({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetStopsQueryKey() });
        setCreatedId(data.id);
        setIsSuccess(true);
      },
    },
  });

  const form = useForm<AddStopValues>({
    resolver: zodResolver(addStopSchema),
    defaultValues: {
      name: "",
      address: "",
      type: "rest_area",
      hours: "",
      lat: 0,
      lng: 0,
    },
  });

  // Debounced Nominatim search as user types
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!locationQuery.trim() || locationQuery.length < 3) {
      setSuggestions([]);
      return;
    }
    debounceTimer.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchPlaces(locationQuery, readGpsFromSession());
      setSuggestions(results);
      setSearching(false);
    }, 400);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [locationQuery]);

  const pickPlace = useCallback((place: GeoSuggestion) => {
    setSelectedPlace(place);
    setLocationQuery(place.label);
    setSuggestions([]);
    form.setValue("address", place.address, { shouldValidate: true });
    form.setValue("lat", place.lat, { shouldValidate: true });
    form.setValue("lng", place.lng, { shouldValidate: true });
    // Auto-fill name if it's empty
    if (!form.getValues("name").trim()) {
      form.setValue("name", place.label.split(",")[0].trim(), { shouldValidate: true });
    }
  }, [form]);

  const clearPlace = () => {
    setSelectedPlace(null);
    setLocationQuery("");
    setSuggestions([]);
    form.setValue("address", "");
    form.setValue("lat", 0);
    form.setValue("lng", 0);
  };

  const onSubmit = (data: AddStopValues) => {
    createStop.mutate({
      data: {
        name: data.name,
        address: data.address,
        type: data.type,
        lat: data.lat,
        lng: data.lng,
        hours: data.hours || null,
      },
    });
  };

  if (isSuccess) {
    return (
      <Layout>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex flex-col items-center justify-center p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
            className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 text-5xl"
          >
            🚽
          </motion.div>
          <h2 className="font-display text-3xl font-bold text-foreground mb-2">
            Stop added!
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xs">
            Thanks for contributing. Be the first to leave a review so future road trippers know what they're getting into.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            {createdId && (
              <Link href={`/stop/${createdId}/rate`}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-to-r from-primary to-blue-500 text-white p-4 rounded-2xl font-bold shadow-lg shadow-primary/30 text-lg"
                >
                  Rate it now 🚽
                </motion.button>
              </Link>
            )}
            <Link href="/">
              <button className="w-full border border-border bg-white text-foreground p-4 rounded-2xl font-bold">
                Back to Map
              </button>
            </Link>
          </div>
        </motion.div>
      </Layout>
    );
  }

  const locationError = form.formState.isSubmitted && !selectedPlace;

  return (
    <Layout>
      <div className="bg-white sticky top-[60px] z-10 px-4 py-4 border-b border-border/50">
        <Link href="/" className="inline-flex items-center text-primary font-bold text-sm mb-2">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Map
        </Link>
        <h1 className="font-display text-2xl font-bold text-foreground">Add a Stop</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Found a spot that's not on the map?</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 flex flex-col gap-5 pb-32">

        <div className="bg-blue-50 text-blue-800 p-4 rounded-2xl font-medium text-sm border border-blue-100 flex items-start gap-2">
          <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Search by name or address — we'll find the exact location for you.</span>
        </div>

        {/* Location Search */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-border flex flex-col gap-2">
          <label className="font-display font-bold text-base text-foreground">
            Find Location <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-muted-foreground -mt-1">
            Type a name like "Pilot Flying J" or "McDonald's I-80" to search
          </p>

          <div className="relative">
            {selectedPlace ? (
              /* Confirmed location pill */
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-green-800 truncate">{selectedPlace.label}</p>
                  <p className="text-xs text-green-600 truncate">{selectedPlace.address}</p>
                </div>
                <button
                  type="button"
                  onClick={clearPlace}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-green-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-green-700" />
                </button>
              </div>
            ) : (
              /* Search input */
              <div className={`flex items-center bg-slate-50 border rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary/50 transition-all ${locationError ? "border-red-400" : "border-border"}`}>
                {searching
                  ? <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0 mr-2" />
                  : <Search className="w-4 h-4 text-muted-foreground shrink-0 mr-2" />
                }
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  placeholder={`e.g. "Pilot", "Buc-ee's", "I-90 Rest Area"`}
                  className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/60"
                />
              </div>
            )}

            {/* Suggestions dropdown */}
            <AnimatePresence>
              {suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-border overflow-hidden z-50"
                >
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickPlace(s)}
                      className="w-full text-left px-4 py-3 hover:bg-primary/5 active:bg-primary/10 border-t border-border/40 first:border-0 transition-colors flex items-start gap-2"
                    >
                      <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{s.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.address}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {locationError && (
            <p className="text-red-500 text-xs">Please search and select a location above</p>
          )}
        </div>

        {/* Name */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-border flex flex-col gap-2">
          <label className="font-display font-bold text-base text-foreground">
            Display Name <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-muted-foreground -mt-1">Auto-filled from location — edit if needed</p>
          <input
            {...form.register("name")}
            placeholder={`e.g. "Buc-ee's Waco" or "I-80 Iowa Rest Area"`}
            className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/60"
          />
          {form.formState.errors.name && (
            <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>

        {/* Type */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-border flex flex-col gap-3">
          <label className="font-display font-bold text-base text-foreground">
            Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 gap-2">
            {stopTypes.map((type) => {
              const selected = form.watch("type") === type.value;
              return (
                <motion.button
                  key={type.value}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => form.setValue("type", type.value)}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all ${
                    selected
                      ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                      : "border-border bg-slate-50 hover:border-primary/40"
                  }`}
                >
                  <span className="text-2xl leading-none">{type.label.split(" ")[0]}</span>
                  <div>
                    <div className={`font-bold text-sm ${selected ? "text-primary" : "text-foreground"}`}>
                      {type.label.split(" ").slice(1).join(" ")}
                    </div>
                    <div className="text-xs text-muted-foreground">{type.desc}</div>
                  </div>
                  {selected && (
                    <CheckCircle2 className="w-5 h-5 text-primary ml-auto shrink-0" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Hours (optional) */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-border flex flex-col gap-2">
          <label className="font-display font-bold text-base text-foreground">
            Hours <span className="text-muted-foreground font-normal text-sm">(optional)</span>
          </label>
          <input
            {...form.register("hours")}
            placeholder='e.g. "24/7" or "6am – 10pm"'
            className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Submit */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white/80 backdrop-blur-xl border-t border-border z-50">
          <motion.button
            type="submit"
            disabled={createStop.isPending || !selectedPlace}
            whileHover={{ scale: selectedPlace ? 1.02 : 1 }}
            whileTap={{ scale: selectedPlace ? 0.98 : 1 }}
            className="w-full bg-gradient-to-r from-primary to-blue-500 disabled:from-slate-400 disabled:to-slate-500 text-white p-4 rounded-2xl font-bold shadow-lg shadow-primary/30 disabled:shadow-none flex items-center justify-center gap-2 text-lg transition-all"
          >
            {createStop.isPending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : !selectedPlace ? (
              <>
                <Search className="w-5 h-5" />
                Search for a location first
              </>
            ) : (
              <>
                <MapPin className="w-5 h-5" />
                Drop a Pin 📍
              </>
            )}
          </motion.button>
        </div>
      </form>
    </Layout>
  );
}
