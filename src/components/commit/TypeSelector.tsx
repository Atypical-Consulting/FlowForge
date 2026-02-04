import type { TypeSuggestion } from "../../bindings";
import { cn } from "../../lib/utils";
import {
  COMMIT_TYPES,
  COMMIT_TYPE_LABELS,
  type CommitType,
} from "../../stores/conventional";

/**
 * Type descriptions for commit types.
 */
const TYPE_DESCRIPTIONS: Record<CommitType, string> = {
  feat: "A new feature",
  fix: "A bug fix",
  docs: "Documentation only changes",
  style: "Formatting, white-space, etc",
  refactor: "Code change that neither fixes a bug nor adds a feature",
  perf: "A code change that improves performance",
  test: "Adding missing tests",
  chore: "Other changes that don't modify src or test",
  ci: "CI configuration changes",
  build: "Build system or dependencies",
  revert: "Reverts a previous commit",
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
      <label className="text-sm font-medium text-gray-300">Type *</label>

      {/* Suggestion banner */}
      {suggestion && !value && (
        <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-sm">
          <span className="text-gray-300">
            Suggested:{" "}
            <strong className="text-blue-400">
              {suggestion.suggestedType}
            </strong>
          </span>
          <span className="text-gray-500">
            ({suggestion.confidence} confidence)
          </span>
          <button
            type="button"
            onClick={onApplySuggestion}
            className="ml-auto text-blue-400 hover:text-blue-300 text-sm"
          >
            Apply
          </button>
        </div>
      )}

      {/* Type dropdown */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as CommitType)}
        className={cn(
          "w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded",
          "text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
        )}
      >
        <option value="">Select type...</option>
        {COMMIT_TYPES.map((type) => (
          <option key={type} value={type}>
            {COMMIT_TYPE_LABELS[type]} ({type}) - {TYPE_DESCRIPTIONS[type]}
          </option>
        ))}
      </select>
    </div>
  );
}
