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
import { useTopologyStore } from "../stores/topology";
import { BranchList } from "./branches/BranchList";
import { CommitDetails } from "./commit/CommitDetails";
import { CommitForm } from "./commit/CommitForm";
import { CommitHistory } from "./commit/CommitHistory";
import { GitflowPanel } from "./gitflow";
import { ResizablePanelLayout, ResizablePanel, ResizeHandle } from "./layout";
import { StagingPanel } from "./staging/StagingPanel";
import { StashList } from "./stash/StashList";
import { TagList } from "./tags/TagList";
import { TopologyCommitDetails, TopologyPanel } from "./topology";
import { FileViewer } from "./viewers";

type Tab = "changes" | "history" | "topology";

export function RepositoryView() {
  const { status } = useRepositoryStore();
  const topologySelectedCommit = useTopologyStore((s) => s.selectedCommit);
  const clearTopologySelection = useTopologyStore((s) => s.selectCommit);
  const [activeTab, setActiveTab] = useState<Tab>("changes");
  const [selectedCommit, setSelectedCommit] = useState<CommitSummary | null>(
    null,
  );
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [showStashDialog, setShowStashDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);

  if (!status) return null;

  return (
    <ResizablePanelLayout autoSaveId="repo-layout" direction="horizontal">
      {/* Left sidebar - Branches, Stash, Tags */}
      <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
        <div className="h-full border-r border-ctp-surface0 bg-ctp-base overflow-y-auto">
          {/* Branches section */}
          <details open className="border-b border-ctp-surface0">
            <summary className="p-3 cursor-pointer hover:bg-ctp-surface0/50 flex items-center gap-2 select-none sticky top-0 bg-ctp-base z-10">
              <GitBranch className="w-4 h-4" />
              <span className="font-semibold text-sm flex-1">Branches</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowBranchDialog(true);
                }}
                className="p-1 hover:bg-ctp-surface1 rounded text-ctp-subtext0 hover:text-ctp-text"
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
          <details className="border-b border-ctp-surface0">
            <summary className="p-3 cursor-pointer hover:bg-ctp-surface0/50 flex items-center gap-2 select-none sticky top-0 bg-ctp-base z-10">
              <Archive className="w-4 h-4" />
              <span className="font-semibold text-sm flex-1">Stashes</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowStashDialog(true);
                }}
                className="p-1 hover:bg-ctp-surface1 rounded text-ctp-subtext0 hover:text-ctp-text"
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
          <details className="border-b border-ctp-surface0">
            <summary className="p-3 cursor-pointer hover:bg-ctp-surface0/50 flex items-center gap-2 select-none sticky top-0 bg-ctp-base z-10">
              <Tag className="w-4 h-4" />
              <span className="font-semibold text-sm flex-1">Tags</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowTagDialog(true);
                }}
                className="p-1 hover:bg-ctp-surface1 rounded text-ctp-subtext0 hover:text-ctp-text"
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
          <details className="border-b border-ctp-surface0">
            <summary className="p-3 cursor-pointer hover:bg-ctp-surface0/50 flex items-center gap-2 select-none sticky top-0 bg-ctp-base z-10">
              <GitMerge className="w-4 h-4" />
              <span className="font-semibold text-sm flex-1">Gitflow</span>
            </summary>
            <GitflowPanel />
          </details>
        </div>
      </ResizablePanel>

      <ResizeHandle />

      {/* Middle panel - Changes/History */}
      <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
        <div className="h-full border-r border-ctp-surface0 bg-ctp-base overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-ctp-surface0">
            <button
              type="button"
              onClick={() => setActiveTab("changes")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm",
                "transition-colors border-b-2",
                activeTab === "changes"
                  ? "text-ctp-text border-ctp-blue bg-ctp-surface0/50"
                  : "text-ctp-subtext0 border-transparent hover:text-ctp-subtext1",
              )}
            >
              <Files className="w-4 h-4" />
              Changes
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("history");
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm",
                "transition-colors border-b-2",
                activeTab === "history"
                  ? "text-ctp-text border-ctp-blue bg-ctp-surface0/50"
                  : "text-ctp-subtext0 border-transparent hover:text-ctp-subtext1",
              )}
            >
              <History className="w-4 h-4" />
              History
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("topology");
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm",
                "transition-colors border-b-2",
                activeTab === "topology"
                  ? "text-ctp-text border-ctp-blue bg-ctp-surface0/50"
                  : "text-ctp-subtext0 border-transparent hover:text-ctp-subtext1",
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
      </ResizablePanel>

      <ResizeHandle />

      {/* Right panel - Diff/Commit Details/Topology */}
      <ResizablePanel defaultSize={55}>
        <div className="h-full bg-ctp-mantle">
          {activeTab === "changes" ? (
            <FileViewer />
          ) : activeTab === "topology" ? (
            <div className="flex h-full">
              <div className={topologySelectedCommit ? "flex-1" : "w-full"}>
                <TopologyPanel />
              </div>
              {topologySelectedCommit && (
                <div className="w-80 shrink-0">
                  <TopologyCommitDetails
                    oid={topologySelectedCommit}
                    onClose={() => clearTopologySelection(null)}
                  />
                </div>
              )}
            </div>
          ) : selectedCommit ? (
            <CommitDetails commit={selectedCommit} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-ctp-subtext0 text-sm">
                Select a commit to view details
              </p>
            </div>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelLayout>
  );
}
