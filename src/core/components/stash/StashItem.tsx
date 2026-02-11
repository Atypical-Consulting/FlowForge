import { Archive, Download, Loader2, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import type { StashEntry } from "../../../bindings";
import { parseStashMessage } from "../../lib/stash-utils";

interface StashItemProps {
  stash: StashEntry;
  onApply: () => Promise<unknown> | void;
  onPop: () => Promise<unknown> | void;
  onDrop: () => Promise<unknown> | void;
  disabled?: boolean;
}

export function StashItem({
  stash,
  onApply,
  onPop,
  onDrop,
  disabled,
}: StashItemProps) {
  const [loadingAction, setLoadingAction] = useState<
    "apply" | "pop" | "drop" | null
  >(null);
  const isAnyLoading = loadingAction !== null;

  const handleAction = async (
    action: "apply" | "pop" | "drop",
    fn: () => Promise<unknown> | void,
  ) => {
    setLoadingAction(action);
    try {
      await fn();
    } finally {
      setLoadingAction(null);
    }
  };

  const parsed = parseStashMessage(stash.message);

  return (
    <div className="group flex items-center justify-between px-2 py-1 rounded-md hover:bg-ctp-surface0">
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <Archive className="w-3.5 h-3.5 shrink-0 text-ctp-overlay1" />
        <div className="min-w-0">
          <p className="truncate text-sm text-ctp-text">{parsed.description}</p>
          <span className="text-xs text-ctp-overlay0">
            stash@{"{" + stash.index + "}"}
            {parsed.branch && (
              <span className="text-ctp-overlay1"> on {parsed.branch}</span>
            )}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => handleAction("apply", onApply)}
          disabled={disabled || isAnyLoading}
          className="p-1 hover:bg-ctp-surface1 rounded text-ctp-overlay1 hover:text-ctp-text"
          title="Apply (keep stash)"
        >
          {loadingAction === "apply" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => handleAction("pop", onPop)}
          disabled={disabled || isAnyLoading}
          className="p-1 hover:bg-ctp-surface1 rounded text-ctp-overlay1 hover:text-ctp-green"
          title="Pop (apply and remove)"
        >
          {loadingAction === "pop" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => handleAction("drop", onDrop)}
          disabled={disabled || isAnyLoading}
          className="p-1 hover:bg-ctp-surface1 rounded text-ctp-overlay1 hover:text-ctp-red"
          title="Drop (discard)"
        >
          {loadingAction === "drop" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
