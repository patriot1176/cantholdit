import { motion } from "framer-motion";

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
  const sizes = {
    sm: "text-base",
    md: "text-2xl",
    lg: "text-3xl",
    xl: "text-5xl",
  };

  const gaps = {
    sm: "gap-0.5",
    md: "gap-1",
    lg: "gap-1.5",
    xl: "gap-2",
  };

  const safeRating = rating === null ? 0 : rating;
  const filledCount = Math.floor(safeRating);
  const hasHalf = safeRating - filledCount >= 0.4 && safeRating - filledCount < 0.9;

  return (
    <div className={`flex items-center ${gaps[size]}`}>
      {[1, 2, 3, 4, 5].map((slot) => {
        const isFilled = slot <= filledCount;
        const isHalf = !isFilled && slot === filledCount + 1 && hasHalf && !interactive;

        return (
          <motion.button
            key={slot}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(slot)}
            whileHover={interactive ? { scale: 1.2, rotate: [-5, 5, 0] } : {}}
            whileTap={interactive ? { scale: 0.85 } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className={[
              sizes[size],
              interactive ? "cursor-pointer" : "cursor-default",
              "select-none leading-none transition-all duration-150",
              isFilled
                ? "opacity-100 drop-shadow-sm"
                : isHalf
                ? "opacity-60"
                : "opacity-20 grayscale",
              interactive && slot <= filledCount
                ? "scale-110"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={`Rate ${slot} flushes`}
          >
            🚽
          </motion.button>
        );
      })}

      {!interactive && showNumber && rating !== null && (
        <span className={`ml-1.5 font-bold font-display leading-none ${
          size === "sm" ? "text-sm text-foreground/70" :
          size === "md" ? "text-base text-foreground/80" :
          "text-lg text-foreground"
        }`}>
          {rating.toFixed(1)}
        </span>
      )}
      {!interactive && showNumber && rating === null && (
        <span className="ml-1.5 text-xs font-medium text-muted-foreground">No ratings yet</span>
      )}
    </div>
  );
}
