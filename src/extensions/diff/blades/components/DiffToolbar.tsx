import {
  AlignJustify,
  Code,
  Columns,
  Eye,
  FoldVertical,
  ListPlus,
  ListMinus,
  UnfoldVertical,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/core/components/ui/button";

interface StagingActions {
  staged: boolean;
  hunkCount: number;
  onStageAll: () => void;
  onUnstageAll: () => void;
  isPending: boolean;
}

interface DiffToolbarProps {
  inline: boolean;
  onToggleInline: () => void;
  collapseUnchanged: boolean;
  onToggleCollapse: () => void;
  isMarkdown?: boolean;
  showPreview?: boolean;
  onTogglePreview?: () => void;
  trailing?: ReactNode;
  stagingActions?: StagingActions;
}

export function DiffToolbar({
  inline,
  onToggleInline,
  collapseUnchanged,
  onToggleCollapse,
  isMarkdown,
  showPreview,
  onTogglePreview,
  trailing,
  stagingActions,
}: DiffToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Diff viewer controls"
      className="flex items-center gap-2 px-3 py-1 border-b border-ctp-surface0 bg-ctp-crust shrink-0"
    >
      {isMarkdown && (
        <div className="flex bg-ctp-surface0 rounded p-0.5">
          <button
            type="button"
            onClick={() => onTogglePreview?.()}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
              !showPreview
                ? "bg-ctp-surface1 text-ctp-text"
                : "text-ctp-overlay0 hover:text-ctp-subtext1"
            }`}
            title="Show diff"
          >
            <Code className="w-3.5 h-3.5" />
            Diff
          </button>
          <button
            type="button"
            onClick={() => onTogglePreview?.()}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
              showPreview
                ? "bg-ctp-surface1 text-ctp-text"
                : "text-ctp-overlay0 hover:text-ctp-subtext1"
            }`}
            title="Show rendered preview"
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>
      )}

      {isMarkdown && !showPreview && (
        <div className="w-px h-4 bg-ctp-surface1" />
      )}

      {!showPreview && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleInline}
            title={inline ? "Switch to side-by-side" : "Switch to inline"}
            className="h-7 px-2"
          >
            {inline ? (
              <Columns className="w-4 h-4" />
            ) : (
              <AlignJustify className="w-4 h-4" />
            )}
            <span className="text-xs ml-1.5">
              {inline ? "Side-by-side" : "Inline"}
            </span>
          </Button>
          <div className="w-px h-4 bg-ctp-surface1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            title={collapseUnchanged ? "Show all lines" : "Collapse unchanged regions"}
            className="h-7 px-2"
          >
            {collapseUnchanged ? (
              <UnfoldVertical className="w-4 h-4" />
            ) : (
              <FoldVertical className="w-4 h-4" />
            )}
            <span className="text-xs ml-1.5">
              {collapseUnchanged ? "Show all" : "Collapse"}
            </span>
          </Button>
        </>
      )}

      {stagingActions && stagingActions.hunkCount > 0 && !showPreview && (
        <>
          <div className="w-px h-4 bg-ctp-surface1" />
          {stagingActions.staged ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={stagingActions.onUnstageAll}
              disabled={stagingActions.isPending}
              title={`Unstage all ${stagingActions.hunkCount} hunks`}
              className="h-7 px-2 text-ctp-peach hover:text-ctp-peach"
            >
              <ListMinus className="w-4 h-4" />
              <span className="text-xs ml-1.5">Unstage All</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={stagingActions.onStageAll}
              disabled={stagingActions.isPending}
              title={`Stage all ${stagingActions.hunkCount} hunks`}
              className="h-7 px-2 text-ctp-green hover:text-ctp-green"
            >
              <ListPlus className="w-4 h-4" />
              <span className="text-xs ml-1.5">Stage All</span>
            </Button>
          )}
        </>
      )}

      <div className="flex-1" />
      {trailing}
    </div>
  );
}
