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
          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500"
        />
        <span className="text-sm font-medium text-gray-300">
          Breaking Change
        </span>
      </label>

      {isBreaking && (
        <div className="pl-6 space-y-2">
          <label className="text-sm text-gray-400">
            Describe the breaking change *
          </label>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="What breaks and how to migrate..."
            rows={3}
            className={cn(
              "w-full px-3 py-2 text-sm bg-gray-800 border rounded resize-none",
              "text-white placeholder:text-gray-500",
              "focus:outline-none focus:ring-1",
              "border-orange-500/30 focus:border-orange-500 focus:ring-orange-500",
            )}
          />
          <p className="text-xs text-gray-500">
            This will be added as a BREAKING CHANGE footer
          </p>
        </div>
      )}
    </div>
  );
}
