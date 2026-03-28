export interface Level {
  min: number;
  name: string;
  emoji: string;
  color: string;
}

export const LEVELS: Level[] = [
  { min: 0,   name: "Road Rookie",       emoji: "🚗", color: "slate"  },
  { min: 15,  name: "Pit Stop Pro",      emoji: "🚽", color: "blue"   },
  { min: 40,  name: "Highway Hero",      emoji: "🛣️", color: "green"  },
  { min: 80,  name: "Road Warrior",      emoji: "⚔️", color: "orange" },
  { min: 150, name: "Rest Stop Legend",  emoji: "👑", color: "yellow" },
];

export interface LevelInfo extends Level {
  next: Level | null;
  progress: number;
  index: number;
}

export function getLevel(points: number): LevelInfo {
  let level = LEVELS[0];
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (points >= LEVELS[i].min) { level = LEVELS[i]; idx = i; }
  }
  const next = idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
  const progress = next
    ? Math.min(1, (points - level.min) / (next.min - level.min))
    : 1;
  return { ...level, next, progress, index: idx };
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  desc: string;
}

export const BADGES: Badge[] = [
  { id: "first_flush",      name: "First Flush",       emoji: "🚽", desc: "Submitted your first rating"         },
  { id: "road_tripper",     name: "Road Tripper",      emoji: "🗺️", desc: "Rated 5 stops"                       },
  { id: "highway_hero",     name: "Highway Hero",      emoji: "🏆", desc: "Rated 10 stops"                      },
  { id: "road_legend",      name: "Road Legend",       emoji: "👑", desc: "Rated 25 stops"                      },
  { id: "stop_pioneer",     name: "Stop Pioneer",      emoji: "📍", desc: "Added your first stop to the map"    },
  { id: "map_maker",        name: "Map Maker",         emoji: "🗺️", desc: "Added 5 stops to the map"            },
  { id: "shutterbug",       name: "Shutterbug",        emoji: "📸", desc: "Uploaded your first photo"           },
  { id: "highway_explorer", name: "Highway Explorer",  emoji: "🛣️", desc: "Rated stops on 2+ different highways"},
];

export const POINTS = {
  RATING:   3,
  ADD_STOP: 5,
  PHOTO:    2,
} as const;

export interface StopTier {
  label: string;
  emoji: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export function getStopTier(
  overallRating: number | null | undefined,
  totalRatings: number,
): StopTier | null {
  if (!overallRating || totalRatings === 0) return null;
  if (totalRatings >= 10 && overallRating >= 4.5)
    return { label: "Road Trip Essential", emoji: "🏆", bgColor: "bg-amber-50", textColor: "text-amber-700", borderColor: "border-amber-200" };
  if (totalRatings >= 5 && overallRating >= 4.0)
    return { label: "Community Favorite",  emoji: "❤️", bgColor: "bg-rose-50",   textColor: "text-rose-700",   borderColor: "border-rose-200"   };
  if (totalRatings >= 1 && totalRatings <= 3 && overallRating >= 4.0)
    return { label: "Hidden Gem",          emoji: "💎", bgColor: "bg-blue-50",   textColor: "text-blue-700",   borderColor: "border-blue-200"   };
  if (totalRatings >= 3 && overallRating < 2.5)
    return { label: "Proceed with Caution",emoji: "⚠️", bgColor: "bg-orange-50", textColor: "text-orange-700", borderColor: "border-orange-200" };
  return null;
}
