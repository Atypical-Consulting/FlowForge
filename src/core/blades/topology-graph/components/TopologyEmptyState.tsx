import { GitCommitHorizontal } from "lucide-react";
import { getNavigationActor } from "../../../machines/navigation/context";

export function TopologyEmptyState() {
  const handleGoToChanges = () => {
    getNavigationActor().send({ type: "SWITCH_PROCESS", process: "staging" });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-ctp-mantle gap-5 px-6">
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        className="text-ctp-overlay0"
        aria-hidden="true"
      >
        {/* Trunk */}
        <line x1="60" y1="100" x2="60" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Left branch */}
        <line x1="60" y1="60" x2="35" y2="35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Right branch */}
        <line x1="60" y1="50" x2="85" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Empty circles at tips */}
        <circle cx="60" cy="35" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="35" cy="30" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="85" cy="25" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
      <div className="text-center space-y-1.5">
        <h3 className="text-sm font-medium text-ctp-subtext1">No commits yet</h3>
        <p className="text-xs text-ctp-overlay0 max-w-xs">
          This repository has no commits. Create your first commit to see the topology graph.
        </p>
      </div>
      <button
        type="button"
        onClick={handleGoToChanges}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-ctp-blue text-ctp-base rounded-md hover:bg-ctp-blue/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue focus-visible:ring-offset-2 focus-visible:ring-offset-ctp-mantle"
      >
        <GitCommitHorizontal className="w-4 h-4" />
        Go to Changes
      </button>
    </div>
  );
}
