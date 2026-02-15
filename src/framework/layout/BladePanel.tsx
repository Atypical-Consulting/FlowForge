import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface BladePanelProps {
  children: ReactNode;
  title: string;
  /** Optional ReactNode rendered as the title instead of the plain string. */
  titleContent?: ReactNode;
  /** Optional trailing element rendered at the end of the title bar. */
  trailing?: ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  /** Whether focus mode is currently active. */
  isFocusMode?: boolean;
  /** Callback to toggle focus mode on double-click. */
  onToggleFocusMode?: () => void;
}

export function BladePanel({
  children,
  title,
  titleContent,
  trailing,
  onBack,
  showBack,
  isFocusMode = false,
  onToggleFocusMode,
}: BladePanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div
        className={cn(
          "h-10 px-3 flex items-center gap-2 border-b border-ctp-surface0 shrink-0",
          isFocusMode ? "bg-ctp-blue/10" : "bg-ctp-crust",
        )}
        onDoubleClick={onToggleFocusMode}
        title="Double-click to toggle focus mode"
      >
        {showBack && (
          <button
            onClick={onBack}
            className="p-1 rounded hover:bg-ctp-surface0 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4 text-ctp-subtext1" />
          </button>
        )}
        {titleContent ?? (
          <span className="text-sm font-medium text-ctp-subtext1 truncate">
            {title}
          </span>
        )}
        {trailing && <div className="ml-auto shrink-0">{trailing}</div>}
        {isFocusMode && (
          <span
            className={cn(
              "text-[10px] text-ctp-subtext0 shrink-0",
              !trailing && "ml-auto",
            )}
          >
            Esc to exit focus
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
