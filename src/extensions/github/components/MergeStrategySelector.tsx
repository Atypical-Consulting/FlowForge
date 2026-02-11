import { GitBranch, GitMerge, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../../core/lib/utils";

export type MergeMethod = "merge" | "squash" | "rebase";

interface Strategy {
  value: MergeMethod;
  label: string;
  description: string;
  icon: LucideIcon;
}

const strategies: Strategy[] = [
  {
    value: "merge",
    label: "Create a merge commit",
    description: "All commits preserved with a merge commit",
    icon: GitMerge,
  },
  {
    value: "squash",
    label: "Squash and merge",
    description: "All commits squashed into a single commit",
    icon: Layers,
  },
  {
    value: "rebase",
    label: "Rebase and merge",
    description: "Commits rebased onto base branch linearly",
    icon: GitBranch,
  },
];

interface MergeStrategySelectorProps {
  value: MergeMethod;
  onChange: (method: MergeMethod) => void;
  disabled?: boolean;
}

export function MergeStrategySelector({ value, onChange, disabled }: MergeStrategySelectorProps) {
  return (
    <fieldset role="radiogroup" aria-label="Merge strategy" className="space-y-2">
      <legend className="text-xs font-medium text-ctp-subtext1 mb-2">Merge method</legend>
      {strategies.map((strategy) => {
        const isSelected = value === strategy.value;
        const Icon = strategy.icon;
        return (
          <label
            key={strategy.value}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
              isSelected
                ? "border-ctp-blue bg-ctp-blue/5"
                : "border-ctp-surface1 hover:border-ctp-surface2 hover:bg-ctp-surface0/30",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <input
              type="radio"
              name="merge-method"
              value={strategy.value}
              checked={isSelected}
              onChange={() => !disabled && onChange(strategy.value)}
              disabled={disabled}
              className="sr-only"
            />
            <Icon
              className={cn(
                "w-4 h-4 mt-0.5 shrink-0",
                isSelected ? "text-ctp-blue" : "text-ctp-overlay0",
              )}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-ctp-text">{strategy.label}</div>
              <div className="text-xs text-ctp-overlay0 mt-0.5">{strategy.description}</div>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
}
