import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BADGES, POINTS, getLevel, LevelInfo } from "@/lib/gamification";

export interface UserProfile {
  userId: string;
  points: number;
  ratingsSubmitted: number;
  stopsAdded: number;
  photosUploaded: number;
  badges: string[];
  ratedStopIds: number[];
  addedStopIds: number[];
  highwaysRated: string[];
  firstSeen: string;
}

interface ToastItem {
  id: number;
  points: number;
  newBadge?: string;
}

interface ProfileContextValue {
  profile: UserProfile;
  level: LevelInfo;
  awardRating: (stopId: number, highway?: string | null) => void;
  awardStop: (stopId?: number) => void;
  awardPhoto: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const STORAGE_KEY = "cantholdit_profile_v1";

function generateId(): string {
  try { return crypto.randomUUID(); } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as UserProfile;
  } catch { /* no-op */ }
  return {
    userId: generateId(),
    points: 0,
    ratingsSubmitted: 0,
    stopsAdded: 0,
    photosUploaded: 0,
    badges: [],
    ratedStopIds: [],
    addedStopIds: [],
    highwaysRated: [],
    firstSeen: new Date().toISOString(),
  };
}

function saveProfile(p: UserProfile) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* no-op */ }
}

function computeNewBadges(p: UserProfile): string[] {
  const earned: string[] = [];
  const check = (id: string, cond: boolean) => {
    if (cond && !p.badges.includes(id)) earned.push(id);
  };
  check("first_flush",      p.ratingsSubmitted >= 1);
  check("road_tripper",     p.ratingsSubmitted >= 5);
  check("highway_hero",     p.ratingsSubmitted >= 10);
  check("road_legend",      p.ratingsSubmitted >= 25);
  check("stop_pioneer",     p.stopsAdded >= 1);
  check("map_maker",        p.stopsAdded >= 5);
  check("shutterbug",       p.photosUploaded >= 1);
  check("highway_explorer", p.highwaysRated.length >= 2);
  return earned;
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastCounter = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((points: number, newBadge?: string) => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, points, newBadge }]);
    setTimeout(() => removeToast(id), 2800);
  }, [removeToast]);

  const applyUpdate = useCallback((
    updater: (p: UserProfile) => UserProfile,
    pts: number,
  ) => {
    setProfile((prev) => {
      const updated = updater(prev);
      const newBadgeIds = computeNewBadges(updated);
      const final = { ...updated, badges: [...updated.badges, ...newBadgeIds] };
      saveProfile(final);
      const badgeName = newBadgeIds.length > 0
        ? BADGES.find((b) => b.id === newBadgeIds[0])?.name
        : undefined;
      setTimeout(() => pushToast(pts, badgeName), 0);
      return final;
    });
  }, [pushToast]);

  const awardRating = useCallback((stopId: number, highway?: string | null) => {
    applyUpdate((p) => ({
      ...p,
      points: p.points + POINTS.RATING,
      ratingsSubmitted: p.ratingsSubmitted + 1,
      ratedStopIds: p.ratedStopIds.includes(stopId)
        ? p.ratedStopIds
        : [...p.ratedStopIds, stopId],
      highwaysRated: highway && !p.highwaysRated.includes(highway)
        ? [...p.highwaysRated, highway]
        : p.highwaysRated,
    }), POINTS.RATING);
  }, [applyUpdate]);

  const awardStop = useCallback((stopId?: number) => {
    applyUpdate((p) => ({
      ...p,
      points: p.points + POINTS.ADD_STOP,
      stopsAdded: p.stopsAdded + 1,
      addedStopIds: stopId != null ? [...p.addedStopIds, stopId] : p.addedStopIds,
    }), POINTS.ADD_STOP);
  }, [applyUpdate]);

  const awardPhoto = useCallback(() => {
    applyUpdate((p) => ({
      ...p,
      points: p.points + POINTS.PHOTO,
      photosUploaded: p.photosUploaded + 1,
    }), POINTS.PHOTO);
  }, [applyUpdate]);

  const level = getLevel(profile.points);

  return (
    <ProfileContext.Provider value={{ profile, level, awardRating, awardStop, awardPhoto }}>
      {children}
      <div
        className="fixed bottom-24 inset-x-0 flex flex-col items-center gap-2 z-[9999] pointer-events-none"
        style={{ maxWidth: "28rem", margin: "0 auto" }}
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 24, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
              className="bg-white border border-primary/25 shadow-2xl shadow-primary/10 rounded-2xl px-5 py-3 flex flex-col items-center gap-0.5"
            >
              <span className="text-primary font-black text-lg leading-none">
                +{toast.points} pts ✨
              </span>
              {toast.newBadge && (
                <span className="text-xs font-semibold text-orange-500 mt-0.5">
                  🏅 Badge unlocked: {toast.newBadge}!
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
