import { motion } from "framer-motion";
import { CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/framework/lib/utils";
import type { CloneProgress as CloneProgressType } from "../../../bindings";

interface CloneProgressProps {
  progress: CloneProgressType | null;
  isCloning: boolean;
}

export function CloneProgress({ progress, isCloning }: CloneProgressProps) {
  if (!progress && !isCloning) {
    return null;
  }

  const getProgressInfo = () => {
    if (!progress) {
      return { label: "Starting clone...", percent: 0 };
    }

    switch (progress.event) {
      case "started":
        return {
          label: `Connecting to ${progress.data.url}...`,
          percent: 0,
        };
      case "receiving": {
        const { received, total, bytes } = progress.data;
        const percent = total > 0 ? Math.round((received / total) * 100) : 0;
        const bytesFormatted = formatBytes(bytes);
        return {
          label: `Receiving objects: ${received}/${total} (${bytesFormatted})`,
          percent,
        };
      }
      case "resolving": {
        const { current, total } = progress.data;
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        return {
          label: `Resolving deltas: ${current}/${total}`,
          percent,
        };
      }
      case "checkout": {
        const { current, total } = progress.data;
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        return {
          label: `Checking out files: ${current}/${total}`,
          percent,
        };
      }
      case "finished":
        return {
          label: "Clone complete!",
          percent: 100,
        };
      default:
        return { label: "Cloning...", percent: 0 };
    }
  };

  const { label, percent } = getProgressInfo();
  const isComplete = progress?.event === "finished";

  return (
    <div className="space-y-3 p-4 bg-ctp-surface0 rounded-lg">
      <div className="flex items-center gap-3">
        {isComplete ? (
          <CheckCircle className="w-5 h-5 text-ctp-green" />
        ) : (
          <Loader2 className="w-5 h-5 text-ctp-blue animate-spin" />
        )}
        <span className="text-sm text-ctp-text">{label}</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-ctp-surface1 rounded-full overflow-hidden">
        <motion.div
          className={cn(
            "h-full rounded-full",
            isComplete ? "bg-ctp-green" : "bg-ctp-blue",
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>

      {percent > 0 && !isComplete && (
        <div className="text-right text-xs text-ctp-overlay1">{percent}%</div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
