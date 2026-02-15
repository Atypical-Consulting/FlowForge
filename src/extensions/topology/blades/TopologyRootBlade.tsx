import { History, Network } from "lucide-react";
import { useState } from "react";
import { cn } from "@/framework/lib/utils";
import { useBladeNavigation } from "../../../core/hooks/useBladeNavigation";
import { CommitHistory } from "../../commits/components/CommitHistory";
import { TopologyPanel } from "../components/TopologyPanel";

type TopologyView = "graph" | "history";

export function TopologyRootBlade() {
  const [view, setView] = useState<TopologyView>("graph");
  const { openBlade } = useBladeNavigation();
  const openCommitDetails = (oid: string) => openBlade("commit-details", { oid });

  return (
    <div className="flex flex-col h-full">
      {/* Sub-navigation tabs */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-ctp-surface0 bg-ctp-crust shrink-0">
        <button
          onClick={() => setView("graph")}
          className={cn(
            "px-3 py-1 rounded-md text-sm flex items-center gap-1.5 transition-colors",
            view === "graph"
              ? "bg-ctp-surface0 text-ctp-text"
              : "text-ctp-subtext0 hover:text-ctp-subtext1 hover:bg-ctp-surface0/50",
          )}
        >
          <Network className="w-3.5 h-3.5" />
          Graph
        </button>
        <button
          onClick={() => setView("history")}
          className={cn(
            "px-3 py-1 rounded-md text-sm flex items-center gap-1.5 transition-colors",
            view === "history"
              ? "bg-ctp-surface0 text-ctp-text"
              : "text-ctp-subtext0 hover:text-ctp-subtext1 hover:bg-ctp-surface0/50",
          )}
        >
          <History className="w-3.5 h-3.5" />
          History
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {view === "graph" ? (
          <TopologyPanel onCommitSelect={openCommitDetails} />
        ) : (
          <CommitHistory onCommitSelect={openCommitDetails} />
        )}
      </div>
    </div>
  );
}
