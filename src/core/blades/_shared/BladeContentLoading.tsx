import { Loader2 } from "lucide-react";

/**
 * Standardized loading state for data-fetching within blades.
 * Matches the pattern used by DiffBlade and CommitDetailsBlade.
 */
export function BladeContentLoading() {
  return (
    <div className="flex-1 flex items-center justify-center bg-ctp-mantle">
      <Loader2 className="w-5 h-5 animate-spin text-ctp-overlay1" />
    </div>
  );
}
