import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateStop, getGetStopsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { ArrowLeft, Loader2, MapPin, CheckCircle2 } from "lucide-react";
import { Link, useLocation as useWouterLocation } from "wouter";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const stopTypes = [
  { value: "rest_area", label: "🛣️ Rest Area", desc: "State/highway rest area" },
  { value: "gas_station", label: "⛽ Gas Station", desc: "Fuel stop with bathrooms" },
  { value: "fast_food", label: "🍔 Fast Food", desc: "Restaurant bathroom" },
  { value: "truck_stop", label: "🚛 Truck Stop", desc: "Full service truck plaza" },
  { value: "other", label: "🏪 Other", desc: "Park, store, or anywhere else" },
] as const;

const addStopSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  address: z.string().min(5, "Please enter a full address"),
  type: z.enum(["rest_area", "gas_station", "fast_food", "truck_stop", "other"]),
  hours: z.string().optional().nullable(),
});

type AddStopValues = z.infer<typeof addStopSchema>;

export default function AddStop() {
  const [, setLocation] = useWouterLocation();
  const queryClient = useQueryClient();
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

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
    },
  });

  const onSubmit = (data: AddStopValues) => {
    // Geocode not available in MVP, use a default US center location
    // Users can submit without coords — backend defaults are fine for now
    createStop.mutate({
      data: {
        name: data.name,
        address: data.address,
        type: data.type,
        lat: 39.8,
        lng: -98.5,
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
          <span>Adding a stop helps thousands of road trippers find relief. You're a hero.</span>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground/70 tracking-wide">
          <span>🇺🇸</span>
          <span>US locations only for now</span>
        </div>

        {/* Name */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-border flex flex-col gap-2">
          <label className="font-display font-bold text-base text-foreground">
            Stop Name <span className="text-red-500">*</span>
          </label>
          <input
            {...form.register("name")}
            placeholder={`e.g. "Buc-ee's" or "I-80 Rest Area"`}
            className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/60"
          />
          {form.formState.errors.name && (
            <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>

        {/* Address */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-border flex flex-col gap-2">
          <label className="font-display font-bold text-base text-foreground">
            Address <span className="text-red-500">*</span>
          </label>
          <input
            {...form.register("address")}
            placeholder="Street, City, State ZIP"
            className="w-full bg-slate-50 border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/60"
          />
          {form.formState.errors.address && (
            <p className="text-red-500 text-xs mt-1">{form.formState.errors.address.message}</p>
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
            disabled={createStop.isPending}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-gradient-to-r from-primary to-blue-500 disabled:from-slate-400 disabled:to-slate-500 text-white p-4 rounded-2xl font-bold shadow-lg shadow-primary/30 disabled:shadow-none flex items-center justify-center gap-2 text-lg transition-all"
          >
            {createStop.isPending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
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
