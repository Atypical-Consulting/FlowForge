import { Files, History } from "lucide-react";
import { useState } from "react";
import type { CommitSummary } from "../bindings";
import { cn } from "../lib/utils";
import { useRepositoryStore } from "../stores/repository";
import { CommitDetails } from "./commit/CommitDetails";
import { CommitForm } from "./commit/CommitForm";
import { CommitHistory } from "./commit/CommitHistory";
import { DiffViewer } from "./diff/DiffViewer";
import { StagingPanel } from "./staging/StagingPanel";

type Tab = "changes" | "history";

export function RepositoryView() {
  const { status } = useRepositoryStore();
  const [activeTab, setActiveTab] = useState<Tab>("changes");
  const [selectedCommit, setSelectedCommit] = useState<CommitSummary | null>(
    null,
  );

  if (!status) return null;

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Left panel */}
      <div className="w-80 flex-shrink-0 border-r border-gray-800 bg-gray-950 overflow-hidden flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab("changes")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm",
              "transition-colors border-b-2",
              activeTab === "changes"
                ? "text-white border-blue-500 bg-gray-900/50"
                : "text-gray-400 border-transparent hover:text-gray-300",
            )}
          >
            <Files className="w-4 h-4" />
            Changes
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              setSelectedCommit(null);
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm",
              "transition-colors border-b-2",
              activeTab === "history"
                ? "text-white border-blue-500 bg-gray-900/50"
                : "text-gray-400 border-transparent hover:text-gray-300",
            )}
          >
            <History className="w-4 h-4" />
            History
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "changes" ? (
          <>
            <div className="flex-1 overflow-hidden">
              <StagingPanel />
            </div>
            <CommitForm />
          </>
        ) : (
          <div className="flex-1 overflow-hidden">
            <CommitHistory
              onSelectCommit={setSelectedCommit}
              selectedOid={selectedCommit?.oid ?? null}
            />
          </div>
        )}
      </div>

      {/* Right panel */}
      {activeTab === "changes" ? (
        <DiffViewer />
      ) : selectedCommit ? (
        <div className="flex-1 bg-gray-900">
          <CommitDetails commit={selectedCommit} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <p className="text-gray-500 text-sm">
            Select a commit to view details
          </p>
        </div>
      )}
    </div>
  );
}
