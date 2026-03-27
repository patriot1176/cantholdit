import { useRoute, Link } from "wouter";
import { useGetStop } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { FlushRating } from "@/components/flush-rating";
import { ArrowLeft, MapPin, ShieldCheck, Sparkles, Wind, Lightbulb, Baby, PenLine, AlertTriangle, Navigation, Share2, CheckCircle, Camera, Loader2, ImageOff, Flag, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";

interface StopPhoto { id: number; stopId: number; objectPath: string; url: string; }

const ALL_AMENITIES = [
  "♿ Accessible", "👶 Baby Changing", "🚿 Shower", "🐕 Pet-Friendly",
  "☕ Vending", "🅿️ Parking", "🌳 Picnic Area", "⛽ Gas Station",
  "🍔 Food Nearby", "💦 Water Fountain", "🔌 EV Charging", "🛏️ Rest Area",
];

const REPORT_TYPES = [
  { value: "permanently_closed", label: "Permanently closed" },
  { value: "temporarily_closed", label: "Temporarily closed" },
  { value: "wrong_location", label: "Wrong location" },
  { value: "wrong_info", label: "Incorrect info" },
  { value: "other", label: "Other problem" },
];

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

  interface ReportSummary { total: number; countByType: Record<string, number>; topType: string | null; }
  const { data: reportSummary, refetch: refetchReports } = useQuery<ReportSummary>({
    queryKey: ["reports", id],
    queryFn: async () => {
      const res = await fetch(`/api/stops/${id}/reports`);
      return res.json();
    },
    enabled: id > 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  // Amenities local state (optimistic)
  const [localAmenities, setLocalAmenities] = useState<string[] | null>(null);
  const [amenitySaving, setAmenitySaving] = useState(false);
  const amenities = localAmenities ?? stop?.amenities ?? [];

  // Report modal
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState("permanently_closed");
  const [reportComment, setReportComment] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Save stop to sessionStorage for quick-rate prompt on home screen
  useEffect(() => {
    if (stop && id > 0) {
      try {
        sessionStorage.setItem("cantholdit_pending_rate", JSON.stringify({ id: stop.id, name: stop.name }));
      } catch { /* ignore */ }
    }
  }, [stop, id]);

  const toggleAmenity = async (amenity: string) => {
    if (!stop) return;
    const current = amenities;
    const next = current.includes(amenity)
      ? current.filter((a) => a !== amenity)
      : [...current, amenity];
    setLocalAmenities(next);
    setAmenitySaving(true);
    try {
      await fetch(`/api/stops/${stop.id}/amenities`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amenities: next }),
      });
      queryClient.invalidateQueries({ queryKey: ["stops", stop.id] });
    } catch { /* revert on failure */ setLocalAmenities(current); }
    setAmenitySaving(false);
  };

  const submitReport = async () => {
    setReportSubmitting(true);
    try {
      await fetch(`/api/stops/${id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType, comment: reportComment.trim() || undefined }),
      });
      setReportSuccess(true);
      refetchReports();
      setTimeout(() => { setShowReport(false); setReportSuccess(false); setReportComment(""); }, 2000);
    } catch { /* no-op */ }
    setReportSubmitting(false);
  };

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
          {/* Top row: back + actions */}
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="inline-flex items-center text-primary font-bold text-sm bg-white/80 px-3 py-1.5 rounded-full shadow-sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Map
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowReport(true)}
                className="inline-flex items-center gap-1.5 text-red-500 font-bold text-sm bg-white/80 px-3 py-1.5 rounded-full shadow-sm hover:bg-white active:scale-95 transition-all"
                aria-label="Report a problem"
              >
                <Flag className="w-3.5 h-3.5" /> Report
              </button>
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
                {stop.highway && (
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded-full">🛣️ {stop.highway}</span>
                )}
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

        {/* Report warning banner */}
        {reportSummary && reportSummary.total > 0 && (() => {
          const t = reportSummary.topType;
          const n = reportSummary.total;
          const isPermanent = t === "permanently_closed";
          const isTemp = t === "temporarily_closed";
          const label = isPermanent
            ? "Reported permanently closed"
            : isTemp
            ? "Reported temporarily closed"
            : t === "wrong_location"
            ? "Location may be incorrect"
            : t === "wrong_info"
            ? "Info may be inaccurate"
            : "Problem reported";
          return (
            <div className={`mx-4 mt-3 flex items-start gap-2.5 rounded-2xl px-4 py-3 border ${isPermanent ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
              <span className="text-lg leading-none mt-0.5">{isPermanent ? "🚫" : "⚠️"}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-tight">{label}</p>
                <p className="text-xs opacity-80 mt-0.5">
                  {n === 1 ? "1 community report" : `${n} community reports`} · Awaiting moderation
                </p>
              </div>
            </div>
          );
        })()}

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

          {/* Amenities */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-lg">Amenities</h3>
              {amenitySaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground mb-3">Tap to confirm or add what's here</p>
            <div className="flex flex-wrap gap-2">
              {ALL_AMENITIES.map((a) => {
                const active = amenities.includes(a);
                return (
                  <button
                    key={a}
                    onClick={() => toggleAmenity(a)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                      active
                        ? "bg-primary text-white border-primary shadow-sm shadow-primary/30"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:border-primary/50"
                    }`}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
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

      {/* Report Problem Modal */}
      <AnimatePresence>
        {showReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] bg-black/50 flex items-end justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) setShowReport(false); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-white w-full max-w-lg rounded-t-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-xl font-bold text-red-600 flex items-center gap-2">
                  <Flag className="w-5 h-5" /> Report a Problem
                </h2>
                <button onClick={() => setShowReport(false)} className="p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              {reportSuccess ? (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="text-5xl">✅</div>
                  <p className="font-display text-lg font-bold text-foreground">Thanks for the heads up!</p>
                  <p className="text-muted-foreground text-sm text-center">Our community moderators will review this report.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2 mb-4">
                    {REPORT_TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setReportType(t.value)}
                        className={`w-full text-left px-4 py-3 rounded-xl border font-medium text-sm transition-all ${
                          reportType === t.value
                            ? "border-red-400 bg-red-50 text-red-700"
                            : "border-border bg-slate-50 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reportComment}
                    onChange={(e) => setReportComment(e.target.value)}
                    placeholder="Optional: add more details..."
                    rows={3}
                    className="w-full border border-border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400/50 mb-4"
                  />
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    disabled={reportSubmitting}
                    onClick={submitReport}
                    className="w-full bg-red-500 text-white py-3.5 rounded-xl font-bold text-base disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {reportSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                    {reportSubmitting ? "Submitting..." : "Submit Report"}
                  </motion.button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
