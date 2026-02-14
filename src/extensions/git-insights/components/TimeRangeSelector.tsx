import { motion } from "framer-motion";
import type { TimeRange } from "../types";

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
];

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg bg-ctp-surface0/50 p-0.5"
      role="radiogroup"
      aria-label="Time range"
    >
      {OPTIONS.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={`relative px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              isActive
                ? "text-ctp-base"
                : "text-ctp-subtext0 hover:text-ctp-text"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="time-range-indicator"
                className="absolute inset-0 rounded-md bg-ctp-blue"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
