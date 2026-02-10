import {
  Archive,
  FolderGit2,
  GitBranch,
  GitMerge,
  Plus,
  Tag,
} from "lucide-react";
import { Component, useEffect, useMemo, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useSidebarPanelRegistry } from "../lib/sidebarPanelRegistry";
import { useRepositoryStore } from "../stores/repository";
import { BladeContainer } from "../blades/_shared";
import { BranchList } from "./branches/BranchList";
import { CommitForm } from "./commit/CommitForm";
import { GitflowPanel } from "./gitflow";
import { ResizablePanelLayout, ResizablePanel, ResizeHandle } from "./layout";
import { StashList } from "./stash/StashList";
import { TagList } from "./tags/TagList";
import {
  CreateWorktreeDialog,
  DeleteWorktreeDialog,
  WorktreePanel,
} from "./worktree";

// Minimal error boundary for extension panels (react-error-boundary not in deps)
class ExtensionPanelErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Extension panel error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-3 text-xs text-ctp-red">
          Panel error: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

function DynamicSidebarPanels() {
  const panels = useSidebarPanelRegistry((s) => s.panels);
  const visibilityTick = useSidebarPanelRegistry((s) => s.visibilityTick);

  const visiblePanels = useMemo(
    () => useSidebarPanelRegistry.getState().getVisiblePanels(),
    [panels, visibilityTick],
  );

  if (visiblePanels.length === 0) return null;

  return (
    <>
      {visiblePanels.map((panel) => (
        <details
          key={panel.id}
          open={panel.defaultOpen}
          className="border-b border-ctp-surface0"
        >
          <summary className="p-3 cursor-pointer hover:bg-ctp-surface0/50 flex items-center gap-2 select-none sticky top-0 z-10 bg-ctp-base/70 backdrop-blur-lg border-b border-ctp-surface0/50">
            <panel.icon className="w-4 h-4" />
            <span className="font-semibold text-sm flex-1">{panel.title}</span>
            {panel.renderAction?.()}
          </summary>
          <ExtensionPanelErrorBoundary>
            <panel.component />
          </ExtensionPanelErrorBoundary>
        </details>
      ))}
    </>
  );
}

export function RepositoryView() {
  const status = useRepositoryStore((s) => s.repoStatus);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [showStashDialog, setShowStashDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showWorktreeDialog, setShowWorktreeDialog] = useState(false);
  const [worktreeToDelete, setWorktreeToDelete] = useState<string | null>(null);

  // Listen for create-branch-dialog event from command palette
  useEffect(() => {
    const handler = () => setShowBranchDialog(true);
    document.addEventListener("create-branch-dialog", handler);
    return () => document.removeEventListener("create-branch-dialog", handler);
  }, []);

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

              {/* Extension-contributed sidebar panels */}
              <DynamicSidebarPanels />
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
          <BladeContainer />
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
