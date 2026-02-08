import { Loader2, RotateCcw } from "lucide-react";
import { cn } from "../../lib/utils";

interface CommitActionBarProps {
  canCommit: boolean;
  disabled?: boolean;
  isCommitting?: boolean;
  isPushing?: boolean;
  amend?: boolean;
  showPush?: boolean;
  onCommit: () => void;
  onCommitAndPush?: () => void;
  onCancel?: () => void;
}

/**
 * Action buttons for commit/push/amend workflows.
 *
 * Reusable between sidebar and blade. The commit button uses type="submit"
 * so it can trigger form submission when wrapped in a <form>.
 */
export function CommitActionBar({
  canCommit,
  disabled = false,
  isCommitting = false,
  isPushing = false,
  amend = false,
  showPush = false,
  onCommit,
  onCommitAndPush,
  onCancel,
}: CommitActionBarProps) {
  const isBusy = isCommitting || isPushing;

  return (
    <div className="flex justify-end gap-2 pt-2">
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled || isBusy}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded",
            "text-ctp-subtext1 bg-ctp-surface1 hover:bg-ctp-surface0",
            "focus:outline-none focus:ring-2 focus:ring-ctp-overlay0",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          Cancel
        </button>
      )}
      {showPush && onCommitAndPush && (
        <button
          type="button"
          onClick={onCommitAndPush}
          disabled={!canCommit || disabled || isBusy}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded flex items-center gap-2",
            amend
              ? "text-ctp-base bg-ctp-peach hover:bg-ctp-yellow"
              : "text-ctp-base bg-ctp-green hover:bg-ctp-teal",
            "focus:outline-none focus:ring-2 focus:ring-ctp-green",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {isBusy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {isPushing ? "Pushing..." : "Committing..."}
            </>
          ) : amend ? (
            <>
              <RotateCcw className="w-4 h-4" />
              Amend & Force Push
            </>
          ) : (
            "Commit & Push"
          )}
        </button>
      )}
      <button
        type="submit"
        onClick={onCommit}
        disabled={!canCommit || disabled || isBusy}
        className={cn(
          "px-4 py-2 text-sm font-medium rounded flex items-center gap-2",
          "text-ctp-base bg-ctp-blue hover:bg-ctp-sapphire",
          "focus:outline-none focus:ring-2 focus:ring-ctp-blue",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {isCommitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Committing...
          </>
        ) : amend ? (
          <>
            <RotateCcw className="w-4 h-4" />
            Amend Commit
          </>
        ) : (
          "Commit"
        )}
      </button>
    </div>
  );
}
