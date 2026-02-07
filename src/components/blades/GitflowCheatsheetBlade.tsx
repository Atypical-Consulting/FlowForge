import { GitMerge } from "lucide-react";

export function GitflowCheatsheetBlade() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-ctp-subtext0">
      <GitMerge className="w-12 h-12 text-ctp-overlay0" />
      <p className="text-sm">Gitflow workflow reference guide</p>
      <p className="text-xs text-ctp-overlay0">Coming in Phase 22</p>
    </div>
  );
}
