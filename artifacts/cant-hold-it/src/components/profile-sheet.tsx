import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useProfile } from "@/contexts/profile-context";
import { BADGES, LEVELS } from "@/lib/gamification";

interface ProfileSheetProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileSheet({ open, onClose }: ProfileSheetProps) {
  const { profile, level } = useProfile();

  const levelColors: Record<string, string> = {
    slate:  "from-slate-50 to-slate-100 border-slate-200",
    blue:   "from-blue-50 to-blue-100 border-blue-200",
    green:  "from-green-50 to-green-100 border-green-200",
    orange: "from-orange-50 to-amber-100 border-orange-200",
    yellow: "from-yellow-50 to-amber-100 border-yellow-300",
  };

  const gradient = levelColors[level.color] ?? levelColors.slate;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-[200]"
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-3xl z-[201] max-h-[88vh] flex flex-col"
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-slate-200 rounded-full" />
            </div>

            <div className="flex justify-between items-center px-5 py-3 shrink-0">
              <h2 className="font-display font-bold text-xl">Your Road Profile</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-8 flex flex-col gap-4">
              <div className={`bg-gradient-to-br ${gradient} border rounded-3xl p-5`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-5xl leading-none">{level.emoji}</div>
                  <div>
                    <div className="font-display font-black text-2xl text-foreground leading-none">
                      {level.name}
                    </div>
                    <div className="text-sm text-muted-foreground font-semibold mt-0.5">
                      {profile.points} total points
                    </div>
                  </div>
                </div>

                {level.next ? (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5 font-medium">
                      <span>{level.min} pts</span>
                      <span>{level.next.emoji} {level.next.name} at {level.next.min} pts</span>
                    </div>
                    <div className="h-2.5 bg-white/60 rounded-full overflow-hidden border border-white/80">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${level.progress * 100}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="h-full bg-primary rounded-full"
                      />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 text-right font-medium">
                      {level.next.min - profile.points} pts to go
                    </div>
                  </div>
                ) : (
                  <div className="text-sm font-bold text-amber-600">
                    👑 You've reached the highest level!
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-display font-bold text-base mb-3">Contributions</h3>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-slate-50 rounded-2xl p-3 text-center border border-border/50">
                    <div className="font-black text-2xl text-primary">{profile.ratingsSubmitted}</div>
                    <div className="text-[11px] text-muted-foreground font-semibold">Ratings</div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-3 text-center border border-border/50">
                    <div className="font-black text-2xl text-primary">{profile.stopsAdded}</div>
                    <div className="text-[11px] text-muted-foreground font-semibold">Stops Added</div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-3 text-center border border-border/50">
                    <div className="font-black text-2xl text-primary">{profile.photosUploaded}</div>
                    <div className="text-[11px] text-muted-foreground font-semibold">Photos</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-display font-bold text-base mb-3">
                  Badges
                  <span className="ml-2 text-sm font-semibold text-muted-foreground">
                    {profile.badges.length}/{BADGES.length}
                  </span>
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {BADGES.map((badge) => {
                    const earned = profile.badges.includes(badge.id);
                    return (
                      <div
                        key={badge.id}
                        className={`rounded-2xl p-3.5 border flex items-start gap-3 transition-all ${
                          earned
                            ? "bg-white border-primary/20 shadow-sm"
                            : "bg-slate-50/60 border-slate-100 opacity-50"
                        }`}
                      >
                        <div className="text-2xl shrink-0 leading-none mt-0.5">
                          {badge.emoji}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-foreground leading-tight">
                            {badge.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                            {badge.desc}
                          </div>
                          {!earned && (
                            <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                              Locked
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="font-display font-bold text-base mb-3">Levels</h3>
                <div className="flex flex-col gap-2">
                  {LEVELS.map((l, i) => {
                    const reached = profile.points >= l.min;
                    const isCurrent = level.index === i;
                    return (
                      <div
                        key={l.name}
                        className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
                          isCurrent
                            ? "bg-primary/8 border-primary/25 shadow-sm"
                            : reached
                            ? "bg-white border-border/50"
                            : "bg-slate-50/60 border-slate-100 opacity-50"
                        }`}
                      >
                        <span className="text-xl">{l.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-foreground">{l.name}</div>
                          <div className="text-[11px] text-muted-foreground">{l.min}+ pts</div>
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] font-black text-primary uppercase tracking-wider">
                            Current
                          </span>
                        )}
                        {reached && !isCurrent && (
                          <span className="text-[10px] font-black text-green-600 uppercase tracking-wider">
                            ✓
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
