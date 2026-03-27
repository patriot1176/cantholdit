import { useRoute, Link } from "wouter";
import { useGetStop } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { FlushRating } from "@/components/flush-rating";
import { ArrowLeft, MapPin, Clock, ShieldCheck, Sparkles, Wind, Lightbulb, Baby, PenLine, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

export default function StopDetail() {
  const [, params] = useRoute("/stop/:id");
  const id = parseInt(params?.id || "0", 10);

  const { data: stop, isLoading, error } = useGetStop(id, {
    query: { enabled: id > 0 }
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-pulse">
          <div className="text-6xl mb-4">🧻</div>
          <h2 className="font-display text-2xl font-bold">Unrolling details...</h2>
        </div>
      </Layout>
    );
  }

  if (error || !stop) {
    return (
      <Layout>
        <div className="p-4">
          <Link href="/" className="inline-flex items-center text-primary font-medium hover:underline mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Map
          </Link>
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="font-display text-2xl font-bold">Stop not found</h2>
            <p className="text-muted-foreground mt-2">Looks like this bathroom vanished.</p>
          </div>
        </div>
      </Layout>
    );
  }

  const badges = stop.badges || [];
  const hasRoyalFlush = badges.includes("royal_flush" as any);
  const hasBiohazard = badges.includes("biohazard" as any);

  const categories = [
    { key: "cleanliness", label: "Cleanliness", icon: Sparkles, value: stop.cleanliness },
    { key: "smell", label: "Odor", icon: Wind, value: stop.smell },
    { key: "paperSupply", label: "TP Supply", icon: ShieldCheck, value: stop.paperSupply },
    { key: "lighting", label: "Lighting", icon: Lightbulb, value: stop.lighting },
    { key: "safety", label: "Safety", icon: ShieldCheck, value: stop.safety },
    { key: "familyFriendly", label: "Family Friendly", icon: Baby, value: stop.familyFriendly },
  ];

  return (
    <Layout>
      <div className="bg-gradient-to-b from-primary/10 to-background pb-6 pt-4 px-4 sticky top-[60px] z-10 backdrop-blur-md border-b border-border/50">
        <Link href="/" className="inline-flex items-center text-primary font-bold text-sm mb-4 bg-white/80 px-3 py-1.5 rounded-full shadow-sm">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Map
        </Link>
        
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold text-foreground leading-tight">
              {stop.name}
            </h1>
            <div className="flex items-center mt-2 text-muted-foreground text-sm">
              <MapPin className="w-4 h-4 mr-1 shrink-0" />
              <span className="truncate">{stop.address}</span>
            </div>
            <span className="inline-block mt-3 px-2.5 py-1 bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-md">
              {stop.type.replace('_', ' ')}
            </span>
          </div>
          
          <div className="flex flex-col items-end shrink-0">
            <div className="bg-white p-2.5 rounded-2xl shadow-lg border border-border text-center min-w-[72px]">
              <div className="font-display font-black text-foreground text-2xl leading-none mb-1">
                {stop.overallRating ? stop.overallRating.toFixed(1) : '—'}
              </div>
              <FlushRating rating={stop.overallRating} size="sm" showNumber={false} />
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5">
                {stop.totalRatings} {stop.totalRatings === 1 ? 'rating' : 'ratings'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
      <div className="p-4 flex flex-col gap-6">
        
        {/* Badges */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {hasRoyalFlush && (
              <div className="flex items-center gap-2 bg-amber-100 text-amber-800 px-3 py-2 rounded-xl font-bold text-sm border border-amber-200 shadow-sm">
                <span>👑</span> Royal Flush
              </div>
            )}
            {hasBiohazard && (
              <div className="flex items-center gap-2 bg-red-100 text-red-800 px-3 py-2 rounded-xl font-bold text-sm border border-red-200 shadow-sm">
                <AlertTriangle className="w-4 h-4" /> Biohazard
              </div>
            )}
            {badges.map(b => !["royal_flush", "biohazard"].includes(b) && (
              <div key={b} className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-xl font-bold text-sm border border-blue-100 shadow-sm">
                🏆 {b.replace('_', ' ')}
              </div>
            ))}
          </div>
        )}

        {/* Categories Grid */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-border">
          <h3 className="font-display font-bold text-lg mb-4">Flush Breakdown</h3>
          <div className="grid grid-cols-2 gap-4">
            {categories.map((cat, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={cat.key} 
                className="flex flex-col gap-1"
              >
                <div className="flex items-center text-muted-foreground text-xs font-bold uppercase tracking-wider">
                  <cat.icon className="w-3.5 h-3.5 mr-1.5" />
                  {cat.label}
                </div>
                <FlushRating rating={cat.value} size="sm" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <Link href={`/stop/${stop.id}/rate`} className="block w-full">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full bg-gradient-to-r from-primary to-blue-500 text-white p-4 rounded-2xl font-bold shadow-lg shadow-primary/30 flex items-center justify-center gap-2 text-lg"
          >
            <PenLine className="w-5 h-5" />
            Drop your 2 cents
          </motion.button>
        </Link>

        {/* Reviews */}
        <div className="mt-2">
          <h3 className="font-display font-bold text-xl mb-4">Recent Deposits</h3>
          {stop.recentRatings && stop.recentRatings.length > 0 ? (
            <div className="flex flex-col gap-4">
              {stop.recentRatings.map((rating) => (
                <div key={rating.id} className="bg-white p-4 rounded-2xl shadow-sm border border-border">
                  <div className="flex justify-between items-start mb-2">
                    <FlushRating rating={rating.overallScore} size="sm" />
                    <span className="text-xs text-muted-foreground font-medium">
                      {formatDistanceToNow(new Date(rating.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  {rating.comment && (
                    <p className="text-foreground/90 mt-2 text-sm leading-relaxed">
                      "{rating.comment}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-border">
              <div className="text-4xl mb-2 grayscale opacity-50">🌬️</div>
              <p className="text-muted-foreground font-medium text-sm">Very quiet in here... be the first to review!</p>
            </div>
          )}
        </div>

      </div>
      </div>
    </Layout>
  );
}
