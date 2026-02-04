import { cn } from "../../lib/utils";

interface BreakingChangeSectionProps {
  isBreaking: boolean;
  onBreakingChange: (breaking: boolean) => void;
  description: string;
  onDescriptionChange: (desc: string) => void;
}

export function BreakingChangeSection({
  isBreaking,
  onBreakingChange,
  description,
  onDescriptionChange,
}: BreakingChangeSectionProps) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isBreaking}
          onChange={(e) => onBreakingChange(e.target.checked)}
          className="w-4 h-4 rounded border-ctp-surface2 bg-ctp-surface0 text-ctp-peach focus:ring-ctp-peach"
        />
        <span className="text-sm font-medium text-ctp-subtext1">
          Breaking Change
        </span>
      </label>

      {isBreaking && (
        <div className="pl-6 space-y-2">
          <label className="text-sm text-ctp-overlay1">
            Describe the breaking change *
          </label>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="What breaks and how to migrate..."
            rows={3}
            className={cn(
              "w-full px-3 py-2 text-sm bg-ctp-surface0 border rounded resize-none",
              "text-ctp-text placeholder:text-ctp-overlay0",
              "focus:outline-none focus:ring-1",
              "border-ctp-peach/30 focus:border-ctp-peach focus:ring-ctp-peach",
            )}
          />
          <p className="text-xs text-ctp-overlay0">
            This will be added as a BREAKING CHANGE footer
          </p>
        </div>
      )}
    </div>
  );
}
