import { ChevronLeft, Circle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface BladeStripProps {
  title: string;
  icon?: ReactNode;
  isDirty?: boolean;
  onExpand: () => void;
}

export function BladeStrip({ title, isDirty, onExpand }: BladeStripProps) {
  return (
    <button
      onClick={onExpand}
      className={cn(
        "w-10 shrink-0 border-r border-ctp-surface0 bg-ctp-base hover:bg-ctp-surface0 transition-colors flex flex-col items-center py-3 gap-2",
        isDirty && "border-l-2 border-l-ctp-yellow",
      )}
      aria-label={`${isDirty ? "Unsaved changes in " : ""}${title} panel. Click to expand.`}
    >
      <ChevronLeft className="w-4 h-4 text-ctp-overlay1" />
      {isDirty && (
        <Circle className="w-2 h-2 fill-ctp-yellow text-ctp-yellow shrink-0 motion-safe:animate-pulse" />
      )}
      <span
        className={cn(
          "text-xs [writing-mode:vertical-lr] rotate-180",
          isDirty ? "text-ctp-yellow" : "text-ctp-subtext0",
        )}
      >
        {title}
      </span>
    </button>
  );
}
