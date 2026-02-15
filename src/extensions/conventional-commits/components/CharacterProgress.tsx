import { motion } from "framer-motion";
import { cn } from "@/framework/lib/utils";

interface CharacterProgressProps {
  current: number;
  max: number;
  warningThreshold?: number;
}

export function CharacterProgress({
  current,
  max,
  warningThreshold = 10,
}: CharacterProgressProps) {
  const remaining = max - current;
  const percentage = Math.min((current / max) * 100, 100);
  const isOverLimit = remaining < 0;
  const isWarning = remaining >= 0 && remaining <= warningThreshold;

  const getColor = () => {
    if (isOverLimit) return "bg-ctp-red";
    if (isWarning) return "bg-ctp-yellow";
    return "bg-ctp-green";
  };

  const getTextColor = () => {
    if (isOverLimit) return "text-ctp-red";
    if (isWarning) return "text-ctp-yellow";
    return "text-ctp-subtext0";
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-ctp-surface0 rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", getColor())}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      </div>
      <span
        className={cn(
          "text-xs font-mono tabular-nums min-w-12 text-right",
          getTextColor(),
        )}
      >
        {remaining}
      </span>
    </div>
  );
}
