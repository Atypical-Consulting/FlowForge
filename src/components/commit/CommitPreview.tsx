import { cn } from "../../lib/utils";

interface CommitPreviewProps {
  message: string;
  variant?: "compact" | "full";
}

/**
 * Commit message preview with compact (sidebar) and full (blade) variants.
 *
 * Compact: max-h-32, plain text, sidebar-sized.
 * Full: min-h-[300px], flex-1, room for syntax highlighting (added in Plan 04).
 */
export function CommitPreview({
  message,
  variant = "compact",
}: CommitPreviewProps) {
  if (!message) return null;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-ctp-subtext1">Preview</label>
      <pre
        className={cn(
          "p-3 text-sm bg-ctp-mantle border border-ctp-surface0 rounded",
          "text-ctp-subtext1 font-mono whitespace-pre-wrap break-words",
          variant === "compact"
            ? "max-h-32 overflow-y-auto"
            : "min-h-[300px] flex-1 overflow-y-auto",
        )}
        aria-live="polite"
      >
        {message}
      </pre>
    </div>
  );
}
