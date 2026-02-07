import type { LucideIcon } from "lucide-react";

interface BladeContentEmptyProps {
  /** Icon to display (e.g., FileText, FolderOpen) */
  icon: LucideIcon;
  /** Primary message */
  message: string;
  /** Optional secondary detail */
  detail?: string;
}

/**
 * Standardized empty state for blades with no content to display.
 * Matches the placeholder blade layout pattern.
 */
export function BladeContentEmpty({ icon: Icon, message, detail }: BladeContentEmptyProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-ctp-subtext0">
      <Icon className="w-10 h-10 text-ctp-overlay0" />
      <p className="text-sm">{message}</p>
      {detail && (
        <p className="text-xs text-ctp-overlay0">{detail}</p>
      )}
    </div>
  );
}
