import { motion } from "framer-motion";

// Custom SVG toilet icon — used in interactive mode so it can be colored blue/gray
function ToiletIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 22 28"
      fill="currentColor"
      className={`${filled ? "text-blue-500" : "text-slate-200"} transition-colors duration-100 ${className ?? ""}`}
    >
      {/* Tank */}
      <rect x="5" y="0.5" width="12" height="9" rx="2" />
      {/* Seat connector — slightly wider than tank */}
      <path d="M3 9.5 L3 12.5 Q11 11 19 12.5 L19 9.5Z" />
      {/* Bowl */}
      <path d="M3 12.5 Q0.5 22 11 24.5 Q21.5 22 19 12.5 Q11 14.5 3 12.5Z" />
    </svg>
  );
}

interface FlushRatingProps {
  rating: number | null;
  size?: "sm" | "md" | "lg" | "xl";
  interactive?: boolean;
  onChange?: (rating: number) => void;
  showNumber?: boolean;
}

export function FlushRating({
  rating,
  size = "md",
  interactive = false,
  onChange,
  showNumber = true,
}: FlushRatingProps) {
  const emojiSizes = { sm: "text-base", md: "text-2xl", lg: "text-3xl", xl: "text-5xl" };
  const iconSizes  = { sm: "w-4 h-[1.3rem]", md: "w-6 h-[1.85rem]", lg: "w-8 h-10", xl: "w-12 h-[3.7rem]" };
  const gaps       = { sm: "gap-0.5", md: "gap-1", lg: "gap-1.5", xl: "gap-2" };

  const safeRating   = rating === null ? 0 : rating;
  const filledCount  = Math.floor(safeRating);
  const hasHalf      = safeRating - filledCount >= 0.4 && safeRating - filledCount < 0.9;

  return (
    <div className={`flex items-center ${gaps[size]}`}>
      {[1, 2, 3, 4, 5].map((slot) => {
        const isFilled = slot <= filledCount;
        const isHalf   = !isFilled && slot === filledCount + 1 && hasHalf && !interactive;

        if (interactive) {
          // Interactive mode: colored SVG toilet icons
          const isSelected = slot <= (rating ?? 0);
          return (
            <motion.button
              key={slot}
              type="button"
              onClick={() => onChange?.(slot)}
              whileHover={{ scale: 1.25, y: -2 }}
              whileTap={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="cursor-pointer select-none focus:outline-none"
              aria-label={`Rate ${slot} flushes`}
            >
              <ToiletIcon
                filled={isSelected}
                className={`${iconSizes[size]} ${isSelected ? "drop-shadow-md" : ""}`}
              />
            </motion.button>
          );
        }

        // Display mode: emoji with opacity
        return (
          <motion.button
            key={slot}
            type="button"
            disabled
            className={[
              emojiSizes[size],
              "cursor-default select-none leading-none transition-all duration-150",
              isFilled   ? "opacity-100 drop-shadow-sm" : "",
              isHalf     ? "opacity-60" : "",
              !isFilled && !isHalf ? "opacity-20 grayscale" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={`${slot} flush rating`}
          >
            🚽
          </motion.button>
        );
      })}

      {/* Display-mode score number */}
      {!interactive && showNumber && rating !== null && (
        <span
          className={`ml-1.5 font-bold font-display leading-none ${
            size === "sm"
              ? "text-sm text-foreground/70"
              : size === "md"
              ? "text-base text-foreground/80"
              : "text-lg text-foreground"
          }`}
        >
          {rating.toFixed(1)}
        </span>
      )}
      {!interactive && showNumber && rating === null && (
        <span className="ml-1.5 text-xs font-medium text-muted-foreground">
          No ratings yet
        </span>
      )}
    </div>
  );
}
