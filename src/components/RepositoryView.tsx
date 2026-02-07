import {
  AlignJustify,
  Archive,
  Columns,
  FolderGit2,
  GitBranch,
  GitMerge,
  Plus,
  Tag,
} from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import type { Blade } from "../stores/blades";
import { useBladeNavigation } from "../hooks/useBladeNavigation";
import {
  BladeContainer,
  BladePanel,
  ChangelogBlade,
  CommitDetailsBlade,
  DiffBlade,
  SettingsBlade,
  StagingChangesBlade,
  TopologyRootBlade,
  ViewerImageBlade,
  ViewerNupkgBlade,
} from "./blades";
import { BranchList } from "./branches/BranchList";
import { Button } from "./ui/button";
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

// Lazy-loaded blade components for Phase 22+ content
const ViewerMarkdownBlade = lazy(() =>
  import("./blades/ViewerMarkdownBlade").then((m) => ({
    default: m.ViewerMarkdownBlade,
  })),
);
const Viewer3dBlade = lazy(() =>
  import("./blades/Viewer3dBlade").then((m) => ({
    default: m.Viewer3dBlade,
  })),
);
const RepoBrowserBlade = lazy(() =>
  import("./blades/RepoBrowserBlade").then((m) => ({
    default: m.RepoBrowserBlade,
  })),
);
const GitflowCheatsheetBlade = lazy(() =>
  import("./blades/GitflowCheatsheetBlade").then((m) => ({
    default: m.GitflowCheatsheetBlade,
  })),
);

export function RepositoryView() {
  const { status } = useRepositoryStore();
  const { goBack } = useBladeNavigation();
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [showStashDialog, setShowStashDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showWorktreeDialog, setShowWorktreeDialog] = useState(false);
  const [worktreeToDelete, setWorktreeToDelete] = useState<string | null>(null);
  const [diffInline, setDiffInline] = useState(true);

  // Listen for create-branch-dialog event from command palette
  useEffect(() => {
    const handler = () => setShowBranchDialog(true);
    document.addEventListener("create-branch-dialog", handler);
    return () => document.removeEventListener("create-branch-dialog", handler);
  }, []);

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
        case "diff": {
          const filePath = String(blade.props.filePath);
          const lastSlash = filePath.lastIndexOf("/");
          const titleNode =
            lastSlash === -1 ? (
              <span className="text-sm font-semibold text-ctp-text truncate">
                {filePath}
              </span>
            ) : (
              <span className="text-sm truncate">
                <span className="text-ctp-overlay1">
                  {filePath.slice(0, lastSlash + 1)}
                </span>
                <span className="font-semibold text-ctp-text">
                  {filePath.slice(lastSlash + 1)}
                </span>
              </span>
            );
          return (
            <BladePanel
              title="Diff"
              titleContent={titleNode}
              trailing={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDiffInline((v) => !v)}
                  title={
                    diffInline ? "Switch to side-by-side" : "Switch to inline"
                  }
                >
                  {diffInline ? (
                    <Columns className="w-4 h-4" />
                  ) : (
                    <AlignJustify className="w-4 h-4" />
                  )}
                </Button>
              }
              showBack
              onBack={goBack}
            >
              <DiffBlade
                source={
                  blade.props as
                    | { mode: "commit"; oid: string; filePath: string }
                    | { mode: "staging"; filePath: string; staged: boolean }
                }
                inline={diffInline}
              />
            </BladePanel>
          );
        }
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
              <ViewerImageBlade
                filePath={String(blade.props.filePath)}
                oid={
                  blade.props.mode === "commit"
                    ? String(blade.props.oid)
                    : undefined
                }
              />
            </BladePanel>
          );
        case "settings":
          return (
            <BladePanel title="Settings" showBack onBack={goBack}>
              <SettingsBlade />
            </BladePanel>
          );
        case "changelog":
          return (
            <BladePanel title="Generate Changelog" showBack onBack={goBack}>
              <ChangelogBlade />
            </BladePanel>
          );
        case "viewer-markdown":
          return (
            <BladePanel title={blade.title} showBack onBack={goBack}>
              <Suspense
                fallback={
                  <div className="p-4 text-ctp-subtext0">Loading...</div>
                }
              >
                <ViewerMarkdownBlade
                  filePath={String(blade.props.filePath)}
                />
              </Suspense>
            </BladePanel>
          );
        case "viewer-3d":
          return (
            <BladePanel title={blade.title} showBack onBack={goBack}>
              <Suspense
                fallback={
                  <div className="p-4 text-ctp-subtext0">Loading...</div>
                }
              >
                <Viewer3dBlade filePath={String(blade.props.filePath)} />
              </Suspense>
            </BladePanel>
          );
        case "repo-browser":
          return (
            <BladePanel title="Repository Browser" showBack onBack={goBack}>
              <Suspense
                fallback={
                  <div className="p-4 text-ctp-subtext0">Loading...</div>
                }
              >
                <RepoBrowserBlade
                  path={
                    blade.props.path ? String(blade.props.path) : undefined
                  }
                />
              </Suspense>
            </BladePanel>
          );
        case "gitflow-cheatsheet":
          return (
            <BladePanel title="Gitflow Guide" showBack onBack={goBack}>
              <Suspense
                fallback={
                  <div className="p-4 text-ctp-subtext0">Loading...</div>
                }
              >
                <GitflowCheatsheetBlade />
              </Suspense>
            </BladePanel>
          );
        default:
          return <div>Unknown blade type</div>;
      }
    },
    [goBack, diffInline],
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
