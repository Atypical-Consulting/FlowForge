import {
  Archive,
  FolderGit2,
  GitBranch,
  GitMerge,
  Plus,
  Tag,
} from "lucide-react";
import { useCallback, useState } from "react";
import type { Blade } from "../stores/blades";
import { useBladeNavigation } from "../hooks/useBladeNavigation";
import {
  BladeContainer,
  BladePanel,
  CommitDetailsBlade,
  DiffBlade,
  StagingChangesBlade,
  TopologyRootBlade,
  ViewerImageBlade,
  ViewerNupkgBlade,
} from "./blades";
import { BranchList } from "./branches/BranchList";
import { CommitForm } from "./commit/CommitForm";
import { GitflowPanel } from "./gitflow";
import { ResizablePanelLayout, ResizablePanel, ResizeHandle } from "./layout";
import { useRepositoryStore } from "../stores/repository";
import { StashList } from "./stash/StashList";
import { TagList } from "./tags/TagList";
import {
  CreateWorktreeDialog,
  DeleteWorktreeDialog,
  WorktreePanel,
} from "./worktree";

export function RepositoryView() {
  const { status } = useRepositoryStore();
  const { goBack } = useBladeNavigation();
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [showStashDialog, setShowStashDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showWorktreeDialog, setShowWorktreeDialog] = useState(false);
  const [worktreeToDelete, setWorktreeToDelete] = useState<string | null>(null);

  const renderBlade = useCallback(
    (blade: Blade) => {
      switch (blade.type) {
        case "staging-changes":
          return <StagingChangesBlade />;
        case "topology-graph":
          return <TopologyRootBlade />;
        case "commit-details":
          return (
            <BladePanel title="Commit" showBack onBack={goBack}>
              <CommitDetailsBlade oid={String(blade.props.oid)} />
            </BladePanel>
          );
        case "diff":
          return (
            <BladePanel
              title={String(blade.props.filePath).split("/").pop() || "Diff"}
              showBack
              onBack={goBack}
            >
              <DiffBlade
                source={
                  blade.props as
                    | { mode: "commit"; oid: string; filePath: string }
                    | { mode: "staging"; filePath: string; staged: boolean }
                }
              />
            </BladePanel>
          );
        case "viewer-nupkg":
          return (
            <BladePanel
              title={String(blade.props.filePath).split("/").pop() || "Package"}
              showBack
              onBack={goBack}
            >
              <ViewerNupkgBlade filePath={String(blade.props.filePath)} />
            </BladePanel>
          );
        case "viewer-image":
          return (
            <BladePanel
              title={String(blade.props.filePath).split("/").pop() || "Image"}
              showBack
              onBack={goBack}
            >
              <ViewerImageBlade filePath={String(blade.props.filePath)} />
            </BladePanel>
          );
        default:
          return <div>Unknown blade type</div>;
      }
    },
    [goBack],
  );

  if (!status) return null;

  return (
    <>
      <ResizablePanelLayout autoSaveId="repo-layout" direction="horizontal">
        {/* Left sidebar - Branches, Stash, Tags */}
        <ResizablePanel id="sidebar" defaultSize={20} minSize={15} maxSize={30}>
          <div className="h-full border-r border-ctp-surface0 bg-ctp-base flex flex-col">
            {/* Scrollable sections container */}
            <div className="flex-1 overflow-y-auto">
              {/* Branches section */}
              <details open className="border-b border-ctp-surface0">
                <summary className="p-3 cursor-pointer hover:bg-ctp-surface0/50 flex items-center gap-2 select-none sticky top-0 z-10 bg-ctp-base/70 backdrop-blur-lg border-b border-ctp-surface0/50">
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
                <BranchList
                  showCreateDialog={showBranchDialog}
                  onCloseCreateDialog={() => setShowBranchDialog(false)}
                />
              </details>

              {/* Stash section */}
              <details className="border-b border-ctp-surface0">
                <summary className="p-3 cursor-pointer hover:bg-ctp-surface0/50 flex items-center gap-2 select-none sticky top-0 z-10 bg-ctp-base/70 backdrop-blur-lg border-b border-ctp-surface0/50">
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
                <StashList
                  showSaveDialog={showStashDialog}
                  onCloseSaveDialog={() => setShowStashDialog(false)}
                />
              </details>

              {/* Tags section */}
              <details className="border-b border-ctp-surface0">
                <summary className="p-3 cursor-pointer hover:bg-ctp-surface0/50 flex items-center gap-2 select-none sticky top-0 z-10 bg-ctp-base/70 backdrop-blur-lg border-b border-ctp-surface0/50">
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
                <TagList
                  showCreateDialog={showTagDialog}
                  onCloseCreateDialog={() => setShowTagDialog(false)}
                  onOpenCreateDialog={() => setShowTagDialog(true)}
                />
              </details>

              {/* Gitflow section */}
              <details className="border-b border-ctp-surface0">
                <summary className="p-3 cursor-pointer hover:bg-ctp-surface0/50 flex items-center gap-2 select-none sticky top-0 z-10 bg-ctp-base/70 backdrop-blur-lg border-b border-ctp-surface0/50">
                  <GitMerge className="w-4 h-4" />
                  <span className="font-semibold text-sm flex-1">Gitflow</span>
                </summary>
                <GitflowPanel />
              </details>

              {/* Worktrees section */}
              <details className="border-b border-ctp-surface0">
                <summary className="p-3 cursor-pointer hover:bg-ctp-surface0/50 flex items-center gap-2 select-none sticky top-0 z-10 bg-ctp-base/70 backdrop-blur-lg border-b border-ctp-surface0/50">
                  <FolderGit2 className="w-4 h-4" />
                  <span className="font-semibold text-sm flex-1">
                    Worktrees
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowWorktreeDialog(true);
                    }}
                    className="p-1 hover:bg-ctp-surface1 rounded text-ctp-subtext0 hover:text-ctp-text"
                    title="Create new worktree"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </summary>
                <WorktreePanel
                  onOpenDeleteDialog={(name) => setWorktreeToDelete(name)}
                />
              </details>
            </div>

            {/* Commit form at bottom of left panel */}
            <div className="shrink-0 border-t border-ctp-surface0">
              <CommitForm />
            </div>
          </div>
        </ResizablePanel>

        <ResizeHandle />

        {/* Main area - Blade Container */}
        <ResizablePanel id="blades" defaultSize={80}>
          <BladeContainer renderBlade={renderBlade} />
        </ResizablePanel>
      </ResizablePanelLayout>

      {/* Worktree Dialogs */}
      <CreateWorktreeDialog
        open={showWorktreeDialog}
        onOpenChange={setShowWorktreeDialog}
      />
      <DeleteWorktreeDialog
        worktreeName={worktreeToDelete}
        onOpenChange={(open) => !open && setWorktreeToDelete(null)}
      />
    </>
  );
}
