import { motion } from "framer-motion";

const BLUE = "#3B9EE8";
const GRAY = "#94A3B8";

function ToiletIcon({ color, className }: { color: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 22 28"
      fill={color}
      className={`transition-colors duration-100 ${className ?? ""}`}
    >
      <rect x="5" y="0.5" width="12" height="9" rx="2" />
      <path d="M3 9.5 L3 12.5 Q11 11 19 12.5 L19 9.5Z" />
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
  const iconSizes = {
    sm:  "w-[18px] h-[23px]",
    md:  "w-6 h-[1.85rem]",
    lg:  "w-7 h-9",
    xl:  "w-12 h-[3.7rem]",
  };
  const gaps = { sm: "gap-0.5", md: "gap-1", lg: "gap-1.5", xl: "gap-2" };

  const safeRating  = rating === null ? 0 : rating;
  const filledCount = Math.floor(safeRating);
  const hasHalf     = safeRating - filledCount >= 0.4 && safeRating - filledCount < 0.9;

  return (
    <div className={`flex items-center ${gaps[size]}`}>
      {[1, 2, 3, 4, 5].map((slot) => {
        const isFilled = slot <= filledCount;
        const isHalf   = !isFilled && slot === filledCount + 1 && hasHalf && !interactive;

        if (interactive) {
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
                color={isSelected ? BLUE : GRAY}
                className={`${iconSizes[size]} ${isSelected ? "drop-shadow-md" : ""}`}
              />
            </motion.button>
          );
        }

        // Display mode — SVG toilet, no emoji
        return (
          <span
            key={slot}
            className={isHalf ? "opacity-60" : ""}
            aria-label={`${slot} flush rating`}
          >
            <ToiletIcon
              color={isFilled || isHalf ? BLUE : GRAY}
              className={iconSizes[size]}
            />
          </span>
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
