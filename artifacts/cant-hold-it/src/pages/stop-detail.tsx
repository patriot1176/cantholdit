import { useRoute, Link } from "wouter";
import { useGetStop } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { FlushRating } from "@/components/flush-rating";
import { ArrowLeft, MapPin, ShieldCheck, Sparkles, Wind, Lightbulb, Baby, PenLine, AlertTriangle, Navigation, Share2, CheckCircle, Camera, Loader2, ImageOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { useRef, useState } from "react";

interface StopPhoto { id: number; stopId: number; objectPath: string; url: string; }

export default function StopDetail() {
  const [, params] = useRoute("/stop/:id");
  const id = parseInt(params?.id || "0", 10);
  const queryClient = useQueryClient();

  const { data: stop, isLoading, error } = useGetStop(id, {
    query: { enabled: id > 0 }
  });

  const { data: photos = [] } = useQuery<StopPhoto[]>({
    queryKey: ["photos", id],
    queryFn: async () => {
      const res = await fetch(`/api/stops/${id}/photos`);
      return res.json();
    },
    enabled: id > 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: stop?.name ?? "Can't Hold It",
      text: `Check out ${stop?.name} — rated ${stop?.overallRating?.toFixed(1) ?? "N/A"}/5 on Can't Hold It!`,
      url,
    };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        setShareMsg("Link copied!");
        setTimeout(() => setShareMsg(null), 2000);
      }
    } catch {
      // share cancelled — no-op
    }
  };

  const handlePhotoUpload = async (file: File) => {
    setUploading(true);
    try {
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      const { uploadURL, objectPath } = await urlRes.json();
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await fetch(`/api/stops/${id}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectPath }),
      });
      queryClient.invalidateQueries({ queryKey: ["photos", id] });
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center animate-pulse">
          <div className="text-6xl mb-4">🧻</div>
          <h2 className="font-display text-2xl font-bold">Unrolling details...</h2>
        </div>
      </Layout>
    );
  }

  if (error || !stop) {
    return (
      <Layout>
        <div className="absolute inset-0 overflow-y-auto p-4">
          <Link href="/" className="inline-flex items-center text-primary font-bold hover:underline mb-8">
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
  const isVerified = stop.totalRatings >= 10;

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
      <div
        className="absolute inset-0 overflow-y-auto"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" } as React.CSSProperties}
      >
        {/* Stop header */}
        <div className="bg-gradient-to-b from-primary/10 to-background pb-6 pt-4 px-4 border-b border-border/50">
          {/* Top row: back + share */}
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="inline-flex items-center text-primary font-bold text-sm bg-white/80 px-3 py-1.5 rounded-full shadow-sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Map
            </Link>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 text-primary font-bold text-sm bg-white/80 px-3 py-1.5 rounded-full shadow-sm hover:bg-white active:scale-95 transition-all"
            >
              {shareMsg
                ? <><CheckCircle className="w-4 h-4 text-green-500" /> {shareMsg}</>
                : <><Share2 className="w-4 h-4" /> Share</>
              }
            </button>
          </div>

          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              {/* Name + verified badge */}
              <div className="flex items-start gap-2">
                <h1 className="font-display text-2xl font-bold text-foreground leading-tight">
                  {stop.name}
                </h1>
                {isVerified && (
                  <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-1" title="Verified — 10+ community ratings" />
                )}
              </div>

              <div className="flex items-center mt-2 text-muted-foreground text-sm">
                <MapPin className="w-4 h-4 mr-1 shrink-0" />
                <span className="truncate">{stop.address}</span>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="px-2.5 py-1 bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-md">
                  {stop.type.replace("_", " ")}
                </span>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary text-white text-[11px] font-bold rounded-full shadow-sm shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all"
                >
                  <Navigation className="w-3 h-3" />
                  Get Directions
                </a>
              </div>
            </div>

            <div className="flex flex-col items-end shrink-0">
              <div className="bg-white p-2.5 rounded-2xl shadow-lg border border-border text-center min-w-[72px]">
                <div className="font-display font-black text-foreground text-2xl leading-none mb-1">
                  {stop.overallRating ? stop.overallRating.toFixed(1) : "—"}
                </div>
                <FlushRating rating={stop.overallRating} size="sm" showNumber={false} />
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5">
                  {stop.totalRatings} {stop.totalRatings === 1 ? "rating" : "ratings"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Body content */}
        <div className="p-4 flex flex-col gap-6 pb-12">

          {/* Badges */}
          {(badges.length > 0 || isVerified) && (
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
              {isVerified && (
                <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-xl font-bold text-sm border border-primary/20 shadow-sm">
                  <CheckCircle className="w-4 h-4" /> Community Verified
                </div>
              )}
              {badges.map(b => !["royal_flush", "biohazard"].includes(b) && (
                <div key={b} className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-xl font-bold text-sm border border-blue-100 shadow-sm">
                  🏆 {b.replace("_", " ")}
                </div>
              ))}
            </div>
          )}

          {/* Photo gallery */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-lg">Photos</h3>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 active:scale-95 transition-all disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                {uploading ? "Uploading..." : "Add Photo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }}
              />
            </div>

            {photos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
                <ImageOff className="w-8 h-8 opacity-30" />
                <p className="text-sm font-medium">No photos yet — be the first!</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {photos.map((photo) => (
                  <img
                    key={photo.id}
                    src={photo.url}
                    alt="Restroom photo"
                    className="h-32 w-32 rounded-2xl object-cover shrink-0 border border-border"
                  />
                ))}
              </div>
            )}
          </div>

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
          <div>
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
