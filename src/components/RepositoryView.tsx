import {
  Archive,
  Files,
  GitBranch,
  GitMerge,
  History,
  Network,
  Plus,
  Tag,
} from "lucide-react";
import { useState } from "react";
import type { CommitSummary } from "../bindings";
import { cn } from "../lib/utils";
import { useRepositoryStore } from "../stores/repository";
import { BranchList } from "./branches/BranchList";
import { CommitDetails } from "./commit/CommitDetails";
import { CommitForm } from "./commit/CommitForm";
import { CommitHistory } from "./commit/CommitHistory";
import { DiffViewer } from "./diff/DiffViewer";
import { GitflowPanel } from "./gitflow";
import { StagingPanel } from "./staging/StagingPanel";
import { StashList } from "./stash/StashList";
import { TagList } from "./tags/TagList";
import { TopologyPanel } from "./topology";

type Tab = "changes" | "history" | "topology";

export function RepositoryView() {
  const { status } = useRepositoryStore();
  const [activeTab, setActiveTab] = useState<Tab>("changes");
  const [selectedCommit, setSelectedCommit] = useState<CommitSummary | null>(
    null,
  );
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [showStashDialog, setShowStashDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);

  if (!status) return null;

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Left sidebar - Branches, Stash, Tags */}
      <div className="w-64 shrink-0 border-r border-gray-800 bg-gray-950 overflow-y-auto">
        {/* Branches section */}
        <details open className="border-b border-gray-800">
          <summary className="p-3 cursor-pointer hover:bg-gray-800/50 flex items-center gap-2 select-none sticky top-0 bg-gray-950 z-10">
            <GitBranch className="w-4 h-4" />
            <span className="font-semibold text-sm flex-1">Branches</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowBranchDialog(true);
              }}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              title="Create new branch"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </summary>
          <div className="max-h-64 overflow-y-auto">
            <BranchList
              showCreateDialog={showBranchDialog}
              onCloseCreateDialog={() => setShowBranchDialog(false)}
            />
          </div>
        </details>

        {/* Stash section */}
        <details className="border-b border-gray-800">
          <summary className="p-3 cursor-pointer hover:bg-gray-800/50 flex items-center gap-2 select-none sticky top-0 bg-gray-950 z-10">
            <Archive className="w-4 h-4" />
            <span className="font-semibold text-sm flex-1">Stashes</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowStashDialog(true);
              }}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              title="Save new stash"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </summary>
          <div className="max-h-48 overflow-y-auto">
            <StashList
              showSaveDialog={showStashDialog}
              onCloseSaveDialog={() => setShowStashDialog(false)}
            />
          </div>
        </details>

        {/* Tags section */}
        <details className="border-b border-gray-800">
          <summary className="p-3 cursor-pointer hover:bg-gray-800/50 flex items-center gap-2 select-none sticky top-0 bg-gray-950 z-10">
            <Tag className="w-4 h-4" />
            <span className="font-semibold text-sm flex-1">Tags</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowTagDialog(true);
              }}
              className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
              title="Create new tag"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </summary>
          <div className="max-h-48 overflow-y-auto">
            <TagList
              showCreateDialog={showTagDialog}
              onCloseCreateDialog={() => setShowTagDialog(false)}
            />
          </div>
        </details>

        {/* Gitflow section */}
        <details className="border-b border-gray-800">
          <summary className="p-3 cursor-pointer hover:bg-gray-800/50 flex items-center gap-2 select-none sticky top-0 bg-gray-950 z-10">
            <GitMerge className="w-4 h-4" />
            <span className="font-semibold text-sm flex-1">Gitflow</span>
          </summary>
          <GitflowPanel />
        </details>
      </div>

      {/* Middle panel - Changes/History */}
      <div className="w-80 shrink-0 border-r border-gray-800 bg-gray-950 overflow-hidden flex flex-col">
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
          <button
            type="button"
            onClick={() => {
              setActiveTab("topology");
              setSelectedCommit(null);
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm",
              "transition-colors border-b-2",
              activeTab === "topology"
                ? "text-white border-blue-500 bg-gray-900/50"
                : "text-gray-400 border-transparent hover:text-gray-300",
            )}
          >
            <Network className="w-4 h-4" />
            Topology
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
        ) : activeTab === "history" ? (
          <div className="flex-1 overflow-hidden">
            <CommitHistory
              onSelectCommit={setSelectedCommit}
              selectedOid={selectedCommit?.oid ?? null}
            />
          </div>
        ) : null}
      </div>

      {/* Right panel - Diff/Commit Details/Topology */}
      {activeTab === "changes" ? (
        <DiffViewer />
      ) : activeTab === "topology" ? (
        <div className="flex-1 bg-gray-900">
          <TopologyPanel />
        </div>
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
