import { AlertCircle, Check, Loader2 } from "lucide-react";
import type { SyncProgress as SyncProgressType } from "../../../bindings";

interface SyncProgressProps {
  progress: SyncProgressType | null;
}

export function SyncProgressDisplay({ progress }: SyncProgressProps) {
  if (!progress) return null;

  switch (progress.event) {
    case "started":
      return (
        <div className="flex items-center gap-2 text-xs text-ctp-overlay1">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Starting {progress.data.operation}...</span>
        </div>
      );

    case "transferring": {
      const percent =
        progress.data.total > 0
          ? Math.round((progress.data.current / progress.data.total) * 100)
          : 0;
      return (
        <div className="flex items-center gap-2 text-xs text-ctp-overlay1">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Transferring... {percent}%</span>
        </div>
      );
    }

    case "finished":
      return (
        <div className="flex items-center gap-2 text-xs text-ctp-green">
          <Check className="w-3 h-3" />
          <span>{progress.data.operation} complete</span>
        </div>
      );

    case "error":
      return (
        <div className="flex items-center gap-2 text-xs text-ctp-red">
          <AlertCircle className="w-3 h-3" />
          <span>{progress.data.message}</span>
        </div>
      );

    default:
      return null;
  }
}
