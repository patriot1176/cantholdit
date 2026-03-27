import { motion } from "framer-motion";

interface FlushRatingProps {
  rating: number | null;
  size?: "sm" | "md" | "lg" | "xl";
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export function FlushRating({ rating, size = "md", interactive = false, onChange }: FlushRatingProps) {
  const sizes = {
    sm: "text-sm",
    md: "text-xl",
    lg: "text-3xl",
    xl: "text-5xl"
  };

  const safeRating = rating === null ? 0 : Math.round(rating);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button
          key={star}
          type={interactive ? "button" : "button"}
          disabled={!interactive}
          onClick={() => interactive && onChange?.(star)}
          whileHover={interactive ? { scale: 1.15, rotate: [0, -10, 10, 0] } : {}}
          whileTap={interactive ? { scale: 0.9 } : {}}
          className={`
            ${sizes[size]} 
            ${interactive ? "cursor-pointer hover:drop-shadow-md" : "cursor-default"}
            transition-all duration-200
            ${star <= safeRating ? "opacity-100 filter-none" : "opacity-30 grayscale saturate-0"}
          `}
        >
          🚽
        </motion.button>
      ))}
      {!interactive && rating !== null && (
        <span className="ml-2 font-bold text-foreground/80 font-display">
          {rating.toFixed(1)}
        </span>
      )}
      {!interactive && rating === null && (
        <span className="ml-2 text-sm font-medium text-muted-foreground">
          No ratings
        </span>
      )}
    </div>
  );
}
