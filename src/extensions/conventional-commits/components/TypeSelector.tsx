import { motion } from "framer-motion";
import type { TypeSuggestion } from "../../../bindings";
import { COMMIT_TYPE_THEME } from "../lib/commit-type-theme";
import { cn } from "@/framework/lib/utils";
import { COMMIT_TYPES, type CommitType } from "../store";

interface TypeSelectorProps {
  value: CommitType | "";
  onChange: (type: CommitType) => void;
  suggestion: TypeSuggestion | null;
  onApplySuggestion: () => void;
  /** Grid columns: 4 for sidebar (default), 6 for blade layout */
  columns?: 4 | 6;
}

export function TypeSelector({
  value,
  onChange,
  suggestion,
  onApplySuggestion,
  columns = 4,
}: TypeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-ctp-subtext1">Type *</label>

      {/* Suggestion banner */}
      {suggestion && !value && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-2 bg-ctp-blue/10 border border-ctp-blue/20 rounded text-sm"
        >
          <span className="text-ctp-subtext1">
            Suggested:{" "}
            <strong className="text-ctp-blue">
              {suggestion.suggestedType}
            </strong>
          </span>
          <span className="text-ctp-overlay0">({suggestion.confidence})</span>
          <button
            type="button"
            onClick={onApplySuggestion}
            className="ml-auto text-ctp-blue hover:text-ctp-sapphire text-sm font-medium"
          >
            Apply
          </button>
        </motion.div>
      )}

      {/* Type grid */}
      <div
        className={cn(
          "grid gap-2",
          columns === 6 ? "grid-cols-6" : "grid-cols-4",
        )}
      >
        {COMMIT_TYPES.map((type) => {
          const theme = COMMIT_TYPE_THEME[type];
          const Icon = theme.icon;
          const isSelected = value === type;
          return (
            <motion.button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors",
                isSelected
                  ? theme.badgeClasses
                  : "border-ctp-surface1 text-ctp-subtext0 hover:border-ctp-overlay0 hover:text-ctp-subtext1",
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{type}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
