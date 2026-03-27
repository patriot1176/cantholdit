import { useRoute, useLocation as useWouterLocation, Link } from "wouter";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetStop, useCreateRating, getGetStopQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { FlushRating } from "@/components/flush-rating";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const ratingSchema = z.object({
  cleanliness: z.number().min(1).max(5),
  smell: z.number().min(1).max(5),
  paperSupply: z.number().min(1).max(5),
  lighting: z.number().min(1).max(5),
  safety: z.number().min(1).max(5),
  familyFriendly: z.number().min(1).max(5),
  comment: z.string().max(280).optional().nullable(),
});

type RatingFormValues = z.infer<typeof ratingSchema>;

export default function RateStop() {
  const [, params] = useRoute("/stop/:id/rate");
  const [, setLocation] = useWouterLocation();
  const id = parseInt(params?.id || "0", 10);
  const queryClient = useQueryClient();
  const [isSuccess, setIsSuccess] = useState(false);

  const { data: stop } = useGetStop(id, {
    query: { enabled: id > 0 }
  });

  const createRating = useCreateRating({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetStopQueryKey(id) });
        setIsSuccess(true);
        setTimeout(() => {
          setLocation(`/stop/${id}`);
        }, 2000);
      }
    }
  });

  const form = useForm<RatingFormValues>({
    resolver: zodResolver(ratingSchema),
    defaultValues: {
      cleanliness: 0,
      smell: 0,
      paperSupply: 0,
      lighting: 0,
      safety: 0,
      familyFriendly: 0,
      comment: "",
    }
  });

  const onSubmit = (data: RatingFormValues) => {
    // Ensure no 0s are submitted
    const hasZeros = Object.values(data).some(v => v === 0);
    if (hasZeros) {
      alert("Please rate all categories before flushing!");
      return;
    }
    createRating.mutate({ id, data });
  };

  const categories = [
    { key: "cleanliness" as const, label: "Cleanliness", desc: "Spotless or a biohazard?" },
    { key: "smell" as const, label: "Odor", desc: "Fresh breeze or hold your breath?" },
    { key: "paperSupply" as const, label: "TP Supply", desc: "Fully stocked or single square?" },
    { key: "lighting" as const, label: "Lighting", desc: "Bright or dungeon-esque?" },
    { key: "safety" as const, label: "Safety", desc: "Secure or sketchy?" },
    { key: "familyFriendly" as const, label: "Family Friendly", desc: "Changing tables? Roomy?" },
  ];

  const flushLabels: Record<number, string> = {
    1: "🚨 Abandon hope",
    2: "😬 Only if desperate",
    3: "😐 Gets the job done",
    4: "😊 Pretty solid stop",
    5: "👑 Royal Flush worthy!",
  };

  if (isSuccess) {
    return (
      <Layout>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex flex-col items-center justify-center p-8 text-center"
        >
          <div className="w-24 h-24 bg-success/10 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-12 h-12 text-success" />
          </div>
          <h2 className="font-display text-3xl font-bold text-foreground mb-2">Flushed successfully!</h2>
          <p className="text-muted-foreground">Thanks for contributing to the community.</p>
        </motion.div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-white sticky top-[60px] z-10 px-4 py-4 border-b border-border/50">
        <Link href={`/stop/${id}`} className="inline-flex items-center text-primary font-bold text-sm mb-2">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Link>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Rate your throne
        </h1>
        {stop && <p className="text-sm text-muted-foreground mt-1">at {stop.name}</p>}
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 flex flex-col gap-6 pb-24">
        <div className="bg-blue-50 text-blue-800 p-4 rounded-2xl font-medium text-sm border border-blue-100">
          Be honest. Future road trippers are counting on you.
        </div>

        <div className="flex flex-col gap-8">
          {categories.map((cat, i) => (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              key={cat.key} 
              className="bg-white p-5 rounded-3xl shadow-sm border border-border flex flex-col gap-3"
            >
              <div>
                <h3 className="font-display font-bold text-lg text-foreground">{cat.label}</h3>
                <p className="text-xs font-medium" style={{ color: "#475569" }}>{cat.desc}</p>
                <p className="text-[10px] font-medium mt-0.5" style={{ color: "#475569" }}>1 = worst · 5 = best</p>
              </div>
              <Controller
                name={cat.key}
                control={form.control}
                render={({ field }) => (
                  <div className="flex flex-col items-center gap-2 bg-slate-50 py-4 rounded-2xl">
                    <FlushRating
                      rating={field.value || null}
                      interactive
                      size="lg"
                      onChange={field.onChange}
                    />
                    <div className={`text-sm font-bold min-h-[1.25rem] transition-all duration-150 ${
                      field.value >= 4 ? "text-blue-500" :
                      field.value >= 3 ? "text-foreground/70" :
                      field.value >= 1 ? "text-red-500" :
                      "text-transparent"
                    }`}>
                      {field.value ? flushLabels[field.value] : "tap to rate"}
                    </div>
                  </div>
                )}
              />
            </motion.div>
          ))}
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-sm border border-border">
          <h3 className="font-display font-bold text-lg text-foreground mb-1">Final Thoughts</h3>
          <p className="text-xs text-muted-foreground mb-3">Leave a quick note (optional)</p>
          <textarea 
            {...form.register("comment")}
            placeholder="Was there soap? Hand dryers working?"
            className="w-full bg-slate-50 border border-border rounded-2xl p-4 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/70"
          />
        </div>

        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white/80 backdrop-blur-xl border-t border-border z-50">
          <motion.button 
            type="submit"
            disabled={createRating.isPending}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-gradient-to-r from-primary to-blue-500 disabled:from-slate-400 disabled:to-slate-500 text-white p-4 rounded-2xl font-bold shadow-lg shadow-primary/30 disabled:shadow-none flex items-center justify-center gap-2 text-lg transition-all"
          >
            {createRating.isPending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              "Submit Rating 🚽"
            )}
          </motion.button>
        </div>
      </form>
    </Layout>
  );
}
