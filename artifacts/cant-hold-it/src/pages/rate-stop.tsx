import { useRoute, useLocation as useWouterLocation, Link } from "wouter";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetStop, useCreateRating, getGetStopQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { FlushRating } from "@/components/flush-rating";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useProfile } from "@/contexts/profile-context";

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
  const { awardRating } = useProfile();

  const { data: stop } = useGetStop(id, {
    query: { enabled: id > 0 }
  });

  const createRating = useCreateRating({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetStopQueryKey(id) });
        awardRating(id, stop?.highway ?? null);
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

  const watchedRatings = form.watch([
    "cleanliness", "smell", "paperSupply", "lighting", "safety", "familyFriendly"
  ]);
  const allRated = watchedRatings.every((v) => (v ?? 0) >= 1);

  const onSubmit = (data: RatingFormValues) => {
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
          className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
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
      {/*
        form covers the entire <main> via absolute inset-0, giving it an explicit
        pixel height. Inside: a scrollable div + a pinned submit bar.
        This is the only reliably cross-browser approach on Android & iOS.
      */}
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="absolute inset-0 flex flex-col"
      >
        {/* ── Scrollable area ───────────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto px-4 pt-4 pb-4 flex flex-col gap-6"
          style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" } as React.CSSProperties}
        >
          {/* Back + title */}
          <div>
            <Link
              href={`/stop/${id}`}
              className="inline-flex items-center text-primary font-bold text-sm mb-3"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Link>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Rate your throne
            </h1>
            {stop && (
              <p className="text-sm text-muted-foreground mt-1">at {stop.name}</p>
            )}
          </div>

          <div className="bg-blue-50 text-blue-800 p-4 rounded-2xl font-medium text-sm border border-blue-100">
            Be honest. Future road trippers are counting on you.
          </div>

          {categories.map((cat, i) => (
            <div
              key={cat.key}
              className="bg-white p-5 rounded-3xl shadow-sm border border-border flex flex-col gap-3"
            >
              <div>
                <h3 className="font-display font-bold text-lg text-foreground">{cat.label}</h3>
                <p className="text-xs font-medium text-slate-500">{cat.desc}</p>
                <p className="text-[10px] font-medium mt-0.5 text-slate-400">1 = worst · 5 = best</p>
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
                    <p className={`text-sm font-bold min-h-[1.25rem] transition-colors duration-150 ${
                      field.value >= 4 ? "text-blue-500" :
                      field.value >= 3 ? "text-slate-600" :
                      field.value >= 1 ? "text-red-500" :
                      "text-red-400"
                    }`}>
                      {field.value ? flushLabels[field.value] : "Tap to rate"}
                    </p>
                  </div>
                )}
              />
            </div>
          ))}

          <div className="bg-white p-5 rounded-3xl shadow-sm border border-border">
            <h3 className="font-display font-bold text-lg text-foreground mb-1">Final Thoughts</h3>
            <p className="text-xs text-muted-foreground mb-3">Leave a quick note (optional)</p>
            <textarea
              {...form.register("comment")}
              placeholder="Was there soap? Hand dryers working?"
              className="w-full bg-slate-50 border border-border rounded-2xl p-4 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/70"
            />
          </div>
        </div>

        {/* ── Submit bar — sits below the scroll div, never scrolls away ── */}
        <div className="shrink-0 px-4 py-4 border-t border-border bg-white">
          <motion.button
            type="submit"
            disabled={!allRated || createRating.isPending}
            whileHover={allRated ? { scale: 1.02 } : {}}
            whileTap={allRated ? { scale: 0.98 } : {}}
            className={`w-full text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 text-lg transition-all ${
              allRated
                ? "bg-gradient-to-r from-primary to-blue-500 shadow-lg shadow-primary/30"
                : "bg-slate-300 cursor-not-allowed"
            }`}
          >
            {createRating.isPending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : allRated ? (
              "Submit Rating 🚽"
            ) : (
              "Rate all categories to submit"
            )}
          </motion.button>
        </div>
      </form>
    </Layout>
  );
}
