import { Check, Undo } from "lucide-react";
import type { ConflictHunk, ResolutionChoice } from "../../types";

interface ConflictHunkActionsProps {
  hunks: ConflictHunk[];
  filePath: string;
  onResolveHunk: (hunkId: string, choice: ResolutionChoice) => void;
  onUndo: () => void;
  undoAvailable: boolean;
}

const RESOLUTION_BUTTONS: {
  choice: ResolutionChoice;
  label: string;
  base: string;
  active: string;
}[] = [
  {
    choice: "ours",
    label: "Accept Ours",
    base: "bg-ctp-blue/20 hover:bg-ctp-blue/30 text-ctp-blue border-ctp-blue/30",
    active: "bg-ctp-blue/40 text-ctp-blue border-ctp-blue/60",
  },
  {
    choice: "theirs",
    label: "Accept Theirs",
    base: "bg-ctp-mauve/20 hover:bg-ctp-mauve/30 text-ctp-mauve border-ctp-mauve/30",
    active: "bg-ctp-mauve/40 text-ctp-mauve border-ctp-mauve/60",
  },
  {
    choice: "both",
    label: "Accept Both",
    base: "bg-ctp-green/20 hover:bg-ctp-green/30 text-ctp-green border-ctp-green/30",
    active: "bg-ctp-green/40 text-ctp-green border-ctp-green/60",
  },
];

export function ConflictHunkActions({
  hunks,
  filePath,
  onResolveHunk,
  onUndo,
  undoAvailable,
}: ConflictHunkActionsProps) {
  return (
    <div className="px-3 py-2 border-y border-ctp-surface0 bg-ctp-mantle flex flex-wrap items-center gap-3">
      {hunks.map((hunk, index) => (
        <div
          key={hunk.id}
          className="flex items-center gap-2"
          role="group"
          aria-label={`Resolution actions for conflict ${index + 1}`}
        >
          <span className="text-xs text-ctp-subtext0 mr-1 flex items-center gap-1">
            {hunk.resolution ? (
              <Check className="w-3 h-3 text-ctp-green" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-ctp-red inline-block" />
            )}
            #{index + 1}
            <span className="text-ctp-overlay0">
              (L{hunk.startLine}-{hunk.endLine})
            </span>
          </span>

          {RESOLUTION_BUTTONS.map(({ choice, label, base, active }) => (
            <button
              key={choice}
              onClick={() => onResolveHunk(hunk.id, choice)}
              aria-label={`${label} for conflict ${index + 1}`}
              className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                hunk.resolution === choice ? active : base
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ))}

      <div className="ml-auto">
        <button
          onClick={onUndo}
          disabled={!undoAvailable}
          aria-label="Undo last resolution"
          className="flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-ctp-surface1 text-ctp-subtext0 hover:bg-ctp-surface0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Undo className="w-3 h-3" />
          Undo
        </button>
      </div>
    </div>
  );
}
