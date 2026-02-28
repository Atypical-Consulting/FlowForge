import { AlertTriangle, RotateCcw } from "lucide-react";

interface BladeContentErrorProps {
  /** Primary error message (e.g., "Failed to load markdown") */
  message: string;
  /** Optional secondary detail (e.g., the file path or error message) */
  detail?: string;
  /** If provided, shows a retry button */
  onRetry?: () => void;
}

/**
 * Standardized error state for data-fetch failures within blades.
 * Shows a centered error message with an optional retry button.
 */
export function BladeContentError({
  message,
  detail,
  onRetry,
}: BladeContentErrorProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-ctp-mantle gap-3">
      <AlertTriangle className="w-8 h-8 text-ctp-red" />
      <p className="text-sm text-ctp-red">{message}</p>
      {detail && (
        <p className="text-xs text-ctp-overlay0 max-w-md text-center">
          {detail}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-ctp-subtext1 bg-ctp-surface0 hover:bg-ctp-surface1 rounded transition-colors mt-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}
