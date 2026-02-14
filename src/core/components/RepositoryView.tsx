import {
  Archive,
  GitBranch,
  Plus,
  Tag,
} from "lucide-react";
import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useGroupRef, usePanelRef } from "react-resizable-panels";
import type { Layout } from "react-resizable-panels";
import { useSidebarPanelRegistry } from "../lib/sidebarPanelRegistry";
import { getPresetById } from "../lib/layoutPresets";
import { useGitOpsStore as useRepositoryStore } from "../stores/domain/git-ops";
import { usePreferencesStore } from "../stores/domain/preferences";
import { BladeContainer } from "../blades/_shared";
import { BranchList } from "./branches/BranchList";
import { CommitForm } from "./commit/CommitForm";
import { ResizablePanelLayout, ResizablePanel, ResizeHandle } from "./layout";
import { StashList } from "./stash/StashList";
import { TagList } from "./tags/TagList";


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
            {panel.badge && (() => {
              const value = panel.badge!();
              if (value == null || value === 0 || value === '') return null;
              return (
                <span className="bg-ctp-blue text-ctp-base text-[10px] font-medium px-1.5 min-w-[18px] text-center rounded-full">
                  {value}
                </span>
              );
            })()}
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

  // Imperative refs for programmatic layout control
  const groupRef = useGroupRef();
  const sidebarRef = usePanelRef();

  // Layout store subscriptions
  const layoutState = usePreferencesStore((s) => s.layoutState);
  const setPanelSizes = usePreferencesStore((s) => s.setPanelSizes);

  // Guard to prevent onLayoutChanged from marking preset changes as "custom"
  const isApplyingPreset = useRef(false);

  // Apply preset changes via imperative API
  useEffect(() => {
    if (layoutState.activePreset === "custom") return;
    const preset = getPresetById(layoutState.activePreset);
    if (!preset || !groupRef.current) return;

    isApplyingPreset.current = true;
    groupRef.current.setLayout(preset.layout);

    // Handle sidebar collapse/expand for focus preset
    if (!preset.visiblePanels.includes("sidebar")) {
      sidebarRef.current?.collapse();
    } else if (sidebarRef.current?.isCollapsed()) {
      sidebarRef.current?.expand();
    }

    queueMicrotask(() => {
      isApplyingPreset.current = false;
    });
  }, [layoutState.activePreset, groupRef, sidebarRef]);

  // Handle focus mode
  useEffect(() => {
    if (layoutState.focusedPanel === "blades") {
      // Maximize blades: collapse sidebar
      isApplyingPreset.current = true;
      sidebarRef.current?.collapse();
      groupRef.current?.setLayout({ sidebar: 0, blades: 100 });
      queueMicrotask(() => {
        isApplyingPreset.current = false;
      });
    } else if (layoutState.focusedPanel === null) {
      // Restore to active preset's layout
      const preset = getPresetById(layoutState.activePreset);
      isApplyingPreset.current = true;
      if (preset && groupRef.current) {
        groupRef.current.setLayout(preset.layout);
        if (preset.visiblePanels.includes("sidebar")) {
          sidebarRef.current?.expand();
        }
      } else {
        // custom: restore saved sizes
        groupRef.current?.setLayout(layoutState.panelSizes);
        if (!layoutState.hiddenPanels.includes("sidebar")) {
          sidebarRef.current?.expand();
        }
      }
      queueMicrotask(() => {
        isApplyingPreset.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutState.focusedPanel]);

  // Handle sidebar toggle via hiddenPanels
  useEffect(() => {
    const sidebarHidden = layoutState.hiddenPanels.includes("sidebar");
    if (sidebarHidden) {
      sidebarRef.current?.collapse();
    } else if (sidebarRef.current?.isCollapsed()) {
      sidebarRef.current?.expand();
    }
  }, [layoutState.hiddenPanels, sidebarRef]);

  // Persist manual resize via onLayoutChanged
  const handleLayoutChanged = useCallback(
    (layout: Layout) => {
      // Don't mark as "custom" when we're programmatically applying a preset
      if (isApplyingPreset.current) return;
      setPanelSizes(layout as Record<string, number>);
    },
    [setPanelSizes],
  );

  // Listen for create-branch-dialog event from command palette
  useEffect(() => {
    const handler = () => setShowBranchDialog(true);
    document.addEventListener("create-branch-dialog", handler);
    return () => document.removeEventListener("create-branch-dialog", handler);
  }, []);

  if (!status) return null;

  return (
    <>
      <ResizablePanelLayout
        autoSaveId="repo-layout"
        direction="horizontal"
        groupRef={groupRef}
        onLayoutChanged={handleLayoutChanged}
      >
        {/* Left sidebar - Branches, Stash, Tags */}
        <ResizablePanel
          id="sidebar"
          defaultSize={20}
          minSize={15}
          maxSize={30}
          panelRef={sidebarRef}
          collapsible
          collapsedSize={0}
        >
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

    </>
  );
}
