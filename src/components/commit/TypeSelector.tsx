import { motion } from "framer-motion";
import {
  Bug,
  FileText,
  Hammer,
  Package,
  Paintbrush,
  Rocket,
  Settings,
  Sparkles,
  TestTube,
  Undo,
  Zap,
} from "lucide-react";
import type { TypeSuggestion } from "../../bindings";
import { cn } from "../../lib/utils";
import { COMMIT_TYPES, type CommitType } from "../../stores/conventional";

const TYPE_ICONS: Record<CommitType, React.ElementType> = {
  feat: Sparkles,
  fix: Bug,
  docs: FileText,
  style: Paintbrush,
  refactor: Hammer,
  perf: Zap,
  test: TestTube,
  chore: Settings,
  ci: Rocket,
  build: Package,
  revert: Undo,
};

const TYPE_COLORS: Record<CommitType, string> = {
  feat: "text-ctp-green bg-ctp-green/10 border-ctp-green/30",
  fix: "text-ctp-red bg-ctp-red/10 border-ctp-red/30",
  docs: "text-ctp-blue bg-ctp-blue/10 border-ctp-blue/30",
  style: "text-ctp-pink bg-ctp-pink/10 border-ctp-pink/30",
  refactor: "text-ctp-peach bg-ctp-peach/10 border-ctp-peach/30",
  perf: "text-ctp-yellow bg-ctp-yellow/10 border-ctp-yellow/30",
  test: "text-ctp-teal bg-ctp-teal/10 border-ctp-teal/30",
  chore: "text-ctp-lavender bg-ctp-lavender/10 border-ctp-lavender/30",
  ci: "text-ctp-sky bg-ctp-sky/10 border-ctp-sky/30",
  build: "text-ctp-maroon bg-ctp-maroon/10 border-ctp-maroon/30",
  revert: "text-ctp-mauve bg-ctp-mauve/10 border-ctp-mauve/30",
};

interface TypeSelectorProps {
  value: CommitType | "";
  onChange: (type: CommitType) => void;
  suggestion: TypeSuggestion | null;
  onApplySuggestion: () => void;
}

export function TypeSelector({
  value,
  onChange,
  suggestion,
  onApplySuggestion,
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
      <div className="grid grid-cols-4 gap-2">
        {COMMIT_TYPES.map((type) => {
          const Icon = TYPE_ICONS[type];
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
                  ? TYPE_COLORS[type]
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
