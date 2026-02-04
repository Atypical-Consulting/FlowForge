import {
  Archive,
  Files,
  GitBranch,
  GitMerge,
  History,
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
      {/* Left sidebar - Branches, Stash, Tags */}
      <div className="w-64 shrink-0 border-r border-gray-800 bg-gray-950 overflow-hidden flex flex-col">
        {/* Branches section */}
        <details open className="border-b border-gray-800">
          <summary className="p-3 cursor-pointer hover:bg-gray-800/50 flex items-center gap-2 select-none">
            <GitBranch className="w-4 h-4" />
            <span className="font-semibold text-sm">Branches</span>
          </summary>
          <div className="max-h-64 overflow-y-auto">
            <BranchList />
          </div>
        </details>

        {/* Stash section */}
        <details className="border-b border-gray-800">
          <summary className="p-3 cursor-pointer hover:bg-gray-800/50 flex items-center gap-2 select-none">
            <Archive className="w-4 h-4" />
            <span className="font-semibold text-sm">Stashes</span>
          </summary>
          <div className="max-h-48 overflow-y-auto">
            <StashList />
          </div>
        </details>

        {/* Tags section */}
        <details className="border-b border-gray-800">
          <summary className="p-3 cursor-pointer hover:bg-gray-800/50 flex items-center gap-2 select-none">
            <Tag className="w-4 h-4" />
            <span className="font-semibold text-sm">Tags</span>
          </summary>
          <div className="max-h-48 overflow-y-auto">
            <TagList />
          </div>
        </details>

        {/* Gitflow section */}
        <details className="border-b border-gray-800">
          <summary className="p-3 cursor-pointer hover:bg-gray-800/50 flex items-center gap-2 select-none">
            <GitMerge className="w-4 h-4" />
            <span className="font-semibold text-sm">Gitflow</span>
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

      {/* Right panel - Diff/Commit Details */}
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
